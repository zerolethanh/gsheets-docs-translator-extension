document.addEventListener('DOMContentLoaded', () => {
  // Tab Switching Elements
  const tabTranslateBtn = document.getElementById('tab-translate-btn');
  const tabSettingsBtn = document.getElementById('tab-settings-btn');
  const paneTranslate = document.getElementById('pane-translate');
  const paneSettings = document.getElementById('pane-settings');

  // Translate Panel Elements
  const fileCard = document.getElementById('file-card');
  const docStatus = document.getElementById('doc-status');
  const docTitle = document.getElementById('doc-title');
  const docInfo = document.getElementById('doc-info');
  const sheetsOptionsGroup = document.getElementById('sheets-options-group');
  const btnTranslate = document.getElementById('btn-translate');
  const translateAlert = document.getElementById('translate-alert');

  // Copy to Drive Elements
  const copyDriveCard = document.getElementById('copy-drive-card');
  const ownerEmailText = document.getElementById('owner-email-text');
  const btnCopyDrive = document.getElementById('btn-copy-drive');
  const copyResultBox = document.getElementById('copy-result-box');

  // Language Direction Elements
  const selectSourceLang = document.getElementById('select-source-lang');
  const selectTargetLang = document.getElementById('select-target-lang');
  const btnSwapLangs = document.getElementById('btn-swap-langs');

  // Settings Panel Elements
  const settingsForm = document.getElementById('settings-form');
  const inputScriptUrl = document.getElementById('input-script-url');
  const inputApiKey = document.getElementById('input-api-key');
  const btnVerifyConnection = document.getElementById('btn-verify-connection');
  const settingsAlert = document.getElementById('settings-alert');
  const inputGlossary = document.getElementById('input-glossary');

  let activeTabDetails = null;

  // --- Tab Logic ---
  tabTranslateBtn.addEventListener('click', () => {
    tabTranslateBtn.classList.add('active');
    tabSettingsBtn.classList.remove('active');
    paneTranslate.classList.add('active');
    paneSettings.classList.remove('active');
  });

  tabSettingsBtn.addEventListener('click', () => {
    tabSettingsBtn.classList.add('active');
    tabTranslateBtn.classList.remove('active');
    paneSettings.classList.add('active');
    paneTranslate.classList.remove('active');
  });

  // --- Language Selection Synchronizer ---
  selectSourceLang.addEventListener('change', () => {
    if (selectSourceLang.value === 'ja') {
      selectTargetLang.value = 'vi';
    } else {
      selectTargetLang.value = 'ja';
    }
  });

  selectTargetLang.addEventListener('change', () => {
    if (selectTargetLang.value === 'vi') {
      selectSourceLang.value = 'ja';
    } else {
      selectSourceLang.value = 'vi';
    }
  });

  btnSwapLangs.addEventListener('click', () => {
    const temp = selectSourceLang.value;
    selectSourceLang.value = selectTargetLang.value;
    selectTargetLang.value = temp;
  });

  // --- Load Settings ---
  chrome.storage.local.get(['scriptUrl', 'apiKey', 'glossary'], (data) => {
    if (data.scriptUrl) inputScriptUrl.value = data.scriptUrl;
    if (data.apiKey) inputApiKey.value = data.apiKey;
    if (data.glossary) inputGlossary.value = data.glossary;
    checkConfigurationStatus();
  });

  // --- Save Settings ---
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const scriptUrl = inputScriptUrl.value.trim();
    const apiKey = inputApiKey.value.trim();
    const glossary = inputGlossary.value.trim();

    if (!scriptUrl) {
      showAlert(settingsAlert, 'error', 'Please enter a Google Apps Script Web App URL.');
      return;
    }

    if (!apiKey) {
      showAlert(settingsAlert, 'error', 'Please enter a Security Token (API Key).');
      return;
    }

    chrome.storage.local.set({ scriptUrl, apiKey, glossary }, () => {
      showAlert(settingsAlert, 'success', 'Settings saved successfully!');
      checkConfigurationStatus();
    });
  });

  // --- Connection Verification ---
  btnVerifyConnection.addEventListener('click', async () => {
    const scriptUrl = inputScriptUrl.value.trim();
    const apiKey = inputApiKey.value.trim();

    if (!scriptUrl) {
      showAlert(settingsAlert, 'error', 'Please enter a Google Apps Script Web App URL first.');
      return;
    }

    if (!apiKey) {
      showAlert(settingsAlert, 'error', 'Please enter a Security Token (API Key) first.');
      return;
    }

    btnVerifyConnection.disabled = true;
    showAlert(settingsAlert, 'info', 'Verifying connection to Apps Script...');

    try {
      const response = await sendMessageToBackground({
        action: 'verify_connection',
        scriptUrl,
        apiKey
      });

      if (response && response.status === 'success') {
        showAlert(settingsAlert, 'success', 'Connection verified successfully!');
      } else if (response && response.status === 'needs_setup') {
        showAlert(settingsAlert, 'warning', 'Connection successful, but Security Token is not set in Apps Script yet. Initializing token...');
        
        // Try to set the token in Apps Script automatically
        const setTokenResponse = await sendMessageToBackground({
          action: 'set_token',
          scriptUrl,
          apiKey
        });
        
        if (setTokenResponse && setTokenResponse.status === 'success') {
          showAlert(settingsAlert, 'success', 'Security Token successfully initialized in Apps Script! Connection verified.');
        } else {
          showAlert(settingsAlert, 'error', 'Failed to initialize Security Token: ' + (setTokenResponse?.message || 'Unknown error'));
        }
      } else {
        showAlert(settingsAlert, 'error', 'Failed: ' + (response?.message || 'Invalid response from server. Check your URL.'));
      }
    } catch (err) {
      showAlert(settingsAlert, 'error', 'Connection failed: ' + err.message);
    } finally {
      btnVerifyConnection.disabled = false;
    }
  });

  // --- Page Context Detection ---
  async function detectActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showInvalidTabState('No active page detected.');
        return;
      }

      const url = tab.url;
      const title = tab.title || 'Untitled Spreadsheet/Doc';
      let type = '';
      let fileId = '';
      let gid = '';

      if (url.includes('docs.google.com/spreadsheets')) {
        type = 'sheet';
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) fileId = match[1];
        
        const gidMatch = url.match(/[#&]gid=([0-9]+)/);
        if (gidMatch) gid = gidMatch[1];
      } else if (url.includes('docs.google.com/document')) {
        type = 'doc';
        const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
        if (match) fileId = match[1];
      } else if (url.includes('docs.google.com/presentation')) {
        type = 'slide';
        const match = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
        if (match) fileId = match[1];
      }

      if (fileId) {
        activeTabDetails = { tabId: tab.id, type, fileId, gid, title };
        showValidTabState(title, type, gid);
      } else {
        showInvalidTabState('Please open a Google Sheet, Doc, or Slide.');
      }
    } catch (err) {
      showInvalidTabState('Error detecting file: ' + err.message);
    }
  }

  function showValidTabState(title, type, gid) {
    fileCard.classList.add('valid');
    fileCard.classList.remove('invalid');
    
    if (type === 'sheet') {
      docStatus.textContent = 'Google Sheet Detected';
    } else if (type === 'doc') {
      docStatus.textContent = 'Google Document Detected';
    } else if (type === 'slide') {
      docStatus.textContent = 'Google Slide Detected';
    }
    
    docStatus.style.color = '#10b981'; // Green
    
    docTitle.textContent = title;
    docInfo.textContent = type === 'sheet' 
      ? `ID: ...${activeTabDetails.fileId.substring(0, 8)} | Active Sheet GID: ${gid || '0'}`
      : `ID: ...${activeTabDetails.fileId.substring(0, 8)}`;

    if (type === 'sheet') {
      sheetsOptionsGroup.classList.remove('hidden');
    } else {
      sheetsOptionsGroup.classList.add('hidden');
    }

    checkConfigurationStatus();
  }

  function showInvalidTabState(message) {
    fileCard.classList.remove('valid');
    fileCard.classList.add('invalid');
    
    docStatus.textContent = 'Incompatible Page';
    docStatus.style.color = '#ef4444'; // Red
    
    docTitle.textContent = 'Google Sheet / Doc / Slide required';
    docInfo.textContent = message;
    
    sheetsOptionsGroup.classList.add('hidden');
    btnTranslate.disabled = true;
  }

  // --- Configuration & Ownership Check ---
  function checkConfigurationStatus() {
    chrome.storage.local.get(['scriptUrl', 'apiKey'], (data) => {
      const isConfigured = data.scriptUrl && data.apiKey;
      const isTabValid = activeTabDetails !== null;
      
      if (isTabValid) {
        if (isConfigured) {
          btnTranslate.disabled = false;
          btnTranslate.title = 'Ready to translate!';
          
          // Perform ownership check
          checkFileOwnership(data.scriptUrl, data.apiKey, activeTabDetails.fileId);
        } else {
          btnTranslate.disabled = true;
          btnTranslate.title = 'Please configure your Apps Script URL and Token in Settings first.';
          copyDriveCard.classList.add('hidden');
        }
      } else {
        copyDriveCard.classList.add('hidden');
      }
    });
  }

  async function checkFileOwnership(scriptUrl, apiKey, fileId) {
    try {
      const response = await sendMessageToBackground({
        action: 'check_file_owner',
        scriptUrl,
        apiKey,
        fileId
      });

      if (response && response.status === 'success') {
        if (response.isOwner === false) {
          // Owner is NOT the logged-in email -> Show Copy to Drive button
          copyDriveCard.classList.remove('hidden');
          ownerEmailText.textContent = response.ownerEmail || 'Other Account';
        } else {
          // User IS the owner -> Hide Copy to Drive button
          copyDriveCard.classList.add('hidden');
        }
      } else {
        copyDriveCard.classList.add('hidden');
      }
    } catch (err) {
      console.warn('Ownership check error:', err.message);
      copyDriveCard.classList.add('hidden');
    }
  }

  // --- Copy to Drive Action ---
  btnCopyDrive.addEventListener('click', async () => {
    if (!activeTabDetails) return;

    const { scriptUrl, apiKey } = await chrome.storage.local.get(['scriptUrl', 'apiKey']);
    if (!scriptUrl || !apiKey) {
      showAlert(translateAlert, 'error', 'Extension is not configured. Please visit Settings.');
      return;
    }

    const copyBtnText = btnCopyDrive.querySelector('.copy-btn-text');
    const copySpinner = btnCopyDrive.querySelector('.copy-spinner');

    btnCopyDrive.disabled = true;
    copyBtnText.textContent = 'Copying to Drive...';
    copySpinner.classList.remove('hidden');
    copyResultBox.classList.add('hidden');

    try {
      const response = await sendMessageToBackground({
        action: 'make_copy',
        scriptUrl,
        apiKey,
        fileId: activeTabDetails.fileId,
        tabId: activeTabDetails.tabId,
        title: `Copy of ${activeTabDetails.title || 'Document'}`
      });

      if (response && response.status === 'success') {
        copyResultBox.innerHTML = `✅ Saved! <a href="${response.newFileUrl}" target="_blank">Open Copied File ➔</a>`;
        copyResultBox.classList.remove('hidden');
        showAlert(translateAlert, 'success', 'Document successfully copied to your Google Drive!');
      } else {
        showAlert(translateAlert, 'error', 'Copy failed: ' + (response?.message || 'Unknown error'));
      }
    } catch (err) {
      showAlert(translateAlert, 'error', 'Error copying file: ' + err.message);
    } finally {
      btnCopyDrive.disabled = false;
      copyBtnText.textContent = 'Make a Copy to My Drive';
      copySpinner.classList.add('hidden');
    }
  });

  // --- Trigger Translation ---
  btnTranslate.addEventListener('click', async () => {
    if (!activeTabDetails) return;

    const { scriptUrl, apiKey, glossary } = await chrome.storage.local.get(['scriptUrl', 'apiKey', 'glossary']);
    if (!scriptUrl || !apiKey) {
      showAlert(translateAlert, 'error', 'Extension is not configured. Please visit Settings.');
      return;
    }

    // Prepare translation options
    const options = {
      action: activeTabDetails.type === 'sheet' ? 'translate_sheet' : (activeTabDetails.type === 'doc' ? 'translate_doc' : 'translate_slide'),
      id: activeTabDetails.fileId,
      scriptUrl,
      apiKey,
      tabId: activeTabDetails.tabId,
      sourceLang: selectSourceLang.value,
      targetLang: selectTargetLang.value,
      glossary: glossary || ''
    };

    if (activeTabDetails.type === 'sheet') {
      const scopeVal = document.querySelector('input[name="sheetScope"]:checked').value;
      options.translateAll = (scopeVal === 'all');
      options.gid = activeTabDetails.gid || '0';
    }

    // Update UI loading state
    setButtonLoading(true);
    showAlert(translateAlert, 'info', 'Translation process initiated. Watch your page for progress...');

    try {
      const response = await sendMessageToBackground({
        action: 'start_translation',
        options
      });

      if (response && response.status === 'success') {
        showAlert(translateAlert, 'success', 'Translation completed successfully!');
      } else {
        showAlert(translateAlert, 'error', 'Translation failed: ' + (response?.message || 'Unknown error'));
      }
    } catch (err) {
      showAlert(translateAlert, 'error', 'Error running translation: ' + err.message);
    } finally {
      setButtonLoading(false);
    }
  });

  // --- Helper Functions ---
  function showAlert(element, type, message) {
    element.className = `status-alert ${type}`;
    element.textContent = message;
    element.classList.remove('hidden');
    
    // Auto-hide info or success messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (element.textContent === message) {
          element.classList.add('hidden');
        }
      }, 5000);
    }
  }

  function setButtonLoading(isLoading) {
    const btnText = btnTranslate.querySelector('.btn-text');
    const spinner = btnTranslate.querySelector('.spinner');

    if (isLoading) {
      btnTranslate.disabled = true;
      btnText.textContent = 'Translating...';
      spinner.classList.remove('hidden');
    } else {
      btnTranslate.disabled = false;
      btnText.textContent = 'Translate Document';
      spinner.classList.add('hidden');
    }
  }

  function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Detect active tab on load
  detectActiveTab();
});
