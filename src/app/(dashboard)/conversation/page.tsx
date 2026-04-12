"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  isTauri,
  getConversation,
  clearConversation,
  newConversationSession,
  type ConversationMessage,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";

export default function ConversationPage() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess } = useToast();

  useEffect(() => {
    if (isTauri()) {
      loadConversation();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadConversation = async () => {
    setIsLoading(true);
    try {
      const msgs = await getConversation();
      setMessages(msgs);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearConversation();
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear conversation:", error);
    }
  };

  const handleNewSession = async () => {
    try {
      await newConversationSession();
      setMessages([]);
    } catch (error) {
      console.error("Failed to create new session:", error);
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccess("Copied to clipboard");
    } catch {
      console.error("Failed to copy");
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) return "TODAY";
      if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
    } catch {
      return "";
    }
  };

  // Filter to only user messages (what was actually said) and group by date
  const userMessages = messages.filter(m => m.role === "User");
  const groupedMessages = userMessages.reduce((groups, msg) => {
    const dateKey = formatDate(msg.timestamp);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {} as Record<string, ConversationMessage[]>);


  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Conversation History</h1>
            <p className="text-sm text-muted">
              View your conversation with ListenOS including all commands and responses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewSession}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary/90"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Session
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-sidebar-hover"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
          </div>
        </div>

        {/* Messages List - Clean Flow-style */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : userMessages.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="mb-1 font-medium text-foreground">No conversation history</h3>
            <p className="text-sm text-muted">
              Start speaking with ListenOS to see your conversation here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMessages).map(([dateKey, msgs]) => (
              <div key={dateKey}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  {dateKey}
                </h3>
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  {msgs.map((msg, idx) => (
                    <div
                      key={msg.id}
                      onClick={() => handleCopy(msg.content)}
                      className={cn(
                        "flex gap-6 px-5 py-3 cursor-pointer transition-colors hover:bg-sidebar-hover",
                        idx !== msgs.length - 1 && "border-b border-border"
                      )}
                      title="Click to copy"
                    >
                      <span className="w-20 shrink-0 text-sm text-muted">
                        {formatTime(msg.timestamp)}
                      </span>
                      <p className="text-sm text-foreground">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
