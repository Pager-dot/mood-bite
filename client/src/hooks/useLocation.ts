import { useCallback, useRef, useState } from "react";

export type Coords = { lat: number; lon: number };
export type LocState = "unknown" | "ok" | "denied";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function useLocation() {
  const [state, setState] = useState<LocState>("unknown");
  const coordsRef = useRef<Coords | null>(null);

  /** Asks the browser once, lazily. Resolves null if denied or unavailable. */
  const ensure = useCallback(async (): Promise<Coords | null> => {
    if (coordsRef.current) return coordsRef.current;
    if (state === "denied" || !("geolocation" in navigator)) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: round3(pos.coords.latitude), lon: round3(pos.coords.longitude) };
          coordsRef.current = c;
          setState("ok");
          resolve(c);
        },
        () => {
          setState("denied");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    });
  }, [state]);

  return { state, ensure };
}
