"use client";

import { useEffect, useState } from "react";
import { GreetingCard } from "./GreetingCard";
import { FeatureTip } from "./FeatureTip";
import { ActivityTable } from "./ActivityTable";
import { isTauri, getConversation, getTriggerHotkey } from "@/lib/tauri";
import { useSettings } from "@/context/SettingsContext";

interface DashboardStats {
  totalWords: number;
  todayWords: number;
  streak: number;
}

function calculateStats(messages: Array<{ role: string; content: string; timestamp: string }>): DashboardStats {
  const now = new Date();
  const today = now.toDateString();
  
  let totalWords = 0;
  let todayWords = 0;
  const daysWithActivity = new Set<string>();
  
  // Only count user messages (dictation)
  const userMessages = messages.filter(m => m.role === "User");
  
  for (const msg of userMessages) {
    const wordCount = msg.content.trim().split(/\s+/).filter(w => w.length > 0).length;
    totalWords += wordCount;
    
    const msgDate = new Date(msg.timestamp);
    const msgDateStr = msgDate.toDateString();
    daysWithActivity.add(msgDateStr);
    
    if (msgDateStr === today) {
      todayWords += wordCount;
    }
  }
  
  // Calculate streak (consecutive days including today)
  let streak = 0;
  const checkDate = new Date(now);
  
  while (true) {
    if (daysWithActivity.has(checkDate.toDateString())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return { totalWords, todayWords, streak };
}

export function DashboardContent() {
  const { settings, updateSettings } = useSettings();
  const [stats, setStats] = useState<DashboardStats>({ totalWords: 0, todayWords: 0, streak: 0 });
  const displayHotkey = settings.hotkey || "Ctrl+Space";
  
  useEffect(() => {
    if (!isTauri()) return;
    
    const loadStats = async () => {
      try {
        const messages = await getConversation();
        setStats(calculateStats(messages));
      } catch (err) {
        console.error("Failed to load stats:", err);
      }
    };
    
    loadStats();
    // Refresh stats every 5 seconds
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    getTriggerHotkey()
      .then((hotkey) => {
        if (hotkey && hotkey !== settings.hotkey) {
          void updateSettings({ hotkey });
        }
      })
      .catch((err) => console.error("Failed to get current hotkey:", err));
  }, [settings.hotkey, updateSettings]);
  
  return (
    <div className="space-y-8 pb-8">
      <GreetingCard
        streak={stats.streak}
        totalWords={stats.totalWords}
        todayWords={stats.todayWords}
      />

      <FeatureTip
        title={`Hold ${displayHotkey} to dictate in any app`}
        description="Smart Formatting and Backtrack keep punctuation, spacing, lists, and rewritten phrases clean while you keep talking."
      />

      <section className="animate-slide-in space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Recent Activity</h2>
            <p className="mt-1 text-sm text-muted">Click any row to copy dictation instantly.</p>
          </div>
        </div>
        <ActivityTable />
      </section>
    </div>
  );
}

