import Link from "next/link";
import "./ui.css";

export default function Home() {
  return (
    <main className="try home">
      <p className="crumbs">The Garden · Qloo Agentic Hackathon</p>
      <h1>Rehearse your first date before you go.</h1>
      <p className="lede">
        You matched. Now what? Your AI twins try out a whole day together, at real places Qloo&apos;s taste graph picks for both of you,
        a few times over. You get the day that brought them closest: where to go, what to order, and what to talk about.
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
            <b>Two real tastes.</b> You pick favourite films, music, shows and books from Qloo&apos;s 250M+ entities, and so does your
            match (or pick one of our demo twins). Each twin loves exactly those things.
          </li>
          <li>
            <b>Qloo finds the day.</b> For brunch, an afternoon, dinner and drinks, Qloo&apos;s insights find real places in your city
            that <i>both</i> tastes point to, with their menus and vibe.
          </li>
          <li>
            <b>The twins rehearse it.</b> At every candidate place they go on the date twice, and once more at a plain café to compare.
            We measure how much each wants a second date afterwards.
          </li>
          <li>
            <b>You get the best day.</b> The place per slot that raised that wish most, the line that sparked it, what to order from
            the real menu, topics that landed, and ones to skip.
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
