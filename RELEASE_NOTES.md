## Quiz Learning Pro v1.3.0 — Bản cập nhật Bộ nạp đề thi thông minh

### Các tính năng & Cải tiến mới:
- 📋 **Nhập đề trực tiếp bằng văn bản (Text to Quiz):** Cho phép copy/paste đề thi trực tiếp từ Word, PDF, Web mà không cần phải tự tạo cấu trúc JSON phức tạp.
- 🧠 **Bộ phân tích Rule-based thuần Offline:**
  - Nhận diện linh hoạt tiền tố câu hỏi tiếng Việt (`Câu 1:`, `1.`, `2)`).
  - Hỗ trợ đa dạng định dạng phương án (`A.`, `A)`, `[A]`, `(A)`, câu Đúng/Sai, đề 5 phương án A-E).
  - Tự động nhận diện đáp án hoa thị (`*A.`), nhãn inline (`Đáp án: A, C`), và bóc tách bảng đáp án chân trang.
  - Cơ chế Safe Buffer Continuation bảo toàn trọn vẹn văn bản bị ngắt dòng do copy từ PDF.
  - Phát hiện xung đột đáp án, tuyệt đối không đoán mò khi dữ liệu mơ hồ.
- 🛡️ **Quy trình kiểm duyệt & Biên tập 2 bước:**
  - Bộ lọc trực quan: `Tất cả`, `Hợp lệ`, `Cần kiểm tra`.
  - Phím bấm gán nhanh đáp án `[A] [B] [C] [D]` ngay trên danh sách.
  - Cho phép sửa trực tiếp nội dung câu hỏi/phương án trước khi lưu vào SQLite.
- 🧪 **Kiểm thử tự động:** Đạt 100% 43 test cases tự động (18 test cases chuyên sâu cho parser).

### Hướng dẫn cài đặt:
1. Tải file **QuizLearningPro_Setup.exe** bên dưới mục Assets.
2. Chạy bộ cài để tự động cập nhật phiên bản mới.

