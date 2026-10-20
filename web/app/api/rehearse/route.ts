import { castMember } from "@/lib/server/garden";
import { rehearse } from "@/lib/server/planner";
import { bad, candidate, person, you } from "@/lib/server/input";

export const maxDuration = 60;

/** POST /api/rehearse {you, match, place | null}: the twins rehearse one stop of the day (null: a plain cafe). */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const a = you(b.you);
    const m = b.match?.id ? await castMember(String(b.match.id)) : person(b.match?.person, "match");
    const place = b.place ? candidate(b.place) : null;
    return Response.json(await rehearse(a, m, place));
  } catch (e) {
    return bad(e);
  }
}
