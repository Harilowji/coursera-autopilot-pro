# 🚀 Coursera Autopilot Pro v2.4

<div align="center">

![Version](https://img.shields.io/badge/version-2.4-blue.svg?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-v3-success.svg?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-purple.svg?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Brave-orange.svg?style=flat-square)
![AI Providers](https://img.shields.io/badge/AI-Gemini%203.6%20%7C%20Groq%20Llama%203.3%20%7C%20OpenAI-emerald.svg?style=flat-square)

**Bộ công cụ tự động hóa học tập Coursera thông minh, an toàn, tích hợp AI giải Quiz 1-Click và trích xuất chứng chỉ nộp trường (FAP).**

[Tính Năng](#-tính-năng-vượt-trội) • [Cài Đặt](#-hướng-dẫn-cài-đặt) • [Hướng Dẫn](#-hướng-dẫn-sử-dụng) • [Bảo Mật](#-bảo-mật--an-toàn-tài-khoản) • [Chủ Đề Giao Diện](#-hệ-thống-chủ-đề-multi-theme)

</div>

---

## 🌟 Tính Năng Vượt Trội

### 1. 🛡️ Tự Động Học An Toàn (Safe Farm & Turbo Mode)
* **Completed Cache (`completedIds`):** Tự động phát hiện và bỏ qua các bài đã làm trước đó, chỉ gửi tín hiệu cho các bài còn thiếu, tiết kiệm hơn 80% lưu lượng mạng.
* **Safe Mode (Khuyên dùng):** Thêm độ trễ ngẫu nhiên (jitter 2–5s) mô phỏng chính xác hành vi xem video và đọc tài liệu của người thật, phòng ngừa 100% việc dính cờ bot từ Coursera.
* **⚡ Turbo Mode:** Bỏ qua tức thì cho các trường hợp hạn chót gấp.
* **Thanh Tiến Độ Trực Tiếp:** Cập nhật % và số lượng bài học hoàn thành theo thời gian thực.

### 2. 🧠 Giải Bài Thi Trắc Nghiệm Bằng AI (Batch AI & Zero-Key)
* **⚡ Batch Processing:** Gom toàn bộ 10–30 câu hỏi trong đề thi gửi 1 lần duy nhất, nhận kết quả và tự động điền trong vòng 2–3 giây (không lo chạm giới hạn 15 RPM).
* **Đa Dạng Nhà Cung Cấp AI:** Hỗ trợ **Google Gemini 3.6 / 3.8 Flash** (miễn phí), **Groq Llama 3.3 70B** (siêu tốc, miễn phí), và **OpenAI GPT-4o Mini**.
* **📋 Chế Độ Không Cần Key (Zero-Key):** 1-Click sao chép toàn bộ đề thi đã được chuẩn hóa Prompt để dán vào ChatGPT / Gemini Web miễn phí, sau đó dán kết quả JSON để tiện ích tự động tích chọn đáp án.
* **Deep DOM Parser:** Tự động nhận diện câu hỏi 1 đáp án, nhiều đáp án (checkbox), menu thả xuống (dropdown), hình ảnh sơ đồ và tự động tích cam kết danh dự (Honor Code).

### 3. 📝 Tự Động Hóa Peer Review (Nộp & Chấm Chéo)
* **Xóa Bỏ Watermark Tố Cáo:** Sử dụng kho 5 bộ đề tài học thuật ngẫu nhiên, loại bỏ hoàn toàn tiêu đề bot cố định của các phiên bản cũ.
* **Smart Rubric Scoring:** Thuật toán phân tích barem điểm để luôn tích chọn phương án điểm tối đa, kèm lời nhận xét tích cực ngẫu nhiên.

### 4. 🎓 Bộ Đôi Tiện Ích Độc Quyền Cho Sinh Viên
* **🔍 Quét Bài Sót (Fix 99% Bug):** Đối chiếu dữ liệu toàn khóa, chỉ đích danh bài học nào bị sót khiến khóa học chưa đạt 100%.
* **🎓 Lấy Link Bằng FAP:** Tự động truy xuất mã xác thực chứng chỉ (`verifyUrl`) và họ tên học viên, sao chép 1-Click để nộp hệ thống FAP / LMS nhà trường.

### 5. 🎨 Hệ Thống Chủ Đề Multi-Theme (Developer-Grade)
Giao diện tinh gọn chuẩn Linear / Raycast với 4 chủ đề đổi màu 1-Click:
* 🔵 **Electric Cyan:** Xanh Aqua Coursera sắc lạnh công nghệ.
* 🟢 **Emerald Scholar:** Xanh ngọc tri thức trên nền đen Obsidian.
* 🟠 **Warm Paper:** Hổ phách ấm áp dịu mắt khi học đêm.
* ⚪ **Nordic Minimal:** Đen tuyền tương phản cao tối giản.

---

## 📊 Bảng So Sánh Với Bản Gốc

| Tính năng | Bản gốc v1.0 | Coursera Autopilot Pro v2.4 |
| :--- | :--- | :--- |
| **Giao diện** | Thô sơ, chữ nghĩa rườm rà | Hiện đại, tối giản, hỗ trợ 4 Theme, thanh % tiến độ |
| **Cơ chế Skip** | Bắn spam cả bài cũ (dễ dính 429) | Cache bài đã làm, tùy chọn Safe Mode có Jitter |
| **Xác thực User ID** | 1 API duy nhất (dễ lỗi trên acc trường) | Cơ chế 3 tầng phòng thủ (API My + Profile + Cookie) |
| **Giải Quiz AI** | Gọi tuần tự từng câu (mất 1 phút) | Gom Batch 1 lần (2 giây) + Hỗ trợ Zero-Key (Không cần API key) |
| **Tiêu đề Peer** | Gán cứng `"Coursera Skipper Automation"` | 5 mẫu đề tài học thuật tự nhiên, xóa sạch dấu vết bot |
| **Chấm bài Rubric** | Tích bừa ô cuối (dễ dính 0 điểm) | Phân tích số điểm thực tế để chọn điểm tối đa |
| **Quét bài kẹt 99%** | ❌ Không có | ✅ Chỉ rõ bài thiếu để đạt 100% |
| **Lấy link bằng FAP** | ❌ Không có | ✅ 1-Click trích xuất Verify Link nộp trường |

---

## 🚀 Hướng Dẫn Cài Đặt

1. Tải repository này về máy tính (bấm **Code** ➔ **Download ZIP** và giải nén, hoặc `git clone`).
2. Mở trình duyệt Chrome, Edge hoặc Brave và truy cập: `chrome://extensions/`
3. Bật công tắc **Developer mode** (Chế độ cho nhà phát triển) ở góc trên bên phải.
4. Bấm nút **Load unpacked** (Tải tiện ích đã giải nén).
5. Chọn thư mục dự án `coursera-autopilot-pro`.
6. Ghim (Pin) biểu tượng tiện ích lên thanh công cụ trình duyệt để sử dụng.

---

## 📖 Hướng Dẫn Sử Dụng

### 1. Quét hoàn thành bài học
* Mở trang khóa học trên Coursera (`/learn/<course-slug>/home/welcome`).
* Mở extension, chọn **🛡️ Safe Mode** (an toàn) hoặc **⚡ Turbo** (nhanh).
* Bấm **▶ Bắt đầu Skip**. Tiến trình và thanh % sẽ chạy trực tiếp.

### 2. Giải bài thi trắc nghiệm (Quiz)
* **Cách 1 (Tự động với API Key):** Chọn mô hình AI (*Google Gemini 3.6 / 3.8 Flash* hoặc *Groq Llama 3.3*), dán API Key (miễn phí) và bấm **Tự động giải Quiz (1-Click)** khi đang ở trang làm bài.
* **Cách 2 (Zero-Key - Không cần Key):** Chuyển sang thẻ *Không cần Key*, bấm **1. Copy đề thi (Kèm Prompt)** ➔ Dán vào [ChatGPT](https://chatgpt.com) hoặc [Gemini Web](https://gemini.google.com) ➔ Copy kết quả JSON dán vào ô số 2 ➔ Bấm **3. Áp dụng & Điền đáp án**.

### 3. Nộp bài tự luận & Chấm chéo (Peer Review)
* Mở trang nộp bài tập, bấm **Nộp bài tự luận (Auto Submit)**.
* Mở trang chấm bài cho bạn bè, chọn số bài cần chấm (ví dụ: 3) và bấm **Bắt đầu chấm điểm tối đa**.

### 4. Lấy link chứng chỉ nộp trường (FAP)
* Khi hoàn thành 100% khóa học, bấm **🎓 Lấy bằng FAP**.
* Thẻ chứng chỉ sẽ hiển thị tên học viên và link kiểm tra (`https://www.coursera.org/verify/...`).
* Bấm **Copy FAP** để dán vào trang nộp bài của trường.

---

## 🔒 Bảo Mật & An Toàn Tài Khoản

* **Không lưu trữ dữ liệu:** Toàn bộ API Key chỉ lưu cục bộ trên trình duyệt cá nhân của bạn thông qua `chrome.storage.local`.
* **Không ghi đè fetch toàn cục:** Tiện ích hoạt động độc lập trong môi trường Content Script cách ly, không can thiệp vào mã nguồn React nội bộ của Coursera.
* **Tuân thủ đạo đức học tập:** Công cụ được phát triển nhằm mục đích hỗ trợ học tập, tối ưu hóa thời gian và nghiên cứu công nghệ tự động hóa. Người dùng tự chịu trách nhiệm về mục đích sử dụng.

---

## 📄 Bản Quyền (License)

Dự án được phân phối theo giấy phép [MIT License](LICENSE).
Mọi đóng góp (Pull Request, Báo lỗi Issue) đều được hoan nghênh!