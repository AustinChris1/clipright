import { stampRegistryAbi } from "@clipright/contracts/abi";
import { recomputeRoot, type MinuteFile } from "@clipright/engine";
import { isHex, recoverMessageAddress, type Hex } from "viem";
import { publicClient, REGISTRY } from "@/lib/config";
import { pacingWait, revertMessage, stampLimit } from "@/lib/server/limits";
import { onchainSigner, relayStamp } from "@/lib/server/relayer";
import { getStream, saveMinute, saveReceipt } from "@/lib/server/store";

const HEX32 = /^0x[0-9a-f]{64}$/i;

function validate(file: MinuteFile, streamId: string): string | null {
  if (file?.v !== 1 || file.streamId?.toLowerCase() !== streamId.toLowerCase()) return "file does not belong to this stream";
  if (!Number.isInteger(file.minute) || file.minute < 0 || file.minute > 100_000) return "bad minute";
  if (!Array.isArray(file.seconds) || file.seconds.length < 1 || file.seconds.length > 60) return "a minute holds 1 to 60 seconds";
  for (let i = 0; i < file.seconds.length; i++) {
    const rec = file.seconds[i];
    if (rec.s !== file.minute * 60 + i) return `second ${i} is out of order`;
    if (!Array.isArray(rec.a) || rec.a.length > 1000) return `second ${i} has too many landmarks`;
    if ((rec.pf && !HEX32.test(rec.pf)) || (rec.pc && !HEX32.test(rec.pc))) return `second ${i} has a malformed picture hash`;
  }
  return null;
}

export async function POST(req: Request, ctx: RouteContext<"/api/streams/[id]/minutes">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { file?: MinuteFile; sig?: string } | null;
  if (!body?.file || !body.sig || !isHex(body.sig)) return Response.json({ error: "file and sig are required" }, { status: 400 });
  const { file } = body;
  const sig = body.sig as Hex;

  const problem = validate(file, id);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (recomputeRoot(file) !== file.root) return Response.json({ error: "root does not match the fingerprints" }, { status: 400 });
  if (!(await getStream(id as Hex))) return Response.json({ error: "unknown stream" }, { status: 404 });

  const signer = await onchainSigner(id as Hex);
  const digest = await publicClient.readContract({
    address: REGISTRY,
    abi: stampRegistryAbi,
    functionName: "stampDigest",
    args: [id as Hex, file.minute, file.root],
  });
  // A malformed signature throws during recovery; treat it like any other wrong signature.
  const recovered = await recoverMessageAddress({ message: { raw: digest }, signature: sig }).catch(() => null);
  if (!signer || !recovered || recovered.toLowerCase() !== signer.toLowerCase())
    return Response.json({ error: "signature is not from this stream's key" }, { status: 403 });

  const wait = await pacingWait(id as Hex, file.minute);
  if (wait > 0)
    return Response.json({ error: `Minute ${file.minute} has not happened yet; try again in ${wait}s.`, retryAfter: wait }, { status: 425 });
  const limited = await stampLimit(file.minute);
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    await saveMinute(file);
    const r = await relayStamp(id as Hex, file.minute, file.root, sig);
    const receipt = { minute: file.minute, root: file.root, ...r };
    await saveReceipt(id as Hex, receipt);
    return Response.json(receipt);
  } catch (e) {
    console.error("stamp relay failed", e);
    const { message, status } = revertMessage(e);
    return Response.json({ error: message }, { status });
  }
}
