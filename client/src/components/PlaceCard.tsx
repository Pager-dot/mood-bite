import type { Place } from "../types";

const dist = (m: number) => (m < 950 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

export function PlaceCard({ place, alternates, onReject }: {
  place: Place;
  alternates?: Place[];
  onReject: (name: string) => void;
}) {
  return (
    <div className="rise mt-2 w-full rounded-[22px] border border-edge bg-surface p-4 shadow-sm">
      <div className="text-[21px] font-semibold leading-tight">{place.name}</div>
      {place.dish && <div className="mt-1 text-[15px] text-ink/80">{place.dish}</div>}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <Tag>{dist(place.distanceM)}</Tag>
        <Tag>{place.priceBand}</Tag>
        <Tag>{place.cuisine}</Tag>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href={place.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-ink active:opacity-80"
        >
          Open in Maps
        </a>
        <button
          onClick={() => onReject(place.name)}
          className="min-h-[44px] rounded-full border border-edge px-5 text-[15px] font-medium text-muted active:opacity-70"
        >
          Not this
        </button>
      </div>

      {alternates && alternates.length > 0 && (
        <div className="mt-4 border-t border-edge pt-3">
          <div className="text-[12px] uppercase tracking-wide text-muted">Or</div>
          {alternates.map((a) => (
            <a
              key={a.name}
              href={a.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex min-h-[44px] items-center justify-between gap-3 active:opacity-70"
            >
              <span className="truncate text-[15px]">
                {a.name}
                {a.dish && <span className="text-muted"> · {a.dish}</span>}
              </span>
              <span className="shrink-0 text-[13px] text-muted">{dist(a.distanceM)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-edge px-2.5 py-1">{children}</span>
);
