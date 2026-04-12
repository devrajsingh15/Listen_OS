"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  isTauri,
  getIntegrations,
  setIntegrationEnabled,
  type IntegrationInfo,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);

  useEffect(() => {
    if (isTauri()) {
      loadIntegrations();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadIntegrations = async () => {
    setIsLoading(true);
    try {
      const data = await getIntegrations();
      setIntegrations(data);
    } catch (error) {
      console.error("Failed to load integrations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (name: string, enabled: boolean) => {
    try {
      await setIntegrationEnabled(name, enabled);
      setIntegrations(integrations.map(i => 
        i.name === name ? { ...i, enabled } : i
      ));
    } catch (error) {
      console.error("Failed to toggle integration:", error);
    }
  };

  const getIntegrationIcon = (name: string) => {
    switch (name) {
      case "spotify":
        return (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        );
      case "discord":
        return (
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
          </svg>
        );
      case "system":
        return (
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">App Integrations</h1>
          <p className="text-sm text-muted">
            Control your favorite apps with voice commands
          </p>
        </div>

        {/* Integrations List */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-4 p-4">
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-xl",
                      integration.available
                        ? "bg-primary/10 text-primary"
                        : "bg-surface-elevated text-muted"
                    )}
                  >
                    {getIntegrationIcon(integration.name)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground capitalize">
                        {integration.name}
                      </h3>
                      {!integration.available && (
                        <span className="rounded-full border border-warning-border bg-warning-surface px-2 py-0.5 text-xs text-warning">
                          Not Installed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted">{integration.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setExpandedIntegration(
                        expandedIntegration === integration.name ? null : integration.name
                      )}
                      className="text-sm text-muted hover:text-foreground"
                    >
                      {integration.actions.length} commands
                      <svg
                        className={cn(
                          "ml-1 inline h-4 w-4 transition-transform",
                          expandedIntegration === integration.name && "rotate-180"
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={integration.enabled}
                        onChange={(e) => handleToggle(integration.name, e.target.checked)}
                        disabled={!integration.available}
                        className="peer sr-only"
                      />
                      <div className={cn(
                        "peer h-6 w-11 rounded-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-focus:outline-none",
                        integration.available 
                          ? "bg-border peer-checked:bg-primary" 
                          : "bg-border/70 cursor-not-allowed"
                      )}></div>
                    </label>
                  </div>
                </div>

                {/* Expanded Actions */}
                {expandedIntegration === integration.name && (
                  <div className="border-t border-border bg-background/50 p-4">
                    <h4 className="mb-3 text-sm font-medium text-foreground">Available Voice Commands</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {integration.actions.map((action) => (
                        <div
                          key={action.id}
                          className="rounded-lg border border-border bg-card p-3"
                        >
                          <h5 className="font-medium text-foreground">{action.name}</h5>
                          <p className="mb-2 text-xs text-muted">{action.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {action.example_phrases.slice(0, 2).map((phrase, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                              >
                                &quot;{phrase}&quot;
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tips */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 font-medium text-foreground">Pro Tips</h3>
          <ul className="space-y-1 text-sm text-muted">
            <li>Say &quot;pause spotify&quot; or &quot;skip this song&quot; to control music</li>
            <li>Say &quot;mute discord&quot; or &quot;deafen discord&quot; during calls</li>
            <li>Say &quot;lock my computer&quot; or &quot;take a screenshot&quot; for system control</li>
            <li>Integrations work even when the app is in the background</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
