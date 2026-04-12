"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { TranscriptionProvider } from "@/context/TranscriptionContext";
import { checkForUpdates } from "@/lib/updater";

interface AppShellProps {
  children: React.ReactNode;
}

function AppShellContent({ children }: AppShellProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Check for updates on startup
    checkForUpdates(true);
  }, []);

  return (
    <>
      <Sidebar onSettingsClick={() => setIsSettingsOpen(true)} />
      
      {/* Main Content Area */}
      <main className="ml-60 min-h-screen bg-background px-8 py-7">
        <div className="mx-auto w-full max-w-5xl">
          {children}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
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
