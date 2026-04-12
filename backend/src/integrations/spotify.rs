//! Spotify Integration for ListenOS
//!
//! Controls media playback using media keys and browser/Spotify fallbacks.

use super::{ActionParameter, AppIntegration, IntegrationAction, IntegrationResult};
use std::process::Command;
use std::time::Duration;
use url::form_urlencoded::byte_serialize;

pub struct SpotifyIntegration {
    // Platform capability check
    available: bool,
    spotify_installed: bool,
}

impl SpotifyIntegration {
    pub fn new() -> Self {
        let spotify_installed = Self::check_spotify_installed();
        let available = Self::check_media_capability();
        Self {
            available,
            spotify_installed,
        }
    }

    fn check_media_capability() -> bool {
        cfg!(windows) || cfg!(target_os = "macos") || cfg!(target_os = "linux")
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

    fn encode_query_component(query: &str) -> String {
        byte_serialize(query.as_bytes()).collect()
    }

    fn cleaned_playback_query(query: &str) -> String {
        query
            .trim()
            .replace(" on youtube music", "")
            .replace(" from youtube music", "")
            .replace(" on spotify", "")
            .replace(" in spotify", "")
            .replace(" using spotify", "")
            .replace(" on youtube", "")
            .replace(" in youtube", "")
            .replace(" from youtube", "")
            .trim()
            .to_string()
    }

    fn prefers_spotify(query: &str) -> bool {
        query.contains("spotify")
    }

    fn looks_like_youtube_video_id(candidate: &str) -> bool {
        candidate.len() == 11
            && candidate
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    }

    fn extract_first_youtube_video_url(html: &str) -> Option<String> {
        const VIDEO_ID_MARKER: &str = "\"videoId\":\"";
        let mut rest = html;

        while let Some(pos) = rest.find(VIDEO_ID_MARKER) {
            rest = &rest[pos + VIDEO_ID_MARKER.len()..];
            let Some(end) = rest.find('"') else {
                break;
            };

            let video_id = &rest[..end];
            if Self::looks_like_youtube_video_id(video_id) {
                return Some(format!(
                    "https://www.youtube.com/watch?v={video_id}&autoplay=1"
                ));
            }

            rest = &rest[end + 1..];
        }

        None
    }

    fn search_youtube_video_url(query: &str) -> Result<Option<String>, String> {
        let query = query.to_string();
        let join_result = std::thread::spawn(move || {
            let encoded_query = Self::encode_query_component(&query);
            let search_url = format!("https://www.youtube.com/results?search_query={encoded_query}");
            let client = reqwest::blocking::Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36")
                .timeout(Duration::from_secs(4))
                .build()
                .map_err(|e| format!("Failed to build YouTube lookup client: {}", e))?;

            let html = client
                .get(&search_url)
                .send()
                .and_then(|response| response.error_for_status())
                .map_err(|e| format!("Failed to resolve YouTube playback target: {}", e))?
                .text()
                .map_err(|e| format!("Failed to read YouTube playback target: {}", e))?;

            Ok::<Option<String>, String>(Self::extract_first_youtube_video_url(&html))
        })
        .join();

        match join_result {
            Ok(result) => result,
            Err(_) => Err("YouTube playback lookup thread panicked".to_string()),
        }
    }

    fn open_url(url: &str) -> Result<(), String> {
        #[cfg(windows)]
        {
            Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", url])
                .spawn()
                .map_err(|e| format!("Failed to open URL: {}", e))?;
            return Ok(());
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(url)
                .spawn()
                .map_err(|e| format!("Failed to open URL: {}", e))?;
            return Ok(());
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            match Command::new("xdg-open").arg(url).spawn() {
                Ok(_) => Ok(()),
                Err(xdg_err) => {
                    Command::new("open")
                        .arg(url)
                        .spawn()
                        .map(|_| ())
                        .map_err(|open_err| {
                            format!(
                                "Failed to open URL with xdg-open ({}) or open ({})",
                                xdg_err, open_err
                            )
                        })
                }
            }?;
            return Ok(());
        }

        #[allow(unreachable_code)]
        Err("Opening URLs is not supported on this platform".to_string())
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
        Self::open_url(uri).map_err(|e| format!("Failed to open Spotify URI: {}", e))
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
                id: "spotify_play_song".to_string(),
                name: "Play Specific Song".to_string(),
                description: "Resolve a direct playback target for a song or artist".to_string(),
                parameters: vec![ActionParameter {
                    name: "query".to_string(),
                    param_type: "string".to_string(),
                    required: true,
                    description: "Song, artist, or music request".to_string(),
                }],
                example_phrases: vec![
                    "play 505 by Arctic Monkeys".to_string(),
                    "play some lofi music on YouTube".to_string(),
                    "play Blinding Lights".to_string(),
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

                let cleaned_query = Self::cleaned_playback_query(query);
                let encoded_query = Self::encode_query_component(&cleaned_query);

                if self.spotify_installed {
                    let uri = format!("spotify:search:{}", encoded_query);
                    Self::open_spotify_uri(&uri)?;
                } else {
                    let url = format!("https://open.spotify.com/search/{}", encoded_query);
                    Self::open_url(&url)?;
                }

                Ok(IntegrationResult::success(format!(
                    "Searching for: {}",
                    cleaned_query
                )))
            }

            "spotify_play_song" => {
                let query = params
                    .get("query")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| "Missing search query".to_string())?;

                let cleaned_query = Self::cleaned_playback_query(query);
                let prefers_spotify = Self::prefers_spotify(query);

                if !prefers_spotify {
                    match Self::search_youtube_video_url(&cleaned_query) {
                        Ok(Some(video_url)) => {
                            Self::open_url(&video_url)?;
                            return Ok(IntegrationResult::success_with_data(
                                format!("Playing {} on YouTube", cleaned_query),
                                serde_json::json!({
                                    "provider": "youtube",
                                    "url": video_url,
                                    "query": cleaned_query,
                                }),
                            ));
                        }
                        Ok(None) => {
                            log::warn!(
                                "No direct YouTube result found for '{}', falling back to search page",
                                cleaned_query
                            );
                        }
                        Err(err) => {
                            log::warn!(
                                "YouTube playback target resolution failed for '{}': {}",
                                cleaned_query,
                                err
                            );
                        }
                    }
                }

                if self.spotify_installed {
                    let encoded_query = Self::encode_query_component(&cleaned_query);
                    let spotify_uri = format!("spotify:search:{}", encoded_query);
                    Self::open_spotify_uri(&spotify_uri)?;
                    return Ok(IntegrationResult::success_with_data(
                        format!("Opened Spotify for {}", cleaned_query),
                        serde_json::json!({
                            "provider": "spotify",
                            "url": spotify_uri,
                            "query": cleaned_query,
                        }),
                    ));
                }

                let encoded_query = Self::encode_query_component(&cleaned_query);
                let youtube_search_url =
                    format!("https://www.youtube.com/results?search_query={encoded_query}");
                Self::open_url(&youtube_search_url)?;

                Ok(IntegrationResult::success_with_data(
                    format!("Opened YouTube search for {}", cleaned_query),
                    serde_json::json!({
                        "provider": "youtube_search",
                        "url": youtube_search_url,
                        "query": cleaned_query,
                    }),
                ))
            }

            "spotify_open" => {
                if self.spotify_installed {
                    Self::open_spotify_uri("spotify:")?;
                    Ok(IntegrationResult::success("Opened Spotify"))
                } else {
                    Self::open_url("https://open.spotify.com")?;
                    Ok(IntegrationResult::success("Opened Spotify Web"))
                }
            }

            _ => Err(format!("Unknown Spotify action: {}", action)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::SpotifyIntegration;

    #[test]
    fn extracts_first_youtube_video_url_from_results_html() {
        let html = r#"{"videoId":"dQw4w9WgXcQ","title":{"runs":[{"text":"Sample"}]}}"#;
        let url = SpotifyIntegration::extract_first_youtube_video_url(html)
            .expect("video url should be extracted");

        assert_eq!(
            url,
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1"
        );
    }

    #[test]
    fn cleans_playback_query_service_suffixes() {
        let cleaned =
            SpotifyIntegration::cleaned_playback_query("505 by arctic monkeys on youtube music");

        assert_eq!(cleaned, "505 by arctic monkeys");
    }
}
