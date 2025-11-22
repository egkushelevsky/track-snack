## What it does:
 - Scrape the page HTMl elements
 - Look for: 
    - 1x1 or 2x2 elements in the main elements
    - Hidden or invisible elements
    - Small or invisible <img> elements
    - Tracking pixels in CSS background images
    - Tracking pixels in <noscript> tags
    - Tracking iframes
 - Do a quick check of likelihood that it is a tracking pixel based on whether a 1x1 was detected and has a url that matches a list of known advertisers
    - this fails on large websites like amazon or meta because they have their own tracking pixels instead of using other advertiser's but it works great on smaller websites like Calyan Wax Co. that might use already-built pixels like Meta Pixel
- Put a big red circle around where the pixel is (usually the upper left corner)

## How to run this in isolation (not with rest of extension)
1. Go to a website (e.g. amazon.com)
2. Open DevTools
3. Go to Console
4. Copy paste code from 1x1pixel.js and wait for results

## Finding Analysis
Most websites put their tracking pixels in a <noscript> element, which is where you write alternate content to be displayed to users that have disabled scripts in their browser or have a browser that doesn't support script. So if a user has changed their browser settings to disable/block Javscript for privacy settings (as we saw in HW3 this decreases your browser footprint quite a bit) or has an Adblocker that blocks Javascript tracking scripts, putting the tracking pixel in a <noscript> tag ensures that the user will still be tracked.

This complements the Beacon API detector because that is dynamic Javascript tracking while Noscript pixels are static fallback pixels in case the Javascript tracking didn't work!