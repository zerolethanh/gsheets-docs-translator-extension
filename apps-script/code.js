/**
 * Google Apps Script Web App for translating Google Sheets and Docs.
 * Acts as a secure, fast proxy for the Chrome Extension.
 */

/**
 * Automatically creates a custom menu when opening the Sheet or Doc.
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🌐 JA-VI Translator')
      .addItem('Translate Active Sheet: JA ➔ VI', 'menuSheetJaVi')
      .addItem('Translate Active Sheet: VI ➔ JA', 'menuSheetViJa')
      .addSeparator()
      .addItem('Translate All Sheets: JA ➔ VI', 'menuAllSheetsJaVi')
      .addItem('Translate All Sheets: VI ➔ JA', 'menuAllSheetsViJa')
      .addToUi();
  } catch (e) {
    try {
      var ui = DocumentApp.getUi();
      ui.createMenu('🌐 JA-VI Translator')
        .addItem('Translate Document: JA ➔ VI', 'menuDocJaVi')
        .addItem('Translate Document: VI ➔ JA', 'menuDocViJa')
        .addToUi();
    } catch (err) {
      try {
        var ui = SlidesApp.getUi();
        ui.createMenu('🌐 JA-VI Translator')
          .addItem('Translate Presentation: JA ➔ VI', 'menuSlideJaVi')
          .addItem('Translate Presentation: VI ➔ JA', 'menuSlideViJa')
          .addToUi();
      } catch (e3) {
        // Standalone script
      }
    }
  }
}

// --- Menu Helper Callback Functions ---
function menuSheetJaVi() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  translateSheet(ss.getId(), "ja", "vi", null, sheet.getSheetId().toString(), false);
}

function menuSheetViJa() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  translateSheet(ss.getId(), "vi", "ja", null, sheet.getSheetId().toString(), false);
}

function menuAllSheetsJaVi() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  translateSheet(ss.getId(), "ja", "vi", null, null, true);
}

function menuAllSheetsViJa() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  translateSheet(ss.getId(), "vi", "ja", null, null, true);
}

function menuDocJaVi() {
  var doc = DocumentApp.getActiveDocument();
  translateDoc(doc.getId(), "ja", "vi");
}

function menuDocViJa() {
  var doc = DocumentApp.getActiveDocument();
  translateDoc(doc.getId(), "vi", "ja");
}

function menuSlideJaVi() {
  var presentation = SlidesApp.getActivePresentation();
  translateSlide(presentation.getId(), "ja", "vi");
}

function menuSlideViJa() {
  var presentation = SlidesApp.getActivePresentation();
  translateSlide(presentation.getId(), "vi", "ja");
}

/**
 * Dummy function to trigger the Google OAuth authorization prompt in the editor.
 * Select "authorizeScript" from the function list in the editor and click "Run".
 */
function authorizeScript() {
  Logger.log("Triggering OAuth authorization...");
  try { SpreadsheetApp.openById("1234567890"); } catch (e) { }
  try { DocumentApp.openById("1234567890"); } catch (e) { }
  try { SlidesApp.openById("1234567890"); } catch (e) { }
  LanguageApp.translate("Hello", "en", "vi");
  Logger.log("Authorization successful!");
}

// REGEX for Japanese characters: Hiragana, Katakana, and Kanji
// --- CONFIGURATION ---
var GLOSSARY = {
  "ひたち": "HITACHI",
  "Version up": "Verup",
  "ポイント": "Point"
};
// ---------------------

var JAPANESE_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;
// REGEX for Latin characters including Vietnamese diacritics
var LATIN_VIETNAMESE_REGEX = /[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var id = params.id;
    var apiKey = params.apiKey;
    var sourceLang = params.sourceLang;
    var targetLang = params.targetLang;

    // Parse custom glossary from request payload
    if (params.glossaryText) {
      var lines = params.glossaryText.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf('=') !== -1) {
          var parts = line.split('=');
          var key = parts[0].trim();
          var val = parts.slice(1).join('=').trim(); // in case value contains '='
          if (key && val) {
            GLOSSARY[key] = val;
          }
        }
      }
    }

    var scriptProperties = PropertiesService.getScriptProperties();
    var savedKey = scriptProperties.getProperty("API_KEY");

    // 1. Connection check
    if (action === "check_connection") {
      if (!savedKey) {
        return createJsonResponse({
          status: "needs_setup",
          message: "Connection successful, but Security Token needs to be initialized."
        });
      }
      if (apiKey !== savedKey) {
        return createJsonResponse({
          status: "error",
          message: "Unauthorized: Invalid Security Token"
        });
      }
      return createJsonResponse({
        status: "success",
        message: "Connection verified!"
      });
    }

    // 2. Set/Update Security Token
    if (action === "set_key") {
      if (!savedKey) {
        if (!apiKey || apiKey.trim() === "") {
          return createJsonResponse({
            status: "error",
            message: "Security Token cannot be empty."
          });
        }
        scriptProperties.setProperty("API_KEY", apiKey);
        return createJsonResponse({
          status: "success",
          message: "Security Token successfully configured."
        });
      } else {
        return createJsonResponse({
          status: "error",
          message: "Security Token is already set. To change or reset it, please edit the Script Properties manually in the Google Apps Script project settings."
        });
      }
    }

    // Validate credentials for other actions
    if (!savedKey) {
      return createJsonResponse({
        status: "error",
        message: "Apps Script Security Token has not been set. Set it in the extension."
      });
    }
    if (apiKey !== savedKey) {
      return createJsonResponse({
        status: "error",
        message: "Unauthorized: Invalid Security Token."
      });
    }

    // 3. Document Translation
    if (action === "translate_doc") {
      if (!id) throw new Error("Document ID is required.");
      translateDoc(id, sourceLang, targetLang);
      return createJsonResponse({
        status: "success",
        message: "Google Doc successfully translated from " + sourceLang.toUpperCase() + " to " + targetLang.toUpperCase() + "."
      });
    }

    // 4. Sheet Translation
    if (action === "translate_sheet") {
      if (!id) throw new Error("Spreadsheet ID is required.");
      var gid = params.gid;
      var translateAll = params.translateAll === true;
      var range = params.range; // optional range string like "A1:C20"

      translateSheet(id, sourceLang, targetLang, range, gid, translateAll);
      return createJsonResponse({
        status: "success",
        message: "Google Sheet successfully translated from " + sourceLang.toUpperCase() + " to " + targetLang.toUpperCase() + "."
      });
    }

    // 5. Slide Translation
    if (action === "translate_slide") {
      if (!id) throw new Error("Presentation ID is required.");
      translateSlide(id, sourceLang, targetLang);
      return createJsonResponse({
        status: "success",
        message: "Google Slides successfully translated from " + sourceLang.toUpperCase() + " to " + targetLang.toUpperCase() + "."
      });
    }

    // 6. Check File Owner
    if (action === "check_file_owner" || action === "get_file_info") {
      if (!id) throw new Error("Document ID is required.");
      var file = DriveApp.getFileById(id);
      var owner = file.getOwner();
      var ownerEmail = owner ? owner.getEmail() : "";
      
      var activeUser = Session.getActiveUser();
      var userEmail = activeUser ? activeUser.getEmail() : "";
      if (!userEmail) {
        var effectiveUser = Session.getEffectiveUser();
        userEmail = effectiveUser ? effectiveUser.getEmail() : "";
      }
      
      var isOwner = (ownerEmail !== "" && userEmail !== "" && ownerEmail.toLowerCase() === userEmail.toLowerCase());
      
      return createJsonResponse({
        status: "success",
        id: id,
        fileName: file.getName(),
        ownerEmail: ownerEmail || "Shared/Unknown",
        userEmail: userEmail || "Unknown",
        isOwner: isOwner
      });
    }

    // 7. Make a Copy to User's Google Drive
    if (action === "make_copy") {
      if (!id) throw new Error("Document ID is required.");
      var originalFile = DriveApp.getFileById(id);
      var copyName = params.copyTitle || ("Copy of " + originalFile.getName());
      var copiedFile = originalFile.makeCopy(copyName);

      return createJsonResponse({
        status: "success",
        message: "Document successfully copied to your Google Drive!",
        newFileId: copiedFile.getId(),
        newFileUrl: copiedFile.getUrl(),
        newFileName: copiedFile.getName()
      });
    }

    return createJsonResponse({
      status: "error",
      message: "Unsupported action: " + action
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Server Error: " + err.toString()
    });
  }
}

/**
 * Creates a CORS-compliant JSON response.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Checks if a string should be translated based on the source language.
 */
function shouldTranslate(text, sourceLang) {
  if (sourceLang === "ja") {
    return JAPANESE_REGEX.test(text);
  } else if (sourceLang === "vi") {
    // Must contain Latin/Vietnamese characters and NOT contain Japanese characters
    return LATIN_VIETNAMESE_REGEX.test(text) && !JAPANESE_REGEX.test(text);
  }
  return true;
}

/**
 * Translates an array of text segments in batches to optimize speed and API calls.
 */
function batchTranslate(texts, sourceLang, targetLang) {
  if (texts.length === 0) return {};

  var translations = {};
  var chunks = [];
  var currentChunk = [];
  var currentLength = 0;

  // Apply glossary placeholders and protect specific keywords naturally
  var processedTexts = [];
  var glossaryContexts = [];
  var keys = Object.keys(GLOSSARY);

  // Regex to detect technical keywords naturally:
  // 1. Kebab/Snake case (e.g., stg-circuitBreaker, my_variable)
  // 2. camelCase (e.g., exchangeSummaryCalculator)
  // 3. PascalCase (e.g., FinancialAssetsChecker)
  // 4. Alphanumeric variables (e.g., user123, apiV2)
  var keywordRegex = /\b(?:[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)+|[a-z]+[A-Z][a-zA-Z0-9]*|[A-Z]+[a-z]+[A-Z][a-zA-Z0-9]*|[a-zA-Z]+[0-9]+[a-zA-Z0-9]*)\b/g;

  for (var i = 0; i < texts.length; i++) {
    var text = texts[i];
    var processed = text;
    var context = {};
    var placeholderCounter = 0;

    // 1. Auto-detect keywords and protect them
    var match;
    var foundKeywords = [];
    while ((match = keywordRegex.exec(text)) !== null) {
      if (foundKeywords.indexOf(match[0]) === -1) {
        foundKeywords.push(match[0]);
      }
    }

    for (var j = 0; j < foundKeywords.length; j++) {
      var keyword = foundKeywords[j];
      var placeholder = "ZZZ" + placeholderCounter + "ZZZ";
      placeholderCounter++;
      var regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processed = processed.replace(regex, " " + placeholder + " ");
      context[placeholder] = keyword;
    }

    // 2. Apply GLOSSARY
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (processed.indexOf(key) !== -1) {
        var placeholder = "ZZZ" + placeholderCounter + "ZZZ";
        placeholderCounter++;
        var regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processed = processed.replace(regex, " " + placeholder + " ");
        context[placeholder] = GLOSSARY[key];
      }
    }
    processedTexts.push(processed);
    glossaryContexts.push(context);
  }

  for (var i = 0; i < processedTexts.length; i++) {
    var text = processedTexts[i];
    if (currentLength + text.length > 2000 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push({ originalIndex: i, text: text });
    currentLength += text.length + 12; // Length of the new delimiter
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  for (var c = 0; c < chunks.length; c++) {
    var chunk = chunks[c];
    if (chunk.length === 0) continue;
    var DELIMITER = "\n\n[###]\n\n";
    var combinedText = chunk.map(function (item) { return item.text; }).join(DELIMITER);
    try {
      var translatedText = LanguageApp.translate(combinedText, sourceLang, targetLang);

      // Use flexible regex that preserves internal newlines (\n, \r\n) within translated segments
      var splitRegex = /[ \t]*\r?\n\r?\n\[\s*#\s*#\s*#\s*\]\r?\n\r?\n[ \t]*/;
      var translatedArray = translatedText.split(splitRegex);

      if (translatedArray.length !== chunk.length) {
        // Fallback: Try splitting with broader whitespace delimiter if exact structure was modified
        var fallbackSplitRegex = /\s*\[\s*#\s*#\s*#\s*\]\s*/;
        translatedArray = translatedText.split(fallbackSplitRegex);
      }

      if (translatedArray.length !== chunk.length) {
        throw new Error("Split mismatch! Expected " + chunk.length + " but got " + translatedArray.length);
      }

      for (var i = 0; i < chunk.length; i++) {
        var originalIndex = chunk[i].originalIndex;
        var originalText = texts[originalIndex];
        var translated = translatedArray[i] || chunk[i].text;

        var context = glossaryContexts[originalIndex];
        for (var placeholder in context) {
          // Use [ \t]* to match horizontal whitespace only, preserving newlines (\n, \r\n)
          var pRegex = new RegExp("[ \\t]*" + placeholder + "[ \\t]*", "gi");
          translated = translated.replace(pRegex, " " + context[placeholder] + " ").replace(/^[ \t]+|[ \t]+$/g, '');
        }
        // Collapse multiple horizontal spaces only; do NOT collapse or strip newlines (\n, \r\n)
        translated = translated.replace(/[ \t]{2,}/g, ' ');

        translations[originalText] = translated;
      }
    } catch (e) {
      Logger.log("Batch translation failed: " + e.toString());
      for (var i = 0; i < chunk.length; i++) {
        var originalIndex = chunk[i].originalIndex;
        var originalText = texts[originalIndex];
        try {
          var translated = LanguageApp.translate(chunk[i].text, sourceLang, targetLang);

          var context = glossaryContexts[originalIndex];
          for (var placeholder in context) {
            var pRegex = new RegExp("[ \\t]*" + placeholder + "[ \\t]*", "gi");
            translated = translated.replace(pRegex, " " + context[placeholder] + " ").replace(/^[ \t]+|[ \t]+$/g, '');
          }
          translated = translated.replace(/[ \t]{2,}/g, ' ');

          translations[originalText] = translated;
        } catch (err) {
          translations[originalText] = originalText;
        }
      }
    }
  }

  return translations;
}

/**
 * Translates a Google Sheet's cell values.
 */
function translateSheet(spreadsheetId, sourceLang, targetLang, rangeNotation, gid, translateAll) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var targetSheets = [];

  if (translateAll) {
    targetSheets = ss.getSheets();
  } else {
    var sheet = null;
    if (gid) {
      sheet = getSheetByGid(ss, gid);
    }
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }
    targetSheets = [sheet];
  }

  for (var s = 0; s < targetSheets.length; s++) {
    var currentSheet = targetSheets[s];
    var range = rangeNotation ? currentSheet.getRange(rangeNotation) : currentSheet.getDataRange();
    if (!range) continue;

    var values = range.getValues();
    var formulas = range.getFormulas();
    var validations = range.getDataValidations();

    // Step 1: Collect unique source text (from cells, validations, and names)
    var uniqueJaTexts = [];
    var jaMap = {};

    // Collect sheet name
    var sheetName = currentSheet.getName();
    if (shouldTranslate(sheetName, sourceLang) && !jaMap[sheetName]) {
      jaMap[sheetName] = true;
      uniqueJaTexts.push(sheetName);
    }

    // Collect Spreadsheet name (only do it on the first sheet to avoid redundant API calls)
    var ssName = null;
    if (s === 0) {
      ssName = ss.getName();
      if (shouldTranslate(ssName, sourceLang) && !jaMap[ssName]) {
        jaMap[ssName] = true;
        uniqueJaTexts.push(ssName);
      }
    }

    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        var val = values[r][c];
        var formula = formulas[r][c];

        // Collect cell value
        if (!formula && typeof val === 'string' && val.trim() !== '') {
          if (shouldTranslate(val, sourceLang) && !jaMap[val]) {
            jaMap[val] = true;
            uniqueJaTexts.push(val);
          }
        }

        // Collect VALUE_IN_LIST criteria texts
        var validation = validations[r] ? validations[r][c] : null;
        if (validation && validation.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
          var list = validation.getCriteriaValues()[0];
          if (Array.isArray(list)) {
            for (var i = 0; i < list.length; i++) {
              var listItem = String(list[i]);
              if (shouldTranslate(listItem, sourceLang) && !jaMap[listItem]) {
                jaMap[listItem] = true;
                uniqueJaTexts.push(listItem);
              }
            }
          }
        }
      }
    }

    if (uniqueJaTexts.length === 0) continue;

    // Step 2: Batch translate the Japanese text
    var translations = batchTranslate(uniqueJaTexts, sourceLang, targetLang);

    // Step 3: Update Sheet and Spreadsheet names
    if (translations[sheetName]) {
      try {
        currentSheet.setName(translations[sheetName]);
      } catch (e) {
        Logger.log("Failed to rename sheet: " + e.toString());
      }
    }

    if (s === 0 && ssName && translations[ssName]) {
      try {
        ss.rename(translations[ssName]);
      } catch (e) {
        Logger.log("Failed to rename spreadsheet: " + e.toString());
      }
    }

    // Step 4: Write back translated values and update validations
    var hasChanged = false;
    var originalValues = [];
    var newValidations = [];

    for (var r = 0; r < values.length; r++) {
      originalValues.push(values[r].slice());
      newValidations.push([]);
      for (var c = 0; c < values[r].length; c++) {
        var val = values[r][c];
        var formula = formulas[r][c];
        var validation = validations[r] ? validations[r][c] : null;

        // Prepare new validation if VALUE_IN_LIST
        if (validation && validation.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
          var criteriaArgs = validation.getCriteriaValues();
          var list = criteriaArgs[0];
          var showDropdown = criteriaArgs.length > 1 ? criteriaArgs[1] : true;

          var newList = [];
          var changedValidation = false;
          if (Array.isArray(list)) {
            for (var i = 0; i < list.length; i++) {
              var listItem = String(list[i]);
              if (translations[listItem]) {
                newList.push(translations[listItem]);
                changedValidation = true;
              } else {
                newList.push(list[i]);
              }
            }
          }

          if (changedValidation) {
            newValidations[r][c] = validation.copy().requireValueInList(newList, showDropdown).build();
            hasChanged = true; // Make sure we write it back even if cell values didn't change
          } else {
            newValidations[r][c] = validation;
          }
        } else {
          newValidations[r][c] = validation;
        }

        // Translate cell value
        if (formula || typeof val !== 'string' || val.trim() === '') continue;

        if (translations[val]) {
          values[r][c] = translations[val];
          hasChanged = true;
        }
      }
    }

    if (hasChanged) {
      // Clear data validation temporarily to avoid errors on strict ranges
      range.clearDataValidations();

      try {
        range.setValues(values);
      } catch (e) {
        Logger.log("Batch write failed (locked or protected cells): " + e.toString() + ". Falling back to cell-by-cell write...");
        var startRow = range.getRow();
        var startCol = range.getColumn();
        var currentValues = range.getValues();
        for (var r = 0; r < values.length; r++) {
          for (var c = 0; c < values[r].length; c++) {
            if (values[r][c] !== currentValues[r][c]) {
              try {
                currentSheet.getRange(startRow + r, startCol + c).setValue(values[r][c]);
              } catch (cellErr) {
                Logger.log("Skipping cell (" + (startRow + r) + "," + (startCol + c) + ") due to: " + cellErr.toString());
              }
            }
          }
        }
      }

      // Re-apply the potentially translated data validations
      range.setDataValidations(newValidations);
    }
  }
}

/**
 * Translates paragraphs and list items in a Google Doc.
 */
function translateDoc(documentId, sourceLang, targetLang) {
  var doc = DocumentApp.openById(documentId);
  var body = doc.getBody();

  // Step 1: Recursively collect paragraph elements (handles body and cells)
  var paragraphs = [];
  collectParagraphs(body, paragraphs);

  // Step 2: Collect unique source text segments
  var uniqueJaTexts = [];
  var jaMap = {};

  for (var i = 0; i < paragraphs.length; i++) {
    var text = paragraphs[i].getText();
    if (text.trim() === '') continue;

    if (shouldTranslate(text, sourceLang) && !jaMap[text]) {
      jaMap[text] = true;
      uniqueJaTexts.push(text);
    }
  }

  if (uniqueJaTexts.length === 0) return;

  // Step 3: Batch translate
  var translations = batchTranslate(uniqueJaTexts, sourceLang, targetLang);

  // Step 4: Write back translated text into document paragraphs
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i];
    var original = p.getText();
    if (translations[original]) {
      p.setText(translations[original]);
    }
  }
}

/**
 * Recursively traverses elements to gather paragraphs and list items.
 */
function collectParagraphs(element, list) {
  var type = element.getType();
  if (type === DocumentApp.ElementType.PARAGRAPH ||
    type === DocumentApp.ElementType.LIST_ITEM) {
    list.push(element);
  } else {
    var numChildren = element.getNumChildren ? element.getNumChildren() : 0;
    for (var i = 0; i < numChildren; i++) {
      collectParagraphs(element.getChild(i), list);
    }
  }
}

/**
 * Finds a Sheet within a Spreadsheet by its GID.
 */
function getSheetByGid(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId().toString() === gid.toString()) {
      return sheets[i];
    }
  }
  return null;
}



/**
 * Translates text elements in a Google Slide presentation.
 */
function translateSlide(presentationId, sourceLang, targetLang) {
  var presentation = SlidesApp.openById(presentationId);
  var slides = presentation.getSlides();

  // Collect all text shapes and table cells
  var textElements = [];

  for (var i = 0; i < slides.length; i++) {
    var elements = slides[i].getPageElements();
    for (var j = 0; j < elements.length; j++) {
      var element = elements[j];
      var type = element.getPageElementType();
      if (type === SlidesApp.PageElementType.SHAPE) {
        var shape = element.asShape();
        if (shape.getText()) {
          textElements.push(shape.getText());
        }
      } else if (type === SlidesApp.PageElementType.TABLE) {
        var table = element.asTable();
        for (var r = 0; r < table.getNumRows(); r++) {
          for (var c = 0; c < table.getNumColumns(); c++) {
            var cell = table.getCell(r, c);
            if (cell.getText()) {
              textElements.push(cell.getText());
            }
          }
        }
      }
    }
  }

  var uniqueJaTexts = [];
  var jaMap = {};

  for (var i = 0; i < textElements.length; i++) {
    var textRange = textElements[i];
    var text = textRange.asString();
    if (text.trim() === '') continue;

    if (shouldTranslate(text, sourceLang) && !jaMap[text]) {
      jaMap[text] = true;
      uniqueJaTexts.push(text);
    }
  }

  if (uniqueJaTexts.length === 0) return;

  // Batch translate
  var translations = batchTranslate(uniqueJaTexts, sourceLang, targetLang);

  // Write back translated text
  for (var i = 0; i < textElements.length; i++) {
    var textRange = textElements[i];
    var original = textRange.asString();

    if (translations[original]) {
      textRange.setText(translations[original]);
    }
  }
}
