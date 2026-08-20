console.log("JupyterLab token injector content script loaded.");

function parseNotebookUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.hostname.endsWith('.notebooks.googleusercontent.com')) {
      const parts = url.hostname.split('-dot-');
      if (parts.length === 2) {
        const notebookId = parts[0];
        const rest = parts[1].split('.');
        const region = rest[0];
        return { notebookId, region };
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

const notebookInfo = parseNotebookUrl(window.location.href);
if (notebookInfo) {
  console.log("Notebook detected in content script:", notebookInfo);
  
  // Ask background script for the token
  chrome.runtime.sendMessage({ 
    action: "get_token_for_signin", 
    notebookId: notebookInfo.notebookId, 
    region: notebookInfo.region 
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error communicating with background script:", chrome.runtime.lastError);
      return;
    }
    
    if (response && response.status === "skip") {
      console.log("Session is already active (cached by background). Skipping programmatic sign-in.");
      return;
    }
    
    if (response && response.token) {
      const { token } = response;
      const notebookUrl = `https://${notebookInfo.notebookId}-dot-${notebookInfo.region}.notebooks.googleusercontent.com/lab`;
      const signinUrl = `https://${notebookInfo.region}.notebooks.cloud.google.com/_signin?continue=${encodeURIComponent(notebookUrl)}&endpoint=${notebookInfo.notebookId}`;
      
      console.log("Triggering programmatic sign-in from content script to:", signinUrl);
      
      fetch(signinUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        // 'include' ensures that cookies are sent and saved during redirects
        credentials: 'include' 
      })
      .then(res => {
        console.log("Sign-in fetch complete in page context. Status:", res.status);
        // Tell background to update cache
        chrome.runtime.sendMessage({ 
          action: "signin_complete", 
          notebookId: notebookInfo.notebookId, 
          region: notebookInfo.region 
        });
      })
      .catch(err => {
        console.error("Sign-in fetch failed in page context:", err);
      });
    }
  });
}
