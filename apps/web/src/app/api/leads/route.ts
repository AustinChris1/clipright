import { findLead } from "@/lib/server/leads";

const MAX_LANDMARKS = 20_000;

// Cache lookup for unstamped clips. Only sound landmark hashes arrive here, never the clip.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { landmarks?: unknown; duration?: unknown } | null;
  const raw = Array.isArray(body?.landmarks) ? body.landmarks.slice(0, MAX_LANDMARKS) : [];
  const clip = raw
    .filter((p): p is [number, number] => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]))
    .map(([hash, frame]) => ({ hash, frame }));
  const duration = typeof body?.duration === "number" && body.duration > 0 ? Math.min(body.duration, 600) : 0;
  if (!clip.length || !duration) return Response.json({ error: "Send landmarks and duration." }, { status: 400 });
  const lead = await findLead(clip, duration).catch((e) => {
    console.error("lead lookup failed", e);
    return null;
  });
  return Response.json({ catalog: lead?.catalog ?? [], since: lead?.createdAt ?? null });
}
