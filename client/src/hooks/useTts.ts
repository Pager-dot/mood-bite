import { useCallback, useEffect, useState } from "react";

const KEY = "moodbite.tts";
export const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

export function useTts() {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ }
    if (!on && ttsSupported) window.speechSynthesis.cancel();
  }, [on]);

  const speak = useCallback(
    (text: string) => {
      if (!on || !ttsSupported || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-IN";
      u.rate = 1.02;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    },
    [on]
  );

  return { on, toggle: () => setOn((v) => !v), speak };
}
