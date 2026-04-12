"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";

type TabType = "personal" | "work" | "email" | "other";
type ToneType = "formal" | "casual" | "very-casual";

interface ToneOption {
  id: ToneType;
  label: string;
  description: string;
  example: string;
}

const toneOptions: ToneOption[] = [
  {
    id: "formal",
    label: "Formal.",
    description: "Caps + Punctuation",
    example: "Hey, are you free for lunch tomorrow? Let's do 12 if that works for you.",
  },
  {
    id: "casual",
    label: "Casual.",
    description: "Caps + Less punctuation",
    example: "Hey are you free for lunch tomorrow? Let's do 12 if that works for you",
  },
  {
    id: "very-casual",
    label: "very casual",
    description: "No Caps + Less punctuation",
    example: "hey are you free for lunch tomorrow? let's do 12 if that works for you",
  },
];

const messengerIcons = [
  { name: "Messages", color: "#34C759" },
  { name: "Messenger", color: "#0084FF" },
  { name: "WhatsApp", color: "#25D366" },
  { name: "Telegram", color: "#0088CC" },
];

export default function TonePage() {
  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [selectedTone, setSelectedTone] = useState<ToneType>("formal");

  const tabs: { id: TabType; label: string }[] = [
    { id: "personal", label: "Personal messages" },
    { id: "work", label: "Work messages" },
    { id: "email", label: "Email" },
    { id: "other", label: "Other" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <h1 className="text-2xl font-semibold text-foreground">Style</h1>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-border">
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

        {/* Messenger Info */}
        <div className="flex items-center gap-4 rounded-xl bg-card-feature p-4">
          <div className="flex -space-x-1">
            {messengerIcons.map((icon) => (
              <div
                key={icon.name}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: icon.color }}
              >
                <span className="text-xs text-white">{icon.name[0]}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              This style applies in personal messengers
            </p>
            <p className="text-sm text-muted">
              Available on desktop in English. iOS and more languages coming soon
            </p>
          </div>
        </div>

        {/* Tone Options */}
        <div className="grid grid-cols-3 gap-4">
          {toneOptions.map((tone) => (
            <button
              key={tone.id}
              onClick={() => setSelectedTone(tone.id)}
              className={cn(
                "relative rounded-xl border-2 p-5 text-left transition-all",
                selectedTone === tone.id
                  ? "border-primary bg-card shadow-sm"
                  : "border-border bg-card hover:border-muted"
              )}
            >
              <h3
                className={cn(
                  "mb-1 text-2xl font-semibold",
                  tone.id === "very-casual" ? "lowercase" : ""
                )}
              >
                {tone.label}
              </h3>
              <p className="mb-4 text-sm text-muted">{tone.description}</p>
              <div className="rounded-lg bg-sidebar-bg p-3">
                <p className="text-sm text-muted">{tone.example}</p>
              </div>
              
              {/* Avatar indicator */}
              <div
                className={cn(
                  "absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                  selectedTone === tone.id
                    ? "bg-primary text-background"
                    : "bg-surface-elevated text-muted"
                )}
              >
                J
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

