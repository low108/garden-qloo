import { castMember } from "@/lib/server/garden";
import { candidates } from "@/lib/server/planner";
import { bad, city, person, you } from "@/lib/server/input";

export const maxDuration = 60;

/** POST /api/candidates {you, match: {id} | {person}, city}: the day's candidate places from Qloo. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const a = you(b.you);
    const m = b.match?.id ? await castMember(String(b.match.id)) : person(b.match?.person, "match");
    return Response.json({ match: m, candidates: await candidates(a, m, city(b.city)) });
  } catch (e) {
    return bad(e);
  }
}
