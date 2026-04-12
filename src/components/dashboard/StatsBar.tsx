"use client";

import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import { Calendar, Fire, Rocket } from "@solar-icons/react";

interface StatsBarProps {
  streak: number;
  totalWords: number;
  todayWords: number;
}

interface StatItem {
  label: string;
  value: string;
  icon: ComponentType<IconProps>;
}

export function StatsBar({ streak, totalWords, todayWords }: StatsBarProps) {
  const statItems: StatItem[] = [
    {
      label: "Current streak",
      value: `${streak} day${streak !== 1 ? "s" : ""}`,
      icon: Fire,
    },
    {
      label: "Total words",
      value: totalWords.toLocaleString(),
      icon: Rocket,
    },
    {
      label: "Words today",
      value: todayWords.toLocaleString(),
      icon: Calendar,
    },
  ];

  return (
    <div className="w-full overflow-x-auto sm:w-auto">
      <div className="ui-surface-panel min-w-[430px] rounded-2xl">
        <dl className="ui-divider-x grid grid-cols-3">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="px-4 py-3">
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  <Icon size={15} weight="Bold" className="shrink-0" />
                  {item.label}
                </dt>
                <dd className="mt-2 text-lg font-semibold text-foreground">{item.value}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
