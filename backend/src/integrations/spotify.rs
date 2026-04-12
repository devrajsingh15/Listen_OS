//! Spotify Integration for ListenOS
//!
//! Controls Spotify playback using Windows media keys and Spotify URI schemes.

use super::{ActionParameter, AppIntegration, IntegrationAction, IntegrationResult};
use std::process::Command;

pub struct SpotifyIntegration {
    // Cache availability check
    available: bool,
}

impl SpotifyIntegration {
    pub fn new() -> Self {
        let available = Self::check_spotify_installed();
        Self { available }
    }

    fn check_spotify_installed() -> bool {
        // Check if Spotify is installed by looking for the executable
        #[cfg(windows)]
        {
            let appdata = std::env::var("APPDATA").unwrap_or_default();
            let spotify_path = std::path::Path::new(&appdata)
                .join("Spotify")
                .join("Spotify.exe");

            if spotify_path.exists() {
                return true;
            }

            // Also check Microsoft Store version
            let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
            let store_path = std::path::Path::new(&localappdata)
                .join("Microsoft")
                .join("WindowsApps");

            if store_path.exists() {
                // Check if any Spotify folder exists
                if let Ok(entries) = std::fs::read_dir(&store_path) {
                    for entry in entries.flatten() {
                        if entry.file_name().to_string_lossy().contains("Spotify") {
                            return true;
                        }
                    }
                }
            }
        }

        false
    }

    /// Send a media key using PowerShell
    fn send_media_key(key: &str) -> Result<(), String> {
        #[cfg(windows)]
        {
            // Map key names to virtual key codes
            let vk_code = match key {
                "play_pause" => 179,  // VK_MEDIA_PLAY_PAUSE
                "next" => 176,        // VK_MEDIA_NEXT_TRACK
                "previous" => 177,    // VK_MEDIA_PREV_TRACK
                "stop" => 178,        // VK_MEDIA_STOP
                "volume_up" => 175,   // VK_VOLUME_UP
                "volume_down" => 174, // VK_VOLUME_DOWN
                "mute" => 173,        // VK_VOLUME_MUTE
                _ => return Err(format!("Unknown media key: {}", key)),
            };

            let script = format!(
                r#"
                Add-Type -TypeDefinition '
                using System;
                using System.Runtime.InteropServices;
                public class MediaKeys {{
                    [DllImport("user32.dll")]
                    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
                    public const int KEYEVENTF_EXTENDEDKEY = 0x0001;
                    public const int KEYEVENTF_KEYUP = 0x0002;
                }}
                '
                [MediaKeys]::keybd_event({0}, 0, [MediaKeys]::KEYEVENTF_EXTENDEDKEY, [UIntPtr]::Zero)
                [MediaKeys]::keybd_event({0}, 0, [MediaKeys]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
                "#,
                vk_code
            );

            Command::new("powershell")
                .args(["-NoProfile", "-Command", &script])
                .output()
                .map_err(|e| format!("Failed to send media key: {}", e))?;

            Ok(())
        }

        #[cfg(not(windows))]
        Err("Media keys not supported on this platform".to_string())
    }

    /// Open Spotify with a URI
    fn open_spotify_uri(uri: &str) -> Result<(), String> {
        #[cfg(windows)]
        {
            Command::new("cmd")
                .args(["/C", "start", "", uri])
                .spawn()
                .map_err(|e| format!("Failed to open Spotify URI: {}", e))?;
            Ok(())
        }

        #[cfg(not(windows))]
        {
            Command::new("open")
                .arg(uri)
                .spawn()
                .map_err(|e| format!("Failed to open Spotify URI: {}", e))?;
            Ok(())
        }
    }
}

impl Default for SpotifyIntegration {
    fn default() -> Self {
        Self::new()
    }
}

impl AppIntegration for SpotifyIntegration {
    fn name(&self) -> &str {
        "spotify"
    }

    fn description(&self) -> &str {
        "Control Spotify playback - play, pause, skip tracks, and search for music"
    }

    fn is_available(&self) -> bool {
        self.available
    }

    fn supported_actions(&self) -> Vec<IntegrationAction> {
        vec![
            IntegrationAction {
                id: "spotify_play_pause".to_string(),
                name: "Play/Pause".to_string(),
                description: "Toggle play/pause".to_string(),
                parameters: vec![],
                example_phrases: vec![
                    "pause spotify".to_string(),
                    "play spotify".to_string(),
                    "pause the music".to_string(),
                ],
            },
            IntegrationAction {
                id: "spotify_next".to_string(),
                name: "Next Track".to_string(),
                description: "Skip to next track".to_string(),
                parameters: vec![],
                example_phrases: vec![
                    "next song".to_string(),
                    "skip this song".to_string(),
                    "play next".to_string(),
                ],
            },
            IntegrationAction {
                id: "spotify_previous".to_string(),
                name: "Previous Track".to_string(),
                description: "Go to previous track".to_string(),
                parameters: vec![],
                example_phrases: vec![
                    "previous song".to_string(),
                    "go back".to_string(),
                    "play previous".to_string(),
                ],
            },
            IntegrationAction {
                id: "spotify_volume".to_string(),
                name: "Volume Control".to_string(),
                description: "Adjust volume".to_string(),
                parameters: vec![ActionParameter {
                    name: "direction".to_string(),
                    param_type: "string".to_string(),
                    required: true,
                    description: "up, down, or mute".to_string(),
                }],
                example_phrases: vec![
                    "volume up".to_string(),
                    "volume down".to_string(),
                    "mute spotify".to_string(),
                ],
            },
            IntegrationAction {
                id: "spotify_search".to_string(),
                name: "Search and Play".to_string(),
                description: "Search for and play music".to_string(),
                parameters: vec![ActionParameter {
                    name: "query".to_string(),
                    param_type: "string".to_string(),
                    required: true,
                    description: "Search query (song, artist, album, or playlist)".to_string(),
                }],
                example_phrases: vec![
                    "play Shape of You on Spotify".to_string(),
                    "play some jazz music".to_string(),
                    "play Taylor Swift".to_string(),
                ],
            },
            IntegrationAction {
                id: "spotify_open".to_string(),
                name: "Open Spotify".to_string(),
                description: "Open the Spotify app".to_string(),
                parameters: vec![],
                example_phrases: vec!["open spotify".to_string(), "launch spotify".to_string()],
            },
        ]
    }

    fn execute(
        &self,
        action: &str,
        params: &serde_json::Value,
    ) -> Result<IntegrationResult, String> {
        match action {
            "spotify_play_pause" => {
                Self::send_media_key("play_pause")?;
                Ok(IntegrationResult::success("Toggled play/pause"))
            }

            "spotify_next" => {
                Self::send_media_key("next")?;
                Ok(IntegrationResult::success("Skipped to next track"))
            }

            "spotify_previous" => {
                Self::send_media_key("previous")?;
                Ok(IntegrationResult::success("Went to previous track"))
            }

            "spotify_volume" => {
                let direction = params
                    .get("direction")
                    .and_then(|v| v.as_str())
                    .unwrap_or("up");

                let key = match direction {
                    "up" => "volume_up",
                    "down" => "volume_down",
                    "mute" => "mute",
                    _ => "volume_up",
                };

                // Send key multiple times for noticeable change
                for _ in 0..3 {
                    Self::send_media_key(key)?;
                }

                Ok(IntegrationResult::success(format!("Volume {}", direction)))
            }

            "spotify_search" => {
                let query = params
                    .get("query")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| "Missing search query".to_string())?;

                // Open Spotify search
                let encoded_query = query.replace(' ', "%20");
                let uri = format!("spotify:search:{}", encoded_query);
                Self::open_spotify_uri(&uri)?;

                Ok(IntegrationResult::success(format!(
                    "Searching for: {}",
                    query
                )))
            }

            "spotify_play_song" => {
                let query = params
                    .get("query")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| "Missing search query".to_string())?;

                // Open YouTube with search - video results typically autoplay on click
                // This is more reliable than Spotify URI which doesn't always work
                let encoded_query = query.replace(' ', "+");

                // Use YouTube search with video filter for music
                let youtube_url = format!(
                    "https://www.youtube.com/results?search_query={}+song+music",
                    encoded_query
                );

                #[cfg(windows)]
                {
                    let _ = Command::new("cmd")
                        .args(["/C", "start", "", &youtube_url])
                        .spawn();
                }

                #[cfg(not(windows))]
                {
                    let _ = Command::new("open").arg(&youtube_url).spawn();
                }

                Ok(IntegrationResult::success(format!(
                    "Searching: {} - click to play",
                    query
                )))
            }

            "spotify_open" => {
                Self::open_spotify_uri("spotify:")?;
                Ok(IntegrationResult::success("Opened Spotify"))
            }

            _ => Err(format!("Unknown Spotify action: {}", action)),
        }
    }
}
