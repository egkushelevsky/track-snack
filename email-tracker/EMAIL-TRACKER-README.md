# Email Tracking Server

A Node.js server that tracks email opens and link clicks using tracking pixels and redirect URLs. Provides real-time analytics dashboard with detailed engagement metrics.

## Features

- Track email opens with invisible 1x1 pixel
- Track link clicks with transparent redirects
- Real-time analytics dashboard
- Geographic location tracking
- Device and browser detection
- Auto-refreshing dashboard
- JSON API for data access

## Demo

Live server: https://email-tracking-pixel.onrender.com

Example dashboard: https://email-tracking-pixel.onrender.com/dashboard/demo-123

## How It Works

### Tracking Email Opens

Embeds a 1x1 transparent pixel in emails. When the recipient opens the email, their client loads the image from the server, logging the open event with device, location, and timing data.

### Tracking Link Clicks

Routes links through the tracking server before redirecting to the actual destination. Logs click data while maintaining a seamless user experience.

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Local Setup

1. Clone the repository:

```bash
git clone https://github.com/YOUR-USERNAME/email-tracker.git
cd email-tracker
```

1. Install dependencies:

```bash
npm install
```

1. Start the server:

```bash
node enhanced-server.js
```

1. Server will run on `http://localhost:3000`

## Usage

### 1. Add Tracking Pixel to Email

Add this HTML at the bottom of your email:

```html
<img src="https://your-server.com/track/unique-id.gif" width="1" height="1" alt="" style="display:none" />
```

Replace:

- `your-server.com` with your deployed server URL
- `unique-id` with a unique identifier for this email/recipient

### 2. Add Tracked Links

Replace regular links with tracked versions:

**Regular link:**

```html
<a href="https://example.com">Click here</a>
```

**Tracked link:**

```html
<a href="https://your-server.com/link/unique-id/button-name?url=https://example.com">Click here</a>
```

Replace:

- `your-server.com` with your server URL
- `unique-id` with the same ID from your tracking pixel
- `button-name` with a descriptive name (e.g., "homepage", "pricing", "signup")
- `url=https://example.com` with the actual destination URL

### 3. View Analytics

**Dashboard:**

```
https://your-server.com/dashboard/unique-id
```

**JSON API:**

```
https://your-server.com/stats/unique-id
```

## API Endpoints

### Track Email Open

```
GET /track/:id.gif
```

Serves a 1x1 transparent GIF and logs the open event.

### Track Link Click

```
GET /link/:emailId/:linkId?url=DESTINATION_URL
```

Logs the click and redirects to the destination URL.

### View Dashboard

```
GET /dashboard/:id
```

Returns an HTML dashboard with real-time analytics.

### Get Stats (JSON)

```
GET /stats/:id
```

Returns analytics data in JSON format.

## Data Collected

For each email open and link click:

- Timestamp
- IP address
- Geographic location (country, city, region, timezone)
- Device type (desktop, mobile, tablet)
- Operating system
- Browser/email client
- Link clicked (for click events)

## Deployment

### Deploy to Render (Recommended)

1. Push your code to GitHub
2. Go to https://render.com and create an account
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name:** your-app-name
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. Click "Create Web Service"
7. Your app will be deployed at `https://your-app-name.onrender.com`

### Other Deployment Options

- **Railway:** https://railway.app
- **Heroku:** https://heroku.com
- **DigitalOcean:** https://digitalocean.com

## Configuration

### Port Configuration

The server uses port 3000 by default for local development. For deployment, it automatically uses the `PORT` environment variable if available:

```javascript
const port = process.env.PORT || 3000;
```

### package.json

Make sure your `package.json` includes:

```json
{
  "name": "email-tracker",
  "version": "1.0.0",
  "main": "enhanced-server.js",
  "scripts": {
    "start": "node enhanced-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "geoip-lite": "^1.4.7",
    "useragent": "^2.3.0"
  }
}
```

## Example Email Template

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  <h1>Welcome!</h1>
  
  <p>Check out our website:</p>
  <a href="https://your-server.com/link/user-123/homepage?url=https://example.com">
    Visit Homepage
  </a>
  
  <!-- Tracking pixel (invisible) -->
  <img src="https://your-server.com/track/user-123.gif" width="1" height="1" style="display:none" />
</body>
</html>
```

## Dashboard Metrics

The dashboard displays:

- **Total Opens** - Number of times email was opened
- **Unique Opens** - Number of distinct recipients who opened
- **Total Clicks** - Number of link clicks
- **Unique Clickers** - Number of distinct recipients who clicked
- **Click-Through Rate** - Percentage of openers who clicked
- **Link Performance** - Clicks per link
- **Recent Activity** - Latest opens and clicks with details

## Limitations

- **Data Persistence:** Data is stored in memory and resets on server restart. Would need a database (MongoDB, PostgreSQL) for production use.

## Privacy Considerations

- Always disclose tracking in your privacy policy
- Comply with email marketing regulations (CAN-SPAM, GDPR, CCPA)
- Include unsubscribe links in emails
- Consider implementing opt-out mechanisms
- Don't track sensitive or personal communications

## Development

### Structure

```
email-tracker/
├── enhanced-server.js       # Main server application
├── package.json            # Dependencies and scripts
├── .gitignore             # Git ignore file
└── README.md              # This file
```

