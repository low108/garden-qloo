import { castMember, wallAnswer, wallPick, type DateResult } from "@/lib/server/garden";
import { bad, you } from "@/lib/server/input";

export const maxDuration = 60;

/** POST /api/wall {you, dates: [{partner, result}]}: the wall opens; your twin may ask one of them to leave.
 *  POST /api/wall {you, dates, ask: {partner, line}}: the one asked answers yes or no. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const me = you(b.you);
    const dates = await Promise.all(
      (Array.isArray(b.dates) ? (b.dates as { partner?: unknown; result?: Partial<DateResult> }[]) : []).slice(0, 6).map(async (d) => ({
        them: await castMember(String(d.partner)),
        result: {
          ...d.result,
          yourDiary: String(d.result?.yourDiary ?? "").slice(0, 400),
          yourPull: Number(d.result?.yourPull) || 5,
          theirDiary: String(d.result?.theirDiary ?? "").slice(0, 400),
          theirPull: Number(d.result?.theirPull) || 5,
        } as DateResult,
      })),
    );
    if (!dates.length) throw new Error("no dates yet");
    if (b.ask) {
      const d = dates.find((x) => x.them.id === String(b.ask.partner));
      if (!d) throw new Error("you did not date them");
      return Response.json(await wallAnswer(me, d.them, d.result, String(b.ask.line ?? "").slice(0, 300)));
    }
    return Response.json(await wallPick(me, dates));
  } catch (e) {
    return bad(e);
  }
}
