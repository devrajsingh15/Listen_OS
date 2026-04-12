"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import * as Select from "@/components/ui/select";
import {
  isTauri,
  getCustomCommands,
  getCommandTemplates,
  saveCustomCommand,
  deleteCustomCommand,
  setCustomCommandEnabled,
  exportCustomCommands,
  importCustomCommands,
  type CustomCommand,
  type ActionStep,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

const ACTION_TYPES = [
  { id: "open_app", name: "Open App", icon: "🖥️" },
  { id: "open_url", name: "Open URL", icon: "🌐" },
  { id: "web_search", name: "Web Search", icon: "🔍" },
  { id: "type_text", name: "Type Text", icon: "⌨️" },
  { id: "volume_control", name: "Volume Control", icon: "🔊" },
  { id: "spotify_control", name: "Spotify Control", icon: "🎵" },
  { id: "discord_control", name: "Discord Control", icon: "💬" },
  { id: "system_control", name: "System Control", icon: "⚙️" },
];

export default function CommandsPage() {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [templates, setTemplates] = useState<CustomCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"commands" | "templates">("commands");
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cmds, tmpls] = await Promise.all([
        getCustomCommands(),
        getCommandTemplates(),
      ]);
      setCommands(cmds);
      setTemplates(tmpls);
    } catch (error) {
      console.error("Failed to load commands:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await setCustomCommandEnabled(id, enabled);
      setCommands(commands.map(c => c.id === id ? { ...c, enabled } : c));
    } catch (error) {
      console.error("Failed to toggle command:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this command?")) return;
    try {
      await deleteCustomCommand(id);
      setCommands(commands.filter(c => c.id !== id));
    } catch (error) {
      console.error("Failed to delete command:", error);
    }
  };

  const handleSave = async (command: CustomCommand) => {
    try {
      await saveCustomCommand(command);
      if (commands.find(c => c.id === command.id)) {
        setCommands(commands.map(c => c.id === command.id ? command : c));
      } else {
        setCommands([...commands, command]);
      }
      setShowEditor(false);
      setEditingCommand(null);
    } catch (error) {
      console.error("Failed to save command:", error);
    }
  };

  const handleUseTemplate = (template: CustomCommand) => {
    const newCommand: CustomCommand = {
      ...template,
      id: crypto.randomUUID(),
      enabled: true,
      created_at: new Date().toISOString(),
      last_used: null,
      use_count: 0,
    };
    setEditingCommand(newCommand);
    setShowEditor(true);
  };

  const handleExport = async () => {
    try {
      const json = await exportCustomCommands();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "listenos-commands.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const count = await importCustomCommands(text);
        alert(`Imported ${count} commands`);
        loadData();
      } catch (error) {
        console.error("Failed to import:", error);
        alert("Failed to import commands");
      }
    };
    input.click();
  };

  const createNewCommand = () => {
    setEditingCommand({
      id: crypto.randomUUID(),
      name: "",
      trigger_phrase: "",
      description: "",
      actions: [],
      enabled: true,
      created_at: new Date().toISOString(),
      last_used: null,
      use_count: 0,
    });
    setShowEditor(true);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Custom Commands</h1>
            <p className="text-sm text-muted">
              Create voice-triggered command sequences for common tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-sidebar-hover"
            >
              Import
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-sidebar-hover"
            >
              Export
            </button>
            <button
              onClick={createNewCommand}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Command
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab("commands")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "commands"
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            )}
          >
            My Commands ({commands.length})
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "templates"
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            )}
          >
            Templates ({templates.length})
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : activeTab === "commands" ? (
          commands.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="mb-1 font-medium text-foreground">No custom commands yet</h3>
              <p className="mb-4 text-sm text-muted">
                Create your own voice-triggered commands or use a template
              </p>
              <button
                onClick={() => setActiveTab("templates")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Browse Templates
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">{cmd.name}</h3>
                      <p className="text-sm text-primary">&quot;{cmd.trigger_phrase}&quot;</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={cmd.enabled}
                        onChange={(e) => handleToggleEnabled(cmd.id, e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-focus:outline-none"></div>
                    </label>
                  </div>
                  <p className="mb-3 text-sm text-muted line-clamp-2">{cmd.description}</p>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {cmd.actions.slice(0, 3).map((action, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-sidebar-bg px-2 py-0.5 text-xs text-muted"
                      >
                        {action.action_type}
                      </span>
                    ))}
                    {cmd.actions.length > 3 && (
                      <span className="rounded-full bg-sidebar-bg px-2 py-0.5 text-xs text-muted">
                        +{cmd.actions.length - 3} more
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Used {cmd.use_count} times</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingCommand(cmd);
                          setShowEditor(true);
                        }}
                        className="hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cmd.id)}
                        className="hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="mb-3">
                  <h3 className="font-medium text-foreground">{template.name}</h3>
                  <p className="text-sm text-primary">&quot;{template.trigger_phrase}&quot;</p>
                </div>
                <p className="mb-3 text-sm text-muted">{template.description}</p>
                <div className="mb-3 flex flex-wrap gap-1">
                  {template.actions.map((action, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-sidebar-bg px-2 py-0.5 text-xs text-muted"
                    >
                      {action.description || action.action_type}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="w-full rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white"
                >
                  Use This Template
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Editor Modal */}
        {showEditor && editingCommand && (
          <CommandEditor
            command={editingCommand}
            onSave={handleSave}
            onClose={() => {
              setShowEditor(false);
              setEditingCommand(null);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

interface CommandEditorProps {
  command: CustomCommand;
  onSave: (command: CustomCommand) => void;
  onClose: () => void;
}

function CommandEditor({ command, onSave, onClose }: CommandEditorProps) {
  const [name, setName] = useState(command.name);
  const [triggerPhrase, setTriggerPhrase] = useState(command.trigger_phrase);
  const [description, setDescription] = useState(command.description);
  const [actions, setActions] = useState<ActionStep[]>(command.actions);

  const addAction = (actionType: string) => {
    const newAction: ActionStep = {
      id: crypto.randomUUID(),
      action_type: actionType,
      payload: {},
      delay_ms: actions.length > 0 ? 500 : 0,
      description: null,
    };
    setActions([...actions, newAction]);
  };

  const removeAction = (id: string) => {
    setActions(actions.filter((a) => a.id !== id));
  };

  const updateAction = (id: string, updates: Partial<ActionStep>) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  };

  const handleSave = () => {
    if (!name.trim() || !triggerPhrase.trim()) {
      alert("Name and trigger phrase are required");
      return;
    }
    onSave({
      ...command,
      name,
      trigger_phrase: triggerPhrase.toLowerCase(),
      description,
      actions,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            {command.name ? "Edit Command" : "New Command"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Morning Routine"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Trigger Phrase</label>
            <input
              type="text"
              value={triggerPhrase}
              onChange={(e) => setTriggerPhrase(e.target.value)}
              placeholder="morning routine"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted">Say this phrase to trigger the command</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opens email, calendar, and plays morning news"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Actions</label>
            <div className="space-y-2">
              {actions.map((action, index) => (
                <div
                  key={action.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background p-3"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <Select.Root
                      value={action.action_type}
                      onValueChange={(value) =>
                        updateAction(action.id, { action_type: value })
                      }
                      size="xsmall"
                    >
                      <Select.Trigger className="w-full rounded bg-background">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {ACTION_TYPES.map((type) => (
                          <Select.Item key={type.id} value={type.id}>
                            {`${type.icon} ${type.name}`}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                    <input
                      type="text"
                      value={JSON.stringify(action.payload)}
                      onChange={(e) => {
                        try {
                          updateAction(action.id, { payload: JSON.parse(e.target.value) });
                        } catch {}
                      }}
                      placeholder='{"app": "chrome"}'
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <input
                    type="number"
                    value={action.delay_ms}
                    onChange={(e) => updateAction(action.id, { delay_ms: parseInt(e.target.value) || 0 })}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                    placeholder="Delay"
                  />
                  <span className="text-xs text-muted">ms</span>
                  <button
                    onClick={() => removeAction(action.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {ACTION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => addAction(type.id)}
                  className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
                >
                  {type.icon} Add {type.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-sidebar-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Save Command
          </button>
        </div>
      </div>
    </div>
  );
}
