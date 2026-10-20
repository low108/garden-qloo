# Rehearse your first date (Devpost draft)

## The problem
Matching is no longer the hard part of dating; turning a match into a good first date is.

- **Promising chats die before anyone meets.** In Hinge's research for its Date Ideas feature, 76% of daters said a
  conversation had fizzled out because they didn't know the right moment to ask someone out.
- **Apps leave people disappointed.** In the 2024 Singles Dating Survey by Lunch Actually Paktor Group (350 singles in
  Singapore), 66% associated dating apps with disappointment, 62% said their efforts rarely led to satisfying outcomes, and 88%
  had taken a break from the apps.
- **A good plan matters more than money.** In a Hinge survey of its daters, 89% of women said it is more impressive when someone
  takes the time to plan a thoughtful date than when they spend a lot, and nearly half (48%) said trying a new activity together
  is what lets them connect most deeply.

But planning a thoughtful first date for someone you have only texted is hard. You have to guess what they would enjoy, respect
needs you may not know about yet (halal, vegetarian, no alcohol, a budget), and pick somewhere that suits both personalities:
a loud bar can sink an introvert, a silent café can sink a nervous pair with nothing to do. Generic "date ideas" lists don't
know either of you.

## What it does
You and your match each pick favourite films, music, shows and books (real Qloo entities) and answer seven quick questions:
social energy, first-date nerves, talk or do, new or familiar, food needs, alcohol and budget. Qloo picks the restaurants in
your city that both tastes point to. Your AI twins then have dinner at every one of them at once, plus a plain café for
comparison, and you can watch each dinner live as a little room in the style of PewDiePie's Tuber Simulator: themed decor
from the restaurant's Qloo tags, the twins at a table ordering from the real menu tags, speech bubbles and heart meters.

You get the top three restaurants by how much affection rose over the café, and the proof for each: the quoted line and minute
where something about one of you (an introvert, a Spirited Away fan, halal only) met something Qloo knows about the place
(Cozy, Japanese, halal-tagged). Click any moment to watch it play.

## How it chooses the restaurants
1. **Both tastes as one signal:** `/v2/insights` gets every favourite of both people as `signal.interests.entities`, the city
   as `filter.location.query` and `urn:tag:category:place:restaurant` as `filter.tags`.
2. **Hard needs as Qloo filters:** the lower of the two budgets goes in as `filter.price_level.max`; each diet need goes in as a
   Qloo `dietary_option` tag with `operator.filter.tags=intersection`, so a restaurant must also be, say, halal.
3. **A few rules remove non-date places:** hotels, places of worship, schools, shops, offices, members' clubs, street
   addresses and whole neighbourhoods, and bars if either person doesn't drink.
4. **No ranking of ours:** Qloo's top ten that remain, in Qloo's order, are all rehearsed.
5. **The rehearsals rank them:** each twin says how much they want a second date (0-100) after dinner; the top three are the
   restaurants where the average rose most above the plain café.

## How we use Qloo
- **Search:** every favourite is a Qloo entity, resolved with `/search`.
- **Insights as the planner:** `/v2/insights` with both people's entities as `signal.interests.entities`, the city as
  `filter.location.query`, and restaurants as `filter.tags`: places people with *both* tastes love.
- **Hard needs as Qloo filters:** halal, vegetarian and vegan go in as Qloo `dietary_option` tags with
  `operator.filter.tags=intersection`; the budget goes in as `filter.price_level.max`.
- **Qloo tags are the twins' world:** each place's tags and menu highlights are numbered (F1, F2…) and are everything the twins
  know; they may only order from the menu tags. Each room's decor is drawn from the same tags.
- **Checked reasons:** every moment the twins report must cite a real line, a real profile item and a real Qloo tag, or it is
  dropped. The plain café with no Qloo data is the baseline, so each place's score is what Qloo's choice added.

## Sources
- Hinge, Date Ideas launch research (76% of daters let a conversation fizzle): https://www.hercampus.com/wellness/hinge-date-ideas-feature-how-works/
- Lunch Actually Paktor Group, 2024 Singles Dating Survey, as reported by MustShareNews (18 Oct 2024): https://mustsharenews.com/matchmaking-poll-dating/
- Hinge newsroom, first dates that bring out your playful side (89%, 48%): https://hinge.co/newsroom/date-ideas-play

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
