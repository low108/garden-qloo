"use client";

import { useEffect, useRef, useState } from "react";
import type { Rehearsal } from "@/lib/server/planner";

// A rehearsal played as a little front-on room in the style of PewDiePie's Tuber Simulator: chunky pixel art,
// big-headed chibi twins at a table, decor drawn from the restaurant's Qloo tags, and heart meters in a top bar.
// Compact rooms tile the "building" while rehearsals run; the full room adds speech bubbles, controls and the
// Qloo tags each proof moment points at.

const W = 192, H = 128, FLOOR = 80;
type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
const R = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const O = "#2a1f2d"; // the outline colour

type Cuisine = "japanese" | "chinese" | "korean" | "italian" | "french" | "spice" | "mexican" | "seafood" | "grill" | "plain" | "other";
type Theme = { cuisine: Cuisine; skyline: boolean; bottles: boolean; stage: boolean; plants: boolean; candle: boolean };

export function themeOf(place: { name: string; kinds: string[]; vibe: string[] } | null): Theme {
  if (!place) return { cuisine: "plain", skyline: false, bottles: false, stage: false, plants: false, candle: false };
  const t = [place.name, ...place.kinds, ...place.vibe].join(" · ").toLowerCase();
  const k = place.kinds.join(" · ").toLowerCase();
  // Whole words only, so "Seating" is not the sea.
  const has = (re: RegExp, s = t) => new RegExp(`\\b(?:${re.source})\\b`).test(s);
  const cuisine: Cuisine =
    has(/japanese|sushi|ramen|izakaya|omakase|yakitori|udon/) ? "japanese"
    : has(/korean|bbq|barbecue/) ? "korean"
    : has(/chinese|cantonese|dim sum|szechuan|sichuan|hot pot|teochew|hokkien|porridge/) ? "chinese"
    : has(/italian|pizza|pasta|trattoria/) ? "italian"
    : has(/french|bistro|fine dining|european|wine bar/) ? "french"
    : has(/indian|malay|indonesian|thai|peranakan|vietnamese|middle eastern|turkish|lebanese|mediterranean|halal|curry/) ? "spice"
    : has(/mexican|taco|latin/) ? "mexican"
    : has(/seafood|fish|crab|oyster|lobster/) ? "seafood"
    : has(/steak|grill|burger|american|smokehouse/) ? "grill"
    : "other";
  return {
    cuisine,
    skyline: has(/rooftop|rooftop bar|skyline|waterfront|sea view|city view|scenic view|harbourfront|marina|beach/),
    bottles: has(/bar|pub|gastropub|cocktail bar|wine bar|brewery|lounge/, k),
    stage: has(/live music|jazz|music venue|karaoke/),
    plants: has(/garden|green|plant|botanic|nature|outdoor|patio/),
    candle: has(/romantic|intimate|date|cozy|candle/),
  };
}

const WALLS: Record<Cuisine, [string, string]> = {
  japanese: ["#efdcb6", "#b9874f"], chinese: ["#b8323a", "#e2b04a"], korean: ["#3f4a63", "#6d7a99"], italian: ["#c8694a", "#a5543a"],
  french: ["#2f5a4a", "#c7a45a"], spice: ["#e39a3b", "#b8632a"], mexican: ["#f2c443", "#3aa6a0"], seafood: ["#3a7fb8", "#2c5f8a"],
  grill: ["#7a4a2a", "#5a3420"], plain: ["#d9d5cf", "#c4bfb7"], other: ["#e7b7a8", "#c98f80"],
};

function room(c: Ctx, th: Theme, t: number) {
  const [wall, trim] = WALLS[th.cuisine];
  R(c, 0, 0, W, FLOOR, wall);
  // wallpaper texture
  if (th.cuisine === "japanese") for (let x = 0; x < W; x += 16) R(c, x, 0, 2, FLOOR, trim);
  else if (th.cuisine === "italian") for (let y = 0; y < FLOOR; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < W; x += 12) R(c, x, y, 11, 5, "#b85c3f");
  else if (th.cuisine === "chinese") for (let x = 8; x < W; x += 24) for (let y = 10; y < FLOOR - 10; y += 22) R(c, x, y, 4, 4, trim);
  else if (th.cuisine === "spice") for (let x = 0; x < W; x += 12) for (let y = 4; y < FLOOR; y += 12) R(c, x + ((y / 12) % 2) * 6, y, 2, 2, "#fbe3a8");
  else if (th.cuisine === "grill") for (let x = 0; x < W; x += 12) R(c, x, 0, 1, FLOOR, "#5a3420");
  else if (th.cuisine !== "plain") for (let x = 0; x < W; x += 8) for (let y = 3; y < FLOOR; y += 8) R(c, x + ((y / 8) % 2) * 4, y, 1, 1, trim);
  R(c, 0, FLOOR - 5, W, 5, trim); R(c, 0, FLOOR - 1, W, 1, O);
  // floor
  const floor = th.cuisine === "japanese" ? ["#c9c27a", "#b5ad66"] : th.cuisine === "plain" ? ["#bdb8b0", "#b0aba3"] : th.cuisine === "chinese" || th.cuisine === "french" ? ["#6b3a2a", "#5a3022"] : ["#b07a4a", "#9c6a3e"];
  R(c, 0, FLOOR, W, H - FLOOR, floor[0]);
  for (let y = FLOOR + 6; y < H; y += 8) R(c, 0, y, W, 1, floor[1]);
  for (let x = 0; x < W; x += 24) for (let y = FLOOR; y < H; y += 8) R(c, x + ((y / 8) % 2) * 12, y, 1, 7, floor[1]);
  // door (right), with a noren curtain for Japanese places
  R(c, 160, 34, 24, 46, O); R(c, 162, 36, 20, 44, "#6b4226"); R(c, 178, 58, 2, 3, "#f6c35b");
  if (th.cuisine === "japanese") { R(c, 160, 34, 24, 14, "#2c4a7a"); R(c, 171, 34, 2, 14, wall); }

  // the back-wall feature: a window onto the city at night, an aquarium, or art
  if (th.skyline) {
    R(c, 14, 10, 62, 40, O); R(c, 16, 12, 58, 36, "#1d2346");
    for (const [x, h] of [[18, 18], [26, 26], [34, 14], [42, 30], [52, 20], [60, 24], [68, 16]]) {
      R(c, x, 48 - h, 7, h, "#2f3766");
      for (let y = 50 - h; y < 46; y += 4) if ((x + y + Math.floor(t / 900)) % 3) R(c, x + 2, y, 1, 1, "#f6d86b");
    }
    R(c, 62, 16, 4, 4, "#f3f0d6"); R(c, 44, 12, 2, 36, O);
  } else if (th.cuisine === "seafood") {
    R(c, 14, 14, 60, 34, O); R(c, 16, 16, 56, 30, "#5ec4e8");
    for (let i = 0; i < 4; i++) { const fx = 18 + ((t / 30 + i * 37) % 48), fy = 22 + i * 6; R(c, fx, fy, 5, 3, ["#f18f01", "#f6c35b", "#e86f9a", "#fff"][i]); R(c, fx - 2, fy, 2, 3, ["#f18f01", "#f6c35b", "#e86f9a", "#fff"][i]); }
    R(c, 16, 42, 56, 4, "#e7d7a0"); R(c, 30, 34, 2, 8, "#3e9b4b"); R(c, 56, 32, 2, 10, "#3e9b4b");
  } else if (th.cuisine === "japanese") {
    R(c, 18, 12, 40, 30, O); R(c, 20, 14, 36, 26, "#f7f1e1");
    for (let x = 22; x < 54; x += 6) R(c, x, 30 + Math.round(Math.sin((x + t / 200) / 4) * 3), 5, 3, "#2c5f8a"); // a wave print
    R(c, 44, 18, 6, 6, "#d1495b");
  } else if (th.cuisine === "mexican") {
    for (let x = 4; x < 150; x += 12) { R(c, x, 6, 10, 8, ["#e86f9a", "#2e86ab", "#3e9b4b", "#f18f01"][(x / 12) % 4 | 0]); R(c, x, 5, 12, 1, O); }
    R(c, 20, 52, 10, 22, "#3e9b4b"); R(c, 16, 58, 4, 8, "#3e9b4b"); R(c, 30, 56, 4, 8, "#3e9b4b"); R(c, 18, 72, 14, 8, "#c8694a");
  } else if (th.cuisine !== "plain") {
    R(c, 20, 14, 30, 24, O); R(c, 22, 16, 26, 20, th.cuisine === "french" ? "#c7a45a" : "#f3e6cf");
    R(c, 26, 22, 18, 10, th.cuisine === "korean" ? "#e86f9a" : "#4aa3df"); R(c, 30, 26, 8, 6, "#3e9b4b");
  }
  // neon sign for Korean and grill places
  if (th.cuisine === "korean" || th.cuisine === "grill") {
    const on = Math.floor(t / 700) % 5 !== 0;
    R(c, 96, 12, 40, 14, O); R(c, 98, 14, 36, 10, on ? "#ff5c8a" : "#7a3a50"); R(c, 102, 17, 28, 4, on ? "#ffd0de" : "#a05a70");
  }
  // lanterns
  if (th.cuisine === "chinese" || th.cuisine === "japanese") {
    for (const x of [92, 132]) { R(c, x, 0, 1, 10, O); R(c, x - 5, 10, 11, 12, O); R(c, x - 4, 11, 9, 10, th.cuisine === "chinese" ? "#e83a3a" : "#f0e0c0"); R(c, x - 4, 15, 9, 1, "#f6c35b"); }
  }
  // a chandelier for French or romantic places
  if (th.cuisine === "french") { R(c, 112, 0, 1, 8, O); R(c, 104, 8, 18, 3, "#c7a45a"); for (const x of [104, 112, 120]) { R(c, x, 4, 2, 4, "#fff"); R(c, x, 2, 2, 2, Math.floor(t / 300) % 2 ? "#f6c35b" : "#ffdf80"); } }
  // a shelf of bottles
  if (th.bottles) {
    R(c, 96, 40, 52, 3, "#5a3420"); R(c, 96, 58, 52, 3, "#5a3420");
    for (let x = 98; x < 146; x += 6) { R(c, x, 31, 4, 9, ["#3e9b4b", "#8b2a2a", "#c7a45a", "#4aa3df"][(x / 6) % 4 | 0]); R(c, x + 1, 28, 2, 3, O); }
    for (let x = 100; x < 146; x += 9) R(c, x, 51, 6, 7, "#d9f0ff");
  }
  // a tiny stage with a mic
  if (th.stage) { R(c, 0, 92, 30, 10, "#5a3420"); R(c, 0, 92, 30, 2, "#8b5a2b"); R(c, 14, 72, 1, 20, "#999"); R(c, 12, 70, 5, 3, O); }
  if (th.plants || th.cuisine === "spice") for (const x of [80, 150]) { R(c, x - 4, 66, 9, 10, "#b5651d"); R(c, x - 6, 56, 13, 10, "#3e9b4b"); R(c, x - 3, 52, 7, 5, "#5cbf63"); }
}

const TABLE = { x: 96, y: 94 };
function table(c: Ctx, th: Theme, food: number, drinks: boolean, t: number) {
  const cloth = th.cuisine === "italian" ? "checker" : th.cuisine === "french" ? "#f7f1e1" : th.cuisine === "chinese" ? "#f3e6cf" : th.cuisine === "plain" ? "#9c9690" : "#8b5a2b";
  R(c, TABLE.x - 24, TABLE.y - 3, 48, 7, O);
  if (cloth === "checker") for (let x = 0; x < 46; x += 4) R(c, TABLE.x - 23 + x, TABLE.y - 2, 4, 5, (x / 4) % 2 ? "#fff" : "#d1495b");
  else R(c, TABLE.x - 23, TABLE.y - 2, 46, 5, cloth);
  R(c, TABLE.x - 20, TABLE.y + 4, 3, 20, O); R(c, TABLE.x + 17, TABLE.y + 4, 3, 20, O);
  if (th.candle) { R(c, TABLE.x - 1, TABLE.y - 9, 3, 6, "#f7f1e1"); R(c, TABLE.x, TABLE.y - 12 - (Math.floor(t / 200) % 2), 1, 3, "#f6a81b"); }
  if (th.cuisine === "korean") { R(c, TABLE.x - 8, TABLE.y - 5, 16, 3, "#555"); for (let x = -6; x < 8; x += 4) R(c, TABLE.x + x, TABLE.y - 8 - (Math.floor(t / 250 + x) % 2), 1, 2, "#ccc"); }
  if (food > 0) for (const dx of [-14, 10]) {
    R(c, TABLE.x + dx - 1, TABLE.y - 5, 8, 3, "#fff"); R(c, TABLE.x + dx - 1, TABLE.y - 3, 8, 1, O);
    if (food > 1) R(c, TABLE.x + dx + 1, TABLE.y - 7, 4, 2, th.cuisine === "japanese" ? "#e86f6f" : th.cuisine === "italian" ? "#f6c35b" : "#c8694a");
  }
  if (drinks) for (const dx of [-20, 18]) { R(c, TABLE.x + dx, TABLE.y - 9, 3, 6, "#d9f0ff"); R(c, TABLE.x + dx, TABLE.y - 6, 3, 3, th.bottles ? "#8b2a2a" : "#f6c35b"); }
}

const LOOK = [
  { shirt: "#e8365d", hair: "#3b2a20", skin: "#f2c6a0", trim: "#ffb3c1" },
  { shirt: "#2e86ab", hair: "#1f1a17", skin: "#d9a066", trim: "#a9e1f7" },
  { shirt: "#fff", hair: "#555", skin: "#e8b88a", trim: "#2a1f2d" }, // the waiter
];
/** A chibi: big outlined head, small body; `face` is 1 for right, -1 for left. */
function chibi(c: Ctx, p: Pt, look: (typeof LOOK)[number], face: 1 | -1, walking: boolean, seated: boolean, bob: number, t: number, mood: number) {
  const x = Math.round(p.x), y = Math.round(p.y - bob);
  if (!seated) {
    const s = walking ? Math.floor(t / 120) % 2 : 0;
    R(c, x - 4, y + 6, 4, 6 - s * 2, O); R(c, x + 1, y + 6, 4, 4 + s * 2, O);
  }
  R(c, x - 6, y - 4, 13, 11, O); R(c, x - 5, y - 3, 11, 9, look.shirt); R(c, x - 5, y + 3, 11, 1, look.trim);
  // head
  R(c, x - 9, y - 22, 19, 19, O); R(c, x - 8, y - 21, 17, 17, look.skin);
  R(c, x - 8, y - 21, 17, 6, look.hair); R(c, face > 0 ? x - 8 : x + 5, y - 21, 4, 11, look.hair);
  const ex = face > 0 ? x + 1 : x - 4;
  const blink = Math.floor(t / 2600 + x) % 9 === 0;
  R(c, ex, y - 13, 2, blink ? 1 : 3, O); R(c, ex + 5, y - 13, 2, blink ? 1 : 3, O);
  if (mood > 0) { R(c, ex - 1, y - 9, 2, 1, "#ff8fa3"); R(c, ex + 6, y - 9, 2, 1, "#ff8fa3"); R(c, ex + 2, y - 8, 3, 1, O); }
  else if (mood < 0) R(c, ex + 2, y - 7, 3, 1, O);
  else R(c, ex + 3, y - 8, 1, 1, O);
}
function chair(c: Ctx, x: number, face: 1 | -1) {
  R(c, x - 6, TABLE.y + 2, 13, 4, O); R(c, x - 5, TABLE.y + 3, 11, 2, "#8b5a2b");
  R(c, face > 0 ? x - 7 : x + 5, TABLE.y - 14, 3, 20, O);
  R(c, x - 5, TABLE.y + 6, 2, 18, O); R(c, x + 4, TABLE.y + 6, 2, 18, O);
}
function heart(c: Ctx, x: number, y: number, col: string) {
  R(c, x - 3, y - 2, 3, 3, col); R(c, x + 1, y - 2, 3, 3, col); R(c, x - 3, y, 7, 2, col); R(c, x - 2, y + 2, 5, 1, col); R(c, x - 1, y + 3, 3, 1, col);
}

const SEAT: [Pt, Pt] = [{ x: 70, y: TABLE.y - 4 }, { x: 122, y: TABLE.y - 4 }];
const DOOR: Pt = { x: 172, y: 104 };

export default function Room(p: {
  r: Rehearsal | null; // null while it is still being rehearsed
  place: { name: string; kinds: string[]; vibe: string[] } | null;
  names: [string, string];
  base?: { a: number; b: number } | null; // the twins' scores at the plain cafe, where the meters start
  compact?: boolean;
  startLine?: number;
  onOpen?: () => void;
  label?: string;
}) {
  const { r, names } = p;
  const th = themeOf(p.place);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [allTags, setAllTags] = useState(false);
  const live = useRef({ playing: true, speed: 1, line: -1 });
  live.current.playing = playing;
  live.current.speed = speed;
  const S = useRef({
    pos: [{ ...DOOR }, { x: DOOR.x + 8, y: DOOR.y }] as Pt[], target: [SEAT[0], SEAT[1]] as Pt[],
    waiter: { x: 200, y: 104 } as Pt, waiterTo: { x: 200, y: 104 } as Pt,
    now: 0, until: 2400, step: -1, food: 0, drinks: false, hearts: [] as { x: number; y: number; born: number; col: string }[],
  });

  const go = (i: number) => {
    const s = S.current;
    if (!r) return;
    s.step = i;
    live.current.line = i;
    if (i >= 0 && i < r.lines.length) {
      const l = r.lines[i];
      if (l.act === "leave") s.target = [{ ...DOOR }, { x: DOOR.x + 8, y: DOOR.y }];
      else if (l.act === "walk" || l.act === "look") s.target = [{ x: 40, y: 104 }, { x: 54, y: 104 }];
      else s.target = [SEAT[0], SEAT[1]];
      if (l.act === "order") { s.waiter = { x: 200, y: 104 }; s.waiterTo = { x: 146, y: 104 }; }
      else s.waiterTo = { x: 210, y: 104 };
      if (l.act === "order") s.food = Math.max(s.food, 1);
      if (l.act === "eat") s.food = 2;
      if (l.act === "drink") s.drinks = true;
      s.until = s.now + 1700 + l.say.length * 40;
      const m = r.moments.find((x) => x.line === i);
      if (m) s.hearts.push({ x: SEAT[m.who === "a" ? 0 : 1].x, y: SEAT[0].y - 26, born: s.now, col: m.effect > 0 ? "#ff3d6e" : "#6b6b7a" });
    } else {
      s.target = [{ ...DOOR }, { x: DOOR.x + 8, y: DOOR.y }];
      s.until = Infinity;
    }
    setLine(i);
  };

  const restart = (from = -1) => {
    const s = S.current;
    s.hearts = [];
    s.food = 0;
    s.drinks = false;
    if (from <= 0) { s.pos = [{ ...DOOR }, { x: DOOR.x + 8, y: DOOR.y }]; s.target = [SEAT[0], SEAT[1]]; s.step = -1; s.until = s.now + 2400; setLine(-1); live.current.line = -1; }
    else { s.pos = [{ ...SEAT[0] }, { ...SEAT[1] }]; s.food = 1; go(from); }
    setPlaying(true);
  };

  useEffect(() => {
    if (r && p.startLine !== undefined && p.startLine >= 0) restart(p.startLine);
    // Jump when the caller asks for a specific moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.startLine, r]);

  useEffect(() => {
    const c = canvas.current?.getContext("2d");
    if (!c) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(250, t - last) * (live.current.playing ? live.current.speed : 0);
      last = t;
      const s = S.current;
      s.now += dt;
      const moving = [false, false];
      if (r) {
        s.pos.forEach((q, i) => {
          const tg = s.target[i], v = 0.05 * dt;
          if (Math.abs(q.y - tg.y) > 0.5 && Math.abs(q.x - tg.x) < 30) { q.y += Math.sign(tg.y - q.y) * Math.min(v, Math.abs(tg.y - q.y)); moving[i] = true; }
          else if (Math.abs(q.x - tg.x) > 0.5) { q.x += Math.sign(tg.x - q.x) * Math.min(v, Math.abs(tg.x - q.x)); moving[i] = true; }
          else if (Math.abs(q.y - tg.y) > 0.5) { q.y += Math.sign(tg.y - q.y) * Math.min(v, Math.abs(tg.y - q.y)); moving[i] = true; }
        });
        const w = s.waiter, wt = s.waiterTo;
        if (Math.abs(w.x - wt.x) > 0.5) w.x += Math.sign(wt.x - w.x) * Math.min(0.06 * dt, Math.abs(wt.x - w.x));
        if (s.now >= s.until && s.step < r.lines.length && !moving.some(Boolean)) go(s.step + 1);
      } else {
        s.pos = [{ ...SEAT[0] }, { ...SEAT[1] }];
      }
      room(c, th, s.now);
      chair(c, SEAT[0].x, 1);
      chair(c, SEAT[1].x, -1);
      const cur = r && s.step >= 0 && s.step < r.lines.length ? r.lines[s.step] : null;
      const m = cur && r ? r.moments.find((x) => x.line === s.step) : undefined;
      for (const i of [0, 1]) {
        const atSeat = Math.abs(s.pos[i].x - SEAT[i].x) < 1 && Math.abs(s.pos[i].y - SEAT[i].y) < 1;
        const speaking = cur && (cur.who === "a" ? 0 : 1) === i;
        const laugh = cur?.act === "laugh" ? Math.abs(Math.sin(s.now / 90)) * 2 : 0;
        const bob = speaking ? Math.abs(Math.sin(s.now / 160)) * 1.5 : laugh;
        const mood = m && (m.who === "a" ? 0 : 1) === i ? m.effect : r && s.step >= r.lines.length ? (i === 0 ? r.aAfter : r.bAfter) >= 70 ? 1 : 0 : 0;
        const face: 1 | -1 = atSeat ? (i === 0 ? 1 : -1) : s.target[i].x > s.pos[i].x ? 1 : -1;
        chibi(c, s.pos[i], LOOK[i], face, moving[i], atSeat, bob, s.now, mood);
      }
      table(c, th, s.food, s.drinks, s.now);
      if (s.waiter.x < 196) { chibi(c, s.waiter, LOOK[2], -1, Math.abs(s.waiter.x - s.waiterTo.x) > 0.5, false, 0, s.now, 0); R(c, s.waiter.x - 12, s.waiter.y - 6, 8, 2, "#ddd"); }
      s.hearts = s.hearts.filter((h) => s.now - h.born < 1800);
      for (const h of s.hearts) heart(c, h.x, h.y - (s.now - h.born) / 70, h.col);
      if (!r) { c.fillStyle = "rgba(20,14,30,0.45)"; c.fillRect(0, 0, W, H); }
      // The bubble follows the speaker.
      const b = bubble.current;
      if (b && cur) {
        const q = s.pos[cur.who === "a" ? 0 : 1], fx = Math.max(0, Math.min(100, (q.x / W) * 100));
        b.style.left = `${fx}%`;
        b.style.top = `${((q.y - 26) / H) * 100}%`;
        b.style.transform = `translate(-${fx}%, -100%)`;
        b.style.setProperty("--tail", `${fx}%`);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  // Hearts in the top bar: each twin starts at their plain-cafe score and reaches their final score here, moving
  // at the checked moments (an equal share each); with no moments, at the end.
  const meter = (who: "a" | "b") => {
    if (!r) return null;
    const start = p.base ? (who === "a" ? p.base.a : p.base.b) : 50;
    const end = who === "a" ? r.aAfter : r.bAfter;
    const ms = r.moments.filter((m) => m.who === who);
    if (line >= r.lines.length) return end;
    if (!ms.length) return start;
    return Math.round(start + ((end - start) * ms.filter((m) => m.line <= line).length) / ms.length);
  };
  const cur = r && line >= 0 && line < r.lines.length ? r.lines[line] : null;
  const moment = cur && r ? r.moments.find((m) => m.line === line) : undefined;
  const cited = new Set(r?.moments.map((m) => m.feature) ?? []);
  const hud = (
    <div className="hud">
      <b className="hud-name">{p.label ?? p.place?.name ?? "Plain café"}</b>
      {(["a", "b"] as const).map((w, i) => {
        const v = meter(w);
        return (
          <span key={w} className={`meter ${w}`} title={`${names[i]} wants a second date`}>
            <i>❤</i>
            <span className="bar"><span style={{ width: `${v ?? 0}%` }} /></span>
            <small>{v ?? "…"}</small>
          </span>
        );
      })}
    </div>
  );

  if (p.compact)
    return (
      <button className={`room compact ${r ? "" : "waiting"}`} onClick={p.onOpen} aria-label={`Watch the rehearsal at ${p.place?.name ?? "a plain café"}`}>
        {hud}
        <canvas ref={canvas} width={W} height={H} />
        {!r && <span className="wait">rehearsing…</span>}
        {cur && <span className="mini-say">{cur.who === "a" ? names[0] : names[1]}: {cur.say}</span>}
      </button>
    );

  return (
    <div className="room full">
      {hud}
      <div className="stage">
        <canvas ref={canvas} width={W} height={H} aria-label={`Rehearsal at ${p.place?.name ?? "a plain café"}`} />
        <span className="clock">{cur ? `19:${String(Math.min(59, cur.min)).padStart(2, "0")} · min ${cur.min}` : line < 0 ? "arriving…" : "after dinner"}</span>
        {!r && <span className="wait big">Your twins are rehearsing here…</span>}
        {cur && <div ref={bubble} className={`bubble ${cur.who}`}><b>{cur.who === "a" ? names[0] : names[1]}</b> {cur.say}</div>}
        {moment && (
          <div className={`flash ${moment.effect > 0 ? "up" : "down"}`}>
            {moment.effect > 0 ? "▲" : "▼"} {moment.who === "a" ? names[0] : names[1]}: {moment.because} <b>×</b> Qloo: {moment.feature.replace(/^menu: /, "")}
          </div>
        )}
        {r && line >= r.lines.length && (
          <div className="result">
            <b>After dinner</b>
            <span>{names[0]} wants a second date: {r.aAfter}/100</span>
            <span>{names[1]}: {r.bAfter}/100</span>
            <button className="link" onClick={() => restart()}>Watch again</button>
          </div>
        )}
      </div>
      {r && (
        <div className="controls">
          <button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
          <button onClick={() => restart()} aria-label="Restart">↺</button>
          <button onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}>{speed}×</button>
          <div className="scrub">
            {r.lines.map((l, i) => {
              const m = r.moments.find((x) => x.line === i);
              return <button key={i} className={`${i === line ? "on" : ""} ${m ? (m.effect > 0 ? "up" : "down") : ""}`} title={`min ${l.min}: ${l.say}`} onClick={() => restart(i)} />;
            })}
          </div>
        </div>
      )}
      {r && (
        <div className="qloo-feats">
          <p><b>What Qloo told the twins about {p.place?.name ?? "this café"}</b>: these tags are all they know about the place, food comes only from the menu tags, and every ▲▼ moment must point at one of them. The room is drawn from them too.</p>
          <div>
            {r.features.map((f, i) => ({ f, i })).filter(({ f, i }) => allTags || cited.has(f) || i < 10).map(({ f, i }) => (
              <span key={f} className={`feat ${moment?.feature === f ? "now" : ""} ${cited.has(f) ? "cited" : ""}`}>
                <small>F{i + 1}</small> {f.replace(/^menu: /, "🍽 ")}
              </span>
            ))}
            {!allTags && r.features.length > 10 && <button className="link" onClick={() => setAllTags(true)}>all {r.features.length} tags</button>}
          </div>
        </div>
      )}
    </div>
  );
}
