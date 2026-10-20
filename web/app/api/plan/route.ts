import { castMember, datePlan } from "@/lib/server/garden";
import { bad, city, you } from "@/lib/server/input";

export const maxDuration = 60;

/** POST /api/plan {you, partner, city}: a real first date to book, and things you both love to talk about. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    return Response.json(await datePlan(you(b.you), await castMember(String(b.partner)), city(b.city)));
  } catch (e) {
    return bad(e);
  }
}
