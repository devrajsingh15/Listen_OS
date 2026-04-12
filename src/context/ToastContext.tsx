"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "info" | "success" | "error" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  showError: (error: unknown) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Map technical errors to user-friendly messages
function getUserFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  
  // API/Network errors
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Unable to connect. Please check your internet connection.";
  }
  if (message.includes("API key") || message.includes("401") || message.includes("Unauthorized")) {
    return "Authentication failed. Please check your API settings.";
  }
  if (message.includes("429") || message.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (message.includes("500") || message.includes("Internal Server Error")) {
    return "Server error. Please try again later.";
  }
  
  // Audio errors
  if (message.includes("audio") || message.includes("microphone")) {
    return "Microphone error. Please check your audio device settings.";
  }
  if (message.includes("Recording too short")) {
    return "Recording was too short. Please hold the button longer.";
  }
  if (message.includes("Not listening")) {
    return "Not currently recording. Press and hold to start.";
  }
  
  // Transcription errors
  if (message.includes("Transcription failed")) {
    return "Could not transcribe audio. Please speak clearly and try again.";
  }
  if (message.includes("No speech detected")) {
    return "No speech detected. Please try again.";
  }
  
  // Generic cleanup
  if (message.length > 100) {
    return "An unexpected error occurred. Please try again.";
  }
  
  return message;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showError = useCallback((error: unknown) => {
    const friendlyMessage = getUserFriendlyError(error);
    showToast(friendlyMessage, "error");
    console.error("Error:", error); // Keep original error in console for debugging
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast(message, "success");
  }, [showToast]);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return "border border-success-border bg-success-surface text-success-text";
      case "error":
        return "border border-danger-border bg-danger-surface text-danger";
      case "warning":
        return "border border-warning-border bg-warning-surface text-warning";
      default:
        return "bg-card text-foreground border border-border";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`rounded-lg px-4 py-3 shadow-lg ${getToastStyles(toast.type)}`}
            >
              <p className="text-sm font-medium">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
