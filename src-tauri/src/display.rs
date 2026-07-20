//! Display discovery for the dashboard.
//!
//! Monitor geometry is deliberately read from the compositor through Tauri,
//! rather than guessed from DRM connectors.  This makes the preview match the
//! actual GNOME arrangement on both Wayland and X11.

use std::fs;

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
pub struct DisplayInfo {
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[derive(Debug, Serialize)]
pub struct DisplayState {
    pub displays: Vec<DisplayInfo>,
    pub laptop_display_active: bool,
    pub mode: String,
}

fn laptop_panel_active() -> bool {
    let Ok(entries) = fs::read_dir("/sys/class/drm") else {
        return false;
    };

    entries.flatten().any(|entry| {
        let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        let is_internal = name.contains("-edp-") || name.contains("-lvds-") || name.contains("-dsi-");
        is_internal
            && fs::read_to_string(entry.path().join("status")).is_ok_and(|status| status.trim() == "connected")
            && fs::read_to_string(entry.path().join("enabled"))
                .map(|enabled| enabled.trim() == "enabled")
                // Some DRM drivers do not expose `enabled`; compositor
                // enumeration still confirms that an internal panel is live.
                .unwrap_or(true)
    })
}

#[tauri::command]
pub fn get_display_state(app: AppHandle) -> Result<DisplayState, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Không tìm thấy cửa sổ ứng dụng".to_owned())?;
    let current_position = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|monitor| monitor.position().clone());
    let mut displays = window
        .available_monitors()
        .map_err(|error| format!("Không thể đọc cấu hình màn hình: {error}"))?
        .into_iter()
        .enumerate()
        .map(|(index, monitor)| {
            let position = monitor.position();
            let size = monitor.size();
            let is_primary = current_position.is_some_and(|current| current == *position);
            DisplayInfo {
                id: format!("{}:{}", position.x, position.y),
                name: monitor.name().map_or("Màn hình", String::as_str).to_owned(),
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                scale_factor: monitor.scale_factor(),
                is_primary: is_primary || (current_position.is_none() && index == 0),
            }
        })
        .collect::<Vec<_>>();
    displays.sort_by_key(|display| (display.x, display.y, display.name.clone()));

    let mode = if displays.len() <= 1 {
        "single".to_owned()
    } else if displays.iter().map(|display| (display.x, display.y)).collect::<std::collections::HashSet<_>>().len() < displays.len() {
        "mirror".to_owned()
    } else {
        "extend".to_owned()
    };

    Ok(DisplayState {
        laptop_display_active: laptop_panel_active(),
        displays,
        mode,
    })
}

#[tauri::command]
pub async fn open_display_settings() -> Result<(), String> {
    tokio::process::Command::new("gnome-control-center")
        .arg("display")
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Không thể mở phần Màn hình của Cài đặt Fedora: {error}"))
}
