import Link from "next/link";
import "./ui.css";

export default function Home() {
  return (
    <main className="try home">
      <p className="crumbs">The Garden · Qloo Agentic Hackathon</p>
      <h1>Rehearse your first date before you go.</h1>
      <p className="lede">
        You matched. Now what? Your AI twins try out a whole day together, at real places Qloo&apos;s taste graph picks for both of you.
        You get the day that brought them closest, and the moments from the rehearsal that prove why each place works for you two.
      </p>
      <p>
        <Link className="go" href="/plan">
          Plan our day (about a minute) →
        </Link>
      </p>

      <section className="card">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <b>Two real people.</b> You pick favourite films, music, shows and books from Qloo&apos;s 250M+ entities, and answer a few quick
            questions: introvert or extravert, first-date nerves, talk or do, new or familiar, food needs, alcohol, budget. So does your
            match (or pick one of our demo twins).
          </li>
          <li>
            <b>Qloo finds the day.</b> For brunch, an afternoon, dinner and drinks, Qloo&apos;s insights find real places in your city
            that <i>both</i> tastes point to, filtered by Qloo&apos;s halal and vegetarian tags and price level, and ranked by fit: quiet
            places for introverts, something to do side by side for nervous daters, no bars if one of you doesn&apos;t drink.
          </li>
          <li>
            <b>The twins rehearse it.</b> They go on the date once at every candidate place, and once at a plain café to compare. We
            measure how much each wants a second date afterwards, and they mark the lines where something about one of them met
            something about the place.
          </li>
          <li>
            <b>You get the best day, with proof.</b> The place per slot that raised that wish most, and why: the quoted line, the minute,
            what about the person (an introvert, a Spirited Away fan) met what about the place (quiet, Japanese). Every moment is
            checked against the real profile and the real Qloo features. Plus what to order and what to watch out for.
          </li>
        </ol>
      </section>

      <section className="card">
        <h2>More</h2>
        <ul className="links">
          <li>
            <a href="https://github.com/low108/garden-qloo">Source code</a> (MIT licence).
          </li>
        </ul>
      </section>
      <p className="meta small">
        Demo twins are fictional people with real favourites. Places, menus and taste come from Qloo; the twins are voiced by GLM-5.3 on
        ILMU. Rehearsals are simulations: a guide to a good day, not a guarantee.
      </p>
    </main>
  );
}
