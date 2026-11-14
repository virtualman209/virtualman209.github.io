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
- Chèn ảnh: nút **🖼 Ảnh**, dán (Ctrl+V) hoặc kéo thả vào ô soạn thảo. Ảnh PNG / JPG / GIF / WebP (tối đa 25 MB) được commit thẳng vào thư mục `assets/` của repo private và chèn sẵn đường dẫn. Ảnh hiển thị bằng token của bạn, người khác không xem được.
- Nút **Nhờ Claude**: copy câu lệnh nhờ Claude, kèm file đang mở.
- Mỗi lần lưu là một commit trên `vm-projects`, nên không cần nút đồng bộ. Nếu file vừa bị sửa ở nơi khác (ví dụ Claude vừa cập nhật), trang báo và tải bản mới, không ghi đè.

**Bảo mật:** chỉ dùng trên thiết bị của bạn. Trên máy lạ, bấm **Thoát** để xoá token. Token hết hạn thì tạo token mới và đăng nhập lại.

Thư viện kèm theo: [marked](https://github.com/markedjs/marked) 12.0.2 (MIT, `vendor/`).
