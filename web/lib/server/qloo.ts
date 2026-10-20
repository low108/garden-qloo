// Qloo's taste graph, server side only (the key never reaches the browser). Responses are cached in
// memory for the life of the server instance: Qloo allows private caching, not publishing its data.
import "server-only";

const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const cache = new Map<string, Promise<RawResponse>>();

export type EntityType = "movie" | "artist" | "tv_show" | "book" | "place" | "destination" | "podcast" | "video_game";
export const TASTE_TYPES: EntityType[] = ["movie", "artist", "tv_show", "book"];

export type Entity = {
  id: string;
  name: string;
  type: EntityType;
  affinity?: number; // 0-1, how strongly the signal points at it (insights only)
  image?: string;
  year?: number;
  address?: string;
  tags: string[]; // human-readable tag names, most telling first
  kinds: string[]; // what the entity is, from its genre and category tags ("Cafe", "Museum", ...)
  flags: string[]; // tags that rule a place out for a date ("University campus", "Five star" hotel, ...)
};

// The parts of Qloo's JSON this file reads.
type RawTag = { name?: string; type?: string };
type RawEntity = {
  entity_id: string;
  name: string;
  type?: string;
  subtype?: string;
  types?: string[];
  properties?: { image?: { url?: string }; release_year?: number; address?: string };
  query?: { affinity?: number };
  tags?: RawTag[];
};
type RawResponse = { results?: RawEntity[] | { entities?: RawEntity[] } };

const KIND_TAGS = /:(genre|category):/;
const FLAG_TAGS = /:(hotel_rating|room_type):|setting:.*(campus|residential|commercial)|education|university|residential/i;

// At most a few Qloo calls in flight: bursts hit the per-minute rate limit (429).
const MAX_IN_FLIGHT = 3;
let inFlight = 0;
const queue: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>((go) => queue.push(go));
  inFlight++;
  try {
    return await work();
  } finally {
    inFlight--;
    queue.shift()?.();
  }
}

async function get(path: string, params: Record<string, string | number>): Promise<RawResponse> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set");
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `${BASE}${path}?${qs}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      slot(async () => {
        for (let attempt = 0; ; attempt++) {
          // Next.js keeps the response in its private server cache for a week, across requests and instances.
          const r = await fetch(url, { headers: { "X-Api-Key": key }, next: { revalidate: 604800 } });
          if ((r.status === 429 || r.status >= 500) && attempt < 5) {
            const after = Number(r.headers.get("retry-after")) * 1000;
            await new Promise((ok) => setTimeout(ok, after > 0 ? Math.min(after, 8000) : 700 * 2 ** attempt));
            continue;
          }
          if (!r.ok) throw new Error(`Qloo ${path} returned ${r.status}`);
          return (await r.json()) as RawResponse;
        }
      }).catch((e) => {
        cache.delete(url); // don't remember failures
        throw e;
      }),
    );
  }
  return cache.get(url)!;
}

function toEntity(e: RawEntity, fallbackType?: EntityType): Entity {
  const type = (String(e.subtype ?? e.type ?? (e.types ?? [])[0] ?? "").split(":").pop() || fallbackType) as EntityType;
  const p = e.properties ?? {};
  const tags = e.tags ?? [];
  return {
    id: e.entity_id,
    name: e.name,
    type: fallbackType ?? type,
    affinity: e.query?.affinity,
    image: p.image?.url,
    year: p.release_year ?? undefined,
    address: p.address ?? undefined,
    tags: tags
      // Descriptive tags only (mood, style, setting, themes), not logistics like payments or age ranges.
      .filter((t) => t.name && !/^urn/.test(t.name) && !/not_for_display|amenit|payment|accessib|age_range|service|offering|menu|planning|dining_option|beverage|dietary|customer|crowd|popular_time|price/.test(t.type ?? ""))
      .slice(0, 6)
      .map((t) => t.name!),
    kinds: tags.filter((t) => KIND_TAGS.test(t.type ?? "") && t.name).map((t) => t.name!),
    flags: tags.filter((t) => FLAG_TAGS.test(`${t.type ?? ""}:${t.name ?? ""}`)).map((t) => t.name ?? ""),
  };
}

/** Find entities by name: the "type your favourites" box. */
export async function search(query: string, type?: EntityType, take = 6): Promise<Entity[]> {
  const params: Record<string, string | number> = { query, take };
  if (type) params.types = `urn:entity:${type}`;
  const d = await get("/search", params);
  return (Array.isArray(d.results) ? d.results : []).map((e) => toEntity(e, type));
}

/** Recommendations of one type for a taste signal (entity IDs), each with an affinity score. */
export async function insights(
  type: EntityType,
  opts: { entities?: string[]; tags?: string[]; location?: string; take?: number },
): Promise<Entity[]> {
  const params: Record<string, string | number> = { "filter.type": `urn:entity:${type}`, take: opts.take ?? 10 };
  if (opts.entities?.length) params["signal.interests.entities"] = opts.entities.join(",");
  if (opts.tags?.length) params["signal.interests.tags"] = opts.tags.join(",");
  if (opts.location) params["filter.location.query"] = opts.location;
  const d = await get("/v2/insights", params);
  const ents = d.results && !Array.isArray(d.results) ? (d.results.entities ?? []) : [];
  return ents.map((e) => toEntity(e, type));
}

/** Weighted Jaccard of two taste profiles (entity id -> affinity): 0 nothing shared, 1 identical. */
export function overlap(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let num = 0, den = 0;
  for (const k of keys) {
    num += Math.min(a[k] ?? 0, b[k] ?? 0);
    den += Math.max(a[k] ?? 0, b[k] ?? 0);
  }
  return den ? num / den : 0;
}
