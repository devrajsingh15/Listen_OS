"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  isTauri,
  getSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  type Snippet,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { Add01Icon, Search01Icon, Cancel01Icon, ArrowRight01Icon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type TabType = "all" | "personal" | "shared";

const exampleSnippets = [
  { trigger: "Linkedin", expansion: "https://www.linkedin.com/in/john-doe-9b0139134/" },
  { trigger: "intro email", expansion: "Hey, would love to find some time to chat later..." },
  { trigger: "my calendly link", expansion: "calendly.com/you/invite-name" },
];

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [showTip, setShowTip] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [trigger, setTrigger] = useState("");
  const [expansion, setExpansion] = useState("");

  useEffect(() => {
    if (isTauri()) {
      loadSnippets();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadSnippets = async () => {
    setIsLoading(true);
    try {
      const data = await getSnippets();
      setSnippets(data);
    } catch (error) {
      console.error("Failed to load snippets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSnippet = async () => {
    if (!trigger.trim() || !expansion.trim()) return;
    
    try {
      const snippet = await createSnippet(trigger.trim(), expansion.trim());
      setSnippets([snippet, ...snippets]);
      setShowEditor(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create snippet:", error);
    }
  };

  const handleUpdateSnippet = async () => {
    if (!editingSnippet || !trigger.trim() || !expansion.trim()) return;
    
    try {
      await updateSnippet(editingSnippet.id, trigger.trim(), expansion.trim());
      setSnippets(snippets.map(s => 
        s.id === editingSnippet.id 
          ? { ...s, trigger: trigger.trim(), expansion: expansion.trim() } 
          : s
      ));
      setShowEditor(false);
      setEditingSnippet(null);
      resetForm();
    } catch (error) {
      console.error("Failed to update snippet:", error);
    }
  };

  const handleDeleteSnippet = async (id: string) => {
    if (!confirm("Are you sure you want to delete this snippet?")) return;
    
    try {
      await deleteSnippet(id);
      setSnippets(snippets.filter(s => s.id !== id));
    } catch (error) {
      console.error("Failed to delete snippet:", error);
    }
  };

  const resetForm = () => {
    setTrigger("");
    setExpansion("");
  };

  const openEditor = (snippet?: Snippet) => {
    if (snippet) {
      setEditingSnippet(snippet);
      setTrigger(snippet.trigger);
      setExpansion(snippet.expansion);
    } else {
      setEditingSnippet(null);
      resetForm();
    }
    setShowEditor(true);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "personal", label: "Personal" },
    { id: "shared", label: "Shared with team" },
  ];

  const filteredSnippets = snippets.filter(s => {
    const matchesTab = activeTab === "all" || s.category === activeTab;
    const matchesSearch = !searchQuery || 
      s.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.expansion.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Snippets</h1>
          <button 
            onClick={() => openEditor()}
            className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
            Add new
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "border-b-2 pb-3 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-3">
            <div className="relative">
              <HugeiconsIcon 
                icon={Search01Icon} 
                size={16} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" 
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 rounded-lg border border-border bg-card py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Feature Tip */}
        {showTip && snippets.length === 0 && (
          <div className="relative rounded-xl bg-card-feature p-6">
            <button
              onClick={() => setShowTip(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </button>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              The stuff you shouldn&apos;t have to re-type.
            </h2>
            <p className="mb-4 text-sm text-muted">
              Save shortcuts to speak the things you type all the time—emails, links, addresses,
              bios—anything.{" "}
              <span className="font-medium text-foreground">
                Just speak and ListenOS expands them instantly
              </span>
              , without retyping or hunting through old messages.
            </p>
            <div className="mb-4 space-y-2">
              {exampleSnippets.map((snippet) => (
                <div key={snippet.trigger} className="flex items-center gap-3">
                  <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground">
                    {snippet.trigger}
                  </span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="text-muted" />
                  <span className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-foreground">
                    {snippet.expansion}
                  </span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => openEditor()}
              className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Add new snippet
            </button>
          </div>
        )}

        {/* Snippet List */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted">
              {searchQuery ? "No snippets match your search" : "No snippets yet. Create your first snippet!"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {filteredSnippets.map((snippet, index) => (
              <div
                key={snippet.id}
                className={cn(
                  "group flex items-center gap-3 px-6 py-4 transition-colors hover:bg-sidebar-hover",
                  index !== filteredSnippets.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-sm font-medium text-foreground">{snippet.trigger}</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="text-muted" />
                <span className="flex-1 truncate text-sm text-muted">{snippet.expansion}</span>
                <span className="text-xs text-muted">
                  {snippet.use_count > 0 && `Used ${snippet.use_count}x`}
                </span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEditor(snippet)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
                    title="Edit"
                  >
                    <HugeiconsIcon icon={Edit02Icon} size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteSnippet(snippet.id)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-surface hover:text-danger"
                    title="Delete"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {editingSnippet ? "Edit Snippet" : "New Snippet"}
                </h2>
                <button 
                  onClick={() => {
                    setShowEditor(false);
                    setEditingSnippet(null);
                    resetForm();
                  }}
                  className="text-muted hover:text-foreground"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Trigger phrase
                  </label>
                  <input
                    type="text"
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value)}
                    placeholder="e.g., my email"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">
                    Say this phrase to trigger the snippet
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Expansion
                  </label>
                  <textarea
                    value={expansion}
                    onChange={(e) => setExpansion(e.target.value)}
                    placeholder="e.g., example@email.com"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">
                    This text will be typed when you say the trigger
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditor(false);
                    setEditingSnippet(null);
                    resetForm();
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-sidebar-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={editingSnippet ? handleUpdateSnippet : handleCreateSnippet}
                  disabled={!trigger.trim() || !expansion.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingSnippet ? "Save Changes" : "Create Snippet"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
