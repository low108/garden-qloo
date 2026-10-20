import Link from "next/link";
import "./ui.css";

export default function Home() {
  return (
    <main className="try home">
      <p className="crumbs">The Garden · Qloo Agentic Hackathon</p>
      <h1>Rehearse your first dinner before you go.</h1>
      <p className="lede">
        You matched. Now where do you eat? Qloo picks the restaurants you would both love, your AI twins have dinner at every one of
        them, and you get the three where they fell for each other most, with the exact moments that prove why.
      </p>
      <p>
        <Link className="go" href="/plan">
          Rehearse our dinner (under a minute) →
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
            <b>Qloo picks the restaurants.</b> Qloo&apos;s insights take both tastes together and return the restaurants in your city
            that people with <i>both</i> tastes love, already filtered by Qloo for your food needs (halal, vegetarian, vegan) and your
            budget. We rank nothing: Qloo&apos;s top ten are all rehearsed.
          </li>
          <li>
            <b>The twins have dinner everywhere at once, and you watch.</b> Each restaurant is a little room in the style of Tuber
            Simulator, decorated from its Qloo tags (lanterns, an aquarium, a skyline window, a wine shelf). The twins sit, order from
            the real menu tags and talk in speech bubbles while heart meters rise and fall. A plain café is rehearsed too, to compare.
          </li>
          <li>
            <b>You get the top three, with proof.</b> The restaurants where both twins&apos; wish for a second date rose most above the
            café, and for each, the moments that did it: the quoted line, the minute, and which thing about one of you (an introvert, a
            Spirited Away fan) met which Qloo tag of the place (Cozy, Japanese). Every moment is checked against the real profile and the
            real tags. Click one to watch it happen.
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
