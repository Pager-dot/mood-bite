import { useCallback, useEffect, useRef, useState } from "react";

type SR = any;

const Ctor: (new () => SR) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export const speechSupported = Boolean(Ctor);

export type MicState = "idle" | "listening" | "denied";

/** Hold-to-talk wrapper around SpeechRecognition. Interim text streams out live. */
export function useSpeech(onFinal: (text: string) => void) {
  const [state, setState] = useState<MicState>("idle");
  const [interim, setInterim] = useState("");
  const recRef = useRef<SR | null>(null);
  const bufRef = useRef("");
  const silenceRef = useRef<number | null>(null);
  const hardStopRef = useRef<number | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const clearTimers = () => {
    if (silenceRef.current) window.clearTimeout(silenceRef.current);
    if (hardStopRef.current) window.clearTimeout(hardStopRef.current);
    silenceRef.current = hardStopRef.current = null;
  };

  useEffect(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      bufRef.current = text.trim();
      setInterim(bufRef.current);
      // 8s of quiet after the last word ends the turn.
      if (silenceRef.current) window.clearTimeout(silenceRef.current);
      silenceRef.current = window.setTimeout(() => rec.stop(), 8000);
    };

    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setState("denied");
      else setState("idle");
      clearTimers();
    };

    rec.onend = () => {
      clearTimers();
      setState((s) => (s === "denied" ? s : "idle"));
      const text = bufRef.current.trim();
      bufRef.current = "";
      setInterim("");
      if (text) finalRef.current(text);
    };

    recRef.current = rec;
    return () => {
      clearTimers();
      try { rec.abort(); } catch { /* already dead */ }
    };
  }, []);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || state === "listening" || state === "denied") return;
    bufRef.current = "";
    setInterim("");
    try {
      rec.start();
      setState("listening");
      hardStopRef.current = window.setTimeout(() => rec.stop(), 20000);
      silenceRef.current = window.setTimeout(() => rec.stop(), 8000);
    } catch {
      /* start() throws if already running; harmless */
    }
  }, [state]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* not running */ }
  }, []);

  return { state, interim, start, stop, listening: state === "listening" };
}
