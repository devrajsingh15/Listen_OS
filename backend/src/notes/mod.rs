//! Notes Storage System for ListenOS
//!
//! Quick voice notes that persist locally.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// A single note
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub tags: Vec<String>,
    pub is_pinned: bool,
}

impl Note {
    pub fn new(content: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            content,
            timestamp: Utc::now(),
            tags: Vec::new(),
            is_pinned: false,
        }
    }
}

/// Persistent storage for notes
pub struct NotesStore {
    conn: Mutex<Connection>,
}

impl NotesStore {
    /// Create or open the notes database
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
        Ok(data_dir.join("ListenOS").join("notes.db"))
    }

    /// Initialize database tables
    fn init_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                is_pinned INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_notes_timestamp ON notes(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
            ",
        )
        .map_err(|e| format!("Failed to initialize tables: {}", e))?;

        Ok(())
    }

    /// Create a new note
    pub fn create_note(&self, content: String) -> Result<Note, String> {
        let note = Note::new(content);
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO notes (id, content, timestamp, tags, is_pinned) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                note.id,
                note.content,
                note.timestamp.to_rfc3339(),
                serde_json::to_string(&note.tags).unwrap_or_default(),
                if note.is_pinned { 1 } else { 0 },
            ],
        ).map_err(|e| format!("Failed to create note: {}", e))?;

        Ok(note)
    }

    /// Get all notes
    pub fn get_all_notes(&self, limit: Option<usize>) -> Result<Vec<Note>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let query = match limit {
            Some(l) => format!("SELECT id, content, timestamp, tags, is_pinned FROM notes ORDER BY is_pinned DESC, timestamp DESC LIMIT {}", l),
            None => "SELECT id, content, timestamp, tags, is_pinned FROM notes ORDER BY is_pinned DESC, timestamp DESC".to_string(),
        };

        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let notes = stmt
            .query_map([], |row| {
                let tags_json: String = row.get(3)?;
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

                Ok(Note {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    timestamp: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    tags,
                    is_pinned: row.get::<_, i32>(4)? != 0,
                })
            })
            .map_err(|e| format!("Failed to query notes: {}", e))?;

        notes
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect notes: {}", e))
    }

    /// Update a note
    pub fn update_note(&self, id: &str, content: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE notes SET content = ?1 WHERE id = ?2",
            params![content, id],
        )
        .map_err(|e| format!("Failed to update note: {}", e))?;

        Ok(())
    }

    /// Toggle pin status
    pub fn toggle_pin(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Get current state
        let current: i32 = conn
            .query_row("SELECT is_pinned FROM notes WHERE id = ?1", [id], |row| {
                row.get(0)
            })
            .map_err(|e| format!("Note not found: {}", e))?;

        let new_state = if current == 0 { 1 } else { 0 };

        conn.execute(
            "UPDATE notes SET is_pinned = ?1 WHERE id = ?2",
            params![new_state, id],
        )
        .map_err(|e| format!("Failed to toggle pin: {}", e))?;

        Ok(new_state == 1)
    }

    /// Delete a note
    pub fn delete_note(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM notes WHERE id = ?1", [id])
            .map_err(|e| format!("Failed to delete note: {}", e))?;

        Ok(())
    }

    /// Search notes
    pub fn search_notes(&self, query: &str) -> Result<Vec<Note>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT id, content, timestamp, tags, is_pinned FROM notes 
             WHERE content LIKE ?1 
             ORDER BY is_pinned DESC, timestamp DESC",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let search_pattern = format!("%{}%", query);

        let notes = stmt
            .query_map([search_pattern], |row| {
                let tags_json: String = row.get(3)?;
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

                Ok(Note {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    timestamp: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    tags,
                    is_pinned: row.get::<_, i32>(4)? != 0,
                })
            })
            .map_err(|e| format!("Failed to query notes: {}", e))?;

        notes
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect notes: {}", e))
    }
}
