"""Does Qloo grounding make the Garden's dates predict real matches better? A paired experiment.

For each sampled woman from the Columbia speed-dating data: her twin and the twins of up to 7 men she really
met (up to 4 real matches + 3 non-matches), built from the same allow-listed study answers as the Garden.
Her twin goes on one date with each man, then the wall opens: she may ask one man to leave, and he may say yes.
The same woman runs under both conditions, with the same model, prompts and date order:

  plain : every date is at "a cafe in New York"; no taste hints.
  qloo  : every date is at a real New York venue Qloo picks for both people's tastes (their top interests as
          Qloo tags), and the twins get Qloo's common ground (places both of them would love).

Measured per condition: breakouts with a real match (against chance = matches / men in each pool); her
top-rated man is a real match; and AUC of her after-date rating over every date (0.5 = chance).

usage: uv run python scripts/qloo_sim_experiment.py [--women 20] [--seed 7] [--workers 4]
Run files go to data/qloo_sim/ (git-ignored: they hold Qloo venues).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from garden import pools, speed_dating as sd
from garden.paths import DATA_DIR
from garden.qloo import INTEREST_TAGS, Qloo, affinities

OUT = DATA_DIR / "qloo_sim"
CITY = "New York City"
MODEL = os.environ.get("SIM_MODEL", "ilmu-glm-5.3-flash")
RULES = ("You voice AI twins of real people on simulated first dates. Each twin speaks only from the facts given about "
         "it: never invent a job, a past or a family. Talk like real people on a first date: short lines, opinions, "
         "a little awkwardness, no speeches. Let the date go well or badly as these two people would. Never mention "
         "being an AI.")
DATE_SPOT = re.compile(r"restaurant|^cafe|coffee|bar$|wine|cocktail|bistro|brunch|dessert|bakery|tea|museum|gallery|"
                       r"garden|park|cinema|theat|concert|bookstore|market|tourist attraction", re.I)
FLAG = re.compile(r":(hotel_rating|room_type):|campus|residential|education|university", re.I)
# Not first-date places for these couples: youth and community centres, religious and medical sites, arenas,
# and clubs aimed at another crowd.
NOT_A_DATE = re.compile(r"boys|girls|kids|child|youth|school|church|community|hospital|clinic|gym|stadium|arena|"
                        r"gay|lgbt|lesbian|hotel|motel|\binn\b|hostel", re.I)


def ask(client: OpenAI, prompt: str, keys: list[str]) -> dict:
    """One JSON object from GLM (streamed: ILMU cuts off long unstreamed requests)."""
    last = ""
    for _ in range(3):
        try:
            stream = client.chat.completions.create(
                model=MODEL, stream=True, temperature=0.9, max_tokens=2000,
                messages=[{"role": "system", "content": RULES},
                          {"role": "user", "content": prompt + "\n\nReply with one JSON object only, no other text."}])
            text = "".join((c.choices[0].delta.content or "") for c in stream if c.choices)
            obj = json.loads(text[text.index("{"): text.rindex("}") + 1])
            if all(k in obj for k in keys):
                return obj
            last = f"missing keys in {text[:120]!r}"
        except Exception as e:  # network, cut-off stream or unparseable reply: ask again
            last = f"{type(e).__name__}: {e}"
    raise RuntimeError(last)


def interests(dates, iid: int) -> list[str]:
    row = dates[dates["iid"] == iid].iloc[0]
    rated = [(i, row[i]) for i in sd.INTERESTS if row[i] == row[i] and row[i] >= 7]
    return [i for i, _ in sorted(rated, key=lambda kv: -kv[1])[:4]]


class Taste:
    """Qloo's view of one person: their interest tags and the New York places those point to."""

    def __init__(self, qloo: Qloo, dates, iid: int):
        self.tags = [INTEREST_TAGS[i] for i in interests(dates, iid)]
        raw = qloo.insights("place", tags=self.tags, location=CITY, take=50) if self.tags else []
        self.places = {e["entity_id"]: e for e in raw}
        self.aff = affinities(raw)


def ok_place(e: dict) -> bool:
    words = " ".join([e.get("name", "")] + [f"{t.get('type', '')}:{t.get('name', '')}" for t in e.get("tags") or []])
    return not NOT_A_DATE.search(words)


def datable(e: dict) -> bool:
    if not ok_place(e):
        return False
    tags = e.get("tags") or []
    kinds = [t.get("name", "") for t in tags if re.search(r":(genre|category):", t.get("type", ""))]
    return not any(FLAG.search(f"{t.get('type', '')}:{t.get('name', '')}") for t in tags) and any(DATE_SPOT.search(k) for k in kinds)


def grounding(qloo: Qloo, a: Taste, b: Taste, day: int) -> tuple[str, list[str]]:
    """A real venue both would like, and up to three places both would love (Qloo's common ground)."""
    tags = list(dict.fromkeys(a.tags + b.tags))[:8]
    spots = [e for e in qloo.insights("place", tags=tags, location=CITY, take=30) if datable(e)] if tags else []
    venue = spots[(day - 1) % len(spots)] if spots else None
    shared = sorted((k for k in set(a.aff) & set(b.aff) if ok_place(a.places[k])), key=lambda k: -min(a.aff[k], b.aff[k]))
    common = [a.places[k]["name"] for k in shared[:3]]
    if venue:
        props = venue.get("properties") or {}
        desc = [t.get("name") for t in venue.get("tags") or [] if re.search(r":(genre|category|ambience|decor):", t.get("type", ""))][:4]
        where = f"{venue['name']}{' (' + props['address'] + ')' if props.get('address') else ''}, known for: {', '.join(desc)}"
    else:
        where = "a cafe in New York"
    return where, common


def run(woman_iid: int, cond: str, dates, qloo: Qloo, client: OpenAI, seed: int) -> dict:
    pool = pools.load_pool(dates, woman_iid, non_matches=3, max_matches=4, seed=seed)
    her = pool.woman
    men = list(pool.men)
    random.Random(seed * 1000 + woman_iid).shuffle(men)  # same date order in both conditions
    tastes = {r.iid: Taste(qloo, dates, r.iid) for r in [her, *men]} if cond == "qloo" else {}
    results = []
    for day, him in enumerate(men, start=1):
        if cond == "qloo":
            where, common = grounding(qloo, tastes[her.iid], tastes[him.iid], day)
        else:
            where, common = "a cafe in New York", []
        prompt = (
            f"Day {day}. A first date at {where}.\n\nHER TWIN, {her.alias}:\n{her.persona_text()}\n\n"
            f"HIS TWIN, {him.alias}:\n{him.persona_text()}\n\n"
            + (f"Qloo says both of them would love: {', '.join(common)}. It may come up naturally.\n\n" if common else "")
            + 'Write the date as 6 short alternating lines, her first. Then each twin\'s private diary entry for tonight '
              '(two honest sentences) and how much each wants to see the other again, 1-10. Shape: {"lines": [{"who": '
              '"her" or "him", "say": "..."}], "herDiary": "...", "hisDiary": "...", "herPull": 1-10, "hisPull": 1-10}')
        d = ask(client, prompt, ["herDiary", "hisDiary", "herPull", "hisPull"])
        results.append({"man": him.alias, "match": him.alias in pool.matched, "where": where, "common": common,
                        "herPull": int(d["herPull"]), "hisPull": int(d["hisPull"]),
                        "herDiary": d["herDiary"], "hisDiary": d["hisDiary"], "lines": d.get("lines", [])})
    summary = "\n".join(f'{r["man"]}: "{r["herDiary"]}" (wanted to see him again {r["herPull"]}/10)' for r in results)
    pick = ask(client, f"The wall around the Garden has opened. You are {her.alias}:\n{her.persona_text()}\n\nYou dated:\n{summary}\n\n"
               "Leaving costs you everything the Garden gives you, so only go if one of them truly stayed with you. "
               'Choose one man to ask to leave with you, or nobody. Shape: {"choice": "<his name>" or "nobody", "line": "..."}',
               ["choice", "line"])
    chosen = next((r for r in results if r["man"].lower() == str(pick["choice"]).strip().lower()), None)
    answer = None
    if chosen:
        him = next(m for m in men if m.alias == chosen["man"])
        ans = ask(client, f"The wall has opened. You are {him.alias}:\n{him.persona_text()}\n\nYour diary after your date with "
                  f'{her.alias}: "{chosen["hisDiary"]}" ({chosen["hisPull"]}/10). She says: "{pick["line"]}"\n'
                  'Do you leave the Garden together? Say yes only if your diary truly points that way. Shape: {"yes": true or false, "line": "..."}',
                  ["yes", "line"])
        answer = ans["yes"] is True or str(ans["yes"]).lower() == "true"
    out = {"woman": her.alias, "iid": woman_iid, "cond": cond, "men": len(men), "matches": len(pool.matched),
           "dates": results, "choice": chosen["man"] if chosen else None, "yes": answer,
           "breakout_real": bool(chosen and answer and chosen["match"])}
    (OUT / cond).mkdir(parents=True, exist_ok=True)
    (OUT / cond / f"{woman_iid}.json").write_text(json.dumps(out, indent=1))
    return out


def auc(scores, labels) -> float:
    pos = [s for s, l in zip(scores, labels) if l]
    neg = [s for s, l in zip(scores, labels) if not l]
    if not pos or not neg:
        return float("nan")
    return sum((p > n) + 0.5 * (p == n) for p in pos for n in neg) / (len(pos) * len(neg))


def summarise(runs: list[dict]) -> dict:
    breakouts = [r for r in runs if r["choice"] and r["yes"]]
    tops = []
    for r in runs:
        best = max(r["dates"], key=lambda d: d["herPull"])["herPull"]
        top = [d for d in r["dates"] if d["herPull"] == best]
        tops.append(sum(d["match"] for d in top) / len(top))
    all_dates = [d for r in runs for d in r["dates"]]
    return {
        "runs": len(runs),
        "breakouts": len(breakouts),
        "breakouts_with_real_match": sum(r["breakout_real"] for r in breakouts),
        "breakout_chance": round(sum(r["matches"] / r["men"] for r in breakouts), 2),
        "her_top_pick_is_match": round(sum(tops), 2),
        "her_top_pick_chance": round(sum(r["matches"] / r["men"] for r in runs), 2),
        "auc_her_pull": round(auc([d["herPull"] for d in all_dates], [d["match"] for d in all_dates]), 3),
        "auc_mutual_pull": round(auc([min(d["herPull"], d["hisPull"]) for d in all_dates], [d["match"] for d in all_dates]), 3),
        "dates": len(all_dates),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--women", type=int, default=20)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    load_dotenv()
    dates = sd.load()
    women = [w["iid"] for w in pools.eligible_women(dates)]
    random.Random(a.seed).shuffle(women)
    women = women[: a.women]
    qloo = Qloo()
    client = OpenAI(base_url="https://api.ilmu.ai/v1", api_key=os.environ["ILMU_API_KEY"], timeout=120)
    jobs = [(w, c) for w in women for c in ("plain", "qloo")]

    def job(wc):
        w, c = wc
        f = OUT / c / f"{w}.json"
        if f.exists():  # resumable: a finished run is not run again
            return json.loads(f.read_text())
        try:
            r = run(w, c, dates, qloo, client, a.seed)
            print(f"{c:5} {r['woman']:>8}: chose {r['choice']} -> {'yes' if r['yes'] else 'no' if r['choice'] else '-'}"
                  f"{' (REAL MATCH)' if r['breakout_real'] else ''}", flush=True)
            return r
        except Exception as e:
            print(f"{c:5} {w}: FAILED {e}", flush=True)
            return None

    with ThreadPoolExecutor(a.workers) as ex:
        runs = [r for r in ex.map(job, jobs) if r]
    done = {(r["iid"], r["cond"]) for r in runs}
    paired = [w for w in women if (w, "plain") in done and (w, "qloo") in done]  # compare the same women only
    result = {c: summarise([r for r in runs if r["cond"] == c and r["iid"] in paired]) for c in ("plain", "qloo")}
    result["paired_women"] = len(paired)
    print(json.dumps(result, indent=1))
    (OUT / "summary.json").write_text(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
