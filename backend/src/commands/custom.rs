//! Custom Commands Engine for ListenOS
//!
//! Allows users to define their own voice-triggered command sequences.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// A custom user-defined command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomCommand {
    pub id: String,
    pub name: String,
    pub trigger_phrase: String,
    pub description: String,
    pub actions: Vec<ActionStep>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
    pub use_count: u32,
}

/// A single action step in a custom command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionStep {
    pub id: String,
    pub action_type: String,
    pub payload: serde_json::Value,
    pub delay_ms: u32,
    pub description: Option<String>,
}

impl ActionStep {
    pub fn new(action_type: &str, payload: serde_json::Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            action_type: action_type.to_string(),
            payload,
            delay_ms: 0,
            description: None,
        }
    }

    pub fn with_delay(mut self, delay_ms: u32) -> Self {
        self.delay_ms = delay_ms;
        self
    }

    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = Some(desc.to_string());
        self
    }
}

/// Built-in command templates
pub fn get_builtin_templates() -> Vec<CustomCommand> {
    vec![
        CustomCommand {
            id: "template_morning".to_string(),
            name: "Morning Routine".to_string(),
            trigger_phrase: "morning routine".to_string(),
            description: "Open email, calendar, and play morning news".to_string(),
            actions: vec![
                ActionStep::new("open_url", serde_json::json!({"url": "https://gmail.com"}))
                    .with_description("Open Gmail"),
                ActionStep::new(
                    "open_url",
                    serde_json::json!({"url": "https://calendar.google.com"}),
                )
                .with_delay(1000)
                .with_description("Open Google Calendar"),
                ActionStep::new(
                    "open_url",
                    serde_json::json!({"url": "https://news.google.com"}),
                )
                .with_delay(1000)
                .with_description("Open Google News"),
            ],
            enabled: false,
            created_at: Utc::now(),
            last_used: None,
            use_count: 0,
        },
        CustomCommand {
            id: "template_focus".to_string(),
            name: "Focus Mode".to_string(),
            trigger_phrase: "focus mode".to_string(),
            description: "Enable Do Not Disturb and open focus timer".to_string(),
            actions: vec![
                ActionStep::new("system_control", serde_json::json!({"action": "dnd"}))
                    .with_description("Enable Do Not Disturb"),
                ActionStep::new(
                    "open_url",
                    serde_json::json!({"url": "https://pomofocus.io"}),
                )
                .with_delay(500)
                .with_description("Open Pomodoro Timer"),
            ],
            enabled: false,
            created_at: Utc::now(),
            last_used: None,
            use_count: 0,
        },
        CustomCommand {
            id: "template_meeting".to_string(),
            name: "Meeting Prep".to_string(),
            trigger_phrase: "meeting prep".to_string(),
            description: "Mute Spotify and open video conferencing".to_string(),
            actions: vec![
                ActionStep::new("spotify_control", serde_json::json!({"action": "pause"}))
                    .with_description("Pause Spotify"),
                ActionStep::new("open_app", serde_json::json!({"app": "zoom"}))
                    .with_delay(500)
                    .with_description("Open Zoom"),
            ],
            enabled: false,
            created_at: Utc::now(),
            last_used: None,
            use_count: 0,
        },
        CustomCommand {
            id: "template_end_day".to_string(),
            name: "End of Day".to_string(),
            trigger_phrase: "end of day".to_string(),
            description: "Lock screen and prepare for shutdown".to_string(),
            actions: vec![
                ActionStep::new("system_control", serde_json::json!({"action": "lock"}))
                    .with_description("Lock Screen"),
            ],
            enabled: false,
            created_at: Utc::now(),
            last_used: None,
            use_count: 0,
        },
        CustomCommand {
            id: "template_music".to_string(),
            name: "Music Time".to_string(),
            trigger_phrase: "music time".to_string(),
            description: "Open Spotify and start playing".to_string(),
            actions: vec![
                ActionStep::new("open_app", serde_json::json!({"app": "spotify"}))
                    .with_description("Open Spotify"),
                ActionStep::new(
                    "spotify_control",
                    serde_json::json!({"action": "play_pause"}),
                )
                .with_delay(2000)
                .with_description("Play Music"),
            ],
            enabled: false,
            created_at: Utc::now(),
            last_used: None,
            use_count: 0,
        },
    ]
}

/// Custom commands storage
pub struct CustomCommandsStore {
    conn: Mutex<Connection>,
}

impl CustomCommandsStore {
    /// Create or open the commands database
    pub fn new() -> Result<Self, String> {
        let db_path = Self::get_db_path()?;

        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create data directory: {}", e))?;
        }

        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        let store = Self {
            conn: Mutex::new(conn),
        };
        store.init_tables()?;
        Ok(store)
    }

    /// Get the database path
    fn get_db_path() -> Result<PathBuf, String> {
        let data_dir =
            dirs_next::data_dir().ok_or_else(|| "Could not find data directory".to_string())?;
        Ok(data_dir.join("ListenOS").join("commands.db"))
    }

    /// Initialize database tables
    fn init_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS custom_commands (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                trigger_phrase TEXT NOT NULL UNIQUE,
                description TEXT,
                actions TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                last_used TEXT,
                use_count INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_commands_trigger ON custom_commands(trigger_phrase);
            CREATE INDEX IF NOT EXISTS idx_commands_enabled ON custom_commands(enabled);
            ",
        )
        .map_err(|e| format!("Failed to initialize tables: {}", e))?;

        Ok(())
    }

    /// Save a custom command
    pub fn save_command(&self, cmd: &CustomCommand) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let actions_json = serde_json::to_string(&cmd.actions)
            .map_err(|e| format!("Failed to serialize actions: {}", e))?;

        conn.execute(
            "INSERT OR REPLACE INTO custom_commands 
             (id, name, trigger_phrase, description, actions, enabled, created_at, last_used, use_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                cmd.id,
                cmd.name,
                cmd.trigger_phrase,
                cmd.description,
                actions_json,
                if cmd.enabled { 1 } else { 0 },
                cmd.created_at.to_rfc3339(),
                cmd.last_used.map(|d| d.to_rfc3339()),
                cmd.use_count,
            ],
        ).map_err(|e| format!("Failed to save command: {}", e))?;

        Ok(())
    }

    /// Get all custom commands
    pub fn get_all_commands(&self) -> Result<Vec<CustomCommand>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, name, trigger_phrase, description, actions, enabled, created_at, last_used, use_count
             FROM custom_commands ORDER BY name ASC"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let commands = stmt
            .query_map([], |row| {
                let actions_json: String = row.get(4)?;
                let actions: Vec<ActionStep> =
                    serde_json::from_str(&actions_json).unwrap_or_default();

                Ok(CustomCommand {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    trigger_phrase: row.get(2)?,
                    description: row.get(3)?,
                    actions,
                    enabled: row.get::<_, i32>(5)? != 0,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_used: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    use_count: row.get(8)?,
                })
            })
            .map_err(|e| format!("Failed to query commands: {}", e))?;

        commands
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect commands: {}", e))
    }

    /// Get enabled commands only
    pub fn get_enabled_commands(&self) -> Result<Vec<CustomCommand>, String> {
        let all = self.get_all_commands()?;
        Ok(all.into_iter().filter(|c| c.enabled).collect())
    }

    /// Find a command by trigger phrase
    pub fn find_by_trigger(&self, phrase: &str) -> Result<Option<CustomCommand>, String> {
        let phrase_lower = phrase.to_lowercase();
        let commands = self.get_enabled_commands()?;

        Ok(commands
            .into_iter()
            .find(|c| phrase_lower.contains(&c.trigger_phrase.to_lowercase())))
    }

    /// Delete a command
    pub fn delete_command(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM custom_commands WHERE id = ?1", [id])
            .map_err(|e| format!("Failed to delete command: {}", e))?;

        Ok(())
    }

    /// Update command usage
    pub fn record_usage(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE custom_commands SET last_used = ?1, use_count = use_count + 1 WHERE id = ?2",
            params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| format!("Failed to record usage: {}", e))?;

        Ok(())
    }

    /// Enable/disable a command
    pub fn set_enabled(&self, id: &str, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE custom_commands SET enabled = ?1 WHERE id = ?2",
            params![if enabled { 1 } else { 0 }, id],
        )
        .map_err(|e| format!("Failed to update command: {}", e))?;

        Ok(())
    }

    /// Import commands from JSON
    pub fn import_commands(&self, json: &str) -> Result<usize, String> {
        let commands: Vec<CustomCommand> =
            serde_json::from_str(json).map_err(|e| format!("Failed to parse JSON: {}", e))?;

        let count = commands.len();
        for cmd in commands {
            self.save_command(&cmd)?;
        }

        Ok(count)
    }

    /// Export commands to JSON
    pub fn export_commands(&self) -> Result<String, String> {
        let commands = self.get_all_commands()?;
        serde_json::to_string_pretty(&commands).map_err(|e| format!("Failed to serialize: {}", e))
    }
}
