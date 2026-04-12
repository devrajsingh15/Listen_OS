"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import {
  Book,
  ChatRound,
  ClipboardText,
  Command,
  Gift,
  HomeSmile,
  PlugCircle,
  QuestionCircle,
  Scissors,
  Settings,
  Text,
  UsersGroupRounded,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";

type SidebarIcon = ComponentType<IconProps>;

interface NavItem {
  label: string;
  href: string;
  icon: SidebarIcon;
  isNew?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/", icon: HomeSmile }],
  },
  {
    title: "AI Assistant",
    items: [
      { label: "Conversation", href: "/conversation", icon: ChatRound, isNew: true },
      { label: "Commands", href: "/commands", icon: Command, isNew: true },
      { label: "Clipboard", href: "/clipboard", icon: ClipboardText, isNew: true },
      { label: "Integrations", href: "/integrations", icon: PlugCircle, isNew: true },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Dictionary", href: "/dictionary", icon: Book },
      { label: "Snippets", href: "/snippets", icon: Scissors },
      { label: "Tone", href: "/tone", icon: Text },
    ],
  },
];

interface SidebarProps {
  onSettingsClick: () => void;
}

const navItemBaseClass =
  "ui-hover-surface flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors";

export function Sidebar({ onSettingsClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    if (isTauri()) {
      window.location.assign(href);
      return;
    }

    router.push(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-sidebar-bg">
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-3">
          <Image src="/Logo.svg" alt="ListenOS Logo" width={30} height={30} className="h-7 w-7" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">ListenOS</p>
            <p className="text-xs text-muted">Local workspace</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={sectionIndex > 0 ? "mt-5" : ""}>
            {section.title && (
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {section.title}
              </h3>
            )}

            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <button
                      onClick={() => handleNavigation(item.href)}
                      className={cn(
                        navItemBaseClass,
                        isActive
                          ? "bg-sidebar-active text-primary"
                          : "text-muted hover:text-primary"
                      )}
                    >
                      <Icon size={18} weight="Bold" className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.isNew && (
                        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                          New
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <ul className="space-y-1">
          <li>
            <button className={cn(navItemBaseClass, "text-muted hover:text-primary")}>
              <UsersGroupRounded size={18} weight="Bold" className="shrink-0" />
              <span>Invite your team</span>
            </button>
          </li>
          <li>
            <button className={cn(navItemBaseClass, "text-muted hover:text-primary")}>
              <Gift size={18} weight="Bold" className="shrink-0" />
              <span>Get a free month</span>
            </button>
          </li>
          <li>
            <button onClick={onSettingsClick} className={cn(navItemBaseClass, "text-muted hover:text-primary")}>
              <Settings size={18} weight="Bold" className="shrink-0" />
              <span>Settings</span>
            </button>
          </li>
          <li>
            <button className={cn(navItemBaseClass, "text-muted hover:text-primary")}>
              <QuestionCircle size={18} weight="Bold" className="shrink-0" />
              <span>Help</span>
            </button>
          </li>
        </ul>
      </div>

      <div className="border-t border-border px-3 py-3">
        <UserAccountSection />
      </div>
    </aside>
  );
}

function UserAccountSection() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-primary">
        L
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">Local user</p>
        <p className="truncate text-xs text-muted">Self-hosted</p>
      </div>
      <span className="rounded-full border border-border bg-success-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-success-text">
        Local
      </span>
    </div>
  );
}
