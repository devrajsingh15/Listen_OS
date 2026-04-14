"use client";

import { usePathname } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { TranscriptionProvider } from "@/context/TranscriptionContext";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { checkForUpdates } from "@/lib/updater";
import { isTauri } from "@/lib/tauri";

interface AppShellProps {
  children: React.ReactNode;
}

const ONBOARDING_COMPLETE_KEY = "listenos_onboarding_complete";
const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/conversation": "Conversation",
  "/commands": "Custom Commands",
  "/clipboard": "Clipboard",
  "/integrations": "Integrations",
  "/dictionary": "Dictionary",
  "/snippets": "Snippets",
  "/tone": "Style",
};

function AppShellContent({ children }: AppShellProps) {
  const [mounted, setMounted] = useState(false);
  const [tauriDesktop, setTauriDesktop] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? "Workspace";

  useEffect(() => {
    setMounted(true);
    setTauriDesktop(isTauri());
    setShowOnboarding(!localStorage.getItem(ONBOARDING_COMPLETE_KEY));
  }, []);

  useEffect(() => {
    // Check for updates on startup
    checkForUpdates(true);
  }, []);

  useEffect(() => {
    if (!tauriDesktop) {
      setIsWindowMaximized(false);
    }
  }, [tauriDesktop]);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setShowOnboarding(false);
  }, []);

  const handleWindowMinimize = useCallback(() => {
    if (!tauriDesktop) return;
    void getCurrentWindow().minimize().catch((err) => {
      console.error("Failed to minimize window:", err);
    });
  }, [tauriDesktop]);

  const handleWindowToggleMaximize = useCallback(() => {
    if (!tauriDesktop) return;

    const appWindow = getCurrentWindow();
    if (isWindowMaximized) {
      void appWindow.unmaximize().catch((err) => {
        console.error("Failed to restore window:", err);
      });
    } else {
      void appWindow.maximize().catch((err) => {
        console.error("Failed to maximize window:", err);
      });
    }
    setIsWindowMaximized((prev) => !prev);
  }, [isWindowMaximized, tauriDesktop]);

  const handleTitleBarMouseDown = useCallback(() => {
    if (!tauriDesktop) return;
    void getCurrentWindow().startDragging().catch((err) => {
      console.error("Failed to start window drag:", err);
    });
  }, [tauriDesktop]);

  const handleWindowClose = useCallback(() => {
    if (!tauriDesktop) return;
    void getCurrentWindow().close().catch((err) => {
      console.error("Failed to close window:", err);
    });
  }, [tauriDesktop]);

  return (
    <>
      <Sidebar onSettingsClick={() => setIsSettingsOpen(true)} />
      
      {/* Main Content Area */}
      <main className="ml-60 min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-12 items-stretch">
            <div
              data-tauri-drag-region
              onMouseDown={handleTitleBarMouseDown}
              onDoubleClick={handleWindowToggleMaximize}
              className="flex min-w-0 flex-1 items-center"
            >
              <div className="flex w-full items-center px-8">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{pageTitle}</p>
                </div>
              </div>
            </div>

            {tauriDesktop && (
              <div className="flex shrink-0 border-l border-border">
                <button
                  onClick={handleWindowMinimize}
                  aria-label="Minimize window"
                  className="grid h-12 w-12 place-items-center text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h12" />
                  </svg>
                </button>

                <button
                  onClick={handleWindowToggleMaximize}
                  aria-label={isWindowMaximized ? "Restore window" : "Maximize window"}
                  className="grid h-12 w-12 place-items-center text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
                >
                  {isWindowMaximized ? (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="8" y="8" width="10" height="10" rx="1" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16V6h10" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" strokeWidth={2} />
                    </svg>
                  )}
                </button>

                <button
                  onClick={handleWindowClose}
                  aria-label="Close window"
                  className="grid h-12 w-12 place-items-center text-muted transition-colors hover:bg-danger-surface hover:text-danger"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="px-8 py-7">
          <div className="mx-auto w-full max-w-5xl">
            {children}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Onboarding Modal */}
      <OnboardingModal isOpen={mounted && showOnboarding} onComplete={handleOnboardingComplete} />
    </>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <TranscriptionProvider>
      <AppShellContent>{children}</AppShellContent>
    </TranscriptionProvider>
  );
}
