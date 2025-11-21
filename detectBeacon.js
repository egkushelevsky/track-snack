/**
 * Detects Beacon API usage on a webpage
 * Hooks into navigator.sendBeacon to capture tracking requests
 */

function detectBeaconAPI() {
  const beaconRequests = [];

  // Store original sendBeacon method
  const originalSendBeacon = navigator.sendBeacon;

  // Override sendBeacon to intercept calls
  navigator.sendBeacon = function(url, data) {
    const request = {
      timestamp: new Date().toISOString(),
      url: url,
      domain: new URL(url, window.location.origin).hostname,
      dataSize: data ? new Blob([data]).size : 0,
      dataType: typeof data,
      pageUrl: window.location.href,
      pageDomain: window.location.hostname
    };

    beaconRequests.push(request);
    console.log('🔍 Beacon API Request Detected:', request);

    // Call original method
    return originalSendBeacon.call(navigator, url, data);
  };

  // Listen for page unload events (common beacon usage)
  window.addEventListener('beforeunload', () => {
    if (beaconRequests.length > 0) {
      console.log('📊 Total Beacon Requests:', beaconRequests.length);
      console.table(beaconRequests);
    }
  });

  // Return function to get current requests
  window.getBeaconRequests = () => beaconRequests;

  return beaconRequests;
}

// Initialize detection
detectBeaconAPI();
