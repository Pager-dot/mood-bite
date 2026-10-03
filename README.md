# Mood Bite

Mobile-first voice chatbot. Tell it how you're feeling; it commits to one place to eat near you.

## Run it

```bash
npm install
cp .env.example .env     # add OLLAMA_API_KEY from ollama.com settings
npm run dev              # client on :5173 (proxying /api), server on :3001
```

On a phone over the local network: `npm run dev` binds `--host`, so open
`http://<your-mac-ip>:5173`. Note that Chrome and Safari only grant mic and
geolocation on `localhost` or HTTPS — for a real phone test, build and serve
behind a tunnel (`npm run build && npm start`, then e.g. `ngrok http 3001`).

## Shape

- `server/src/index.js` — `/api/chat`, `/api/health`, serves `client/dist` in production
- `server/src/places.js` — Nominatim geocoding, Overpass restaurant lookup, haversine distances
- `server/src/ollama.js` — system prompt, Zod schemas, venue verification, retry, fallback
- `client/src/App.tsx` — chat state, localStorage, location gating, retry
- `client/src/hooks/` — speech recognition, TTS, geolocation, keyboard inset
- `client/src/components/` — mic bar, recommendation card

## Notes

- No API keys reach the browser; the client only ever talks to `/api`.
- Every suggested venue is verified against the Overpass response before it is
  returned — a name the model invented is treated as a failed attempt.
- One clarifying question per conversation, enforced server-side by checking
  whether a prior assistant turn ended in a question mark.
- Coordinates are rounded to 3 decimals (~110 m) in the browser, and the model
  is only ever shown the area name and the place list.
- Price bands are inferred from OSM tags, which rarely carry real price data.
- Without `OLLAMA_API_KEY` the endpoint still answers: it falls back to the
  nearest place, which is how the location and places paths were tested.
