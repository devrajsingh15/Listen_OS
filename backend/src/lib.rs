//! ListenOS - AI-Powered Voice Control System
//! 
//! Dual-window architecture:
//! - Dashboard: Main app for settings, stats, and AI management
//! - Assistant: Always-running overlay that appears on hotkey press

mod audio;
mod commands;
mod ai;
mod system;
mod config;
mod cloud;
mod streaming;
mod conversation;
mod clipboard;
mod integrations;
mod notes;
mod snippets;
mod dictionary;
mod correction;
mod error_log;

use tauri::{
    Emitter, Manager, AppHandle, PhysicalPosition, Position,
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    menu::{Menu, MenuItem},
};
use tauri_plugin_global_shortcut::ShortcutState;
use std::sync::Arc;
use tokio::sync::Mutex;

pub use audio::AudioState;
pub use commands::*;
pub use config::AppConfig;
pub use cloud::{VoiceContext, VoiceMode};
pub use streaming::{AudioStreamer, AudioAccumulator, SAMPLE_RATE};
pub use conversation::{ConversationMemory, ConversationStore, Message, Role, Fact};
pub use clipboard::ClipboardService;
pub use integrations::{IntegrationManager, AppIntegration};
pub use notes::{Note, NotesStore};
pub use snippets::{Snippet, SnippetsStore};
pub use dictionary::{DictionaryWord, DictionaryStore};
pub use correction::CorrectionTracker;
pub use error_log::{ErrorLog, ErrorEntry, ErrorType};

fn center_assistant_horizontally(app: &tauri::AppHandle) {
    if let Some(assistant) = app.get_webview_window("assistant") {
        let monitor = assistant
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| assistant.primary_monitor().ok().flatten());

        if let Some(monitor) = monitor {
            let monitor_pos = monitor.position();
            let monitor_size = monitor.size();
            let window_size = assistant.outer_size().ok();
            let window_width = window_size.map(|s| s.width as i32).unwrap_or(300);

            let centered_x = monitor_pos.x + ((monitor_size.width as i32 - window_width) / 2);
            let top_y = monitor_pos.y + 10;

            let _ = assistant.set_position(Position::Physical(PhysicalPosition::new(
                centered_x,
                top_y,
            )));
        }
    }
}

/// Global application state
pub struct AppState {
    pub audio: Arc<Mutex<AudioState>>,
    pub config: Arc<Mutex<AppConfig>>,
    pub streamer: Arc<Mutex<AudioStreamer>>,
    pub accumulator: Arc<Mutex<AudioAccumulator>>,
    pub is_listening: Arc<Mutex<bool>>,
    pub is_processing: Arc<Mutex<bool>>,
    pub current_context: Arc<Mutex<VoiceContext>>,
    pub history: Arc<Mutex<Vec<VoiceProcessingResult>>>,
    // New: Conversation memory for multi-turn dialogues
    pub conversation: Arc<Mutex<ConversationMemory>>,
    pub conversation_store: Arc<std::sync::Mutex<Option<ConversationStore>>>,
    // New: Clipboard service
    pub clipboard: Arc<Mutex<ClipboardService>>,
    // New: App integrations
    pub integrations: Arc<Mutex<IntegrationManager>>,
    // Correction tracking for auto-learning
    pub correction_tracker: Arc<Mutex<CorrectionTracker>>,
    // Error logging
    pub error_log: Arc<Mutex<ErrorLog>>,
    // Pending high-risk action awaiting explicit user confirmation
    pub pending_action: Arc<Mutex<Option<commands::PendingAction>>>,
}

impl Default for AppState {
    fn default() -> Self {
        // Initialize conversation store (may fail, that's ok)
        let conversation_store = ConversationStore::new().ok();
        
        // Load facts from store if available
        let mut conversation = ConversationMemory::new_session();
        if let Some(ref store) = conversation_store {
            if let Ok(facts) = store.load_facts() {
                conversation.extracted_facts = facts;
            }
        }

        let mut app_config = AppConfig::default();
        if let Some(saved_languages) = crate::config::LanguagePreferences::load_from_disk() {
            app_config.language_preferences = saved_languages;
        }
        if let Some(saved_vibe) = crate::config::VibeCodingConfig::load_from_disk() {
            app_config.vibe_coding = saved_vibe;
        }

        Self {
            audio: Arc::new(Mutex::new(AudioState::default())),
            config: Arc::new(Mutex::new(app_config)),
            streamer: Arc::new(Mutex::new(AudioStreamer::new())),
            accumulator: Arc::new(Mutex::new(AudioAccumulator::new(SAMPLE_RATE))),
            is_listening: Arc::new(Mutex::new(false)),
            is_processing: Arc::new(Mutex::new(false)),
            current_context: Arc::new(Mutex::new(VoiceContext::default())),
            history: Arc::new(Mutex::new(Vec::new())),
            conversation: Arc::new(Mutex::new(conversation)),
            conversation_store: Arc::new(std::sync::Mutex::new(conversation_store)),
            clipboard: Arc::new(Mutex::new(ClipboardService::new())),
            integrations: Arc::new(Mutex::new(IntegrationManager::new())),
            correction_tracker: Arc::new(Mutex::new(CorrectionTracker::new())),
            error_log: Arc::new(Mutex::new(ErrorLog::new())),
            pending_action: Arc::new(Mutex::new(None)),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env.local file from project root
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let env_path = std::path::PathBuf::from(manifest_dir).join("../.env.local");
    if env_path.exists() {
        let _ = dotenvy::from_path(&env_path);
    }
    
    let _ = env_logger::try_init();
    log::info!("Starting ListenOS - AI Voice Control System");
    
    // Debug: Check if API keys are loaded
    let deepgram_key = std::env::var("DEEPGRAM_API_KEY").unwrap_or_default();
    log::info!("DEEPGRAM_API_KEY loaded: {} chars", deepgram_key.len());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    let shortcut_str = shortcut.to_string();
                    log::info!("Global shortcut event: {} - {:?}", shortcut_str, event.state);
                    
                    // Emit events to the assistant window (always visible pill)
                    if let Some(assistant) = app.get_webview_window("assistant") {
                        if event.state == ShortcutState::Pressed {
                            log::info!("Hotkey pressed - activating assistant");
                            // Just emit the event, window is always visible
                            let _ = assistant.emit("shortcut-pressed", ());
                        } else if event.state == ShortcutState::Released {
                            log::info!("Ctrl+Space released - processing");
                            let _ = assistant.emit("shortcut-released", ());
                        }
                    }
                })
                .build()
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // This is called when a second instance is launched
            // argv contains the command line arguments including deep link URLs
            log::info!("Single instance callback: {:?}", argv);
            
            // Check for deep link URL in arguments
            for arg in argv.iter() {
                if arg.starts_with("listenos://") {
                    log::info!("Deep link received: {}", arg);
                    // Emit to frontend to handle auth callback
                    if let Some(window) = app.get_webview_window("dashboard") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("deep-link", arg.clone());
                    }
                }
            }
            
            // Show the dashboard window
            if let Some(window) = app.get_webview_window("dashboard") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Voice
            commands::start_listening,
            commands::stop_listening,
            commands::get_status,
            commands::get_audio_level,
            // Actions
            commands::type_text,
            commands::run_system_command,
            commands::get_pending_action,
            commands::confirm_pending_action,
            commands::cancel_pending_action,
            // Audio
            commands::get_audio_devices,
            commands::set_audio_device,
            // Config
            commands::get_config,
            commands::set_config,
            commands::get_trigger_hotkey,
            commands::set_trigger_hotkey,
            commands::get_language_preferences,
            commands::set_language_preferences,
            commands::get_vibe_coding_config,
            commands::set_vibe_coding_config,
            commands::get_local_api_settings,
            commands::set_local_api_settings,
            // Conversation
            commands::get_conversation,
            commands::clear_conversation,
            commands::new_conversation_session,
            // Clipboard
            commands::get_clipboard,
            commands::set_clipboard,
            commands::get_clipboard_history,
            // Integrations
            commands::get_integrations,
            commands::set_integration_enabled,
            // Custom Commands
            commands::get_custom_commands,
            commands::get_command_templates,
            commands::save_custom_command,
            commands::delete_custom_command,
            commands::set_custom_command_enabled,
            commands::export_custom_commands,
            commands::import_custom_commands,
            // Data
            get_history,
            clear_history,
            // Window control
            hide_assistant,
            show_dashboard,
            // Autostart
            get_autostart_enabled,
            set_autostart_enabled,
            // Notes
            get_notes,
            create_note,
            create_voice_note,
            update_note,
            delete_note,
            toggle_note_pin,
            // Snippets
            get_snippets,
            create_snippet,
            update_snippet,
            delete_snippet,
            // Dictionary
            get_dictionary_words,
            add_dictionary_word,
            update_dictionary_word,
            delete_dictionary_word,
            // Error Log
            get_errors,
            get_undismissed_errors,
            dismiss_error,
            dismiss_all_errors,
            // Correction Learning
            learn_correction,
        ])
        .setup(|app| {
            // Register global shortcut on startup
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
            use std::str::FromStr;
            
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                let state = handle.state::<AppState>();
                let config = state.config.lock().await;
                let shortcut_str = &config.trigger_hotkey;
                
                if let Ok(shortcut) = Shortcut::from_str(shortcut_str) {
                    let _ = handle.global_shortcut().register(shortcut);
                    log::info!("Registered startup shortcut: {}", shortcut_str);
                } else {
                    log::warn!("Failed to parse shortcut: {}", shortcut_str);
                }
            });

            // Setup tray icon
            setup_tray(app)?;

            // Check for updates on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait a bit before checking for updates
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                
                log::info!("Checking for updates...");
                
                // Get the updater (returns Result)
                let updater = match tauri_plugin_updater::UpdaterExt::updater(&app_handle) {
                    Ok(u) => u,
                    Err(e) => {
                        log::warn!("Failed to initialize updater: {}", e);
                        return;
                    }
                };
                
                match updater.check().await {
                    Ok(Some(update)) => {
                        log::info!("Update available: {} -> {}", update.current_version, update.version);
                        // Notify the user via the dashboard window
                        if let Some(dashboard) = app_handle.get_webview_window("dashboard") {
                            let _ = dashboard.emit("update-available", serde_json::json!({
                                "current": update.current_version,
                                "new": update.version,
                            }));
                        }
                        
                        // Auto-download and install
                        match update.download_and_install(|_, _| {}, || {}).await {
                            Ok(_) => {
                                log::info!("Update downloaded and installed, will apply on restart");
                                if let Some(dashboard) = app_handle.get_webview_window("dashboard") {
                                    let _ = dashboard.emit("update-ready", ());
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to download/install update: {}", e);
                            }
                        }
                    }
                    Ok(None) => {
                        log::info!("No updates available");
                    }
                    Err(e) => {
                        log::warn!("Failed to check for updates: {}", e);
                    }
                }
            });

            // Dashboard: Hide to tray on close (don't quit app)
            if let Some(dashboard) = app.get_webview_window("dashboard") {
                let dashboard_clone = dashboard.clone();
                dashboard.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = dashboard_clone.hide();
                        log::info!("Dashboard hidden to tray");
                    }
                });
            }

            // Assistant: Always visible pill, transparent background
            if let Some(assistant) = app.get_webview_window("assistant") {
                // Don't set ignore cursor events - we want hover to work
                // let _ = assistant.set_ignore_cursor_events(true);

                // Set WebView background to transparent (RGBA with 0 alpha)
                #[cfg(target_os = "windows")]
                {
                    use tauri::webview::Color;
                    let _ = assistant.set_background_color(Some(Color(0, 0, 0, 0)));
                }
                
                #[cfg(target_os = "macos")]
                {
                    use tauri::webview::Color;
                    let _ = assistant.set_background_color(Some(Color(0, 0, 0, 0)));
                }
                
                // Place assistant overlay at top-center of the current monitor.
                center_assistant_horizontally(&app.handle().clone());

                // Show the assistant pill (always visible)
                let _ = assistant.show();
                log::info!("Assistant pill initialized (always visible, transparent)");
            }

            // Start clipboard monitoring in background with auto-correction learning
            let clipboard_state = app.state::<AppState>().clipboard.clone();
            let correction_tracker = app.state::<AppState>().correction_tracker.clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(500));
                loop {
                    interval.tick().await;
                    let mut clipboard = clipboard_state.lock().await;
                    if let Some(entry) = clipboard.check_and_record() {
                        log::debug!("Clipboard captured: {} chars", entry.char_count);
                        
                        // Check for corrections (user typed something that differs from what we pasted)
                        let content = entry.content.clone();
                        drop(clipboard); // Release lock before acquiring another
                        
                        let mut tracker = correction_tracker.lock().await;
                        let corrections = tracker.detect_corrections(&content);
                        
                        // Auto-learn any detected corrections
                        if !corrections.is_empty() {
                            if let Ok(store) = dictionary::DictionaryStore::new() {
                                for (original, corrected) in corrections {
                                    if store.word_exists(&corrected).unwrap_or(true) {
                                        continue; // Skip if already in dictionary
                                    }
                                    if let Ok(_) = store.add_word(corrected.clone(), true) {
                                        log::info!("Auto-learned word: {} (from correction of {})", corrected, original);
                                    }
                                }
                            }
                        }
                    }
                }
            });
            log::info!("Clipboard monitoring with auto-learning started");

            // Ensure autostart is always enabled so the assistant resumes after reboot/login.
            {
                use tauri_plugin_autostart::ManagerExt;
                let manager = app.autolaunch();
                if let Err(e) = manager.enable() {
                    log::warn!("Failed to enforce autostart: {}", e);
                } else if let Ok(is_enabled) = manager.is_enabled() {
                    if is_enabled {
                        log::info!("Autostart is enabled");
                    } else {
                        log::warn!("Autostart enable call returned but state is disabled");
                    }
                }
            }

            log::info!("ListenOS setup complete - dual-window architecture ready");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ListenOS");
}

#[tauri::command]
async fn hide_assistant(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("assistant") {
        let _ = window.hide();
    }
    Ok(())
}

#[tauri::command]
async fn show_dashboard(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("dashboard") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
async fn get_history(state: tauri::State<'_, AppState>) -> Result<Vec<VoiceProcessingResult>, String> {
    let history = state.history.lock().await;
    Ok(history.clone())
}

#[tauri::command]
async fn clear_history(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut history = state.history.lock().await;
    history.clear();
    Ok(())
}

#[tauri::command]
async fn get_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    manager.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    
    if enabled {
        manager.enable().map_err(|e| e.to_string())?;
    } else {
        manager.disable().map_err(|e| e.to_string())?;
    }
    
    // Return the new state
    manager.is_enabled().map_err(|e| e.to_string())
}

// ============ Notes Commands ============

#[tauri::command]
async fn get_notes(limit: Option<usize>) -> Result<Vec<notes::Note>, String> {
    let store = notes::NotesStore::new()?;
    store.get_all_notes(limit)
}

#[tauri::command]
async fn create_note(content: String) -> Result<notes::Note, String> {
    let store = notes::NotesStore::new()?;
    store.create_note(content)
}

#[tauri::command]
async fn update_note(id: String, content: String) -> Result<(), String> {
    let store = notes::NotesStore::new()?;
    store.update_note(&id, content)
}

#[tauri::command]
async fn delete_note(id: String) -> Result<(), String> {
    let store = notes::NotesStore::new()?;
    store.delete_note(&id)
}

#[tauri::command]
async fn toggle_note_pin(id: String) -> Result<bool, String> {
    let store = notes::NotesStore::new()?;
    store.toggle_pin(&id)
}

/// Create a note from voice - simplified flow that just transcribes and saves
#[tauri::command]
async fn create_voice_note(state: tauri::State<'_, AppState>) -> Result<notes::Note, String> {
    use cloud::VoiceClient;
    
    // Get accumulated audio
    let (samples, sample_rate) = {
        let accumulator = state.accumulator.lock().await;
        (accumulator.get_samples().to_vec(), accumulator.sample_rate())
    };

    if samples.is_empty() || samples.len() < 1600 {
        return Err("Recording too short".to_string());
    }

    // Encode to WAV
    let wav_data = cloud::encode_wav(&samples, sample_rate)?;

    // Transcribe with Deepgram (no intent processing)
    let client = VoiceClient::new();
    let result = client.transcribe(&wav_data).await?;
    
    let text = result.text.trim();
    if text.is_empty() {
        return Err("No speech detected".to_string());
    }

    // Create and save the note
    let store = notes::NotesStore::new()?;
    store.create_note(text.to_string())
}

// ============ Snippets Commands ============

#[tauri::command]
async fn get_snippets() -> Result<Vec<snippets::Snippet>, String> {
    let store = snippets::SnippetsStore::new()?;
    store.get_all_snippets()
}

#[tauri::command]
async fn create_snippet(trigger: String, expansion: String) -> Result<snippets::Snippet, String> {
    let store = snippets::SnippetsStore::new()?;
    store.create_snippet(trigger, expansion)
}

#[tauri::command]
async fn update_snippet(id: String, trigger: String, expansion: String) -> Result<(), String> {
    let store = snippets::SnippetsStore::new()?;
    store.update_snippet(&id, trigger, expansion)
}

#[tauri::command]
async fn delete_snippet(id: String) -> Result<(), String> {
    let store = snippets::SnippetsStore::new()?;
    store.delete_snippet(&id)
}

// ============ Dictionary Commands ============

#[tauri::command]
async fn get_dictionary_words() -> Result<Vec<dictionary::DictionaryWord>, String> {
    let store = dictionary::DictionaryStore::new()?;
    store.get_all_words()
}

#[tauri::command]
async fn add_dictionary_word(word: String, is_auto_learned: Option<bool>) -> Result<dictionary::DictionaryWord, String> {
    let store = dictionary::DictionaryStore::new()?;
    store.add_word(word, is_auto_learned.unwrap_or(false))
}

#[tauri::command]
async fn update_dictionary_word(id: String, word: String, phonetic: Option<String>) -> Result<(), String> {
    let store = dictionary::DictionaryStore::new()?;
    store.update_word(&id, word, phonetic)
}

#[tauri::command]
async fn delete_dictionary_word(id: String) -> Result<(), String> {
    let store = dictionary::DictionaryStore::new()?;
    store.delete_word(&id)
}

// ============ Error Log Commands ============

#[tauri::command]
async fn get_errors(state: tauri::State<'_, AppState>, limit: Option<usize>) -> Result<Vec<error_log::ErrorEntry>, String> {
    let error_log = state.error_log.lock().await;
    Ok(error_log.get_recent(limit.unwrap_or(20)))
}

#[tauri::command]
async fn get_undismissed_errors(state: tauri::State<'_, AppState>) -> Result<Vec<error_log::ErrorEntry>, String> {
    let error_log = state.error_log.lock().await;
    Ok(error_log.get_undismissed())
}

#[tauri::command]
async fn dismiss_error(state: tauri::State<'_, AppState>, id: String) -> Result<bool, String> {
    let mut error_log = state.error_log.lock().await;
    Ok(error_log.dismiss(&id))
}

#[tauri::command]
async fn dismiss_all_errors(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut error_log = state.error_log.lock().await;
    error_log.dismiss_all();
    Ok(())
}

// ============ Correction Learning Commands ============

/// Learn a correction from user's manual edit
/// Call this when user types something different right after voice input
#[tauri::command]
async fn learn_correction(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    corrected_text: String
) -> Result<Vec<String>, String> {
    let mut tracker = state.correction_tracker.lock().await;
    let corrections = tracker.detect_corrections(&corrected_text);
    
    // Auto-learn detected corrections to dictionary
    let mut learned = Vec::new();
    let store = dictionary::DictionaryStore::new()?;
    
    for (original, corrected) in corrections {
        // Add the corrected word to dictionary (if not already there)
        if !store.word_exists(&corrected)? {
            store.add_word(corrected.clone(), true)?;
            learned.push(corrected.clone());
            log::info!("Auto-learned word from correction: {} -> {}", original, corrected);
            
            // Emit event to frontend for notification
            if let Some(assistant) = app.get_webview_window("assistant") {
                let _ = assistant.emit("word-learned", serde_json::json!({ "word": corrected }));
            }
        }
    }
    
    Ok(learned)
}

fn setup_tray(app: &mut tauri::App) -> Result<(), tauri::Error> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit ListenOS", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show", "Open Dashboard", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let icon = match app.default_window_icon().cloned() {
        Some(i) => i,
        None => {
            log::warn!("Default window icon not found");
            return Ok(());
        }
    };
    
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "quit" => app.exit(0),
                "show" => {
                    if let Some(window) = app.get_webview_window("dashboard") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("dashboard") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    log::info!("System tray initialized");
    Ok(())
}
