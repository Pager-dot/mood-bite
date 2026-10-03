const UA = "MoodBite/1.0 (local dev)";

const haversine = (a, b, c, d) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (c - a) * r, dLon = (d - b) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

async function fetchJson(url, opts = {}, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal, headers: { "User-Agent": UA, ...(opts.headers ?? {}) } });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    const j = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=${lat}&lon=${lon}`);
    const a = j.address ?? {};
    return a.suburb || a.neighbourhood || a.city_district || a.town || a.city || a.county || "your area";
  } catch {
    return "your area";
  }
}

export async function forwardGeocode(areaText) {
  const j = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(areaText)}`);
  if (!j.length) return null;
  return { lat: Number(j[0].lat), lon: Number(j[0].lon), area: j[0].display_name.split(",")[0] };
}

// Price band is a guess: OSM rarely carries price data.
const bandFor = (tags) => {
  const t = (tags.amenity ?? "") + " " + (tags.cuisine ?? "");
  if (tags.amenity === "fast_food" || /street_food|food_court/.test(t)) return "₹";
  if (/sushi|steak|french|fine_dining/.test(t) || tags["stars"]) return "₹₹₹";
  return "₹₹";
};

export async function nearbyPlaces(lat, lon, radiusM = 2000) {
  const q = `[out:json][timeout:20];
(
  node["amenity"~"^(restaurant|cafe|fast_food)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(restaurant|cafe|fast_food)$"](around:${radiusM},${lat},${lon});
);
out center 120;`;
  const j = await fetchJson("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
  }, 20000);

  return (j.elements ?? [])
    .map((e) => {
      const tags = e.tags ?? {};
      const plat = e.lat ?? e.center?.lat, plon = e.lon ?? e.center?.lon;
      if (!tags.name || plat == null) return null;
      return {
        name: tags.name,
        cuisine: (tags.cuisine ?? tags.amenity ?? "food").split(";")[0].replace(/_/g, " "),
        distanceM: haversine(lat, lon, plat, plon),
        priceBand: bandFor(tags),
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tags.name} ${plat},${plon}`)}`,
        lat: plat,
        lon: plon,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceM - b.distanceM);
}
