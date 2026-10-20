"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { Person } from "@/lib/server/garden";
import type { Candidate, Moment, Rehearsal, Slot } from "@/lib/server/planner";
import type { Entity, EntityType } from "@/lib/server/qloo";
import { BUDGETS, DEFAULT_PREFS, DIETS, type Prefs, QUESTIONS } from "@/lib/profile";
import "../ui.css";
import DateScene from "./DateScene";
import "./plan.css";

const SLOTS: { slot: Slot; time: string; label: string; icon: string }[] = [
  { slot: "brunch", time: "10:30", label: "Brunch", icon: "☕" },
  { slot: "afternoon", time: "13:30", label: "Afternoon", icon: "🌿" },
  { slot: "dinner", time: "18:30", label: "Dinner", icon: "🍽️" },
  { slot: "drinks", time: "21:00", label: "After dinner", icon: "🌙" },
];
const PARALLEL = 8; // rehearsals in flight at once
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

/** One proof moment: the line, who it moved, what about them, what about the place. */
function Proof({ m, r, names }: { m: Moment; r: Rehearsal; names: [string, string] }) {
  const line = r.lines[m.line];
  const who = m.who === "a" ? names[0] : names[1];
  return (
    <li className={m.effect > 0 ? "up" : "down"}>
      <q>{line?.say}</q>
      <small>
        {m.effect > 0 ? "▲" : "▼"} {who} · {m.because} · meets <b>{m.feature.replace(/^menu: /, "")}</b> · ~minute {line?.min ?? "?"}, line {m.line + 1}
      </small>
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
  const [open, setOpen] = useState<string | null>(null);
  const [row, setRow] = useState<string | null>(null);
  const planRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/cast").then((r) => r.json()).then((d) => Array.isArray(d) && setCast(d)).catch(() => {});
  }, []);

  const you = asPerson("you", name, about, favs, prefs);
  const matchBody = mode === "demo" ? { id: pickId } : { person: asPerson("match", mName, mAbout, mFavs, mPrefs) };
  const ready = favs.length >= 3 && (mode === "demo" ? !!pickId : mFavs.length >= 3);
  const total = cands.length + 1;

  async function rehearseDay() {
    setStage("rehearsing");
    setError(null);
    setRuns([]);
    setCands([]);
    setOpen(null);
    setRow(null);
    try {
      setStatus(`Asking Qloo where you two would love to spend a day in ${city}…`);
      const c = await post<{ match: Person; candidates: Candidate[] }>("/api/candidates", { you, match: matchBody, city });
      setMatch(c.match);
      setCands(c.candidates);
      setStatus("Your twins are rehearsing every stop, plus a plain café to compare with…");
      const got: Rehearsal[] = [];
      await pool([null, ...c.candidates], PARALLEL, (place) => post<Rehearsal>("/api/rehearse", { you, match: matchBody, place }), (_, r) => {
        got.push(r);
        setRuns([...got]);
      });
      setStatus("");
      setStage("done");
      setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("");
    }
  }

  const base = runs.find((r) => r.venue === null);
  const baseline = base ? score(base) : 0;
  const of = (id: string) => runs.find((r) => r.venue === id);
  const gain = (id: string) => {
    const r = of(id);
    return r && base ? score(r) - baseline : null;
  };
  const winners = SLOTS.map((s) => {
    const opts = cands.filter((c) => c.slot === s.slot);
    const best = [...opts].sort((a, b) => (gain(b.id) ?? -99) - (gain(a.id) ?? -99))[0];
    return { ...s, best, opts };
  });
  const winIds = winners.map((w) => w.best?.id).filter(Boolean) as string[];
  const mname = match?.name ?? (mode === "demo" ? cast.find((c) => c.id === pickId)?.name : mName) ?? "your match";
  const names: [string, string] = [you.name, mname];
  // What lifted them and what to be careful with, across the day's stops, from the checked moments.
  const across = (effect: 1 | -1) => {
    const n = new Map<string, number>();
    winIds.forEach((id) => of(id)?.moments.filter((m) => m.effect === effect).forEach((m) => {
      const k = `${m.who === "a" ? you.name : mname} ${m.because}`;
      n.set(k, (n.get(k) ?? 0) + 1);
    }));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  };
  const picked = cast.find((c) => c.id === pickId);

  return (
    <main className="try plan">
      <nav className="crumbs">
        <Link href="/">The Garden</Link>
      </nav>
      <h1>Rehearse your first date</h1>
      <p className="lede">
        You matched. Now your AI twins rehearse a whole day together at real places Qloo picks for both of you, and you get the day that
        went best, with the moments that prove why.
      </p>

      {stage === "input" && (
        <section className="card">
          <PersonForm title="1 · You" whose="you" name={name} setName={setName} about={about} setAbout={setAbout} favs={favs} setFavs={setFavs} prefs={prefs} setPrefs={setPrefs} placeholder={["Mira", "I collect vinyl. I want someone who cooks with me."]} />
          <h3 className="gap">2 · Your match</h3>
          <div className="tabs mode" role="tablist">
            <button role="tab" aria-selected={mode === "demo"} className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>Pick a demo twin</button>
            <button role="tab" aria-selected={mode === "custom"} className={mode === "custom" ? "on" : ""} onClick={() => setMode("custom")}>Enter their profile</button>
          </div>
          {mode === "demo" ? (
            <>
              <div className="people pickable">
                {cast.map((p) => (
                  <button key={p.id} className={`person ${pickId === p.id ? "picked" : ""}`} onClick={() => setPickId(p.id)} aria-pressed={pickId === p.id}>
                    <b>{p.name}</b>
                    <small>{p.age} · {p.work}</small>
                    <small className="prefline">{prefsLine(p.prefs)}</small>
                    <span className="favs small">{p.favourites.map((f) => <Fav key={f.id} e={f} />)}</span>
                  </button>
                ))}
                {!cast.length && <p className="meta">Loading the demo twins from Qloo…</p>}
              </div>
              {picked && <p className="meta small">{picked.name}: {picked.about.join(" ")}</p>}
            </>
          ) : (
            <PersonForm title="" whose="them" name={mName} setName={setMName} about={mAbout} setAbout={setMAbout} favs={mFavs} setFavs={setMFavs} prefs={mPrefs} setPrefs={setMPrefs} placeholder={["Arjun", "I cook for my whole street. I want someone who laughs loudly."]} />
          )}
          <div className="row gap">
            <label>
              3 · Where
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <button className="go" disabled={!ready} onClick={rehearseDay}>
            {ready ? "Rehearse our day →" : "Pick favourites for both of you"}
          </button>
        </section>
      )}

      {stage !== "input" && (
        <section className="card">
          <h2>
            {you.name} &amp; {mname} · {city}
          </h2>
          <p className="meta small">
            {runs.length} of {total} rehearsals done{base ? ` · plain café baseline: ${baseline.toFixed(0)}/100` : ""}
          </p>
          <div className="slots">
            {winners.map((w) => (
              <div key={w.slot} className="slot">
                <h3>
                  {w.icon} {w.label} <small>{w.time}</small>
                </h3>
                {w.opts.map((c) => {
                  const g = gain(c.id);
                  const r = of(c.id);
                  const won = stage === "done" && w.best?.id === c.id;
                  return (
                    <div key={c.id} className={`cand ${won ? "won" : ""}`}>
                      <b>{c.name}</b>
                      <small>{c.kinds.filter((k) => k !== "Place").slice(0, 2).join(" · ")}</small>
                      {c.fits.length > 0 && <small className="fit">✓ {c.fits.slice(0, 2).join(" · ")}</small>}
                      <div className="runs">
                        <span className={`dot ${r ? (g !== null && g >= 0 ? "up" : "down") : "wait"}`} title={r ? `${score(r).toFixed(0)}/100` : "rehearsing…"} />
                        {r && <small>{r.moments.length} proof moment{r.moments.length === 1 ? "" : "s"}</small>}
                        {g !== null && <span className={`gain ${g >= 0 ? "up" : "down"}`}>{g >= 0 ? "+" : ""}{g.toFixed(1)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {stage === "done" && (
        <section className="card day" ref={planRef}>
          <h2>Your first date with {mname}</h2>
          <p className="meta">Each stop is the place where your twins&apos; wish for a second date rose most compared with the same two of you at a plain café, with the moments from the rehearsal that explain why.</p>
          <details className="how-qloo">
            <summary>How Qloo works in this simulation</summary>
            <ol>
              <li><b>Your tastes become a signal.</b> The films, music, shows and books you both picked are Qloo entities. Qloo&apos;s
                <code>/v2/insights</code> takes both sets together as <code>signal.interests.entities</code> and returns real places in{" "}
                {city} that people with <i>both</i> tastes tend to love, one query per slot (café/brunch, park/museum/gallery,
                restaurant, bar or dessert).</li>
              <li><b>Your needs become filters.</b> Halal or vegetarian is sent as Qloo&apos;s <code>dietary_option</code> tag with an
                intersection filter, the budget is checked against Qloo&apos;s <code>price_level</code>, and bars are swapped for dessert or tea if one of you
                doesn&apos;t drink. These rules only remove places; nothing is ranked by us. Qloo&apos;s top five per slot are all
                rehearsed, in Qloo&apos;s order.</li>
              <li><b>Qloo&apos;s tags become the world.</b> Each place&apos;s Qloo tags (kinds, ambience, cuisine, menu highlights) are
                numbered F1, F2… and handed to the twins as everything they know about it. The scene is drawn from them too: a park, a
                bar with a stage for live music, lanterns for Japanese food.</li>
              <li><b>The twins live it.</b> GLM-5.3 voices each twin from your profile only, at that place, for about 90 minutes. They may
                only order dishes from Qloo&apos;s menu tags.</li>
              <li><b>Every reason is checked.</b> When a line moves one of them, it must cite a profile item (A3: &quot;is an
                introvert&quot;) and a Qloo feature (F2: &quot;Quiet&quot;). We drop any moment that cites something that isn&apos;t there.
                The same two at a plain café, with no Qloo data, is the baseline each place is compared with.</li>
            </ol>
          </details>
          <ol className="timeline">
            {winners.filter((w) => w.best).map((w) => {
              const c = w.best!;
              const r = of(c.id);
              const g = gain(c.id) ?? 0;
              const ups = r?.moments.filter((m) => m.effect > 0).sort((x, y) => x.line - y.line) ?? [];
              const downs = r?.moments.filter((m) => m.effect < 0).sort((x, y) => x.line - y.line) ?? [];
              const tryThis = r?.order.length ? r.order : c.menu.slice(0, 3);
              return (
                <li key={w.slot}>
                  <span className="when">{w.time}</span>
                  <div>
                    <h3>
                      {w.icon} {c.name}
                      <span className={`gain ${g >= 0 ? "up" : "down"}`}>{g >= 0 ? "+" : ""}{g.toFixed(1)} vs café</span>
                    </h3>
                    {c.address && <small className="addr">{c.address} · <a href={maps(c, city)} target="_blank" rel="noreferrer">Map ↗</a></small>}
                    {(c.fits.length > 0 || c.links.length > 0) && (
                      <p className="why-qloo">
                        <span>Why Qloo suggested it:</span> {[...c.fits, ...c.links.map((l) => `echoes your taste: ${l}`)].join(" · ")}
                      </p>
                    )}
                    {ups.length > 0 && (
                      <>
                        <p className="label">Why it worked for you two</p>
                        <ul className="proofs">{ups.map((m, i) => <Proof key={i} m={m} r={r!} names={names} />)}</ul>
                      </>
                    )}
                    {downs.length > 0 && (
                      <>
                        <p className="label">Watch out</p>
                        <ul className="proofs">{downs.map((m, i) => <Proof key={i} m={m} r={r!} names={names} />)}</ul>
                      </>
                    )}
                    {tryThis.length > 0 && <p className="try-this"><span>Try:</span> {tryThis.join(" · ")}</p>}
                    {r && <DateScene key={c.id} r={r} names={names} place={c} start={w.time} />}
                    <button className="link" onClick={() => setOpen(open === w.slot ? null : w.slot)}>
                      {open === w.slot ? "Hide the transcript" : "Read the transcript"}
                    </button>
                    {open === w.slot && r && <Transcript r={r} names={names} />}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="talk">
            <p><span>💬 What lifted you both:</span> {across(1).join(" · ") || "—"}</p>
            <p><span>🙊 Be careful with:</span> {across(-1).join(" · ") || "—"}</p>
          </div>
          <p className="meta small">
            Places, menus, food tags and the taste behind them come from Qloo for both of you together. Each moment is checked: it must quote
            a real line, a real item from that person&apos;s profile, and a real Qloo feature of the place. One rehearsal per place (GLM-5.3):
            a guide to a good day, not a guarantee.
          </p>
          <button className="go ghost" onClick={() => { setStage("input"); setRuns([]); setCands([]); }}>Plan another day</button>
        </section>
      )}

      {stage === "done" && (
        <section className="card all">
          <h2>All {runs.length} rehearsals</h2>
          <p className="meta small">Every place Qloo suggested, and the plain café your twins also rehearsed at for comparison. Scores are how much each twin wants a second date afterwards (0-100). Click a row to read the rehearsal, with the proof moments highlighted.</p>
          <div className="table-wrap">
            <table className="rehearsals">
              <thead>
                <tr>
                  <th>Slot</th><th>Place</th><th>Score<small>{you.name} / {mname}</small></th><th>vs café</th><th>Proof</th><th>Strongest moment</th>
                </tr>
              </thead>
              <tbody>
                {[{ id: "cafe", slot: null as Slot | null, name: "Plain café (baseline)", kinds: [] as string[] }, ...cands].map((c) => {
                  const r = c.id === "cafe" ? base : of(c.id);
                  const g = c.id === "cafe" ? null : gain(c.id);
                  const slot = SLOTS.find((s) => s.slot === c.slot);
                  const won = winIds.includes(c.id);
                  const top = r?.moments.find((m) => m.effect > 0) ?? r?.moments[0];
                  const ups = r?.moments.filter((m) => m.effect > 0).length ?? 0;
                  const downs = (r?.moments.length ?? 0) - ups;
                  return (
                    <Fragment key={c.id}>
                      <tr className={`${won ? "won" : ""} ${c.id === "cafe" ? "base" : ""} ${row === c.id ? "open" : ""}`} onClick={() => setRow(row === c.id ? null : c.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setRow(row === c.id ? null : c.id)} aria-expanded={row === c.id}>
                        <td>{slot ? `${slot.icon} ${slot.label}` : "—"}</td>
                        <td><b>{c.name}</b>{won && <span className="pill">in your plan</span>}<small>{c.kinds.filter((k) => k !== "Place").slice(0, 2).join(" · ")}</small></td>
                        <td className="num">{r ? `${r.aAfter} / ${r.bAfter}` : "…"}</td>
                        <td className={`num ${g === null ? "" : g >= 0 ? "up" : "down"}`}>{g === null ? "—" : `${g >= 0 ? "+" : ""}${g.toFixed(1)}`}</td>
                        <td className="num">{r ? <><span className="up">▲{ups}</span> <span className="down">▼{downs}</span></> : "…"}</td>
                        <td className="quote">{top && r ? <>“{r.lines[top.line]?.say}”<small>{top.because} × {top.feature.replace(/^menu: /, "")}</small></> : "—"}</td>
                      </tr>
                      {row === c.id && r && (
                        <tr className="detail">
                          <td colSpan={6}>
                            <DateScene r={r} names={names} place={c.id === "cafe" ? null : (c as Candidate)} start={slot?.time} />
                            <Transcript r={r} names={names} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {status && <p className="status">{status}</p>}
      {error && (
        <p className="error">
          {error} <button className="link" onClick={rehearseDay}>Try again</button>
        </p>
      )}
    </main>
  );
}
