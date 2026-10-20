# Rehearse your first date · The Garden, with taste (Qloo Agentic Hackathon)

You matched. Now your AI twins rehearse a whole day together, at real places Qloo's taste graph picks for both
of you, and you get the day that brought them closest, with proof: the lines from the rehearsal where something
about one of you (an introvert, a Spirited Away fan, halal only) met something about the place (quiet, Japanese,
Qloo-tagged halal), and the minute it happened.

- **Live demo:** https://garden-qloo.vercel.app (plan a day: about a minute)

## How Qloo powers it

| Step | Qloo |
|---|---|
| Two real tastes | `/search`: you (and your match) pick real films, artists, shows and books; each twin loves those entities |
| The day's candidates | `/v2/insights` with `filter.type=urn:entity:place`, both people's entities as the signal, `filter.location.query`=your city, and `filter.tags` per slot (cafe/brunch/bakery, museum/gallery/park, restaurant, cocktail/wine bar); Qloo's top 5 per slot are all rehearsed, in Qloo's order, with no ranking of ours |
| Can both go | Qloo's typed tags: `dietary_option` (halal, vegetarian, vegan) via `operator.filter.tags=intersection`, `price_level` against the budget, bars swapped for dessert/tea/night markets if one doesn't drink |
| The scene | each rehearsal plays as a pixel-art scene (canvas, no engine) whose setting and props come from the place's Qloo kinds and tags; the twins act out each line, and a proof moment lights up the Qloo tag it cites |
| Proof | each place's Qloo features are numbered (F1…); every moment the twins report must cite a real line, a real profile item and a real feature, or it is dropped |
| What to order | each place's `menu_highlight` tags: the twins may only order those |
| The demo twins | `/search` resolves each fictional twin's stated favourites to real entities |

The twins (GLM-5.3 on ILMU, ILMU-mini as fallback) rehearse every candidate once and a plain cafe once as a
baseline; each place is scored by how much more both want a second date than at the cafe. Qloo responses are
cached privately on the server and never committed.

## Run it

```bash
cd web && npm install
printf "QLOO_API_KEY=...\nILMU_API_KEY=...\n" > .env.local   # Qloo hackathon key, ILMU key
npm run dev                                                    # http://localhost:3000/plan
```

Deploy: `scripts/deploy_vercel.sh`. Benchmark (needs the Kaggle speed-dating CSV in `data/raw/`):
`uv run python scripts/qloo_benchmark.py`.

Built on The Garden (a Concordia agent simulation of AI dating twins); the original project's README follows.

---

# dj_is_hung

Breakout Matching prototype, inspired by Black Mirror's "Hang the DJ". AI twins live in a simulated Garden; a pair is a match only when both twins choose to cross the wall together. The full plan is in the spec issue (#1).

## Layout

| Folder | What it is |
| --- | --- |
| `garden/` | The simulation engine. Seam: `run_world(config, model) -> RunResult` |
| `api/` | FastAPI service: `POST /simulations`, `GET /simulations/{id}` (+ `/events`, `/twins`), `GET /replays`, `GET /replays/{sim}/{run}` |
| `web/` | Next.js web app |
| `tests/` | Pytest tests, driven by the scripted fake model |

## Run locally

Needs Node 20+, [uv](https://docs.astral.sh/uv/) and Java (for the Firestore emulator).

```bash
make install
```

Then, each in its own terminal:

```bash
make emulator   # Firestore on :8080, Auth on :9099, UI on :4000
make api        # API on :8001 (reads .env for model keys)
make web        # web app on :3000
```

Open the web app, pick a fake-model scenario and click **Start simulation**. Every finished run is saved to `data/replays/`; pick one under **Saved runs** (or **Replay last run**) to watch it again without any model calls.

- Without the emulator, start the API with `uv run uvicorn api.main:app --port 8001`; it keeps records in memory instead.
- If the API runs elsewhere, set `NEXT_PUBLIC_API_URL` in `web/.env.local`.
- Ports can be changed with `make api API_PORT=…` and `cd web && npm run dev -- -p …`.

## Test

```bash
make test
```

## Data: Columbia Speed Dating

Demo twins are built from the Columbia Speed Dating dataset: 551 participants and 8,378 four-minute dates (2002–2004), with both people's yes/no decisions recorded.

> Fisman, R., Iyengar, S. S., Kamenica, E., & Simonson, I. (2006). Gender Differences in Mate Selection: Evidence from a Speed Dating Experiment. *Quarterly Journal of Economics*, 121(2), 673–697.

The data isn't redistributed here. Download `Speed Dating Data.csv` from [Kaggle](https://www.kaggle.com/annavictoria/speed-dating-experiment) (the release with participant IDs `iid`/`pid`) and save it as `data/raw/speed_dating.csv` (git-ignored). Check the licence on the Kaggle page before any public use.

- Only fields collected **before** the dates reach a twin (`garden/speed_dating.py`, `PRE_DATE_FIELDS`). Decisions, partner ratings and follow-up surveys are the answer key.
- Every seed memory cites the field it came from. An optional LLM rewrite makes memories sound natural; rewrites with no valid source or with invented numbers are rejected.
- The dataset has no personality inventory, so dataset twins carry no rebelliousness memory.
- The data is anonymised; don't attempt to re-identify participants.

```bash
uv run python scripts/build_twin.py 132          # template memories
uv run python scripts/build_twin.py 132 --llm    # rewritten by TWIN_MODEL
```

## Real models (ILMU for development, Gemini / Gemma for the demo)

Twins run as Concordia agents (`garden/concordia_twins.py`). `TWIN_MODEL` picks the model as `provider:model`. Put keys in `.env` (git-ignored):

```
TWIN_MODEL=ilmu:ilmu-mini-v3.3      # development (ILMU credits, fast, no tight rate limits)
# TWIN_MODEL=gemini:gemini-3.5-flash  # the submitted demo must use Gemini or Gemma
ILMU_API_KEY=sk-...
GEMINI_API_KEY=...
GEMINI_RPM=5   # only on the Gemini free tier: paces requests to 5 per minute per model
```

ILMU is reached through its OpenAI-compatible API (`https://api.ilmu.ai/v1`); Gemini and Gemma through the Google Gen AI SDK.

Measure one real run (calls, tokens, model time, and a projection for a 10-day run):

```bash
uv run python scripts/measure_run.py --days 2
uv run python scripts/measure_run.py --model gemini:gemini-3.5-flash-lite --men 2 --days 2
```

The free tier allows about 5 requests per minute and 20 per day per model, which is enough for a small measurement but not for demo-sized simulations. Those need billing enabled on the key's Google Cloud project.

## Simulation viewer

`web/app/garden/` draws the Garden with Phaser 3 (shapes in code, no third-party tileset or sprites, so there is no art licence to track) and walks twins between places with EasyStar.js pathfinding. It plays the featured run's feed events in order, live or after the fact. Libraries: Phaser 3.90.0 (MIT), EasyStar.js 0.4.4 (MIT).

**Build your own twin** (`/onboarding`): sign in (locally the Auth emulator offers fake accounts), consent, then answer 15 questions one per screen; a short answer gets one follow-up from Gemini Flash (a template follow-up when no `GEMINI_API_KEY` is set). Progress is saved, so you can leave and resume.

## Public demo deploy

`PROJECT=<gcp-project> scripts/deploy.sh` puts the API on Cloud Run (one always-on instance; scripted
twins, plus one ILMU run at a time, via `ALLOWED_MODELS`, `MAX_REAL_SIMS`, `MAX_REAL_RUNS`) and the web
app on Firebase Hosting as static files, with sign-in off and only the demo replay listed. The image
holds the code, the speed-dating CSV and the demo replay, and stays private to the project.
