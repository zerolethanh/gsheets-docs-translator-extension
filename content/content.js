/**
 * Content Script for Google Sheets & Docs.
 * Responsible for rendering premium in-page toast notifications
 * to display translation progress.
 */

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'show_toast') {
    showToastNotification(message.type, message.message);
    sendResponse({ status: 'received' });
  }
});

let toastContainer = null;

/**
 * Creates and displays a premium glassmorphic toast notification.
 */
function showToastNotification(type, message) {
  // Ensure the toast container exists on the page
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'javi-translator-toast-container';
    document.body.appendChild(toastContainer);
  }

  // Clear any existing toasts so they don't stack up
  while (toastContainer.firstChild) {
    toastContainer.removeChild(toastContainer.firstChild);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `javi-toast ${type}`;
  
  // Set Icon based on type
  let icon = '🌐';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'info') icon = '⏳';

  toast.innerHTML = `
    <div class="javi-toast-icon">${icon}</div>
    <div class="javi-toast-content">
      <div class="javi-toast-title">${type === 'info' ? 'TRANSLATING' : type === 'success' ? 'SUCCESS' : 'ERROR'}</div>
      <div class="javi-toast-message">${message}</div>
    </div>
    <button class="javi-toast-close">&times;</button>
  `;

  // Append to container
  toastContainer.appendChild(toast);

  // Close button functionality
  const closeBtn = toast.querySelector('.javi-toast-close');
  closeBtn.addEventListener('click', () => {
    dismissToast(toast);
  });

  // Auto-dismiss: 4s for success, 8s for error, 30s for info (fallback)
  let duration = type === 'success' ? 4000 : (type === 'error' ? 8000 : 30000);
  setTimeout(() => {
    dismissToast(toast);
  }, duration);
}

/**
 * Animates and removes the toast element from the DOM.
 */
function dismissToast(toast) {
  toast.classList.add('dismissed');
  toast.addEventListener('animationend', () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    // Remove container if empty
    if (toastContainer && toastContainer.childNodes.length === 0) {
      if (toastContainer.parentNode) {
        toastContainer.parentNode.removeChild(toastContainer);
      }
      toastContainer = null;
    }
  });
}

// --- Automated In-Page Document Ownership Check & Floating Copy Widget ---
(async function initOwnershipCheck() {
  try {
    const url = window.location.href;
    let fileId = '';
    let fileType = '';

    if (url.includes('docs.google.com/spreadsheets')) {
      fileType = 'sheet';
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) fileId = match[1];
    } else if (url.includes('docs.google.com/document')) {
      fileType = 'doc';
      const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      if (match) fileId = match[1];
    } else if (url.includes('docs.google.com/presentation')) {
      fileType = 'slide';
      const match = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
      if (match) fileId = match[1];
    }

    if (!fileId) return;

    // Retrieve storage credentials to perform ownership check
    chrome.storage.local.get(['scriptUrl', 'apiKey'], async (data) => {
      if (!data.scriptUrl || !data.apiKey) return;

      try {
        const response = await sendMessageToBackground({
          action: 'check_file_owner',
          scriptUrl: data.scriptUrl,
          apiKey: data.apiKey,
          fileId: fileId
        });

        if (response && response.status === 'success' && response.isOwner === false) {
          renderFloatingCopyWidget(data.scriptUrl, data.apiKey, fileId, response.ownerEmail);
        }
      } catch (e) {
        console.warn('[JA-VI Translator] Ownership check error:', e.message);
      }
    });
  } catch (err) {
    console.warn('[JA-VI Translator] Floating widget init error:', err);
  }
})();

/**
 * Safely sends a message to the background service worker, catching any extension port errors.
 */
function sendMessageToBackground(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ status: 'error', message: chrome.runtime.lastError.message });
        } else {
          resolve(response || { status: 'error', message: 'No response received' });
        }
      });
    } catch (err) {
      resolve({ status: 'error', message: err.message });
    }
  });
}

/**
 * Renders a glassmorphic floating action button on the Google Docs/Sheets/Slides page
 * when the document owner is not the current user.
 */
function renderFloatingCopyWidget(scriptUrl, apiKey, fileId, ownerEmail) {
  if (document.getElementById('javi-floating-copy-widget')) return;

  const widget = document.createElement('div');
  widget.id = 'javi-floating-copy-widget';
  widget.className = 'javi-floating-copy-container';

  widget.innerHTML = `
    <div class="javi-floating-copy-badge">
      <span class="javi-badge-icon">👥</span>
      <div class="javi-badge-text">
        <span class="javi-badge-title">Owner: ${ownerEmail || 'Other Account'}</span>
        <span class="javi-badge-sub">Not owned by you</span>
      </div>
    </div>
    <button type="button" class="javi-floating-copy-btn" id="javi-btn-floating-copy">
      <span class="javi-copy-icon">📋</span>
      <span class="javi-copy-label">Copy to My Drive</span>
    </button>
    <button type="button" class="javi-floating-close-btn" id="javi-btn-floating-close">&times;</button>
  `;

  document.body.appendChild(widget);

  const copyBtn = widget.querySelector('#javi-btn-floating-copy');
  const closeBtn = widget.querySelector('#javi-btn-floating-close');

  closeBtn.addEventListener('click', () => {
    widget.classList.add('dismissed');
    setTimeout(() => {
      if (widget.parentNode) widget.parentNode.removeChild(widget);
    }, 300);
  });

  copyBtn.addEventListener('click', async () => {
    copyBtn.disabled = true;
    const label = copyBtn.querySelector('.javi-copy-label');
    const originalText = label.textContent;
    label.textContent = 'Copying...';

    const pageTitle = document.title ? document.title.replace(/ - Google (Sheets|Docs|Slides)$/, '') : 'Document';

    try {
      const response = await sendMessageToBackground({
        action: 'make_copy',
        scriptUrl,
        apiKey,
        fileId,
        title: `Copy of ${pageTitle}`
      });

      if (response && response.status === 'success') {
        label.textContent = 'Copied!';
        showToastNotification('success', `Copied to Drive! <a href="${response.newFileUrl}" target="_blank" style="color: #fff; text-decoration: underline; font-weight: 600;">Open File ➔</a>`);
        widget.classList.add('dismissed');
        setTimeout(() => {
          if (widget.parentNode) widget.parentNode.removeChild(widget);
        }, 300);
      } else {
        label.textContent = originalText;
        copyBtn.disabled = false;
        showToastNotification('error', `Copy failed: ${response?.message || 'Unknown error'}`);
      }
    } catch (err) {
      label.textContent = originalText;
      copyBtn.disabled = false;
      showToastNotification('error', `Copy error: ${err.message}`);
    }
  });
}

