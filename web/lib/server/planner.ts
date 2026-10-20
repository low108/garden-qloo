// Rehearse your first date: for a couple who already matched, Qloo finds places for a whole day that both
// tastes point to, the twins rehearse each one a few times, and the day is built from the places that
// brought them closest, compared with the same couple at a plain cafe.
import "server-only";
import { type Entity, placesFor } from "./qloo";
import { json } from "./llm";
import type { Person } from "./garden";

export type Slot = "brunch" | "afternoon" | "dinner" | "drinks";
export const SLOTS: { slot: Slot; time: string; label: string; tags: string[] }[] = [
  { slot: "brunch", time: "10:30", label: "Brunch", tags: ["urn:tag:category:place:cafe", "urn:tag:genre:place:restaurant:brunch", "urn:tag:category:place:bakery"] },
  { slot: "afternoon", time: "13:30", label: "Afternoon", tags: ["urn:tag:category:place:museum", "urn:tag:category:place:art_gallery", "urn:tag:category:place:park"] },
  { slot: "dinner", time: "18:30", label: "Dinner", tags: ["urn:tag:category:place:restaurant"] },
  { slot: "drinks", time: "21:00", label: "After dinner", tags: ["urn:tag:category:place:cocktail_bar", "urn:tag:category:place:wine_bar", "urn:tag:category:place:bar"] },
];
const PER_SLOT = 2;
// Not first-date places: hotels, places of worship, youth and community centres.
const NOT_A_DATE = /hotel|resort|temple|church|mosque|dargah|shrine|cathedral|school|kids|child|youth|community|hospital|store|shop\b|club ?house|members|corporate|office|canteen|cafeteria|food court|supermarket/i;

export type Candidate = Entity & { slot: Slot };

/** Two places per slot that both tastes point to, no place used twice in the day. */
export async function candidates(a: Person, b: Person, city: string): Promise<Candidate[]> {
  const ids = [...a.favourites, ...b.favourites].map((e) => e.id);
  const lists = await Promise.all(SLOTS.map((s) => placesFor(ids, city, s.tags, 25)));
  const used = new Set<string>();
  const out: Candidate[] = [];
  SLOTS.forEach((s, i) => {
    const ok = lists[i].filter((p) => !used.has(p.id) && !p.flags.length && !NOT_A_DATE.test([p.name, ...p.kinds].join(" ")));
    for (const p of ok.slice(0, PER_SLOT)) {
      used.add(p.id);
      out.push({ ...p, slot: s.slot });
    }
  });
  return out;
}

const facts = (p: Person) =>
  `${p.name}${p.age ? `, ${p.age}` : ""}${p.work ? `, ${p.work}` : ""}. ${p.about.join(" ")} Loves: ${p.favourites.map((e) => e.name).join(", ")}.`;

const RULES =
  "You voice the AI twins of two real people who matched and are rehearsing their first date. Each twin speaks only from the facts " +
  "given about it: never invent a job, a past or a family. Mention films, music and books only from their lists, and food or drinks " +
  "only from the venue's menu highlights. Talk like real people on a first date: short lines, curiosity, opinions, a little awkwardness. " +
  "React to the place itself. Let it go well or badly as these two would. Never mention being an AI.";

export type Rehearsal = {
  venue: string | null; // candidate id, or null for the plain-cafe baseline
  run: number;
  lines: { who: "a" | "b"; say: string }[];
  aAfter: number; // 0-100: how much each now wants a second date
  bAfter: number;
  spark: string; // the line that brought them closest ("" if none)
  landed: string[]; // topics that went well
  flat: string[]; // topics that fell flat
  order: string[]; // what they had there, from the menu highlights
};

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 50)));
const strings = (v: unknown, n: number) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, n) : []);

export async function rehearse(a: Person, b: Person, place: Candidate | null, run: number): Promise<Rehearsal> {
  const slot = SLOTS.find((s) => s.slot === place?.slot);
  const where = place
    ? `${slot?.label ?? "A date"} at ${place.name}${place.address ? ` (${place.address})` : ""}. What it is: ${place.kinds.slice(0, 3).join(", ")}. ` +
      `Feel: ${place.tags.slice(0, 5).join(", ")}.${place.menu.length ? ` Menu highlights: ${place.menu.join(", ")}.` : ""}`
    : "Coffee at a plain, quiet cafe with nothing special about it.";
  const r = await json<Record<string, unknown>>(
    `Rehearsal ${run} of their first date. ${where}\n\nTWIN A: ${facts(a)}\nTWIN B: ${facts(b)}\n\n` +
      "Write the date as 8 short alternating lines, A first. Then: how much each now wants a second date, from 0 (not at all) to 100 " +
      "(can't wait), using the whole scale honestly, the one line that brought " +
      "them closest (quote it exactly, or empty if nothing did), up to 3 topics that went well, up to 3 that fell flat, and what they had " +
      "there (from the menu highlights only, or empty).",
    `{"lines": [{"who": "a" or "b", "say": "..."}], "aAfter": 0-100, "bAfter": 0-100, "spark": "...", "landed": ["..."], "flat": ["..."], "order": ["..."]}`,
    ["lines", "aAfter", "bAfter"],
    RULES,
  );
  return {
    venue: place?.id ?? null,
    run,
    lines: (Array.isArray(r.lines) ? (r.lines as { who?: string; say?: string }[]) : [])
      .filter((l) => typeof l?.say === "string")
      .map((l) => ({ who: (l.who === "b" ? "b" : "a") as "a" | "b", say: String(l.say).trim() }))
      .slice(0, 10),
    aAfter: clamp(r.aAfter),
    bAfter: clamp(r.bAfter),
    spark: typeof r.spark === "string" ? r.spark.trim().replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, "") : "",
    landed: strings(r.landed, 3),
    flat: strings(r.flat, 3),
    order: strings(r.order, 3).filter((o) => place?.menu.some((m) => m.toLowerCase() === o.toLowerCase())),
  };
}
