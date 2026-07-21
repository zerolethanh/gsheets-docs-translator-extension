# Chrome Web Store Listing — JA-VI Sheets & Docs Translator

> Last Updated: 2026-05-20

## Store Listing

**Extension Name**
JA-VI Sheets & Docs Translator

**Short Description**
Auto-translates Google Sheets and Docs between Japanese and Vietnamese in-place using a secure Apps Script connector.

**Detailed Description**
Translates cell text and paragraphs in your Google Sheets and Docs in-place.

JA-VI Sheets & Docs Translator reads text in your active Google Sheets or Google Docs and translates it between Japanese and Vietnamese (both JA ➔ VI and VI ➔ JA directions), replacing the original text while preserving sheet structures and layout paragraphs. 

To bypass the complex HTML Canvas rendering used in Google Workspace applications, this extension works in combination with a companion Google Apps Script that runs directly in your Google account. This provides maximum speed, stability, and security, avoiding fragile DOM scraping.

Key Features:
- Instantly translates complete Google Docs paragraphs.
- Supports both Japanese-to-Vietnamese and Vietnamese-to-Japanese translations.
- Translates Google Sheets (Active Sheet only or All Sheets in the workbook).
- Smart character filtering ensures it only translates cells in the source language, leaving numbers, formulas, and other languages untouched.
- Optimized text-run batching performs translations up to 50x faster and fits within free translation quotas.
- Displays premium, modern progress toasts directly on your Google Doc/Sheet page.

How to use:
1. Open the extension's Settings tab and follow the quick 5-step guide to paste and deploy the companion Google Apps Script in your Google Drive.
2. Enter your deployed Web App URL and your chosen security token.
3. Open any Google Doc or Google Sheet containing Japanese or Vietnamese text.
4. Click the extension icon, choose your translation direction (e.g. Vietnamese ➔ Japanese), and click "Translate Document".
5. A progress notification will appear in the page, and your text will be translated in-place.

Privacy and Security:
All translation operations are performed within your own Google Account using the official, free Google Apps Script translation service. Your document data is never sent to third-party translation servers. The security token protects your web app endpoint from unauthorized access.

**Category**
Productivity

**Single Purpose**
Translates Japanese text to Vietnamese and Vietnamese text to Japanese inside Google Sheets and Docs.

**Primary Language**
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | icons/icon-128.png |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile | 440×280 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: Shows the popup interface on a Google Sheet page, highlighting the active sheet detection, translation direction selectors, and the "Translate Document" button.
- Screenshot 2: Shows a Google Sheet after translation has run, with the in-page checkmark toast showing "Translation completed successfully!".

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Used to store the Google Apps Script Web App URL and the user-defined Security Token locally on the device. |
| `activeTab` | permissions | Used to detect if the active webpage is a Google Sheet or Doc, read its URL to extract the document/spreadsheet ID and GID, and notify the page content script when translation begins. |
| `https://docs.google.com/spreadsheets/*` | host_permissions | Used to execute the content script and display the in-page translation progress toast on Google Sheets. |
| `https://docs.google.com/document/*` | host_permissions | Used to execute the content script and display the in-page translation progress toast on Google Documents. |
| `https://script.google.com/*` | host_permissions | Used to send HTTP requests to the user's deployed Google Apps Script Web App macro URL. |
| `https://script.googleusercontent.com/*` | host_permissions | Used to follow redirection URLs to execute Google Apps Script actions. |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL**
Not applicable (No user data is collected, stored, or transmitted to any third-party servers by this extension).

---

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

---

## Developer Info

**Publisher Name**
LE VAN THANH

**Contact Email**
zero.lethanh@gmail.com

**Support URL / Email**
https://github.com/lethanh/gsheets-docs-translator-extension/issues

**Homepage URL**
https://github.com/lethanh/gsheets-docs-translator-extension

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.1.0 | 2026-05-20 | Added bi-directional translation (JA ➔ VI and VI ➔ JA) and UI selectors. | Draft |

---

## Review Notes

### Known Issues / Limitations
- Requires a one-time copy-paste Google Apps Script setup.
- Translation speed depends on Google Apps Script and Google Translate quotas (5,000+ operations/day for free Google accounts).
