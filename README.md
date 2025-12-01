# Track Snack
## The Chrome extension that eats tracking pixels for breakfast

![Track Snack](icon48.png)

### Track Snack is a Chrome extension that detects tracking pixels on sites. This is done through two methods: monitoring calls to the Beacon API and looking for 1x1 pixels in noscript HTML tags. Additionally, Track Snack identifies email-based tracking pixels.

#### There are 2 main ways websites collect your data. 
First, websites integrate the Beacon API, which sends small amounts of data such as user activity and performance metrics from a client (like a browser) to a server through non-blocking requests. This makes it the perfect vehicle for sites to embed tracking information used to monitor users’ interactions and request them better content, as unlike traditional Fetch requests, Beacon requests will be initiated and completed even if the user navigates away from the page or closes the browser. Beacon API calls can be found in the browser’s developer tools, under the Network tab. By monitoring this tab and checking for the Initiator of the request to be “Beacon”, Beacon API calls can be spotted. Track Snack scrapes these calls, gets their domain, and tells the user whether the Beacon API is being used on the current website.

To complement the Beacon API method and in case any JavaScript-based tracking does not work, Track Snack also tracks noscript pixels. Most websites put their tracking pixels in a noscript element, which is where you write alternate content to be displayed to users that have disabled scripts in their browser or have a browser that doesn't support script. If a user has changed their browser settings to disable/block Javscript for privacy settings, or has an Adblocker that blocks Javascript tracking scripts, putting the tracking pixel in a tag ensures that the user will still be tracked. Track Snack looks for HTML pixels that fit combinations of the following criteria: 1x1 or 2x2 in size, are hidden or invisible, are in CSS background images, are in tags, or are iframes. Track Snack will point out on the screen exactly where the noscript pixels are.

#### Another popular method of tracking users online is through email. 
Specifically, email tracking pixels, which function as embedded image elements within HTML-formatted emails. They are typically implemented as 1x1 pixel transparent images hosted on the sender’s server. Each pixel contains a unique identifier in its URL that corresponds to the specific recipient and email instance. When the recipient’s email client renders the message and requests the image resource, the server logs the HTTP request, thereby confirming email open events along with associated metadata such as timestamp, IP address, and user agent information. Emails with tracking also often use link tracking, which operates similarly through the use of parametrized tracking URLS that route through the intermediary server to record click events before redirecting to the intended destination.

#### These pixel tracking methods are wrapped in a Chrome extension that displays a banner of Beacon API calls, highlights noscript tracking pixels on the screen, and in emails with red boxes.

#### How to use our Chrome Extension:
- Clone this repo into a repository somewhere on your local device
- Open Chrome Extensions page
- Go to chrome://extensions/ in your browser OR click the three dots menu → Extensions → Manage Extensions
- Toggle the "Developer mode" switch
- Load your extension
- Click "Load unpacked" button
- Navigate to the folder where you cloned your GitHub repo
- Select the folder containing the manifest.json file
- Click "Select Folder"
- Track Snack should now appear! Make sure it's toggled "on". You might need to pin it to your toolbar.
- Navigate to any website or email to check it out! https://www.amazon.com/ is great for seeing 1x1 invisible pixels, and https://www.yankeecandle.com/ is great for seeing Beacon requests!

