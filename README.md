# Hướng dẫn Thiết lập Webhook từ Google Sheets

Dự án này cung cấp một giải pháp linh hoạt để tự động gửi dữ liệu từ Google Sheets đến các webhook URL tùy chỉnh của bạn. Đặc biệt, nó hỗ trợ việc gửi dữ liệu từ **nhiều bảng (tabs)** trong cùng một Google Sheet đến các webhook URL khác nhau.

Giải pháp bao gồm hai phần chính:
1.  **Thư viện Logic Chính (`GoogleSheetWebhookLib.js`):** Chứa các hàm cốt lõi để định dạng dữ liệu và gửi yêu cầu webhook. Đây là một thư viện tái sử dụng.
2.  **Script Triển khai (`ExcuteSheet.js`):** Được thêm vào mỗi Google Sheet cụ thể, chứa cấu hình webhook URL cho từng tab và các hàm kích hoạt.

## Cấu trúc File

* `GoogleSheetWebhookLib.js`: Thư viện Google Apps Script chứa logic xử lý chính.
* `ExcuteSheet.js`: Script Google Apps Script để triển khai trong từng Google Sheet.

---

## 1. Thiết lập Thư viện Logic Chính (`GoogleSheetWebhookLib.js`)

Đây là bước đầu tiên và chỉ cần thực hiện **một lần duy nhất**.

1.  **Tạo dự án Apps Script mới cho thư viện:**
    * Truy cập [script.google.com](https://script.google.com/).
    * Nhấp vào **`New project`** (Dự án mới).
    * Trong trình chỉnh sửa mã, bạn sẽ thấy một file `Code.gs`. Xóa toàn bộ nội dung mặc định trong `Code.gs`.
    * **Dán toàn bộ nội dung sau vào `Code.gs`:**
        ```javascript
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
        ```
    * Lưu dự án (biểu tượng đĩa hoặc `Ctrl + S`). Bạn có thể đặt tên cho dự án là `GoogleSheetWebhookLib`.

2.  **Lấy Script ID của thư viện:**
    * Trong trình chỉnh sửa Apps Script, ở bên trái, nhấp vào biểu tượng **`Project settings`** (hình bánh răng).
    * Tìm mục **`Script ID`** và sao chép ID này. Bạn sẽ cần nó ở bước sau.

3.  **Tạo phiên bản triển khai cho thư viện:**
    * Vẫn trong trình chỉnh sửa Apps Script, nhấp vào **`Deploy`** (Triển khai) ở góc trên bên phải, sau đó chọn **`New deployment`** (Triển khai mới).
    * Trong cửa sổ "New deployment", nhấp vào biểu tượng bánh răng bên cạnh "Select type" (Chọn loại) và chọn **`Library`**.
    * (Tùy chọn) Điền mô tả (ví dụ: "Initial stable version").
    * Nhấp vào **`Deploy`** (Triển khai). Điều này tạo ra một phiên bản ổn định của thư viện mà các script khác có thể sử dụng.

---

## 2. Thiết lập Script Triển khai (`ExcuteSheet.js`) trong Google Sheet của bạn

Bạn sẽ thực hiện các bước này cho **mỗi Google Sheet** mà bạn muốn gửi dữ liệu webhook. Nếu một Google Sheet có nhiều tab và bạn muốn gửi dữ liệu từ các tab đó đến các webhook khác nhau, bạn vẫn chỉ cần một script triển khai cho toàn bộ Google Sheet đó.

1.  **Mở Google Sheet của bạn:**
    * Mở Google Sheet cụ thể mà bạn muốn thiết lập webhook (ví dụ: Sheet chứa các tab "Đo lường 3D", "Đo lường 2D").

2.  **Mở trình chỉnh sửa Apps Script cho Sheet này:**
    * Đi tới **`Extensions`** (Tiện ích mở rộng) trên thanh menu của Google Sheet.
    * Chọn **`Apps Script`**. Thao tác này sẽ mở một dự án Apps Script mới và độc lập dành riêng cho Google Sheet này.

3.  **Dán Script Triển khai:**
    * Trong trình chỉnh sửa Apps Script, bạn sẽ thấy một file `Code.gs`. Xóa toàn bộ nội dung mặc định trong `Code.gs`.
    * **Dán toàn bộ nội dung sau vào `Code.gs`:**
        ```javascript
        /**
         * @fileoverview Script cấu hình và triển khai cho Google Sheet này (chứa nhiều tab/bảng con).
         * Quản lý Webhook URL cho từng tab thông qua một biến cấu hình trực tiếp.
         */

        // Đảm bảo bạn đã thêm thư viện GoogleSheetWebhookLib vào dự án này với Identifier là `WebhookLib`!

        // --- BIẾN CẤU HÌNH WEBHOOK CỦA BẠN ---
        // Thay đổi các URL này để phù hợp với các tab của bạn.
        // Khóa (key) phải khớp CHÍNH XÁC với tên của tab (sheet con) trong Google Sheet của bạn.
        const SHEET_WEBHOOK_CONFIG = {
          "Đo lường 3D": "[https://your-server.com/webhooks/doluong3d](https://your-server.com/webhooks/doluong3d)", // Thay đổi URL này cho tab "Đo lường 3D"
          "Đo lường 2D": "[https://your-server.com/webhooks/doluong2d](https://your-server.com/webhooks/doluong2d)", // Thay đổi URL này cho tab "Đo lường 2D"
          "Form Liên Hệ": "[https://your-server.com/webhooks/contact](https://your-server.com/webhooks/contact)",   // Thêm các cấu hình khác nếu có tab khác
          // Bạn có thể thêm nhiều cặp "Tên Tab": "URL Webhook" tại đây
        };
        // --- KẾT THÚC BIẾN CẤU HÌNH ---


        /**
         * Hàm này được kích hoạt tự động khi Google Sheet được mở.
         * Nó tạo một menu tùy chỉnh để dễ dàng cấu hình và kiểm tra.
         */
        function onOpen() {
          const ui = SpreadsheetApp.getUi();
          ui.createMenu('Webhook Setup')
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
        ```
    * Lưu dự án (biểu tượng đĩa hoặc `Ctrl + S`). Bạn có thể đặt tên cho dự án là `WebhookConfig_YourSheetName`.

4.  **Thêm Thư viện Logic Chính vào Script Triển khai:**
    * Vẫn trong trình chỉnh sửa Apps Script của Sheet này, ở thanh bên trái, bên cạnh mục **`Libraries`** (Thư viện), nhấp vào biểu tượng dấu cộng (**`+ Add a library`**).
    * Trong trường **`Script ID`**, dán **Script ID** của thư viện `GoogleSheetWebhookLib` mà bạn đã sao chép ở Bước 1.2.
    * Nhấp vào **`Lookup`**.
    * Chọn **phiên bản triển khai mới nhất** của thư viện.
    * Trong trường **`Identifier`** (Định danh), **đảm bảo rằng nó được đặt là `WebhookLib`** (đây là tên mà script triển khai sử dụng để gọi các hàm từ thư viện).
    * Nhấp vào **`Add`** (Thêm).

---

## 3. Hoàn tất Cấu hình trong Google Sheet (Cho Người Dùng Cuối)

Sau khi thiết lập mã nguồn, bạn sẽ hoàn tất cấu hình trực tiếp từ giao diện Google Sheet.

1.  **Tải lại Google Sheet của bạn:**
    * Đóng và mở lại Google Sheet hoặc tải lại trang web của Google Sheet.

2.  **Sử dụng Menu "Webhook Setup":**
    * Trên thanh menu của Google Sheet, bạn sẽ thấy một mục mới tên là **`Webhook Setup`**.
    * **Bước quan trọng nhất (chỉ cần làm một lần cho toàn bộ Sheet):**
        * Nhấp vào **`Webhook Setup`** > **`3. Thiết lập Trigger (Quan trọng)`**.
        * Một hộp thoại sẽ xuất hiện yêu cầu bạn cấp quyền cho script. Hãy xem xét các quyền và nhấp vào **`Review permissions`** (Xem lại quyền), sau đó cho phép script truy cập các tài nguyên cần thiết.
        * Sau khi cấp quyền, một thông báo xác nhận sẽ hiện ra. Trigger `On form submit` đã được thiết lập thành công cho toàn bộ Google Sheet này.

    * **Xem cấu hình (tùy chọn):**
        * Để xem lại các URL webhook bạn đã cấu hình trong mã nguồn (trong biến `SHEET_WEBHOOK_CONFIG`), nhấp vào **`Webhook Setup`** > **`1. Xem cấu hình Webhook hiện tại`**.

    * **Kiểm tra và gửi test (tùy chọn, nên làm):**
        * Chuyển đến tab (sheet con) mà bạn muốn kiểm tra (ví dụ: "Đo lường 3D").
        * Nhấp vào **`Webhook Setup`** > **`2. Kiểm tra & Gửi Test cho Tab hiện tại`**.
        * Một hộp thoại sẽ hỏi bạn có muốn gửi một payload test không. Nhấp **`Có`**.
        * Kiểm tra log của server webhook của bạn để xác nhận rằng payload đã được nhận. Payload test sẽ bao gồm trường `"is_test_data": true` và trường `_meta` chứa `spreadsheet_id`, `sheet_name`, và `spreadsheet_url`.

---

## Cách thức hoạt động

* Khi một biểu mẫu Google Form được gửi và dữ liệu được thêm vào một tab cụ thể trong Google Sheet của bạn, trigger `On form submit` sẽ kích hoạt hàm `onFormSubmitHandler` trong script triển khai của sheet đó.
* Hàm `onFormSubmitHandler` sẽ tự động xác định tên của tab (bảng con) vừa được cập nhật (ví dụ: "Đo lường 3D").
* Nó sẽ tra cứu tên tab này trong biến cấu hình `SHEET_WEBHOOK_CONFIG` để tìm URL webhook tương ứng.
* Sau đó, nó sẽ gọi hàm `processFormSubmission` từ thư viện `GoogleSheetWebhookLib`, truyền toàn bộ dữ liệu sự kiện (bao gồm cả dữ liệu từ form và các thông tin sheet) cùng với URL webhook đã tìm được.
* Thư viện sẽ định dạng dữ liệu (thêm trường `_meta` chứa `spreadsheet_id`, `sheet_name`, `spreadsheet_url`) và gửi nó dưới dạng yêu cầu POST HTTP đến URL webhook đích.

---

## Lưu ý quan trọng

* **Tên Tab Chính xác:** Đảm bảo rằng tên tab trong biến `SHEET_WEBHOOK_CONFIG` khớp **chính xác từng ký tự** với tên tab trong Google Sheet của bạn (bao gồm cả khoảng trắng và chữ hoa/thường).
* **Hạn mức Google Apps Script:** Lưu ý các [giới hạn sử dụng của Google Apps Script](https://developers.google.com/apps-script/guides/services/quotas). Đối với số lượng lớn submissions, bạn có thể cần xem xét các giải pháp tích hợp dữ liệu mạnh mẽ hơn.
* **Xử lý lỗi trên Server:** Server webhook của bạn nên có cơ chế xử lý lỗi mạnh mẽ và ghi nhật ký để theo dõi các payload nhận được và phản hồi thành công.
* **Bảo mật:** URL webhook phải được bảo mật và chỉ nên biết bởi các hệ thống đáng tin cậy của bạn.

Chúc bạn thành công với việc triển khai webhook của mình!
