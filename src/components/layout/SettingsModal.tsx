"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  isTauri,
  getAutostartEnabled,
  setAutostartEnabled,
  getTriggerHotkey,
  setTriggerHotkey,
  getLanguagePreferences,
  setLanguagePreferences,
  getVibeCodingConfig,
  setVibeCodingConfig,
  getLocalApiSettings,
  setLocalApiSettings,
} from "@/lib/tauri";
import type { VibeCodingConfig } from "@/lib/tauri";
import { checkForUpdates } from "@/lib/updater";
import { useSettings } from "@/context/SettingsContext";
import packageInfo from "../../../package.json";
import {
  Settings02Icon,
  ComputerIcon,
  HashtagIcon,
  TestTubeIcon,
  UserCircleIcon,
  UserGroupIcon,
  CreditCardIcon,
  ShieldUserIcon,
  Cancel01Icon,
  Download04Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection =
  | "general"
  | "system"
  | "vibe-coding"
  | "experimental"
  | "account"
  | "team"
  | "billing"
  | "privacy";

interface SettingsNavItem {
  id: SettingsSection;
  label: string;
  icon: typeof Settings02Icon;
  category: "settings" | "account";
}

const settingsNavItems: SettingsNavItem[] = [
  { id: "general", label: "General", icon: Settings02Icon, category: "settings" },
  { id: "system", label: "System", icon: ComputerIcon, category: "settings" },
  { id: "vibe-coding", label: "Vibe coding", icon: HashtagIcon, category: "settings" },
  { id: "experimental", label: "Experimental", icon: TestTubeIcon, category: "settings" },
  { id: "account", label: "Account", icon: UserCircleIcon, category: "account" },
  { id: "team", label: "Team", icon: UserGroupIcon, category: "account" },
  { id: "billing", label: "Plans and Billing", icon: CreditCardIcon, category: "account" },
  { id: "privacy", label: "Data and Privacy", icon: ShieldUserIcon, category: "account" },
];

const APP_VERSION = packageInfo.version;

const SOURCE_LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto Detect" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
];

const TARGET_LANGUAGE_OPTIONS = SOURCE_LANGUAGE_OPTIONS.filter((option) => option.value !== "auto");

const VIBE_ACTIVATION_OPTIONS: Array<{
  value: VibeCodingConfig["activation_mode"];
  label: string;
  description: string;
}> = [
  { value: "SmartAuto", label: "Dynamic smart", description: "Auto-enhance only when coding intent is strong." },
  { value: "ManualOnly", label: "Manual trigger", description: "Enhance only when you start with the trigger phrase." },
  { value: "Always", label: "Always on", description: "Enhance every typed dictation prompt." },
];

const VIBE_TARGET_TOOL_OPTIONS: Array<{
  value: VibeCodingConfig["target_tool"];
  label: string;
}> = [
  { value: "Generic", label: "Generic" },
  { value: "Cursor", label: "Cursor" },
  { value: "Windsurf", label: "Windsurf" },
  { value: "Claude", label: "Claude" },
  { value: "ChatGPT", label: "ChatGPT" },
  { value: "Copilot", label: "GitHub Copilot" },
];

const VIBE_DETAIL_LEVEL_OPTIONS: Array<{
  value: VibeCodingConfig["detail_level"];
  label: string;
}> = [
  { value: "Concise", label: "Concise" },
  { value: "Balanced", label: "Balanced" },
  { value: "Detailed", label: "Detailed" },
];

const DEFAULT_VIBE_CONFIG: VibeCodingConfig = {
  enabled: false,
  activation_mode: "SmartAuto",
  trigger_phrase: "vibe",
  target_tool: "Generic",
  detail_level: "Balanced",
  include_constraints: true,
  include_acceptance_criteria: true,
  include_test_notes: false,
  concise_output: false,
};

function getLanguageLabel(code: string, source = false): string {
  const options = source ? SOURCE_LANGUAGE_OPTIONS : TARGET_LANGUAGE_OPTIONS;
  return options.find((option) => option.value === code)?.label ?? code;
}

function getVibeActivationDescription(mode: VibeCodingConfig["activation_mode"]): string {
  return (
    VIBE_ACTIVATION_OPTIONS.find((option) => option.value === mode)?.description ??
    "Auto-enhance prompts."
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  const settingsItems = settingsNavItems.filter((item) => item.category === "settings");
  const accountItems = settingsNavItems.filter((item) => item.category === "account");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 flex h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-card shadow-modal"
          >
            {/* Settings Sidebar */}
            <div className="flex w-56 flex-col border-r border-border bg-sidebar-bg p-4">
              {/* Settings Section */}
              <div className="mb-4">
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Settings
                </h3>
                <ul className="space-y-1">
                  {settingsItems.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          activeSection === item.id
                            ? "bg-sidebar-active text-foreground"
                            : "text-muted hover:bg-sidebar-hover hover:text-foreground"
                        )}
                      >
                        <HugeiconsIcon icon={item.icon} size={18} />
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Account Section */}
              <div>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Account
                </h3>
                <ul className="space-y-1">
                  {accountItems.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          activeSection === item.id
                            ? "bg-sidebar-active text-foreground"
                            : "text-muted hover:bg-sidebar-hover hover:text-foreground"
                        )}
                      >
                        <HugeiconsIcon icon={item.icon} size={18} />
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Version */}
              <div className="mt-auto px-3 pt-4">
                <span className="text-xs text-muted-foreground">ListenOS v{APP_VERSION}</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg p-2 text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} />
              </button>

              {/* Section Content */}
              <SettingsContent section={activeSection} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SettingsContent({ section }: { section: SettingsSection }) {
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [currentShortcut, setCurrentShortcut] = useState("Ctrl+Space");
  const { settings, updateSettings } = useSettings();

  // Local state for system settings
  const [startOnLogin, setStartOnLogin] = useState(settings.startOnLogin ?? false);
  const [showInTray, setShowInTray] = useState(settings.showInTray ?? true);
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState(settings.language ?? "en");
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [vibeConfig, setVibeConfigState] = useState<VibeCodingConfig>(DEFAULT_VIBE_CONFIG);
  const [vibeSaving, setVibeSaving] = useState(false);
  const [vibeLoading, setVibeLoading] = useState(false);
  const [useRemoteApi, setUseRemoteApi] = useState(false);
  const [deepgramApiKey, setDeepgramApiKey] = useState("");
  const [apiSettingsLoading, setApiSettingsLoading] = useState(false);
  const [apiSettingsSaving, setApiSettingsSaving] = useState(false);

  // Load actual autostart state on mount
  useEffect(() => {
    if (isTauri()) {
      getAutostartEnabled()
        .then((enabled) => setStartOnLogin(enabled))
        .catch((err) => console.error("Failed to get autostart status:", err));

      getTriggerHotkey()
        .then((hotkey) => setCurrentShortcut(hotkey))
        .catch((err) => console.error("Failed to get current hotkey:", err));

      getLanguagePreferences()
        .then((prefs) => {
          setSourceLanguage(prefs.source_language);
          setTargetLanguage(prefs.target_language);
        })
        .catch((err) => console.error("Failed to get language preferences:", err));

      setVibeLoading(true);
      getVibeCodingConfig()
        .then((config) => setVibeConfigState(config))
        .catch((err) => {
          console.error("Failed to load vibe coding config:", err);
          setUpdateStatus("Failed to load vibe coding settings");
        })
        .finally(() => setVibeLoading(false));

      setApiSettingsLoading(true);
      getLocalApiSettings()
        .then((localApi) => {
          setUseRemoteApi(localApi.use_remote_api);
          setDeepgramApiKey(localApi.deepgram_api_key ?? "");
        })
        .catch((err) => {
          console.error("Failed to load local API settings:", err);
          setUpdateStatus("Failed to load local API settings");
        })
        .finally(() => setApiSettingsLoading(false));
    }
  }, []);

  // Update local state when settings change
  useEffect(() => {
    setShowInTray(settings.showInTray);
    if (!isTauri()) {
      setTargetLanguage(settings.language);
    }
    if (settings.hotkey) {
      setCurrentShortcut(settings.hotkey);
    }
  }, [settings]);

  const handleCheckUpdates = useCallback(async () => {
    if (!isTauri()) {
      setUpdateStatus("Updates only available in desktop app");
      return;
    }
    
    setIsCheckingUpdates(true);
    setUpdateStatus(null);
    
    try {
      await checkForUpdates(false);
      setUpdateStatus("You're on the latest version!");
    } catch (error) {
      console.error("Update check failed:", error);
      setUpdateStatus("Failed to check for updates");
    } finally {
      setIsCheckingUpdates(false);
    }
  }, []);

  const handleStartOnLoginChange = useCallback(async (checked: boolean) => {
    if (!isTauri()) {
      setStartOnLogin(checked);
      await updateSettings({ startOnLogin: checked });
      return;
    }
    
    setAutostartLoading(true);
    try {
      const newState = await setAutostartEnabled(checked);
      setStartOnLogin(newState);
      await updateSettings({ startOnLogin: newState });
    } catch (err) {
      console.error("Failed to set autostart:", err);
      // Revert UI state on error
      setStartOnLogin(!checked);
    } finally {
      setAutostartLoading(false);
    }
  }, [updateSettings]);

  const handleShowInTrayChange = useCallback(async (checked: boolean) => {
    setShowInTray(checked);
    await updateSettings({ showInTray: checked });
  }, [updateSettings]);

  const handleApiRoutingChange = useCallback(async (checked: boolean) => {
    setUseRemoteApi(checked);
    if (!isTauri()) {
      return;
    }

    setApiSettingsSaving(true);
    try {
      const saved = await setLocalApiSettings(checked, deepgramApiKey);
      setUseRemoteApi(saved.use_remote_api);
      setDeepgramApiKey(saved.deepgram_api_key ?? "");
      setUpdateStatus(saved.use_remote_api
        ? "Cloud routing enabled"
        : "Local routing enabled");
    } catch (err) {
      console.error("Failed to update API routing:", err);
      setUseRemoteApi(!checked);
      setUpdateStatus("Failed to update API routing");
    } finally {
      setApiSettingsSaving(false);
    }
  }, [deepgramApiKey]);

  const handleDeepgramApiKeySave = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    setApiSettingsSaving(true);
    try {
      const saved = await setLocalApiSettings(useRemoteApi, deepgramApiKey);
      setUseRemoteApi(saved.use_remote_api);
      setDeepgramApiKey(saved.deepgram_api_key ?? "");
      setUpdateStatus("Deepgram API key saved locally");
    } catch (err) {
      console.error("Failed to save Deepgram API key:", err);
      setUpdateStatus("Failed to save Deepgram API key");
    } finally {
      setApiSettingsSaving(false);
    }
  }, [deepgramApiKey, useRemoteApi]);

  const handleSourceLanguageChange = useCallback(async (newLanguage: string) => {
    const previousSource = sourceLanguage;
    const previousTarget = targetLanguage;
    setSourceLanguage(newLanguage);

    if (isTauri()) {
      try {
        const updated = await setLanguagePreferences(newLanguage, targetLanguage);
        setSourceLanguage(updated.source_language);
        setTargetLanguage(updated.target_language);
      } catch (err) {
        console.error("Failed to set source language:", err);
        setSourceLanguage(previousSource);
        setTargetLanguage(previousTarget);
        setUpdateStatus("Failed to update source language");
      }
      return;
    }
  }, [sourceLanguage, targetLanguage]);

  const handleTargetLanguageChange = useCallback(async (newLanguage: string) => {
    const previousSource = sourceLanguage;
    const previousTarget = targetLanguage;
    setTargetLanguage(newLanguage);

    if (isTauri()) {
      try {
        const updated = await setLanguagePreferences(sourceLanguage, newLanguage);
        setSourceLanguage(updated.source_language);
        setTargetLanguage(updated.target_language);
        await updateSettings({ language: updated.target_language });
      } catch (err) {
        console.error("Failed to set target language:", err);
        setSourceLanguage(previousSource);
        setTargetLanguage(previousTarget);
        setUpdateStatus("Failed to update target language");
      }
      return;
    }
    try {
      await updateSettings({ language: newLanguage });
    } catch (err) {
      console.error("Failed to sync target language setting:", err);
    }
  }, [sourceLanguage, targetLanguage, updateSettings]);

  const applyVibeConfig = useCallback(async (patch: Partial<VibeCodingConfig>) => {
    const previous = vibeConfig;
    const trigger = (patch.trigger_phrase ?? previous.trigger_phrase).trim().toLowerCase();
    const next: VibeCodingConfig = {
      ...previous,
      ...patch,
      trigger_phrase: trigger.length > 0 ? trigger : "vibe",
    };

    setVibeConfigState(next);

    if (!isTauri()) {
      return;
    }

    setVibeSaving(true);
    try {
      const saved = await setVibeCodingConfig(next);
      setVibeConfigState(saved);
    } catch (err) {
      console.error("Failed to save vibe coding config:", err);
      setVibeConfigState(previous);
      setUpdateStatus("Failed to update vibe coding settings");
    } finally {
      setVibeSaving(false);
    }
  }, [vibeConfig]);

  const applyShortcut = useCallback(async (rawShortcut: string) => {
    if (isTauri()) {
      const normalized = await setTriggerHotkey(rawShortcut);
      setCurrentShortcut(normalized);
      await updateSettings({ hotkey: normalized });
      return;
    }

    setCurrentShortcut(rawShortcut);
    await updateSettings({ hotkey: rawShortcut });
  }, [updateSettings]);

  const handleShortcutRecord = useCallback(() => {
    setIsRecordingShortcut(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keys: string[] = [];
      if (e.ctrlKey) keys.push("Ctrl");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");
      if (e.metaKey) keys.push("Win");
      
      // Add the actual key if it's not a modifier
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        const keyMap: Record<string, string> = {
          " ": "Space",
          ArrowUp: "Up",
          ArrowDown: "Down",
          ArrowLeft: "Left",
          ArrowRight: "Right",
          Escape: "Esc",
          Enter: "Enter",
          Tab: "Tab",
        };
        const normalizedKey = keyMap[e.key] ||
          (e.key.length === 1
            ? e.key.toUpperCase()
            : e.key.charAt(0).toUpperCase() + e.key.slice(1));
        keys.push(normalizedKey);
      }
      
      if (keys.length >= 2) {
        const shortcut = keys.join('+');
        setIsRecordingShortcut(false);
        document.removeEventListener('keydown', handleKeyDown);

        void applyShortcut(shortcut).catch((err) => {
          console.error("Failed to apply shortcut:", err);
          setUpdateStatus("Failed to update shortcut");
        });
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Cancel after 5 seconds
    setTimeout(() => {
      setIsRecordingShortcut(false);
      document.removeEventListener('keydown', handleKeyDown);
    }, 5000);
  }, [applyShortcut]);

  switch (section) {
    case "general":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">General</h2>
          <div className="space-y-6">
            <SettingsRow
              label="Keyboard shortcuts"
              description={isRecordingShortcut ? "Press your shortcut..." : `Hold ${currentShortcut} and speak.`}
              action={
                <button 
                  onClick={handleShortcutRecord}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
                    isRecordingShortcut 
                      ? "border-primary bg-primary/10 text-primary animate-pulse" 
                      : "border-border text-foreground hover:bg-sidebar-hover"
                  )}
                >
                  {isRecordingShortcut ? "Recording..." : "Change"}
                </button>
              }
            />
            <SettingsRow
              label="Microphone"
              description="Auto-detect (Default)"
              action={
                <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover">
                  Change
                </button>
              }
            />
            <SettingsRow
              label="Source language"
              description={getLanguageLabel(sourceLanguage, true)}
              action={
                <select
                  value={sourceLanguage}
                  onChange={(e) => void handleSourceLanguageChange(e.target.value)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover"
                >
                  {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingsRow
              label="Target language"
              description={getLanguageLabel(targetLanguage)}
              action={
                <select
                  value={targetLanguage}
                  onChange={(e) => void handleTargetLanguageChange(e.target.value)}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover"
                >
                  {TARGET_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingsRow
              label="Check for updates"
              description={updateStatus || "Check if a new version is available"}
              action={
                <button 
                  onClick={handleCheckUpdates}
                  disabled={isCheckingUpdates}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover disabled:opacity-50"
                >
                  <HugeiconsIcon 
                    icon={isCheckingUpdates ? Loading03Icon : Download04Icon} 
                    size={16} 
                    className={isCheckingUpdates ? "animate-spin" : ""}
                  />
                  {isCheckingUpdates ? "Checking..." : "Check now"}
                </button>
              }
            />
          </div>
        </div>
      );
    case "system":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">System</h2>
          <div className="space-y-6">
            <SettingsRow
              label="Start on login"
              description="Automatically start ListenOS when you log in"
              action={
                <ToggleSwitch 
                  checked={startOnLogin} 
                  onChange={handleStartOnLoginChange}
                  disabled={autostartLoading}
                />
              }
            />
            <SettingsRow
              label="Show in menu bar"
              description="Display ListenOS icon in the system tray"
              action={
                <ToggleSwitch 
                  checked={showInTray} 
                  onChange={handleShowInTrayChange}
                />
              }
            />
            <SettingsRow
              label="Use ListenOS cloud routing"
              description={
                useRemoteApi
                  ? "Voice intent routes through ListenOS server API."
                  : "Voice intent runs locally via direct Deepgram API."
              }
              action={
                <ToggleSwitch
                  checked={useRemoteApi}
                  onChange={handleApiRoutingChange}
                  disabled={apiSettingsLoading || apiSettingsSaving}
                />
              }
            />
            <SettingsRow
              label="Deepgram API key"
              description={deepgramApiKey.trim().length > 0 ? "Your key is saved on this device." : "Required for fully local mode."}
              action={
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={deepgramApiKey}
                    onChange={(e) => setDeepgramApiKey(e.target.value)}
                    disabled={apiSettingsLoading || apiSettingsSaving}
                    placeholder="dg_..."
                    className="w-56 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={() => void handleDeepgramApiKeySave()}
                    disabled={apiSettingsLoading || apiSettingsSaving}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover disabled:opacity-50"
                  >
                    {apiSettingsSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              }
            />
          </div>
        </div>
      );
    case "vibe-coding":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">Vibe coding</h2>
          <p className="mb-4 text-muted">
            Turn rough spoken coding ideas into clean, structured prompts before they are pasted.
          </p>
          <div className="space-y-6">
            <SettingsRow
              label="Enable vibe coding"
              description="Rewrite voice dictation into stronger AI coding prompts."
              action={
                <ToggleSwitch
                  checked={vibeConfig.enabled}
                  onChange={(checked) => void applyVibeConfig({ enabled: checked })}
                  disabled={vibeSaving || vibeLoading}
                />
              }
            />
            <SettingsRow
              label="Activation mode"
              description={getVibeActivationDescription(vibeConfig.activation_mode)}
              action={
                <select
                  value={vibeConfig.activation_mode}
                  onChange={(e) => void applyVibeConfig({ activation_mode: e.target.value as VibeCodingConfig["activation_mode"] })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover disabled:opacity-50"
                >
                  {VIBE_ACTIVATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingsRow
              label="Trigger phrase"
              description={`Say this first in manual mode. Example: "${vibeConfig.trigger_phrase} build a Tauri command..."`}
              action={
                <input
                  value={vibeConfig.trigger_phrase}
                  onChange={(e) => setVibeConfigState((prev) => ({ ...prev, trigger_phrase: e.target.value }))}
                  onBlur={(e) => void applyVibeConfig({ trigger_phrase: e.target.value })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                  className="w-44 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors disabled:opacity-50"
                  placeholder="vibe"
                />
              }
            />
            <SettingsRow
              label="Target AI tool"
              description="Tune wording for your primary coding assistant."
              action={
                <select
                  value={vibeConfig.target_tool}
                  onChange={(e) => void applyVibeConfig({ target_tool: e.target.value as VibeCodingConfig["target_tool"] })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover disabled:opacity-50"
                >
                  {VIBE_TARGET_TOOL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingsRow
              label="Prompt detail level"
              description="Control how concise or detailed rewritten prompts should be."
              action={
                <select
                  value={vibeConfig.detail_level}
                  onChange={(e) => void applyVibeConfig({ detail_level: e.target.value as VibeCodingConfig["detail_level"] })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-hover disabled:opacity-50"
                >
                  {VIBE_DETAIL_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingsRow
              label="Include constraints"
              description="Ask AI to keep boundaries explicit (stack, scope, limits)."
              action={
                <ToggleSwitch
                  checked={vibeConfig.include_constraints}
                  onChange={(checked) => void applyVibeConfig({ include_constraints: checked })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                />
              }
            />
            <SettingsRow
              label="Include acceptance criteria"
              description="Add clear completion criteria for better first-pass output."
              action={
                <ToggleSwitch
                  checked={vibeConfig.include_acceptance_criteria}
                  onChange={(checked) => void applyVibeConfig({ include_acceptance_criteria: checked })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                />
              }
            />
            <SettingsRow
              label="Include test checklist"
              description="Add test and verification notes to improve reliability."
              action={
                <ToggleSwitch
                  checked={vibeConfig.include_test_notes}
                  onChange={(checked) => void applyVibeConfig({ include_test_notes: checked })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                />
              }
            />
            <SettingsRow
              label="Concise output bias"
              description="Prefer shorter prompts for rapid AI iteration."
              action={
                <ToggleSwitch
                  checked={vibeConfig.concise_output}
                  onChange={(checked) => void applyVibeConfig({ concise_output: checked })}
                  disabled={!vibeConfig.enabled || vibeSaving || vibeLoading}
                />
              }
            />

            <div className="rounded-lg border border-border bg-sidebar-bg p-4">
              <p className="mb-1 text-sm font-medium text-foreground">Live behavior</p>
              <p className="text-sm text-muted">
                Spoken coding requests are rewritten before paste. Commands like opening apps or taking screenshots
                still execute normally and skip vibe rewriting.
              </p>
              {(vibeSaving || vibeLoading) && (
                <p className="mt-2 text-xs text-muted">Syncing settings...</p>
              )}
            </div>
          </div>
        </div>
      );
    case "experimental":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">Experimental</h2>
          <p className="text-muted mb-4">Try out new features before they&apos;re released.</p>
          <div className="rounded-lg border border-border bg-sidebar-bg p-4">
            <p className="text-sm text-muted">No experimental features available at this time.</p>
          </div>
        </div>
      );
    case "account":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">Account</h2>
          <div className="space-y-6">
            <SettingsRow
              label="Mode"
              description="Self-hosted local mode. No sign-in required."
              action={<span className="text-sm text-green-600">Local only</span>}
            />
            <SettingsRow
              label="Profile"
              description="Local user"
              action={<span className="text-sm text-muted">Stored on this device</span>}
            />
          </div>
        </div>
      );
    case "team":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">Team</h2>
          <div className="rounded-lg border border-border bg-sidebar-bg p-4">
            <p className="text-sm text-muted">Team sync is disabled in self-hosted mode.</p>
          </div>
        </div>
      );
    case "billing":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">Plans and Billing</h2>
          <div className="rounded-lg border border-border bg-sidebar-bg p-4">
            <p className="text-sm text-muted">
              ListenOS self-hosted mode has no account billing. Use your own API keys in
              <span className="font-medium text-foreground"> System </span>
              settings.
            </p>
          </div>
        </div>
      );
    case "privacy":
      return (
        <div className="animate-fade-in">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">Data and Privacy</h2>
          <div className="space-y-6">
            <SettingsRow
              label="Voice data"
              description="Voice recordings are processed locally and not stored"
              action={<span className="text-sm text-green-600">Secure</span>}
            />
            <SettingsRow
              label="Command history"
              description="Clear your command history from this device"
              action={
                <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100">
                  Clear history
                </button>
              }
            />
            <SettingsRow
              label="Delete local data"
              description="Clear local ListenOS data on this device"
              action={
                <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100">
                  Clear local data
                </button>
              }
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}

function SettingsRow({
  label,
  description,
  action,
}: {
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ToggleSwitch({ 
  checked, 
  onChange,
  disabled = false,
}: { 
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

