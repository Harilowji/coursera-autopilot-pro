# 🎓 Coursera Skipper Pro v2.0 (Bản Nâng Cấp Tối Thượng)

> **Công cụ tự động hóa học tập & farm chứng chỉ Coursera an toàn, tích hợp AI giải Quiz siêu tốc và chế độ chống phát hiện gian lận.**

---

## 🌟 Những Cải Tiến Mới Vượt Trội Ở Bản v2.0

| Tính năng | Bản cũ v1.0 | Bản Pro v2.0 (Mới) |
|---|---|---|
| **Chế độ Farm An Toàn** | Không có (Gửi dồn dập, dễ dính cờ) | **🛡️ Safe Farm Mode**: Thêm delay ngẫu nhiên (jitter 2-5s) tạo nhật ký học tự nhiên như người thật |
| **Giải Quiz bằng AI** | Dính lỗi 404 Model, gửi từng câu 2 phút | **⚡ Batch AI**: Sửa model `gemini-2.0-flash`, thêm **Groq (Llama 3.3)**, giải cả bài trong 2s |
| **Không cần API Key** | Bắt buộc phải có Key mới dùng được | **📋 Zero-Key Mode**: 1-Click copy toàn bộ đề thi để dán vào ChatGPT/Gemini Web, sau đó paste JSON để tự điền đáp án |
| **Cào Đề Bài Thi** | Chỉ lấy 1 dòng đầu (dễ mất đề bài) | **Deep DOM Parser**: Lấy trọn vẹn đề bài, code blocks, phân biệt chính xác trắc nghiệm 1 hay nhiều đáp án |
| **Nộp & Chấm Peer Review** | Dùng 1 đoạn văn cứng (dễ bị quét đạo văn) | **Dynamic Spin Text**: Tự động xoay vòng nhiều mẫu bài nộp & nhận xét học thuật khác nhau |
| **Chấm Điểm Rubric** | Mặc định click ô cuối (dễ dính 0 điểm) | **Smart Scoring**: Tự động nhận diện mức điểm tối đa trong rubric để chấm điểm cao nhất |
| **Vượt Locking Browser** | Có | Duy trì và tăng cường độ mượt mà |

---

## 🚀 Hướng Dẫn Cài Đặt (Vào Chrome / Edge / Brave)

1. Mở trình duyệt Chrome, truy cập: `chrome://extensions/`
2. Bật công tắc **Developer mode** (Chế độ cho nhà phát triển) ở góc trên bên phải.
3. Nhấn nút **Load unpacked** (Tải tiện ích đã giải nén).
4. Chọn đúng thư mục:
   ```
   D:\Project\02_Ready_For_GitHub\coursera-skipper-pro
   ```
5. Tiện ích **Coursera Skipper Pro** sẽ xuất hiện trên thanh công cụ! Hãy ghim (Pin) extension lên để tiện dùng.

---

## 📖 Hướng Dẫn Sử Dụng Chi Tiết

### 1. Skip Video & Reading (Quét Khóa Học)
- Truy cập vào trang chủ khóa học (nơi có danh sách các tuần học).
- Chọn chế độ:
  - **🛡️ Safe (Khuyên dùng):** Thêm delay ngẫu nhiên mô phỏng học thật, an toàn để farm chứng chỉ lấy điểm thành phần.
  - **⚡ Turbo:** Hoàn thành tức thì qua API.
- Bấm **▶ Skip Videos & Reading**.

### 2. Tự Động Giải Quiz Trắc Nghiệm (Có 2 Cách)

#### 👉 Cách A: Dùng API Key (Tự Động 100% - Khuyên dùng Groq hoặc Gemini)
- Trong phần **Giải Quiz Trắc Nghiệm**:
  - Chọn **Google Gemini 2.0 Flash** hoặc **Groq Llama 3.3 70B** (cả 2 đều miễn phí 100%).
  - Bấm vào link *"Lấy Key Miễn Phí"* trên giao diện để lấy key và dán vào ô.
- Mở bài thi trắc nghiệm (Quiz Attempt), bấm **⚡ Tự Động Giải Quiz Bằng AI**.
- Bot sẽ quét đề thi, gửi lên AI và tự động tích chọn toàn bộ đáp án đúng trong 2 giây!

#### 👉 Cách B: Zero-Key Mode (Không Cần API Key)
- Trong dropdown chọn: **📋 Không Cần Key (Copy/Paste Thủ Công)**.
- Mở bài thi trắc nghiệm trên Coursera, bấm **📋 Copy Đề Thi (Dán vào ChatGPT/Gemini)**.
- Mở tab [ChatGPT](https://chatgpt.com) hoặc [Gemini Web](https://gemini.google.com), nhấn `Ctrl + V` gửi đi.
- Copy khối JSON kết quả AI trả về.
- Quay lại extension, bấm **📥 Dán Kết Quả JSON & Tự Điền**, paste vào ô và bấm **✔ Áp Dụng**. Tool sẽ tự động tích chọn mọi đáp án!

### 3. Nộp Bài Tự Luận & Chấm Chéo (Peer Review)
- **Nộp bài:** Mở trang *Submit your assignment*, bấm **📝 Nộp Bài Tự Luận**. Tool sẽ tự điền bài làm học thuật ngẫu nhiên và nộp.
- **Chấm bài:** Mở trang *Review your peers*, chọn số bài cần chấm (ví dụ: 3 bài) và bấm **⭐ Chấm Chéo Peer Review**. Tool sẽ tự chấm điểm cao nhất và để lại nhận xét tích cực ngẫu nhiên cho từng bài.

### 4. Tự Động Thảo Luận (Discussion)
- Mở bài thảo luận, bấm **💬 Auto Discussion**.

---

## 🔒 Bản Quyền & Lưu Ý
- Bản gốc: *DoHung*
- Phiên bản Pro v2.0 được tối ưu hóa toàn diện về tính an toàn, tốc độ và thuật toán AI giải Quiz.