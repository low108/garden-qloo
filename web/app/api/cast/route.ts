import { cast } from "@/lib/server/garden";
import { bad } from "@/lib/server/input";

/** GET /api/cast?gender=f|m: the demo twins you can date, with their favourites resolved through Qloo. */
export async function GET(req: Request) {
  const g = new URL(req.url).searchParams.get("gender");
  try {
    return Response.json(await cast(g === "m" || g === "f" ? g : undefined));
  } catch (e) {
    return bad(e, 502);
  }
}
