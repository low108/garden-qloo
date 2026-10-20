import { search, type EntityType } from "@/lib/server/qloo";
import { bad } from "@/lib/server/input";

const TYPES = ["movie", "artist", "tv_show", "book"];

/** GET /api/search?q=...&type=movie: Qloo entities for the favourites picker. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
  const type = u.searchParams.get("type") ?? "movie";
  if (q.length < 2 || !TYPES.includes(type)) return Response.json([]);
  try {
    return Response.json(await search(q, type as EntityType, 6));
  } catch (e) {
    return bad(e, 502);
  }
}
