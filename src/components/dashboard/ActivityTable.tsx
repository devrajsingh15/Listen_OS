"use client";

import { useEffect, useState } from "react";
import { isTauri, getConversation, type ConversationMessage } from "@/lib/tauri";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

export function ActivityTable() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess } = useToast();

  useEffect(() => {
    if (isTauri()) {
      loadMessages();
      const interval = setInterval(loadMessages, 2000);
      return () => clearInterval(interval);
    }

    setIsLoading(false);
  }, []);

  const loadMessages = async () => {
    try {
      const msgs = await getConversation();
      setMessages(msgs.filter((message) => message.role === "User"));
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoading(false);
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
      return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

      if (date.toDateString() === today.toDateString()) {
        return "Today";
      }

      if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      }

      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const groupedMessages = messages.reduce((groups, msg) => {
    const dateKey = formatDate(msg.timestamp);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {} as Record<string, ConversationMessage[]>);

  if (isLoading) {
    return (
      <div className="animate-fade-in ui-surface-panel rounded-2xl p-10 text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-3 text-sm text-muted">Loading activity</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="animate-fade-in ui-surface-panel rounded-2xl p-10 text-center">
        <p className="text-sm text-muted">No activity yet. Start dictating to populate this feed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(groupedMessages).map(([dateKey, groupMessages]) => (
        <section key={dateKey} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{dateKey}</h3>
          <div className="animate-fade-in ui-surface-panel overflow-hidden rounded-2xl">
            {groupMessages.map((message, index) => (
              <button
                key={message.id}
                onClick={() => handleCopy(message.content)}
                className={cn(
                  "ui-hover-surface flex w-full items-start gap-5 px-5 py-3 text-left",
                  index !== groupMessages.length - 1 && "border-b border-border"
                )}
                title="Click to copy"
              >
                <span className="mt-0.5 w-16 shrink-0 text-xs font-medium uppercase tracking-[0.1em] text-muted">
                  {formatTime(message.timestamp)}
                </span>
                <p className="text-sm leading-relaxed text-foreground">{message.content}</p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
