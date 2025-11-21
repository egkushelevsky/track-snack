const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function runBeaconDetection(targetUrl) {
  let browser;
  try {
    // Validate URL
    new URL(targetUrl);

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Collect beacon requests
    const beaconRequests = [];

    // Intercept requests to catch beacon calls
    await page.on('request', (request) => {
      if (request.method() === 'POST' || request.method() === 'GET') {
        const postData = request.postData();
        if (postData) {
          beaconRequests.push({
            url: request.url(),
            method: request.method(),
            dataSize: postData.length,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    console.log(`🔍 Scanning: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Inject detection script
    const detectionScript = fs.readFileSync(
      path.join(__dirname, 'detectBeacon.js'),
      'utf8'
    );
    await page.evaluateOnNewDocument(detectionScript);

    // Wait for page to settle using a promise-based timeout
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get beacon requests from page context
    const pageBeaconRequests = await page.evaluate(() => {
      return window.getBeaconRequests ? window.getBeaconRequests() : [];
    });

    // Combine results
    const allRequests = [...beaconRequests, ...pageBeaconRequests];

    // Generate report
    const report = {
      targetUrl: targetUrl,
      targetDomain: new URL(targetUrl).hostname,
      scanTimestamp: new Date().toISOString(),
      beaconDetected: allRequests.length > 0,
      totalRequests: allRequests.length,
      requests: allRequests,
      summary: allRequests.length > 0
        ? `⚠️  Found ${allRequests.length} potential beacon tracking request(s)`
        : '✅ No Beacon API tracking detected'
    };

    console.log('\n' + '='.repeat(60));
    console.log('📋 BEACON DETECTION REPORT');
    console.log('='.repeat(60));
    console.log(`Domain: ${report.targetDomain}`);
    console.log(`URL: ${report.targetUrl}`);
    console.log(`Scan Time: ${report.scanTimestamp}`);
    console.log(`Status: ${report.summary}`);

    if (report.requests.length > 0) {
      console.log('\n📊 Detected Requests:');
      console.table(report.requests);
    }

    console.log('='.repeat(60) + '\n');

    // Save report to file
    const reportPath = path.join(__dirname, `beacon-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Report saved to: ${reportPath}`);

    return report;
  } catch (error) {
    console.error('❌ Error during detection:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Get URL from command line argument
const url = process.argv[2];
if (!url) {
  console.error('Usage: node runDetection.js <URL>');
  console.error('Example: node runDetection.js https://example.com');
  process.exit(1);
}

runBeaconDetection(url);
