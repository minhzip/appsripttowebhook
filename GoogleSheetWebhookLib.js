/**
 * @fileoverview GoogleSheetWebhookLib: Thư viện tái sử dụng cho các hoạt động webhook Google Sheets.
 * Chứa các hàm cốt lõi để định dạng và gửi dữ liệu.
 */

/**
 * Định dạng dữ liệu từ Google Sheet để gửi qua webhook.
 * Dữ liệu được chuyển đổi thành một đối tượng JSON.
 * Sẽ bao gồm một trường '_meta' chứa Spreadsheet ID, Sheet Name và Spreadsheet URL trong payload.
 *
 * @param {GoogleAppsScript.Events.Sheets.FormSubmit} e Đối tượng sự kiện khi form được submit.
 * @returns {Object} Đối tượng JSON đã được định dạng, bao gồm trường '_meta'.
 */
function formatDataFromEvent(e) {
  const rowData = e.namedValues; // Dữ liệu được trả về dưới dạng đối tượng có tên cột là khóa.
  const headers = e.range.getSheet().getRange(1, 1, 1, e.range.getLastColumn()).getValues()[0];

  const formatted = {};
  for (const header of headers) {
    if (rowData[header] !== undefined && rowData[header][0] !== undefined) {
      // rowData trả về mảng 1 phần tử, lấy giá trị đầu tiên
      formatted[header] = rowData[header][0];
    }
  }

  // --- THÊM TRƯỜNG '_meta' VỚI THÔNG TIN SPREADSHEET VÀ SHEET VÀO PAYLOAD ---
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  formatted['_meta'] = {
    spreadsheet_id: spreadsheet.getId(),
    sheet_name: e.range.getSheet().getName(),
    sheet_id: sheet.getSheetId(),
    spreadsheet_url: spreadsheet.getUrl() // Lấy URL của toàn bộ Spreadsheet
  };
  // --- KẾT THÚC THÊM TRƯỜNG ---

  // Log để dễ dàng debug
  Logger.log("Dữ liệu đã định dạng: " + JSON.stringify(formatted));
  return formatted;
}

/**
 * Gửi dữ liệu đến URL webhook đã cung cấp.
 *
 * @param {string} url URL webhook.
 * @param {Object} data Đối tượng dữ liệu cần gửi.
 * @returns {boolean} True nếu gửi thành công, false nếu có lỗi.
 */
function sendDataToWebhook(url, data) {
  if (!url) {
    Logger.log("Lỗi: URL webhook không được cung cấp.");
    return false;
  }
  if (!data) {
    Logger.log("Lỗi: Dữ liệu gửi đi trống.");
    return false;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log("Webhook Response Code: " + response.getResponseCode());
    Logger.log("Webhook Response Body: " + response.getContentText());
    return response.getResponseCode() >= 200 && response.getResponseCode() < 300;
  } catch (e) {
    Logger.log("Lỗi khi gửi webhook: " + e.message);
    return false;
  }
}

/**
 * Hàm chính để xử lý sự kiện form submit.
 * Hàm này sẽ được gọi từ script con trong từng Google Sheet.
 * NHẬN WEBHOOK_URL LÀ MỘT ĐỐI SỐ.
 *
 * @param {GoogleAppsScript.Events.Sheets.FormSubmit} e Đối tượng sự kiện khi form được submit.
 * @param {string} webhookUrl URL webhook đích.
 */
function processFormSubmission(e, webhookUrl) {
  const sheet = e.range.getSheet();

  if (!webhookUrl) {
    Logger.log(`Webhook URL chưa được cung cấp cho sheet "${sheet.getName()}". Vui lòng cấu hình URL.`);
    return;
  }

  const formattedData = formatDataFromEvent(e); // Hàm này giờ đã bao gồm trường '_meta'

  const success = sendDataToWebhook(webhookUrl, formattedData); // Không cần truyền thêm ID/Name/URL nữa

  if (success) {
    Logger.log(`Dữ liệu từ sheet "${sheet.getName()}" đã được gửi thành công đến webhook: ${webhookUrl}`);
  } else {
    Logger.log(`Gửi dữ liệu từ sheet "${sheet.getName()}" đến webhook thất bại. Vui lòng kiểm tra log.`);
  }
}

/**
 * Hàm tiện ích để kiểm tra cấu hình webhook và gửi một payload test.
 * Hàm này sẽ được gọi từ script con trong từng Google Sheet và cần webhookUrl.
 *
 * @param {string} webhookUrl URL webhook đích.
 * @param {GoogleAppsScript.Ui.Ui} ui Đối tượng UI của SpreadsheetApp.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Đối tượng Sheet hiện tại.
 */
function testWebhookConfiguration(webhookUrl, ui, sheet) {
  if (!webhookUrl) {
    ui.alert('Cấu hình Webhook', 'Webhook URL chưa được cấu hình cho Sheet này. Vui lòng đặt URL trước.', ui.ButtonSet.OK);
    return;
  }

  const lastRow = sheet.getLastRow();
  let testData = {};

  if (lastRow > 1) {
    try {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const lastRowValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];

      headers.forEach((header, index) => {
        if (lastRowValues[index] !== undefined && lastRowValues[index] !== null) {
          testData[header] = lastRowValues[index];
        }
      });
    } catch (e) {
      Logger.log("Không thể lấy dữ liệu hàng cuối cùng làm test data: " + e.message);
    }
  }
  // Luôn thêm is_test_data cho payload test
  testData['is_test_data'] = true;
  if (Object.keys(testData).length === 1) { // Nếu chỉ có is_test_data (tức là không lấy được dữ liệu từ sheet)
      testData["TestField1"] = "TestValue1";
      testData["TestField2"] = "TestValue2";
      testData["Timestamp"] = new Date().toLocaleString();
  }
  Logger.log("Sử dụng dữ liệu test: " + JSON.stringify(testData));

  // --- THÊM TRƯỜNG '_meta' VỚI THÔNG TIN SPREADSHEET VÀ SHEET VÀO PAYLOAD TEST ---
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  testData['_meta'] = {
    spreadsheet_id: spreadsheet.getId(),
    sheet_name: sheet.getName(),
    spreadsheet_url: spreadsheet.getUrl(),
    sheet_id: sheet.getSheetId(),
    is_test_meta: true // Có thể thêm trường này để phân biệt meta data của test
  };
  // --- KẾT THÚC THÊM TRƯỜNG ---

  const response = ui.alert(
    'Kiểm tra Webhook',
    `Webhook URL hiện tại: ${webhookUrl}\n\nBạn có muốn gửi một payload test đến URL này không?` +
    `\n(Thông tin sẽ được gửi trong trường '_meta')`, // Cập nhật thông báo
    ui.ButtonSet.YES_NO
  );

  if (response == ui.Button.YES) {
    const success = sendDataToWebhook(webhookUrl, testData); // Không cần truyền thêm ID/Name/URL nữa
    if (success) {
      ui.alert('Kiểm tra Webhook', 'Đã gửi payload test thành công!', ui.ButtonSet.OK);
    } else {
      ui.alert('Kiểm tra Webhook', 'Gửi payload test thất bại. Vui lòng kiểm tra log để biết chi tiết.', ui.ButtonSet.OK);
    }
  } else {
    ui.alert('Kiểm tra Webhook', 'Đã hủy gửi test.', ui.ButtonSet.OK);
  }
}
