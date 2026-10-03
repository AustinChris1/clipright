import type { Hex } from "viem";
import { getStream, loadStream } from "@/lib/server/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/streams/[id]">) {
  const { id } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return Response.json({ error: "bad stream id" }, { status: 400 });
  const meta = await getStream(id as Hex);
  if (!meta) return Response.json({ error: "unknown stream" }, { status: 404 });
  const { stamps, minutes } = await loadStream(id as Hex);
  return Response.json({ meta, stamps, minutes });
}
