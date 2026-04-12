"use client";

import { getGreeting } from "@/lib/utils";
import { StatsBar } from "./StatsBar";

interface GreetingCardProps {
  streak?: number;
  totalWords?: number;
  todayWords?: number;
}

export function GreetingCard({
  streak = 0,
  totalWords = 0,
  todayWords = 0,
}: GreetingCardProps) {
  const greeting = getGreeting();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="animate-fade-in border-b border-border pb-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{greeting}</h1>
          <p className="mt-2 text-sm text-muted">{today} · Your voice workspace is ready.</p>
        </div>
        <StatsBar streak={streak} totalWords={totalWords} todayWords={todayWords} />
      </div>
    </section>
  );
}

