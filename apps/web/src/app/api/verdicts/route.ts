import { createVerdict, parseRequest } from "@/lib/server/verdicts";

const PER_MINUTE = 20;
const recent: number[] = [];

export async function POST(req: Request) {
  const now = Date.now();
  while (recent.length && now - recent[0] > 60_000) recent.shift();
  if (recent.length >= PER_MINUTE) return Response.json({ error: "Too many links this minute. Try again shortly." }, { status: 429 });
  const parsed = parseRequest(await req.json().catch(() => null));
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  recent.push(now);
  const v = await createVerdict(parsed).catch((e) => {
    console.error("verdict failed", e);
    return "could not create the link";
  });
  if (typeof v === "string") return Response.json({ error: v }, { status: 422 });
  return Response.json({ id: v.id, url: `/v/${v.id}` });
}
