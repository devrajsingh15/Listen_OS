//! System control and automation module
//!
//! Handles keyboard/mouse simulation, window management, and OS commands.

#![allow(dead_code)]

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::{Deserialize, Serialize};

/// System action types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SystemAction {
    TypeText(String),
    PressKey(String),
    HotKey(Vec<String>),
    OpenApp(String),
    OpenUrl(String),
    RunCommand(String),
    VolumeUp,
    VolumeDown,
    Mute,
    Screenshot,
    ClipboardCopy(String),
    ClipboardPaste,
}

/// System controller for executing actions
pub struct SystemController {
    enigo: Option<Enigo>,
}

impl Default for SystemController {
    fn default() -> Self {
        let enigo = Enigo::new(&Settings::default()).ok();
        Self { enigo }
    }
}

impl SystemController {
    /// Execute a system action
    pub fn execute(&mut self, action: SystemAction) -> Result<String, String> {
        match action {
            SystemAction::TypeText(text) => self.type_text(&text),
            SystemAction::PressKey(key) => self.press_key(&key),
            SystemAction::HotKey(keys) => self.press_hotkey(&keys),
            SystemAction::OpenApp(app) => self.open_app(&app),
            SystemAction::OpenUrl(url) => self.open_url(&url),
            SystemAction::RunCommand(cmd) => self.run_command(&cmd),
            SystemAction::VolumeUp => self.volume_up(),
            SystemAction::VolumeDown => self.volume_down(),
            SystemAction::Mute => self.mute(),
            SystemAction::Screenshot => self.take_screenshot(),
            SystemAction::ClipboardCopy(text) => self.copy_to_clipboard(&text),
            SystemAction::ClipboardPaste => self.paste_from_clipboard(),
        }
    }

    fn type_text(&mut self, text: &str) -> Result<String, String> {
        let enigo = self.enigo.as_mut().ok_or("Enigo not initialized")?;

        enigo
            .text(text)
            .map_err(|e| format!("Failed to type text: {}", e))?;

        Ok(format!("Typed: {}", text))
    }

    fn press_key(&mut self, key: &str) -> Result<String, String> {
        let enigo = self.enigo.as_mut().ok_or("Enigo not initialized")?;

        let key_enum = Self::string_to_key_static(key)?;

        enigo
            .key(key_enum, Direction::Click)
            .map_err(|e| format!("Failed to press key: {}", e))?;

        Ok(format!("Pressed: {}", key))
    }

    fn press_hotkey(&mut self, keys: &[String]) -> Result<String, String> {
        // Convert all keys first to avoid borrow issues
        let key_enums: Vec<Key> = keys
            .iter()
            .map(|k| Self::string_to_key_static(k))
            .collect::<Result<Vec<_>, _>>()?;

        let enigo = self.enigo.as_mut().ok_or("Enigo not initialized")?;

        // Press all modifier keys
        for key_enum in key_enums.iter().take(key_enums.len().saturating_sub(1)) {
            enigo
                .key(*key_enum, Direction::Press)
                .map_err(|e| format!("Failed to press key: {}", e))?;
        }

        // Press the final key
        if let Some(last_key) = key_enums.last() {
            enigo
                .key(*last_key, Direction::Click)
                .map_err(|e| format!("Failed to press key: {}", e))?;
        }

        // Release all modifier keys
        for key_enum in key_enums
            .iter()
            .take(key_enums.len().saturating_sub(1))
            .rev()
        {
            enigo
                .key(*key_enum, Direction::Release)
                .map_err(|e| format!("Failed to release key: {}", e))?;
        }

        Ok(format!("Pressed hotkey: {:?}", keys))
    }

    fn string_to_key_static(s: &str) -> Result<Key, String> {
        match s.to_lowercase().as_str() {
            "ctrl" | "control" => Ok(Key::Control),
            "alt" => Ok(Key::Alt),
            "shift" => Ok(Key::Shift),
            "meta" | "win" | "super" | "cmd" => Ok(Key::Meta),
            "enter" | "return" => Ok(Key::Return),
            "tab" => Ok(Key::Tab),
            "escape" | "esc" => Ok(Key::Escape),
            "space" => Ok(Key::Space),
            "backspace" => Ok(Key::Backspace),
            "delete" => Ok(Key::Delete),
            "up" => Ok(Key::UpArrow),
            "down" => Ok(Key::DownArrow),
            "left" => Ok(Key::LeftArrow),
            "right" => Ok(Key::RightArrow),
            "home" => Ok(Key::Home),
            "end" => Ok(Key::End),
            "pageup" => Ok(Key::PageUp),
            "pagedown" => Ok(Key::PageDown),
            c if c.len() == 1 => Ok(Key::Unicode(c.chars().next().unwrap())),
            _ => Err(format!("Unknown key: {}", s)),
        }
    }

    fn open_app(&self, app: &str) -> Result<String, String> {
        #[cfg(windows)]
        let result = std::process::Command::new("cmd")
            .args(["/C", "start", "", app])
            .spawn();

        #[cfg(target_os = "macos")]
        let result = std::process::Command::new("open")
            .arg("-a")
            .arg(app)
            .spawn();

        #[cfg(target_os = "linux")]
        let result = std::process::Command::new("xdg-open").arg(app).spawn();

        result.map_err(|e| format!("Failed to open app: {}", e))?;
        Ok(format!("Opened: {}", app))
    }

    fn open_url(&self, url: &str) -> Result<String, String> {
        #[cfg(windows)]
        let result = std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn();

        #[cfg(target_os = "macos")]
        let result = std::process::Command::new("open").arg(url).spawn();

        #[cfg(target_os = "linux")]
        let result = std::process::Command::new("xdg-open").arg(url).spawn();

        result.map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(format!("Opened: {}", url))
    }

    fn run_command(&self, cmd: &str) -> Result<String, String> {
        #[cfg(windows)]
        let output = std::process::Command::new("powershell")
            .args(["-Command", cmd])
            .output();

        #[cfg(not(windows))]
        let output = std::process::Command::new("sh").args(["-c", cmd]).output();

        let output = output.map_err(|e| format!("Failed to run command: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }

    fn volume_up(&self) -> Result<String, String> {
        #[cfg(windows)]
        {
            // Use PowerShell to increase volume
            self.run_command("(New-Object -ComObject WScript.Shell).SendKeys([char]175)")?;
        }
        Ok("Volume increased".to_string())
    }

    fn volume_down(&self) -> Result<String, String> {
        #[cfg(windows)]
        {
            self.run_command("(New-Object -ComObject WScript.Shell).SendKeys([char]174)")?;
        }
        Ok("Volume decreased".to_string())
    }

    fn mute(&self) -> Result<String, String> {
        #[cfg(windows)]
        {
            self.run_command("(New-Object -ComObject WScript.Shell).SendKeys([char]173)")?;
        }
        Ok("Volume muted/unmuted".to_string())
    }

    fn take_screenshot(&self) -> Result<String, String> {
        // For now, just trigger the native screenshot
        #[cfg(windows)]
        {
            self.run_command("snippingtool /clip")?;
        }
        Ok("Screenshot initiated".to_string())
    }

    fn copy_to_clipboard(&self, text: &str) -> Result<String, String> {
        #[cfg(windows)]
        {
            let cmd = format!("Set-Clipboard -Value '{}'", text.replace("'", "''"));
            self.run_command(&cmd)?;
        }
        Ok("Copied to clipboard".to_string())
    }

    fn paste_from_clipboard(&mut self) -> Result<String, String> {
        let enigo = self.enigo.as_mut().ok_or("Enigo not initialized")?;

        // Ctrl+V
        enigo
            .key(Key::Control, Direction::Press)
            .map_err(|e| format!("{}", e))?;
        enigo
            .key(Key::Unicode('v'), Direction::Click)
            .map_err(|e| format!("{}", e))?;
        enigo
            .key(Key::Control, Direction::Release)
            .map_err(|e| format!("{}", e))?;

        Ok("Pasted from clipboard".to_string())
    }
}
