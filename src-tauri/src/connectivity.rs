use serde::Serialize;
use std::io;
use tokio::{
    process::Command,
    time::{timeout, Duration},
};

#[derive(Debug, Serialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal: u8,
    pub security: String,
    pub active: bool,
}

#[derive(Debug, Serialize)]
pub struct ConnectivityState {
    pub wifi_enabled: bool,
    pub wifi_networks: Vec<WifiNetwork>,
}

async fn nmcli(args: &[&str]) -> Result<String, String> {
    let output = timeout(
        Duration::from_secs(15),
        Command::new("nmcli").args(args).kill_on_drop(true).output(),
    )
    .await
    .map_err(|_| "NetworkManager did not respond in time".to_owned())?
    .map_err(|error| {
        if error.kind() == io::ErrorKind::NotFound {
            "NetworkManager (nmcli) is not installed".to_owned()
        } else {
            error.to_string()
        }
    })?;

    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if message.is_empty() {
            "NetworkManager could not complete the request".to_owned()
        } else {
            message
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

async fn wifi_enabled() -> Result<bool, String> {
    Ok(nmcli(&["-g", "WIFI", "radio"]).await?.trim() == "enabled")
}

fn parse_nmcli_fields(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut field = String::new();
    let mut escaped = false;

    for character in line.chars() {
        if escaped {
            field.push(character);
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == ':' {
            fields.push(field);
            field = String::new();
        } else {
            field.push(character);
        }
    }

    if escaped {
        field.push('\\');
    }
    fields.push(field);
    fields
}

async fn networks() -> Result<Vec<WifiNetwork>, String> {
    let output = nmcli(&[
        "-t",
        "-f",
        "SSID,SIGNAL,SECURITY,IN-USE",
        "device",
        "wifi",
        "list",
        "--rescan",
        "auto",
    ])
    .await?;
    let mut networks = output
        .lines()
        .filter_map(|line| {
            let columns = parse_nmcli_fields(line);
            let ssid = columns.first()?.trim();
            if ssid.is_empty() {
                return None;
            }
            let signal = columns
                .get(1)
                .map_or("0", String::as_str)
                .trim()
                .parse()
                .unwrap_or(0);
            let security = columns.get(2).map_or("", String::as_str).trim().to_owned();
            let active = columns.get(3).map_or("", String::as_str).trim() == "*";
            Some(WifiNetwork {
                ssid: ssid.to_owned(),
                signal,
                security,
                active,
            })
        })
        .collect::<Vec<_>>();
    networks.sort_by_key(|network| {
        (
            !network.active,
            std::cmp::Reverse(network.signal),
            network.ssid.to_lowercase(),
        )
    });
    networks.dedup_by(|left, right| left.ssid == right.ssid);
    Ok(networks)
}

#[tauri::command]
pub async fn get_connectivity_state() -> Result<ConnectivityState, String> {
    let enabled = wifi_enabled().await?;
    let wifi_networks = if enabled {
        networks().await?
    } else {
        Vec::new()
    };
    Ok(ConnectivityState {
        wifi_enabled: enabled,
        wifi_networks,
    })
}

#[tauri::command]
pub async fn set_wifi_enabled(enabled: bool) -> Result<ConnectivityState, String> {
    nmcli(&["radio", "wifi", if enabled { "on" } else { "off" }]).await?;
    get_connectivity_state().await
}

#[tauri::command]
pub async fn connect_wifi(
    ssid: String,
    password: Option<String>,
) -> Result<ConnectivityState, String> {
    let password = password.unwrap_or_default();
    let mut args = vec!["device", "wifi", "connect", ssid.as_str()];
    if !password.is_empty() {
        args.extend(["password", password.as_str()]);
    }
    nmcli(&args).await?;
    get_connectivity_state().await
}

#[tauri::command]
pub async fn set_airplane_mode(enabled: bool) -> Result<ConnectivityState, String> {
    nmcli(&["radio", "all", if enabled { "off" } else { "on" }]).await?;
    get_connectivity_state().await
}

#[tauri::command]
pub async fn open_fedora_settings() -> Result<(), String> {
    Command::new("gnome-control-center")
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Không thể mở Cài đặt Fedora: {error}"))
}
