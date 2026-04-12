//! Clipboard Service for ListenOS
//!
//! Provides clipboard operations including history tracking,
//! smart formatting, translation, and summarization.

use arboard::Clipboard;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Maximum clipboard history entries to keep
const MAX_HISTORY_SIZE: usize = 50;

/// A clipboard history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: String,
    pub content: String,
    pub content_type: ClipboardContentType,
    pub timestamp: DateTime<Utc>,
    pub source_app: Option<String>,
    pub word_count: usize,
    pub char_count: usize,
}

/// Type of clipboard content
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClipboardContentType {
    Text,
    Url,
    Email,
    Code,
    List,
    Unknown,
}

impl ClipboardContentType {
    /// Detect content type from text
    pub fn detect(text: &str) -> Self {
        let trimmed = text.trim();

        // Check for URL
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            return Self::Url;
        }

        // Check for email
        if trimmed.contains('@') && trimmed.contains('.') && !trimmed.contains(' ') {
            return Self::Email;
        }

        // Check for code (simple heuristics)
        if trimmed.contains("function ")
            || trimmed.contains("const ")
            || trimmed.contains("let ")
            || trimmed.contains("var ")
            || trimmed.contains("def ")
            || trimmed.contains("class ")
            || trimmed.contains("pub fn ")
            || trimmed.contains("import ")
            || trimmed.contains("#include")
        {
            return Self::Code;
        }

        // Check for list (multiple lines starting with bullets/numbers)
        let lines: Vec<&str> = trimmed.lines().collect();
        if lines.len() > 1 {
            let list_markers = lines
                .iter()
                .filter(|l| {
                    let t = l.trim();
                    t.starts_with("- ")
                        || t.starts_with("* ")
                        || t.starts_with("• ")
                        || t.chars().next().map(|c| c.is_numeric()).unwrap_or(false)
                })
                .count();
            if list_markers >= lines.len() / 2 {
                return Self::List;
            }
        }

        Self::Text
    }
}

/// Clipboard service with history tracking
pub struct ClipboardService {
    clipboard: Mutex<Option<Clipboard>>,
    history: Vec<ClipboardEntry>,
    last_content: Option<String>,
}

impl ClipboardService {
    /// Create a new clipboard service
    pub fn new() -> Self {
        let clipboard = Clipboard::new().ok();
        Self {
            clipboard: Mutex::new(clipboard),
            history: Vec::new(),
            last_content: None,
        }
    }

    /// Get current clipboard content
    pub fn get_current(&self) -> Result<String, String> {
        let mut guard = self.clipboard.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut clipboard) = *guard {
            clipboard
                .get_text()
                .map_err(|e| format!("Failed to get clipboard: {}", e))
        } else {
            Err("Clipboard not available".to_string())
        }
    }

    /// Set clipboard content
    pub fn set_content(&self, text: String) -> Result<(), String> {
        let mut guard = self.clipboard.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut clipboard) = *guard {
            clipboard
                .set_text(&text)
                .map_err(|e| format!("Failed to set clipboard: {}", e))
        } else {
            Err("Clipboard not available".to_string())
        }
    }

    /// Get a preview of clipboard content (truncated)
    pub fn get_preview(&self, max_chars: usize) -> Result<String, String> {
        let content = self.get_current()?;
        if content.len() <= max_chars {
            Ok(content)
        } else {
            Ok(format!("{}...", &content[..max_chars]))
        }
    }

    /// Check for new clipboard content and add to history
    pub fn check_and_record(&mut self) -> Option<ClipboardEntry> {
        let content = match self.get_current() {
            Ok(c) => c,
            Err(_) => return None,
        };

        // Skip if same as last content
        if self.last_content.as_ref() == Some(&content) {
            return None;
        }

        // Skip empty content
        if content.trim().is_empty() {
            return None;
        }

        self.last_content = Some(content.clone());

        let entry = ClipboardEntry {
            id: uuid::Uuid::new_v4().to_string(),
            content_type: ClipboardContentType::detect(&content),
            word_count: content.split_whitespace().count(),
            char_count: content.len(),
            content,
            timestamp: Utc::now(),
            source_app: None, // TODO: Could detect active window
        };

        self.history.insert(0, entry.clone());

        // Trim history
        if self.history.len() > MAX_HISTORY_SIZE {
            self.history.truncate(MAX_HISTORY_SIZE);
        }

        Some(entry)
    }

    /// Get clipboard history
    pub fn get_history(&self, limit: usize) -> Vec<ClipboardEntry> {
        self.history.iter().take(limit).cloned().collect()
    }

    /// Clear clipboard history
    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    /// Get a specific history entry by ID
    pub fn get_entry(&self, id: &str) -> Option<ClipboardEntry> {
        self.history.iter().find(|e| e.id == id).cloned()
    }

    /// Format clipboard content as bullet list
    pub fn format_as_list(text: &str) -> String {
        text.lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| format!("• {}", l.trim()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Format clipboard content as numbered list
    pub fn format_as_numbered_list(text: &str) -> String {
        text.lines()
            .filter(|l| !l.trim().is_empty())
            .enumerate()
            .map(|(i, l)| format!("{}. {}", i + 1, l.trim()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Clean up text (remove extra whitespace, normalize)
    pub fn clean_text(text: &str) -> String {
        // Replace multiple spaces with single space
        let mut result = String::new();
        let mut last_was_space = false;
        let mut last_was_newline = false;

        for c in text.chars() {
            if c == '\n' || c == '\r' {
                if !last_was_newline {
                    result.push('\n');
                    last_was_newline = true;
                }
                last_was_space = false;
            } else if c.is_whitespace() {
                if !last_was_space && !last_was_newline {
                    result.push(' ');
                    last_was_space = true;
                }
            } else {
                result.push(c);
                last_was_space = false;
                last_was_newline = false;
            }
        }

        result.trim().to_string()
    }
}

impl Default for ClipboardService {
    fn default() -> Self {
        Self::new()
    }
}
