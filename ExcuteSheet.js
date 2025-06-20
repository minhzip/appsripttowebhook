/**
 * @fileoverview Script cấu hình và triển khai cho Google Sheet này (chứa nhiều tab/bảng con).
 * Quản lý Webhook URL cho từng tab thông qua một biến cấu hình trực tiếp.
 */

// Đảm bảo bạn đã thêm thư viện GoogleSheetWebhookLib vào dự án này với Identifier là `WebhookLib`!

// --- BIẾN CẤU HÌNH WEBHOOK CỦA BẠN ---
// Thay đổi các URL này để phù hợp với các tab của bạn.
// Khóa (key) phải khớp CHÍNH XÁC với tên của tab (sheet con) trong Google Sheet của bạn.
const SHEET_WEBHOOK_CONFIG = {
  "SheetName": "URL_WEBHOOK_REPLACE",
  "SheetName": "URL_WEBHOOK_REPLACE"
};
// --- KẾT THÚC BIẾN CẤU HÌNH ---


/**
 * Hàm này được kích hoạt tự động khi Google Sheet được mở.
 * Nó tạo một menu tùy chỉnh để dễ dàng cấu hình và kiểm tra.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('✅Webhook Setup')
      .addItem('1. Xem cấu hình Webhook hiện tại', 'viewWebhookConfiguration')
      .addItem('2. Kiểm tra & Gửi Test cho Tab hiện tại', 'triggerTestWebhookForCurrentTab')
      .addSeparator()
      .addItem('3. Thiết lập Trigger (Quan trọng)', 'setupFormSubmitTrigger')
      .addToUi();
}

/**
 * Hiển thị tất cả các cấu hình webhook đã lưu từ biến config.
 */
function viewWebhookConfiguration() {
  const ui = SpreadsheetApp.getUi();
  let configMessage = "Cấu hình Webhook cho các tab (từ mã nguồn):\n\n";

  if (Object.keys(SHEET_WEBHOOK_CONFIG).length === 0) {
    configMessage += "Chưa có tab nào được cấu hình webhook trong biến SHEET_WEBHOOK_CONFIG.";
  } else {
    for (const tabName in SHEET_WEBHOOK_CONFIG) {
      if (SHEET_WEBHOOK_CONFIG.hasOwnProperty(tabName)) {
        configMessage += `- ${tabName}: ${SHEET_WEBHOOK_CONFIG[tabName]}\n`;
      }
    }
  }
  ui.alert('Cấu hình Webhook', configMessage, ui.ButtonSet.OK);
}

/**
 * Hàm này gọi hàm kiểm tra webhook từ thư viện cho tab hiện tại.
 * URL webhook được lấy trực tiếp từ biến cấu hình.
 */
function triggerTestWebhookForCurrentTab() {
  const ui = SpreadsheetApp.getUi();
  const currentSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const tabName = currentSheet.getName();

  const webhookUrl = SHEET_WEBHOOK_CONFIG[tabName]; // Lấy URL cho tab hiện tại từ biến cấu hình

  if (!webhookUrl) {
    ui.alert('Kiểm tra Webhook', `Webhook URL chưa được cấu hình cho tab "${tabName}" trong biến SHEET_WEBHOOK_CONFIG. Vui lòng chỉnh sửa mã nguồn.`, ui.ButtonSet.OK);
    return;
  }

  // Gọi hàm kiểm tra của thư viện, truyền URL và các đối tượng cần thiết
  WebhookLib.testWebhookConfiguration(webhookUrl, ui, currentSheet);
}

/**
 * Hàm này tạo trigger 'On form submit' cho toàn bộ spreadsheet.
 * Trigger này sẽ kích hoạt hàm onFormSubmitHandler.
 * Quan trọng: Chỉ cần chạy 1 lần cho toàn bộ Google Sheet này.
 */
function setupFormSubmitTrigger() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Xóa các trigger cũ để tránh trùng lặp cho hàm onFormSubmitHandler
  const triggers = ScriptApp.getUserTriggers(spreadsheet);
  for (const trigger of triggers) {
    if (trigger.getEventType() == ScriptApp.EventType.ON_FORM_SUBMIT && trigger.getHandlerFunction() == 'onFormSubmitHandler') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log("Đã xóa trigger 'onFormSubmitHandler' cũ.");
    }
  }

  // Tạo trigger mới
  try {
    ScriptApp.newTrigger('onFormSubmitHandler') // Tên hàm mà trigger sẽ gọi trong script này
        .forSpreadsheet(spreadsheet) // Trigger cho toàn bộ Spreadsheet
        .onFormSubmit()
        .create();
    ui.alert('Thiết lập Trigger', 'Trigger "On form submit" đã được thiết lập thành công cho toàn bộ Spreadsheet này!', ui.ButtonSet.OK);
    Logger.log("Đã tạo trigger mới cho onFormSubmitHandler.");
  } catch (e) {
    ui.alert('Lỗi khi thiết lập Trigger', 'Không thể tạo trigger. Vui lòng kiểm tra quyền hoặc thử lại. Lỗi: ' + e.message, ui.ButtonSet.OK);
    Logger.log("Lỗi khi tạo trigger: " + e.message);
  }
}

/**
 * Đây là hàm "handler" thực sự được kích hoạt bởi trigger 'On form submit'.
 * Nó xác định tab nào đã được cập nhật và gọi hàm xử lý chính trong thư viện với URL phù hợp.
 *
 * @param {GoogleAppsScript.Events.Sheets.FormSubmit} e Đối tượng sự kiện.
 */
function onFormSubmitHandler(e) {
  const updatedSheetName = e.range.getSheet().getName(); // Lấy tên của tab vừa nhận dữ liệu
  const webhookUrl = SHEET_WEBHOOK_CONFIG[updatedSheetName]; // Lấy URL tương ứng với tab đó từ biến cấu hình

  if (webhookUrl) {
    // Gọi hàm xử lý chính từ thư viện, truyền sự kiện và URL phù hợp
    WebhookLib.processFormSubmission(e, webhookUrl);
  } else {
    Logger.log(`Không tìm thấy Webhook URL đã cấu hình trong biến SHEET_WEBHOOK_CONFIG cho tab "${updatedSheetName}". Dữ liệu không được gửi.`);
    // Bạn có thể thêm cảnh báo người dùng (ví dụ: gửi email) nếu một tab không có webhook URL được cấu hình
  }
}
