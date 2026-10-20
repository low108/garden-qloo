# Rehearse your first dinner (Qloo Agentic Hackathon)

You matched. Qloo picks the restaurants you would both love, your AI twins have dinner at every one of them (you can
watch each one as a Tuber Simulator-style room), and you get the three where they fell for each other most, with the
exact lines and minutes where something about one of you met something Qloo knows about the place.

- **Live demo:** https://garden-qloo.vercel.app (rehearse a dinner: under a minute)

## How Qloo powers it

| Step | Qloo |
|---|---|
| Two real tastes | `/search`: you (and your match) pick real films, artists, shows and books; each twin loves those entities |
| The restaurants | `/v2/insights` with `filter.type=urn:entity:place`, both people's entities as the signal, `filter.location.query`=your city, `filter.tags`=restaurant and `filter.price_level.max`=the lower budget; Qloo's top 10 are all rehearsed, in Qloo's order, with no ranking of ours |
| Can both go | Qloo's typed tags: `dietary_option` (halal, vegetarian, vegan) via `operator.filter.tags=intersection`, and `filter.price_level.max` for the budget; bars are dropped if either person doesn't drink |
| The rooms | each rehearsal plays as a Tuber Simulator-style pixel room (canvas, no engine) decorated from the restaurant's Qloo kinds and tags; the twins act out each line, and a proof moment lights up the Qloo tag it cites |
| Proof | each place's Qloo features are numbered (F1…); every moment the twins report must cite a real line, a real profile item and a real feature, or it is dropped |
| What to order | each place's `menu_highlight` tags: the twins may only order those |
| The demo twins | `/search` resolves each fictional twin's stated favourites to real entities |

The twins (GLM-5.3 on ILMU, ILMU-mini as fallback) rehearse every restaurant once and a plain cafe once as a
baseline; the top three are the restaurants where both want a second date most, compared with the cafe. Qloo responses are
cached privately on the server and never committed.

## Run it

Needs Node.js 20 or newer, a Qloo API key, and an OpenAI-compatible chat API for the twins (the live demo uses
GLM-5.3 on [ILMU](https://ilmu.ai)).

```bash
git clone https://github.com/low108/garden-qloo.git
cd garden-qloo/web
npm install
cp .env.example .env.local   # then fill in QLOO_API_KEY and ILMU_API_KEY
npm run dev                  # open http://localhost:3000/plan
```

| Variable | Needed | What it is |
|---|---|---|
| `QLOO_API_KEY` | yes | Qloo API key, sent as `X-Api-Key` |
| `QLOO_BASE_URL` | no | defaults to `https://hackathon.api.qloo.com` |
| `ILMU_API_KEY` | yes | key for the chat API that voices the twins |
| `ILMU_BASE_URL` | no | any OpenAI-compatible endpoint with streaming; defaults to `https://api.ilmu.ai/v1` |
| `LLM_MODELS` | no | models to try in order, comma-separated; defaults to `ilmu-glm-5.3-flash,ilmu-mini-v3.3` |

Checks: `npx tsc --noEmit` and `npm run lint`. Production build: `npm run build && npm start`.

**Deploy:** the live demo runs on Vercel with `web/` as the project root and the two keys set as environment
variables. `scripts/deploy_vercel.sh` deploys a copy of `web/` with `vercel deploy --prod`.

## How the code is laid out

| Path | What it does |
|---|---|
| `web/app/page.tsx` | The landing page |
| `web/app/plan/page.tsx` | The app: five setup screens, the building of rooms, the top three with proof, the table of every dinner |
| `web/app/plan/Room.tsx` | The pixel room: decor from Qloo tags, the twins acting out each line, heart meters, proof moments |
| `web/lib/profile.ts` | The first-date questions and the profile items a proof moment may cite |
| `web/lib/server/qloo.ts` | Qloo client: `/search` and `/v2/insights`, rate limiting, retries and private caching |
| `web/lib/server/planner.ts` | Picks the restaurants (Qloo plus the hard rules), runs a rehearsal, checks every proof moment |
| `web/lib/server/garden.ts` | The eight demo twins |
| `web/lib/server/llm.ts` | Streaming client for the OpenAI-compatible chat API, with model fallback |
| `web/app/api/*` | `search`, `cast`, `candidates`, `rehearse` |
| `scripts/qloo_benchmark.py`, `scripts/qloo_sim_experiment.py` | The experiments behind the idea (need the Kaggle speed-dating CSV in `data/raw/`; run with `uv run python …`) |

Everything else (`garden/`, `api/`, `tests/`, `Makefile`, `firebase.json`, `firestore.rules`, `deploy/`) is the
original project this grew from, The Garden, a multi-day agent simulation of AI dating twins
([low108/dj_is_hung](https://github.com/low108/dj_is_hung)). The planner doesn't use it, and it isn't needed to run
the demo.

## Licence

MIT, see [LICENSE](LICENSE).
