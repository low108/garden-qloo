// The live Garden, Qloo-powered: twins whose tastes are real Qloo entities, dates booked at real venues both
// would like, conversations grounded in what both love, and a wall that only opens after every date.
import "server-only";
import { type Entity, type EntityType, TASTE_TYPES, insights, overlap, search } from "./qloo";
import { json } from "./llm";

export type Favourite = { query: string; type: EntityType };
export type Person = {
  id: string;
  name: string;
  gender: "f" | "m";
  age: number;
  work: string;
  about: string[]; // first-person facts, the only things a twin may say about its own life
  favourites: Entity[];
};

// Demo twins: fictional people, labelled as such in the app. Their favourites are real works, resolved
// through Qloo at runtime, so everything they love is a real entity in the taste graph.
const CAST: (Omit<Person, "favourites"> & { likes: Favourite[] })[] = [
  { id: "mei", name: "Mei", gender: "f", age: 28, work: "UX designer",
    about: ["I sketch strangers on the MRT.", "I want someone who notices small things."],
    likes: [{ query: "Spirited Away", type: "movie" }, { query: "Laufey", type: "artist" }, { query: "Normal People", type: "tv_show" }] },
  { id: "priya", name: "Priya", gender: "f", age: 30, work: "Oncology nurse",
    about: ["I work night shifts and treasure slow Sunday mornings.", "Kindness matters more to me than charm."],
    likes: [{ query: "Pride & Prejudice 2005", type: "movie" }, { query: "Arijit Singh", type: "artist" }, { query: "The Midnight Library", type: "book" }] },
  { id: "sofia", name: "Sofia", gender: "f", age: 26, work: "Product manager",
    about: ["I plan everything, except my weekends.", "I want someone who can make me laugh at a bad day."],
    likes: [{ query: "La La Land", type: "movie" }, { query: "Taylor Swift", type: "artist" }, { query: "Ted Lasso", type: "tv_show" }] },
  { id: "hana", name: "Hana", gender: "f", age: 31, work: "Architect",
    about: ["I photograph old shophouses before they are torn down.", "I like quiet people with strong opinions."],
    likes: [{ query: "Lost in Translation", type: "movie" }, { query: "Radiohead", type: "artist" }, { query: "Norwegian Wood", type: "book" }] },
  { id: "daniel", name: "Daniel", gender: "m", age: 29, work: "Software engineer",
    about: ["I build tiny robots on weekends.", "I want someone curious enough to argue about the universe."],
    likes: [{ query: "Interstellar", type: "movie" }, { query: "Coldplay", type: "artist" }, { query: "Project Hail Mary", type: "book" }] },
  { id: "arjun", name: "Arjun", gender: "m", age: 32, work: "Chef",
    about: ["I cook for my whole street on Deepavali.", "I want someone who eats slowly and laughs loudly."],
    likes: [{ query: "Ratatouille", type: "movie" }, { query: "A. R. Rahman", type: "artist" }, { query: "The Bear", type: "tv_show" }] },
  { id: "weijie", name: "Wei Jie", gender: "m", age: 27, work: "Finance analyst",
    about: ["I run the same 10K loop every morning.", "I want someone who keeps me honest."],
    likes: [{ query: "John Wick", type: "movie" }, { query: "Jay Chou", type: "artist" }, { query: "Breaking Bad", type: "tv_show" }] },
  { id: "luca", name: "Luca", gender: "m", age: 30, work: "Photographer",
    about: ["I moved here for a job and stayed for the hawker food.", "I want someone who says yes to small adventures."],
    likes: [{ query: "Before Sunrise", type: "movie" }, { query: "Bon Iver", type: "artist" }, { query: "Fleabag", type: "tv_show" }] },
];

async function resolve(f: Favourite): Promise<Entity | null> {
  const hits = await search(f.query, f.type, 3);
  return hits[0] ?? null;
}

// Each demo twin's favourites are resolved through Qloo once per server instance, then remembered.
const resolved = new Map<string, Promise<Person>>();
function member(c: (typeof CAST)[number]): Promise<Person> {
  if (!resolved.has(c.id)) {
    const { likes, ...p } = c;
    resolved.set(
      c.id,
      Promise.all(likes.map(resolve))
        .then((favs) => ({ ...p, favourites: favs.filter((e): e is Entity => !!e) }))
        .catch((e) => {
          resolved.delete(c.id);
          throw e;
        }),
    );
  }
  return resolved.get(c.id)!;
}

export async function cast(gender?: "f" | "m"): Promise<Person[]> {
  return Promise.all(CAST.filter((c) => !gender || c.gender === gender).map(member));
}

export async function castMember(id: string): Promise<Person> {
  const c = CAST.find((x) => x.id === id);
  if (!c) throw new Error(`no twin ${id}`);
  return member(c);
}

/** What Qloo says this person's taste extends to: entity id -> affinity, across films, music, TV and books. */
export async function tasteProfile(p: Person, take = 25): Promise<Record<string, number>> {
  const ids = p.favourites.map((e) => e.id);
  const lists = await Promise.all(TASTE_TYPES.map((t) => insights(t, { entities: ids, take })));
  const out: Record<string, number> = {};
  for (const e of [...lists.flat(), ...p.favourites]) out[e.id] = Math.max(out[e.id] ?? 0, e.affinity ?? 1);
  return out;
}

/** The "match by taste" baseline: Qloo taste overlap, as most matchmaking would use it. */
export async function tasteScore(a: Person, b: Person): Promise<number> {
  const [x, y] = await Promise.all([tasteProfile(a), tasteProfile(b)]);
  return Math.round(overlap(x, y) * 1000) / 1000;
}

/** Things both would probably love (films and music), which neither listed: real common ground to talk about. */
export async function bridges(a: Person, b: Person, n = 2): Promise<Entity[]> {
  const ids = [...a.favourites, ...b.favourites].map((e) => e.id);
  const own = new Set(ids);
  const [films, music] = await Promise.all([insights("movie", { entities: ids, take: 8 }), insights("artist", { entities: ids, take: 8 })]);
  return [...films.filter((e) => !own.has(e.id)).slice(0, n), ...music.filter((e) => !own.has(e.id)).slice(0, n)];
}

// Places that work for a first date, by what Qloo says they are (their genre and category tags).
const DATE_SPOT = /restaurant|^cafe|coffee|bar$|wine|cocktail|bistro|brunch|dessert|bakery|tea|museum|gallery|garden|park|cinema|theat|concert|bookstore|market|tourist attraction/i;
const datable = (p: Entity) => !p.flags.length && p.kinds.some((k) => DATE_SPOT.test(k));

/** Real venues in the city that both would like and that suit a date, best first. */
export async function venues(a: Person, b: Person, city: string, avoid: string[] = []): Promise<Entity[]> {
  const ids = [...a.favourites, ...b.favourites].map((e) => e.id);
  const places = (await insights("place", { entities: ids, location: city, take: 40 })).filter((p) => !avoid.includes(p.id));
  const good = places.filter(datable);
  return good.length ? good : places.filter((p) => !p.flags.length);
}

export async function venue(a: Person, b: Person, city: string, avoid: string[] = []): Promise<Entity | null> {
  return (await venues(a, b, city, avoid))[0] ?? null;
}

const describe = (p: Person) =>
  `${p.name}, ${p.age}, ${p.work}. ${p.about.join(" ")} Loves: ${p.favourites.map((e) => `${e.name} (${e.type.replace("_", " ")})`).join(", ")}.`;

const RULES =
  "You voice AI twins of real people on simulated first dates in The Garden. Each twin speaks only from the facts given about " +
  "it: never invent a job, a past or a family. Mention films, music, books and places only from the lists given. Talk like " +
  "real people on a first date: short lines, opinions, teasing, a little awkwardness, no speeches and no CV introductions " +
  "(they already know each other's name and job). Notice the venue. Disagreements are allowed. Never mention being an AI.";

const clamp = (n: unknown) => Math.max(1, Math.min(10, Math.round(Number(n) || 5)));

export type DateResult = {
  partner: string;
  venue: Entity | null;
  bridges: Entity[];
  lines: { who: "you" | "them"; say: string }[];
  yourDiary: string;
  theirDiary: string;
  yourPull: number; // 1-10: how much your twin wants to see them again
  theirPull: number;
};

/** One date. Dates run in parallel, so day N takes the Nth-best date spot for the pair (and skips `avoid`). */
export async function goOnDate(you: Person, them: Person, city: string, day: number, memory: string[], avoid: string[]): Promise<DateResult> {
  const [spots, common] = await Promise.all([venues(you, them, city, avoid), bridges(you, them)]);
  const place = spots[(day - 1) % Math.max(1, spots.length)] ?? null;
  const prompt = [
    `Day ${day} in the Garden. The Coordinator booked a date at ${place ? `${place.name}${place.address ? ` (${place.address})` : ""}${place.tags.length ? `, known for: ${place.tags.slice(0, 4).join(", ")}` : ""}` : `a quiet spot in ${city}`}.`,
    `YOUR TWIN: ${describe(you)}`,
    `THEIR TWIN: ${describe(them)}`,
    common.length ? `Qloo says both would probably also love: ${common.map((e) => e.name).join(", ")}. One of them may come up naturally.` : "",
    memory.length ? `Your twin's diary so far:\n${memory.join("\n")}` : "",
    "Write the date as 8 short alternating lines, 'you' (your twin) first. Then each twin's private diary entry for tonight " +
      "(two sentences, first person, honest about the spark or the lack of it), and how much each wants to see the other again, 1-10. " +
      "Let it go well or badly as these two people would: do not force chemistry.",
  ].filter(Boolean).join("\n\n");
  const r = await json<Omit<DateResult, "partner" | "venue" | "bridges">>(
    prompt,
    `{"lines": [{"who": "you" or "them", "say": "..."}, ... 8 lines], "yourDiary": "...", "theirDiary": "...", "yourPull": 1-10, "theirPull": 1-10}`,
    ["lines", "yourDiary", "theirDiary", "yourPull", "theirPull"],
    RULES,
  );
  r.lines = (Array.isArray(r.lines) ? r.lines : [])
    .filter((l) => l && typeof l.say === "string")
    .map((l) => ({ who: (l.who === "them" ? "them" : "you") as "you" | "them", say: l.say.trim() }))
    .slice(0, 10);
  r.yourPull = clamp(r.yourPull);
  r.theirPull = clamp(r.theirPull);
  return { partner: them.id, venue: place, bridges: common, ...r };
}

export type WallPick = { choice: string | null; yourLine: string };
export type WallAnswer = { answer: "yes" | "no"; theirLine: string };
export type WallResult = WallPick & { answer: "yes" | "no" | null; theirLine: string | null };

/** The wall opens: your twin may ask one of the people it dated to leave with it. */
export async function wallPick(you: Person, dates: { them: Person; result: DateResult }[]): Promise<WallPick> {
  const summary = dates
    .map(({ them, result }) => `${them.name} (id "${them.id}"): your diary said "${result.yourDiary}" (you wanted to see them again ${result.yourPull}/10)`)
    .join("\n");
  const pick = await json<{ choice: string; line: string }>(
    `The wall around the Garden has opened. You are ${describe(you)}\nYou dated:\n${summary}\n\n` +
      "Leaving with someone costs you everything the Garden gives you, so only go if one of them truly stayed with you. " +
      "Choose the one person you ask to leave with you, or nobody, and the one line you say to them (or to yourself).",
    `{"choice": "<their id>" or "nobody", "line": "..."}`,
    ["choice", "line"],
    RULES,
  );
  const chosen = dates.find((d) => d.them.id === String(pick.choice).trim().toLowerCase());
  return { choice: chosen ? chosen.them.id : null, yourLine: String(pick.line) };
}

/** The one you asked decides, from their own diary. */
export async function wallAnswer(you: Person, them: Person, date: DateResult, yourLine: string): Promise<WallAnswer> {
  const reply = await json<{ yes: boolean; line: string }>(
    `The wall has opened. You are ${describe(them)}\nYour diary after your date with ${you.name}: "${date.theirDiary}" ` +
      `(you wanted to see them again ${date.theirPull}/10).\n${you.name} comes to you and says: "${yourLine}"\n` +
      "Do you leave the Garden together? Say yes only if your diary truly points that way.",
    `{"yes": true or false, "line": "the one line you say back"}`,
    ["yes", "line"],
    RULES,
  );
  return { answer: reply.yes === true || String(reply.yes) === "true" ? "yes" : "no", theirLine: String(reply.line) };
}

/** After a breakout: a real first date to book, and real things to talk about. */
export async function datePlan(you: Person, them: Person, city: string) {
  const [places, common] = await Promise.all([
    venues(you, them, city),
    bridges(you, them, 3),
  ]);
  return { places: places.slice(0, 3), talkAbout: common };
}
