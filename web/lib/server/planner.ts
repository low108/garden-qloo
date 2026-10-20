// Rehearse your first date: for a couple who already matched, Qloo finds places for a whole day that both
// tastes point to and that fit both people (food needs, alcohol, budget as hard rules; energy, nerves, date
// style and appetite for novelty as preferences). The twins rehearse each place once, and every rehearsal has
// to show its work: moments where a specific line ties something about one of them to something real about
// the place. The server checks each moment against the profiles and the place's Qloo tags before showing it.
import "server-only";
import { type Entity, placesFor } from "./qloo";
import { json } from "./llm";
import type { Person } from "./garden";
import { DIETS, type Prefs, profileItems } from "../profile";

export type Slot = "brunch" | "afternoon" | "dinner" | "drinks";
const T = (s: string) => `urn:tag:${s}`;
const BAR_TAGS = ["category:place:cocktail_bar", "category:place:wine_bar", "category:place:bar", "category:place:live_music_venue"].map(T);
const SOBER_TAGS = ["genre:place:restaurant:dessert", "category:place:tea_house", "category:place:night_market", "category:place:live_music_venue"].map(T);
export const SLOTS: { slot: Slot; time: string; label: string; tags: string[]; food: boolean }[] = [
  { slot: "brunch", time: "10:30", label: "Brunch", food: true, tags: ["category:place:cafe", "genre:place:restaurant:brunch", "category:place:bakery"].map(T) },
  { slot: "afternoon", time: "13:30", label: "Afternoon", food: false,
    tags: ["category:place:museum", "category:place:art_gallery", "category:place:park", "category:place:book_store", "category:place:board_game_club"].map(T) },
  { slot: "dinner", time: "18:30", label: "Dinner", food: true, tags: [T("category:place:restaurant")] },
  { slot: "drinks", time: "21:00", label: "After dinner", food: false, tags: BAR_TAGS },
];
const DIET_TAG: Partial<Record<Prefs["diet"][number], string>> = {
  halal: T("dietary_option:qloo:halal"), vegetarian: T("dietary_option:qloo:vegetarian"), vegan: T("dietary_option:qloo:vegan"),
};
const PER_SLOT = 2;
// Not first-date places: hotels, places of worship, youth and community centres, shops, corporate clubs.
const NOT_A_DATE = /hotel|resort|temple|church|mosque|dargah|shrine|cathedral|school|kids|child|youth|community|hospital|store\b|club ?house|members|corporate|office|canteen|cafeteria|food court|supermarket|coworking/i;
// A street address or a whole neighbourhood rather than one place you can book ("10 Winstedt Road", "Dempsey Hill").
const AREA = /^\d+[a-z]? [\w ]+ (road|rd|street|st|avenue|ave|lane)$|^[\w ]+ (hill|village|quarter|district|precinct)$/i;
const QUIET = /quiet|cozy|calm|tranquil|relax|peaceful|intimate|serene/i;
const LOUD = /lively|loud|party|club|nightlife|energetic|bustling|crowded|vibrant/i;
const SIDE_BY_SIDE = /museum|gallery|park|garden|market|book|board game|arcade|live music|concert|walk|nature/i;
const NOVEL = /unique|quirky|hidden gem|themed|innovative|creative|unusual|experimental|eclectic/i;

export type Candidate = Entity & {
  slot: Slot;
  fits: string[]; // why it suits these two people ("calm and quiet, good for Mira (introvert)", "halal (Qloo-tagged)")
  links: string[]; // the place's Qloo tags that echo something in their favourites ("Japanese", "Whimsical")
};

// Words too generic to count as an echo of someone's taste.
const GENERIC = new Set(["restaurant", "place", "urban", "food", "delivery", "takeout", "lunch", "dinner", "breakfast", "cafe", "casual",
  "drinks", "service", "friendly", "popular", "good", "great", "modern", "local", "city", "area", "street", "style", "options"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z\u00c0-\u024f]+/).filter((w) => w.length > 3 && !GENERIC.has(w));

/** How well a place fits two people, and the reasons, from its Qloo tags. */
function fit(place: Entity, people: Person[]): { score: number; fits: string[]; links: string[] } {
  const v = [...place.vibe, ...place.kinds].join(" · ");
  const what = place.kinds.join(" · "); // what the place is, not every word said about it
  const quiet = QUIET.test(v) && !LOUD.test(v), loud = LOUD.test(v) && !QUIET.test(v);
  let score = 0;
  const fits: string[] = [];
  for (const p of people) {
    const x = p.prefs;
    if (x.energy === "introvert" && quiet) { score += 1; fits.push(`calm and quiet, good for ${p.name} (introvert)`); }
    if (x.energy === "introvert" && loud) score -= 1.5;
    if (x.energy === "extravert" && loud) { score += 1; fits.push(`lively, good for ${p.name} (extravert)`); }
    if ((x.nerves !== "calm" || x.style === "do") && SIDE_BY_SIDE.test(what)) { score += 1; fits.push(`something to do side by side, good for ${p.name}`); }
    if (x.novelty === "surprise" && NOVEL.test(v)) { score += 0.7; fits.push(`something new for ${p.name}`); }
    if (x.novelty === "familiar" && NOVEL.test(v)) score -= 0.5;
  }
  // Echoes of their favourites in the place: tag words that also appear in a favourite's name or Qloo tags.
  const theirs = new Set(people.flatMap((p) => p.favourites.flatMap((f) => [f.name, ...f.tags].flatMap(words))));
  const links = place.vibe.filter((t) => words(t).some((w) => theirs.has(w))).slice(0, 4);
  score += 0.4 * links.length;
  // "quiet, good for Mira" + "quiet, good for Luca" reads as "quiet, good for Mira and Luca".
  const merged = new Map<string, string[]>();
  for (const f of fits) {
    const [what, who = ""] = f.split(", good for ");
    merged.set(what, [...(merged.get(what) ?? []), who].filter(Boolean));
  }
  return { score, fits: [...merged].map(([what, who]) => (who.length ? `${what}, good for ${[...new Set(who)].join(" and ")}` : what)), links };
}

/** Two places per slot that both tastes point to and both people can enjoy, no place used twice in the day. */
export async function candidates(a: Person, b: Person, city: string): Promise<Candidate[]> {
  const ids = [...a.favourites, ...b.favourites].map((e) => e.id);
  const diet = [...new Set([...a.prefs.diet, ...b.prefs.diet])];
  const dietTags = diet.map((d) => DIET_TAG[d]).filter((t): t is string => !!t);
  const sober = !a.prefs.drinks || !b.prefs.drinks;
  const budget = Math.min(a.prefs.budget, b.prefs.budget);
  const used = new Set<string>();
  const out: Candidate[] = [];
  for (const s of SLOTS) {
    const tags = s.slot === "drinks" && sober ? SOBER_TAGS : s.tags;
    const food = s.food || (s.slot === "drinks" && sober);
    // Food needs are hard rules: each category is asked for together with every diet tag (a cafe AND halal).
    const lists = food && dietTags.length
      ? await Promise.all(tags.map((t) => placesFor(ids, city, [t, ...dietTags], 10, true)))
      : [await placesFor(ids, city, tags, 25)];
    const seen = new Set<string>();
    const pool = lists.flat().filter((p) => !seen.has(p.id) && !!seen.add(p.id));
    const ok = pool
      .map((p, rank) => ({ p, rank, f: fit(p, [a, b]) }))
      .filter(({ p }) => !used.has(p.id) && !p.flags.length && !NOT_A_DATE.test([p.name, ...p.kinds].join(" ")))
      .filter(({ p }) => !(food && AREA.test(p.name.trim())))
      .filter(({ p }) => !p.price || p.price <= budget)
      .filter(({ p }) => !(sober && /bar$|pub|cocktail|wine|brewery/i.test(p.kinds.join(" "))))
      // For a meal, a place with Qloo menu highlights gives the twins something real to order.
      .sort((x, y) => y.f.score + (food && y.p.menu.length ? 0.5 : 0) - x.f.score - (food && x.p.menu.length ? 0.5 : 0) || x.rank - y.rank);
    for (const { p, f } of ok.slice(0, PER_SLOT)) {
      used.add(p.id);
      const rules = [
        ...(food ? diet.map((d) => (DIET_TAG[d] ? `Qloo tags it ${DIETS[d].toLowerCase()}: confirm before booking` : `${DIETS[d].toLowerCase()}: check the menu`)) : []),
        ...(p.price ? [`price ${"$".repeat(p.price)}, within budget`] : []),
        ...(s.slot === "drinks" && sober ? ["no alcohol needed"] : []),
      ];
      out.push({ ...p, slot: s.slot, fits: [...rules, ...f.fits], links: f.links });
    }
  }
  return out;
}

const facts = (p: Person) => `${p.name}${p.age ? `, ${p.age}` : ""}${p.work ? `, ${p.work}` : ""}`;
const RULES =
  "You voice the AI twins of two real people who matched and are rehearsing their first date. Each twin speaks only from its numbered " +
  "profile: never invent a job, a past or a family. Mention food or drinks only from the place's features. Talk like real people on a " +
  "first date: short lines, curiosity, opinions, a little awkwardness. React to the place: what it looks, sounds and feels like. Let it go " +
  "well or badly as these two would, given who they are. Never mention being an AI.";

export const ACTS = ["arrive", "sit", "walk", "look", "order", "eat", "drink", "laugh", "leave"] as const;
export type Act = (typeof ACTS)[number];
export type Line = { who: "a" | "b"; say: string; min: number; act: Act }; // act: what they are doing, for the scene
export type Moment = {
  line: number; // index into lines
  who: "a" | "b";
  because: string; // the profile item, exactly as defined (e.g. "loves Spirited Away (film)")
  feature: string; // the place's real feature it met (a Qloo tag, kind or menu item)
  effect: 1 | -1;
};
export type Rehearsal = {
  venue: string | null; // candidate id, or null for the plain-cafe baseline
  lines: Line[];
  aAfter: number; // 0-100: how much each now wants a second date
  bAfter: number;
  moments: Moment[];
  order: string[];
  features: string[]; // everything Qloo told the twins about the place, in the order the prompt numbered them (F1...)
};

const clamp = (n: unknown, lo = 0, hi = 100, d = 50) => Math.max(lo, Math.min(hi, Math.round(Number(n) || d)));

export async function rehearse(a: Person, b: Person, place: Candidate | null): Promise<Rehearsal> {
  const slot = SLOTS.find((s) => s.slot === place?.slot);
  const aItems = profileItems(a), bItems = profileItems(b);
  const features = place
    ? [...new Set([...[...place.kinds, ...place.vibe].filter((k) => k !== "Place"), ...place.menu.map((m) => `menu: ${m}`)])].slice(0, 30)
    : ["plain cafe", "nothing special", "coffee"];
  const list = (xs: string[], tag: string) => xs.map((x, i) => `[${tag}${i + 1}] ${x}`).join("\n");
  const where = place ? `${slot?.label ?? "A date"} at ${place.name}${place.address ? ` (${place.address})` : ""}.` : "Coffee at a plain, quiet cafe with nothing special about it.";
  const r = await json<Record<string, unknown>>(
    `${where}\n\nTWIN A: ${facts(a)}. Profile:\n${list(aItems, "A")}\n\nTWIN B: ${facts(b)}. Profile:\n${list(bItems, "B")}\n\n` +
      `THE PLACE, as Qloo describes it:\n${list(features, "F")}\n\n` +
      "Write the date as 10 short alternating lines, A first, each with the minute into the date it is said (0-90) and what " +
      `they are doing then (one of: ${ACTS.join(", ")}). Then how much each ` +
      "now wants a second date, from 0 (not at all) to 100 (can't wait), using the whole scale honestly. Then the moments that moved " +
      "either of them: for each, the line number (1-10), whose feeling changed, the profile item that explains it (its id, like A3 or " +
      "B1), the place feature it met (its id, like F2), and whether it drew them closer (1) or pushed them apart (-1). Only list a " +
      "moment if that line really shows it. Finally, what they had there (menu features only).",
    `{"lines": [{"who": "a" or "b", "say": "...", "min": 0-90, "act": "sit"}], "aAfter": 0-100, "bAfter": 0-100, ` +
      `"moments": [{"line": 1-10, "who": "a" or "b", "because": "A3", "feature": "F2", "effect": 1 or -1}], "order": ["F7"]}`,
    ["lines", "aAfter", "bAfter"],
    RULES,
  );
  const lines: Line[] = (Array.isArray(r.lines) ? (r.lines as Record<string, unknown>[]) : [])
    .filter((l) => typeof l?.say === "string")
    .map((l) => ({
      who: (l.who === "b" ? "b" : "a") as "a" | "b",
      say: String(l.say).trim(),
      min: clamp(l.min, 0, 180, 0),
      act: (ACTS as readonly string[]).includes(String(l.act)) ? (l.act as Act) : "sit",
    }))
    .slice(0, 12);
  // Every moment must point at a real line, a real profile item of that twin, and a real feature of the place.
  const item = (id: unknown, who: "a" | "b") => {
    const m = /^([AB])(\d+)$/i.exec(String(id).trim());
    if (!m || m[1].toLowerCase() !== who) return null;
    return (who === "a" ? aItems : bItems)[Number(m[2]) - 1] ?? null;
  };
  const feat = (id: unknown) => {
    const m = /^F(\d+)$/i.exec(String(id).trim());
    return m ? (features[Number(m[1]) - 1] ?? null) : null;
  };
  const moments: Moment[] = (Array.isArray(r.moments) ? (r.moments as Record<string, unknown>[]) : [])
    .map((m) => {
      const who = (m.who === "b" ? "b" : "a") as "a" | "b";
      const line = Math.round(Number(m.line)) - 1;
      const because = item(m.because, who), feature = feat(m.feature);
      if (!lines[line] || !because || !feature) return null;
      // A moment credited to a favourite must actually bring it up.
      const fav = /^loves (.+) \((film|music|TV show|book)\)$/.exec(because);
      if (fav && ![fav[1].toLowerCase(), ...words(fav[1])].some((w) => lines[line].say.toLowerCase().includes(w))) return null;
      return { line, who, because, feature, effect: (Number(m.effect) < 0 ? -1 : 1) as 1 | -1 };
    })
    .filter((m): m is Moment => !!m)
    .slice(0, 6);
  const order = (Array.isArray(r.order) ? r.order : []).map(feat).filter((f): f is string => !!f && f.startsWith("menu: ")).map((f) => f.slice(6));
  return { venue: place?.id ?? null, lines, aAfter: clamp(r.aAfter), bAfter: clamp(r.bAfter), moments, order: [...new Set(order)].slice(0, 3), features };
}
