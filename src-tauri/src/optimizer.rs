use serde::{Deserialize, Serialize};
use std::{
    fs,
    process::{Child, Command},
    sync::Mutex,
};
use zbus::proxy;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PowerProfile {
    PowerSaver,
    Balanced,
    Performance,
}

#[derive(Debug, Serialize)]
pub struct ToggleResult {
    pub active: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ShutdownTimerResult {
    pub active: bool,
    pub minutes: Option<u32>,
    pub message: String,
}

pub struct KeepAwakeState(Mutex<Option<Child>>);

impl KeepAwakeState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    pub fn stop(&self) {
        if let Ok(mut inhibitor) = self.0.lock() {
            if let Some(mut child) = inhibitor.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

impl PowerProfile {
    fn as_dbus_value(&self) -> &'static str {
        match self {
            Self::PowerSaver => "power-saver",
            Self::Balanced => "balanced",
            Self::Performance => "performance",
        }
    }
}

#[proxy(
    interface = "org.freedesktop.UPower.PowerProfiles",
    default_service = "org.freedesktop.UPower.PowerProfiles",
    default_path = "/org/freedesktop/UPower/PowerProfiles"
)]
trait PowerProfiles {
    fn set_profile(&self, profile: &str) -> zbus::Result<()>;
    #[zbus(property, name = "ActiveProfile")]
    fn active_profile(&self) -> zbus::Result<String>;
}

#[proxy(
    interface = "com.feralinteractive.GameMode",
    default_service = "com.feralinteractive.GameMode",
    default_path = "/com/feralinteractive/GameMode"
)]
trait GameMode {
    #[zbus(name = "RegisterGame")]
    fn register_game(&self, pid: u32) -> zbus::Result<()>;
    #[zbus(name = "UnregisterGame")]
    fn unregister_game(&self, pid: u32) -> zbus::Result<()>;
    #[zbus(name = "QueryStatus")]
    fn query_status(&self) -> zbus::Result<u32>;
}

#[tauri::command]
pub async fn set_power_profile(
    profile: PowerProfile,
    telemetry: tauri::State<'_, crate::monitor::TelemetryEngine>,
) -> Result<String, String> {
    let connection = zbus::Connection::system()
        .await
        .map_err(|e| format!("power profile system bus unavailable: {e}"))?;
    let proxy = PowerProfilesProxy::new(&connection)
        .await
        .map_err(|e| format!("power profile daemon unavailable: {e}"))?;
    proxy
        .set_profile(profile.as_dbus_value())
        .await
        .map_err(|e| format!("power profile rejected: {e}"))?;
    let active_profile = proxy
        .active_profile()
        .await
        .map_err(|e| format!("power profile could not be verified: {e}"))?;
    telemetry.record_profile_switch();
    Ok(active_profile)
}

#[tauri::command]
pub async fn toggle_gamemode() -> Result<String, String> {
    let connection = zbus::Connection::session()
        .await
        .map_err(|e| format!("GameMode session bus unavailable: {e}"))?;
    let proxy = GameModeProxy::new(&connection)
        .await
        .map_err(|e| format!("GameMode daemon unavailable: {e}"))?;
    let pid = std::process::id();
    let status = proxy
        .query_status()
        .await
        .map_err(|e| format!("GameMode status query failed: {e}"))?;
    if status == 0 {
        proxy
            .register_game(pid)
            .await
            .map_err(|e| format!("GameMode activation rejected: {e}"))?;
        Ok("GameMode enabled".to_owned())
    } else {
        proxy
            .unregister_game(pid)
            .await
            .map_err(|e| format!("GameMode deactivation rejected: {e}"))?;
        Ok("GameMode disabled".to_owned())
    }
}

#[tauri::command]
pub async fn check_gamemode_status() -> Result<String, String> {
    let connection = zbus::Connection::session()
        .await
        .map_err(|e| format!("GameMode session bus unavailable: {e}"))?;
    let proxy = GameModeProxy::new(&connection)
        .await
        .map_err(|e| format!("GameMode daemon unavailable: {e}"))?;
    let status = proxy
        .query_status()
        .await
        .map_err(|e| format!("GameMode status query failed: {e}"))?;
    Ok(if status == 0 { "inactive" } else { "active" }.to_owned())
}

#[tauri::command]
pub fn clear_ram_cache() -> Result<String, String> {
    fs::write("/proc/sys/vm/drop_caches", b"3\n")
        .map_err(|e| format!("drop caches denied by the OS: {e}"))?;
    Ok("RAM cache dropped".to_owned())
}

#[tauri::command]
pub fn toggle_do_not_disturb() -> Result<ToggleResult, String> {
    let output = Command::new("gsettings")
        .args(["get", "org.gnome.desktop.notifications", "show-banners"])
        .output()
        .map_err(|error| format!("GNOME notification settings unavailable: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "could not read GNOME notification setting: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let banners_visible = match String::from_utf8_lossy(&output.stdout).trim() {
        "true" => true,
        "false" => false,
        value => return Err(format!("unexpected GNOME notification setting: {value}")),
    };
    let do_not_disturb = banners_visible;
    let status = Command::new("gsettings")
        .args([
            "set",
            "org.gnome.desktop.notifications",
            "show-banners",
            if do_not_disturb { "false" } else { "true" },
        ])
        .status()
        .map_err(|error| format!("could not update GNOME notification setting: {error}"))?;
    if !status.success() {
        return Err("GNOME rejected the Do Not Disturb change".to_owned());
    }

    Ok(ToggleResult {
        active: do_not_disturb,
        message: if do_not_disturb {
            "Do Not Disturb enabled"
        } else {
            "Do Not Disturb disabled"
        }
        .to_owned(),
    })
}

#[tauri::command]
pub fn toggle_keep_awake(state: tauri::State<'_, KeepAwakeState>) -> Result<ToggleResult, String> {
    let mut inhibitor = state
        .0
        .lock()
        .map_err(|_| "Keep Awake state is unavailable".to_owned())?;

    if let Some(child) = inhibitor.as_mut() {
        match child.try_wait() {
            Ok(None) => {
                child
                    .kill()
                    .map_err(|error| format!("could not stop Keep Awake inhibitor: {error}"))?;
                let _ = child.wait();
                *inhibitor = None;
                return Ok(ToggleResult {
                    active: false,
                    message: "Keep Awake disabled".to_owned(),
                });
            }
            Ok(Some(_)) => *inhibitor = None,
            Err(error) => return Err(format!("could not inspect Keep Awake inhibitor: {error}")),
        }
    }

    let child = Command::new("systemd-inhibit")
        .args([
            "--what=idle:sleep",
            "--mode=block",
            "--why=Purrdora Keep Awake",
            "sleep",
            "infinity",
        ])
        .spawn()
        .map_err(|error| format!("could not start systemd inhibitor: {error}"))?;
    *inhibitor = Some(child);

    Ok(ToggleResult {
        active: true,
        message: "Keep Awake enabled".to_owned(),
    })
}

#[tauri::command]
pub fn set_shutdown_timer(minutes: Option<u32>) -> Result<ShutdownTimerResult, String> {
    match minutes {
        Some(minutes) if (1..=1_440).contains(&minutes) => {
            let output = Command::new("shutdown")
                .args(["-h", &format!("+{minutes}")])
                .output()
                .map_err(|error| format!("could not schedule shutdown: {error}"))?;
            if !output.status.success() {
                return Err(format!(
                    "shutdown schedule rejected: {}",
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }
            Ok(ShutdownTimerResult {
                active: true,
                minutes: Some(minutes),
                message: format!("Shutdown scheduled in {minutes} minutes"),
            })
        }
        Some(_) => Err("shutdown timer must be between 1 and 1,440 minutes".to_owned()),
        None => {
            let output = Command::new("shutdown")
                .arg("-c")
                .output()
                .map_err(|error| format!("could not cancel shutdown: {error}"))?;
            if !output.status.success() {
                return Err(format!(
                    "shutdown cancellation rejected: {}",
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }
            Ok(ShutdownTimerResult {
                active: false,
                minutes: None,
                message: "Scheduled shutdown cancelled".to_owned(),
            })
        }
    }
}
