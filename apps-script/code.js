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
  try { SpreadsheetApp.openById("1234567890"); } catch(e) {}
  try { DocumentApp.openById("1234567890"); } catch(e) {}
  try { SlidesApp.openById("1234567890"); } catch(e) {}
  LanguageApp.translate("Hello", "en", "vi");
  Logger.log("Authorization successful!");
}

// REGEX for Japanese characters: Hiragana, Katakana, and Kanji
var JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
// REGEX for Latin characters including Vietnamese diacritics
var LATIN_VIETNAMESE_REGEX = /[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action; // "translate_sheet", "translate_doc", "set_key", or "check_connection"
    var id = params.id;
    var sourceLang = params.sourceLang || "ja";
    var targetLang = params.targetLang || "vi";
    var apiKey = params.apiKey;
    
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
      if (!savedKey || params.forceUpdate) {
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
          message: "Security Token is already set. Use forceUpdate to overwrite."
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
  var delimiter = "\n[X_TRANS_X]\n";
  var splitRegex = /\s*\[\s*X_TRANS_X\s*\]\s*/i;
  var currentBatch = [];
  var currentLength = 0;
  var maxLength = 1800; // Limit payload length to prevent translation API errors
  
  function processBatch(batch) {
    if (batch.length === 0) return;
    var mergedText = batch.join(delimiter);
    try {
      var translatedMerged = LanguageApp.translate(mergedText, sourceLang, targetLang);
      var translatedParts = translatedMerged.split(splitRegex);
      
      // Safety check: if Google Translate lost or added delimiters, force fallback to individual
      if (translatedParts.length !== batch.length) {
        throw new Error("Split length mismatch: expected " + batch.length + " but got " + translatedParts.length);
      }
      
      for (var i = 0; i < batch.length; i++) {
        var original = batch[i];
        var translated = translatedParts[i] ? translatedParts[i].trim() : original;
        translations[original] = translated;
      }
    } catch (e) {
      Logger.log("Batch translation failed or split mismatched: " + e.message + ". Falling back to individual translation...");
      // Fallback: Translate individually if batch fails or fails verification
      for (var i = 0; i < batch.length; i++) {
        var original = batch[i];
        try {
          translations[original] = LanguageApp.translate(original, sourceLang, targetLang);
        } catch (err) {
          translations[original] = original;
        }
      }
    }
  }
  
  for (var i = 0; i < texts.length; i++) {
    var text = texts[i];
    if (currentLength + text.length + delimiter.length > maxLength) {
      processBatch(currentBatch);
      currentBatch = [];
      currentLength = 0;
    }
    currentBatch.push(text);
    currentLength += text.length + delimiter.length;
  }
  
  processBatch(currentBatch);
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
