const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Install these packages: npm install geoip-lite useragent
const geoip = require('geoip-lite');
const useragent = require('useragent');

// Store all tracking data
const trackingData = {};

// Helper function to initialize tracking data structure
function initTracking(id) {
  if (!trackingData[id]) {
    trackingData[id] = {
      opens: [],
      clicks: [],
      created: new Date().toISOString()
    };
  }
}

// Helper function to collect detailed data
function collectData(req) {
  const agent = useragent.parse(req.get('user-agent'));
  const ip = req.ip || req.connection.remoteAddress;
  const geo = geoip.lookup(ip);
  
  return {
    timestamp: new Date().toISOString(),
    openedAt: new Date().toLocaleString(),
    browser: agent.toAgent(),
    os: agent.os.toString(),
    device: agent.device.toString(),
    ip: ip,
    country: geo?.country || 'Unknown',
    region: geo?.region || 'Unknown',
    city: geo?.city || 'Unknown',
    timezone: geo?.timezone || 'Unknown',
    coordinates: geo ? `${geo.ll[0]}, ${geo.ll[1]}` : 'Unknown',
    emailClient: detectEmailClient(req.get('user-agent')),
    referer: req.get('referer') || 'Direct',
    language: req.get('accept-language')
  };
}

// Detect email client
function detectEmailClient(userAgent) {
  if (!userAgent) return 'Unknown';
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('outlook')) return 'Outlook';
  if (ua.includes('thunderbird')) return 'Thunderbird';
  if (ua.includes('apple mail') || ua.includes('applemail')) return 'Apple Mail';
  if (ua.includes('gmail')) return 'Gmail';
  if (ua.includes('yahoo')) return 'Yahoo Mail';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS Mail App';
  if (ua.includes('android')) return 'Android Mail App';
  
  return 'Web Browser';
}

// Count occurrences helper
function countBy(array, key) {
  return array.reduce((acc, item) => {
    const value = item[key] || 'Unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

// ==================== TRACKING PIXEL ENDPOINT ====================
app.get('/track/:id.gif', (req, res) => {
  const trackingId = req.params.id;
  initTracking(trackingId);
  
  const data = collectData(req);
  trackingData[trackingId].opens.push(data);
  
  console.log(`\n📧 Email ${trackingId} opened:`);
  console.log(`   Time: ${data.openedAt}`);
  console.log(`   Location: ${data.city}, ${data.region}, ${data.country}`);
  console.log(`   Device: ${data.device} - ${data.os}`);
  console.log(`   Email Client: ${data.emailClient}`);
  
  // Send 1x1 transparent GIF
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
  
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(pixel);
});

// ==================== LINK CLICK TRACKING ====================
app.get('/link/:emailId/:linkId', (req, res) => {
  const { emailId, linkId } = req.params;
  const destinationUrl = req.query.url;
  
  if (!destinationUrl) {
    return res.status(400).send('Missing destination URL');
  }
  
  initTracking(emailId);
  
  const clickData = {
    ...collectData(req),
    linkId: linkId,
    destinationUrl: destinationUrl
  };
  
  trackingData[emailId].clicks.push(clickData);
  
  console.log(`\n🖱️  Link clicked in email ${emailId}:`);
  console.log(`   Link ID: ${linkId}`);
  console.log(`   Destination: ${destinationUrl}`);
  console.log(`   Location: ${clickData.city}, ${clickData.country}`);
  console.log(`   Device: ${clickData.device}`);
  
  // Redirect to actual destination
  res.redirect(destinationUrl);
});

// ==================== STATS API ENDPOINT ====================
app.get('/stats/:id', (req, res) => {
  const data = trackingData[req.params.id];
  
  if (!data || (data.opens.length === 0 && data.clicks.length === 0)) {
    return res.json({
      trackingId: req.params.id,
      message: 'No activity yet'
    });
  }
  
  const analytics = {
    trackingId: req.params.id,
    
    // Open stats
    totalOpens: data.opens.length,
    uniqueOpens: new Set(data.opens.map(s => s.ip)).size,
    firstOpened: data.opens.length > 0 ? data.opens[0].openedAt : null,
    lastOpened: data.opens.length > 0 ? data.opens[data.opens.length - 1].openedAt : null,
    
    // Click stats
    totalClicks: data.clicks.length,
    uniqueClickers: new Set(data.clicks.map(c => c.ip)).size,
    clickThroughRate: data.opens.length > 0 
      ? ((new Set(data.clicks.map(c => c.ip)).size / new Set(data.opens.map(s => s.ip)).size) * 100).toFixed(1) + '%'
      : '0%',
    
    // Link breakdown
    linkClicks: countBy(data.clicks, 'linkId'),
    
    // Device breakdown
    devices: countBy([...data.opens, ...data.clicks], 'device'),
    browsers: countBy([...data.opens, ...data.clicks], 'browser'),
    emailClients: countBy(data.opens, 'emailClient'),
    
    // Location breakdown
    countries: countBy([...data.opens, ...data.clicks], 'country'),
    cities: countBy([...data.opens, ...data.clicks], 'city'),
    
    // Detailed data
    allOpens: data.opens,
    allClicks: data.clicks
  };
  
  res.json(analytics);
});

// ==================== VISUAL DASHBOARD ====================
app.get('/dashboard/:id', (req, res) => {
  const data = trackingData[req.params.id];
  const trackingId = req.params.id;
  
  const opens = data?.opens || [];
  const clicks = data?.clicks || [];
  
  const uniqueOpens = new Set(opens.map(s => s.ip)).size;
  const uniqueClickers = new Set(clicks.map(c => c.ip)).size;
  const clickRate = uniqueOpens > 0 
    ? ((uniqueClickers / uniqueOpens) * 100).toFixed(1)
    : 0;
  
  // Count clicks per link
  const linkStats = {};
  clicks.forEach(click => {
    if (!linkStats[click.linkId]) {
      linkStats[click.linkId] = {
        count: 0,
        url: click.destinationUrl
      };
    }
    linkStats[click.linkId].count++;
  });
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Email Tracking Dashboard - ${trackingId}</title>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          .header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          h1 { 
            color: #333;
            margin-bottom: 5px;
            font-size: 28px;
          }
          .subtitle {
            color: #666;
            font-size: 14px;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .stat-label {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
          }
          .stat-subtext {
            color: #999;
            font-size: 12px;
            margin-top: 5px;
          }
          .card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 20px;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #f0f0f0;
          }
          th {
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            color: #666;
          }
          tr:hover {
            background: #f8f9fa;
          }
          .no-data {
            text-align: center;
            padding: 40px;
            color: #999;
          }
          .emoji {
            font-size: 24px;
            margin-bottom: 10px;
          }
          .link-badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-right: 8px;
          }
          .url {
            color: #667eea;
            text-decoration: none;
            font-size: 13px;
          }
          .url:hover {
            text-decoration: underline;
          }
          .footer {
            text-align: center;
            color: white;
            margin-top: 20px;
            font-size: 13px;
            opacity: 0.9;
          }
          .refresh-note {
            background: rgba(255,255,255,0.1);
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Email Tracking Dashboard</h1>
            <div class="subtitle">Tracking ID: <strong>${trackingId}</strong></div>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Opens</div>
              <div class="stat-value">${opens.length}</div>
              <div class="stat-subtext">${uniqueOpens} unique</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-label">Total Clicks</div>
              <div class="stat-value">${clicks.length}</div>
              <div class="stat-subtext">${uniqueClickers} unique clickers</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-label">Click Rate</div>
              <div class="stat-value">${clickRate}%</div>
              <div class="stat-subtext">of openers clicked</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-label">First Opened</div>
              <div class="stat-value" style="font-size: 16px;">
                ${opens.length > 0 ? opens[0].openedAt : 'Not yet'}
              </div>
            </div>
          </div>
          
          ${Object.keys(linkStats).length > 0 ? `
          <div class="card">
            <h2>🔗 Link Performance</h2>
            <table>
              <tr>
                <th>Link</th>
                <th>Destination</th>
                <th>Clicks</th>
              </tr>
              ${Object.entries(linkStats).map(([linkId, stats]) => `
                <tr>
                  <td><span class="link-badge">${linkId}</span></td>
                  <td><a href="${stats.url}" class="url" target="_blank">${stats.url}</a></td>
                  <td><strong>${stats.count}</strong></td>
                </tr>
              `).join('')}
            </table>
          </div>
          ` : ''}
          
          ${clicks.length > 0 ? `
          <div class="card">
            <h2>🖱️ Recent Clicks</h2>
            <table>
              <tr>
                <th>Time</th>
                <th>Link</th>
                <th>Location</th>
                <th>Device</th>
              </tr>
              ${clicks.slice(-10).reverse().map(c => `
                <tr>
                  <td>${c.openedAt}</td>
                  <td><span class="link-badge">${c.linkId}</span></td>
                  <td>${c.city}, ${c.country}</td>
                  <td>${c.device} - ${c.os}</td>
                </tr>
              `).join('')}
            </table>
          </div>
          ` : ''}
          
          ${opens.length > 0 ? `
          <div class="card">
            <h2>📧 Recent Opens</h2>
            <table>
              <tr>
                <th>Time</th>
                <th>Location</th>
                <th>Device</th>
                <th>Email Client</th>
              </tr>
              ${opens.slice(-10).reverse().map(s => `
                <tr>
                  <td>${s.openedAt}</td>
                  <td>${s.city}, ${s.country}</td>
                  <td>${s.device} - ${s.os}</td>
                  <td>${s.emailClient}</td>
                </tr>
              `).join('')}
            </table>
          </div>
          ` : ''}
          
          ${opens.length === 0 && clicks.length === 0 ? `
          <div class="card">
            <div class="no-data">
              <div class="emoji">📭</div>
              <p>No activity yet. Send an email with the tracking pixel and links!</p>
            </div>
          </div>
          ` : ''}
          
          <div class="footer">
            <div class="refresh-note">
              🔄 Auto-refreshing every 10 seconds
            </div>
          </div>
        </div>
        
        <script>
          setTimeout(() => location.reload(), 10000);
        </script>
      </body>
    </html>
  `;
  
  res.send(html);
});

// ==================== HOME PAGE ====================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Email Tracking Server</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .card {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          h1 { color: #333; }
          code {
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
          }
          pre {
            background: #2d2d2d;
            color: #f8f8f8;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>📧 Email Tracking Server</h1>
          <p>Your tracking server is running!</p>
          
          <h2>How to use:</h2>
          
          <h3>1. Tracking Pixel (for opens)</h3>
          <p>Add this to your email HTML:</p>
          <pre>&lt;img src="http://localhost:3000/track/YOUR-ID.gif" width="1" height="1" style="display:none" /&gt;</pre>
          
          <h3>2. Tracked Links (for clicks)</h3>
          <p>Replace regular links with tracked links:</p>
          <pre>&lt;a href="http://localhost:3000/link/YOUR-ID/link1?url=https://google.com"&gt;
  Click here
&lt;/a&gt;</pre>
          
          <h3>3. View Dashboard</h3>
          <p>Go to: <code>http://localhost:3000/dashboard/YOUR-ID</code></p>
          
          <h3>4. Get JSON Stats</h3>
          <p>API endpoint: <code>http://localhost:3000/stats/YOUR-ID</code></p>
        </div>
      </body>
    </html>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`\n🚀 Enhanced Email Tracking Server Started!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Server: http://localhost:${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}/dashboard/YOUR-ID`);
  console.log(`📈 API Stats: http://localhost:${port}/stats/YOUR-ID`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});