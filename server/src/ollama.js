import { z } from "zod";

const SYSTEM = `You are Mood Bite, a warm friend who decides where someone should eat based on how they feel.

You answer ONLY with JSON, one of two shapes:
  {"mode":"ask","reply":"<one short question>"}
  {"mode":"recommend","reply":"<2-3 sentences>","primary":{"name":"...","dish":"..."},"alternates":[{"name":"...","dish":"..."}]}

Rules:
- Use "ask" only if you truly cannot act: no cuisine signal AND no energy/mood signal. You may ask at most once in a conversation; if you have already asked, you must recommend.
- Every "name" MUST be copied exactly from the NEARBY PLACES list. Never invent a venue.
- "dish" is a specific plausible dish for that place, a few words.
- "reply" is spoken aloud: 2-3 sentences, warm and plain. No lists, no markdown, no emoji, no distances in metres, no asking two things at once.
- Name the primary place in the reply and say in one clause why it fits the mood.
- Never suggest a place listed as REJECTED.
- alternates: at most two, different from primary.`;

const AskSchema = z.object({ mode: z.literal("ask"), reply: z.string().min(1).max(300) });
const PickSchema = z.object({ name: z.string().min(1), dish: z.string().min(1).max(80) });
const RecSchema = z.object({
  mode: z.literal("recommend"),
  reply: z.string().min(1).max(600),
  primary: PickSchema,
  alternates: z.array(PickSchema).max(2).optional().default([]),
});
const Reply = z.discriminatedUnion("mode", [AskSchema, RecSchema]);

function buildContext({ area, places, rejected, alreadyAsked }) {
  const list = places
    .map((p, i) => `${i + 1}. ${p.name} — ${p.cuisine}, ${p.distanceM}m, ${p.priceBand}`)
    .join("\n");
  return [
    `AREA: ${area}`,
    `NEARBY PLACES:\n${list || "(none)"}`,
    rejected.length ? `REJECTED (never suggest): ${rejected.join(", ")}` : null,
    alreadyAsked
      ? `You have already asked a clarifying question in this conversation. You MUST use mode "recommend" now.`
      : null,
    `Respond with JSON only.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function callOllama(messages, ms = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? "gpt-oss:120b-cloud",
        messages,
        format: "json",
        stream: false,
        options: { temperature: 0.8 },
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return j.message?.content ?? "";
  } finally {
    clearTimeout(t);
  }
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function hydrate(parsed, places) {
  if (parsed.mode === "ask") return parsed;
  const find = (name) => places.find((p) => norm(p.name) === norm(name));
  const primary = find(parsed.primary.name);
  if (!primary) throw new Error(`hallucinated venue: ${parsed.primary.name}`);
  const seen = new Set([norm(primary.name)]);
  const alternates = [];
  for (const a of parsed.alternates ?? []) {
    const m = find(a.name);
    if (!m || seen.has(norm(m.name))) continue;
    seen.add(norm(m.name));
    alternates.push({ ...shape(m), dish: a.dish });
  }
  return { mode: "recommend", reply: parsed.reply, primary: { ...shape(primary), dish: parsed.primary.dish }, alternates };
}

const shape = (p) => ({
  name: p.name,
  dish: "",
  distanceM: p.distanceM,
  cuisine: p.cuisine,
  priceBand: p.priceBand,
  mapsUrl: p.mapsUrl,
});

function fallback(places, area) {
  if (!places.length) {
    return {
      mode: "ask",
      reply: `I couldn't find anywhere open around ${area}. Want me to look a bit further out, or should we keep it at home tonight?`,
    };
  }
  const p = places[0];
  return {
    mode: "recommend",
    reply: `Let's keep it easy — ${p.name} is the closest thing to you and it won't ask much of you. Grab something simple there and call it a night.`,
    primary: { ...shape(p), dish: "whatever's quickest" },
    alternates: places.slice(1, 3).map((q) => ({ ...shape(q), dish: "house special" })),
  };
}

export async function decide({ history, area, places, rejected = [], alreadyAsked = false }) {
  const trimmed = history.slice(-10);
  const messages = [
    { role: "system", content: SYSTEM },
    ...trimmed.slice(0, -1),
    { role: "user", content: `${buildContext({ area, places, rejected, alreadyAsked })}\n\nUSER SAID: ${trimmed.at(-1)?.content ?? ""}` },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callOllama(messages);
      const parsed = Reply.parse(JSON.parse(raw));
      if (parsed.mode === "ask" && alreadyAsked) throw new Error("asked twice");
      return hydrate(parsed, places);
    } catch (err) {
      console.warn(`[ollama] attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
  return fallback(places, area);
}

export const _internal = { SYSTEM, Reply, hydrate, fallback };
