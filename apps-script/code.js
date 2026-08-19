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
 * Đã tinh chỉnh: Tách dòng để tránh lỗi mất chữ của API, NHƯNG KHÔNG bóc tách dấu thủ công.
 */
function batchTranslate(texts, sourceLang, targetLang) {
  if (texts.length === 0) return {};

  var translations = {};
  var chunks = [];
  var currentChunk = [];
  var currentLength = 0;

  var processedTexts = [];
  var keys = Object.keys(GLOSSARY);
  var urlRegex = /(?:https?:\/\/|www\.)[^\s"'<>]+/gi;

  // Bước 1: Tách từng dòng để dịch an toàn (tránh API tự ý cắt bớt list), 
  // nhưng để nguyên toàn bộ dấu câu thủ công cho API tự dịch.
  for (var i = 0; i < texts.length; i++) {
    var text = texts[i];
    var lines = text.split(/\r?\n/);
    var processedLines = [];
    var lineContexts = [];

    for (var l = 0; l < lines.length; l++) {
      var line = lines[l];
      var processed = line;
      var context = { placeholders: {} };
      var placeholderCounter = 0;

      // 1. Bảo vệ URLs
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

      // 2. Bảo vệ thuật ngữ GLOSSARY
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

  // Bước 2: Gom nhóm (Batch) các dòng lại với nhau
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

    // Bỏ qua các dòng trống hoàn toàn để tối ưu API
    if (lineText.trim() === "") {
      currentChunk.push({ originalIndex: i, text: "___EMPTY___" });
      continue;
    }

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

  // Bước 3: Thực hiện dịch API
  var translatedFlatLines = new Array(flatLinesToTranslate.length);

  for (var c = 0; c < chunks.length; c++) {
    var chunk = chunks[c];
    if (chunk.length === 0) continue;

    // Chỉ dịch các dòng thực sự có chữ
    var translateItems = chunk.filter(function (item) { return item.text !== "___EMPTY___"; });
    var DELIMITER = "\n\n[###]\n\n";
    var combinedText = translateItems.map(function (item) { return item.text; }).join(DELIMITER);

    var translatedArray = [];
    try {
      if (translateItems.length > 0) {
        var translatedText = LanguageApp.translate(combinedText, sourceLang, targetLang);
        var splitRegex = /[ \t]*\r?\n\r?\n\[\s*#\s*#\s*#\s*\]\r?\n\r?\n[ \t]*/;
        translatedArray = translatedText.split(splitRegex);

        if (translatedArray.length !== translateItems.length) {
          var fallbackSplitRegex = /\s*\[\s*#\s*#\s*#\s*\]\s*/;
          translatedArray = translatedText.split(fallbackSplitRegex);
        }
      }
    } catch (e) {
      Logger.log("Batch translation failed: " + e.toString());
      for (var i = 0; i < translateItems.length; i++) {
        try {
          translatedArray.push(LanguageApp.translate(translateItems[i].text, sourceLang, targetLang));
        } catch (err) {
          translatedArray.push(translateItems[i].text);
        }
      }
    }

    // Gắn kết quả về đúng thứ tự ban đầu
    var tIndex = 0;
    for (var i = 0; i < chunk.length; i++) {
      var idx = chunk[i].originalIndex;
      if (chunk[i].text === "___EMPTY___") {
        translatedFlatLines[idx] = "";
      } else {
        translatedFlatLines[idx] = (translatedArray[tIndex] !== undefined) ? translatedArray[tIndex] : chunk[i].text;
        tIndex++;
      }
    }
  }

  // Bước 4: Khôi phục văn bản về từng ô
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

    // 1. Trả lại các placeholder URL/GLOSSARY
    for (var placeholder in context.placeholders) {
      var cleanPattern = placeholder.replace(/_/g, '[_\\s]*');
      var pRegex = new RegExp('\\s*' + cleanPattern + '\\s*', "gi");
      translatedLine = translatedLine.replace(pRegex, ' ' + context.placeholders[placeholder] + ' ');
    }

    // 2. Dọn dẹp khoảng trắng thừa
    translatedLine = translatedLine.replace(/[ \t]{2,}/g, ' ');
    translatedLine = translatedLine.replace(/\s+([.,!?:;%\]\)>”}])/g, '$1');
    translatedLine = translatedLine.replace(/([\[\(<“{])\s+/g, '$1');

    // Loại bỏ khoảng trắng ở cuối dòng, giữ lại khoảng cách thụt lề ở đầu dòng nếu có
    translatedLine = translatedLine.replace(/\s+$/, '');

    translatedDocLines[docIdx].push(translatedLine);
  }

  // 3. Lắp ráp các dòng lại thành khối văn bản ban đầu
  for (var p = 0; p < processedTexts.length; p++) {
    var origText = processedTexts[p].originalText;
    var finalLines = translatedDocLines[p] || [];

    translations[origText] = finalLines.join('\n');
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
 * Translates a Google Sheet's cell values while preserving text colors, strikethroughs, and styles.
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

    // Step 1: Collect unique text runs to preserve inline styles (Colors, Strikethrough, etc.)
    var uniqueJaTexts = [];
    var jaMap = {};

    var sheetName = currentSheet.getName();
    if (shouldTranslate(sheetName, sourceLang) && !jaMap[sheetName]) {
      jaMap[sheetName] = true;
      uniqueJaTexts.push(sheetName);
    }

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
        var richText = richTextValues ? richTextValues[r][c] : null;

        if (formula && formula.toUpperCase().indexOf('=HYPERLINK') === 0) {
          var parsedLink = parseHyperlinkFormula(formula);
          if (parsedLink && parsedLink.label && shouldTranslate(parsedLink.label, sourceLang) && !jaMap[parsedLink.label]) {
            jaMap[parsedLink.label] = true;
            uniqueJaTexts.push(parsedLink.label);
          }
        }

        if (!formula && richText) {
          var runs = richText.getRuns();
          for (var u = 0; u < runs.length; u++) {
            var runText = runs[u].getText();
            if (shouldTranslate(runText, sourceLang) && !jaMap[runText]) {
              jaMap[runText] = true;
              uniqueJaTexts.push(runText);
            }
          }
        } else if (!formula && typeof val === 'string' && val.trim() !== '') {
          if (shouldTranslate(val, sourceLang) && !jaMap[val]) {
            jaMap[val] = true;
            uniqueJaTexts.push(val);
          }
        }
      }
    }

    if (uniqueJaTexts.length === 0) continue;

    // Step 2: Batch translate
    var translations = batchTranslate(uniqueJaTexts, sourceLang, targetLang);

    // Step 3: Update Sheet & Spreadsheet names
    if (translations[sheetName]) {
      try { currentSheet.setName(translations[sheetName]); } catch (e) { }
    }
    if (s === 0 && ssName && translations[ssName]) {
      try { ss.rename(translations[ssName]); } catch (e) { }
    }

    // Step 4: Write back translated values with exact RichText style preservation
    var hasChanged = false;
    var hasFormulaChange = false;
    var newRichTextValues = [];

    for (var r = 0; r < values.length; r++) {
      newRichTextValues.push([]);
      for (var c = 0; c < values[r].length; c++) {
        var val = values[r][c];
        var formula = formulas[r][c];
        var richText = richTextValues ? richTextValues[r][c] : null;

        // Handle HYPERLINK formula
        if (formula && formula.toUpperCase().indexOf('=HYPERLINK') === 0) {
          var parsedLink = parseHyperlinkFormula(formula);
          if (parsedLink && parsedLink.label && translations[parsedLink.label]) {
            formulas[r][c] = rebuildHyperlinkFormula(formula, parsedLink.label, translations[parsedLink.label]);
            hasFormulaChange = true;
            hasChanged = true;
          }
          newRichTextValues[r][c] = richText;
          continue;
        }

        if (formula || !richText) {
          newRichTextValues[r][c] = richText;
          continue;
        }

        // Reconstruct RichText with original styles (Color, Strikethrough, Bold, Italic, Links)
        var runs = richText.getRuns();
        if (runs.length > 0) {
          var builder = SpreadsheetApp.newRichTextValue();
          var fullTranslatedText = "";
          var runSpecs = [];

          for (var u = 0; u < runs.length; u++) {
            var run = runs[u];
            var rawRunText = run.getText();
            var translatedRunText = translations[rawRunText] || rawRunText;

            var startIndex = fullTranslatedText.length;
            fullTranslatedText += translatedRunText;
            var endIndex = fullTranslatedText.length;

            runSpecs.push({
              start: startIndex,
              end: endIndex,
              style: run.getTextStyle(),
              linkUrl: run.getLinkUrl()
            });
          }

          builder.setText(fullTranslatedText);

          // Apply saved style specs back to the translated text range
          for (var k = 0; k < runSpecs.length; k++) {
            var spec = runSpecs[k];
            if (spec.start < spec.end) {
              builder.setTextStyle(spec.start, spec.end, spec.style);
              if (spec.linkUrl) {
                builder.setLinkUrl(spec.start, spec.end, spec.linkUrl);
              }
            }
          }

          newRichTextValues[r][c] = builder.build();
          hasChanged = true;
        } else {
          newRichTextValues[r][c] = richText;
        }
      }
    }

    if (hasChanged) {
      try {
        if (hasFormulaChange) {
          range.setFormulas(formulas);
        }
        range.setRichTextValues(newRichTextValues);
      } catch (e) {
        var startRow = range.getRow();
        var startCol = range.getColumn();
        for (var r = 0; r < values.length; r++) {
          for (var c = 0; c < values[r].length; c++) {
            var cellRange = currentSheet.getRange(startRow + r, startCol + c);
            try {
              if (newRichTextValues[r][c]) {
                cellRange.setRichTextValue(newRichTextValues[r][c]);
              }
            } catch (cellErr) { }
          }
        }
      }

      // Auto resize row height
      try {
        SpreadsheetApp.flush();
        currentSheet.autoResizeRows(range.getRow(), range.getNumRows());
      } catch (resizeErr) { }
    }
  }
}

/**
 * Translates paragraphs and table cells in a Google Doc, ensuring table rows expand naturally.
 */
function translateDoc(documentId, sourceLang, targetLang) {
  var doc = DocumentApp.openById(documentId);
  var body = doc.getBody();

  // Step 1: Collect paragraphs
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

  // Step 5: Tự động bỏ chiều cao hàng cố định trong toàn bộ Bảng (Table) để hàng tự co giãn theo văn bản
  var tables = body.getTables();
  for (var t = 0; t < tables.length; t++) {
    var table = tables[t];
    for (var r = 0; r < table.getNumRows(); r++) {
      var row = table.getRow(r);
      try {
        // Đặt MinimumRowHeight về 0 để hàng tự điều chỉnh chiều cao vừa khít nội dung
        row.setMinimumRowHeight(0);
      } catch (e) { }
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
