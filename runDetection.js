const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function runBeaconDetection(targetUrl) {
  let browser;
  try {
    // Validate URL
    new URL(targetUrl);

    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Collect beacon and tracking requests
    const beaconRequests = [];
    const trackingPixels = [];
    
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

    // Intercept ALL network requests
    await page.setRequestInterception(true);
    
    page.on("request", (request) => {
      const url = request.url();
      const method = request.method();
      const postData = request.postData();
      const resourceType = request.resourceType();
      
      // Check if it's a tracking domain
      const isTracking = trackingDomains.some(domain => url.includes(domain));
      
      if (isTracking || postData) {
        beaconRequests.push({
          url: url,
          method: method,
          resourceType: resourceType,
          dataSize: postData ? postData.length : 0,
          timestamp: new Date().toISOString(),
          isTrackingDomain: isTracking
        });
      }
      
      // Continue the request
      request.continue();
    });
    
    // Track responses for tracking pixels
    page.on('response', async (response) => {
      const url = response.url();
      const request = response.request();
      const resourceType = request.resourceType();
      
      // Detect 1x1 pixel images
      if (resourceType === 'image') {
        try {
          const buffer = await response.buffer();
          // Small images are likely tracking pixels
          if (buffer.length < 1000) {
            trackingPixels.push({
              url: url,
              size: buffer.length,
              type: 'image',
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          // Some images can't be buffered, skip them
        }
      }
    });

    console.log(`🔍 Scanning: ${targetUrl}`);
    
    // Inject detection script BEFORE page loads
    const detectionScript = fs.readFileSync(
      path.join(__dirname, "detectBeacon.js"),
      "utf8"
    );
    await page.evaluateOnNewDocument(detectionScript);
    
    // Navigate to the page
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for page to settle
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get beacon requests from page context (JavaScript interception)
    const pageBeaconRequests = await page.evaluate(() => {
      return window.getBeaconRequests ? window.getBeaconRequests() : [];
    });
    
    // Detect tracking pixels in DOM
    const domPixels = await page.evaluate(() => {
      const pixels = [];
      
      // Check images
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if ((img.width === 1 && img.height === 1) || 
            (img.width === 0 && img.height === 0)) {
          pixels.push({
            type: 'dom-image',
            src: img.src,
            dimensions: `${img.width}x${img.height}`
          });
        }
      });
      
      // Check iframes
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.width <= 1 && iframe.height <= 1) {
          pixels.push({
            type: 'dom-iframe',
            src: iframe.src,
            dimensions: `${iframe.width}x${iframe.height}`
          });
        }
      });
      
      return pixels;
    });

    // Combine all results
    const allBeaconRequests = [...beaconRequests, ...pageBeaconRequests];
    const allPixels = [...trackingPixels, ...domPixels];
    const allRequests = [...allBeaconRequests, ...allPixels];

    // Generate report
    const report = {
      targetUrl: targetUrl,
      targetDomain: new URL(targetUrl).hostname,
      scanTimestamp: new Date().toISOString(),
      summary: {
        totalTracking: allRequests.length,
        beaconRequests: allBeaconRequests.length,
        trackingPixels: allPixels.length,
        networkRequests: beaconRequests.length,
        jsIntercepted: pageBeaconRequests.length,
        domPixels: domPixels.length
      },
      beaconRequests: allBeaconRequests,
      trackingPixels: allPixels,
      summaryText:
        allRequests.length > 0
          ? `⚠️  Found ${allRequests.length} tracking elements (${allBeaconRequests.length} beacon/network requests, ${allPixels.length} pixels)`
          : "✅ No tracking detected",
    };

    console.log("\n" + "=".repeat(60));
    console.log("📋 TRACKING DETECTION REPORT");
    console.log("=".repeat(60));
    console.log(`Domain: ${report.targetDomain}`);
    console.log(`URL: ${report.targetUrl}`);
    console.log(`Scan Time: ${report.scanTimestamp}`);
    console.log(`Status: ${report.summaryText}`);
    console.log("\n📊 Summary:");
    console.log(`  Total Tracking Elements: ${report.summary.totalTracking}`);
    console.log(`  Beacon/Network Requests: ${report.summary.beaconRequests}`);
    console.log(`  Tracking Pixels: ${report.summary.trackingPixels}`);

    if (allBeaconRequests.length > 0) {
      console.log("\n🔍 Beacon/Network Requests:");
      console.table(allBeaconRequests.slice(0, 20)); // Show first 20
      if (allBeaconRequests.length > 20) {
        console.log(`... and ${allBeaconRequests.length - 20} more`);
      }
    }
    
    if (allPixels.length > 0) {
      console.log("\n🎯 Tracking Pixels:");
      console.table(allPixels.slice(0, 20)); // Show first 20
      if (allPixels.length > 20) {
        console.log(`... and ${allPixels.length - 20} more`);
      }
    }

    console.log("=".repeat(60) + "\n");

    // Save report to file
    const reportPath = path.join(__dirname, `tracking-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Report saved to: ${reportPath}`);

    return report;
  } catch (error) {
    console.error("❌ Error during detection:", error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

// Get URL from command line argument
const url = process.argv[2];
if (!url) {
  console.error("Usage: node runDetection.js <URL>");
  console.error("Example: node runDetection.js https://example.com");
  process.exit(1);
}

runBeaconDetection(url);