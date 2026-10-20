import { castMember, goOnDate } from "@/lib/server/garden";
import { bad, city, you } from "@/lib/server/input";

export const maxDuration = 60;

/** POST /api/date {you, partner, city, day, memory, avoid}: one Qloo-grounded date. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const me = you(b.you);
    const them = await castMember(String(b.partner));
    const memory = (Array.isArray(b.memory) ? b.memory : []).map((s: unknown) => String(s).slice(0, 300)).slice(0, 6);
    const avoid = (Array.isArray(b.avoid) ? b.avoid : []).map(String).slice(0, 10);
    return Response.json(await goOnDate(me, them, city(b.city), Math.min(30, Number(b.day) || 1), memory, avoid));
  } catch (e) {
    return bad(e);
  }
}
