//! Discord Integration for ListenOS
//!
//! Controls Discord using keyboard shortcuts and process management.

use super::{AppIntegration, IntegrationAction, IntegrationResult};
use std::process::Command;

pub struct DiscordIntegration {
    available: bool,
}

impl DiscordIntegration {
    pub fn new() -> Self {
        let available = Self::check_discord_installed();
        Self { available }
    }

    fn check_discord_installed() -> bool {
        #[cfg(windows)]
        {
            let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
            let discord_path = std::path::Path::new(&localappdata).join("Discord");

            discord_path.exists()
        }

        #[cfg(not(windows))]
        false
    }

    /// Check if Discord is currently running
    fn is_discord_running() -> bool {
        #[cfg(windows)]
        {
            let output = Command::new("tasklist")
                .args(["/FI", "IMAGENAME eq Discord.exe", "/NH"])
                .output();

            match output {
                Ok(o) => {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    stdout.contains("Discord.exe")
                }
                Err(_) => false,
            }
        }

        #[cfg(not(windows))]
        false
    }

    /// Send keyboard shortcut to Discord
    fn send_discord_shortcut(keys: &str) -> Result<(), String> {
        #[cfg(windows)]
        {
            // Focus Discord first, then send keys
            let script = format!(
                r#"
                $discord = Get-Process Discord -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($discord) {{
                    Add-Type -TypeDefinition '
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {{
                        [DllImport("user32.dll")]
                        public static extern bool SetForegroundWindow(IntPtr hWnd);
                    }}
                    '
                    [Win32]::SetForegroundWindow($discord.MainWindowHandle)
                    Start-Sleep -Milliseconds 100
                    
                    $wsh = New-Object -ComObject WScript.Shell
                    $wsh.SendKeys("{}")
                }}
                "#,
                keys
            );

            Command::new("powershell")
                .args(["-NoProfile", "-Command", &script])
                .output()
                .map_err(|e| format!("Failed to send Discord shortcut: {}", e))?;

            Ok(())
        }

        #[cfg(not(windows))]
        Err("Discord shortcuts not supported on this platform".to_string())
    }

    /// Open Discord
    fn open_discord() -> Result<(), String> {
        #[cfg(windows)]
        {
            let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
            let update_exe = std::path::Path::new(&localappdata)
                .join("Discord")
                .join("Update.exe");

            if update_exe.exists() {
                Command::new(&update_exe)
                    .args(["--processStart", "Discord.exe"])
                    .spawn()
                    .map_err(|e| format!("Failed to open Discord: {}", e))?;
                Ok(())
            } else {
                // Try opening via protocol
                Command::new("cmd")
                    .args(["/C", "start", "discord://"])
                    .spawn()
                    .map_err(|e| format!("Failed to open Discord: {}", e))?;
                Ok(())
            }
        }

        #[cfg(not(windows))]
        Err("Discord not supported on this platform".to_string())
    }
}

impl Default for DiscordIntegration {
    fn default() -> Self {
        Self::new()
    }
}

impl AppIntegration for DiscordIntegration {
    fn name(&self) -> &str {
        "discord"
    }

    fn description(&self) -> &str {
        "Control Discord - mute, deafen, and manage your status"
    }

    fn is_available(&self) -> bool {
        self.available
    }

    fn supported_actions(&self) -> Vec<IntegrationAction> {
        vec![
            IntegrationAction {
                id: "discord_mute".to_string(),
                name: "Toggle Mute".to_string(),
                description: "Mute or unmute your microphone in Discord".to_string(),
                parameters: vec![],
                example_phrases: vec![
                    "mute discord".to_string(),
                    "unmute discord".to_string(),
                    "toggle discord mute".to_string(),
                ],
            },
            IntegrationAction {
                id: "discord_deafen".to_string(),
                name: "Toggle Deafen".to_string(),
                description: "Deafen or undeafen in Discord".to_string(),
                parameters: vec![],
                example_phrases: vec!["deafen discord".to_string(), "undeafen discord".to_string()],
            },
            IntegrationAction {
                id: "discord_disconnect".to_string(),
                name: "Disconnect from Voice".to_string(),
                description: "Disconnect from the current voice channel".to_string(),
                parameters: vec![],
                example_phrases: vec![
                    "disconnect from discord".to_string(),
                    "leave voice channel".to_string(),
                    "leave discord call".to_string(),
                ],
            },
            IntegrationAction {
                id: "discord_open".to_string(),
                name: "Open Discord".to_string(),
                description: "Open the Discord app".to_string(),
                parameters: vec![],
                example_phrases: vec!["open discord".to_string(), "launch discord".to_string()],
            },
        ]
    }

    fn execute(
        &self,
        action: &str,
        _params: &serde_json::Value,
    ) -> Result<IntegrationResult, String> {
        match action {
            "discord_mute" => {
                if !Self::is_discord_running() {
                    return Err("Discord is not running".to_string());
                }

                // Discord mute shortcut: Ctrl+Shift+M
                Self::send_discord_shortcut("^+m")?;
                Ok(IntegrationResult::success("Toggled Discord mute"))
            }

            "discord_deafen" => {
                if !Self::is_discord_running() {
                    return Err("Discord is not running".to_string());
                }

                // Discord deafen shortcut: Ctrl+Shift+D
                Self::send_discord_shortcut("^+d")?;
                Ok(IntegrationResult::success("Toggled Discord deafen"))
            }

            "discord_disconnect" => {
                if !Self::is_discord_running() {
                    return Err("Discord is not running".to_string());
                }

                // Discord disconnect shortcut: Ctrl+Shift+E (with Discord focused)
                // Note: This might vary based on Discord keybinds
                Self::send_discord_shortcut("^+e")?;
                Ok(IntegrationResult::success(
                    "Disconnected from voice channel",
                ))
            }

            "discord_open" => {
                Self::open_discord()?;
                Ok(IntegrationResult::success("Opened Discord"))
            }

            _ => Err(format!("Unknown Discord action: {}", action)),
        }
    }
}
