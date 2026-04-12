//! App Integration Framework for ListenOS
//!
//! Provides modular integrations with popular applications
//! like Spotify, Discord, Slack, and system controls.

pub mod discord;
pub mod spotify;
pub mod system_controls;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Trait for app integrations
pub trait AppIntegration: Send + Sync {
    /// Get the integration name
    fn name(&self) -> &str;

    /// Get a description of the integration
    fn description(&self) -> &str;

    /// Check if the integration is available/installed
    fn is_available(&self) -> bool;

    /// Get supported actions
    fn supported_actions(&self) -> Vec<IntegrationAction>;

    /// Execute an action
    fn execute(
        &self,
        action: &str,
        params: &serde_json::Value,
    ) -> Result<IntegrationResult, String>;
}

/// Describes an action an integration can perform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationAction {
    pub id: String,
    pub name: String,
    pub description: String,
    pub parameters: Vec<ActionParameter>,
    pub example_phrases: Vec<String>,
}

/// Parameter for an integration action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionParameter {
    pub name: String,
    pub param_type: String, // "string", "number", "boolean"
    pub required: bool,
    pub description: String,
}

/// Result from an integration action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationResult {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

impl IntegrationResult {
    pub fn success(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: None,
        }
    }

    pub fn success_with_data(message: impl Into<String>, data: serde_json::Value) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: Some(data),
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            data: None,
        }
    }
}

/// Manages all app integrations
pub struct IntegrationManager {
    integrations: HashMap<String, Box<dyn AppIntegration>>,
    enabled: HashMap<String, bool>,
}

impl IntegrationManager {
    /// Create a new integration manager with default integrations
    pub fn new() -> Self {
        let mut manager = Self {
            integrations: HashMap::new(),
            enabled: HashMap::new(),
        };

        // Register default integrations
        manager.register(Box::new(spotify::SpotifyIntegration::new()));
        manager.register(Box::new(discord::DiscordIntegration::new()));
        manager.register(Box::new(system_controls::SystemControlsIntegration::new()));

        manager
    }

    /// Register an integration
    pub fn register(&mut self, integration: Box<dyn AppIntegration>) {
        let name = integration.name().to_string();
        self.enabled.insert(name.clone(), true);
        self.integrations.insert(name, integration);
    }

    /// Get all registered integrations
    pub fn list_integrations(&self) -> Vec<IntegrationInfo> {
        self.integrations
            .values()
            .map(|i| IntegrationInfo {
                name: i.name().to_string(),
                description: i.description().to_string(),
                available: i.is_available(),
                enabled: *self.enabled.get(i.name()).unwrap_or(&false),
                actions: i.supported_actions(),
            })
            .collect()
    }

    /// Get a specific integration
    pub fn get(&self, name: &str) -> Option<&dyn AppIntegration> {
        self.integrations.get(name).map(|i| i.as_ref())
    }

    /// Enable or disable an integration
    pub fn set_enabled(&mut self, name: &str, enabled: bool) -> bool {
        if self.integrations.contains_key(name) {
            self.enabled.insert(name.to_string(), enabled);
            true
        } else {
            false
        }
    }

    /// Check if an integration is enabled
    pub fn is_enabled(&self, name: &str) -> bool {
        *self.enabled.get(name).unwrap_or(&false)
    }

    /// Execute an action on an integration
    pub fn execute(
        &self,
        integration_name: &str,
        action: &str,
        params: &serde_json::Value,
    ) -> Result<IntegrationResult, String> {
        // Check if enabled
        if !self.is_enabled(integration_name) {
            return Err(format!("Integration '{}' is disabled", integration_name));
        }

        // Get integration
        let integration = self
            .integrations
            .get(integration_name)
            .ok_or_else(|| format!("Integration '{}' not found", integration_name))?;

        // Check availability
        if !integration.is_available() {
            return Err(format!(
                "Integration '{}' is not available on this system",
                integration_name
            ));
        }

        // Execute
        integration.execute(action, params)
    }

    /// Find which integration can handle a given action
    pub fn find_integration_for_action(&self, action: &str) -> Option<(&str, &dyn AppIntegration)> {
        for (name, integration) in &self.integrations {
            if !self.is_enabled(name) {
                continue;
            }
            if !integration.is_available() {
                continue;
            }
            if integration
                .supported_actions()
                .iter()
                .any(|a| a.id == action)
            {
                return Some((name.as_str(), integration.as_ref()));
            }
        }
        None
    }
}

impl Default for IntegrationManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Info about an integration for UI display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationInfo {
    pub name: String,
    pub description: String,
    pub available: bool,
    pub enabled: bool,
    pub actions: Vec<IntegrationAction>,
}
