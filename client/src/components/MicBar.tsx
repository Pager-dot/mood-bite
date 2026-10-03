import { useEffect, useRef, useState } from "react";

export function MicBar({
  speechOn, listening, interim, busy, onHoldStart, onHoldEnd, onSend,
}: {
  speechOn: boolean;
  listening: boolean;
  interim: string;
  busy: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // A finished transcript lands in the box so it can be fixed before sending.
  useEffect(() => {
    if (interim) setDraft(interim);
  }, [interim]);

  const send = () => {
    const t = draft.trim();
    if (!t || busy) return;
    setDraft("");
    onSend(t);
  };

  return (
    <div
      className="sticky bottom-0 z-10 border-t border-edge bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--kb, 0px) + 10px)" }}
    >
      {listening && (
        <div className="px-4 pt-3 text-center text-[14px] text-muted">
          {interim || "Listening…"}
        </div>
      )}

      <div className="flex items-end gap-2 px-4 pt-3">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={speechOn ? "or type it" : "Tell me how you're feeling"}
          enterKeyHint="send"
          className="min-h-[48px] flex-1 rounded-full border border-edge bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-muted focus:border-accent"
        />

        {speechOn ? (
          <button
            aria-label={listening ? "Stop listening" : "Hold to talk"}
            onPointerDown={(e) => { e.preventDefault(); onHoldStart(); }}
            onPointerUp={(e) => { e.preventDefault(); onHoldEnd(); }}
            onPointerCancel={onHoldEnd}
            onClick={(e) => e.preventDefault()}
            disabled={busy}
            className="relative grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-50"
          >
            {listening && <span className="ring absolute inset-0 rounded-full bg-accent" />}
            <MicIcon />
          </button>
        ) : (
          <button
            onClick={send}
            disabled={busy || !draft.trim()}
            className="min-h-[48px] shrink-0 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>

      {speechOn && (
        <div className="pb-1 pt-2 text-center text-[12px] text-muted">
          {listening ? "Release to send" : "Hold the mic and talk"}
        </div>
      )}
    </div>
  );
}

const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
);
