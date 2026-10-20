import Link from "next/link";
import "../try/try.css";

export const metadata = { title: "The experiment · The Garden" };

export default function Experiment() {
  return (
    <main className="try">
      <nav className="crumbs">
        <Link href="/">The Garden</Link> · <Link href="/try">Try it</Link> · <Link href="/replay">A full 27-day run</Link>
      </nav>
      <h1>Does matching tastes find love?</h1>
      <p className="lede">We tested the obvious way to use a taste graph for dating, and it failed. That&apos;s why The Garden simulates instead.</p>

      <section className="card">
        <h2>The data</h2>
        <p>
          The Columbia University speed-dating experiment (Fisman &amp; Iyengar, 2002–2004): real people on real four-minute dates, each
          saying whether they wanted to meet the other again. A mutual yes is a match. We used every date with both people&apos;s answers:{" "}
          <b>4,089 dates, 674 mutual matches</b>.
        </p>
      </section>

      <section className="card">
        <h2>Test 1 · Match by taste</h2>
        <p>
          For every participant, Qloo turned their top interests (rated 7+ out of 10) into the New York places they would love, with an
          affinity score for each. For every date, the score was how much the two people&apos;s places overlapped. AUC measures how well a
          score separates matches from non-matches: <b>0.5 is a coin flip</b>.
        </p>
        <table className="results">
          <thead>
            <tr><th>Predictor</th><th>AUC</th></tr>
          </thead>
          <tbody>
            <tr><td>Qloo taste overlap</td><td><b>0.48</b></td></tr>
            <tr><td>The study&apos;s own interest correlation</td><td>0.53</td></tr>
            <tr><td>Similarity of interest ratings</td><td>0.53</td></tr>
          </tbody>
        </table>
        <p>
          For 216 women, the man whose taste overlapped hers most was a real match <b>45 times; chance says 45.3</b>. Shared taste
          tells you who you could talk to, not who you&apos;ll choose.
        </p>
      </section>

      <section className="card">
        <h2>Test 2 · Simulate</h2>
        <p>
          In The Garden, each woman&apos;s twin meets the twins of seven men she really dated (some real matches, some not; the twins never
          see the answer) over about 27 simulated days. We ran it 10 times: 8 runs for one woman, 2 for another.
        </p>
        <table className="results">
          <thead>
            <tr><th>Result</th><th>Garden</th><th>Chance</th></tr>
          </thead>
          <tbody>
            <tr><td>Breakouts with a real-life match</td><td><b>7 / 10</b></td><td>5.1</td></tr>
            <tr><td>Breakout called early from her free approaches</td><td><b>4.5 / 10</b></td><td>1.4</td></tr>
          </tbody>
        </table>
        <p className="meta">
          Honest caveats: 10 runs is small. The early call is the stronger result (p ≈ 0.01); the real-match rate is not yet significant
          (p ≈ 0.19). The man on her mind is usually her first date (9 of 10 runs), a bias we report rather than hide.
        </p>
      </section>

      <section className="card">
        <h2>So where does Qloo belong?</h2>
        <p>
          Not as a match score, but inside the agents. Twins that love real things, date at real places and find real common ground
          behave more like the people they stand for, and that behaviour is what carried the signal. Next: rerun Test 2 at scale with
          and without Qloo grounding, to measure how much of the signal Qloo adds.
        </p>
        <p>
          <Link className="go" href="/try">Try it with your own taste →</Link>
        </p>
        <p className="meta small">
          Method and code: <a href="https://github.com/low108/garden-qloo/blob/main/scripts/qloo_benchmark.py">scripts/qloo_benchmark.py</a>. Qloo&apos;s
          responses are cached privately and not published.
        </p>
      </section>
    </main>
  );
}
