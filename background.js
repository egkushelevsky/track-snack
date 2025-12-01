// Background service worker to detect beacon requests via webRequest API
const trackingDomains = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.com',
  'connect.facebook.net',
  'pixel.wp.com',
  'analytics.twitter.com',
  'bat.bing.com',
  'linkedin.com',
  'snapchat.com',
  'tiktok.com',
  'reddit.com',
  'analytics.yahoo.com'
];

// Store beacon requests per tab
const beaconRequestsByTab = new Map();

// Listen for network requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    const tabId = details.tabId;
    
    // Check if it's a tracking domain
    const isTracking = trackingDomains.some(domain => url.includes(domain));
    
    if (isTracking && tabId >= 0) {
      const request = {
        type: 'network-request',
        timestamp: new Date().toISOString(),
        url: url,
        domain: new URL(url).hostname,
        method: details.method,
        requestType: details.type,
        initiator: details.initiator
      };
      
      // Store by tab
      if (!beaconRequestsByTab.has(tabId)) {
        beaconRequestsByTab.set(tabId, []);
      }
      beaconRequestsByTab.get(tabId).push(request);
      
      console.log('🔍 Network tracking request detected:', request);
    }
  },
  { urls: ["<all_urls>"] },
  []
);

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  beaconRequestsByTab.delete(tabId);
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBeaconRequests') {
    const tabId = sender.tab?.id || request.tabId;
    const requests = beaconRequestsByTab.get(tabId) || [];
    sendResponse({ beaconRequests: requests });
  } else if (request.action === 'clearBeaconRequests') {
    const tabId = sender.tab?.id || request.tabId;
    beaconRequestsByTab.delete(tabId);
    sendResponse({ success: true });
  }
  return true;
});