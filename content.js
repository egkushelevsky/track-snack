// Tracking pixel detection script
(function() {
  let trackingPixels = [];
  let beaconRequests = [];
  let highlightingEnabled = false; // START WITH HIGHLIGHTING OFF
  let scanningEnabled = false; // Start paused
  let observer = null;
  
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
    'reddit.com/api/pixel',
    'analytics.yahoo.com'
  ];
  
  // Highlight detected tracking pixels
  function highlightElement(element, isHidden = false) {
    if (!highlightingEnabled || !scanningEnabled || element.dataset.hasOverlay === 'true') return;
    
    // Get position for the overlay
    let rect = element.getBoundingClientRect();
    
    // For hidden elements, try to find a nearby visible position
    if (isHidden || rect.width === 0 || rect.height === 0) {
      // Try to get position from parent element
      let parent = element.parentElement;
      let attempts = 0;
      while (parent && attempts < 5) {
        const parentRect = parent.getBoundingClientRect();
        if (parentRect.width > 0 && parentRect.height > 0) {
          rect = parentRect;
          break;
        }
        parent = parent.parentElement;
        attempts++;
      }
      
      // If still no valid position, place it in top-right corner
      if (rect.width === 0 || rect.height === 0) {
        rect = {
          left: window.innerWidth - 30,
          top: 10,
          width: 20,
          height: 20
        };
      }
    }
    
    // Create a visible red box overlay (same style for all pixels)
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
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    
    // Add to body or create container if needed
    if (!document.body) return;
    document.body.appendChild(overlay);
    element.dataset.hasOverlay = 'true';
    
    console.log('Highlighted element at:', rect.left, rect.top, 'Hidden:', isHidden, 'Source:', element.src || element.outerHTML.substring(0, 100));
    
    // Update position on scroll
    const updatePosition = () => {
      let newRect = element.getBoundingClientRect();
      
      // For hidden elements, recalculate position
      if (isHidden || newRect.width === 0 || newRect.height === 0) {
        let parent = element.parentElement;
        let attempts = 0;
        while (parent && attempts < 5) {
          const parentRect = parent.getBoundingClientRect();
          if (parentRect.width > 0 && parentRect.height > 0) {
            newRect = parentRect;
            break;
          }
          parent = parent.parentElement;
          attempts++;
        }
      }
      
      overlay.style.left = newRect.left + 'px';
      overlay.style.top = newRect.top + 'px';
    };
    
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
  }
  
  // Remove all highlights
  function removeHighlights() {
    // Use requestAnimationFrame to ensure DOM operations complete
    requestAnimationFrame(() => {
      // Remove ALL overlay elements
      const overlays = document.querySelectorAll('.tracking-pixel-overlay');
      overlays.forEach(overlay => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      });
      
      // Clear ALL hasOverlay markers from ALL elements on the page
      const allElements = document.querySelectorAll('[data-has-overlay]');
      allElements.forEach(element => {
        delete element.dataset.hasOverlay;
      });
      
      // Also clear from our tracked pixels
      trackingPixels.forEach(pixel => {
        if (pixel.element && pixel.element.dataset) {
          delete pixel.element.dataset.hasOverlay;
        }
      });
    });
  }
  
  // Detect tracking pixels in a given document/context
  function scanDocument(doc, context = 'main') {
    const foundPixels = [];
    
    // Gmail-specific filters to exclude their UI elements
    const gmailExcludePatterns = [
      '/images/cleardot.gif',
      'ui=2&ik=', // attachment preview URLs
      'view=snatt', // attachment preview URLs
    ];
    
    // Check images
    const images = doc.querySelectorAll('img');
    images.forEach(img => {
      const src = img.src || img.getAttribute('src') || '';
      
      // Skip Gmail's own UI pixels
      if (gmailExcludePatterns.some(pattern => src.includes(pattern))) {
        return;
      }
      
      // Skip images with no source
      if (!src || src === '') {
        return;
      }
      
      // Get actual dimensions
      const width = img.width || parseInt(img.getAttribute('width')) || 0;
      const height = img.height || parseInt(img.getAttribute('height')) || 0;
      
      // Get computed style to check for display:none or visibility:hidden
      const style = window.getComputedStyle(img);
      const isHidden = style.display === 'none' || 
                       style.visibility === 'hidden' || 
                       img.style.display === 'none' ||
                       img.style.visibility === 'hidden';
      
      // Check for 1x1 pixels or tracking domains or hidden images
      const isSmallPixel = (width === 1 && height === 1) || 
                          (width === 0 && height === 0) ||
                          (width <= 1 && height <= 1);
      const isTrackingDomain = trackingDomains.some(domain => src.includes(domain));
      
      // Check for common tracking patterns in URLs
      const hasTrackingPattern = src.includes('/track') || 
                                 src.includes('/pixel') || 
                                 src.includes('/beacon') ||
                                 src.includes('.gif') && (width <= 1 || height <= 1 || isHidden);
      
      // Check if it's proxied through Gmail but has a tracking URL in the fragment
      const isGmailProxiedTracking = src.includes('googleusercontent.com') && 
                                     (src.includes('#https://') || src.includes('#http://')) &&
                                     (src.includes('/track') || src.includes('/pixel') || src.includes('/beacon'));
      
      if (isSmallPixel || isTrackingDomain || (isHidden && hasTrackingPattern) || isGmailProxiedTracking) {
        // Extract the original URL if it's Gmail-proxied
        let displayUrl = src;
        if (src.includes('#http')) {
          const match = src.match(/#(https?:\/\/.+)$/);
          if (match) {
            displayUrl = match[1] + ' (via Gmail proxy)';
          }
        }
        
        foundPixels.push({
          type: 'image',
          src: displayUrl,
          element: img,
          dimensions: `${width}x${height}`,
          context: context,
          hidden: isHidden
        });
      }
    });
    
    // Check iframes
    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.src || '';
      const width = iframe.width;
      const height = iframe.height;
      
      const isSmallFrame = (width <= 1 && height <= 1);
      const isTrackingDomain = trackingDomains.some(domain => src.includes(domain));
      
      if (isSmallFrame || isTrackingDomain) {
        foundPixels.push({
          type: 'iframe',
          src: src,
          element: iframe,
          dimensions: `${width}x${height}`,
          context: context
        });
      }
      
      // Try to scan inside the iframe
      try {
        if (iframe.contentDocument) {
          const iframePixels = scanDocument(iframe.contentDocument, 'iframe');
          foundPixels.push(...iframePixels);
        }
      } catch (e) {
        // Cross-origin iframe, can't access
        console.log('Cannot access iframe content (cross-origin):', src);
      }
    });
    
    // Check scripts that might load pixels
    const scripts = doc.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.src || '';
      if (trackingDomains.some(domain => src.includes(domain))) {
        foundPixels.push({
          type: 'script',
          src: src,
          element: script,
          context: context
        });
      }
    });
    
    return foundPixels;
  }
  
  // Detect tracking pixels
  function detectTrackingPixels() {
    if (!scanningEnabled) return;
    
    trackingPixels = []; // Clear previous results
    
    // Scan main document
    const pixels = scanDocument(document, 'main');
    
    // Add all found pixels
    trackingPixels.push(...pixels);
    
    // Highlight only if highlighting is enabled
    if (highlightingEnabled) {
      trackingPixels.forEach(pixel => {
        if (pixel.element && (!pixel.element.dataset.hasOverlay || pixel.element.dataset.hasOverlay !== 'true')) {
          highlightElement(pixel.element, pixel.hidden);
        }
      });
    }
  }
  
  // Detect Beacon API usage - MUST be called immediately
  function detectBeaconAPI() {
    if (!navigator.sendBeacon) {
      console.log('Beacon API not supported');
      return;
    }

    const originalSendBeacon = navigator.sendBeacon.bind(navigator);

    navigator.sendBeacon = function (url, data) {
      const request = {
        type: 'beacon',
        timestamp: new Date().toISOString(),
        url: url,
        domain: new URL(url, window.location.origin).hostname,
        dataSize: data ? new Blob([data]).size : 0,
        dataType: typeof data,
        pageUrl: window.location.href,
        pageDomain: window.location.hostname,
        src: url
      };

      beaconRequests.push(request);
      console.log("🔍 Beacon API Request Detected:", request);

      // Call original method
      return originalSendBeacon(url, data);
    };
    
    console.log('Beacon API detection initialized');
  }
  
  // Intercept fetch requests that might be used for tracking
  function interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = function(...args) {
      const url = args[0];
      const urlString = typeof url === 'string' ? url : url.url;
      
      // Check if it's a tracking domain
      if (trackingDomains.some(domain => urlString.includes(domain))) {
        const request = {
          type: 'fetch',
          timestamp: new Date().toISOString(),
          url: urlString,
          domain: new URL(urlString, window.location.origin).hostname,
          method: args[1]?.method || 'GET',
          pageUrl: window.location.href,
          pageDomain: window.location.hostname,
          src: urlString
        };
        
        beaconRequests.push(request);
        console.log("🔍 Fetch tracking request detected:", request);
      }
      
      return originalFetch.apply(this, args);
    };
  }
  
  // Toggle highlighting
  function toggleHighlighting(enabled) {
    highlightingEnabled = enabled;
    if (!enabled) {
      removeHighlights();
    } else if (scanningEnabled) {
      // Only re-highlight if scanning is active
      trackingPixels.forEach(pixel => {
        if (pixel.element && pixel.element.dataset.hasOverlay !== 'true') {
          highlightElement(pixel.element, pixel.hidden);
        }
      });
    }
  }
  
  // Toggle scanning
  function toggleScanning(enabled) {
    scanningEnabled = enabled;
    if (!enabled) {
      // Stop observing DOM changes FIRST
      if (observer) {
        observer.disconnect();
      }
      
      // Add a small delay to ensure any pending operations complete
      setTimeout(() => {
        // Remove all highlights when scanning is stopped
        removeHighlights();
        // Clear the tracking arrays
        trackingPixels = [];
      }, 100);
    } else {
      // Clear any existing data before starting fresh
      trackingPixels = [];
      removeHighlights();
      
      // Start observing DOM changes
      if (observer && document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      // Run a fresh scan when starting
      detectTrackingPixels();
    }
  }
  
  // Set up message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTrackingPixels') {
      console.log('Sending pixel data:', trackingPixels.length, 'pixels found');
      console.log('Beacon requests found:', beaconRequests.length);
      
      // Get beacon requests from background script
      chrome.runtime.sendMessage({ action: 'getBeaconRequests' }, (bgResponse) => {
        const bgBeaconRequests = bgResponse?.beaconRequests || [];
        const allBeaconRequests = [...beaconRequests, ...bgBeaconRequests];
        const allRequests = [...trackingPixels, ...allBeaconRequests];
        
        console.log('Total beacon/network requests:', allBeaconRequests.length);
        
        sendResponse({
          count: allRequests.length,
          pixels: allRequests.map(p => ({
            type: p.type,
            src: p.src,
            dimensions: p.dimensions,
            url: p.url,
            domain: p.domain,
            dataSize: p.dataSize,
            method: p.method,
            requestType: p.requestType,
            context: p.context,
            hidden: p.hidden
          })),
          highlightingEnabled: highlightingEnabled,
          scanningEnabled: scanningEnabled,
          beaconCount: allBeaconRequests.length,
          pixelCount: trackingPixels.length
        });
      });
      
      return true; // Keep channel open for async response
    } else if (request.action === 'toggleHighlighting') {
      toggleHighlighting(request.enabled);
      sendResponse({ success: true });
    } else if (request.action === 'toggleScanning') {
      toggleScanning(request.enabled);
      sendResponse({ success: true, scanningEnabled: request.enabled });
    } else if (request.action === 'rescan') {
      detectTrackingPixels();
      
      // Get beacon requests from background script
      chrome.runtime.sendMessage({ action: 'getBeaconRequests' }, (bgResponse) => {
        const bgBeaconRequests = bgResponse?.beaconRequests || [];
        const allBeaconRequests = [...beaconRequests, ...bgBeaconRequests];
        const allRequests = [...trackingPixels, ...allBeaconRequests];
        
        sendResponse({
          count: allRequests.length,
          pixels: allRequests.map(p => ({
            type: p.type,
            src: p.src,
            dimensions: p.dimensions,
            url: p.url,
            domain: p.domain,
            dataSize: p.dataSize,
            method: p.method,
            requestType: p.requestType,
            context: p.context,
            hidden: p.hidden
          })),
          highlightingEnabled: highlightingEnabled,
          scanningEnabled: scanningEnabled,
          beaconCount: allBeaconRequests.length,
          pixelCount: trackingPixels.length
        });
      });
      
      return true; // Keep channel open
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
  
  // Initialize Beacon API detection IMMEDIATELY (before any page scripts run)
  detectBeaconAPI();
  
  // Intercept fetch requests
  interceptFetch();
  
  // DON'T run initial detection - wait for user to start scanning
  // Detection will only run when user clicks "Start Scanning"
  
  // Set up observer but don't start it yet
  observer = new MutationObserver(() => {
    if (scanningEnabled) {
      detectTrackingPixels();
    }
  });
  
  // Don't observe until user starts scanning
})();