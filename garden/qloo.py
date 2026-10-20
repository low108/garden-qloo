"""Qloo's taste graph (hackathon API): search entities, look up tags, and get insights (recommendations with
an affinity score). Every response is cached on disk under data/qloo_cache/, which is git-ignored: Qloo
allows private caching but not publishing its data.

Needs QLOO_API_KEY. Hackathon keys only work on https://hackathon.api.qloo.com and are sent as X-Api-Key.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import httpx

from .paths import DATA_DIR

BASE_URL = os.environ.get("QLOO_BASE_URL", "https://hackathon.api.qloo.com")
CACHE_DIR = DATA_DIR / "qloo_cache"

# A speed-dating interest -> the Qloo tag that best stands for it (looked up with /v2/tags).
INTEREST_TAGS = {
    "sports": "urn:tag:genre:place:sports",
    "tvsports": "urn:tag:good_for:qloo:watching_sports",
    "exercise": "urn:tag:genre:media:exercise",
    "dining": "urn:tag:culinary_style:qloo:fine_dining",
    "museums": "urn:tag:genre:media:museums",
    "art": "urn:tag:genre:place:art",
    "hiking": "urn:tag:activities:place:hiking",
    "gaming": "urn:tag:genre:media:video_games",
    "clubbing": "urn:tag:dining_option:qloo:nightclub",
    "reading": "urn:tag:good_for:qloo:reading",
    "tv": "urn:tag:category:place:television",
    "theater": "urn:tag:offerings:place:theater",
    "movies": "urn:tag:genre:media:movies",
    "concerts": "urn:tag:good_for:qloo:concerts",
    "music": "urn:tag:genre:place:music",
    "shopping": "urn:tag:genre:place:shopping",
    "yoga": "urn:tag:amenity:qloo:yoga",
}


class QlooError(RuntimeError):
    pass


class Qloo:
    def __init__(self, api_key: str | None = None, cache_dir: Path = CACHE_DIR, min_interval: float = 0.15):
        self._key = api_key or os.environ.get("QLOO_API_KEY")
        if not self._key:
            raise QlooError("QLOO_API_KEY is not set")
        self._cache = cache_dir
        self._cache.mkdir(parents=True, exist_ok=True)
        self._client = httpx.Client(base_url=BASE_URL, headers={"X-Api-Key": self._key}, timeout=30)
        self._min_interval = min_interval  # stay well under the per-minute rate limit
        self._last = 0.0

    def get(self, path: str, params: dict) -> dict:
        """GET a Qloo endpoint, from the cache when this exact request was made before."""
        key = hashlib.sha256(json.dumps([path, sorted(params.items())]).encode()).hexdigest()[:24]
        f = self._cache / f"{key}.json"
        if f.exists():
            return json.loads(f.read_text())
        for attempt in range(4):
            wait = self._min_interval - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            r = self._client.get(path, params=params)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code != 200:
                raise QlooError(f"{path} returned {r.status_code}: {r.text[:200]}")
            data = r.json()
            f.write_text(json.dumps(data))
            return data
        raise QlooError(f"{path} kept failing ({r.status_code})")

    def search(self, query: str, types: str | None = None, take: int = 5) -> list[dict]:
        params = {"query": query, "take": take} | ({"types": types} if types else {})
        return self.get("/search", params).get("results") or []

    def insights(self, entity_type: str, *, entities: list[str] = (), tags: list[str] = (),
                 location: str | None = None, take: int = 20) -> list[dict]:
        """Recommendations of one entity type for a taste signal, each with query.affinity (0-1)."""
        params = {"filter.type": f"urn:entity:{entity_type}", "take": take}
        if entities:
            params["signal.interests.entities"] = ",".join(entities)
        if tags:
            params["signal.interests.tags"] = ",".join(tags)
        if location:
            params["filter.location.query"] = location
        return (self.get("/v2/insights", params).get("results") or {}).get("entities") or []


def affinities(entities: list[dict]) -> dict[str, float]:
    """entity_id -> affinity, from an insights response."""
    return {e["entity_id"]: float((e.get("query") or {}).get("affinity") or 0) for e in entities}


def overlap(a: dict[str, float], b: dict[str, float]) -> float:
    """Weighted Jaccard of two taste profiles (entity -> affinity): 0 = nothing shared, 1 = identical."""
    keys = a.keys() | b.keys()
    if not keys:
        return 0.0
    num = sum(min(a.get(k, 0), b.get(k, 0)) for k in keys)
    den = sum(max(a.get(k, 0), b.get(k, 0)) for k in keys)
    return num / den if den else 0.0
