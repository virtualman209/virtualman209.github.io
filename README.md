# VM Projects (web)

Giao diện web để đọc và sửa nội dung repo private [`virtualman209/vm-projects`](https://github.com/virtualman209/vm-projects) trên mọi thiết bị: **https://virtualman209.github.io**

Repo này **không chứa nội dung** dự án. Trang web đọc và ghi thẳng vào repo private qua GitHub API, bằng token bạn dán vào. Token chỉ được lưu trong trình duyệt của thiết bị đó. Người khác mở link chỉ thấy màn hình đăng nhập.

## Dùng lần đầu trên một thiết bị

1. Tạo token tại [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new):
   - **Repository access**: Only select repositories → `vm-projects`
   - **Permissions → Contents**: **Read and write**
2. Mở https://virtualman209.github.io, dán token, bấm **Vào**.

Mỗi thiết bị (máy tính, điện thoại) dán token một lần. Có thể dùng chung một token.

## Chức năng

- Mục lục theo dự án, tìm kiếm trong toàn bộ nội dung.
- Bấm ô vuông để tick checklist: lưu thẳng lên GitHub, có thanh tiến độ.
- Sửa Markdown với xem trước song song, Ctrl+S để lưu. Tạo ghi chú mới.
- Thanh công cụ soạn thảo: tiêu đề, đậm, nghiêng, gạch ngang, mã, liên kết, danh sách, checklist, trích dẫn, khối mã, bảng. Phím tắt Ctrl+B, Ctrl+I, Ctrl+K; Enter trong danh sách tự tạo dòng mới.
- **📋 Bảng việc và lịch**: gom mọi checklist trong `vm-projects` thành kanban (Cần làm, Đang làm, Xong), lịch tháng theo hạn và tiến độ từng giai đoạn. Kéo thả hoặc bấm ◀ ▶ để đổi trạng thái, đổi ngày hạn bằng ô chọn ngày. Mỗi thay đổi là một commit sửa đúng một dòng checklist. Code ở `board.js`, không chứa nội dung dự án. Mỗi việc có thể có ngày bắt đầu (`🛫`), ngày kết thúc (`📅`), độ dài tính theo ngày và mức ưu tiên (`🔴` cao, `🟡` vừa, `🔵` thấp); lịch vẽ việc nhiều ngày thành thanh dài, tô màu đỏ / vàng / xanh theo ưu tiên. Trong tài liệu, bấm vào một việc để mở popup sửa (tên, trạng thái, ưu tiên, ngày bắt đầu / kết thúc, xoá); dòng mờ **Thêm task mới** dưới mỗi danh sách để thêm việc. Hạn chỉ hiện gọn kiểu `22/4/26`, chuyển đỏ khi còn dưới 14 ngày hoặc quá hạn; ngày bắt đầu chỉ xem trong popup, kanban và lịch. Kéo thả một việc (kể cả việc con đi kèm) để đổi thứ tự; các việc cách nhau thoáng hơn. Trong tài liệu có nhiều việc (trên 15), các mục `##` và `###` chứa checklist tự thu gọn: bấm tiêu đề để mở, có nút Mở tất cả / Thu gọn tất cả (trạng thái nhớ theo từng tài liệu). Thanh bên chia **danh mục** rõ ràng: tạo, đổi tên, đổi thứ tự, xoá danh mục trống, và chuyển tệp bằng kéo thả hoặc nút ⇄. Danh mục lưu trong `nav.json` (không di chuyển file thật nên link giữa các file không gãy). **Sửa tài liệu theo kiểu Word / Google Docs**: bấm Sửa là gõ ngay trên trang đã định dạng (tiêu đề, đậm nghiêng, danh sách, ô tick, bảng, ảnh dán hoặc kéo vào), vẫn lưu ra Markdown. Nút **Mã nguồn** trên thanh công cụ chuyển sang ô Markdown thô khi cần. Nút **+ Mới**: gõ tên văn bản, chọn danh mục (hoặc tạo danh mục mới ngay trong hộp), rồi vào thẳng trình soạn thảo; tệp tự đặt tên không dấu trong thư mục của danh mục đó. Trình soạn thảo có thêm hoàn tác / làm lại, gạch chân, tô vàng (lưu thành `<u>`, `<mark>` trong Markdown), bỏ định dạng.
- **Chuột phải ở thanh bên** (không còn hiện menu của trình duyệt): vào một tệp có **Sửa tên** (đổi tên hiện ở mục lục, đường dẫn tệp giữ nguyên để link không gãy), **Chuyển sang danh mục khác**, **Lên trên / Xuống dưới**, **Xoá tệp** (có hỏi lại); vào tiêu đề danh mục có đổi tên / thứ tự / xoá danh mục. Điện thoại dùng nút **⋯** cạnh mỗi tệp. **Kéo thả tệp** lên trên / dưới tệp khác để đổi thứ tự trong danh mục (lưu trong `nav.json`).
- **◇ Sơ đồ kiểu Canva** (`diagram.js`, giống bản chạy trên máy): **+ Mới → ◇ Sơ đồ** tạo file sơ đồ (có sơ đồ mẫu ý chính → 3 nhánh → ý con), mở ra là vẽ luôn: thanh công cụ (Chọn, Hình, Đường, Chữ, Note, Vẽ tay, Mẫu), chọn hình rồi bấm / kéo nút **+** để thêm hình nối hoặc nối sang hình khác, bấm đúp (điện thoại: chạm đúp) để gõ chữ, thanh nổi đổi màu / viền / cỡ chữ / kiểu đường / mũi tên, chụm 2 ngón hoặc Ctrl + lăn chuột để thu phóng, **Tải PNG**. Tự lưu: gom thay đổi 4 giây thành một commit, rời sơ đồ thì lưu ngay (offline thì vào hàng chờ như mọi lần sửa). Khi sửa tài liệu, nút **◇ Sơ đồ** chèn sơ đồ vào giữa văn bản; bấm vào sơ đồ để vẽ toàn màn hình.
- Chèn ảnh: nút **🖼 Ảnh**, dán (Ctrl+V) hoặc kéo thả vào ô soạn thảo. Ảnh PNG / JPG / GIF / WebP (tối đa 25 MB) được commit thẳng vào thư mục `assets/` của repo private và chèn sẵn đường dẫn. Ảnh hiển thị bằng token của bạn, người khác không xem được.
- Nút **Nhờ Claude**: copy câu lệnh nhờ Claude, kèm file đang mở.
- Mỗi lần lưu là một commit trên `vm-projects`, nên không cần nút đồng bộ. Nếu file vừa bị sửa ở nơi khác (ví dụ Claude vừa cập nhật), trang báo và tải bản mới, không ghi đè.

**Bảo mật:** chỉ dùng trên thiết bị của bạn. Trên máy lạ, bấm **Thoát** để xoá token. Token hết hạn thì tạo token mới và đăng nhập lại.

Thư viện kèm theo: [marked](https://github.com/markedjs/marked) 12.0.2 (MIT, `vendor/`).

## Chạy offline (iPhone, máy tính)

Mở https://virtualman209.github.io bằng Safari, đăng nhập, rồi **Chia sẻ › Thêm vào MH chính**. App giữ bản sao tài liệu trên máy (localStorage) và khung app (service worker `sw.js`), nên mất mạng vẫn mở, đọc, tìm, xem Bảng việc, sửa và tick việc được. Sửa lúc offline nằm trong hàng chờ `vmprojects.outq`, có mạng thì tự commit; nếu file đã đổi ở nơi khác trong lúc đó thì bản sửa được lưu thành `<tên>.offline-<thời điểm>.md` (không ghi đè). Chèn ảnh cần có mạng. Ảnh đã xem được giữ trong bộ nhớ `vmp-img`. Bấm **Thoát** xóa cả token lẫn bản lưu offline.
