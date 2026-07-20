# Purrdora

Bảng điều khiển giám sát hệ thống và tối ưu hóa phần cứng hiệu năng cao dành cho **Fedora Linux**, được xây dựng trên nền tảng **Tauri v2 + React 19**, tích hợp sâu các tính năng điều khiển phần cứng của **MSI Center (thông qua MSI Embedded Controller)**.

Purrdora mang lại trải nghiệm hợp nhất giữa việc theo dõi tài nguyên phần cứng thời gian thực và khả năng can thiệp tinh chỉnh hệ thống (quạt tản nhiệt, giới hạn sạc pin, chế độ hiệu năng, dọn dẹp bộ nhớ) trực quan, mượt mà trên hệ điều hành Linux.

---

## 🌟 Tính Năng Cốt Lõi

### 1. Giám Sát Hệ Thống Thời Gian Thực (System Monitoring)
*   **Chỉ số tài nguyên:** Theo dõi chi tiết mức độ sử dụng CPU, RAM, GPU, và băng thông mạng với chu kỳ cập nhật nhanh 1 giây.
*   **Lịch sử hiệu năng:** Hiển thị biểu đồ dòng thời gian (Time-series chart) cho các chỉ số quan trọng để kiểm soát độ ổn định.
*   **Đo đạc nhiệt độ:** Tích hợp bộ đọc cảm biến nhiệt độ phần cứng trực tiếp từ nhân Linux và bộ điều khiển MSI.
*   **Tiến trình hệ thống:** Liệt kê danh sách các tiến trình ngốn RAM nhất theo thứ tự giảm dần thời gian thực.

### 2. Tinh Chỉnh & Tối Ưu Hệ Thống (System Tuning)
*   **Chế độ hoạt động (Operating Modes):** Chuyển đổi nhanh giữa các cấu hình điện năng (Power Saver, Balanced, Performance) thông qua UPower D-Bus.
*   **Tối ưu chơi game (GameMode):** Bật/tắt nhanh chế độ GameMode của FeralInteractive nhằm tăng ưu tiên CPU/GPU Scheduler, tích hợp bật MangoHud theo dõi FPS trực tiếp khi chơi game.
*   **Giải phóng RAM Cache:** Xóa nhanh bộ đệm trang (Page Cache), Dentries, và Inodes để giải phóng bộ nhớ vật lý tức thì (yêu cầu quyền nâng cao thông qua Polkit).
*   **Hẹn giờ tắt máy:** Công cụ đếm ngược tắt hệ thống tự động được thiết kế trực quan.

### 3. Tích Hợp MSI EC Center (MSI Hardware Control)
Purrdora tích hợp trình điều khiển MSI Embedded Controller (msi-ec) mang các tính năng độc quyền của MSI Center lên Linux:
*   **Cấu hình Fan Profile:** Thay đổi chế độ quạt (Auto, Silent, Advanced) hoặc kích hoạt **Cooler Boost** (tối đa công suất quạt) bằng một cú click.
*   **Tự động tăng tốc quạt (Auto Fan Boost):** Theo dõi nhiệt độ ACPI, tự động bật Cooler Boost khi đạt ngưỡng nhiệt chỉ định (ví dụ $\ge 78^\circ\text{C}$) và tắt khi nhiệt độ hạ xuống dưới $72^\circ\text{C}$.
*   **Chế độ hiệu năng phần cứng (Shift mode):** Thiết lập mức giới hạn hiệu năng của EC (Eco, Comfort, Sport/Turbo).
*   **Bảo vệ pin (Battery Master):** Điều chỉnh giới hạn sạc pin dừng ở 80% (chế độ bảo vệ tuổi thọ pin) hoặc cho phép sạc đầy 100%.
*   **Đèn nền bàn phím (Keyboard Backlight):** Thay đổi độ sáng đèn nền trực tiếp qua bộ điều khiển nhúng.

### 4. Kiểm Soát Âm Thanh & Đa Phương Tiện
*   **PipeWire Audio Mixer:** Hỗ trợ thanh kéo điều chỉnh âm lượng riêng biệt cho từng cổng ra âm thanh và bật/tắt tiếng (Mute).
*   **Trình phát đa phương tiện (MPRIS):** Hiển thị bài nhạc đang phát (tên bài, nghệ sĩ, ảnh bìa album) và điều khiển phát nhạc từ bất kỳ trình phát nào tương thích với chuẩn MPRIS (Spotify, Firefox, Chrome, VLC, v.v.).

---

## 🛡️ Thiết Kế Bảo Mật & Quyền Nâng Cao

Để thực hiện các thao tác hệ thống nâng cao (như ghi ngưỡng sạc pin, dọn dẹp RAM, chỉnh quạt MSI), Purrdora sử dụng thiết kế bảo mật phân quyền nghiêm ngặt:
*   **Giao diện unprivileged:** Giao diện Tauri/React chạy hoàn toàn dưới quyền người dùng thông thường, hạn chế tối đa nguy cơ khai thác lỗ hổng bảo mật thông qua Webview.
*   **Trợ lý đặc quyền độc lập (`purrdora-helper`):** Một tiến trình nhỏ bằng Rust được biên dịch riêng, đặt tại `/usr/libexec/purrdora-helper`. File nhị phân này được bảo vệ nghiêm ngặt và chỉ chấp nhận danh sách lệnh được whitelist (đã được làm sạch dữ liệu đầu vào).
*   **Chính sách Polkit cục bộ:** Cài đặt tệp cấu hình Polkit (`/usr/share/polkit-1/actions/com.purrdora.pkexec.policy`) và rules (`/etc/polkit-1/rules.d/99-purrdora.rules`) cho phép tài khoản thuộc nhóm quản trị viên thực thi passwordless chỉ dành riêng cho helper của ứng dụng.

---

## 📋 Yêu Cầu Hệ Thống

Để Purrdora hoạt động đầy đủ tính năng, hệ thống của bạn cần đáp ứng các điều kiện sau:
*   **Hệ điều hành:** Fedora Linux 40+ (Workstation)
*   **Hệ thống âm thanh:** PipeWire (ứng dụng điều khiển thông qua `wpctl`)
*   **D-Bus:** Dịch vụ UPower PowerProfiles để điều khiển chế độ pin.
*   **Gói phụ trợ chơi game (Tùy chọn):**
    *   `gamemode`: `sudo dnf install gamemode`
    *   `mangohud`: `sudo dnf install mangohud`
*   **Môi trường phần cứng MSI (Tùy chọn):** Laptop MSI và nhân Linux đã nạp mô-đun driver `msi-ec` để điều khiển quạt và giới hạn sạc.

---

## 🚀 Hướng Dẫn Cài Đặt & Phát Triển

### 1. Chuẩn bị môi trường phát triển
Yêu cầu đã cài đặt các công cụ sau trên máy:
*   **Node.js** >= 20 và công cụ quản lý gói **pnpm**
*   **Rust** >= 1.77
*   **Tauri CLI** >= 2.x

### 2. Cài đặt các gói phụ thuộc và chạy chế độ dev
```bash
# Cài đặt thư viện npm
pnpm install

# Chạy ứng dụng dưới chế độ kiểm thử (Development)
pnpm tauri:dev
```

### 3. Biên dịch và cấu hình đặc quyền hệ thống
Để kích hoạt đầy đủ các tính năng điều chỉnh phần cứng (quạt, pin, chế độ hiệu năng) hoạt động passwordless thông qua Polkit, hãy biên dịch ứng dụng và cài đặt helper:

```bash
# Biên dịch phiên bản Release
pnpm tauri:build

# Cài đặt helper nhị phân và thiết lập các quy tắc chính sách Polkit
sudo ./packaging/install.sh
```

> [!IMPORTANT]
> Script cài đặt `install.sh` sẽ thực hiện các bước sau:
> 1. Sao chép file nhị phân trợ lý `purrdora-helper` vào `/usr/libexec/purrdora-helper`.
> 2. Đăng ký hành động Polkit tại `/usr/share/polkit-1/actions/com.purrdora.pkexec.policy`.
> 3. Tạo quy tắc Polkit tại `/etc/polkit-1/rules.d/99-purrdora.rules` để cấp quyền chạy passwordless cho các hành động của Purrdora từ phiên đăng nhập cục bộ đang hoạt động.

---

## 📂 Cấu Trúc Thư Mục Dự Án

Sơ đồ cấu trúc thư mục quan trọng trên Purrdora:

```
├── assets/                          # Logo và tài nguyên tĩnh
├── packaging/
│   ├── install.sh                   # Script cài đặt Polkit Helper
│   ├── 99-purrdora.rules            # Quy tắc Polkit cấp quyền passwordless
│   └── com.purrdora.pkexec.policy   # Khai báo hành động đặc quyền Polkit
├── resources/
│   ├── 99-purrdora.rules
│   ├── fedora-system-control.desktop
│   └── install-autostart.sh
├── src/                             # Giao diện Frontend (React + TS + Tailwind v4)
│   ├── App.tsx                      # Giao diện chính của ứng dụng
│   ├── main.tsx                     # Điểm khởi chạy React
│   ├── index.css                    # Tệp định nghĩa kiểu Tailwind toàn cục
│   └── components/
│       ├── Layout.tsx               # Khung cửa sổ tuỳ chỉnh
│       ├── BottomDock.tsx           # Thanh dock điều hướng phía dưới
│       ├── MsiCenterPage.tsx        # Trang điều khiển phần cứng MSI Center
│       ├── GameModePage.tsx         # Trang quản lý GameMode & MangoHud
│       └── widgets/                 # Các khối widget hiển thị chỉ số chi tiết
└── src-tauri/                       # Backend (Tauri + Rust)
    ├── src/
    │   ├── main.rs                  # Điểm khởi chạy ứng dụng Tauri
    │   ├── lib.rs                   # Đăng ký lệnh IPC
    │   ├── monitor.rs               # Xử lý telemetry hệ thống (CPU/GPU/RAM/Network)
    │   ├── msi_ec.rs                # Giao tiếp với nhân driver msi-ec
    │   ├── helper.rs                # Mã nguồn tiến trình đặc quyền helper
    │   └── privileged.rs            # Giao tiếp nâng quyền với helper qua pkexec
```

---

## 📄 Giấy Phép (License)

Dự án này được phát hành dưới giấy phép **MIT**.
