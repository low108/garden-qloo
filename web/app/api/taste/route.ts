import { castMember, tasteScore } from "@/lib/server/garden";
import { bad, you } from "@/lib/server/input";

export const maxDuration = 60;

/** POST /api/taste {you, partners}: the "match by taste" baseline, Qloo taste overlap with each partner. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const me = you(b.you);
    const ids = (Array.isArray(b.partners) ? b.partners : []).map(String).slice(0, 6);
    const scores = await Promise.all(ids.map(async (id: string) => ({ partner: id, score: await tasteScore(me, await castMember(id)) })));
    return Response.json(scores);
  } catch (e) {
    return bad(e);
  }
}
