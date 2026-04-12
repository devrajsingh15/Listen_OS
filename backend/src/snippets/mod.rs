//! Snippets Storage System for ListenOS
//!
//! Text expansion snippets that can be triggered by voice.

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// A text expansion snippet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub trigger: String,   // What to say to trigger (e.g., "my email")
    pub expansion: String, // What gets typed (e.g., "user@example.com")
    pub category: String,  // "personal" or "shared"
    pub created_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
    pub use_count: u32,
}

impl Snippet {
    pub fn new(trigger: String, expansion: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            trigger,
            expansion,
            category: "personal".to_string(),
            created_at: Utc::now(),
            last_used: None,
            use_count: 0,
        }
    }
}

/// Persistent storage for snippets
pub struct SnippetsStore {
    conn: Mutex<Connection>,
}

impl SnippetsStore {
    /// Create or open the snippets database
    pub fn new() -> Result<Self, String> {
        let db_path = Self::get_db_path()?;

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

    fn get_db_path() -> Result<PathBuf, String> {
        let data_dir =
            dirs_next::data_dir().ok_or_else(|| "Could not find data directory".to_string())?;
        Ok(data_dir.join("ListenOS").join("snippets.db"))
    }

    fn init_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                trigger TEXT NOT NULL UNIQUE,
                expansion TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'personal',
                created_at TEXT NOT NULL,
                last_used TEXT,
                use_count INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_snippets_trigger ON snippets(trigger);
            CREATE INDEX IF NOT EXISTS idx_snippets_category ON snippets(category);
            ",
        )
        .map_err(|e| format!("Failed to initialize tables: {}", e))?;

        Ok(())
    }

    /// Create a new snippet
    pub fn create_snippet(&self, trigger: String, expansion: String) -> Result<Snippet, String> {
        let snippet = Snippet::new(trigger, expansion);
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO snippets (id, trigger, expansion, category, created_at, use_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                snippet.id,
                snippet.trigger,
                snippet.expansion,
                snippet.category,
                snippet.created_at.to_rfc3339(),
                snippet.use_count,
            ],
        ).map_err(|e| format!("Failed to create snippet: {}", e))?;

        Ok(snippet)
    }

    /// Get all snippets
    pub fn get_all_snippets(&self) -> Result<Vec<Snippet>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT id, trigger, expansion, category, created_at, last_used, use_count 
             FROM snippets ORDER BY use_count DESC, trigger ASC",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let snippets = stmt
            .query_map([], |row| {
                Ok(Snippet {
                    id: row.get(0)?,
                    trigger: row.get(1)?,
                    expansion: row.get(2)?,
                    category: row.get(3)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_used: row
                        .get::<_, Option<String>>(5)?
                        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                        .map(|dt| dt.with_timezone(&Utc)),
                    use_count: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to query snippets: {}", e))?;

        snippets
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect snippets: {}", e))
    }

    /// Find snippet by trigger phrase
    pub fn find_by_trigger(&self, trigger: &str) -> Result<Option<Snippet>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT id, trigger, expansion, category, created_at, last_used, use_count 
             FROM snippets WHERE LOWER(trigger) = LOWER(?1)",
            )
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let result = stmt.query_row([trigger], |row| {
            Ok(Snippet {
                id: row.get(0)?,
                trigger: row.get(1)?,
                expansion: row.get(2)?,
                category: row.get(3)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                last_used: row
                    .get::<_, Option<String>>(5)?
                    .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
                use_count: row.get(6)?,
            })
        });

        match result {
            Ok(snippet) => Ok(Some(snippet)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to find snippet: {}", e)),
        }
    }

    /// Update a snippet
    pub fn update_snippet(
        &self,
        id: &str,
        trigger: String,
        expansion: String,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE snippets SET trigger = ?1, expansion = ?2 WHERE id = ?3",
            params![trigger, expansion, id],
        )
        .map_err(|e| format!("Failed to update snippet: {}", e))?;

        Ok(())
    }

    /// Record snippet usage
    pub fn record_usage(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE snippets SET last_used = ?1, use_count = use_count + 1 WHERE id = ?2",
            params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| format!("Failed to record usage: {}", e))?;

        Ok(())
    }

    /// Delete a snippet
    pub fn delete_snippet(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM snippets WHERE id = ?1", [id])
            .map_err(|e| format!("Failed to delete snippet: {}", e))?;

        Ok(())
    }
}
