"use client";

import { useEffect, useRef, useState } from "react";
import type { Act, Rehearsal } from "@/lib/server/planner";

// A rehearsal played back as a small pixel-art scene, Smallville style: the two twins walk in, sit, stroll or order
// as each line says, talk in speech bubbles, and every checked moment flashes the Qloo feature it met. The room is
// drawn from the place's Qloo kinds and tags (a park, a bar with a stage, a restaurant with lanterns...).

const W = 240, H = 144; // the scene in pixels; scaled up crisply by CSS
type Pt = { x: number; y: number };
type Setting = "cafe" | "restaurant" | "bar" | "park" | "gallery" | "market" | "books";
type Layout = { door: Pt; seats: [Pt, Pt]; spots: Pt[]; counter: Pt };

const LAYOUTS: Record<Setting, Layout> = {
  cafe: { door: { x: 120, y: 150 }, seats: [{ x: 140, y: 88 }, { x: 172, y: 88 }], spots: [{ x: 56, y: 60 }, { x: 200, y: 52 }], counter: { x: 52, y: 58 } },
  restaurant: { door: { x: 120, y: 150 }, seats: [{ x: 104, y: 92 }, { x: 136, y: 92 }], spots: [{ x: 40, y: 64 }, { x: 196, y: 60 }], counter: { x: 40, y: 64 } },
  bar: { door: { x: 30, y: 150 }, seats: [{ x: 92, y: 62 }, { x: 110, y: 62 }], spots: [{ x: 196, y: 100 }, { x: 150, y: 110 }], counter: { x: 100, y: 62 } },
  park: { door: { x: -10, y: 104 }, seats: [{ x: 112, y: 70 }, { x: 128, y: 70 }], spots: [{ x: 50, y: 104 }, { x: 196, y: 104 }, { x: 180, y: 66 }], counter: { x: 200, y: 104 } },
  gallery: { door: { x: 120, y: 150 }, seats: [{ x: 112, y: 96 }, { x: 128, y: 96 }], spots: [{ x: 44, y: 52 }, { x: 120, y: 52 }, { x: 196, y: 52 }], counter: { x: 200, y: 110 } },
  market: { door: { x: -10, y: 108 }, seats: [{ x: 110, y: 112 }, { x: 134, y: 112 }], spots: [{ x: 44, y: 70 }, { x: 120, y: 70 }, { x: 196, y: 70 }], counter: { x: 120, y: 70 } },
  books: { door: { x: 120, y: 150 }, seats: [{ x: 160, y: 96 }, { x: 184, y: 96 }], spots: [{ x: 40, y: 56 }, { x: 96, y: 56 }, { x: 60, y: 108 }], counter: { x: 200, y: 52 } },
};

export function settingOf(kinds: string[], vibe: string[]): Setting {
  const k = kinds.join(" "), all = [...kinds, ...vibe].join(" ");
  if (/book|library/i.test(k)) return "books";
  if (/museum|gallery|exhibit/i.test(k)) return "gallery";
  if (/market|hawker|food court/i.test(k)) return "market";
  if (/park|garden|nature|hill|beach|trail|botanic|reserve|attraction|landmark|scenic/i.test(k)) return "park";
  if (/bar|pub|lounge|music|club|brewery|winery/i.test(k)) return "bar";
  if (/cafe|coffee|bakery|brunch|tea|dessert/i.test(k)) return "cafe";
  if (/restaurant|dining|cuisine|bistro|eatery/i.test(all)) return "restaurant";
  return "cafe";
}

// Pixel helpers
type Ctx = CanvasRenderingContext2D;
const rect = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };

function tree(c: Ctx, x: number, y: number) {
  rect(c, x - 1, y + 6, 3, 6, "#6b4226");
  rect(c, x - 6, y - 4, 13, 10, "#2f7d3b");
  rect(c, x - 4, y - 8, 9, 5, "#3e9b4b");
  rect(c, x - 3, y - 2, 3, 2, "#5cbf63");
}
function table(c: Ctx, x: number, y: number, cloth = "#a0673a", top = "#c08552") {
  rect(c, x - 9, y - 2, 18, 9, cloth);
  rect(c, x - 8, y - 2, 16, 7, top);
  rect(c, x - 7, y + 7, 2, 4, "#5a3a22");
  rect(c, x + 5, y + 7, 2, 4, "#5a3a22");
}
function plant(c: Ctx, x: number, y: number) {
  rect(c, x - 3, y + 2, 6, 5, "#b5651d");
  rect(c, x - 4, y - 4, 8, 6, "#3e9b4b");
  rect(c, x - 2, y - 7, 4, 3, "#5cbf63");
}
function lantern(c: Ctx, x: number, y: number, col = "#d1495b") {
  rect(c, x, 0, 1, y - 3, "#333");
  rect(c, x - 3, y - 3, 7, 8, col);
  rect(c, x - 2, y - 2, 5, 1, "#f6c35b");
}

function drawSetting(c: Ctx, s: Setting, accent: { lanterns: boolean; stage: boolean; water: boolean; plain: boolean }) {
  const floor = (a: string, b: string, size = 8) => {
    for (let y = 0; y < H; y += size) for (let x = 0; x < W; x += size) rect(c, x, y, size, size, (x / size + y / size) % 2 ? a : b);
  };
  const wall = (col: string, trim: string, h = 34) => { rect(c, 0, 0, W, h, col); rect(c, 0, h - 3, W, 3, trim); };
  const windows = (y: number, col = "#9fd3f0") => { for (const x of [150, 190]) { rect(c, x, y, 28, 16, "#6b4226"); rect(c, x + 2, y + 2, 11, 12, col); rect(c, x + 15, y + 2, 11, 12, col); } };
  const door = (x: number) => { rect(c, x - 10, H - 4, 20, 4, "#6b4226"); };
  if (s === "park") {
    rect(c, 0, 0, W, H, "#6fbf5c");
    for (let i = 0; i < 70; i++) rect(c, (i * 53) % W, (i * 31) % H, 2, 1, "#5aa84a");
    rect(c, 0, 96, W, 16, "#d9b779"); rect(c, 0, 96, W, 1, "#c19c5c"); rect(c, 0, 111, W, 1, "#c19c5c");
    if (accent.water) { rect(c, 150, 20, 60, 30, "#4aa3df"); rect(c, 156, 26, 12, 2, "#9fd3f0"); }
    // bench
    rect(c, 102, 66, 36, 4, "#8b5a2b"); rect(c, 102, 60, 36, 3, "#a0673a"); rect(c, 104, 70, 2, 5, "#5a3a22"); rect(c, 134, 70, 2, 5, "#5a3a22");
    for (const [x, y] of [[20, 30], [50, 20], [80, 36], [30, 128], [100, 130], [215, 125], [225, 70], [10, 70]]) tree(c, x, y);
    for (const [x, y] of [[60, 60], [170, 70], [140, 125]]) { rect(c, x, y, 2, 2, "#f6c35b"); rect(c, x + 4, y + 2, 2, 2, "#e86f9a"); }
    if (accent.lanterns) { rect(c, 186, 30, 10, 10, "#d1495b"); rect(c, 184, 28, 14, 3, "#8b2a2a"); }
    return;
  }
  if (s === "market") {
    rect(c, 0, 0, W, H, "#3b3f58"); // evening sky over the stalls
    rect(c, 0, 50, W, H - 50, "#8d8d8d");
    for (let x = 0; x < W; x += 12) rect(c, x, 50, 1, H - 50, "#7a7a7a");
    for (const [i, x] of [24, 100, 176].entries()) {
      const col = ["#d1495b", "#2e86ab", "#f18f01"][i];
      rect(c, x, 34, 40, 6, col); for (let k = 0; k < 40; k += 8) rect(c, x + k, 34, 4, 6, "#fff");
      rect(c, x + 2, 40, 36, 14, "#a0673a"); rect(c, x + 6, 42, 6, 4, "#f6c35b"); rect(c, x + 18, 42, 6, 4, "#e86f9a");
    }
    for (let x = 6; x < W; x += 18) { rect(c, x, 14, 3, 3, "#f6c35b"); }
    table(c, 122, 112, "#666", "#999");
    return;
  }
  if (s === "bar") {
    floor("#2b2233", "#32283b");
    wall("#1d1a26", "#6a4c93", 30);
    for (let x = 10; x < W; x += 16) rect(c, x, 6, 3, 3, ["#f6c35b", "#e86f9a", "#9fd3f0"][(x / 16) % 3 | 0]);
    rect(c, 50, 40, 110, 12, "#5a3a22"); rect(c, 50, 40, 110, 3, "#8b5a2b"); // bar counter
    for (let x = 58; x < 156; x += 8) rect(c, x, 32, 3, 7, ["#4aa3df", "#d1495b", "#3e9b4b"][(x / 8) % 3 | 0]);
    for (const x of [74, 92, 110, 128, 146]) { rect(c, x - 3, 58, 7, 2, "#8b5a2b"); rect(c, x - 1, 60, 2, 6, "#555"); }
    if (accent.stage) { rect(c, 170, 80, 64, 34, "#5a3a22"); rect(c, 170, 80, 64, 3, "#8b5a2b"); rect(c, 196, 66, 2, 16, "#999"); rect(c, 193, 64, 8, 3, "#333"); rect(c, 214, 86, 10, 12, "#222"); }
    else { table(c, 190, 100, "#3a2a40", "#5a4a60"); }
    table(c, 60, 110, "#3a2a40", "#5a4a60");
    door(30);
    return;
  }
  if (s === "gallery") {
    floor("#e9e4da", "#e1dbcf", 12);
    wall("#f7f4ee", "#c9c2b5", 40);
    for (const [i, x] of [30, 106, 182].entries()) {
      rect(c, x, 8, 28, 22, "#3b3b3b");
      rect(c, x + 2, 10, 24, 18, ["#e86f9a", "#4aa3df", "#f18f01"][i]);
      rect(c, x + 6, 16, 10, 8, ["#f6c35b", "#2f7d3b", "#6a4c93"][i]);
      rect(c, x + 10, 33, 8, 2, "#999");
    }
    rect(c, 104, 102, 32, 5, "#555"); rect(c, 106, 107, 2, 4, "#333"); rect(c, 132, 107, 2, 4, "#333");
    rect(c, 192, 100, 16, 22, "#ddd"); rect(c, 196, 92, 8, 8, "#bbb"); // a sculpture
    door(120);
    return;
  }
  if (s === "books") {
    floor("#b98b5e", "#b08257");
    wall("#7a5230", "#5a3a22", 30);
    for (const x of [8, 64]) { rect(c, x, 34, 44, 28, "#5a3a22"); for (let r = 0; r < 3; r++) for (let k = 0; k < 10; k++) rect(c, x + 2 + k * 4, 36 + r * 9, 3, 7, ["#d1495b", "#2e86ab", "#3e9b4b", "#f6c35b"][(k + r) % 4]); }
    rect(c, 8, 86, 44, 28, "#5a3a22"); for (let r = 0; r < 3; r++) for (let k = 0; k < 10; k++) rect(c, 10 + k * 4, 88 + r * 9, 3, 7, ["#6a4c93", "#f18f01", "#2e86ab"][(k + r) % 3]);
    rect(c, 186, 40, 34, 10, "#8b5a2b");
    table(c, 172, 96);
    plant(c, 226, 120);
    door(120);
    return;
  }
  // cafe and restaurant
  const resto = s === "restaurant";
  if (accent.plain) floor("#cfcac2", "#c8c3bb", 12);
  else if (resto) floor("#7b4b3a", "#6f4334", 12);
  else floor("#c9955f", "#c08a55");
  wall(accent.plain ? "#e6e2dc" : resto ? "#f0e1c6" : "#f3e6cf", resto ? "#7b2d26" : "#8b5a2b");
  windows(8, accent.plain ? "#d8e6ee" : "#9fd3f0");
  if (resto) {
    rect(c, 18, 40, 44, 16, "#5a3a22"); rect(c, 18, 40, 44, 3, "#8b5a2b"); // pass to the kitchen
    table(c, 120, 92, "#7b2d26", "#f3e6cf"); table(c, 196, 116, "#7b2d26", "#f3e6cf"); table(c, 60, 116, "#7b2d26", "#f3e6cf");
    rect(c, 119, 86, 2, 4, "#f6c35b"); // candle
    if (accent.lanterns) for (const x of [40, 90, 150, 210]) lantern(c, x, 24);
  } else {
    rect(c, 14, 40, 60, 14, "#6b4226"); rect(c, 14, 40, 60, 3, "#8b5a2b"); // counter
    rect(c, 22, 33, 8, 7, "#555"); rect(c, 40, 34, 6, 6, "#f3e6cf"); rect(c, 52, 34, 10, 6, "#e86f9a"); // machine, cups, cake
    table(c, 156, 92); table(c, 60, 112); table(c, 210, 122);
    if (!accent.plain) { plant(c, 226, 52); plant(c, 10, 120); }
    if (accent.lanterns) for (const x of [100, 180]) lantern(c, x, 22);
  }
  door(120);
}

const LOOK = [
  { shirt: "#d1495b", hair: "#3b2a20", skin: "#e0ac69", legs: "#2b2b3b" }, // A (you)
  { shirt: "#2e86ab", hair: "#1f1a17", skin: "#c68642", legs: "#3b3b2b" }, // B (your match)
];
function person(c: Ctx, p: Pt, look: (typeof LOOK)[number], walking: boolean, sitting: boolean, t: number) {
  const x = Math.round(p.x), y = Math.round(p.y);
  rect(c, x - 4, y + 7, 9, 2, "rgba(0,0,0,0.18)"); // shadow
  const step = walking ? Math.floor(t / 140) % 2 : 0;
  if (!sitting) { rect(c, x - 3, y + 2, 3, 6 - step * 2, look.legs); rect(c, x + 1, y + 2, 3, 4 + step * 2, look.legs); }
  else rect(c, x - 3, y + 2, 7, 3, look.legs);
  rect(c, x - 4, y - 6, 9, 9, look.shirt);
  rect(c, x - 3, y - 13, 7, 7, look.skin);
  rect(c, x - 3, y - 14, 7, 3, look.hair);
  rect(c, x - 4, y - 13, 1, 4, look.hair);
  rect(c, x - 2, y - 10, 1, 1, "#222"); rect(c, x + 2, y - 10, 1, 1, "#222");
}
function heart(c: Ctx, x: number, y: number, col: string) {
  rect(c, x - 3, y - 2, 3, 3, col); rect(c, x + 1, y - 2, 3, 3, col); rect(c, x - 3, y, 7, 2, col); rect(c, x - 2, y + 2, 5, 1, col); rect(c, x - 1, y + 3, 3, 1, col); rect(c, x, y + 4, 1, 1, col);
}

const clockOf = (start: string | undefined, min: number) => {
  if (!start) return `min ${min}`;
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")} · min ${min}`;
};

export default function DateScene(p: {
  r: Rehearsal;
  names: [string, string];
  place: { name: string; kinds: string[]; vibe: string[] } | null;
  start?: string; // the slot's start time, for the clock
}) {
  const { r, names } = p;
  const setting = p.place ? settingOf(p.place.kinds, p.place.vibe) : "cafe";
  const all = p.place ? [...p.place.kinds, ...p.place.vibe].join(" ") : "";
  const accent = {
    lanterns: /japanese|chinese|korean|asian|ramen|sushi|izakaya|teahouse|tea house/i.test(all),
    stage: /live music|music venue|jazz|concert|karaoke/i.test(all),
    water: /lake|pond|river|waterfront|reservoir|marina|beach/i.test(all),
    plain: !p.place,
  };
  const L = LAYOUTS[setting];
  const canvas = useRef<HTMLCanvasElement>(null);
  const [line, setLine] = useState(-1); // the line being said; -1 while they arrive, lines.length when they've left
  const [playing, setPlaying] = useState(false); // starts when the scene scrolls into view
  const [allFeats, setAllFeats] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const speaker = useRef(0);
  const [speed, setSpeed] = useState(1);
  const state = useRef({ pos: [{ ...L.door }, { x: L.door.x + 12, y: L.door.y }] as Pt[], target: [L.seats[0], L.seats[1]] as Pt[], step: -1, until: 0, now: 0, hearts: [] as { x: number; y: number; born: number; col: string }[] });
  const playingRef = useRef(playing), speedRef = useRef(speed);
  playingRef.current = playing;
  speedRef.current = speed;

  // Where each twin goes for a line's action.
  const targetsFor = (act: Act, i: number): [Pt, Pt] => {
    const pair = (q: Pt): [Pt, Pt] => [{ x: q.x - 8, y: q.y }, { x: q.x + 8, y: q.y }];
    if (act === "leave") return [{ ...L.door }, { x: L.door.x + 12, y: L.door.y }];
    if (act === "walk" || act === "look") return pair(L.spots[i % L.spots.length]);
    if (act === "order") return pair(L.counter);
    if (act === "arrive") return pair({ x: (L.door.x + L.seats[0].x) / 2, y: Math.min(L.door.y - 30, 120) });
    return L.seats;
  };

  const go = (step: number) => {
    const s = state.current;
    s.step = step;
    if (step >= 0 && step < r.lines.length) {
      const l = r.lines[step];
      s.target = targetsFor(l.act, step);
      s.until = s.now + (1600 + l.say.length * 38);
      const m = r.moments.find((x) => x.line === step);
      if (m) {
        const who = m.who === "a" ? 0 : 1;
        s.hearts.push({ x: s.target[who].x, y: s.target[who].y - 20, born: s.now, col: m.effect > 0 ? "#e8365d" : "#555" });
      }
    } else if (step >= r.lines.length) {
      s.target = targetsFor("leave", step);
      s.until = Infinity;
    }
    setLine(step);
  };

  const restart = () => {
    const s = state.current;
    s.pos = [{ ...L.door }, { x: L.door.x + 12, y: L.door.y }];
    s.target = [...L.seats];
    s.hearts = [];
    s.until = s.now + 2200;
    s.step = -1;
    setLine(-1);
    setPlaying(true);
  };

  // Play once the scene is mostly on screen, so a page of scenes doesn't all run unseen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPlaying(true); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current?.getContext("2d");
    if (!c) return;
    let raf = 0, last = performance.now();
    state.current.until = 2200;
    const frame = (t: number) => {
      const dt = Math.min(250, t - last) * (playingRef.current ? speedRef.current : 0);
      last = t;
      const s = state.current;
      s.now += dt;
      // Walk: along x first, then y, like a grid town.
      const moving = [false, false];
      s.pos.forEach((q, i) => {
        const tg = s.target[i], v = 0.045 * dt;
        if (Math.abs(q.x - tg.x) > 0.5) { q.x += Math.sign(tg.x - q.x) * Math.min(v, Math.abs(tg.x - q.x)); moving[i] = true; }
        else if (Math.abs(q.y - tg.y) > 0.5) { q.y += Math.sign(tg.y - q.y) * Math.min(v, Math.abs(tg.y - q.y)); moving[i] = true; }
      });
      if (s.now >= s.until && s.step < r.lines.length && !moving.some(Boolean)) go(s.step + 1);
      drawSetting(c, setting, accent);
      const act = s.step >= 0 && s.step < r.lines.length ? r.lines[s.step].act : "arrive";
      const seated = ["sit", "eat", "drink", "laugh"].includes(act);
      const order = [0, 1].sort((a, b) => s.pos[a].y - s.pos[b].y);
      for (const i of order) person(c, s.pos[i], LOOK[i], moving[i], seated && !moving[i], s.now);
      // The bubble follows the speaker: above them in the lower part of the room, below them near the top, and
      // shifted sideways in step with x so it never leaves the frame.
      const b = bubble.current;
      if (b) {
        const q = s.pos[speaker.current], fx = Math.max(0, Math.min(100, (q.x / W) * 100)), above = q.y > 64;
        b.style.left = `${fx}%`;
        b.style.top = `${((above ? q.y - 18 : q.y + 12) / H) * 100}%`;
        b.style.transform = `translate(-${fx}%, ${above ? "-100%" : "0"})`;
        b.classList.toggle("below", !above);
        b.style.setProperty("--tail", `${fx}%`);
      }
      s.hearts = s.hearts.filter((h) => s.now - h.born < 1800);
      for (const h of s.hearts) heart(c, h.x, h.y - (s.now - h.born) / 90, h.col);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // The scene is set once per rehearsal; playback state lives in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  const cur = line >= 0 && line < r.lines.length ? r.lines[line] : null;
  const moment = cur ? r.moments.find((m) => m.line === line) : undefined;
  speaker.current = cur ? (cur.who === "a" ? 0 : 1) : 0;
  const cited = new Set(r.moments.map((m) => m.feature));
  const done = line >= r.lines.length;

  return (
    <div className="scene" ref={box}>
      <div className="stage">
        <canvas ref={canvas} width={W} height={H} aria-label={`Animated rehearsal at ${p.place?.name ?? "a plain cafe"}`} />
        <span className="clock">{cur ? clockOf(p.start, cur.min) : line < 0 ? "arriving…" : "after the date"}</span>
        <span className="who-tags">
          <i className="a">■ {names[0]}</i> <i className="b">■ {names[1]}</i>
        </span>
        {cur && (
          <div ref={bubble} className={`bubble ${cur.who}`}>
            {cur.say}
          </div>
        )}
        {moment && (
          <div className={`flash ${moment.effect > 0 ? "up" : "down"}`}>
            {moment.effect > 0 ? "▲" : "▼"} {moment.who === "a" ? names[0] : names[1]}: {moment.because} <b>×</b> Qloo: {moment.feature.replace(/^menu: /, "")}
          </div>
        )}
        {done && (
          <div className="result">
            <b>After the date</b>
            <span>{names[0]} wants a second date: {r.aAfter}/100</span>
            <span>{names[1]}: {r.bAfter}/100</span>
            <button className="link" onClick={restart}>Watch again</button>
          </div>
        )}
      </div>
      <div className="controls">
        <button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
        <button onClick={restart} aria-label="Restart">↺</button>
        <button onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}>{speed}×</button>
        <div className="scrub" aria-label="Lines">
          {r.lines.map((l, i) => {
            const m = r.moments.find((x) => x.line === i);
            return (
              <button
                key={i}
                className={`${i === line ? "on" : ""} ${m ? (m.effect > 0 ? "up" : "down") : ""}`}
                title={`min ${l.min}: ${l.say}`}
                onClick={() => { state.current.until = state.current.now; go(i); }}
              />
            );
          })}
        </div>
      </div>
      <div className="qloo-feats">
        <p>
          <b>What Qloo told the twins about {p.place?.name ?? "this café"}</b> — these tags are all they know about the place; food and
          drinks may only come from the menu tags, and every ▲▼ moment must point at one of them.
        </p>
        <div>
          {r.features.map((f, i) => ({ f, i })).filter(({ f, i }) => allFeats || cited.has(f) || i < 10).map(({ f, i }) => (
            <span key={f} className={`feat ${moment?.feature === f ? "now" : ""} ${cited.has(f) ? "cited" : ""} ${f.startsWith("menu: ") ? "menu" : ""}`}>
              <small>F{i + 1}</small> {f.replace(/^menu: /, "🍽 ")}
            </span>
          ))}
          {!allFeats && r.features.length > 10 && (
            <button className="link" onClick={() => setAllFeats(true)}>all {r.features.length} tags</button>
          )}
        </div>
      </div>
    </div>
  );
}
