use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct TouchpadState {
    pub enabled: bool,
}

fn touchpad_value() -> Result<String, String> {
    let output = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.peripherals.touchpad", "send-events"])
        .output()
        .map_err(|error| format!("Không thể đọc trạng thái touchpad: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "GNOME không hỗ trợ điều khiển touchpad: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .trim()
        .trim_matches('\'')
        .to_owned())
}

fn touchpad_enabled(value: &str) -> Result<bool, String> {
    match value {
        "enabled" => Ok(true),
        "disabled" => Ok(false),
        "disabled-on-external-mouse" => Ok(true),
        other => Err(format!("Trạng thái touchpad không hợp lệ từ GNOME: {other}")),
    }
}

#[tauri::command]
pub fn get_touchpad_state() -> Result<TouchpadState, String> {
    let value = touchpad_value()?;
    Ok(TouchpadState {
        enabled: touchpad_enabled(&value)?,
    })
}

#[tauri::command]
pub fn set_touchpad_enabled(enabled: bool) -> Result<TouchpadState, String> {
    let status = Command::new("gsettings")
        .args([
            "set",
            "org.gnome.desktop.peripherals.touchpad",
            "send-events",
            if enabled { "enabled" } else { "disabled" },
        ])
        .status()
        .map_err(|error| format!("Không thể cập nhật touchpad: {error}"))?;

    if !status.success() {
        return Err(format!(
            "GNOME từ chối thay đổi trạng thái touchpad: {}",
            status
        ));
    }

    let state = get_touchpad_state()?;
    if state.enabled != enabled {
        return Err("GNOME chưa áp dụng trạng thái touchpad được yêu cầu".to_owned());
    }
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::touchpad_enabled;

    #[test]
    fn maps_gnome_touchpad_states() {
        assert_eq!(touchpad_enabled("enabled"), Ok(true));
        assert_eq!(touchpad_enabled("disabled"), Ok(false));
        assert_eq!(touchpad_enabled("disabled-on-external-mouse"), Ok(true));
        assert!(touchpad_enabled("unexpected").is_err());
    }
}
