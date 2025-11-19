import sys
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
import time
from urllib.parse import urlparse
import re

class TrackingPixelDetector:
    def __init__(self, url):
        self.url = url
        self.driver = None
        self.beacon_requests = []
        self.tracking_pixels = []
        
    def setup_driver(self):
        """Initialize Chrome WebDriver with network monitoring"""
        chrome_options = Options()
        # Uncomment for headless mode: chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        
        self.driver = webdriver.Chrome(options=chrome_options)
        
    def load_page(self):
        """Load the URL and wait for page to load"""
        try:
            self.driver.get(self.url)
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_all_elements_located((By.TAG_NAME, "body"))
            )
            time.sleep(2)  # Additional wait for network requests
            print(f"✓ Page loaded: {self.url}")
        except Exception as e:
            print(f"✗ Error loading page: {e}")
            return False
        return True
    
    def check_beacon_api(self):
        """Check for Beacon API calls in network activity"""
        try:
            # Get all network logs via JavaScript
            script = """
            return window.performance.getEntries().filter(entry => 
                entry.initiatorType === 'beacon' || 
                entry.name.includes('beacon') ||
                entry.name.includes('track') ||
                entry.name.includes('pixel')
            ).map(entry => ({
                name: entry.name,
                type: entry.initiatorType,
                duration: entry.duration
            }));
            """
            beacon_requests = self.driver.execute_script(script)
            self.beacon_requests = beacon_requests
            
            if beacon_requests:
                print(f"\n🔍 Found {len(beacon_requests)} Beacon API requests:")
                for req in beacon_requests:
                    print(f"  - {req['name']}")
            else:
                print("\n🔍 No Beacon API requests detected")
                
        except Exception as e:
            print(f"✗ Error checking Beacon API: {e}")
    
    def scan_tracking_pixels(self):
        """Scan page source for 1x1 transparent images"""
        try:
            page_source = self.driver.page_source
            
            # Patterns for tracking pixels
            patterns = [
                r'<img[^>]*(?:width=["\']?1["\']?|height=["\']?1["\']?)[^>]*>',
                r'<img[^>]*src=["\']([^"\']+)["\'][^>]*(?:width=["\']?1["\']?|height=["\']?1["\']?)[^>]*>',
                r'<pixel[^>]*>',
                r'<img[^>]*style=["\']([^"\']*(?:width:\s*1px|height:\s*1px)[^\'"]*)["\'][^>]*>',
            ]
            
            for pattern in patterns:
                matches = re.finditer(pattern, page_source, re.IGNORECASE)
                for match in matches:
                    img_tag = match.group(0)
                    
                    # Extract src, width, height, and style
                    src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag, re.IGNORECASE)
                    width_match = re.search(r'width=["\']?(\d+)["\']?', img_tag, re.IGNORECASE)
                    height_match = re.search(r'height=["\']?(\d+)["\']?', img_tag, re.IGNORECASE)
                    style_match = re.search(r'style=["\']([^"\']+)["\']', img_tag, re.IGNORECASE)
                    
                    src = src_match.group(1) if src_match else "Unknown"
                    width = width_match.group(1) if width_match else "Not specified"
                    height = height_match.group(1) if height_match else "Not specified"
                    style = style_match.group(1) if style_match else "None"
                    
                    # Check if it's a tracking pixel (1x1 and transparent)
                    is_tracking = (
                        (width == "1" and height == "1") or
                        "display:none" in style.lower() or
                        "visibility:hidden" in style.lower() or
                        "width:1px" in style.lower() or
                        "height:1px" in style.lower()
                    )
                    
                    if is_tracking:
                        self.tracking_pixels.append({
                            "tag": img_tag[:150],
                            "src": src,
                            "width": width,
                            "height": height,
                            "style": style
                        })
            
            if self.tracking_pixels:
                print(f"\n⚠️  Found {len(self.tracking_pixels)} potential tracking pixels:")
                for idx, pixel in enumerate(self.tracking_pixels, 1):
                    print(f"\n  Pixel #{idx}:")
                    print(f"    Source: {pixel['src']}")
                    print(f"    Dimensions: {pixel['width']}x{pixel['height']}")
                    print(f"    Style: {pixel['style']}")
            else:
                print("\n✓ No obvious tracking pixels found in page source")
                
        except Exception as e:
            print(f"✗ Error scanning tracking pixels: {e}")
    
    def get_element_position(self, img_element):
        """Get the screen position of an image element"""
        try:
            location = img_element.location
            size = img_element.size
            return {
                "x": location['x'],
                "y": location['y'],
                "width": size['width'],
                "height": size['height']
            }
        except:
            return None
    
    def generate_report(self):
        """Generate and display the full report"""
        print("\n" + "="*60)
        print("🎯 TRACKING PIXEL DETECTION REPORT")
        print("="*60)
        print(f"URL: {self.url}")
        print(f"Domain: {urlparse(self.url).netloc}")
        print("="*60)
        
        if self.beacon_requests:
            print(f"\n✓ Beacon API Activity: DETECTED ({len(self.beacon_requests)} requests)")
            print("  → Indicates potential tracking via Beacon API")
        else:
            print("\n✓ Beacon API Activity: None detected")
        
        if self.tracking_pixels:
            print(f"\n⚠️  Tracking Pixels: FOUND ({len(self.tracking_pixels)})")
        else:
            print("\n✓ Tracking Pixels: None detected")
        
        print("\n" + "="*60)
    
    def run(self):
        """Execute the full detection process"""
        try:
            self.setup_driver()
            if not self.load_page():
                return False
            
            self.check_beacon_api()
            self.scan_tracking_pixels()
            self.generate_report()
            
            return True
            
        except Exception as e:
            print(f"✗ Fatal error: {e}")
            return False
        finally:
            if self.driver:
                self.driver.quit()

def main():
    if len(sys.argv) < 2:
        print("Usage: python tracking_pixel_detector.py <URL>")
        print("Example: python tracking_pixel_detector.py https://example.com")
        sys.exit(1)
    
    url = sys.argv[1].strip()
    
    # Validate URL format
    if not url or url.startswith('%') or 'python' in url.lower() or 'track-snack' in url:
        print("✗ Invalid URL provided")
        print("Usage: python tracking_pixel_detector.py <URL>")
        print("Example: python tracking_pixel_detector.py 'https://example.com'")
        sys.exit(1)
    
    # Ensure URL has protocol
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    # Validate it's a proper URL
    try:
        result = urlparse(url)
        if not result.netloc:
            raise ValueError("Invalid URL format")
    except Exception as e:
        print(f"✗ Invalid URL: {e}")
        sys.exit(1)
    
    detector = TrackingPixelDetector(url)
    detector.run()

if __name__ == "__main__":
    main()