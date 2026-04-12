"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import {
  Home03Icon,
  Book02Icon,
  Scissor01Icon,
  TextFontIcon,
  NoteIcon,
  UserGroupIcon,
  GiftIcon,
  Settings02Icon,
  HelpCircleIcon,
  Message01Icon,
  CommandIcon,
  Copy01Icon,
  PlugIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home03Icon;
  isNew?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: Home03Icon },
    ],
  },
  {
    title: "AI Assistant",
    items: [
      { label: "Conversation", href: "/conversation", icon: Message01Icon, isNew: true },
      { label: "Commands", href: "/commands", icon: CommandIcon, isNew: true },
      { label: "Clipboard", href: "/clipboard", icon: Copy01Icon, isNew: true },
      { label: "Integrations", href: "/integrations", icon: PlugIcon, isNew: true },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "Dictionary", href: "/dictionary", icon: Book02Icon },
      { label: "Snippets", href: "/snippets", icon: Scissor01Icon },
      { label: "Tone", href: "/tone", icon: TextFontIcon },
      { label: "Notes", href: "/notes", icon: NoteIcon },
    ],
  },
];

interface SidebarProps {
  onSettingsClick: () => void;
}

export function Sidebar({ onSettingsClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    if (isTauri()) {
      // In Tauri, use window.location for reliable navigation
      window.location.assign(href);
    } else {
      router.push(href);
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-sidebar-bg">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <Image
          src="/logo.svg"
          alt="ListenOS Logo"
          width={28}
          height={28}
          className="w-7 h-7"
        />
        <span className="text-lg font-semibold text-foreground">ListenOS</span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={sectionIndex > 0 ? "mt-4" : ""}>
            {section.title && (
              <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <button
                      onClick={() => handleNavigation(item.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left cursor-pointer",
                        isActive
                          ? "bg-sidebar-active text-foreground"
                          : "text-muted hover:bg-sidebar-hover hover:text-foreground"
                      )}
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        size={18}
                        className={cn(
                          isActive ? "text-foreground" : "text-muted"
                        )}
                      />
                      {item.label}
                      {item.isNew && (
                        <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          NEW
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

      {/* Bottom Actions */}
      <div className="border-t border-border px-3 py-3">
        <ul className="space-y-1">
          <li>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground cursor-pointer">
              <HugeiconsIcon icon={UserGroupIcon} size={18} />
              Invite your team
            </button>
          </li>
          <li>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground cursor-pointer">
              <HugeiconsIcon icon={GiftIcon} size={18} />
              Get a free month
            </button>
          </li>
          <li>
            <button
              onClick={onSettingsClick}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground cursor-pointer"
            >
              <HugeiconsIcon icon={Settings02Icon} size={18} />
              Settings
            </button>
          </li>
          <li>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground cursor-pointer">
              <HugeiconsIcon icon={HelpCircleIcon} size={18} />
              Help
            </button>
          </li>
        </ul>
      </div>

      {/* User Account */}
      <div className="border-t border-border px-3 py-3">
        <UserAccountSection />
      </div>
    </aside>
  );
}

function UserAccountSection() {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
        L
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">Local user</p>
        <p className="text-xs text-muted truncate">Self-hosted</p>
      </div>
      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
        Local
      </span>
    </div>
  );
}

