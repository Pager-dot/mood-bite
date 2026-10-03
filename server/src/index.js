import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { decide } from "./ollama.js";
import { nearbyPlaces, reverseGeocode, forwardGeocode } from "./places.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).min(1).max(40),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  areaText: z.string().min(2).max(120).optional(),
  rejected: z.array(z.string().max(120)).max(50).optional().default([]),
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, model: process.env.OLLAMA_MODEL ?? "gpt-oss:120b-cloud", hasKey: Boolean(process.env.OLLAMA_API_KEY) })
);

app.post("/api/chat", async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "bad request" });
  const { messages, rejected } = parsed.data;
  let { lat, lon } = parsed.data;
  const { areaText } = parsed.data;

  try {
    let area = "your area";

    if (lat == null && areaText) {
      const geo = await forwardGeocode(areaText).catch(() => null);
      if (!geo) {
        return res.json({ mode: "ask", reply: "I couldn't place that spot. Which city or neighbourhood are you in?" });
      }
      ({ lat, lon } = geo);
      area = geo.area;
    } else if (lat != null) {
      area = await reverseGeocode(lat, lon);
    } else {
      return res.json({ mode: "ask", reply: "I can't see where you are. Which neighbourhood or city should I look in?" });
    }

    // 2km first, widen to 5km only if that comes back thin.
    const look = async (radius) => {
      try {
        return await nearbyPlaces(lat, lon, radius);
      } catch (err) {
        console.warn(`[overpass] ${radius}m failed: ${err.message}`);
        return [];
      }
    };
    let places = await look(2000);
    if (places.length < 3) {
      const wider = await look(5000);
      if (wider.length) places = wider;
    }

    const rejectedSet = new Set(rejected.map((r) => r.toLowerCase()));
    places = places.filter((p) => !rejectedSet.has(p.name.toLowerCase())).slice(0, 25);

    // One clarifying question per conversation, enforced server-side.
    const alreadyAsked = messages.some((m) => m.role === "assistant" && m.content.trim().endsWith("?"));

    const out = await decide({ history: messages, area, places, rejected, alreadyAsked });
    res.json(out);
  } catch (err) {
    console.error("[/api/chat]", err);
    res.status(502).json({ error: "upstream" });
  }
});

const dist = path.join(__dirname, "../../client/dist");
app.use(express.static(dist));
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html"), (e) => e && res.status(404).end()));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`mood-bite server on http://localhost:${port}`));
