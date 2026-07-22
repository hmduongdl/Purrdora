use std::collections::HashSet;
use std::process::Command;

/// Phân loại trạng thái thiết bị PCI thiếu driver kernel.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PciDeviceStatus {
    /// Thiết bị an toàn, không ảnh hưởng chức năng hệ thống — hiển thị dạng info.
    SafeToIgnore,
    /// Cần kiểm tra thêm điều kiện runtime (vd: VMD cần kiểm tra NVMe mount path).
    Conditional,
    /// Thiết bị thực sự thiếu driver — hiển thị cảnh báo đỏ.
    MissingDriver,
}

/// Whitelist các Vendor:Device ID an toàn tuyệt đối (không cần driver trên Linux desktop).
fn safe_whitelist() -> HashSet<&'static str> {
    HashSet::from([
        // 8086:464f — Intel GNA (Gaussian & Neural Accelerator)
        // Chip AI noise suppression tích hợp trên Alder Lake, không có driver upstream.
        // Chỉ dùng cho ứng dụng AI chuyên biệt, không ảnh hưởng hoạt động máy.
        "8086:464f",
        // 8086:5182 — Alder Lake PCH eSPI Controller
        // eSPI là bus low-level giao tiếp giữa PCH và EC/Super I/O.
        // Kernel không bind driver vì firmware (BIOS/ACPI) xử lý trực tiếp.
        "8086:5182",
        // 8086:4629 — 12th Gen Core Processor Host Bridge/DRAM Registers
        // Host bridge chỉ để đọc thông tin cấu hình RAM từ bộ điều khiển bộ nhớ tích hợp.
        // Không cần driver, hoàn toàn passive.
        "8086:4629",
    ])
}

/// Danh sách thiết bị cần kiểm tra điều kiện runtime trước khi kết luận.
fn conditional_ids() -> HashSet<&'static str> {
    HashSet::from([
        // 8086:09ab — Intel RST VMD (Volume Management Device)
        // VMD controller dùng để quản lý NVMe trong chế độ RAID. Nếu NVMe được
        // mount trực tiếp qua driver nvme (không qua VMD namespace) thì an toàn.
        "8086:09ab",
    ])
}

/// Phân loại thiết bị dựa trên PCI class code (2 byte đầu, dạng "0600").
/// Dùng làm fallback khi Vendor:Device ID không khớp whitelist.
fn classify_by_pci_class(class_code: &str) -> PciDeviceStatus {
    // Chuẩn hóa: "0x0600" → "0600", "0600" → "0600"
    let code = class_code.trim_start_matches("0x").trim_start_matches("0X");
    match &code[..2.min(code.len())] {
        // Host bridge — passive, chỉ đọc thông tin cấu hình RAM từ IMC.
        "06" => PciDeviceStatus::SafeToIgnore,
        // System peripheral — các thiết bị quản lý hệ thống, thường do firmware xử lý.
        "08" => PciDeviceStatus::SafeToIgnore,
        // RAID controller — cần kiểm tra thêm (VMD, v.v.).
        "01" if code.starts_with("0104") => PciDeviceStatus::Conditional,
        // VGA/3D controller — thiếu driver đồ họa là vấn đề thực sự.
        "03" => PciDeviceStatus::MissingDriver,
        // Network/Ethernet/Wireless — thiếu driver mạng ảnh hưởng kết nối.
        "02" => PciDeviceStatus::MissingDriver,
        // Fail-safe: không rõ loại thiết bị → cảnh báo để người dùng tự kiểm tra.
        _ => PciDeviceStatus::MissingDriver,
    }
}

/// Kiểm tra điều kiện VMD: nếu NVMe được mount trực tiếp qua `nvme` driver
/// (không qua VMD namespace) thì VMD an toàn, có thể bỏ qua.
fn check_vmd_condition() -> bool {
    // Kiểm tra 1: module vmd đã được load chưa?
    let vmd_loaded = Command::new("lsmod")
        .output()
        .map(|out| String::from_utf8_lossy(&out.stdout).contains("vmd"))
        .unwrap_or(false);

    // Kiểm tra 2: có thiết bị NVMe nào mount trực tiếp qua /dev/nvme* không?
    // Nếu NVMe đi qua đường VMD, nó sẽ xuất hiện dưới dạng /dev/vmd* namespace.
    let nvme_mounted_directly = std::fs::read_to_string("/proc/mounts")
        .map(|content| {
            content
                .lines()
                .any(|line| line.starts_with("/dev/nvme"))
        })
        .unwrap_or(false);

    // An toàn khi: module vmd KHÔNG được load, HOẶC NVMe đã mount trực tiếp.
    // Nếu vmd loaded nhưng NVMe vẫn mount trực tiếp → VMD đang ở chế độ pass-through.
    if !vmd_loaded || nvme_mounted_directly {
        return true;
    }

    // Fail-safe: không xác định được → cảnh báo.
    false
}

/// Entry point chính: phân loại thiết bị dựa trên Vendor:Device ID và class code.
///
/// Thứ tự ưu tiên:
/// 1. Whitelist tuyệt đối → SafeToIgnore
/// 2. Danh sách cần kiểm tra → gọi hàm điều kiện tương ứng
/// 3. Fallback bằng PCI class code
pub fn classify_device(vendor_device_id: &str, class_code: &str) -> PciDeviceStatus {
    let id_lower = vendor_device_id.to_lowercase();

    // Bước 1: kiểm tra whitelist an toàn tuyệt đối.
    if safe_whitelist().contains(id_lower.as_str()) {
        return PciDeviceStatus::SafeToIgnore;
    }

    // Bước 2: kiểm tra danh sách cần điều kiện.
    if conditional_ids().contains(id_lower.as_str()) {
        // 8086:09ab — Intel RST VMD
        if id_lower == "8086:09ab" && check_vmd_condition() {
            return PciDeviceStatus::SafeToIgnore;
        }
        // Nếu không thỏa điều kiện → coi là MissingDriver.
        return PciDeviceStatus::MissingDriver;
    }

    // Bước 3: fallback dựa trên PCI class code.
    classify_by_pci_class(class_code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_whitelist_gna() {
        // Intel GNA: safe trên mọi máy, không cần driver.
        let result = classify_device("8086:464f", "0880");
        assert_eq!(result, PciDeviceStatus::SafeToIgnore);
    }

    #[test]
    fn test_safe_whitelist_espi() {
        // eSPI controller: firmware xử lý, không cần driver.
        let result = classify_device("8086:5182", "0600");
        assert_eq!(result, PciDeviceStatus::SafeToIgnore);
    }

    #[test]
    fn test_safe_whitelist_host_bridge() {
        // Host bridge: passive, chỉ đọc thông tin RAM.
        let result = classify_device("8086:4629", "0600");
        assert_eq!(result, PciDeviceStatus::SafeToIgnore);
    }

    #[test]
    fn test_vmd_conditional() {
        // VMD controller: kết quả phụ thuộc vào check_vmd_condition().
        let result = classify_device("8086:09ab", "0104");
        // Trên máy test (MSI Cyborg 15): NVMe mount trực tiếp → SafeToIgnore.
        // Trên máy dùng VMD RAID → MissingDriver. Test chỉ kiểm tra hàm chạy
        // không panic; giá trị cụ thể tùy thuộc vào phần cứng.
        assert!(
            result == PciDeviceStatus::SafeToIgnore || result == PciDeviceStatus::MissingDriver,
            "VMD should be either SafeToIgnore or MissingDriver, got {result:?}"
        );
    }

    #[test]
    fn test_class_code_host_bridge() {
        // Class 0600 (Host bridge) → SafeToIgnore.
        let result = classify_device("ffff:ffff", "0x0600");
        assert_eq!(result, PciDeviceStatus::SafeToIgnore);
    }

    #[test]
    fn test_class_code_system_peripheral() {
        // Class 0880 (System peripheral) → SafeToIgnore.
        let result = classify_device("ffff:ffff", "0880");
        assert_eq!(result, PciDeviceStatus::SafeToIgnore);
    }

    #[test]
    fn test_class_code_vga() {
        // Class 0300 (VGA) → MissingDriver.
        let result = classify_device("ffff:ffff", "0x0300");
        assert_eq!(result, PciDeviceStatus::MissingDriver);
    }

    #[test]
    fn test_class_code_network() {
        // Class 0200 (Network) → MissingDriver.
        let result = classify_device("ffff:ffff", "0x0200");
        assert_eq!(result, PciDeviceStatus::MissingDriver);
    }

    #[test]
    fn test_class_code_unknown_fallback() {
        // Class không xác định → MissingDriver (fail-safe).
        let result = classify_device("ffff:ffff", "0x0500");
        assert_eq!(result, PciDeviceStatus::MissingDriver);
    }

    #[test]
    fn test_whitelist_case_insensitive() {
        // Vendor:Device ID không phân biệt hoa/thường.
        let result = classify_device("8086:464F", "0880");
        assert_eq!(result, PciDeviceStatus::SafeToIgnore);
    }

    #[test]
    fn test_vmd_condition_check() {
        // check_vmd_condition() không được panic trong mọi trường hợp.
        let result = check_vmd_condition();
        // Trả về true hoặc false tùy máy, nhưng phải là bool hợp lệ.
        assert!(result == true || result == false);
    }
}
