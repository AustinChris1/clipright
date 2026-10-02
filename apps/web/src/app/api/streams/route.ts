import { isAddress, isHex, type Hex } from "viem";
import { relayOpen } from "@/lib/server/relayer";
import { listStreams, loadStamps, saveStream } from "@/lib/server/store";

export async function GET() {
  const streams = await listStreams();
  const withCounts = await Promise.all(streams.map(async (s) => ({ ...s, stamps: (await loadStamps(s.streamId)).length })));
  return Response.json({ streams: withCounts });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { signer, title, sig } = (body ?? {}) as { signer?: string; title?: string; sig?: string };
  if (!signer || !isAddress(signer) || !sig || !isHex(sig) || typeof title !== "string" || title.length < 1 || title.length > 80)
    return Response.json({ error: "signer, title (1-80 chars) and sig are required" }, { status: 400 });
  try {
    const { streamId, tx } = await relayOpen(signer as Hex, title, sig as Hex);
    const meta = { streamId, signer: signer as Hex, title, openedAt: Math.floor(Date.now() / 1000), openTx: tx };
    await saveStream(meta);
    return Response.json(meta);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : "open failed" }, { status: 502 });
  }
}
