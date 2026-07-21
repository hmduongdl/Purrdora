use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use std::time::Instant;

const CACHE_TTL_SECS: u64 = 300;

static CACHE: Mutex<Option<(Instant, FwupdStatus)>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize)]
pub struct FwupdDevice {
    pub name: String,
    pub device_id: String,
    pub current_version: String,
    pub update_version: Option<String>,
    pub update_description: Option<String>,
    pub update_urgent: bool,
    pub vendor: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FwupdStatus {
    pub available: bool,
    pub daemon_running: bool,
    pub devices: Vec<FwupdDevice>,
    pub update_count: usize,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct FwupdJson {
    #[serde(default)]
    Devices: Vec<FwupdJsonDevice>,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct FwupdJsonDevice {
    Name: Option<String>,
    DeviceId: String,
    Version: Option<String>,
    Vendor: Option<String>,
    #[serde(default)]
    Flags: Vec<String>,
    #[serde(default)]
    Releases: Vec<FwupdJsonRelease>,
}

#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
struct FwupdJsonRelease {
    Version: String,
    Description: Option<String>,
    Urgency: Option<String>,
}

fn run_fwupdmgr(args: &[&str]) -> Option<String> {
    Command::new("fwupdmgr")
        .args(args)
        .output()
        .ok()
        .filter(|out| out.status.success())
        .map(|out| String::from_utf8_lossy(&out.stdout).into_owned())
}

fn parse_fwupd_json(json: &str) -> Vec<FwupdJsonDevice> {
    serde_json::from_str::<FwupdJson>(json)
        .map(|parsed| parsed.Devices)
        .unwrap_or_default()
}

fn build_device_list(
    all_devices: Vec<FwupdJsonDevice>,
    updatable_devices: Vec<FwupdJsonDevice>,
) -> Vec<FwupdDevice> {
    let mut devices = Vec::new();

    for dev in all_devices {
        let has_name = dev.Name.is_some();
        let has_version = dev.Version.is_some();

        // Skip internal unnamed entries without actionable info
        let is_usable = has_name && has_version && !dev.Flags.iter().any(|f| f == "internal");

        if !is_usable {
            // Still include devices that have updates available, even if internal
            let has_update = updatable_devices.iter().any(|u| u.DeviceId == dev.DeviceId);
            if !has_update {
                continue;
            }
        }

        let name = dev.Name.unwrap_or_else(|| dev.DeviceId.clone());
        let current = dev.Version.unwrap_or_else(|| "—".into());
        let vendor = dev.Vendor.unwrap_or_else(|| "—".into());

        let update = updatable_devices.iter().find(|u| u.DeviceId == dev.DeviceId);
        let (update_version, update_description, update_urgent) = update
            .and_then(|u| u.Releases.first())
            .map(|rel| {
                (
                    Some(rel.Version.clone()),
                    rel.Description.clone(),
                    rel.Urgency.as_deref() == Some("high"),
                )
            })
            .unwrap_or((None, None, false));

        devices.push(FwupdDevice {
            name,
            device_id: dev.DeviceId,
            current_version: current,
            update_version,
            update_description,
            update_urgent,
            vendor,
        });
    }

    devices
}

fn fetch_fwupd_status() -> FwupdStatus {
    let available = Command::new("which")
        .arg("fwupdmgr")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !available {
        return FwupdStatus {
            available: false,
            daemon_running: false,
            devices: Vec::new(),
            update_count: 0,
        };
    }

    let daemon_running = run_fwupdmgr(&["get-devices", "--json"]).is_some();

    if !daemon_running {
        return FwupdStatus {
            available: true,
            daemon_running: false,
            devices: Vec::new(),
            update_count: 0,
        };
    }

    let all_json = run_fwupdmgr(&["get-devices", "--json"]);
    let updates_json = run_fwupdmgr(&["get-updates", "--json"]);

    let all_devices = all_json.as_deref().map(parse_fwupd_json).unwrap_or_default();
    let updatable = updates_json
        .as_deref()
        .map(parse_fwupd_json)
        .unwrap_or_default();

    let devices = build_device_list(all_devices, updatable);
    let update_count = devices.iter().filter(|d| d.update_version.is_some()).count();

    FwupdStatus {
        available: true,
        daemon_running: true,
        devices,
        update_count,
    }
}

#[tauri::command]
pub async fn check_firmware_updates() -> Result<FwupdStatus, String> {
    {
        let cache = CACHE.lock().unwrap();
        if let Some((timestamp, ref status)) = *cache {
            if timestamp.elapsed().as_secs() < CACHE_TTL_SECS {
                return Ok(status.clone());
            }
        }
    }

    let status = tokio::task::spawn_blocking(fetch_fwupd_status)
        .await
        .map_err(|e| format!("fwupd scan panicked: {e}"))?;

    if let Ok(mut cache) = CACHE.lock() {
        *cache = Some((Instant::now(), status.clone()));
    }

    Ok(status)
}

#[tauri::command]
pub async fn install_firmware_updates(device_ids: Vec<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        for device_id in &device_ids {
            let output = Command::new("pkexec")
                .args(["fwupdmgr", "update", device_id])
                .output()
                .map_err(|e| format!("Failed to run pkexec fwupdmgr: {e}"))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                return Err(format!("fwupdmgr update failed for {device_id}: {stderr}"));
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("install task panicked: {e}"))?
}
