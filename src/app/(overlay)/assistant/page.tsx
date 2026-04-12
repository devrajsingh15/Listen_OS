"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  isTauri,
  getStatus,
  startListening,
  stopListening,
  getPendingAction,
  confirmPendingAction,
  cancelPendingAction,
  onAssistantShortcut,
  onShortcutPressed,
  onShortcutReleased,
  getAudioLevel,
  PendingAction,
} from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";

type AssistantState = "idle" | "listening" | "handsfree" | "processing" | "success" | "error";
type NotificationType = "word-learned" | null;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PILL_SPRING = { type: "spring" as const, stiffness: 520, damping: 34 };
const CONTENT_FADE = { duration: 0.1 };

export default function AssistantPage() {
  const [state, setState] = useState<AssistantState>("idle");
  const [mounted, setMounted] = useState(false);
  const [rawAudioLevel, setRawAudioLevel] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);
  const [notification, setNotification] = useState<NotificationType>(null);
  const [learnedWord, setLearnedWord] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const stateRef = useRef<AssistantState>("idle");
  const rawAudioLevelRef = useRef(0);
  const wavePhaseRef = useRef(0);
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);
  const statusInterval = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef(false);
  const pendingStopRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { rawAudioLevelRef.current = rawAudioLevel; }, [rawAudioLevel]);

  /* ---------------------------------------------------------------- */
  /*  Smooth audio level via rAF                                       */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const twoPi = Math.PI * 2;

    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      const active = stateRef.current === "listening" || stateRef.current === "handsfree";

      setAudioLevel((prev) => {
        const target = rawAudioLevelRef.current < 0.01 ? 0 : rawAudioLevelRef.current;
        const alpha = target > prev ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 10);
        let next = prev + (target - prev) * alpha;
        if (target === 0 && next < 0.008) next = 0;
        return Math.max(0, Math.min(1, next));
      });

      if (active) {
        wavePhaseRef.current = (wavePhaseRef.current + dt * 11) % twoPi;
        setWavePhase(wavePhaseRef.current);
      } else if (wavePhaseRef.current !== 0) {
        wavePhaseRef.current = 0;
        setWavePhase(0);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Backend events                                                   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!mounted || !isTauri()) return;
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      try {
        unlisten = await listen<{ word: string }>("word-learned", (event) => {
          setLearnedWord(event.payload.word);
          setNotification("word-learned");
          setTimeout(() => setNotification(null), 3000);
        });
      } catch (e) { console.warn("Failed to listen for word-learned:", e); }
    };
    setup();
    return () => { unlisten?.(); };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !isTauri()) return;
    getPendingAction().then(setPendingAction).catch(() => undefined);
  }, [mounted]);

  /* ---------------------------------------------------------------- */
  /*  Audio level polling                                              */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if ((state === "listening" || state === "handsfree") && isTauri()) {
      let stopped = false;
      const poll = async () => {
        if (stopped) return;
        try {
          const level = await getAudioLevel();
          if (stopped) return;
          const n = Math.max(0, Math.min(1, level));
          setRawAudioLevel(Math.max(0, (n - 0.018) / (1 - 0.018)));
        } catch { /* */ }
        if (!stopped) audioLevelInterval.current = setTimeout(poll, 45);
      };
      void poll();
      return () => { stopped = true; if (audioLevelInterval.current) clearTimeout(audioLevelInterval.current); };
    } else {
      if (audioLevelInterval.current) clearTimeout(audioLevelInterval.current);
      setRawAudioLevel(0);
    }
    return () => { if (audioLevelInterval.current) clearTimeout(audioLevelInterval.current); };
  }, [state]);

  useEffect(() => {
    if (!(state === "listening" || state === "handsfree" || state === "processing") || !isTauri()) {
      if (statusInterval.current) clearTimeout(statusInterval.current);
      return;
    }

    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      try {
        const status = await getStatus();
        if (stopped) return;

        if (status.audio_status.phase === "Recovering") {
          setStatusNotice("Recovering microphone");
        } else if (stateRef.current === "processing") {
          const phase = status.delivery_status.phase;
          if (phase === "Retrying" || phase === "Verifying" || phase === "Injecting") {
            setStatusNotice(status.delivery_status.summary);
          } else if (phase !== "RecoverableFailure") {
            setStatusNotice(null);
          }
        } else if (statusNotice === "Recovering microphone") {
          setStatusNotice(null);
        }
      } catch {
        // Ignore transient polling errors while the backend is busy.
      }

      if (!stopped) {
        statusInterval.current = setTimeout(poll, 160);
      }
    };

    void poll();
    return () => {
      stopped = true;
      if (statusInterval.current) clearTimeout(statusInterval.current);
    };
  }, [state, statusNotice]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */
  const stopInternal = useCallback(async () => {
    if (stateRef.current !== "listening" && stateRef.current !== "handsfree") return;
    const dictationOnly = stateRef.current === "handsfree";
    setState("processing");
    try {
      const result = await stopListening(dictationOnly);
      const delivery = result.delivery_status;

      if (delivery.phase === "RecoverableFailure") {
        setStatusNotice(delivery.summary);
        setState("error");
        setTimeout(() => {
          setStatusNotice(null);
          setState("idle");
        }, 2600);
        return;
      }

      if (delivery.attempts > 1 || delivery.recovered_to_clipboard) {
        setStatusNotice(delivery.summary);
        setTimeout(() => setStatusNotice(null), 2400);
      }

      if (result.action?.action_type === "NoAction") { setState("idle"); return; }
      const isConvo = result.action?.action_type === "Respond" || result.action?.action_type === "Clarify";
      if (result.action?.requires_confirmation) {
        setPendingAction(await getPendingAction());
        setState("success");
        return;
      }
      if (!result.executed && result.action?.action_type !== "NoAction") {
        setState("error");
        setTimeout(() => setState("idle"), 1800);
        return;
      }
      setState("success");
      setTimeout(() => setState("idle"), isConvo ? 4500 : 1000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 1200);
    }
  }, []);

  const start = useCallback(async (handsfree = false) => {
    if (stateRef.current !== "idle" || pendingAction || isStartingRef.current) return;
    isStartingRef.current = true;
    pendingStopRef.current = false;
    setState(handsfree ? "handsfree" : "listening");
    try {
      await startListening();
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 1200);
    } finally {
      isStartingRef.current = false;
      if (pendingStopRef.current) { pendingStopRef.current = false; void stopInternal(); }
    }
  }, [pendingAction, stopInternal]);

  const stop = useCallback(async () => {
    if (isStartingRef.current) { pendingStopRef.current = true; return; }
    await stopInternal();
  }, [stopInternal]);

  const handleConfirmPending = useCallback(async () => {
    if (!pendingAction) return;
    setState("processing");
    try { await confirmPendingAction(); setPendingAction(null); setState("success"); setTimeout(() => setState("idle"), 900); }
    catch { setState("error"); setTimeout(() => setState("idle"), 1200); }
  }, [pendingAction]);

  const handleCancelPending = useCallback(async () => {
    if (!pendingAction) return;
    try { await cancelPendingAction(); setPendingAction(null); setState("success"); setTimeout(() => setState("idle"), 800); }
    catch { setState("error"); setTimeout(() => setState("idle"), 1200); }
  }, [pendingAction]);

  const cancel = useCallback(() => setState("idle"), []);

  /* ---------------------------------------------------------------- */
  /*  Shortcuts                                                        */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!mounted || !isTauri()) return;
    let u1: (() => void) | undefined;
    let u2: (() => void) | undefined;
    let u3: (() => void) | undefined;
    const setup = async () => {
      try {
        u1 = await onShortcutPressed(() => { if (stateRef.current === "idle") start(false); });
        u2 = await onShortcutReleased(() => { if (stateRef.current === "listening") stop(); });
        u3 = await onAssistantShortcut(() => {
          if (stateRef.current === "idle") {
            start(true);
            return;
          }

          if (stateRef.current === "handsfree") {
            stop();
          }
        });
      } catch (e) { console.warn("Setup failed:", e); }
    };
    setup();
    return () => { u1?.(); u2?.(); u3?.(); };
  }, [mounted, start, stop]);

  /* ---------------------------------------------------------------- */
  /*  Pill dimensions                                                  */
  /* ---------------------------------------------------------------- */
  const isActive = state !== "idle";
  const pillWidth = state === "handsfree" ? 148 : state === "listening" ? 110 : state === "processing" ? 80 : state === "success" || state === "error" ? 52 : 44;
  const pillHeight = state === "idle" ? 22 : 28;

  /* Glow color per state */
  const glowColor = state === "listening" || state === "handsfree"
    ? "rgba(99,130,255,0.45)"
    : state === "processing"
    ? "rgba(180,160,255,0.3)"
    : state === "success"
    ? "rgba(74,222,128,0.5)"
    : state === "error"
    ? "rgba(248,113,113,0.5)"
    : "rgba(0,0,0,0)";

  return (
    <div className="h-full w-full flex flex-col items-center justify-end pb-2 relative" style={{ background: "transparent" }}>
      {/* Notification */}
      <AnimatePresence>
        {notification && learnedWord && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="absolute bottom-full mb-3 h-8 px-3 rounded-full keep-bg flex items-center gap-2"
            style={{ background: "rgba(20,20,20,0.92)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="w-2 h-2 rounded-full bg-green-400 keep-bg" />
            <span className="text-[10px] text-white/80 truncate max-w-36">{learnedWord}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statusNotice && !pendingAction && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className="absolute bottom-full mb-3 max-w-[320px] px-3 py-2 rounded-2xl keep-bg"
            style={{ background: "rgba(20,20,20,0.94)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <span className="text-[11px] text-white/80">{statusNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending confirmation */}
      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className="absolute bottom-full mb-3 px-4 py-3 rounded-2xl keep-bg w-[320px]"
            style={{ background: "rgba(20,20,20,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="flex flex-col gap-2">
              <span className="text-[10px] tracking-wide uppercase text-yellow-300/90">Confirmation required</span>
              <span className="text-sm text-white/95">{pendingAction.summary}</span>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={handleConfirmPending} className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-medium transition-colors">Confirm</button>
                <button onClick={handleCancelPending} className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== PILL ==================== */}
      <motion.div
        className="relative rounded-full cursor-pointer keep-bg"
        style={{ willChange: "transform, width, height" }}
        initial={false}
        animate={{ width: pillWidth, height: pillHeight }}
        transition={PILL_SPRING}
        onClick={() => { if (state === "idle") start(true); }}
      >
        {/* Outer glow */}
        <motion.div
          className="absolute keep-bg rounded-full"
          style={{
            inset: -4,
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
          animate={{ backgroundColor: glowColor }}
          transition={{ duration: 0.3 }}
        />

        {/* Pill body */}
        <div
          className="absolute inset-0 rounded-full keep-bg overflow-hidden"
          style={{
            background: "rgba(18, 18, 22, 0.95)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Active gradient border overlay */}
          <motion.div
            className="absolute inset-0 rounded-full keep-bg"
            style={{
              background: "linear-gradient(135deg, rgba(99,130,255,0.15), rgba(180,100,255,0.1), rgba(255,180,80,0.08))",
            }}
            animate={{ opacity: isActive ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full">
          <AnimatePresence mode="popLayout">
            {state === "idle" && <IdlePill key="idle" />}
            {state === "listening" && <ListeningWave key="listening" level={audioLevel} phase={wavePhase} />}
            {state === "handsfree" && <HandsfreePill key="handsfree" level={audioLevel} phase={wavePhase} onCancel={cancel} onStop={stop} />}
            {state === "processing" && <ProcessingPill key="processing" />}
            {state === "success" && <SuccessPill key="success" />}
            {state === "error" && <ErrorPill key="error" />}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/* ================================================================== */
/*  IDLE — soft breathing pulse                                        */
/* ================================================================== */
function IdlePill() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={CONTENT_FADE}
      className="flex items-center justify-center gap-[4px] px-2"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-[3px] h-[3px] rounded-full keep-bg"
          style={{ background: "rgba(255,255,255,0.35)" }}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        />
      ))}
    </motion.div>
  );
}

/* ================================================================== */
/*  LISTENING — fluid SVG waveform                                     */
/* ================================================================== */
function ListeningWave({ level, phase }: { level: number; phase: number }) {
  const barCount = 12;
  const energy = Math.pow(Math.max(0, Math.min(1, level)), 0.8);

  const heights = useMemo(() => {
    const h: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const center = (barCount - 1) / 2;
      const dist = Math.abs(i - center) / center;
      const bellCurve = Math.exp(-dist * dist * 2.2);
      const wave1 = 0.7 + 0.3 * Math.sin(phase + i * 0.6);
      const wave2 = 0.85 + 0.15 * Math.sin(phase * 1.7 + i * 1.1);
      const minH = 2;
      const maxH = 20;
      h.push(minH + (maxH - minH) * energy * bellCurve * wave1 * wave2);
    }
    return h;
  }, [energy, phase]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={CONTENT_FADE}
      className="flex items-center justify-center gap-[1.5px] px-3 h-full"
    >
      {heights.map((h, i) => {
        const intensity = h / 20;
        return (
          <div
            key={i}
            className="rounded-full keep-bg"
            style={{
              width: "2px",
              height: `${h.toFixed(1)}px`,
              background: `rgba(${120 + Math.round(intensity * 80)}, ${150 + Math.round(intensity * 60)}, 255, ${0.5 + intensity * 0.5})`,
              transition: "height 0.035s linear, background 0.08s linear",
              boxShadow: energy > 0.3 ? `0 0 ${Math.round(intensity * 6)}px rgba(130,160,255,${intensity * 0.4})` : "none",
            }}
          />
        );
      })}
    </motion.div>
  );
}

/* ================================================================== */
/*  HANDSFREE — waveform + controls                                    */
/* ================================================================== */
function HandsfreePill({ level, phase, onCancel, onStop }: { level: number; phase: number; onCancel: () => void; onStop: () => void }) {
  const barCount = 10;
  const energy = Math.pow(Math.max(0, Math.min(1, level)), 0.8);

  const heights = useMemo(() => {
    const h: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const center = (barCount - 1) / 2;
      const dist = Math.abs(i - center) / center;
      const bell = Math.exp(-dist * dist * 2.2);
      const w1 = 0.7 + 0.3 * Math.sin(phase + i * 0.6);
      const w2 = 0.85 + 0.15 * Math.sin(phase * 1.7 + i * 1.1);
      h.push(2 + 16 * energy * bell * w1 * w2);
    }
    return h;
  }, [energy, phase]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={CONTENT_FADE}
      className="flex items-center justify-between w-full px-1.5"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        className="w-5 h-5 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors keep-bg flex-shrink-0"
      >
        <svg className="w-2.5 h-2.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="flex items-center justify-center gap-[1.5px] flex-1 mx-1 h-[18px]">
        {heights.map((h, i) => {
          const intensity = h / 18;
          return (
            <div
              key={i}
              className="rounded-full keep-bg"
              style={{
                width: "2px",
                height: `${h.toFixed(1)}px`,
                background: `rgba(${120 + Math.round(intensity * 80)}, ${150 + Math.round(intensity * 60)}, 255, ${0.5 + intensity * 0.5})`,
                transition: "height 0.035s linear",
              }}
            />
          );
        })}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onStop(); }}
        className="w-5 h-5 rounded-full flex items-center justify-center transition-colors keep-bg flex-shrink-0"
        style={{ background: "rgba(239,68,68,0.9)" }}
      >
        <div className="w-[7px] h-[7px] rounded-[1.5px] bg-white keep-bg" />
      </button>
    </motion.div>
  );
}

/* ================================================================== */
/*  PROCESSING — traveling shimmer wave                                */
/* ================================================================== */
function ProcessingPill() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={CONTENT_FADE}
      className="flex items-center justify-center gap-[6px] px-3"
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[4px] h-[4px] rounded-full keep-bg"
          style={{ background: "rgba(200,190,255,0.9)" }}
          animate={{
            opacity: [0.25, 1, 0.25],
            scale: [0.8, 1.15, 0.8],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.25,
          }}
        />
      ))}
    </motion.div>
  );
}

/* ================================================================== */
/*  SUCCESS — checkmark with spring pop                                */
/* ================================================================== */
function SuccessPill() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="flex items-center justify-center"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M5 13l4 4L19 7"
          stroke="#4ade80"
          strokeWidth="2.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
          style={{ filter: "drop-shadow(0 0 4px rgba(74,222,128,0.6))" }}
        />
      </svg>
    </motion.div>
  );
}

/* ================================================================== */
/*  ERROR — X with shake                                               */
/* ================================================================== */
function ErrorPill() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="flex items-center justify-center"
    >
      <motion.svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
        animate={{ x: [0, -2.5, 2.5, -1.5, 1.5, 0] }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        style={{ filter: "drop-shadow(0 0 4px rgba(248,113,113,0.6))" }}
      >
        <path d="M18 6L6 18" stroke="#f87171" strokeWidth="2.5" />
        <path d="M6 6l12 12" stroke="#f87171" strokeWidth="2.5" />
      </motion.svg>
    </motion.div>
  );
}
