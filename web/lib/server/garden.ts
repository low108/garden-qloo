// The people of the Garden: the visitor's match can be one of these demo twins, whose tastes are real Qloo entities.
import "server-only";
import { type Entity, type EntityType, search } from "./qloo";
import { DEFAULT_PREFS, type Prefs } from "../profile";

export type Favourite = { query: string; type: EntityType };
export type Person = {
  id: string;
  name: string;
  gender: "f" | "m";
  age: number;
  work: string;
  about: string[]; // first-person facts, the only things a twin may say about its own life
  favourites: Entity[];
  prefs: Prefs;
};

// Demo twins: fictional people, labelled as such in the app. Their favourites are real works, resolved
// through Qloo at runtime, so everything they love is a real entity in the taste graph.
const CAST: (Omit<Person, "favourites" | "prefs"> & { likes: Favourite[]; prefs?: Partial<Prefs> })[] = [
  { id: "mei", name: "Mei", gender: "f", age: 28, work: "UX designer",
    about: ["I sketch strangers on the MRT.", "I want someone who notices small things."],
    likes: [{ query: "Spirited Away", type: "movie" }, { query: "Laufey", type: "artist" }, { query: "Normal People", type: "tv_show" }], prefs: { energy: "introvert", nerves: "bit", style: "do", novelty: "bit", budget: 2 } },
  { id: "priya", name: "Priya", gender: "f", age: 30, work: "Oncology nurse",
    about: ["I work night shifts and treasure slow Sunday mornings.", "Kindness matters more to me than charm."],
    likes: [{ query: "Pride & Prejudice 2005", type: "movie" }, { query: "Arijit Singh", type: "artist" }, { query: "The Midnight Library", type: "book" }], prefs: { energy: "between", nerves: "calm", style: "talk", novelty: "familiar", diet: ["vegetarian"], drinks: false, budget: 2 } },
  { id: "sofia", name: "Sofia", gender: "f", age: 26, work: "Product manager",
    about: ["I plan everything, except my weekends.", "I want someone who can make me laugh at a bad day."],
    likes: [{ query: "La La Land", type: "movie" }, { query: "Taylor Swift", type: "artist" }, { query: "Ted Lasso", type: "tv_show" }], prefs: { energy: "extravert", nerves: "calm", style: "either", novelty: "surprise", budget: 3 } },
  { id: "hana", name: "Hana", gender: "f", age: 31, work: "Architect",
    about: ["I photograph old shophouses before they are torn down.", "I like quiet people with strong opinions."],
    likes: [{ query: "Lost in Translation", type: "movie" }, { query: "Radiohead", type: "artist" }, { query: "Norwegian Wood", type: "book" }], prefs: { energy: "introvert", nerves: "calm", style: "talk", novelty: "bit", budget: 3 } },
  { id: "daniel", name: "Daniel", gender: "m", age: 29, work: "Software engineer",
    about: ["I build tiny robots on weekends.", "I want someone curious enough to argue about the universe."],
    likes: [{ query: "Interstellar", type: "movie" }, { query: "Coldplay", type: "artist" }, { query: "Project Hail Mary", type: "book" }], prefs: { energy: "between", nerves: "bit", style: "do", novelty: "surprise", budget: 3 } },
  { id: "arjun", name: "Arjun", gender: "m", age: 32, work: "Chef",
    about: ["I cook for my whole street on Deepavali.", "I want someone who eats slowly and laughs loudly."],
    likes: [{ query: "Ratatouille", type: "movie" }, { query: "A. R. Rahman", type: "artist" }, { query: "The Bear", type: "tv_show" }], prefs: { energy: "extravert", nerves: "calm", style: "either", novelty: "surprise", budget: 3 } },
  { id: "weijie", name: "Wei Jie", gender: "m", age: 27, work: "Finance analyst",
    about: ["I run the same 10K loop every morning.", "I want someone who keeps me honest."],
    likes: [{ query: "John Wick", type: "movie" }, { query: "Jay Chou", type: "artist" }, { query: "Breaking Bad", type: "tv_show" }], prefs: { energy: "between", nerves: "calm", style: "do", novelty: "familiar", budget: 4 } },
  { id: "luca", name: "Luca", gender: "m", age: 30, work: "Photographer",
    about: ["I moved here for a job and stayed for the hawker food.", "I want someone who says yes to small adventures."],
    likes: [{ query: "Before Sunrise", type: "movie" }, { query: "Bon Iver", type: "artist" }, { query: "Fleabag", type: "tv_show" }], prefs: { energy: "introvert", nerves: "bit", style: "do", novelty: "surprise", budget: 2 } },
];

async function resolve(f: Favourite): Promise<Entity | null> {
  const hits = await search(f.query, f.type, 3);
  return hits[0] ?? null;
}

// Each demo twin's favourites are resolved through Qloo once per server instance, then remembered.
const resolved = new Map<string, Promise<Person>>();
function member(c: (typeof CAST)[number]): Promise<Person> {
  if (!resolved.has(c.id)) {
    const { likes, prefs, ...p } = c;
    resolved.set(
      c.id,
      Promise.all(likes.map(resolve))
        .then((favs) => ({ ...p, prefs: { ...DEFAULT_PREFS, ...prefs }, favourites: favs.filter((e): e is Entity => !!e) }))
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
