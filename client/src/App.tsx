import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatReply, Message } from "./types";
import { speechSupported, useSpeech } from "./hooks/useSpeech";
import { useTts, ttsSupported } from "./hooks/useTts";
import { useLocation } from "./hooks/useLocation";
import { useKeyboardInset } from "./hooks/useViewport";
import { MicBar } from "./components/MicBar";
import { PlaceCard } from "./components/PlaceCard";

const STORE = "moodbite.chat";
const REJECTED = "moodbite.rejected";
const uid = () => Math.random().toString(36).slice(2);

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => load<Message[]>(STORE, []));
  const [rejected, setRejected] = useState<string[]>(() => load<string[]>(REJECTED, []));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [areaText, setAreaText] = useState<string | null>(null);

  const tts = useTts();
  const loc = useLocation();
  useKeyboardInset();

  const endRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ messages, rejected, areaText });
  stateRef.current = { messages, rejected, areaText };

  useEffect(() => save(STORE, messages), [messages]);
  useEffect(() => save(REJECTED, rejected), [rejected]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const history = [...stateRef.current.messages, { id: uid(), role: "user" as const, content: text }];
      setMessages(history);
      setBusy(true);
      setNotice(null);

      const coords = await loc.ensure();
      if (!coords && !stateRef.current.areaText) {
        // No location and no area yet: this message doubles as the area answer only
        // once we've asked for it, so ask first.
        if (!stateRef.current.messages.some((m) => m.role === "assistant")) {
          setMessages((m) => [
            ...m,
            { id: uid(), role: "assistant", content: "I can't see where you are — which neighbourhood or city are you in?" },
          ]);
          setBusy(false);
          return;
        }
        setAreaText(text);
      }

      const area = coords ? null : stateRef.current.areaText ?? text;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            ...(coords ?? {}),
            ...(area ? { areaText: area } : {}),
            rejected: stateRef.current.rejected,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ChatReply;

        setMessages((m) => [
          ...m,
          { id: uid(), role: "assistant", content: data.reply, primary: data.primary, alternates: data.alternates },
        ]);
        tts.speak(data.reply);
      } catch {
        setNotice("I didn't catch that, say it again?");
      } finally {
        setBusy(false);
      }
    },
    [loc, tts]
  );

  const speech = useSpeech(send);
  const micUsable = speechSupported && speech.state !== "denied";

  const reject = (name: string) => {
    const next = [...new Set([...rejected, name])];
    setRejected(next);
    stateRef.current.rejected = next;
    void send(`Not ${name}, give me something else.`);
  };

  const reset = () => {
    setMessages([]);
    setRejected([]);
    setAreaText(null);
    setNotice(null);
    try { localStorage.removeItem(STORE); localStorage.removeItem(REJECTED); } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto flex h-full max-w-[480px] flex-col">
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-bg/95 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div>
          <div className="text-[17px] font-semibold">Mood Bite</div>
          <div className="text-[12px] text-muted">Tell me how you're feeling</div>
        </div>
        <div className="flex items-center gap-1">
          {ttsSupported && (
            <button
              onClick={tts.toggle}
              aria-pressed={tts.on}
              aria-label={tts.on ? "Mute replies" : "Speak replies"}
              className={`grid h-11 w-11 place-items-center rounded-full border border-edge text-[18px] ${tts.on ? "text-ink" : "text-muted"}`}
            >
              {tts.on ? "🔊" : "🔇"}
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={reset} aria-label="Start over" className="grid h-11 w-11 place-items-center rounded-full border border-edge text-[16px] text-muted">
              ↺
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !busy && <Intro micUsable={micUsable} />}

        {messages.map((m) => (
          <div key={m.id} className={`rise mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={m.role === "user" ? "max-w-[85%]" : "w-full max-w-[92%]"}>
              <div
                className={`whitespace-pre-wrap rounded-bubble px-4 py-3 text-[16px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-accent text-accent-ink"
                    : "border border-edge bg-surface text-ink"
                }`}
              >
                {m.content}
              </div>
              {m.primary && <PlaceCard place={m.primary} alternates={m.alternates} onReject={reject} />}
            </div>
          </div>
        ))}

        {busy && (
          <div className="mb-3 flex justify-start">
            <div className="flex gap-1.5 rounded-bubble border border-edge bg-surface px-4 py-4">
              {[0, 1, 2].map((i) => (
                <span key={i} className="dot h-2 w-2 rounded-full bg-muted" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          </div>
        )}

        {notice && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-bubble border border-edge bg-surface px-4 py-3 text-[15px]">
            <span>{notice}</span>
            <button
              onClick={() => {
                const last = [...messages].reverse().find((m) => m.role === "user");
                setMessages((m) => m.filter((x) => x.id !== last?.id));
                if (last) void send(last.content);
              }}
              className="shrink-0 font-semibold text-accent"
            >
              Retry
            </button>
          </div>
        )}

        {speech.state === "denied" && (
          <p className="mb-3 text-center text-[13px] text-muted">
            Mic is blocked, so type instead — it works the same.
          </p>
        )}

        <div ref={endRef} />
      </main>

      <MicBar
        speechOn={micUsable}
        listening={speech.listening}
        interim={speech.interim}
        busy={busy}
        onHoldStart={speech.start}
        onHoldEnd={speech.stop}
        onSend={send}
      />
    </div>
  );
}

function Intro({ micUsable }: { micUsable: boolean }) {
  return (
    <div className="rise flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="text-[44px]">🍜</div>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight">How are you feeling?</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        {micUsable
          ? "Hold the mic and say it out loud. I'll pick one place near you and tell you why."
          : "Type it below. I'll pick one place near you and tell you why."}
      </p>
      <p className="mt-6 text-[13px] text-muted/80">“I'm exhausted and I don't want to think about it”</p>
    </div>
  );
}
