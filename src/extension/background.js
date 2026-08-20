// background.js
console.log("Background service worker started.");

let cachedToken = null;
let tokenExpiry = 0; // timestamp

// Update declarativeNetRequest rules with the active token
function updateAuthRules(token) {
  const ruleIds = [1, 2];
  const rules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          {
            header: 'Authorization',
            operation: 'set',
            value: `Bearer ${token}`
          }
        ]
      },
      condition: {
        resourceTypes: [
          'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
          'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
          'media', 'websocket', 'other'
        ]
      }
    },
    {
      id: 2,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          {
            header: 'Authorization',
            operation: 'set',
            value: `Bearer ${token}`
          }
        ]
      },
      condition: {
        resourceTypes: [
          'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
          'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
          'media', 'websocket', 'other'
        ]
      }
    }
  ];

  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds,
    addRules: rules
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error updating rules:", chrome.runtime.lastError);
    } else {
      console.log("Session rules updated successfully with token.");
    }
  });
}

// Get cached token or fetch a new one via native messaging host
function getOrFetchToken(callback) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    console.log("Using cached token.");
    callback(null, cachedToken);
    return;
  }

  console.log("Fetching token from native messaging host...");
  chrome.runtime.sendNativeMessage(
    'com.google.workbench.token_helper',
    { request: 'get_token' },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Native messaging error:", chrome.runtime.lastError);
        callback(chrome.runtime.lastError, null);
        return;
      }
      if (response && response.token) {
        cachedToken = response.token;
        tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutes cache
        console.log("Token fetched and cached in memory.");
        callback(null, cachedToken);
      } else {
        console.error("Invalid response from native messaging host:", response);
        callback(new Error("Invalid response"), null);
      }
    }
  );
}

function refreshToken() {
  getOrFetchToken((err, token) => {
    if (!err && token) {
      updateAuthRules(token);
    }
  });
}

// Event listeners
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
  refreshToken();
  chrome.alarms.create('refreshTokenAlarm', { periodInMinutes: 45 });
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Extension started up.");
  refreshToken();
  chrome.alarms.create('refreshTokenAlarm', { periodInMinutes: 45 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshTokenAlarm') {
    console.log("Refresh token alarm fired.");
    refreshToken();
  }
});

// Debug listener for rule matching
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    console.log("DNR Rule Matched:", info.request.method, info.request.url, "Type:", info.request.type, "Rule ID:", info.rule.ruleId);
  });
} else {
  console.log("onRuleMatchedDebug is not available (must be run as unpacked extension with feedback permission).");
}

// Track signed-in endpoints to avoid redundant requests in a short time
const activeSessions = new Map(); // endpoint -> expiry timestamp

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get_token_for_signin") {
    const endpoint = `${message.notebookId}-${message.region}`;
    const now = Date.now();
    
    if (activeSessions.has(endpoint) && activeSessions.get(endpoint) > now) {
      console.log(`Session for ${endpoint} is already active. Instructing content script to skip.`);
      sendResponse({ status: "skip" });
      return;
    }
    
    console.log(`Content script requested token for ${endpoint}. Fetching...`);
    getOrFetchToken((err, token) => {
      if (err || !token) {
        console.error("Failed to fetch token for content script:", err);
        sendResponse({ error: err ? err.message : "No token available" });
      } else {
        console.log("Token fetched successfully for content script.");
        sendResponse({ token: token });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (message.action === "signin_complete") {
    const endpoint = `${message.notebookId}-${message.region}`;
    console.log(`Content script reported sign-in complete for ${endpoint}. Caching session.`);
    activeSessions.set(endpoint, Date.now() + 30 * 60 * 1000); // Cache for 30 minutes
    sendResponse({ status: "ok" });
  }
});
