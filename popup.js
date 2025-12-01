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
        document.getElementById('status').textContent = 'Click "Start Scanning" to begin';
        document.getElementById('status').className = '';
        // Set initial button state to "start"
        updateScanButton(false);
        return;
      }
      
      const count = response.count;
      const pixels = response.pixels;
      const pixelCount = response.pixelCount || 0;
      const beaconCount = response.beaconCount || 0;
      
      // Update banner stats
      document.getElementById('pixelCountBanner').textContent = pixelCount;
      document.getElementById('beaconCountBanner').textContent = beaconCount;
      document.getElementById('totalCountBanner').textContent = count;
      
      // Update toggle state
      if (response.highlightingEnabled !== undefined) {
        document.getElementById('highlightToggle').checked = response.highlightingEnabled;
      }
      
      // Update scan button state - use actual state from response
      const scanningEnabled = response.scanningEnabled === true; // Only true if explicitly true
      updateScanButton(scanningEnabled);
      
      // Update count
      const countEl = document.getElementById('count');
      const statusEl = document.getElementById('status');
      
      if (!scanningEnabled) {
        statusEl.textContent = 'Click "Start Scanning" to begin';
        statusEl.className = '';
        countEl.textContent = '';
      } else if (count === 0) {
        statusEl.textContent = 'No tracking pixels detected! ✔';
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
        src.textContent = pixel.src || pixel.url || 'No source';
        
        item.appendChild(type);
        item.appendChild(src);
        
        if (pixel.dimensions) {
          const dims = document.createElement('div');
          dims.className = 'pixel-dimensions';
          dims.textContent = `Dimensions: ${pixel.dimensions}`;
          item.appendChild(dims);
        }
        
        if (pixel.hidden) {
          const hidden = document.createElement('div');
          hidden.className = 'pixel-dimensions';
          hidden.textContent = '🔒 Hidden (display:none or visibility:hidden)';
          hidden.style.color = '#ff6b6b';
          hidden.style.fontWeight = 'bold';
          item.appendChild(hidden);
        }
        
        if (pixel.context && pixel.context !== 'main') {
          const ctx = document.createElement('div');
          ctx.className = 'pixel-dimensions';
          ctx.textContent = `📍 Found in: ${pixel.context}`;
          item.appendChild(ctx);
        }
        
        if (pixel.dataSize !== undefined) {
          const size = document.createElement('div');
          size.className = 'pixel-dimensions';
          size.textContent = `Data Size: ${pixel.dataSize} bytes`;
          item.appendChild(size);
        }
        
        listEl.appendChild(item);
      });
    });
  }, 300);
}

// Update scan button appearance
function updateScanButton(isScanning) {
  const button = document.getElementById('toggleScan');
  const toggleContainer = document.querySelector('.toggle-container');
  const highlightToggle = document.getElementById('highlightToggle');
  
  if (isScanning) {
    button.textContent = '⏸️ Stop Scanning';
    button.className = 'stop-scan';
    toggleContainer.classList.remove('disabled');
    highlightToggle.disabled = false;
  } else {
    button.textContent = '▶️ Start Scanning';
    button.className = 'start-scan';
    toggleContainer.classList.add('disabled');
    highlightToggle.disabled = true;
  }
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

// Toggle scan button
document.getElementById('toggleScan').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'getTrackingPixels' }, (response) => {
    const currentState = response?.scanningEnabled === true; // Only true if explicitly true
    const newState = !currentState;
    
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleScanning', 
      enabled: newState 
    }, (toggleResponse) => {
      updateScanButton(newState);
      if (!newState) {
        document.getElementById('status').textContent = 'Scanning paused';
        // Clear the display
        document.getElementById('pixelCountBanner').textContent = '0';
        document.getElementById('beaconCountBanner').textContent = '0';
        document.getElementById('totalCountBanner').textContent = '0';
        document.getElementById('count').textContent = '';
        document.getElementById('pixelList').innerHTML = '';
      } else {
        document.getElementById('status').textContent = 'Scanning active...';
        // Wait a moment for the scan to start, then load results
        setTimeout(() => {
          loadResults();
        }, 500);
      }
    });
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