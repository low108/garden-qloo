import Link from "next/link";
import "./try/try.css";

export default function Home() {
  return (
    <main className="try home">
      <p className="crumbs">The Garden · Qloo Agentic Hackathon</p>
      <h1>Don&apos;t match tastes. Simulate them.</h1>
      <p className="lede">
        Dating apps match people on what they like. We tested that on 4,089 real speed dates: taste overlap predicted who
        matched no better than a coin flip. So in The Garden, your AI twin goes on the first dates for you, in a world built
        from Qloo&apos;s taste graph, and you meet the one it would run away with.
      </p>
      <p>
        <Link className="go" href="/try">
          Send your twin on the dates (about 2 minutes) →
        </Link>
      </p>

      <section className="card">
        <h2>Where Qloo comes in</h2>
        <ol className="steps">
          <li>
            <b>Your twin&apos;s taste is real.</b> You pick favourite films, music, shows and books from Qloo&apos;s 250M+ entities, so
            your twin loves real things, not &ldquo;I like movies&rdquo;.
          </li>
          <li>
            <b>Every date happens somewhere real.</b> The Coordinator asks Qloo for a venue in your city that both twins&apos; tastes point
            to: a rooftop, a bar in the National Gallery, a café by the gardens.
          </li>
          <li>
            <b>The conversation has real common ground.</b> Qloo finds what both of you would probably love but neither listed, and
            the twins can find it on the date.
          </li>
          <li>
            <b>You leave with a plan.</b> If your twins break out together, you get a real first date: places to book and things you
            both love to talk about.
          </li>
          <li>
            <b>And the honest comparison.</b> We show who Qloo taste overlap would have matched you with, next to who your twin
            actually chose.
          </li>
        </ol>
      </section>

      <section className="card">
        <h2>More</h2>
        <ul className="links">
          <li>
            <Link href="/experiment">The experiment</Link>: why taste overlap alone fails, measured on the Columbia speed-dating data.
          </li>
          <li>
            <Link href="/replay">A full 27-day run</Link>: Lina&apos;s twin and seven men, on a pixel map, ending in a breakout with her real-life match.
          </li>
          <li>
            <a href="https://github.com/low108/garden-qloo">Source code</a> (MIT licence).
          </li>
        </ul>
      </section>
      <p className="meta small">
        Demo twins in the pool are fictional people with real favourites. Twins are voiced by GLM on ILMU; tastes, venues and common
        ground come from Qloo.
      </p>
    </main>
  );
}
