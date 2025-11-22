// Tracking pixel detection script
(function() {
  let trackingPixels = [];
  let highlightingEnabled = true;
  
  // Common tracking domains
  const trackingDomains = [
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    'facebook.com/tr',
    'connect.facebook.net',
    'pixel.wp.com',
    'analytics.twitter.com',
    'bat.bing.com',
    'linkedin.com/px',
    'snapchat.com/tr',
    'tiktok.com/i18n/pixel',
    'reddit.com/api/pixel'
  ];
  
  // Highlight detected tracking pixels
  function highlightElement(element) {
    if (!highlightingEnabled || element.dataset.hasOverlay === 'true') return;
    
    // Create a visible red box overlay
    const overlay = document.createElement('div');
    overlay.className = 'tracking-pixel-overlay';
    overlay.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: rgba(255, 0, 0, 0.8);
      border: 3px solid #ff0000;
      pointer-events: none;
      z-index: 2147483647;
      border-radius: 3px;
      box-shadow: 0 0 10px rgba(255, 0, 0, 1), 0 0 20px rgba(255, 0, 0, 0.5);
    `;
    
    // Position the overlay using fixed positioning
    const rect = element.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    
    // Add to body or create container if needed
    if (!document.body) return;
    document.body.appendChild(overlay);
    element.dataset.hasOverlay = 'true';
    
    console.log('Highlighted element at:', rect.left, rect.top, 'Source:', element.src || element.outerHTML.substring(0, 100));
    
    // Update position on scroll
    const updatePosition = () => {
      const newRect = element.getBoundingClientRect();
      overlay.style.left = newRect.left + 'px';
      overlay.style.top = newRect.top + 'px';
    };
    
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
  }
  
  // Remove all highlights
  function removeHighlights() {
    const overlays = document.querySelectorAll('.tracking-pixel-overlay');
    overlays.forEach(overlay => overlay.remove());
    
    // Clear the hasOverlay markers
    trackingPixels.forEach(pixel => {
      if (pixel.element && pixel.element.dataset) {
        delete pixel.element.dataset.hasOverlay;
      }
    });
  }
  
  // Detect tracking pixels
  function detectTrackingPixels() {
    // Store existing overlays before clearing
    const existingOverlays = document.querySelectorAll('.tracking-pixel-overlay');
    const overlayMap = new Map();
    
    existingOverlays.forEach(overlay => {
      const key = overlay.style.left + '-' + overlay.style.top;
      overlayMap.set(key, overlay);
    });
    
    trackingPixels = []; // Clear previous results
    
    // Check images
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      const src = img.src || '';
      const width = img.width;
      const height = img.height;
      
      // Check for 1x1 pixels or tracking domains
      const isSmallPixel = (width === 1 && height === 1) || 
                          (width === 0 && height === 0);
      const isTrackingDomain = trackingDomains.some(domain => src.includes(domain));
      
      if (isSmallPixel || isTrackingDomain) {
        trackingPixels.push({
          type: 'image',
          src: src,
          element: img,
          dimensions: `${width}x${height}`
        });
        
        // Only highlight if not already highlighted
        if (!img.dataset.hasOverlay || img.dataset.hasOverlay !== 'true') {
          highlightElement(img);
        }
      }
    });
    
    // Check iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.src || '';
      const width = iframe.width;
      const height = iframe.height;
      
      const isSmallFrame = (width <= 1 && height <= 1);
      const isTrackingDomain = trackingDomains.some(domain => src.includes(domain));
      
      if (isSmallFrame || isTrackingDomain) {
        trackingPixels.push({
          type: 'iframe',
          src: src,
          element: iframe,
          dimensions: `${width}x${height}`
        });
        
        if (!iframe.dataset.hasOverlay || iframe.dataset.hasOverlay !== 'true') {
          highlightElement(iframe);
        }
      }
    });
    
    // Check scripts that might load pixels
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.src || '';
      if (trackingDomains.some(domain => src.includes(domain))) {
        trackingPixels.push({
          type: 'script',
          src: src,
          element: script
        });
      }
    });
  }
  
  // Toggle highlighting
  function toggleHighlighting(enabled) {
    highlightingEnabled = enabled;
    if (!enabled) {
      removeHighlights();
    } else {
      // Re-highlight all detected pixels
      trackingPixels.forEach(pixel => {
        if (pixel.element && pixel.element.dataset.hasOverlay !== 'true') {
          highlightElement(pixel.element);
        }
      });
    }
  }
  
  // Set up message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTrackingPixels') {
      console.log('Sending pixel data:', trackingPixels.length, 'pixels found');
      sendResponse({
        count: trackingPixels.length,
        pixels: trackingPixels.map(p => ({
          type: p.type,
          src: p.src,
          dimensions: p.dimensions
        })),
        highlightingEnabled: highlightingEnabled
      });
    } else if (request.action === 'toggleHighlighting') {
      toggleHighlighting(request.enabled);
      sendResponse({ success: true });
    } else if (request.action === 'rescan') {
      detectTrackingPixels();
      sendResponse({
        count: trackingPixels.length,
        pixels: trackingPixels.map(p => ({
          type: p.type,
          src: p.src,
          dimensions: p.dimensions
        })),
        highlightingEnabled: highlightingEnabled
      });
    } else if (request.action === 'testOverlay') {
      // Create a test overlay in the center of the screen
      const testBox = document.createElement('div');
      testBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100px;
        height: 100px;
        background: rgba(255, 0, 0, 0.8);
        border: 5px solid #ff0000;
        z-index: 2147483647;
        box-shadow: 0 0 20px rgba(255, 0, 0, 1);
      `;
      document.body.appendChild(testBox);
      setTimeout(() => testBox.remove(), 3000);
      sendResponse({ success: true });
    }
    return true; // Keep the message channel open for async response
  });
  
  // Run initial detection
  detectTrackingPixels();
  
  // Re-run detection when DOM changes
  const observer = new MutationObserver(() => {
    detectTrackingPixels();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();