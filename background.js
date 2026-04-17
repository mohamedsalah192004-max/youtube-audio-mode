// Background script for YouTube Audio Mode
// Handles keyboard shortcuts and badge updates

// Initialize state
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['audioMode'], (result) => {
        const enabled = result.audioMode || false;
        updateBadge(enabled);
    });

    // Log storage quota on install
    monitorStorageQuota();
});

// Debounced badge update to prevent excessive calls
let badgeUpdateTimeout = null;
function debouncedUpdateBadge(enabled) {
    if (badgeUpdateTimeout) {
        clearTimeout(badgeUpdateTimeout);
    }
    badgeUpdateTimeout = setTimeout(() => {
        updateBadge(enabled);
    }, 100);
}

// Update badge when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.audioMode) {
        debouncedUpdateBadge(changes.audioMode.newValue);
    }
});

function updateBadge(enabled) {
    if (enabled) {
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

// Monitor storage quota
function monitorStorageQuota() {
    chrome.storage.sync.getBytesInUse(null, (bytes) => {
        const quotaLimit = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB
        const usagePercent = (bytes / quotaLimit) * 100;

        if (usagePercent > 90) {
            console.warn(`[Audio Mode] Storage quota at ${usagePercent.toFixed(1)}% (${bytes}/${quotaLimit} bytes)`);
        } else {
            console.log(`[Audio Mode] Storage usage: ${usagePercent.toFixed(1)}% (${bytes}/${quotaLimit} bytes)`);
        }
    });
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-audio-mode') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url.includes('youtube.com')) {
                // Send toggle message to content script
                chrome.tabs.sendMessage(currentTab.id, { action: 'toggleAudioMode' }, (response) => {
                    // Update storage if content script handles it
                    // (The content script updates storage, which triggers the onChanged listener above)

                    // Fallback: inject content script if not ready
                    if (chrome.runtime.lastError) {
                        console.log('Content script not ready, injecting script...');
                        chrome.scripting.executeScript({
                            target: { tabId: currentTab.id },
                            files: ['content.js']
                        }, () => {
                            // Toggle state after script is loaded
                            chrome.storage.sync.get(['audioMode'], (result) => {
                                const newState = !result.audioMode;
                                chrome.storage.sync.set({ audioMode: newState });
                            });
                        });
                    }
                });
            }
        });
    }
});

// Handle YouTube navigation (new tabs and SPA navigation)
function handleYouTubeNavigation(tabId, url) {
    // Only handle watch pages
    if (!url || !url.includes('youtube.com/watch')) return;

    chrome.storage.sync.get(['audioMode'], (result) => {
        if (result.audioMode) {
            // Try to send message to existing content script
            chrome.tabs.sendMessage(tabId, { action: 'getStatus' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script not loaded, inject it
                    console.log('[Audio Mode] Injecting content script for new navigation');
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content.js']
                    }).catch(err => {
                        console.log('[Audio Mode] Could not inject script:', err);
                    });
                }
            });
        }
    });
}

// Listen for YouTube SPA navigation (when clicking videos within YouTube)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    // Only handle main frame navigation
    if (details.frameId === 0) {
        handleYouTubeNavigation(details.tabId, details.url);
    }
}, { url: [{ hostContains: 'youtube.com' }] });

// Listen for new tabs loading YouTube
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com/watch')) {
        handleYouTubeNavigation(tabId, tab.url);
    }
});
