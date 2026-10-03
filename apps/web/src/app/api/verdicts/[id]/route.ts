import { getVerdict } from "@/lib/server/store";

// The verified clip's sound landmarks, so anyone can compare their copy in the browser.
export async function GET(_req: Request, ctx: RouteContext<"/api/verdicts/[id]">) {
  const { id } = await ctx.params;
  const v = await getVerdict(id);
  if (!v) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ id: v.id, duration: v.duration, landmarks: v.landmarks }, { headers: { "cache-control": "public, max-age=86400, immutable" } });
}
