"""Does Qloo's taste graph know who will match? A test on the Columbia speed-dating data.

For every participant, Qloo turns their top interests (rated 7+ out of 10, at most four) into the New York
places they would love (the experiment ran in New York). For every real date, the score is how much the two
people's places overlap. We check how well that score separates mutual matches from the rest (AUC: 0.5 is
chance), against two baselines from the same data: the study's own interest correlation (int_corr) and the
cosine similarity of the raw interest ratings.

usage: uv run scripts/qloo_benchmark.py [--waves 1,2,3] [--take 50]
Writes data/qloo_benchmark.json (git-ignored: it holds Qloo results).
"""
from __future__ import annotations

import argparse
import json
import math
from concurrent.futures import ThreadPoolExecutor

from dotenv import load_dotenv

from garden import speed_dating as sd
from garden.paths import DATA_DIR
from garden.qloo import INTEREST_TAGS, Qloo, affinities, overlap


def auc(scores: list[float], labels: list[int]) -> float:
    """Probability a random match scores above a random non-match (ties count half)."""
    pos = [s for s, l in zip(scores, labels) if l]
    neg = [s for s, l in zip(scores, labels) if not l]
    if not pos or not neg:
        return float("nan")
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def top_interests(row, k: int = 4, floor: float = 7) -> list[str]:
    rated = [(i, row[i]) for i in sd.INTERESTS if row.get(i) == row.get(i) and row[i] >= floor]
    return [i for i, _ in sorted(rated, key=lambda kv: -kv[1])[:k]]


def cosine(a, b) -> float:
    xs = [(a[i], b[i]) for i in sd.INTERESTS if a.get(i) == a.get(i) and b.get(i) == b.get(i)]
    if not xs:
        return float("nan")
    dot = sum(x * y for x, y in xs)
    na, nb = math.sqrt(sum(x * x for x, _ in xs)), math.sqrt(sum(y * y for _, y in xs))
    return dot / (na * nb) if na and nb else float("nan")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--waves", default="")
    ap.add_argument("--take", type=int, default=50)
    a = ap.parse_args()
    load_dotenv()
    dates = sd.load()
    if a.waves:
        dates = dates[dates["wave"].isin([int(w) for w in a.waves.split(",")])]
    people = dates.drop_duplicates("iid").set_index("iid")
    qloo = Qloo()

    def taste(iid: int) -> dict[str, float]:
        tags = [INTEREST_TAGS[i] for i in top_interests(people.loc[iid])]
        if not tags:
            return {}
        return affinities(qloo.insights("place", tags=tags, location="New York City", take=a.take))

    iids = [int(i) for i in people.index]
    with ThreadPoolExecutor(4) as pool:
        tastes = dict(zip(iids, pool.map(taste, iids)))
    print(f"{len(iids)} people, {sum(bool(t) for t in tastes.values())} with a Qloo taste profile")

    # One row per date, seen from the woman's side (each pair once).
    rows = dates[(dates["gender"] == 0) & dates["pid"].notna()]
    out = []
    for _, r in rows.iterrows():
        her, him = int(r["iid"]), int(r["pid"])
        if him not in tastes or not tastes[her] or not tastes[him]:
            continue
        out.append({"her": her, "him": him, "match": int(r["match"]), "qloo": overlap(tastes[her], tastes[him]),
                    "int_corr": float(r["int_corr"]) if r["int_corr"] == r["int_corr"] else None,
                    "cosine": cosine(people.loc[her], people.loc[him])})
    labels = [o["match"] for o in out]
    result = {"pairs": len(out), "matches": sum(labels)}
    for key in ("qloo", "int_corr", "cosine"):
        keep = [(o[key], o["match"]) for o in out if o[key] is not None and o[key] == o[key]]
        result[f"auc_{key}"] = round(auc([s for s, _ in keep], [l for _, l in keep]), 4)
    # Within each woman: is the man whose places overlap most with hers more often a real match?
    by_her: dict[int, list[dict]] = {}
    for o in out:
        by_her.setdefault(o["her"], []).append(o)
    hits = chance = n = 0
    for pairs in by_her.values():
        if len(pairs) < 3 or not any(p["match"] for p in pairs):
            continue
        best = max(pairs, key=lambda p: p["qloo"])
        hits += best["match"]
        chance += sum(p["match"] for p in pairs) / len(pairs)
        n += 1
    result |= {"women": n, "top_pick_is_match": hits, "top_pick_chance": round(chance, 1)}
    print(json.dumps(result, indent=1))
    (DATA_DIR / "qloo_benchmark.json").write_text(json.dumps({"summary": result, "pairs": out}))


if __name__ == "__main__":
    main()
