"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { Person } from "@/lib/server/garden";
import type { Candidate, Moment, Rehearsal } from "@/lib/server/planner";
import type { Entity, EntityType } from "@/lib/server/qloo";
import { BUDGETS, DEFAULT_PREFS, DIETS, type Prefs, QUESTIONS } from "@/lib/profile";
import "../ui.css";
import "./plan.css";
import Room from "./Room";

const PARALLEL = 6; // rehearsals in flight at once
const TOP = 3; // restaurants shown in the result
const STEPS = 5; // the setup screens
const TYPES: { type: EntityType; label: string; hint: string }[] = [
  { type: "movie", label: "Films", hint: "e.g. Spirited Away" },
  { type: "artist", label: "Music", hint: "e.g. Norah Jones" },
  { type: "tv_show", label: "TV", hint: "e.g. Gilmore Girls" },
  { type: "book", label: "Books", hint: "e.g. Norwegian Wood" },
];
const CITIES = ["Singapore", "Kuala Lumpur", "New York", "London", "Tokyo", "Sydney"];

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? `${path} returned ${r.status}`);
  return d as T;
}

/** Run jobs with at most `n` in flight, reporting each result as it lands. */
async function pool<T, R>(items: T[], n: number, work: (t: T) => Promise<R>, done: (t: T, r: R) => void) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        done(item, await work(item));
      }
    }),
  );
}

const kindOf = (t: EntityType) => ({ movie: "film", artist: "music", tv_show: "TV", book: "book" })[t as string] ?? t;
const score = (r: Rehearsal) => (r.aAfter + r.bAfter) / 2;
const maps = (p: Entity, city: string) => `https://www.google.com/maps/search/${encodeURIComponent(`${p.name} ${p.address ?? city}`)}`;

function Fav({ e, onRemove }: { e: Entity; onRemove?: () => void }) {
  return (
    <span className="fav">
      {/* eslint-disable-next-line @next/next/no-img-element -- Qloo's image URLs, shown small */}
      {e.image ? <img src={e.image} alt="" /> : <span className="fav-dot" />}
      <span>
        {e.name}
        <small>{kindOf(e.type)}</small>
      </span>
      {onRemove && (
        <button className="x" onClick={onRemove} aria-label={`Remove ${e.name}`}>
          ×
        </button>
      )}
    </span>
  );
}

function Picker({ onPick, picked }: { onPick: (e: Entity) => void; picked: Entity[] }) {
  const [type, setType] = useState<EntityType>("movie");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Entity[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    let stale = false;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (!stale) setHits(Array.isArray(d) ? d : []);
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, type]);
  const ids = new Set(picked.map((p) => p.id));
  return (
    <div className="picker">
      <div className="tabs" role="tablist">
        {TYPES.map((t) => (
          <button key={t.type} role="tab" aria-selected={type === t.type} className={type === t.type ? "on" : ""} onClick={() => setType(t.type)}>
            {t.label}
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={TYPES.find((t) => t.type === type)!.hint} aria-label="Search Qloo" />
      <ul className="hits">
        {hits.filter((h) => !ids.has(h.id)).map((h) => (
          <li key={h.id}>
            <button onClick={() => (onPick(h), setQ(""), setHits([]))}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Qloo's image URLs, shown small */}
              {h.image ? <img src={h.image} alt="" /> : <span className="fav-dot" />}
              <span>
                <b>{h.name}</b>
                {h.year ? ` (${h.year})` : ""}
                <small>{h.tags.slice(0, 3).join(" · ")}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The quick questions: energy, nerves, date style, novelty, food needs, alcohol, budget. */
function PrefsForm({ prefs, set }: { prefs: Prefs; set: (p: Prefs) => void }) {
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="prefs">
      {(Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]).map((k) => (
        <div key={k} className="q">
          <span>{QUESTIONS[k].label}</span>
          <div>
            {Object.entries(QUESTIONS[k].options).map(([v, label]) =>
              chip(prefs[k] === v, label, () => set({ ...prefs, [k]: v } as Prefs)),
            )}
          </div>
        </div>
      ))}
      <div className="q">
        <span>Food needs</span>
        <div>
          {(Object.entries(DIETS) as [Prefs["diet"][number], string][]).map(([d, label]) =>
            chip(prefs.diet.includes(d), label, () =>
              set({ ...prefs, diet: prefs.diet.includes(d) ? prefs.diet.filter((x) => x !== d) : [...prefs.diet, d] }),
            ),
          )}
        </div>
      </div>
      <div className="q">
        <span>Drinks alcohol</span>
        <div>
          {chip(prefs.drinks, "Yes", () => set({ ...prefs, drinks: true }))}
          {chip(!prefs.drinks, "No", () => set({ ...prefs, drinks: false }))}
        </div>
      </div>
      <div className="q">
        <span>Budget</span>
        <div>
          {([1, 2, 3, 4] as const).map((b) => chip(prefs.budget === b, BUDGETS[b], () => set({ ...prefs, budget: b })))}
        </div>
      </div>
    </div>
  );
}

const prefsLine = (p: Prefs) =>
  [
    QUESTIONS.energy.options[p.energy],
    p.nerves === "calm" ? "calm on dates" : `${QUESTIONS.nerves.options[p.nerves].toLowerCase()} nervous`,
    QUESTIONS.style.options[p.style].toLowerCase(),
    ...p.diet.map((d) => DIETS[d]),
    p.drinks ? "" : "no alcohol",
    BUDGETS[p.budget],
  ]
    .filter(Boolean)
    .join(" · ");

/** Name, two facts, favourites and the quick questions, for one person. */
function PersonForm(p: {
  title: string;
  whose: string;
  name: string; setName: (s: string) => void;
  about: string; setAbout: (s: string) => void;
  favs: Entity[]; setFavs: (f: Entity[]) => void;
  prefs: Prefs; setPrefs: (p: Prefs) => void;
  placeholder: [string, string];
}) {
  return (
    <>
      {p.title && <h3>{p.title}</h3>}
      <div className="row">
        <label>Name<input value={p.name} onChange={(e) => p.setName(e.target.value)} maxLength={40} placeholder={p.placeholder[0]} /></label>
        <label className="grow">Two things about {p.whose}<input value={p.about} onChange={(e) => p.setAbout(e.target.value)} maxLength={300} placeholder={p.placeholder[1]} /></label>
      </div>
      <p className="meta small">At least 3 favourites: films, music, TV or books.</p>
      <Picker picked={p.favs} onPick={(e) => p.setFavs(p.favs.length < 8 ? [...p.favs, e] : p.favs)} />
      <div className="favs">{p.favs.map((f) => <Fav key={f.id} e={f} onRemove={() => p.setFavs(p.favs.filter((x) => x.id !== f.id))} />)}</div>
      <PrefsForm prefs={p.prefs} set={p.setPrefs} />
    </>
  );
}

const asPerson = (id: string, name: string, about: string, favs: Entity[], prefs: Prefs) => ({
  id, name: name.trim() || (id === "you" ? "You" : "Your match"), gender: "f" as const, age: 0, work: "",
  about: about.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 3), favourites: favs, prefs,
});

/** One proof moment as a Hinge-style prompt card: when, the line, what about them met what about the place. */
function Proof({ m, r, names, onWatch }: { m: Moment; r: Rehearsal; names: [string, string]; onWatch: () => void }) {
  const line = r.lines[m.line];
  return (
    <li className={`prompt-card ${m.effect > 0 ? "up" : "down"}`}>
      <small className="eyebrow">{m.effect > 0 ? "The moment it clicked" : "Where it wobbled"} · minute {line?.min ?? "?"}</small>
      <p className="quote">{line?.say}</p>
      <div className="match-tags">
        <span className="tag who">{m.who === "a" ? names[0] : names[1]} {m.because}</span>
        <span className="x">×</span>
        <span className="tag qloo">Qloo: {m.feature.replace(/^menu: /, "on the menu: ")}</span>
      </div>
      <button className="play-btn" onClick={onWatch} aria-label={`Watch this moment, line ${m.line + 1}`}>▶</button>
    </li>
  );
}

function Transcript({ r, names }: { r: Rehearsal; names: [string, string] }) {
  const at = new Map(r.moments.map((m) => [m.line, m]));
  return (
    <ul className="chat">
      {r.lines.map((l, i) => {
        const m = at.get(i);
        return (
          <li key={i} className={`${l.who === "a" ? "you" : "them"} ${m ? (m.effect > 0 ? "proof up" : "proof down") : ""}`}>
            <small>
              {l.who === "a" ? names[0] : names[1]} · min {l.min}
              {m && ` · ${m.effect > 0 ? "▲" : "▼"} ${m.because} × ${m.feature.replace(/^menu: /, "")}`}
            </small>
            {l.say}
          </li>
        );
      })}
    </ul>
  );
}

export default function Plan() {
  const [stage, setStage] = useState<"input" | "rehearsing" | "done">("input");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [favs, setFavs] = useState<Entity[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [mode, setMode] = useState<"demo" | "custom">("demo");
  const [cast, setCast] = useState<Person[]>([]);
  const [pickId, setPickId] = useState<string>("");
  const [mName, setMName] = useState("");
  const [mAbout, setMAbout] = useState("");
  const [mFavs, setMFavs] = useState<Entity[]>([]);
  const [mPrefs, setMPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [city, setCity] = useState("Singapore");
  const [match, setMatch] = useState<Person | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [runs, setRuns] = useState<Rehearsal[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [watch, setWatch] = useState<{ id: string; line?: number; n: number } | null>(null); // the room in the big player
  const [row, setRow] = useState<string | null>(null);
  const [more, setMore] = useState<Set<string>>(new Set()); // restaurants with every proof moment shown
  const viewer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/cast").then((r) => r.json()).then((d) => Array.isArray(d) && setCast(d)).catch(() => {});
  }, []);

  const you = asPerson("you", name, about, favs, prefs);
  const matchBody = mode === "demo" ? { id: pickId } : { person: asPerson("match", mName, mAbout, mFavs, mPrefs) };
  const matchOk = mode === "demo" ? !!pickId : mFavs.length >= 3;
  const ready = favs.length >= 3 && matchOk;
  const stepOk = [true, favs.length >= 3, true, matchOk, true][step];

  async function rehearseDinner() {
    setStage("rehearsing");
    setError(null);
    setRuns([]);
    setCands([]);
    setWatch(null);
    setRow(null);
    try {
      setStatus(`Asking Qloo which restaurants in ${city} you two would both love…`);
      const c = await post<{ match: Person; candidates: Candidate[] }>("/api/candidates", { you, match: matchBody, city });
      setMatch(c.match);
      setCands(c.candidates);
      setStatus("");
      const got: Rehearsal[] = [];
      await pool([null, ...c.candidates], PARALLEL, (place) => post<Rehearsal>("/api/rehearse", { you, match: matchBody, place }), (_, r) => {
        got.push(r);
        setRuns([...got]);
      });
      setStatus("");
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("");
    }
  }

  const base = runs.find((r) => r.venue === null) ?? null;
  const baseline = base ? score(base) : 0;
  const of = (id: string) => runs.find((r) => r.venue === id) ?? null;
  const gain = (id: string) => {
    const r = of(id);
    return r && base ? score(r) - baseline : null;
  };
  const ranked = [...cands].filter((c) => of(c.id)).sort((a, b) => (gain(b.id) ?? -99) - (gain(a.id) ?? -99));
  const top = ranked.slice(0, TOP);
  const mname = match?.name ?? (mode === "demo" ? cast.find((c) => c.id === pickId)?.name : mName) ?? "your match";
  const names: [string, string] = [you.name, mname];
  const picked = cast.find((c) => c.id === pickId);
  const baseScores = base ? { a: base.aAfter, b: base.bAfter } : null;
  const open = (id: string, line?: number) => {
    setWatch((w) => ({ id, line, n: (w?.n ?? 0) + 1 }));
    setTimeout(() => viewer.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const watched = watch ? (watch.id === "cafe" ? null : cands.find((c) => c.id === watch.id) ?? null) : null;
  const watchedRun = watch ? (watch.id === "cafe" ? base : of(watch.id)) : null;

  return (
    <main className="try plan">
      <nav className="crumbs">
        <Link href="/">The Garden</Link>
      </nav>
      {(stage !== "input" || step === 0) && (
        <>
          <h1>{stage === "input" ? "Rehearse your first dinner" : `${you.name} & ${mname}`}</h1>
          <p className="lede">
            {stage === "input"
              ? "You matched. Qloo picks the restaurants you would both love, your AI twins have dinner at every one of them, and you get the three where they fell for each other most, with the exact moments that prove why."
              : `Dinner in ${city}. Your twins are eating at every restaurant Qloo picked for you both, plus a plain café to compare. Tap any room to watch.`}
          </p>
        </>
      )}

      {stage === "input" && (
        <section className="steps-card">
          <div className="progress" aria-hidden><span style={{ width: `${((step + 1) / STEPS) * 100}%` }} /></div>
          {step === 0 && (
            <>
              <h2 className="ask">What&apos;s your first name?</h2>
              <input className="big-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Mira" autoFocus />
              <h2 className="ask small-ask">Two things about you</h2>
              <p className="hint">Your twin says only what you tell it.</p>
              <textarea className="prompt-input" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} rows={3} placeholder="I collect vinyl. I want someone who cooks with me." />
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="ask">Pick three things you love</h2>
              <p className="hint">Films, music, TV or books. Qloo uses them to find restaurants you&apos;d both love.</p>
              <Picker picked={favs} onPick={(e) => setFavs(favs.length < 8 ? [...favs, e] : favs)} />
              <div className="favs">{favs.map((f) => <Fav key={f.id} e={f} onRemove={() => setFavs(favs.filter((x) => x.id !== f.id))} />)}</div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="ask">How are you on a first date?</h2>
              <p className="hint">These decide what Qloo may suggest, and how your twin feels in each room.</p>
              <PrefsForm prefs={prefs} set={setPrefs} />
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="ask">Who did you match with?</h2>
              <div className="tabs mode seg" role="tablist">
                <button role="tab" aria-selected={mode === "demo"} className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>A demo twin</button>
                <button role="tab" aria-selected={mode === "custom"} className={mode === "custom" ? "on" : ""} onClick={() => setMode("custom")}>Someone real</button>
              </div>
              {mode === "demo" ? (
                <div className="profiles">
                  {cast.map((p) => (
                    <article key={p.id} className={`profile-card ${pickId === p.id ? "picked" : ""}`}>
                      <header>
                        <h3>{p.name}</h3>
                        <small>{p.age} · {p.work}</small>
                      </header>
                      {p.about[1] && (
                        <div className="prompt">
                          <small>In their words</small>
                          <p>{p.about[1]}</p>
                        </div>
                      )}
                      <span className="favs small">{p.favourites.map((f) => <Fav key={f.id} e={f} />)}</span>
                      <small className="prefline">{prefsLine(p.prefs)}</small>
                      <button className="heart-btn" onClick={() => setPickId(p.id)} aria-pressed={pickId === p.id} aria-label={`Choose ${p.name}`}>♥</button>
                    </article>
                  ))}
                  {!cast.length && <p className="meta">Loading the demo twins from Qloo…</p>}
                </div>
              ) : (
                <PersonForm title="" whose="them" name={mName} setName={setMName} about={mAbout} setAbout={setMAbout} favs={mFavs} setFavs={setMFavs} prefs={mPrefs} setPrefs={setMPrefs} placeholder={["Arjun", "I cook for my whole street. I want someone who laughs loudly."]} />
              )}
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="ask">Where&apos;s dinner?</h2>
              <div className="chips-col">
                {CITIES.map((c) => (
                  <button key={c} className={`chip big ${city === c ? "on" : ""}`} aria-pressed={city === c} onClick={() => setCity(c)}>{c}</button>
                ))}
              </div>
              <p className="hint">
                {you.name} &amp; {mode === "demo" ? picked?.name ?? "your match" : mName || "your match"}: Qloo picks ten restaurants in {city} for both of
                you, your twins have dinner at every one, and you get the top three. Under a minute.
              </p>
            </>
          )}
          <footer className="step-nav">
            {step > 0 ? <button className="link" onClick={() => setStep(step - 1)}>Back</button> : <span />}
            {step < STEPS - 1 ? (
              <button className="next" disabled={!stepOk} onClick={() => setStep(step + 1)} aria-label="Next">→</button>
            ) : (
              <button className="go" disabled={!ready} onClick={rehearseDinner}>Rehearse our dinner</button>
            )}
          </footer>
        </section>
      )}

      {stage !== "input" && (
        <section className="card building-card">
                    {status && <p className="status">{status}</p>}
          <p className="meta small">
            {runs.length} of {cands.length + 1} dinners rehearsed{base ? ` · plain café: ${baseline.toFixed(0)}/100` : ""}
            {stage === "rehearsing" && cands.length > 0 && " · each room starts playing as soon as its dinner is done"}
          </p>
          {watch && (
            <div ref={viewer} className="viewer">
              <div className="viewer-head">
                <b>Watching: {watched?.name ?? "Plain café (baseline)"}</b>
                <button className="link" onClick={() => setWatch(null)}>close ×</button>
              </div>
              <Room key={`${watch.id}-${watch.n}`} r={watchedRun} place={watched} names={names} base={baseScores} startLine={watch.line} />
            </div>
          )}
          <div className="building">
            {[{ id: "cafe" } as const, ...cands].map((c) => {
              const isCafe = c.id === "cafe";
              const cand = isCafe ? null : (c as Candidate);
              const r = isCafe ? base : of(c.id);
              const g = isCafe ? null : gain(c.id);
              const rank = top.findIndex((t) => t.id === c.id);
              return (
                <div key={c.id} className={`floor-tile ${stage === "done" && rank >= 0 ? "top" : ""} ${watch?.id === c.id ? "watching" : ""}`}>
                  <Room r={r} place={cand} names={names} base={isCafe ? null : baseScores} compact onOpen={() => open(c.id)} label={isCafe ? "Plain café (baseline)" : cand!.name} />
                  <div className="tile-foot">
                    <small>{isCafe ? "the comparison" : cand!.kinds.filter((k) => k !== "Place" && k !== "Restaurant").slice(0, 2).join(" · ") || "Restaurant"}</small>
                    {g !== null && <span className={`gain ${g >= 0 ? "up" : "down"}`}>{g >= 0 ? "+" : ""}{g.toFixed(1)}</span>}
                    {stage === "done" && rank >= 0 && <span className="pill">#{rank + 1}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {stage === "done" && (
        <section className="card day">
          <h2>Your top {top.length} for dinner with {mname}</h2>
          <p className="meta">Ranked only by the rehearsals: how much more both twins wanted a second date (0-100, averaged) than the same two of you at a plain café. Under each, the moments that made the difference.</p>
          <details className="how-qloo">
            <summary>How Qloo works in this simulation</summary>
            <ol>
              <li><b>Your tastes become a signal.</b> The films, music, shows and books you both picked are Qloo entities. Qloo&apos;s{" "}
                <code>/v2/insights</code> takes both sets together and returns the restaurants in {city} that people with <i>both</i> tastes
                tend to love, in Qloo&apos;s order.</li>
              <li><b>Your needs remove places, nothing else.</b> Halal or vegetarian is sent as Qloo&apos;s <code>dietary_option</code> tag
                (a place must have it), the budget is checked against Qloo&apos;s <code>price_level</code>, and places that aren&apos;t
                for dates are dropped. We rank nothing: Qloo&apos;s top {cands.length} are all rehearsed.</li>
              <li><b>Qloo&apos;s tags become the room.</b> Each restaurant&apos;s Qloo tags (cuisine, ambience, menu highlights) are
                numbered F1, F2… and are all the twins know about it; they can only order from the menu tags. The room is drawn from
                them too: lanterns for Japanese, an aquarium for seafood, a skyline window for a rooftop.</li>
              <li><b>The twins have dinner.</b> GLM-5.3 voices each twin from your profile only. Afterwards each says how much they want a
                second date.</li>
              <li><b>Every reason is checked.</b> A moment must quote a real line, a real item from that person&apos;s profile and a real
                Qloo tag of the place, or we drop it.</li>
            </ol>
          </details>
          <ol className="podium">
            {top.map((c, i) => {
              const r = of(c.id)!;
              const g = gain(c.id) ?? 0;
              const ups = r.moments.filter((m) => m.effect > 0).sort((x, y) => x.line - y.line);
              const downs = r.moments.filter((m) => m.effect < 0).sort((x, y) => x.line - y.line);
              const tryThis = r.order.length ? r.order : c.menu.slice(0, 3);
              return (
                <li key={c.id} className="venue-profile">
                  <header>
                    <span className="rank">{i + 1}</span>
                    <div>
                      <h3>{c.name}</h3>
                      <small>{c.kinds.filter((k) => k !== "Place").slice(0, 3).join(" · ")}{c.price ? ` · ${"$".repeat(c.price)}` : ""}</small>
                    </div>
                  </header>
                  <div className="stats">
                    <span className="stat honey"><b>{g >= 0 ? "+" : ""}{g.toFixed(1)}</b> affection vs café</span>
                    <span className="stat"><i className="dot a" /> {names[0]} <b>{r.aAfter}</b>{base && <small> / café {base.aAfter}</small>}</span>
                    <span className="stat"><i className="dot b" /> {names[1]} <b>{r.bAfter}</b>{base && <small> / café {base.bAfter}</small>}</span>
                  </div>
                  {ups.length > 0 && <ul className="proofs">{ups.slice(0, more.has(c.id) ? ups.length : 3).map((m, k) => <Proof key={k} m={m} r={r} names={names} onWatch={() => open(c.id, m.line)} />)}</ul>}
                  {ups.length > 3 && !more.has(c.id) && <button className="link" onClick={() => setMore(new Set([...more, c.id]))}>Show {ups.length - 3} more moments</button>}
                  {downs.length > 0 && <ul className="proofs">{downs.map((m, k) => <Proof key={k} m={m} r={r} names={names} onWatch={() => open(c.id, m.line)} />)}</ul>}
                  {tryThis.length > 0 && (
                    <div className="prompt-card plain">
                      <small className="eyebrow">What to order</small>
                      <p className="quote">{tryThis.join(", ")}</p>
                    </div>
                  )}
                  {c.fits.length > 0 && <p className="hint">Good to know: {c.fits.join(" · ")}</p>}
                  <div className="actions">
                    <button className="go" onClick={() => open(c.id)}>Watch the whole dinner</button>
                    {c.address && <a className="go ghost" href={maps(c, city)} target="_blank" rel="noreferrer">Map</a>}
                  </div>
                </li>
              );
            })}
          </ol>
          <button className="go ghost" onClick={() => { setStage("input"); setStep(3); setRuns([]); setCands([]); setWatch(null); }}>Try another match</button>
        </section>
      )}

      {stage === "done" && (
        <section className="card all">
          <h2>All {runs.length} dinners</h2>
          <p className="meta small">Every restaurant Qloo suggested, in order of how much affection rose, and the plain café. Click a row to read the conversation with the proof moments highlighted.</p>
          <div className="table-wrap">
            <table className="rehearsals">
              <thead>
                <tr><th>#</th><th>Restaurant</th><th>Score<small>{names[0]} / {names[1]}</small></th><th>vs café</th><th>Proof</th><th>Strongest moment</th></tr>
              </thead>
              <tbody>
                {[...ranked.map((c) => ({ c, r: of(c.id)! })), ...(base ? [{ c: null, r: base }] : [])].map(({ c, r }, i) => {
                  const id = c?.id ?? "cafe";
                  const g = c ? gain(c.id) : null;
                  const m1 = r.moments.find((m) => m.effect > 0) ?? r.moments[0];
                  const ups = r.moments.filter((m) => m.effect > 0).length;
                  return (
                    <Fragment key={id}>
                      <tr className={`${c && i < TOP ? "won" : ""} ${c ? "" : "base"} ${row === id ? "open" : ""}`} onClick={() => setRow(row === id ? null : id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setRow(row === id ? null : id)} aria-expanded={row === id}>
                        <td>{c ? i + 1 : "—"}</td>
                        <td><b>{c?.name ?? "Plain café (baseline)"}</b>{c && i < TOP && <span className="pill">top {TOP}</span>}<small>{c?.kinds.filter((k) => k !== "Place").slice(0, 2).join(" · ")}</small></td>
                        <td className="num">{r.aAfter} / {r.bAfter}</td>
                        <td className={`num ${g === null ? "" : g >= 0 ? "up" : "down"}`}>{g === null ? "—" : `${g >= 0 ? "+" : ""}${g.toFixed(1)}`}</td>
                        <td className="num"><span className="up">▲{ups}</span> <span className="down">▼{r.moments.length - ups}</span></td>
                        <td className="quote">{m1 ? <>“{r.lines[m1.line]?.say}”<small>{m1.because} × {m1.feature.replace(/^menu: /, "")} · min {r.lines[m1.line]?.min}</small></> : "—"}</td>
                      </tr>
                      {row === id && (
                        <tr className="detail"><td colSpan={6}>
                          <button className="link" onClick={() => open(id)}>▶ Watch this dinner</button>
                          <Transcript r={r} names={names} />
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {error && (
        <p className="error">
          {error} <button className="link" onClick={rehearseDinner}>Try again</button>
        </p>
      )}
    </main>
  );
}
