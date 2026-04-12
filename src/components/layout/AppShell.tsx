"use client";

import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { TranscriptionProvider } from "@/context/TranscriptionContext";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { checkForUpdates } from "@/lib/updater";

interface AppShellProps {
  children: React.ReactNode;
}

const ONBOARDING_COMPLETE_KEY = "listenos_onboarding_complete";

// Check onboarding status synchronously to avoid flash
function getInitialOnboardingState(): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(ONBOARDING_COMPLETE_KEY);
}

function AppShellContent({ children }: AppShellProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(getInitialOnboardingState);

  useEffect(() => {
    // Check for updates on startup
    checkForUpdates(true);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    setShowOnboarding(false);
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

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
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
