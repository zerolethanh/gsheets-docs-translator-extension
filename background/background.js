/**
 * Background Service Worker.
 * Handles API calls to Google Apps Script Web App to bypass CORS restrictions
 * and relays status updates to content scripts.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'verify_connection') {
    (async () => {
      try {
        const result = await callAppsScript(message.scriptUrl, {
          action: 'check_connection',
          apiKey: message.apiKey
        });
        sendResponse(result);
      } catch (err) {
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.action === 'set_token') {
    (async () => {
      try {
        const result = await callAppsScript(message.scriptUrl, {
          action: 'set_key',
          apiKey: message.apiKey,
          forceUpdate: true
        });
        sendResponse(result);
      } catch (err) {
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'start_translation') {
    const { options } = message;
    const srcUpper = (options.sourceLang || 'ja').toUpperCase();
    const tgtUpper = (options.targetLang || 'vi').toUpperCase();

    (async () => {
      try {
        // 1. Tell content script to show the "Translating" toast
        await notifyContentScript(options.tabId, {
          action: 'show_toast',
          type: 'info',
          message: `Auto-translating ${srcUpper} ➔ ${tgtUpper}...`
        });

        // 2. Perform the fetch request to the Apps Script Web App
        const payload = {
          action: options.action,
          id: options.id,
          apiKey: options.apiKey,
          sourceLang: options.sourceLang || 'ja',
          targetLang: options.targetLang || 'vi'
        };

        if (options.action === 'translate_sheet') {
          payload.gid = options.gid;
          payload.translateAll = options.translateAll;
        }

        const result = await callAppsScript(options.scriptUrl, payload);

        if (result && result.status === 'success') {
          // 3. Notify content script of success
          await notifyContentScript(options.tabId, {
            action: 'show_toast',
            type: 'success',
            message: 'Translation completed successfully!'
          });
          sendResponse({ status: 'success' });
        } else {
          // 4. Notify content script of failure
          const errMsg = result?.message || 'Server error occurred during translation';
          await notifyContentScript(options.tabId, {
            action: 'show_toast',
            type: 'error',
            message: `Translation failed: ${errMsg}`
          });
          sendResponse({ status: 'error', message: errMsg });
        }
      } catch (err) {
        await notifyContentScript(options.tabId, {
          action: 'show_toast',
          type: 'error',
          message: `Connection error: ${err.message}`
        });
        sendResponse({ status: 'error', message: err.message });
      }
    })();
    return true;
  }
});

/**
 * Sends a POST request to the Google Apps Script Web App.
 * Handles the redirect chain.
 */
async function callAppsScript(url, payload) {
  // Validate URL format
  if (!url.startsWith('https://script.google.com/macros/')) {
    throw new Error('Invalid URL. Must be a Google Apps Script Web App URL.');
  }
  if (!url.includes('/exec')) {
    throw new Error('URL must contain "/exec". Please make sure you copied the Web App URL from the deployment screen, not the editor URL.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain' // Must be text/plain to avoid triggering CORS preflight OPTIONS requests
    },
    body: JSON.stringify(payload),
    redirect: 'follow', // Follow redirects to script.googleusercontent.com
    credentials: 'include' // Send active Google session cookies to bypass Google Workspace corporate sharing restrictions
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const htmlText = await response.text();
    if (htmlText.includes('Google Accounts') || htmlText.includes('Sign in') || htmlText.includes('identifierId')) {
      throw new Error('Access Denied. Google Login prompt detected. Please redeploy your Apps Script and set "Who has access" to "Anyone".');
    }
    
    // Attempt to extract title for better diagnostics
    const titleMatch = htmlText.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    if (title) {
      if (title.includes('Authorization Required')) {
        throw new Error('Authorization Required. Please open your Apps Script editor, run the script once to authorize permissions, then try again.');
      }
      throw new Error(`Server returned HTML Page: "${title}". Ensure you deployed as a Web App and authorized script permissions.`);
    }
    throw new Error('Received an HTML page instead of JSON. Ensure your script is deployed as a Web App and the URL is correct.');
  }

  const data = await response.json();
  return data;
}

/**
 * Safely sends a message to the content script in a specific tab.
 */
async function notifyContentScript(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    // Content script might not be loaded yet or tab was closed
    console.warn('Could not send message to content script:', err.message);
  }
}
