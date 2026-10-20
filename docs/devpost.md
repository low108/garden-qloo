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
social energy, first-date nerves, talk or do, new or familiar, food needs, alcohol and budget. Qloo finds real places in your
city for brunch, an afternoon, dinner and after dinner that both tastes point to. Your AI twins then rehearse the date at each
place, and once at a plain café for comparison, and you watch it as a Smallville-style pixel scene: they walk in, order,
stroll and talk in speech bubbles.

You get the day that raised both twins' wish for a second date most, and the proof for every stop: the quoted line and minute
where something about one of you (an introvert, a Spirited Away fan, halal only) met something Qloo knows about the place
(Quiet, Japanese, halal-tagged). Plus what to order from the real menu and what to watch out for.

## How it chooses where to rehearse
1. **Four slots, each with Qloo place categories:** brunch (café, brunch, bakery), afternoon (museum, art gallery, park,
   bookshop, board-game café), dinner (restaurant) and after dinner (cocktail bar, wine bar, bar, live music; or dessert, tea
   house, night market and live music if either person doesn't drink).
2. **Both tastes as one signal:** for each slot, `/v2/insights` gets every favourite of both people as
   `signal.interests.entities`, the city as `filter.location.query` and the slot's categories as `filter.tags`. Qloo returns
   places people with both tastes tend to love, in order of affinity (up to 25 per slot).
3. **Hard rules remove places:** for meals, each diet need is sent as a Qloo `dietary_option` tag with
   `operator.filter.tags=intersection`, so a place must be, say, a café and halal. Then we drop places above the lower of the two
   budgets (Qloo `price_level`), bars if either doesn't drink, places that aren't for dates (hotels, places of worship, schools,
   shops, offices) and, for meals, street addresses and whole neighbourhoods.
4. **Fit to the two people ranks the rest**, from each place's Qloo tags:
   - an introvert: +1 if quiet (cosy, calm, intimate…), −1.5 if loud (lively, bustling, nightlife…);
   - an extravert: +1 if lively;
   - nervous, or prefers doing something: +1 if there is something to do side by side (museum, gallery, park, market, live
     music…);
   - loves trying new things: +0.7 if unusual (quirky, themed, hidden gem…); prefers the familiar: −0.5;
   - +0.4 for each place tag that echoes a favourite (a "Japanese" garden for a Spirited Away fan);
   - +0.5 for a meal place with Qloo menu highlights, so the twins have real dishes to order.

   Ties keep Qloo's own order. The top two per slot go forward, and no place is used twice in the day.
5. **Rehearse and compare:** the twins go on the date once at each of these (up to eight) places and once at a plain café with no Qloo
   data. For each slot, the plan takes the place where both twins' wish for a second date (0–100, averaged) rose most above the
   café.

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
