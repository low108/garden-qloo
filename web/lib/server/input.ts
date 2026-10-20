// Validates what the browser sends: a public API must not pass arbitrary text or sizes to Qloo and Gemini.
import "server-only";
import type { Person } from "./garden";
import type { Candidate, Slot } from "./planner";
import type { Entity, EntityType } from "./qloo";

const TYPES = new Set<EntityType>(["movie", "artist", "tv_show", "book", "place", "destination", "podcast", "video_game"]);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function city(v: unknown): string {
  return str(v, 60).replace(/[^\p{L}\p{N} ,.'-]/gu, "") || "Singapore";
}

export function entity(raw: unknown): Entity | null {
  const v = (raw ?? {}) as { id?: unknown; name?: unknown; type?: unknown };
  if (typeof v.id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(v.id) || !TYPES.has(v.type as EntityType)) return null;
  return { id: v.id, name: str(v.name, 120), type: v.type as EntityType, tags: [], kinds: [], flags: [], menu: [] };
}

/** A person typed into the form (you, or your match): a name, a few facts and 3-8 real favourites. */
export function person(raw: unknown, id: string): Person {
  return { ...you(raw), id };
}

/** The visitor's own twin, from the form: a name, a few facts and 3-8 real favourites. */
export function you(raw: unknown): Person {
  const v = (raw ?? {}) as Record<string, unknown>;
  const favourites = (Array.isArray(v.favourites) ? v.favourites : []).map(entity).filter(Boolean).slice(0, 8) as Entity[];
  if (favourites.length < 3) throw new Error("pick at least 3 favourites");
  const age = Number(v.age) ? Math.min(99, Math.max(18, Number(v.age))) : 0; // 0: not given
  return {
    id: "you",
    name: str(v.name, 40) || "You",
    gender: v.gender === "m" ? "m" : "f",
    age,
    work: str(v.work, 60) || "not saying",
    about: (Array.isArray(v.about) ? v.about : []).map((s: unknown) => str(s, 160)).filter(Boolean).slice(0, 3),
    favourites,
  };
}

export const bad = (e: unknown, status = 400) =>
  Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });

const str2 = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** A candidate place sent back by the browser for a rehearsal: only short, plain fields survive. */
export function candidate(raw: unknown): Candidate {
  const v = (raw ?? {}) as Record<string, unknown>;
  const list = (x: unknown, n: number, max: number) => (Array.isArray(x) ? x.map((s) => str2(s, max)).filter(Boolean).slice(0, n) : []);
  const slot = ["brunch", "afternoon", "dinner", "drinks"].includes(String(v.slot)) ? (v.slot as Slot) : "afternoon";
  if (typeof v.id !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(v.id)) throw new Error("bad place");
  return {
    id: v.id, name: str2(v.name, 100), type: "place", slot, address: str2(v.address, 160) || undefined,
    tags: list(v.tags, 6, 40), kinds: list(v.kinds, 4, 40), flags: [], menu: list(v.menu, 5, 60),
  };
}
