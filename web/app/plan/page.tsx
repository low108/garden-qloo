"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { Person } from "@/lib/server/garden";
import type { Candidate, Rehearsal, Slot } from "@/lib/server/planner";
import type { Entity, EntityType } from "@/lib/server/qloo";
import "../ui.css";
import "./plan.css";

const SLOTS: { slot: Slot; time: string; label: string; icon: string }[] = [
  { slot: "brunch", time: "10:30", label: "Brunch", icon: "☕" },
  { slot: "afternoon", time: "13:30", label: "Afternoon", icon: "🌿" },
  { slot: "dinner", time: "18:30", label: "Dinner", icon: "🍽️" },
  { slot: "drinks", time: "21:00", label: "After dinner", icon: "🍸" },
];
const RUNS = 2; // rehearsals per place
const PARALLEL = 6; // rehearsals in flight at once
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
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
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

/** Name, two facts and favourites for one person. */
function PersonForm(p: {
  title: string;
  name: string; setName: (s: string) => void;
  about: string; setAbout: (s: string) => void;
  favs: Entity[]; setFavs: (f: Entity[]) => void;
  placeholder: [string, string];
}) {
  return (
    <>
      <h3>{p.title}</h3>
      <div className="row">
        <label>Name<input value={p.name} onChange={(e) => p.setName(e.target.value)} maxLength={40} placeholder={p.placeholder[0]} /></label>
        <label className="grow">Two things about them<input value={p.about} onChange={(e) => p.setAbout(e.target.value)} maxLength={300} placeholder={p.placeholder[1]} /></label>
      </div>
      <p className="meta small">At least 3 favourites: films, music, TV or books.</p>
      <Picker picked={p.favs} onPick={(e) => p.setFavs(p.favs.length < 8 ? [...p.favs, e] : p.favs)} />
      <div className="favs">{p.favs.map((f) => <Fav key={f.id} e={f} onRemove={() => p.setFavs(p.favs.filter((x) => x.id !== f.id))} />)}</div>
    </>
  );
}

const asPerson = (id: string, name: string, about: string, favs: Entity[]) => ({
  id, name: name.trim() || (id === "you" ? "You" : "Your match"), gender: "f" as const, age: 0, work: "",
  about: about.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 3), favourites: favs,
});

export default function Plan() {
  const [stage, setStage] = useState<"input" | "rehearsing" | "done">("input");
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [favs, setFavs] = useState<Entity[]>([]);
  const [mode, setMode] = useState<"demo" | "custom">("demo");
  const [cast, setCast] = useState<Person[]>([]);
  const [pickId, setPickId] = useState<string>("");
  const [mName, setMName] = useState("");
  const [mAbout, setMAbout] = useState("");
  const [mFavs, setMFavs] = useState<Entity[]>([]);
  const [city, setCity] = useState("Singapore");
  const [match, setMatch] = useState<Person | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [runs, setRuns] = useState<Rehearsal[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [row, setRow] = useState<string | null>(null); // the place whose rehearsals are open in the table
  const planRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/cast").then((r) => r.json()).then((d) => Array.isArray(d) && setCast(d)).catch(() => {});
  }, []);

  const you = asPerson("you", name, about, favs);
  const matchBody = mode === "demo" ? { id: pickId } : { person: asPerson("match", mName, mAbout, mFavs) };
  const ready = favs.length >= 3 && (mode === "demo" ? !!pickId : mFavs.length >= 3);
  const total = (cands.length + 1) * RUNS;

  async function rehearseDay() {
    setStage("rehearsing");
    setError(null);
    setRuns([]);
    setCands([]);
    setOpen(null);
    try {
      setStatus(`Asking Qloo where you two would love to spend a day in ${city}…`);
      const c = await post<{ match: Person; candidates: Candidate[] }>("/api/candidates", { you, match: matchBody, city });
      setMatch(c.match);
      setCands(c.candidates);
      setStatus("Your twins are rehearsing every stop, twice, plus a plain café to compare with…");
      const jobs: { place: Candidate | null; run: number }[] = [];
      for (let run = 1; run <= RUNS; run++) jobs.push({ place: null, run }, ...c.candidates.map((place) => ({ place, run })));
      const got: Rehearsal[] = [];
      await pool(jobs, PARALLEL, (j) => post<Rehearsal>("/api/rehearse", { you, match: matchBody, place: j.place, run: j.run }), (_, r) => {
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

  const baseline = mean(runs.filter((r) => r.venue === null).map(score));
  const of = (id: string) => runs.filter((r) => r.venue === id);
  const gain = (id: string) => (of(id).length ? mean(of(id).map(score)) - baseline : null);
  const winners = SLOTS.map((s) => {
    const opts = cands.filter((c) => c.slot === s.slot);
    const best = [...opts].sort((a, b) => (gain(b.id) ?? -99) - (gain(a.id) ?? -99))[0];
    return { ...s, best, opts };
  });
  const tally = (key: "landed" | "flat", ids: string[]) => {
    const n = new Map<string, number>();
    runs.filter((r) => r.venue && ids.includes(r.venue)).forEach((r) => r[key].forEach((t) => n.set(t.toLowerCase(), (n.get(t.toLowerCase()) ?? 0) + 1)));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  };
  const winIds = winners.map((w) => w.best?.id).filter(Boolean) as string[];
  const mname = match?.name ?? (mode === "demo" ? cast.find((c) => c.id === pickId)?.name : mName) ?? "your match";

  return (
    <main className="try plan">
      <nav className="crumbs">
        <Link href="/">The Garden</Link>
      </nav>
      <h1>Rehearse your first date</h1>
      <p className="lede">
        You matched. Now your AI twins rehearse a whole day together at real places Qloo picks for both of your tastes, and you get the
        day that went best.
      </p>

      {stage === "input" && (
        <section className="card">
          <PersonForm title="1 · You" name={name} setName={setName} about={about} setAbout={setAbout} favs={favs} setFavs={setFavs} placeholder={["Mira", "I collect vinyl. I want someone who cooks with me."]} />
          <h3 className="gap">2 · Your match</h3>
          <div className="tabs mode" role="tablist">
            <button role="tab" aria-selected={mode === "demo"} className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>Pick a demo twin</button>
            <button role="tab" aria-selected={mode === "custom"} className={mode === "custom" ? "on" : ""} onClick={() => setMode("custom")}>Enter their taste</button>
          </div>
          {mode === "demo" ? (
            <div className="people pickable">
              {cast.map((p) => (
                <button key={p.id} className={`person ${pickId === p.id ? "picked" : ""}`} onClick={() => setPickId(p.id)} aria-pressed={pickId === p.id}>
                  <b>{p.name}</b>
                  <small>{p.age} · {p.work}</small>
                  <span className="favs small">{p.favourites.map((f) => <Fav key={f.id} e={f} />)}</span>
                </button>
              ))}
              {!cast.length && <p className="meta">Loading the demo twins from Qloo…</p>}
            </div>
          ) : (
            <PersonForm title="" name={mName} setName={setMName} about={mAbout} setAbout={setMAbout} favs={mFavs} setFavs={setMFavs} placeholder={["Arjun", "I cook for my whole street. I want someone who laughs loudly."]} />
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
            {runs.length} of {total} rehearsals done{baseline ? ` · plain café baseline: ${baseline.toFixed(0)}/100` : ""}
          </p>
          <div className="slots">
            {winners.map((w) => (
              <div key={w.slot} className="slot">
                <h3>
                  {w.icon} {w.label} <small>{w.time}</small>
                </h3>
                {w.opts.map((c) => {
                  const g = gain(c.id);
                  const rs = of(c.id);
                  const won = stage === "done" && w.best?.id === c.id;
                  return (
                    <div key={c.id} className={`cand ${won ? "won" : ""}`}>
                      <b>{c.name}</b>
                      <small>{c.kinds.filter((k) => k !== "Place").slice(0, 2).join(" · ")}</small>
                      <div className="runs">
                        {Array.from({ length: RUNS }, (_, i) => (
                          <span key={i} className={`dot ${rs[i] ? (score(rs[i]) - baseline >= 0 ? "up" : "down") : "wait"}`} title={rs[i] ? `rehearsal ${i + 1}: ${score(rs[i]).toFixed(0)}/100` : "rehearsing…"} />
                        ))}
                        {g !== null && rs.length === RUNS && <span className={`gain ${g >= 0 ? "up" : "down"}`}>{g >= 0 ? "+" : ""}{g.toFixed(1)}</span>}
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
          <p className="meta">Each stop is the place where your twins&apos; wish for a second date rose most, compared with the same two of you at a plain café.</p>
          <ol className="timeline">
            {winners.filter((w) => w.best).map((w) => {
              const rs = of(w.best!.id);
              const top = [...rs].sort((a, b) => score(b) - score(a))[0];
              const order = [...new Set(rs.flatMap((r) => r.order))].slice(0, 3);
              const g = gain(w.best!.id) ?? 0;
              return (
                <li key={w.slot}>
                  <span className="when">{w.time}</span>
                  <div>
                    <h3>
                      {w.icon} {w.best!.name}
                      <span className={`gain ${g >= 0 ? "up" : "down"}`}>{g >= 0 ? "+" : ""}{g.toFixed(1)} vs café</span>
                    </h3>
                    {w.best!.address && <small className="addr">{w.best!.address} · <a href={maps(w.best!, city)} target="_blank" rel="noreferrer">Map ↗</a></small>}
                    {top?.spark && <p className="spark">“{top.spark}”</p>}
                    {order.length > 0 && <p className="try-this"><span>Try:</span> {order.join(" · ")}</p>}
                    <button className="link" onClick={() => setOpen(open === w.slot ? null : w.slot)}>
                      {open === w.slot ? "Hide the rehearsal" : "Read the rehearsal"}
                    </button>
                    {open === w.slot && top && (
                      <ul className="chat">
                        {top.lines.map((l, i) => (
                          <li key={i} className={l.who === "a" ? "you" : "them"}>
                            <small>{l.who === "a" ? you.name : mname}</small>
                            {l.say}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="talk">
            <p><span>💬 Talk about:</span> {tally("landed", winIds).join(" · ") || "—"}</p>
            <p><span>🙊 Maybe skip:</span> {tally("flat", winIds).join(" · ") || "—"}</p>
          </div>
          <p className="meta small">
            Places, menus and the taste behind them come from Qloo&apos;s taste graph for both of you together. The twins rehearsed each
            stop {RUNS} times (GLM-5.3); rehearsals vary, so treat small differences as a coin toss.
          </p>
          <button className="go ghost" onClick={() => { setStage("input"); setRuns([]); setCands([]); }}>Plan another day</button>
        </section>
      )}

      {stage === "done" && (
        <section className="card all">
          <h2>All {runs.length} rehearsals</h2>
          <p className="meta small">Every place Qloo suggested, and the plain café your twins also rehearsed at for comparison. Scores are how much each twin wants a second date afterwards (0-100). Click a row to read both rehearsals.</p>
          <div className="table-wrap">
            <table className="rehearsals">
              <thead>
                <tr>
                  <th>Slot</th><th>Place</th>
                  {Array.from({ length: RUNS }, (_, i) => <th key={i}>Run {i + 1}<small>{you.name} / {mname}</small></th>)}
                  <th>Average</th><th>vs café</th><th>Sparking line</th>
                </tr>
              </thead>
              <tbody>
                {[{ id: "cafe", slot: null as Slot | null, name: "Plain café (baseline)", kinds: [] as string[] }, ...cands].map((c) => {
                  const rs = runs.filter((r) => (c.id === "cafe" ? r.venue === null : r.venue === c.id)).sort((a, b) => a.run - b.run);
                  const avg = mean(rs.map(score));
                  const g = c.id === "cafe" ? null : avg - baseline;
                  const slot = SLOTS.find((s) => s.slot === c.slot);
                  const won = winIds.includes(c.id);
                  const best = [...rs].sort((a, b) => score(b) - score(a))[0];
                  return (
                    <Fragment key={c.id}>
                      <tr className={`${won ? "won" : ""} ${c.id === "cafe" ? "base" : ""} ${row === c.id ? "open" : ""}`} onClick={() => setRow(row === c.id ? null : c.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setRow(row === c.id ? null : c.id)} aria-expanded={row === c.id}>
                        <td>{slot ? `${slot.icon} ${slot.label}` : "—"}</td>
                        <td><b>{c.name}</b>{won && <span className="pill">in your plan</span>}<small>{c.kinds.filter((k) => k !== "Place").slice(0, 2).join(" · ")}</small></td>
                        {Array.from({ length: RUNS }, (_, i) => (
                          <td key={i} className={`num ${rs[i] && g !== null && score(rs[i]) < baseline ? "down" : ""}`}>{rs[i] ? `${rs[i].aAfter} / ${rs[i].bAfter}` : "…"}</td>
                        ))}
                        <td className="num">{rs.length ? avg.toFixed(1) : "…"}</td>
                        <td className={`num ${g === null ? "" : g >= 0 ? "up" : "down"}`}>{g === null ? "—" : `${g >= 0 ? "+" : ""}${g.toFixed(1)}`}</td>
                        <td className="quote">{best?.spark ? `“${best.spark}”` : "—"}</td>
                      </tr>
                      {row === c.id && (
                        <tr className="detail">
                          <td colSpan={5 + RUNS}>
                            <div className="pair">
                              {rs.map((r) => (
                                <div key={r.run}>
                                  <h4>Run {r.run} · {you.name} {r.aAfter} / {mname} {r.bAfter}</h4>
                                  <ul className="chat">
                                    {r.lines.map((l, i) => (
                                      <li key={i} className={l.who === "a" ? "you" : "them"}>
                                        <small>{l.who === "a" ? you.name : mname}</small>
                                        {l.say}
                                      </li>
                                    ))}
                                  </ul>
                                  {r.order.length > 0 && <p className="small"><span className="meta">Ordered:</span> {r.order.join(" · ")}</p>}
                                  {r.landed.length > 0 && <p className="small"><span className="meta">Went well:</span> {r.landed.join(" · ")}</p>}
                                  {r.flat.length > 0 && <p className="small"><span className="meta">Fell flat:</span> {r.flat.join(" · ")}</p>}
                                </div>
                              ))}
                            </div>
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
