"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  isTauri,
  getDictionaryWords,
  addDictionaryWord,
  updateDictionaryWord,
  deleteDictionaryWord,
  type DictionaryWord,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { Add01Icon, Search01Icon, Cancel01Icon, SparklesIcon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type TabType = "all" | "personal" | "shared";

export default function DictionaryPage() {
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [showTip, setShowTip] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingWord, setEditingWord] = useState<DictionaryWord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [word, setWord] = useState("");
  const [phonetic, setPhonetic] = useState("");

  useEffect(() => {
    if (isTauri()) {
      loadWords();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadWords = async () => {
    setIsLoading(true);
    try {
      const data = await getDictionaryWords();
      setWords(data);
    } catch (error) {
      console.error("Failed to load dictionary words:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWord = async () => {
    if (!word.trim()) return;
    
    try {
      const newWord = await addDictionaryWord(word.trim(), false);
      setWords([newWord, ...words]);
      setShowEditor(false);
      resetForm();
    } catch (error) {
      console.error("Failed to add word:", error);
    }
  };

  const handleUpdateWord = async () => {
    if (!editingWord || !word.trim()) return;
    
    try {
      await updateDictionaryWord(editingWord.id, word.trim(), phonetic.trim() || undefined);
      setWords(words.map(w => 
        w.id === editingWord.id 
          ? { ...w, word: word.trim(), phonetic: phonetic.trim() || null } 
          : w
      ));
      setShowEditor(false);
      setEditingWord(null);
      resetForm();
    } catch (error) {
      console.error("Failed to update word:", error);
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this word?")) return;
    
    try {
      await deleteDictionaryWord(id);
      setWords(words.filter(w => w.id !== id));
    } catch (error) {
      console.error("Failed to delete word:", error);
    }
  };

  const resetForm = () => {
    setWord("");
    setPhonetic("");
  };

  const openEditor = (dictWord?: DictionaryWord) => {
    if (dictWord) {
      setEditingWord(dictWord);
      setWord(dictWord.word);
      setPhonetic(dictWord.phonetic || "");
    } else {
      setEditingWord(null);
      resetForm();
    }
    setShowEditor(true);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "personal", label: "Personal" },
    { id: "shared", label: "Shared with team" },
  ];

  const filteredWords = words.filter(w => {
    const matchesTab = activeTab === "all" || w.category === activeTab;
    const matchesSearch = !searchQuery || 
      w.word.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Dictionary</h1>
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
        {showTip && words.length === 0 && (
          <div className="relative rounded-xl bg-card-feature p-6">
            <button
              onClick={() => setShowTip(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </button>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              ListenOS speaks the way you speak.
            </h2>
            <p className="mb-4 text-sm text-muted">
              ListenOS learns your unique words and names — automatically or manually.{" "}
              <span className="font-medium text-foreground">
                Add personal terms, company jargon, client names, or industry-specific lingo
              </span>
              . Share them with your team so everyone stays on the same page.
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Q3 Roadmap", "Whispr → Wispr", "SF MOMA", "Figma Jam", "Company name"].map(
                (example) => (
                  <span
                    key={example}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                  >
                    {example}
                  </span>
                )
              )}
            </div>
            <button 
              onClick={() => openEditor()}
              className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Add new word
            </button>
          </div>
        )}

        {/* Word List */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted">
              {searchQuery ? "No words match your search" : "No custom words yet. Add your first word!"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {filteredWords.map((dictWord, index) => (
              <div
                key={dictWord.id}
                className={cn(
                  "group flex items-center justify-between px-6 py-4 transition-colors hover:bg-sidebar-hover",
                  index !== filteredWords.length - 1 && "border-b border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">{dictWord.word}</span>
                  {dictWord.phonetic && (
                    <span className="text-xs text-muted">/{dictWord.phonetic}/</span>
                  )}
                  {dictWord.is_auto_learned && (
                    <span title="Auto-learned"><HugeiconsIcon icon={SparklesIcon} size={16} className="text-amber-500" /></span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {dictWord.use_count > 0 && (
                    <span className="text-xs text-muted">Used {dictWord.use_count}x</span>
                  )}
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEditor(dictWord)}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
                      title="Edit"
                    >
                      <HugeiconsIcon icon={Edit02Icon} size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteWord(dictWord.id)}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger-surface hover:text-danger"
                      title="Delete"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </button>
                  </div>
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
                  {editingWord ? "Edit Word" : "Add Word"}
                </h2>
                <button 
                  onClick={() => {
                    setShowEditor(false);
                    setEditingWord(null);
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
                    Word or phrase
                  </label>
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder="e.g., Kubernetes"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">
                    The correct spelling you want ListenOS to recognize
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Phonetic (optional)
                  </label>
                  <input
                    type="text"
                    value={phonetic}
                    onChange={(e) => setPhonetic(e.target.value)}
                    placeholder="e.g., koo-ber-nee-tees"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-muted">
                    How the word sounds, to help with recognition
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditor(false);
                    setEditingWord(null);
                    resetForm();
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-sidebar-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={editingWord ? handleUpdateWord : handleAddWord}
                  disabled={!word.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingWord ? "Save Changes" : "Add Word"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
