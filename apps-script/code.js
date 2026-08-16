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
 * Fixed: Prevents unwanted spaces inside numbers (e.g. "3 66" -> "366") and cleans up boundary spacing.
 */
function batchTranslate(texts, sourceLang, targetLang) {
  if (texts.length === 0) return {};

  var translations = {};
  var chunks = [];
  var currentChunk = [];
  var currentLength = 0;

  var processedTexts = [];
  var glossaryContexts = [];
  var keys = Object.keys(GLOSSARY);

  var urlRegex = /(?:https?:\/\/|www\.)[^\s"'<>]+/gi;
  var keywordRegex = /\b(?:[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)+|[a-z]+[A-Z][a-zA-Z0-9]*|[A-Z]{2,}[a-z]+[a-zA-Z0-9]*)\b/g;

  // Step 1: Pre-process texts into line structures
  for (var i = 0; i < texts.length; i++) {
    var text = texts[i];
    var lines = text.split(/\r?\n/);
    var processedLines = [];
    var lineContexts = [];

    for (var l = 0; l < lines.length; l++) {
      var line = lines[l];
      var prefixSymbol = "";

      // Extract leading symbols (※, ・, 【, ◆, etc.)
      var symMatch = line.match(/^([ \t]*[※・【】◆◇■□▲△●○-]+\s*)/);
      if (symMatch) {
        prefixSymbol = symMatch[1];
        line = line.substring(prefixSymbol.length);
      }

      var processed = line;
      var context = { prefixSymbol: prefixSymbol, placeholders: {} };
      var placeholderCounter = 0;

      // Protect URLs
      var urlMatch;
      var foundUrls = [];
      while ((urlMatch = urlRegex.exec(line)) !== null) {
        if (foundUrls.indexOf(urlMatch[0]) === -1) {
          foundUrls.push(urlMatch[0]);
        }
      }
      for (var u = 0; u < foundUrls.length; u++) {
        var urlStr = foundUrls[u];
        var placeholder = "___URL" + placeholderCounter + "___";
        placeholderCounter++;
        var regex = new RegExp(urlStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processed = processed.replace(regex, placeholder);
        context.placeholders[placeholder] = urlStr;
      }

      // Protect Technical Keywords
      var match;
      var foundKeywords = [];
      while ((match = keywordRegex.exec(line)) !== null) {
        if (foundKeywords.indexOf(match[0]) === -1) {
          foundKeywords.push(match[0]);
        }
      }
      for (var j = 0; j < foundKeywords.length; j++) {
        var keyword = foundKeywords[j];
        var placeholder = "___KW" + placeholderCounter + "___";
        placeholderCounter++;
        var regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processed = processed.replace(regex, placeholder);
        context.placeholders[placeholder] = keyword;
      }

      // Protect GLOSSARY terms
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (processed.indexOf(key) !== -1) {
          var placeholder = "___GLS" + placeholderCounter + "___";
          placeholderCounter++;
          var regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          processed = processed.replace(regex, placeholder);
          context.placeholders[placeholder] = GLOSSARY[key];
        }
      }

      processedLines.push(processed);
      lineContexts.push(context);
    }

    processedTexts.push({
      originalText: text,
      lines: processedLines,
      contexts: lineContexts
    });
  }

  // Step 2: Build translation chunks
  var flatLinesToTranslate = [];
  var lineMapping = [];

  for (var p = 0; p < processedTexts.length; p++) {
    var item = processedTexts[p];
    for (var l = 0; l < item.lines.length; l++) {
      flatLinesToTranslate.push(item.lines[l]);
      lineMapping.push({ docIndex: p, lineIndex: l });
    }
  }

  for (var i = 0; i < flatLinesToTranslate.length; i++) {
    var lineText = flatLinesToTranslate[i];
    if (currentLength + lineText.length > 2000 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push({ originalIndex: i, text: lineText });
    currentLength += lineText.length + 12;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Step 3: Perform translation
  var translatedFlatLines = new Array(flatLinesToTranslate.length);

  for (var c = 0; c < chunks.length; c++) {
    var chunk = chunks[c];
    if (chunk.length === 0) continue;
    var DELIMITER = "\n\n[###]\n\n";
    var combinedText = chunk.map(function (item) { return item.text; }).join(DELIMITER);

    try {
      var translatedText = LanguageApp.translate(combinedText, sourceLang, targetLang);

      var splitRegex = /[ \t]*\r?\n\r?\n\[\s*#\s*#\s*#\s*\]\r?\n\r?\n[ \t]*/;
      var translatedArray = translatedText.split(splitRegex);

      if (translatedArray.length !== chunk.length) {
        var fallbackSplitRegex = /\s*\[\s*#\s*#\s*#\s*\]\s*/;
        translatedArray = translatedText.split(fallbackSplitRegex);
      }

      for (var i = 0; i < chunk.length; i++) {
        var idx = chunk[i].originalIndex;
        translatedFlatLines[idx] = (translatedArray[i] !== undefined) ? translatedArray[i] : chunk[i].text;
      }
    } catch (e) {
      Logger.log("Batch line translation failed: " + e.toString());
      for (var i = 0; i < chunk.length; i++) {
        var idx = chunk[i].originalIndex;
        try {
          translatedFlatLines[idx] = LanguageApp.translate(chunk[i].text, sourceLang, targetLang);
        } catch (err) {
          translatedFlatLines[idx] = chunk[i].text;
        }
      }
    }
  }

  // Step 4: Reconstruct full texts
  var translatedDocLines = {};

  for (var i = 0; i < lineMapping.length; i++) {
    var map = lineMapping[i];
    var docIdx = map.docIndex;
    var lineIdx = map.lineIndex;

    if (!translatedDocLines[docIdx]) {
      translatedDocLines[docIdx] = [];
    }

    var translatedLine = translatedFlatLines[i] || "";
    var context = processedTexts[docIdx].contexts[lineIdx];

    // Restore placeholders
    for (var placeholder in context.placeholders) {
      var cleanPattern = placeholder.replace(/_/g, '[_\\s]*');
      var pRegex = new RegExp(cleanPattern, "gi");
      translatedLine = translatedLine.replace(pRegex, " " + context.placeholders[placeholder] + " ");
    }

    // Fix separated digits (e.g., "3 66" -> "366")
    while (/\b(\d+)\s+(\d+)\b/.test(translatedLine)) {
      translatedLine = translatedLine.replace(/\b(\d+)\s+(\d+)\b/g, '$1$2');
    }

    // Ensure space between Vietnamese letters and Latin words / Digits
    translatedLine = translatedLine.replace(/([àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđA-Za-z])([0-9]+)/g, '$1 $2');
    translatedLine = translatedLine.replace(/([0-9]+)([àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđA-Za-z])/g, '$1 $2');

    // Clean up redundant spaces
    translatedLine = translatedLine.replace(/[ \t]{2,}/g, ' ').trim();

    // Re-attach symbol prefix
    if (context.prefixSymbol) {
      translatedLine = context.prefixSymbol + translatedLine;
    }

    translatedDocLines[docIdx].push(translatedLine);
  }

  // Step 5: Final output assembly
  for (var p = 0; p < processedTexts.length; p++) {
    var origText = processedTexts[p].originalText;
    var finalLines = translatedDocLines[p] || [];
    var resultText = finalLines.join('\n');

    if (!/^[\r\n]/.test(origText)) {
      resultText = resultText.replace(/^[\r\n]+/, '');
    }
    if (!/[\r\n]$/.test(origText)) {
      resultText = resultText.replace(/[\r\n]+$/, '');
    }

    translations[origText] = resultText;
  }

  return translations;
}

/**
 * Parses a =HYPERLINK formula to extract the display label string if present.
 */
function parseHyperlinkFormula(formula) {
  if (!formula || typeof formula !== 'string') return null;
  var regex = /^=HYPERLINK\s*\(\s*("[^"]*"|'[^']*'|[^,;]+)\s*[,;]\s*("[^"]*"|'[^']*'|[^)]+)\s*\)$/i;
  var match = formula.match(regex);
  if (!match) return null;

  var arg1 = match[1].trim();
  var arg2 = match[2].trim();

  var label = null;
  if ((arg2.startsWith('"') && arg2.endsWith('"')) || (arg2.startsWith("'") && arg2.endsWith("'"))) {
    label = arg2.substring(1, arg2.length - 1);
  }

  return { arg1: arg1, arg2: arg2, label: label };
}

/**
 * Rebuilds a =HYPERLINK formula replacing old display label with translated label.
 */
function rebuildHyperlinkFormula(formula, oldLabel, newLabel) {
  var parsed = parseHyperlinkFormula(formula);
  if (!parsed || !parsed.label) return formula;

  var oldLiteral = '"' + oldLabel + '"';
  var newLiteral = '"' + newLabel + '"';
  if (formula.indexOf(oldLiteral) !== -1) {
    return formula.replace(oldLiteral, newLiteral);
  }

  oldLiteral = "'" + oldLabel + "'";
  newLiteral = "'" + newLabel + "'";
  if (formula.indexOf(oldLiteral) !== -1) {
    return formula.replace(oldLiteral, newLiteral);
  }

  return formula;
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
    var richTextValues = range.getRichTextValues();

    // Step 1: Collect unique source text (from cells, formulas, validations, and names)
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

        // Check for =HYPERLINK formula label
        if (formula && formula.toUpperCase().indexOf('=HYPERLINK') === 0) {
          var parsedLink = parseHyperlinkFormula(formula);
          if (parsedLink && parsedLink.label && shouldTranslate(parsedLink.label, sourceLang) && !jaMap[parsedLink.label]) {
            jaMap[parsedLink.label] = true;
            uniqueJaTexts.push(parsedLink.label);
          }
        }

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

    // Step 4: Write back translated values, formulas, richText, and update validations
    var hasChanged = false;
    var hasFormulaChange = false;
    var hasRichTextChange = false;

    var newValidations = [];
    var newRichTextValues = [];

    for (var r = 0; r < values.length; r++) {
      newValidations.push([]);
      newRichTextValues.push([]);
      for (var c = 0; c < values[r].length; c++) {
        var val = values[r][c];
        var formula = formulas[r][c];
        var validation = validations[r] ? validations[r][c] : null;
        var richText = richTextValues ? richTextValues[r][c] : null;

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
            hasChanged = true;
          } else {
            newValidations[r][c] = validation;
          }
        } else {
          newValidations[r][c] = validation;
        }

        // Translate =HYPERLINK formula labels
        if (formula && formula.toUpperCase().indexOf('=HYPERLINK') === 0) {
          var parsedLink = parseHyperlinkFormula(formula);
          if (parsedLink && parsedLink.label && translations[parsedLink.label]) {
            var updatedFormula = rebuildHyperlinkFormula(formula, parsedLink.label, translations[parsedLink.label]);
            formulas[r][c] = updatedFormula;
            hasFormulaChange = true;
            hasChanged = true;
          }
          newRichTextValues[r][c] = richText;
          continue;
        }

        if (formula || typeof val !== 'string' || val.trim() === '') {
          newRichTextValues[r][c] = richText;
          continue;
        }

        if (translations[val]) {
          values[r][c] = translations[val];
          hasChanged = true;

          // Preserve cell-level / run-level hyperlinks via RichTextValue
          var linkUrl = richText ? richText.getLinkUrl() : null;
          if (!linkUrl && richText && richText.getRuns) {
            var runs = richText.getRuns();
            for (var u = 0; u < runs.length; u++) {
              if (runs[u].getLinkUrl()) {
                linkUrl = runs[u].getLinkUrl();
                break;
              }
            }
          }

          if (linkUrl) {
            newRichTextValues[r][c] = SpreadsheetApp.newRichTextValue()
              .setText(translations[val])
              .setLinkUrl(linkUrl)
              .build();
            hasRichTextChange = true;
          } else {
            newRichTextValues[r][c] = richText;
          }
        } else {
          newRichTextValues[r][c] = richText;
        }
      }
    }

    if (hasChanged) {
      // Clear data validation temporarily to avoid errors on strict ranges
      range.clearDataValidations();

      try {
        if (hasFormulaChange) {
          range.setFormulas(formulas);
        }
        if (hasRichTextChange) {
          range.setRichTextValues(newRichTextValues);
        }
        range.setValues(values);
      } catch (e) {
        Logger.log("Batch write failed (locked or protected cells): " + e.toString() + ". Falling back to cell-by-cell write...");
        var startRow = range.getRow();
        var startCol = range.getColumn();
        for (var r = 0; r < values.length; r++) {
          for (var c = 0; c < values[r].length; c++) {
            var cellRange = currentSheet.getRange(startRow + r, startCol + c);
            if (hasFormulaChange && formulas[r][c]) {
              try { cellRange.setFormula(formulas[r][c]); } catch (cellErr) { }
            }
            if (hasRichTextChange && newRichTextValues[r][c]) {
              try { cellRange.setRichTextValue(newRichTextValues[r][c]); } catch (cellErr) { }
            } else {
              try { cellRange.setValue(values[r][c]); } catch (cellErr) { }
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
