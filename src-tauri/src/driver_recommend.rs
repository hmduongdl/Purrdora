use serde::Serialize;
use std::collections::HashMap;

use crate::driver_scan::OrphanDevice;

// ---------------------------------------------------------------------------
// Distro detection
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum DistroFamily {
    Fedora,
    Debian,
    Arch,
    OpenSUSE,
    Unknown,
}

impl DistroFamily {
    fn current() -> Self {
        let os_release = match std::fs::read_to_string("/etc/os-release") {
            Ok(c) => c,
            Err(_) => return Self::Unknown,
        };

        let id = os_release
            .lines()
            .find_map(|l| l.strip_prefix("ID="))
            .map(|v| v.trim_matches('"').to_lowercase())
            .unwrap_or_default();

        let id_like = os_release
            .lines()
            .find_map(|l| l.strip_prefix("ID_LIKE="))
            .map(|v| v.trim_matches('"').to_lowercase())
            .unwrap_or_default();

        // Fast exact match
        match id.as_str() {
            "fedora" | "rhel" | "centos" | "almalinux" | "rocky" | "nobara" => return Self::Fedora,
            "debian" | "ubuntu" | "pop" | "linuxmint" | "elementary" | "zorin" | "kali" | "parrot" | "deepin" => {
                return Self::Debian
            }
            "arch" | "endeavouros" | "manjaro" | "garuda" | "cachyos" | "artix" => return Self::Arch,
            "opensuse" | "opensuse-tumbleweed" | "opensuse-leap" => return Self::OpenSUSE,
            _ => {}
        }

        // Fallback: ID_LIKE
        if id_like.contains("fedora") || id_like.contains("rhel") {
            return Self::Fedora;
        }
        if id_like.contains("debian") || id_like.contains("ubuntu") {
            return Self::Debian;
        }
        if id_like.contains("arch") {
            return Self::Arch;
        }
        if id_like.contains("suse") {
            return Self::OpenSUSE;
        }

        Self::Unknown
    }
}

// ---------------------------------------------------------------------------
// Recommendation struct
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverRecommendation {
    pub device_name: String,
    pub packages: Vec<String>,
    pub install_command: String,
    pub description: String,
    pub distro_name: String,
}

// ---------------------------------------------------------------------------
// Per-distro package info
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct DriverInfo {
    description: &'static str,
    packages: Vec<(DistroFamily, Vec<&'static str>, &'static str)>,
}

fn install_cmd_prefix(d: DistroFamily) -> &'static str {
    match d {
        DistroFamily::Fedora => "sudo dnf install -y",
        DistroFamily::Debian => "sudo apt install -y",
        DistroFamily::Arch => "sudo pacman -S --noconfirm",
        DistroFamily::OpenSUSE => "sudo zypper install -y",
        DistroFamily::Unknown => "",
    }
}

// ---------------------------------------------------------------------------
// Hardware → Driver mapping table
// ---------------------------------------------------------------------------

fn driver_rules() -> HashMap<(u16, Option<u16>), DriverInfo> {
    let mut db: HashMap<(u16, Option<u16>), DriverInfo> = HashMap::new();

    // ---- NVIDIA GPUs (vendor 0x10de) ----
    let nvidia = DriverInfo {
        description: "NVIDIA proprietary driver — required for CUDA, NVENC, and full 3D performance.",
        packages: vec![
            (
                DistroFamily::Fedora,
                vec!["akmod-nvidia"],
                "sudo dnf install -y akmod-nvidia && sudo dnf install -y xorg-x11-drv-nvidia-cuda",
            ),
            (
                DistroFamily::Debian,
                vec!["nvidia-driver"],
                "sudo apt install -y nvidia-driver",
            ),
            (
                DistroFamily::Arch,
                vec!["nvidia", "nvidia-utils"],
                "sudo pacman -S --noconfirm nvidia nvidia-utils",
            ),
            (
                DistroFamily::OpenSUSE,
                vec!["nvidia-driver-G06", "nvidia-utils-G06"],
                "sudo zypper install -y nvidia-driver-G06 nvidia-utils-G06",
            ),
        ],
    };
    // Match ALL NVIDIA devices (vendor 0x10de = 4318)
    db.insert((0x10de, None), nvidia);

    // ---- Intel WiFi / Bluetooth (vendor 0x8086) ----
    let intel_wifi = DriverInfo {
        description: "Intel WiFi firmware — required for AX200/AX201/AX210/AX211/AC-9xxx chipsets.",
        packages: vec![
            (
                DistroFamily::Fedora,
                vec!["iwlwifi-dvm-firmware", "iwlwifi-mvm-firmware"],
                "sudo dnf install -y iwlwifi-dvm-firmware iwlwifi-mvm-firmware",
            ),
            (
                DistroFamily::Debian,
                vec!["firmware-iwlwifi"],
                "sudo apt install -y firmware-iwlwifi",
            ),
            (
                DistroFamily::Arch,
                vec!["linux-firmware"],
                "sudo pacman -S --noconfirm linux-firmware",
            ),
            (
                DistroFamily::OpenSUSE,
                vec!["kernel-firmware-intel"],
                "sudo zypper install -y kernel-firmware-intel",
            ),
        ],
    };
    // Common Intel WiFi device IDs
    for did in [
        0x02f0, 0x06f0, 0x2723, 0x2725, 0x2526, 0x271b, 0x271c, 0x31dc,
        0x34f0, 0x43f0, 0x4df0, 0x51f0, 0x51f1, 0x54f0, 0x57a0, 0x57a1, 0x7a70,
        0x7af0, 0x9df0, 0xa0f0, 0xa370,
    ] {
        db.insert((0x8086, Some(did)), intel_wifi.clone());
    }

    // ---- Realtek WiFi (vendor 0x10ec) ----
    let realtek_wifi = DriverInfo {
        description: "Realtek WiFi firmware — covers RTL8188/8192/8723/8821/8822/8852 series.",
        packages: vec![
            (
                DistroFamily::Fedora,
                vec!["linux-firmware"],
                "sudo dnf install -y linux-firmware",
            ),
            (
                DistroFamily::Debian,
                vec!["firmware-realtek"],
                "sudo apt install -y firmware-realtek",
            ),
            (
                DistroFamily::Arch,
                vec!["linux-firmware"],
                "sudo pacman -S --noconfirm linux-firmware",
            ),
            (
                DistroFamily::OpenSUSE,
                vec!["kernel-firmware-realtek"],
                "sudo zypper install -y kernel-firmware-realtek",
            ),
        ],
    };
    // Realtek WiFi device IDs
    for did in [
        0x8176, 0x8178, 0x8179, 0x818b, 0x8192, 0x8723, 0x8812, 0x8821,
        0x8822, 0x8852, 0xb822, 0xb852, 0xc821, 0xc822, 0xc82f, 0xc852,
        0xd723,
    ] {
        db.insert((0x10ec, Some(did)), realtek_wifi.clone());
    }

    // ---- Realtek Ethernet (vendor 0x10ec, different class) ----
    // r8168/r8169 — included in kernel, but some distros want r8168-dkms
    let realtek_eth = DriverInfo {
        description: "Realtek Ethernet (RTL8111/8168/8125) — r8168-dkms provides better stability on some hardware.",
        packages: vec![
            (
                DistroFamily::Fedora,
                vec!["r8168"],
                "sudo dnf install -y r8168",
            ),
            (
                DistroFamily::Debian,
                vec!["r8168-dkms"],
                "sudo apt install -y r8168-dkms",
            ),
            (
                DistroFamily::Arch,
                vec!["r8168"],
                "sudo pacman -S --noconfirm r8168",
            ),
            (
                DistroFamily::OpenSUSE,
                vec!["r8168-kmp-default"],
                "sudo zypper install -y r8168-kmp-default",
            ),
        ],
    };
    for did in [0x8168, 0x8111, 0x8125, 0x3000] {
        db.insert((0x10ec, Some(did)), realtek_eth.clone());
    }

    // ---- Broadcom WiFi (vendor 0x14e4) ----
    let broadcom_wifi = DriverInfo {
        description: "Broadcom Wireless — broadcom-wl (STA) for BCM4311/4312/4313/4321/4322/4331/4352/4360.",
        packages: vec![
            (
                DistroFamily::Fedora,
                vec!["broadcom-wl", "akmod-wl"],
                "sudo dnf install -y broadcom-wl akmod-wl",
            ),
            (
                DistroFamily::Debian,
                vec!["broadcom-sta-dkms"],
                "sudo apt install -y broadcom-sta-dkms",
            ),
            (
                DistroFamily::Arch,
                vec!["broadcom-wl-dkms"],
                "sudo pacman -S --noconfirm broadcom-wl-dkms",
            ),
            (
                DistroFamily::OpenSUSE,
                vec!["broadcom-wl"],
                "sudo zypper install -y broadcom-wl",
            ),
        ],
    };
    for did in [
        0x4311, 0x4312, 0x4313, 0x4315, 0x4321, 0x4322, 0x4328, 0x4329,
        0x432b, 0x432c, 0x4331, 0x4350, 0x4352, 0x4353, 0x4358, 0x4359,
        0x4360, 0x4365, 0x43a0, 0x43a3, 0x43b1, 0x43ba, 0x43c3,
    ] {
        db.insert((0x14e4, Some(did)), broadcom_wifi.clone());
    }

    // ---- MediaTek WiFi (vendor 0x14c3) ----
    let mediatek_wifi = DriverInfo {
        description: "MediaTek WiFi firmware — MT7601/MT7610/MT7612/MT7615/MT7663/MT7921/MT7922 (mt76).",
        packages: vec![
            (
                DistroFamily::Fedora,
                vec!["linux-firmware"],
                "sudo dnf install -y linux-firmware",
            ),
            (
                DistroFamily::Debian,
                vec!["firmware-mediatek"],
                "sudo apt install -y firmware-mediatek",
            ),
            (
                DistroFamily::Arch,
                vec!["linux-firmware"],
                "sudo pacman -S --noconfirm linux-firmware",
            ),
            (
                DistroFamily::OpenSUSE,
                vec!["kernel-firmware-mediatek"],
                "sudo zypper install -y kernel-firmware-mediatek",
            ),
        ],
    };
    for did in [
        0x7601, 0x7610, 0x7612, 0x7615, 0x7630, 0x7662, 0x7663, 0x7921,
        0x7922, 0x7961, 0x0608, 0x0616, 0x7902,
    ] {
        db.insert((0x14c3, Some(did)), mediatek_wifi.clone());
    }

    // ---- AMD GPU (vendor 0x1002) — amdgpu firmware ----
    let amdgpu = DriverInfo {
        description: "AMD GPU firmware — amdgpu module is built into the kernel; firmware is needed for hardware acceleration.",
        packages: vec![
            (
                DistroFamily::Fedora,
                vec!["linux-firmware"],
                "sudo dnf install -y linux-firmware",
            ),
            (
                DistroFamily::Debian,
                vec!["firmware-amd-graphics"],
                "sudo apt install -y firmware-amd-graphics",
            ),
            (
                DistroFamily::Arch,
                vec!["linux-firmware"],
                "sudo pacman -S --noconfirm linux-firmware",
            ),
            (
                DistroFamily::OpenSUSE,
                vec!["kernel-firmware-amdgpu"],
                "sudo zypper install -y kernel-firmware-amdgpu",
            ),
        ],
    };
    // Match all AMD devices (vendor 0x1002 = 4098)
    db.insert((0x1002, None), amdgpu);

    db
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_driver_recommendation(device: OrphanDevice) -> Option<DriverRecommendation> {
    let vendor_id = u16::from_str_radix(&device.vendor_id, 16).ok()?;
    let device_id = u16::from_str_radix(&device.device_id, 16).ok()?;

    let rules = driver_rules();

    // Try exact (vendor, device) match first, then vendor-only fallback
    let info = rules
        .get(&(vendor_id, Some(device_id)))
        .or_else(|| rules.get(&(vendor_id, None)))?;

    let distro = DistroFamily::current();

    let (pkgs, install_cmd) = info
        .packages
        .iter()
        .find(|(d, _, _)| *d == distro)
        .map(|(_, p, c)| (p.iter().map(|s| s.to_string()).collect(), c.to_string()))
        .unwrap_or_else(|| {
            // Distro unknown — return a generic hint
            let prefix = install_cmd_prefix(distro);
            (
                vec!["linux-firmware".into()],
                format!("{prefix} linux-firmware"),
            )
        });

    let name = device
        .device_name
        .as_deref()
        .unwrap_or(&device.device_id)
        .to_owned();

    Some(DriverRecommendation {
        device_name: name,
        packages: pkgs,
        install_command: install_cmd,
        description: info.description.to_string(),
        distro_name: format!("{distro:?}"),
    })
}
