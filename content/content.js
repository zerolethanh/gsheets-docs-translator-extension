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
