// Content script for Chrome extension - Detects tracking pixels by DOM scraping
(function() {
  'use strict';

  // Common tracking domains to check against
  const TRACKING_DOMAINS = [
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    'facebook.com',
    'facebook.net',
    'connect.facebook.net',
    'analytics.twitter.com',
    'bat.bing.com',
    'pixel.quantserve.com',
    'scorecardresearch.com',
    'crwdcntrl.net',
    'adsrvr.org',
    'adnxs.com',
    'pixel.advertising.com',
    'stats.g.doubleclick.net',
    'tr.snapchat.com',
    'analytics.tiktok.com',
    'ct.pinterest.com'
  ];

  // Check if URL is from a known tracking domain
  function isTrackingDomain(url) {
    if (!url) return false;
    try {
      const hostname = new URL(url, window.location.href).hostname;
      return TRACKING_DOMAINS.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  // Check if element dimensions indicate a tracking pixel
  function hasTrackingPixelDimensions(element) {
    const rect = element.getBoundingClientRect();
    const computed = window.getComputedStyle(element);
    
    // Get width/height from various sources
    const width = rect.width || 
                  parseInt(computed.width) || 
                  element.width || 
                  element.getAttribute('width');
    const height = rect.height || 
                   parseInt(computed.height) || 
                   element.height || 
                   element.getAttribute('height');
    
    const w = parseInt(width);
    const h = parseInt(height);
    
    // Must be 1x1 or 2x2, but not 0x0
    return w > 0 && h > 0 && w <= 2 && h <= 2;
  }

  // Check if element is hidden/invisible
  function isHidden(element) {
    const computed = window.getComputedStyle(element);
    return computed.display === 'none' ||
           computed.visibility === 'hidden' ||
           computed.opacity === '0' ||
           computed.opacity === '0.0' ||
           element.style.display === 'none' ||
           element.style.visibility === 'hidden';
  }

  // Detect tracking pixels in <img> tags
  function detectImagePixels() {
    const pixels = [];
    const images = document.querySelectorAll('img');
    
    console.log(`[detectImagePixels] Checking ${images.length} image elements...`);
    
    images.forEach((img, index) => {
      const hasSmallDimensions = hasTrackingPixelDimensions(img);
      const hasTrackingUrl = isTrackingDomain(img.src);
      const hidden = isHidden(img);
      
      // Consider it a tracking pixel if:
      // 1. Small dimensions + tracking domain
      // 2. Small dimensions + hidden
      // 3. Small dimensions + src contains tracking keywords
      const srcLower = (img.src || '').toLowerCase();
      const hasTrackingKeywords = srcLower.includes('pixel') || 
                                   srcLower.includes('track') || 
                                   srcLower.includes('beacon') ||
                                   srcLower.includes('collect');
      
      if (hasSmallDimensions && (hasTrackingUrl || hidden || hasTrackingKeywords)) {
        console.log(`  ✓ Found tracking pixel (img ${index}):`, {
          smallDimensions: hasSmallDimensions,
          trackingDomain: hasTrackingUrl,
          hidden: hidden,
          trackingKeywords: hasTrackingKeywords,
          src: img.src.substring(0, 80) + '...'
        });
        
        pixels.push({
          element: img,
          type: 'img',
          src: img.src,
          method: 'DOM_IMG',
          confidence: calculateConfidence(hasSmallDimensions, hasTrackingUrl, hidden, hasTrackingKeywords),
          detectionReasons: {
            smallDimensions: hasSmallDimensions,
            trackingDomain: hasTrackingUrl,
            hidden: hidden,
            trackingKeywords: hasTrackingKeywords
          }
        });
      }
    });
    
    console.log(`[detectImagePixels] Found ${pixels.length} tracking pixels`);
    return pixels;
  }

  // Detect tracking pixels in CSS background images
  function detectBackgroundPixels() {
    const pixels = [];
    const allElements = document.querySelectorAll('*');
    
    console.log(`[detectBackgroundPixels] Checking ${allElements.length} elements for background images...`);
    
    allElements.forEach(el => {
      const computed = window.getComputedStyle(el);
      const bgImage = computed.backgroundImage;
      
      if (bgImage && bgImage !== 'none') {
        const rect = el.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        if (width > 0 && height > 0 && width <= 2 && height <= 2) {
          const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
          if (urlMatch) {
            const url = urlMatch[1];
            const hasTrackingUrl = isTrackingDomain(url);
            const hidden = isHidden(el);
            
            if (hasTrackingUrl || hidden) {
              console.log(`  ✓ Found tracking pixel (background):`, {
                smallDimensions: true,
                trackingDomain: hasTrackingUrl,
                hidden: hidden,
                url: url.substring(0, 80) + '...'
              });
              
              pixels.push({
                element: el,
                type: 'background',
                src: url,
                method: 'CSS_BACKGROUND',
                confidence: calculateConfidence(true, hasTrackingUrl, hidden, false),
                detectionReasons: {
                  smallDimensions: true,
                  trackingDomain: hasTrackingUrl,
                  hidden: hidden,
                  trackingKeywords: false
                }
              });
            }
          }
        }
      }
    });
    
    console.log(`[detectBackgroundPixels] Found ${pixels.length} tracking pixels`);
    return pixels;
  }

  // Detect tracking pixels in <noscript> tags
  function detectNoscriptPixels() {
    const pixels = [];
    const noscripts = document.querySelectorAll('noscript');
    
    console.log(`[detectNoscriptPixels] Checking ${noscripts.length} noscript tags...`);
    
    noscripts.forEach(noscript => {
      const content = noscript.innerHTML;
      
      // Parse img tags in noscript content
      const imgRegex = /<img[^>]*>/gi;
      const matches = content.matchAll(imgRegex);
      
      for (const match of matches) {
        const imgTag = match[0];
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
        const widthMatch = imgTag.match(/(?:width=["']?(\d+)["']?|width:\s*(\d+))/i);
        const heightMatch = imgTag.match(/(?:height=["']?(\d+)["']?|height:\s*(\d+))/i);
        
        if (srcMatch) {
          const src = srcMatch[1];
          const width = widthMatch ? parseInt(widthMatch[1] || widthMatch[2]) : null;
          const height = heightMatch ? parseInt(heightMatch[1] || heightMatch[2]) : null;
          
          if (width && height && width > 0 && height > 0 && width <= 2 && height <= 2) {
            const hasTrackingUrl = isTrackingDomain(src);
            
            console.log(`  ✓ Found tracking pixel (noscript):`, {
              dimensions: `${width}x${height}`,
              trackingDomain: hasTrackingUrl,
              src: src.substring(0, 80) + '...'
            });
            
            pixels.push({
              element: noscript,
              type: 'noscript-img',
              src: src,
              method: 'NOSCRIPT',
              confidence: hasTrackingUrl ? 'high' : 'medium',
              detectionReasons: {
                smallDimensions: true,
                trackingDomain: hasTrackingUrl,
                hidden: true,
                trackingKeywords: false
              }
            });
          }
        }
      }
    });
    
    console.log(`[detectNoscriptPixels] Found ${pixels.length} tracking pixels`);
    return pixels;
  }

  // Detect tracking iframes
  function detectTrackingIframes() {
    const pixels = [];
    const iframes = document.querySelectorAll('iframe');
    
    console.log(`[detectTrackingIframes] Checking ${iframes.length} iframe elements...`);
    
    iframes.forEach(iframe => {
      const rect = iframe.getBoundingClientRect();
      const hasSmallDimensions = rect.width <= 2 && rect.height <= 2 && rect.width > 0 && rect.height > 0;
      const hasTrackingUrl = isTrackingDomain(iframe.src);
      const hidden = isHidden(iframe);
      
      if (hasSmallDimensions && (hasTrackingUrl || hidden)) {
        console.log(`  ✓ Found tracking pixel (iframe):`, {
          dimensions: `${rect.width}x${rect.height}`,
          trackingDomain: hasTrackingUrl,
          hidden: hidden,
          src: iframe.src.substring(0, 80) + '...'
        });
        
        pixels.push({
          element: iframe,
          type: 'iframe',
          src: iframe.src,
          method: 'IFRAME',
          confidence: hasTrackingUrl ? 'high' : 'medium',
          detectionReasons: {
            smallDimensions: hasSmallDimensions,
            trackingDomain: hasTrackingUrl,
            hidden: hidden,
            trackingKeywords: false
          }
        });
      }
    });
    
    console.log(`[detectTrackingIframes] Found ${pixels.length} tracking pixels`);
    return pixels;
  }

  // Calculate confidence level
  function calculateConfidence(hasSmallDimensions, hasTrackingUrl, hidden, hasKeywords) {
    let score = 0;
    if (hasSmallDimensions) score += 2;
    if (hasTrackingUrl) score += 3;
    if (hidden) score += 2;
    if (hasKeywords) score += 1;
    
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  // Get contrasting color for the indicator based on background
  function getContrastColor(element) {
    // Get background color of element and its parents
    let bgColor = null;
    let currentElement = element;
    
    while (currentElement && !bgColor) {
      const computed = window.getComputedStyle(currentElement);
      const bg = computed.backgroundColor;
      
      // Check if background is not transparent
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        bgColor = bg;
        break;
      }
      currentElement = currentElement.parentElement;
    }
    
    // Default to white if no background found
    if (!bgColor) {
      return { border: '#00ff00', bg: 'rgba(0, 255, 0, 0.2)' }; // Bright green
    }
    
    // Parse RGB values
    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!rgbMatch) {
      return { border: '#00ff00', bg: 'rgba(0, 255, 0, 0.2)' };
    }
    
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Choose contrasting color based on luminance
    if (luminance > 0.5) {
      // Light background - use dark/bright colors
      return { border: '#ff0000', bg: 'rgba(255, 0, 0, 0.3)' }; // Red
    } else {
      // Dark background - use bright colors
      return { border: '#00ff00', bg: 'rgba(0, 255, 0, 0.3)' }; // Bright green
    }
  }

  // Highlight tracking pixel with visual indicator
  function highlightPixel(pixelData) {
    const element = pixelData.element;
    
    // Don't highlight if already marked
    if (element.hasAttribute('data-tracking-pixel-highlighted')) {
      return;
    }
    
    element.setAttribute('data-tracking-pixel-highlighted', 'true');
    
    // Get contrasting colors
    const colors = getContrastColor(element);
    
    // Create visual indicator overlay
    const indicator = document.createElement('div');
    indicator.className = 'tracking-pixel-indicator';
    indicator.setAttribute('data-pixel-type', pixelData.type);
    indicator.setAttribute('data-pixel-confidence', pixelData.confidence);
    
    // Get element position
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Style the indicator with contrasting colors
    indicator.style.cssText = `
      position: absolute;
      width: 24px;
      height: 24px;
      border: 3px solid ${colors.border};
      border-radius: 50%;
      pointer-events: none;
      z-index: 2147483647;
      background: ${colors.bg};
      box-shadow: 0 0 15px ${colors.border};
      left: ${scrollX + rect.left - 12}px;
      top: ${scrollY + rect.top - 12}px;
      animation: pulse 2s infinite;
    `;
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tracking-pixel-tooltip';
    tooltip.innerHTML = `
      🔍 Tracking Pixel<br>
      <small>${pixelData.method} (${pixelData.confidence})</small>
    `;
    tooltip.style.cssText = `
      position: absolute;
      top: -50px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      line-height: 1.4;
      text-align: center;
    `;
    
    indicator.appendChild(tooltip);
    
    // Show tooltip on hover
    indicator.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
    });
    indicator.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    document.body.appendChild(indicator);
    
    return indicator;
  }

  // Add CSS animation for pulsing effect
  function injectStyles() {
    if (document.getElementById('tracking-pixel-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'tracking-pixel-styles';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);
  }

  // Main scan function
  function scanForTrackingPixels() {
    console.log('[Tracking Pixel Detector] Scanning page...');
    
    // Remove old indicators
    document.querySelectorAll('.tracking-pixel-indicator').forEach(el => el.remove());
    document.querySelectorAll('[data-tracking-pixel-highlighted]').forEach(el => {
      el.removeAttribute('data-tracking-pixel-highlighted');
    });
    
    // Inject styles
    injectStyles();
    
    // Run all detection methods
    const allPixels = [
      ...detectImagePixels(),
      ...detectBackgroundPixels(),
      ...detectNoscriptPixels(),
      ...detectTrackingIframes()
    ];
    
    // Highlight each detected pixel
    allPixels.forEach(pixel => {
      highlightPixel(pixel);
    });
    
    console.log(`[Tracking Pixel Detector] Found ${allPixels.length} tracking pixels`);
    
    // Log details for each pixel
    allPixels.forEach((pixel, index) => {
      console.log(`\n📍 Pixel ${index + 1}:`);
      console.log(`  Type: ${pixel.type}`);
      console.log(`  Method: ${pixel.method}`);
      console.log(`  Confidence: ${pixel.confidence}`);
      console.log(`  URL: ${pixel.src}`);
      console.log(`  Detection Reasons:`);
      if (pixel.detectionReasons) {
        console.log(`    - Small dimensions (1x1 or 2x2): ${pixel.detectionReasons.smallDimensions ? '✓' : '✗'}`);
        console.log(`    - Known tracking domain: ${pixel.detectionReasons.trackingDomain ? '✓' : '✗'}`);
        console.log(`    - Hidden/invisible: ${pixel.detectionReasons.hidden ? '✓' : '✗'}`);
        console.log(`    - Tracking keywords in URL: ${pixel.detectionReasons.trackingKeywords ? '✓' : '✗'}`);
      }
      console.log(`  Element:`, pixel.element);
    });
    
    // Return results for extension popup
    return {
      count: allPixels.length,
      pixels: allPixels.map(p => ({
        type: p.type,
        src: p.src,
        method: p.method,
        confidence: p.confidence
      }))
    };
  }

  // Configuration
  const AUTO_RESCAN = false; // Set to true for extension, false for console testing

  // Run initial scan when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanForTrackingPixels);
  } else {
    scanForTrackingPixels();
  }

  // Re-scan on dynamic content changes (debounced)
  if (AUTO_RESCAN) {
    let scanTimeout;
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanForTrackingPixels, 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Listen for messages from extension popup (only in extension context)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'scan') {
        const results = scanForTrackingPixels();
        sendResponse(results);
      }
      return true;
    });
  }

  // Export for testing (optional)
  window.trackingPixelDetector = {
    scan: scanForTrackingPixels,
    detectImagePixels,
    detectBackgroundPixels,
    detectNoscriptPixels,
    detectTrackingIframes
  };

})();