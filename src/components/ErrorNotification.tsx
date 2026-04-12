"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isTauri, getUndismissedErrors, dismissError, dismissAllErrors, type ErrorEntry, type ErrorType } from "@/lib/tauri";

const errorTypeLabels: Record<ErrorType, string> = {
  Transcription: "Voice Recognition",
  LLMProcessing: "AI Processing",
  ActionExecution: "Command Execution",
  AudioCapture: "Microphone",
  Network: "Network",
  RateLimit: "Rate Limit",
  Unknown: "Error",
};

const errorTypeColors: Record<ErrorType, string> = {
  Transcription: "text-warning",
  LLMProcessing: "text-warning",
  ActionExecution: "text-danger",
  AudioCapture: "text-warning",
  Network: "text-danger",
  RateLimit: "text-warning",
  Unknown: "text-danger",
};

export function ErrorNotification() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    const checkErrors = async () => {
      try {
        const undismissed = await getUndismissedErrors();
        setErrors(undismissed);
      } catch (e) {
        console.error("Failed to fetch errors:", e);
      }
    };

    checkErrors();
    const interval = setInterval(checkErrors, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (id: string) => {
    try {
      await dismissError(id);
      setErrors(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      console.error("Failed to dismiss error:", e);
    }
  };

  const handleDismissAll = async () => {
    try {
      await dismissAllErrors();
      setErrors([]);
    } catch (e) {
      console.error("Failed to dismiss all errors:", e);
    }
  };

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <AnimatePresence>
        {!expanded ? (
          <motion.button
            key="collapsed"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 rounded-lg border border-danger-border bg-danger-surface px-4 py-2 text-danger transition-opacity hover:opacity-85"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">{errors.length} error{errors.length > 1 ? 's' : ''}</span>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="overflow-hidden rounded-lg border border-border bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border bg-sidebar-bg px-4 py-2">
              <span className="text-sm font-medium text-foreground">Recent Errors</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDismissAll}
                  className="text-xs text-muted hover:text-foreground transition-colors"
                >
                  Dismiss all
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-sidebar-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${errorTypeColors[error.error_type]}`}>
                        {errorTypeLabels[error.error_type]}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(error.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 truncate">{error.message}</p>
                    {error.details && (
                      <p className="text-xs text-muted mt-0.5 truncate" title={error.details}>
                        {error.details}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDismiss(error.id)}
                    className="text-muted hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
