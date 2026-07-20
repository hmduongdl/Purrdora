use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::{fmt, io};
use tokio::{
    process::Command,
    time::{timeout, Duration},
};

const COMMAND_TIMEOUT: Duration = Duration::from_secs(5);

static VOLUME_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)^\s*Volume:\s+(?P<volume>[0-9]+(?:\.[0-9]+)?)(?:\s+\[(?P<muted>MUTED)\])?")
        .unwrap()
});
static STATUS_NODE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\s*[│├└─ ]*(?P<default>\*)?\s*(?P<id>[0-9]+)\.\s+(?P<name>.+?)(?:\s+\[vol:\s*(?P<volume>[0-9]+(?:\.[0-9]+)?)(?:\s+(?P<muted>MUTED))?\])?\s*$").unwrap()
});
static STATUS_SECTION_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^\s*[│├└─ ]*(?P<section>[[:alpha:]][[:alpha:] ]*):\s*$").unwrap());
static NODE_NICK_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"(?m)^\s*(?:\*\s+)?node\.nick\s*=\s*\"(?P<nick>.*)\"\s*$"#).unwrap());

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AudioSection {
    Sinks,
    Sources,
    Streams,
}

#[derive(Debug, Clone, PartialEq)]
struct StatusNode {
    id: u32,
    name: String,
    is_default: bool,
    volume_percent: Option<f32>,
    is_muted: bool,
    section: AudioSection,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AudioError {
    CommandNotFound {
        command: String,
    },
    Spawn {
        command: String,
        message: String,
    },
    Timeout {
        command: String,
    },
    CommandFailed {
        command: String,
        status: Option<i32>,
        stderr: String,
    },
    InvalidUtf8 {
        command: String,
    },
    Parse {
        field: String,
        value: String,
    },
}

impl fmt::Display for AudioError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CommandNotFound { command } => write!(f, "audio command not found: {command}"),
            Self::Spawn { command, message } => write!(f, "could not start {command}: {message}"),
            Self::Timeout { command } => write!(f, "{command} did not respond in time"),
            Self::CommandFailed {
                command,
                status,
                stderr,
            } => write!(f, "{command} failed ({status:?}): {stderr}"),
            Self::InvalidUtf8 { command } => write!(f, "{command} returned invalid UTF-8"),
            Self::Parse { field, value } => write!(f, "could not parse {field}: {value}"),
        }
    }
}

impl std::error::Error for AudioError {}

#[derive(Debug, Clone, Serialize)]
pub struct AudioDevice {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub is_default: bool,
    pub volume_percent: f32,
    pub is_muted: bool,
    pub streams: Vec<AudioStream>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioStream {
    pub id: u32,
    pub name: String,
    pub application_name: String,
    pub media_class: String,
    pub volume_percent: f32,
    pub is_muted: bool,
    pub state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioState {
    pub timestamp_ms: u64,
    pub default_sink: Option<AudioDevice>,
    pub default_source: Option<AudioDevice>,
    pub inputs: Vec<AudioDevice>,
    pub outputs: Vec<AudioDevice>,
}

async fn wpctl(args: &[&str]) -> Result<String, AudioError> {
    let command = format!("wpctl {}", args.join(" "));
    let output = timeout(
        COMMAND_TIMEOUT,
        Command::new("wpctl").args(args).kill_on_drop(true).output(),
    )
    .await
    .map_err(|_| AudioError::Timeout {
        command: command.clone(),
    })?
    .map_err(|error| match error.kind() {
        io::ErrorKind::NotFound => AudioError::CommandNotFound {
            command: "wpctl".into(),
        },
        _ => AudioError::Spawn {
            command: command.clone(),
            message: error.to_string(),
        },
    })?;
    if !output.status.success() {
        return Err(AudioError::CommandFailed {
            command,
            status: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        });
    }
    String::from_utf8(output.stdout).map_err(|_| AudioError::InvalidUtf8 { command })
}

fn parse_volume(output: &str) -> Result<(f32, bool), AudioError> {
    let captures = VOLUME_RE
        .captures(output)
        .ok_or_else(|| AudioError::Parse {
            field: "volume".into(),
            value: output.trim().into(),
        })?;
    let volume = captures["volume"]
        .parse::<f32>()
        .map_err(|_| AudioError::Parse {
            field: "volume".into(),
            value: captures["volume"].into(),
        })?;
    Ok((
        (volume * 100.0).clamp(0.0, 100.0),
        captures.name("muted").is_some(),
    ))
}

fn parse_status_nodes(output: &str) -> Vec<StatusNode> {
    let mut section = None;
    let mut nodes = Vec::new();

    for line in output.lines() {
        if let Some(captures) = STATUS_SECTION_RE.captures(line) {
            section = match &captures["section"] {
                "Sinks" => Some(AudioSection::Sinks),
                "Sources" => Some(AudioSection::Sources),
                "Streams" => Some(AudioSection::Streams),
                _ => None,
            };
            continue;
        }

        // A new top-level status group ends the current audio section.
        if !line.starts_with(' ') && !line.starts_with('│') {
            section = None;
        }
        let Some(current_section) = section else {
            continue;
        };
        let Some(captures) = STATUS_NODE_RE.captures(line) else {
            continue;
        };
        let Ok(id) = captures["id"].parse() else {
            continue;
        };
        nodes.push(StatusNode {
            id,
            name: captures["name"].trim().to_owned(),
            is_default: captures.name("default").is_some(),
            volume_percent: captures
                .name("volume")
                .and_then(|value| value.as_str().parse::<f32>().ok())
                .map(|volume| (volume * 100.0).clamp(0.0, 100.0)),
            is_muted: captures.name("muted").is_some(),
            section: current_section,
        });
    }
    nodes
}

fn parse_node_nick(output: &str) -> Option<String> {
    NODE_NICK_RE
        .captures(output)
        .map(|captures| captures["nick"].to_owned())
        .filter(|nick| !nick.is_empty())
}

fn is_display_output(node: &StatusNode) -> bool {
    node.section == AudioSection::Sinks && node.name.contains("__HDMI")
}

fn is_internal_speaker(node: &StatusNode) -> bool {
    node.section == AudioSection::Sinks
        && node.name.starts_with("alsa_output.pci-")
        && node.name.contains("-platform-")
        && node.name.contains("__Speaker__")
}

fn is_generic_display_nickname(nickname: &str) -> bool {
    let nickname = nickname.trim();
    (nickname.starts_with("HDMI ") || nickname.starts_with("DisplayPort "))
        && nickname
            .split_whitespace()
            .last()
            .is_some_and(|suffix| suffix.chars().all(|character| character.is_ascii_digit()))
}

fn should_hide_disconnected_display(node: &StatusNode, nicknames: &HashMap<u32, String>) -> bool {
    is_display_output(node)
        && nicknames
            .get(&node.id)
            .is_some_and(|nickname| is_generic_display_nickname(nickname))
}

fn device_label(
    node: &StatusNode,
    descriptions: &HashMap<u32, String>,
    nicknames: &HashMap<u32, String>,
) -> String {
    if is_internal_speaker(node) {
        return "Internal Speakers".to_owned();
    }
    if is_display_output(node) {
        if let Some(nickname) = nicknames.get(&node.id) {
            return format!("Display {nickname}");
        }
    }
    descriptions
        .get(&node.id)
        .cloned()
        .unwrap_or_else(|| node.name.clone())
}

async fn device_from_node(
    node: StatusNode,
    descriptions: &HashMap<u32, String>,
    nicknames: &HashMap<u32, String>,
) -> AudioDevice {
    let (volume_percent, is_muted) = match node.volume_percent {
        Some(volume) => (volume, node.is_muted),
        None if node.is_default => {
            let target = match node.section {
                AudioSection::Sinks => "@DEFAULT_AUDIO_SINK@",
                AudioSection::Sources => "@DEFAULT_AUDIO_SOURCE@",
                AudioSection::Streams => unreachable!(),
            };
            match wpctl(&["get-volume", target])
                .await
                .and_then(|output| parse_volume(&output))
            {
                Ok(volume) => volume,
                Err(error) => {
                    log::debug!("Volume unavailable for audio node {}: {error}", node.id);
                    (0.0, node.is_muted)
                }
            }
        }
        None => (0.0, node.is_muted),
    };
    let description = device_label(&node, descriptions, nicknames);
    AudioDevice {
        id: node.id,
        name: node.name,
        description,
        is_default: node.is_default,
        volume_percent,
        is_muted,
        streams: Vec::new(),
    }
}

/// `wpctl status -n` prints `node.name`, while the regular status output
/// prints the user-facing node label (normally `node.nick`).  Associate the
/// latter with the stable PipeWire node id before building API devices.
fn descriptions_by_id(nodes: Vec<StatusNode>) -> HashMap<u32, String> {
    nodes
        .into_iter()
        .filter(|node| node.section != AudioSection::Streams)
        .map(|node| (node.id, node.name))
        .collect()
}

async fn nicknames_by_id(nodes: &[StatusNode]) -> HashMap<u32, String> {
    futures_util::future::join_all(nodes.iter().map(|node| async move {
        let id = node.id;
        let nick = wpctl(&["inspect", &id.to_string()])
            .await
            .ok()
            .and_then(|output| parse_node_nick(&output));
        (id, nick)
    }))
    .await
    .into_iter()
    .filter_map(|(id, nick)| nick.map(|nick| (id, nick)))
    .collect()
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64)
}

#[tauri::command]
pub async fn get_audio_state() -> Result<AudioState, AudioError> {
    // Fetch node.names (raw) and node.descriptions (human-readable) in parallel.
    let (names_result, descriptions_result) =
        tokio::join!(wpctl(&["status", "-n"]), wpctl(&["status"]));
    let names_output = names_result?;
    let descriptions_output = descriptions_result?;

    let nodes = parse_status_nodes(&names_output);
    let descriptions = descriptions_by_id(parse_status_nodes(&descriptions_output));

    let device_nodes: Vec<_> = nodes
        .into_iter()
        .filter(|node| node.section != AudioSection::Streams)
        .collect();
    let display_nodes: Vec<_> = device_nodes
        .iter()
        .filter(|node| is_display_output(node))
        .cloned()
        .collect();
    let nicknames = nicknames_by_id(&display_nodes).await;
    let device_nodes: Vec<_> = device_nodes
        .into_iter()
        .filter(|node| !should_hide_disconnected_display(node, &nicknames))
        .collect();
    let devices = futures_util::future::join_all(
        device_nodes
            .iter()
            .cloned()
            .map(|node| device_from_node(node, &descriptions, &nicknames)),
    )
    .await;
    let mut outputs: Vec<_> = devices
        .iter()
        .filter(|device| {
            device_nodes
                .iter()
                .any(|node| node.id == device.id && node.section == AudioSection::Sinks)
        })
        .cloned()
        .collect();
    let inputs: Vec<_> = devices
        .into_iter()
        .filter(|device| {
            device_nodes
                .iter()
                .any(|node| node.id == device.id && node.section == AudioSection::Sources)
        })
        .collect();
    let default_sink = outputs
        .iter()
        .find(|device| device.is_default)
        .cloned()
        .or_else(|| outputs.first().cloned());
    let default_source = inputs
        .iter()
        .find(|device| device.is_default)
        .cloned()
        .or_else(|| inputs.first().cloned());
    if let Some(default_id) = default_sink.as_ref().map(|device| device.id) {
        for output in &mut outputs {
            output.is_default = output.id == default_id;
        }
    }
    Ok(AudioState {
        timestamp_ms: now_ms(),
        default_sink,
        default_source,
        inputs,
        outputs,
    })
}

pub fn start(ipc: crate::ipc::IpcEmitter) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(3));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let started = std::time::Instant::now();
            match get_audio_state().await {
                Ok(state) => {
                    let _ = ipc.emit_latest("audio-update", &state);
                    let elapsed = started.elapsed();
                    if elapsed >= Duration::from_millis(250) {
                        log::warn!("[perf] get_audio_state took {}ms", elapsed.as_millis());
                    }
                }
                Err(error) => log::warn!("Audio state unavailable: {error}"),
            }
        }
    });
}

#[tauri::command]
pub async fn set_audio_volume(id: u32, volume_percent: f32) -> Result<(), AudioError> {
    let volume = (volume_percent.clamp(0.0, 100.0) / 100.0).to_string();
    if wpctl(&["set-volume", &id.to_string(), &volume])
        .await
        .is_err()
    {
        // The selected device may disappear during a Bluetooth/HDMI route switch.
        wpctl(&["set-volume", "@DEFAULT_AUDIO_SINK@", &volume]).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_audio_mute(id: u32) -> Result<(), AudioError> {
    if wpctl(&["set-mute", &id.to_string(), "toggle"])
        .await
        .is_err()
    {
        wpctl(&["set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"]).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_default_audio_output(id: u32) -> Result<AudioState, AudioError> {
    wpctl(&["set-default", &id.to_string()]).await?;
    get_audio_state().await
}

#[cfg(test)]
mod tests {
    use super::{
        descriptions_by_id, device_label, parse_node_nick, parse_status_nodes, parse_volume,
        should_hide_disconnected_display, AudioSection, StatusNode,
    };
    use std::collections::HashMap;

    #[test]
    fn parses_wpctl_volume_and_mute() {
        assert_eq!(parse_volume("Volume: 0.42 [MUTED]").unwrap(), (42.0, true));
        assert_eq!(parse_volume("Volume: 0.875").unwrap(), (87.5, false));
    }

    #[test]
    fn parses_status_node_ids_without_string_splitting() {
        assert_eq!(
            parse_status_nodes("Audio\n ├─ Sinks:\n │  * 53. Built-in Audio Analog Stereo [vol: 0.42]\n ├─ Sources:\n │    54. Internal Microphone\n"),
            vec![
                StatusNode { id: 53, name: "Built-in Audio Analog Stereo".to_owned(), is_default: true, volume_percent: Some(42.0), is_muted: false, section: AudioSection::Sinks },
                StatusNode { id: 54, name: "Internal Microphone".to_owned(), is_default: false, volume_percent: None, is_muted: false, section: AudioSection::Sources },
            ]
        );
    }

    #[test]
    fn joins_raw_node_names_with_display_descriptions_by_id() {
        let raw_nodes = parse_status_nodes(
            "Audio\n ├─ Sinks:\n │  * 53. alsa_output.pci-0000_00_1f.3-platform-sof_sdw.HiFi__Speaker__sink [vol: 0.42]\n │    54. alsa_output.pci-0000_00_1f.3-platform-sof_sdw.HiFi__HDMI1__sink\n",
        );
        let descriptions = descriptions_by_id(parse_status_nodes(
            "Audio\n ├─ Sinks:\n │  * 53. Alder Lake PCH-P High Definition Audio Controller Speaker [vol: 0.42]\n │    54. Alder Lake PCH-P High Definition Audio Controller HDMI / DisplayPort 1 Output\n",
        ));

        assert_eq!(
            raw_nodes[0].name,
            "alsa_output.pci-0000_00_1f.3-platform-sof_sdw.HiFi__Speaker__sink"
        );
        assert_eq!(
            descriptions.get(&raw_nodes[0].id),
            Some(&"Alder Lake PCH-P High Definition Audio Controller Speaker".to_owned())
        );
        assert_eq!(
            descriptions.get(&raw_nodes[1].id),
            Some(
                &"Alder Lake PCH-P High Definition Audio Controller HDMI / DisplayPort 1 Output"
                    .to_owned()
            )
        );
    }

    #[test]
    fn uses_node_nick_for_display_output_label() {
        let node = parse_status_nodes(
            "Audio\n ├─ Sinks:\n │    63. alsa_output.pci-0000_00_1f.3.HiFi__HDMI1__sink\n",
        )
        .pop()
        .unwrap();
        let nick = parse_node_nick("  * node.nick = \"MP59G\"\n").unwrap();

        assert_eq!(nick, "MP59G");
        assert_eq!(
            device_label(
                &node,
                &HashMap::from([(63, "HDMI / DisplayPort 1 Output".to_owned())]),
                &HashMap::from([(63, nick)]),
            ),
            "Display MP59G"
        );
    }

    #[test]
    fn names_the_internal_speaker_clearly() {
        let node = parse_status_nodes(
            "Audio\n ├─ Sinks:\n │    53. alsa_output.pci-0000_00_1f.3-platform-sof.HiFi__Speaker__sink\n",
        )
        .pop()
        .unwrap();

        assert_eq!(
            device_label(&node, &HashMap::new(), &HashMap::new()),
            "Internal Speakers"
        );
    }

    #[test]
    fn preserves_the_name_of_an_external_speaker() {
        let node = parse_status_nodes(
            "Audio\n ├─ Sinks:\n │    91. alsa_output.usb-Creative_Speaker.HiFi__Speaker__sink\n",
        )
        .pop()
        .unwrap();

        assert_eq!(
            device_label(
                &node,
                &HashMap::from([(91, "Creative Pebble".to_owned())]),
                &HashMap::new(),
            ),
            "Creative Pebble"
        );
    }

    #[test]
    fn hides_display_outputs_without_a_monitor_nickname() {
        let node = parse_status_nodes(
            "Audio\n ├─ Sinks:\n │    51. alsa_output.pci-0000_00_1f.3.HiFi__HDMI2__sink\n",
        )
        .pop()
        .unwrap();

        assert!(should_hide_disconnected_display(
            &node,
            &HashMap::from([(51, "HDMI 2".to_owned())]),
        ));
        assert!(!should_hide_disconnected_display(
            &node,
            &HashMap::from([(51, "MP59G".to_owned())]),
        ));
    }
}
