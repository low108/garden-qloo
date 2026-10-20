# Rehearse your first date (Devpost draft)

## Inspiration
In Black Mirror's "Hang the DJ", simulated versions of two people live out a relationship so the real ones know if it works. We
asked the smaller, more useful question: you already matched, so where should your first day together go?

## What it does
You and your match each pick favourite films, music, shows and books (real Qloo entities) and answer seven quick questions:
social energy, first-date nerves, talk or do, new or familiar, food needs, alcohol and budget. Qloo finds real places in your
city for brunch, an afternoon, dinner and after dinner that both tastes point to. Your AI twins then rehearse the date at each
place, and once at a plain café for comparison, and you watch it as a Smallville-style pixel scene: they walk in, order,
stroll and talk in speech bubbles.

You get the day that raised both twins' wish for a second date most, and the proof for every stop: the quoted line and minute
where something about one of you (an introvert, a Spirited Away fan, halal only) met something Qloo knows about the place
(Quiet, Japanese, halal-tagged). Plus what to order from the real menu and what to watch out for.

## How we use Qloo
- **Search:** every favourite is a Qloo entity, resolved with `/search`.
- **Insights as the planner:** `/v2/insights` with both people's entities as `signal.interests.entities`, the city as
  `filter.location.query`, and a slot's place categories as `filter.tags`: places people with *both* tastes love.
- **Hard needs as Qloo filters:** halal, vegetarian and vegan go in as Qloo `dietary_option` tags with
  `operator.filter.tags=intersection`; the budget is checked against Qloo's `price_level`; bars are swapped for dessert, tea
  houses and night markets if either person doesn't drink.
- **Personality fit from Qloo tags:** noise, ambience and kind tags rank the places (quiet for introverts, lively for
  extraverts, something to do side by side for nervous daters).
- **Qloo tags are the twins' world:** each place's tags and menu highlights are numbered (F1, F2…) and are everything the twins
  know; they may only order from the menu tags. The pixel scene is drawn from the same tags.
- **Checked reasons:** every moment the twins report must cite a real line, a real profile item and a real Qloo tag, or it is
  dropped. The plain café with no Qloo data is the baseline, so each place's score is what Qloo's choice added.

## Why a planner and not a matchmaker
We measured it first. On 4,089 real speed dates, Qloo taste overlap alone did not predict matches (AUC 0.48). Simulated dates
grounded in Qloo did beat ungrounded ones (AUC 0.56 vs 0.51 on 60 people), but modestly. Taste is a better guide to *where*
two people will enjoy each other than to *whether* they will, so we built that.

## How we built it
Next.js 15 on Vercel; Qloo's hackathon API; GLM-5.3 on ILMU for the twins (OpenAI-compatible, streaming, with a smaller model
as fallback); a canvas renderer for the scenes, with no game engine. Qloo responses are cached privately on the server and
never committed.

## Challenges
- Qloo's place results include hotels, schools, clubhouses and whole neighbourhoods; we filter them with Qloo's typed tags and
  a few rules.
- Keeping the LLM honest: numbered profile items and features let us verify every claimed reason.

## What's next
Several rehearsals per place to measure variance, booking links, and letting both people react to the plan.

Try it: https://garden-qloo.vercel.app/plan · Code (MIT): https://github.com/low108/garden-qloo
