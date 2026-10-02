import { stampRegistryAbi } from "@clipright/contracts/abi";
import { recomputeRoot, type MinuteFile } from "@clipright/engine";
import { isHex, recoverMessageAddress, type Hex } from "viem";
import { publicClient, REGISTRY } from "@/lib/config";
import { onchainSigner, relayStamp } from "@/lib/server/relayer";
import { getStream, saveMinute } from "@/lib/server/store";

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
  const recovered = await recoverMessageAddress({ message: { raw: digest }, signature: sig });
  if (!signer || recovered.toLowerCase() !== signer.toLowerCase())
    return Response.json({ error: "signature is not from this stream's key" }, { status: 403 });

  try {
    const r = await relayStamp(id as Hex, file.minute, file.root, sig);
    const receipt = { minute: file.minute, root: file.root, ...r };
    await saveMinute(file, receipt);
    return Response.json(receipt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stamp failed";
    const status = msg.includes("AlreadyStamped") ? 409 : 502;
    return Response.json({ error: msg.split("\n")[0] }, { status });
  }
}
