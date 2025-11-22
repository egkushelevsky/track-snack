// Popup script to display tracking pixel results
async function loadResults() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } catch (e) {
    // Content script might already be injected, continue
  }
  
  // Wait a bit for the script to initialize
  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, { action: 'getTrackingPixels' }, (response) => {
      if (chrome.runtime.lastError) {
        document.getElementById('status').textContent = 'Error: Please refresh the page and try again';
        document.getElementById('status').className = '';
        return;
      }
      
      if (!response) {
        document.getElementById('status').textContent = 'No data available. Try refreshing.';
        document.getElementById('status').className = '';
        return;
      }
      
      const count = response.count;
      const pixels = response.pixels;
      
      // Update toggle state
      if (response.highlightingEnabled !== undefined) {
        document.getElementById('highlightToggle').checked = response.highlightingEnabled;
      }
      
      // Update count
      const countEl = document.getElementById('count');
      const statusEl = document.getElementById('status');
      
      if (count === 0) {
        statusEl.textContent = 'No tracking pixels detected! ✓';
        statusEl.className = 'no-pixels';
        countEl.textContent = '';
      } else {
        statusEl.textContent = 'Tracking pixels found:';
        statusEl.className = '';
        countEl.textContent = count;
        
        // Log to console for debugging
        console.log('Detected tracking pixels:', pixels);
      }
      
      // Display pixel list
      const listEl = document.getElementById('pixelList');
      listEl.innerHTML = '';
      
      pixels.forEach(pixel => {
        const item = document.createElement('div');
        item.className = 'pixel-item';
        
        const type = document.createElement('div');
        type.className = 'pixel-type';
        type.textContent = pixel.type;
        
        const src = document.createElement('div');
        src.className = 'pixel-src';
        src.textContent = pixel.src || 'No source';
        
        item.appendChild(type);
        item.appendChild(src);
        
        if (pixel.dimensions) {
          const dims = document.createElement('div');
          dims.className = 'pixel-dimensions';
          dims.textContent = `Dimensions: ${pixel.dimensions}`;
          item.appendChild(dims);
        }
        
        listEl.appendChild(item);
      });
    });
  }, 300);
}

// Highlight toggle
document.getElementById('highlightToggle').addEventListener('change', async (e) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const label = document.querySelector('label[for="highlightToggle"]');
  
  chrome.tabs.sendMessage(tab.id, { 
    action: 'toggleHighlighting', 
    enabled: e.target.checked 
  }, (response) => {
    if (e.target.checked) {
      label.textContent = '🔴 Highlight pixels on page (ON)';
    } else {
      label.textContent = '⚫ Highlight pixels on page (OFF)';
    }
  });
});

// Refresh button
document.getElementById('refresh').addEventListener('click', async () => {
  document.getElementById('status').textContent = 'Scanning...';
  document.getElementById('status').className = '';
  document.getElementById('count').textContent = '';
  document.getElementById('pixelList').innerHTML = '';
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'rescan' }, (response) => {
    if (chrome.runtime.lastError) {
      // If content script isn't loaded, reload the page
      chrome.tabs.reload(tab.id, {}, () => {
        setTimeout(loadResults, 1000);
      });
    } else {
      loadResults();
    }
  });
});

// Load results when popup opens
loadResults();