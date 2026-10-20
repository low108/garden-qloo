"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DateResult, Person, WallAnswer, WallPick, WallResult } from "@/lib/server/garden";
import type { Entity, EntityType } from "@/lib/server/qloo";
import "./try.css";

type Stage = "you" | "pool" | "garden" | "done";
type Score = { partner: string; score: number };
type Plan = { places: Entity[]; talkAbout: Entity[] };

const TYPES: { type: EntityType; label: string; hint: string }[] = [
  { type: "movie", label: "Films", hint: "e.g. Inception" },
  { type: "artist", label: "Music", hint: "e.g. Coldplay" },
  { type: "tv_show", label: "TV", hint: "e.g. The Office" },
  { type: "book", label: "Books", hint: "e.g. Norwegian Wood" },
];
const CITIES = ["Singapore", "Kuala Lumpur", "New York", "London", "Tokyo", "Sydney"];
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? `${path} returned ${r.status}`);
  return d as T;
}

const kindOf = (t: EntityType) => ({ movie: "film", artist: "music", tv_show: "TV", book: "book" })[t as string] ?? t;

function Fav({ e, onRemove }: { e: Entity; onRemove?: () => void }) {
  return (
    <span className="fav">
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

/** Search Qloo as you type, one entity type at a time. */
function Picker({ onPick, picked }: { onPick: (e: Entity) => void; picked: Entity[] }) {
  const [type, setType] = useState<EntityType>("movie");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Entity[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    let stale = false;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(q)}`);
        const d = await r.json();
        if (!stale) setHits(Array.isArray(d) ? d : []);
      } finally {
        if (!stale) setBusy(false);
      }
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
      {busy && <p className="meta small">Searching Qloo…</p>}
      <ul className="hits">
        {hits.filter((h) => !ids.has(h.id)).map((h) => (
          <li key={h.id}>
            <button
              onClick={() => {
                onPick(h);
                setQ("");
                setHits([]);
              }}
            >
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

function Hearts({ n }: { n: number }) {
  const k = Math.max(0, Math.min(10, Math.round(n)));
  return (
    <span className="hearts" aria-label={`${k} out of 10`}>
      {"♥".repeat(Math.round(k / 2))}
      <span className="dim">{"♥".repeat(5 - Math.round(k / 2))}</span> {k}/10
    </span>
  );
}

function DateCard({ day, you, them, r, shown }: { day: number; you: Person; them: Person; r: DateResult; shown: number }) {
  return (
    <article className="date">
      <header>
        <span className="day">Day {day}</span>
        <b>
          {you.name} &amp; {them.name}
        </b>
      </header>
      {r.venue && (
        <div className="venue">
          <span className="pin">📍</span>
          <div>
            <b>{r.venue.name}</b>
            {r.venue.address && <small>{r.venue.address}</small>}
            <small className="why">Booked by the Coordinator with Qloo: a real place both of your tastes point to{r.venue.tags.length ? ` (${r.venue.tags.slice(0, 3).join(", ").toLowerCase()})` : ""}.</small>
          </div>
        </div>
      )}
      {r.bridges.length > 0 && (
        <p className="bridge">
          <span>Common ground Qloo found:</span> {r.bridges.map((b) => b.name).join(" · ")}
        </p>
      )}
      <ul className="chat">
        {r.lines.slice(0, shown).map((l, i) => (
          <li key={i} className={l.who}>
            <small>{l.who === "you" ? you.name : them.name}</small>
            {l.say}
          </li>
        ))}
      </ul>
      {shown >= r.lines.length && (
        <div className="diaries">
          <blockquote>
            <small>🌙 {you.name}&apos;s twin wrote</small>
            {r.yourDiary} <Hearts n={r.yourPull} />
          </blockquote>
          <blockquote>
            <small>🌙 {them.name}&apos;s twin wrote</small>
            {r.theirDiary} <Hearts n={r.theirPull} />
          </blockquote>
        </div>
      )}
    </article>
  );
}

export default function Try() {
  const [stage, setStage] = useState<Stage>("you");
  const [name, setName] = useState("");
  const [age, setAge] = useState(27);
  const [work, setWork] = useState("");
  const [about, setAbout] = useState("");
  const [gender, setGender] = useState<"f" | "m">("f");
  const [city, setCity] = useState("Singapore");
  const [favs, setFavs] = useState<Entity[]>([]);
  const [pool, setPool] = useState<Person[]>([]);
  const [dates, setDates] = useState<{ them: Person; r: DateResult }[]>([]);
  const [shown, setShown] = useState(0);
  const [status, setStatus] = useState("");
  const [wallR, setWallR] = useState<WallResult | null>(null);
  const [scores, setScores] = useState<Score[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const you: Person = {
    id: "you", name: name.trim() || "You", gender, age, work: work.trim(),
    about: about.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 3), favourites: favs,
  };

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [dates.length, shown, wallR, plan, status]);

  async function meetPool() {
    setError(null);
    setStatus("Finding the twins in the Garden…");
    try {
      const r = await fetch(`/api/cast?gender=${gender === "f" ? "m" : "f"}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPool(d);
      setStage("pool");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("");
    }
  }

  async function run() {
    setStage("garden");
    setError(null);
    setDates([]);
    setWallR(null);
    setPlan(null);
    setScores(null);
    const done: { them: Person; r: DateResult }[] = [];
    try {
      // All the dates are written at once (each on its own day, at its own venue); they play out one by one.
      const asked = pool.map((them, i) => post<DateResult>("/api/date", { you, partner: them.id, city, day: i + 1 }));
      for (const [i, them] of pool.entries()) {
        setStatus(`Day ${i + 1}: the Coordinator asks Qloo where ${you.name} and ${them.name} should meet in ${city}…`);
        const r = await asked[i];
        done.push({ them, r });
        setDates([...done]);
        setStatus("");
        for (let k = 1; k <= r.lines.length; k++) {
          setShown(k);
          await wait(800);
        }
        await wait(700);
      }
      setStatus("Your twin has dated everyone. The wall opens…");
      const taste = post<Score[]>("/api/taste", { you, partners: pool.map((p) => p.id) }); // the baseline, meanwhile
      const sent = done.map((d) => ({ partner: d.them.id, result: d.r }));
      const pick = await post<WallPick>("/api/wall", { you, dates: sent });
      let w: WallResult = { ...pick, answer: null, theirLine: null };
      if (pick.choice) {
        setStatus(`${you.name}'s twin walks over to ${byId(pick.choice)?.name}…`);
        const ans = await post<WallAnswer>("/api/wall", { you, dates: sent, ask: { partner: pick.choice, line: pick.yourLine } });
        w = { ...pick, ...ans };
      }
      setWallR(w);
      setStatus("Scoring everyone by taste overlap, the way most apps would…");
      setScores(await taste);
      if (w.choice && w.answer === "yes") {
        setStatus("Asking Qloo for your real first date…");
        setPlan(await post<Plan>("/api/plan", { you, partner: w.choice, city }));
      }
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus("");
    }
  }

  const byId = (id: string | null) => pool.find((p) => p.id === id);
  const topTaste = scores ? [...scores].sort((a, b) => b.score - a.score)[0] : null;
  const chosen = wallR?.answer === "yes" ? byId(wallR.choice) : null;

  return (
    <main className="try">
      <nav className="crumbs">
        <Link href="/">The Garden</Link> · <Link href="/experiment">The experiment</Link> · <Link href="/replay">A full 27-day run</Link>
      </nav>
      <h1>Send your twin on the first dates</h1>
      <p className="lede">Your twin loves what you love, for real: every favourite is a real film, artist, show or book in Qloo&apos;s taste graph.</p>

      {stage === "you" && (
        <section className="card">
          <h2>1 · You</h2>
          <div className="row">
            <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Alex" /></label>
            <label>Age<input type="number" min={18} max={99} value={age} onChange={(e) => setAge(Number(e.target.value))} /></label>
            <label>Work<input value={work} onChange={(e) => setWork(e.target.value)} maxLength={60} placeholder="Data analyst" /></label>
          </div>
          <div className="row">
            <label>
              I am
              <select value={gender} onChange={(e) => setGender(e.target.value as "f" | "m")}>
                <option value="f">a woman, meeting men</option>
                <option value="m">a man, meeting women</option>
              </select>
            </label>
            <label>
              City
              <select value={city} onChange={(e) => setCity(e.target.value)}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="wide">
            Two things about you
            <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} placeholder="I bake sourdough badly. I want someone who reads." />
          </label>
          <h2>2 · Your taste</h2>
          <p className="meta">Pick at least 3: films, music, TV or books you truly love.</p>
          <Picker picked={favs} onPick={(e) => setFavs((f) => (f.length < 8 ? [...f, e] : f))} />
          <div className="favs">{favs.map((f) => <Fav key={f.id} e={f} onRemove={() => setFavs(favs.filter((x) => x.id !== f.id))} />)}</div>
          <button className="go" disabled={favs.length < 3 || !!status} onClick={meetPool}>
            {favs.length < 3 ? `Pick ${3 - favs.length} more` : "Meet the Garden →"}
          </button>
        </section>
      )}

      {stage !== "you" && (
        <section className="card pool">
          <h2>The Garden</h2>
          <p className="meta">Your twin will date each of them once. Then the wall opens, and it may ask one of them to leave with it.</p>
          <div className="people">
            <div className="person you-card">
              <b>{you.name}&apos;s twin</b>
              <small>{you.age} · {you.work || "—"} · {city}</small>
              <div className="favs small">{favs.map((f) => <Fav key={f.id} e={f} />)}</div>
            </div>
            {pool.map((p) => (
              <div className="person" key={p.id}>
                <b>{p.name}</b>
                <small>{p.age} · {p.work} · demo twin</small>
                <div className="favs small">{p.favourites.map((f) => <Fav key={f.id} e={f} />)}</div>
              </div>
            ))}
          </div>
          {stage === "pool" && (
            <button className="go" onClick={run}>Send my twin into the Garden →</button>
          )}
        </section>
      )}

      {dates.map((d, i) => (
        <DateCard key={d.them.id} day={i + 1} you={you} them={d.them} r={d.r} shown={i === dates.length - 1 && stage === "garden" && !wallR ? shown : d.r.lines.length} />
      ))}

      {wallR && (
        <section className={`card wall ${wallR.answer === "yes" ? "out" : ""}`}>
          <h2>🧱 The wall opens</h2>
          {wallR.choice ? (
            <>
              <p><b>{you.name}&apos;s twin</b> goes to <b>{byId(wallR.choice)?.name}</b>: “{wallR.yourLine}”</p>
              <p><b>{byId(wallR.choice)?.name}</b>: “{wallR.theirLine}”</p>
              <p className="verdict">{wallR.answer === "yes" ? `They leave the Garden together.` : `${byId(wallR.choice)?.name} stays. Not every pull is mutual.`}</p>
            </>
          ) : (
            <p>{you.name}&apos;s twin stays: “{wallR.yourLine}”</p>
          )}
        </section>
      )}

      {stage === "done" && scores && (
        <section className="card compare">
          <h2>Taste score vs. simulation</h2>
          <div className="cols">
            <div>
              <h3>Matching by taste</h3>
              <p className="meta">Qloo taste overlap: what most apps would rank on.</p>
              <ol>
                {[...scores].sort((a, b) => b.score - a.score).map((s) => (
                  <li key={s.partner} className={s.partner === topTaste?.partner ? "top" : ""}>
                    {byId(s.partner)?.name} <small>{(s.score * 100).toFixed(1)}% overlap</small>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3>The simulation</h3>
              <p className="meta">Who the twins actually chose.</p>
              <p className="big">{chosen ? `${you.name} + ${chosen.name}` : "No breakout"}</p>
              <p className="meta">
                {chosen && topTaste?.partner === chosen.id
                  ? "This time both agree."
                  : chosen
                    ? `The taste score would have sent you to ${byId(topTaste?.partner ?? null)?.name}.`
                    : "Taste overlap would still have ranked a top match. The simulation says: not yet."}
              </p>
            </div>
          </div>
          <p className="note">
            Why both? On 4,089 real speed dates, Qloo taste overlap alone predicted mutual matches no better than chance (AUC 0.48).
            The twins&apos; behaviour carries the signal; Qloo gives that behaviour real places and real common ground. <Link href="/experiment">See the experiment →</Link>
          </p>
        </section>
      )}

      {plan && chosen && (
        <section className="card plan">
          <h2>Your real first date with {chosen.name}</h2>
          <ul className="places">
            {plan.places.map((p) => (
              <li key={p.id}>
                <b>{p.name}</b>
                {p.address && <small>{p.address}</small>}
                {p.tags.length > 0 && <small className="why">{p.tags.slice(0, 4).join(" · ")}</small>}
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${p.name} ${p.address ?? city}`)}`} target="_blank" rel="noreferrer">Map ↗</a>
              </li>
            ))}
          </ul>
          <p className="bridge"><span>Talk about:</span> {plan.talkAbout.map((t) => t.name).join(" · ")}</p>
          <p className="meta small">Places and common ground from Qloo&apos;s taste graph, for both of your tastes together.</p>
        </section>
      )}

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error} <button className="link" onClick={run}>Try again</button></p>}
      {stage === "done" && (
        <p><button className="go ghost" onClick={() => { setStage("you"); setDates([]); setWallR(null); setPlan(null); setScores(null); }}>Start again</button></p>
      )}
      <div ref={bottom} />
    </main>
  );
}
