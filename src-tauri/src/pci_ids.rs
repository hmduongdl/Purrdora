use std::collections::HashMap;
use std::sync::OnceLock;

static HW_DB: OnceLock<HardwareDb> = OnceLock::new();

const PCI_PATHS: &[&str] = &[
    "/usr/share/hwdata/pci.ids",
    "/usr/share/misc/pci.ids",
];

const USB_PATHS: &[&str] = &[
    "/usr/share/hwdata/usb.ids",
    "/usr/share/misc/usb.ids",
];

#[derive(Debug, Clone)]
pub struct HardwareDb {
    devices: HashMap<(u16, u16), String>,
    vendors: HashMap<u16, String>,
}

impl HardwareDb {
    fn empty() -> Self {
        Self {
            devices: HashMap::new(),
            vendors: HashMap::new(),
        }
    }

    fn from_file(path: &str) -> Option<Self> {
        let content = std::fs::read_to_string(path).ok()?;
        Some(Self::parse(&content))
    }

    fn from_files(paths: &[&str]) -> Self {
        for path in paths {
            if let Some(db) = Self::from_file(path) {
                return db;
            }
        }
        Self::empty()
    }

    fn parse(content: &str) -> Self {
        let mut devices: HashMap<(u16, u16), String> = HashMap::new();
        let mut vendors: HashMap<u16, String> = HashMap::new();
        let mut current_vendor: Option<(u16, String)> = None;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let tab_count = line.chars().take_while(|&c| c == '\t').count();

            match tab_count {
                0 => {
                    if let Some((id, name)) = parse_vendor_line(trimmed) {
                        vendors.insert(id, name.clone());
                        current_vendor = Some((id, name));
                    }
                }
                1 => {
                    if let (Some((vid, vname)), Some((did, dname))) =
                        (&current_vendor, parse_device_line(trimmed))
                    {
                        devices.insert((*vid, did), format!("{} {}", vname, dname));
                    }
                }
                _ => {} // skip subsystem/interface lines (2+ tabs)
            }
        }

        Self { devices, vendors }
    }

    pub fn resolve_name(&self, vendor: u16, device: u16) -> Option<&str> {
        self.devices.get(&(vendor, device)).map(|s| s.as_str())
    }

    pub fn resolve_vendor_name(&self, vendor: u16) -> Option<&str> {
        self.vendors.get(&vendor).map(|s| s.as_str())
    }
}

fn parse_vendor_line(line: &str) -> Option<(u16, String)> {
    let (id_str, name) = split_first_word(line)?;
    let id = u16::from_str_radix(id_str, 16).ok()?;
    Some((id, name.to_string()))
}

fn parse_device_line(line: &str) -> Option<(u16, String)> {
    let (id_str, name) = split_first_word(line)?;
    let id = u16::from_str_radix(id_str, 16).ok()?;
    Some((id, name.to_string()))
}

fn split_first_word(s: &str) -> Option<(&str, &str)> {
    let s = s.trim();
    let pos = s.find(|c: char| c.is_ascii_whitespace())?;
    Some((&s[..pos], s[pos..].trim()))
}

pub fn init() {
    HW_DB.get_or_init(|| {
        let mut pci = HardwareDb::from_files(PCI_PATHS);
        let usb = HardwareDb::from_files(USB_PATHS);
        pci.devices.extend(usb.devices);
        pci.vendors.extend(usb.vendors);
        pci
    });
}

pub fn resolve_pci_name(vendor: u16, device: u16) -> Option<String> {
    HW_DB
        .get()
        .and_then(|db| db.resolve_name(vendor, device))
        .map(str::to_string)
}

pub fn resolve_vendor_name(vendor: u16) -> Option<String> {
    HW_DB
        .get()
        .and_then(|db| db.resolve_vendor_name(vendor))
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_nvidia_vendor() {
        let sample = "10de  NVIDIA Corporation\n\t25a2  GA107M [GeForce RTX 3050 Mobile]";
        let db = HardwareDb::parse(sample);
        assert_eq!(
            db.resolve_name(0x10de, 0x25a2),
            Some("NVIDIA Corporation GA107M [GeForce RTX 3050 Mobile]")
        );
        assert_eq!(
            db.resolve_vendor_name(0x10de),
            Some("NVIDIA Corporation")
        );
    }

    #[test]
    fn parse_intel_vendor() {
        let sample = "8086  Intel Corporation\n\t46a6  Alder Lake-P Integrated Graphics Controller";
        let db = HardwareDb::parse(sample);
        assert_eq!(
            db.resolve_name(0x8086, 0x46a6),
            Some("Intel Corporation Alder Lake-P Integrated Graphics Controller")
        );
    }

    #[test]
    fn skip_comments_and_subsystems() {
        let sample = "# Comment line\n0014  Loongson Technology LLC\n\t7a00  7A1000 Chipset Hyper Transport Bridge Controller\n\t\t0014 7a00  Subsystem Name";
        let db = HardwareDb::parse(sample);
        assert_eq!(db.devices.len(), 1);
        assert_eq!(db.vendors.len(), 1);
    }

    #[test]
    fn empty_db_returns_none() {
        let db = HardwareDb::empty();
        assert!(db.resolve_name(0x10de, 0x25a2).is_none());
        assert!(db.resolve_vendor_name(0x10de).is_none());
    }
}
