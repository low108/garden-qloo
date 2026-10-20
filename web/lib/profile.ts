// What about a person shapes a first date, beyond what they love. Shared by the form, the venue ranking, the
// rehearsal prompt and the proof checks, so every claim about a person points back to an item defined here.
//
// Why these: introverts tire faster in noise and crowds (arousal research, Eysenck); nervous daters do better
// side by side with a built-in topic than face to face; doing something new together raises closeness
// (Aron's self-expansion studies); food needs and alcohol are deal-breakers, not preferences; and a budget
// mismatch makes people uneasy.

export type Prefs = {
  energy: "introvert" | "between" | "extravert";
  nerves: "calm" | "bit" | "very";
  style: "talk" | "do" | "either";
  novelty: "familiar" | "bit" | "surprise";
  diet: ("halal" | "vegetarian" | "vegan" | "no_pork")[];
  drinks: boolean;
  budget: 1 | 2 | 3 | 4;
};

export const DEFAULT_PREFS: Prefs = { energy: "between", nerves: "calm", style: "either", novelty: "bit", diet: [], drinks: true, budget: 3 };

/** Each question, its options and how each option reads in a profile. */
export const QUESTIONS = {
  energy: { label: "Social energy", options: { introvert: "Introvert", between: "In between", extravert: "Extravert" } },
  nerves: { label: "First-date nerves", options: { calm: "Calm", bit: "A bit", very: "Very" } },
  style: { label: "Date style", options: { talk: "Talk face to face", do: "Do something together", either: "Either" } },
  novelty: { label: "New things", options: { familiar: "Familiar", bit: "A little new", surprise: "Surprise me" } },
} as const;
export const DIETS = { halal: "Halal", vegetarian: "Vegetarian", vegan: "Vegan", no_pork: "No pork" } as const;
export const BUDGETS = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" } as const;

/** The person's profile as numbered items a rehearsal may cite as the reason for a moment. */
export function profileItems(p: { favourites: { name: string; type: string }[]; prefs?: Prefs; about: string[] }): string[] {
  const kind = (t: string) => ({ movie: "film", artist: "music", tv_show: "TV show", book: "book" })[t] ?? t;
  const items = p.favourites.map((f) => `loves ${f.name} (${kind(f.type)})`);
  const x = p.prefs;
  if (x) {
    items.push(
      { introvert: "is an introvert: tires in noise and crowds", between: "is in between introvert and extravert", extravert: "is an extravert: enjoys buzz and people" }[x.energy],
      { calm: "is calm on first dates", bit: "gets a bit nervous on first dates", very: "gets very nervous on first dates" }[x.nerves],
      { talk: "prefers talking face to face", do: "prefers doing something side by side", either: "is happy talking or doing something" }[x.style],
      { familiar: "prefers familiar places and food", bit: "likes a little novelty", surprise: "loves trying something new" }[x.novelty],
      x.drinks ? "drinks alcohol" : "does not drink alcohol",
      `budget: ${BUDGETS[x.budget]} (price level up to ${x.budget} of 4)`,
      ...x.diet.map((d) => `eats ${DIETS[d].toLowerCase()} only`),
    );
  }
  items.push(...p.about.map((a) => `said: "${a}"`));
  return items;
}

export function parsePrefs(raw: unknown): Prefs {
  const v = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(x: unknown, ok: readonly T[], d: T) => (ok.includes(x as T) ? (x as T) : d);
  return {
    energy: pick(v.energy, ["introvert", "between", "extravert"], DEFAULT_PREFS.energy),
    nerves: pick(v.nerves, ["calm", "bit", "very"], DEFAULT_PREFS.nerves),
    style: pick(v.style, ["talk", "do", "either"], DEFAULT_PREFS.style),
    novelty: pick(v.novelty, ["familiar", "bit", "surprise"], DEFAULT_PREFS.novelty),
    diet: (Array.isArray(v.diet) ? v.diet : []).filter((d): d is Prefs["diet"][number] => d in DIETS).slice(0, 4),
    drinks: v.drinks !== false,
    budget: ([1, 2, 3, 4].includes(Number(v.budget)) ? Number(v.budget) : DEFAULT_PREFS.budget) as Prefs["budget"],
  };
}
