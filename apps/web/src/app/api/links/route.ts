import { creatorLinksAbi } from "@clipright/contracts/abi";
import { isAddress, isHex, recoverMessageAddress, type Hex } from "viem";
import { LINKS, publicClient } from "@/lib/config";
import { linkLimit, revertMessage } from "@/lib/server/limits";
import { relayLink } from "@/lib/server/relayer";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { signer?: string; owner?: string; signerSig?: string; ownerSig?: string } | null;
  const { signer, owner, signerSig, ownerSig } = body ?? {};
  if (!signer || !isAddress(signer) || !owner || !isAddress(owner) || !signerSig || !isHex(signerSig) || !ownerSig || !isHex(ownerSig))
    return Response.json({ error: "signer, owner, signerSig and ownerSig are required" }, { status: 400 });
  if (!LINKS) return Response.json({ error: "wallet linking is not deployed on this network" }, { status: 503 });

  // The stamping key is always an EOA, so its signature is checked here before any gas is spent.
  const nonce = await publicClient.readContract({ address: LINKS, abi: creatorLinksAbi, functionName: "nonces", args: [signer as Hex] });
  const digest = await publicClient.readContract({ address: LINKS, abi: creatorLinksAbi, functionName: "linkDigest", args: [signer as Hex, owner as Hex, nonce] });
  const recovered = await recoverMessageAddress({ message: { raw: digest }, signature: signerSig as Hex }).catch(() => null);
  if (!recovered || recovered.toLowerCase() !== signer.toLowerCase()) return Response.json({ error: "The stamping key did not sign this link." }, { status: 403 });

  const limited = await linkLimit();
  if (limited) return Response.json({ error: limited }, { status: 429 });
  try {
    return Response.json(await relayLink(signer as Hex, owner as Hex, signerSig as Hex, ownerSig as Hex));
  } catch (e) {
    console.error("link relay failed", e);
    const { message, status } = revertMessage(e);
    return Response.json({ error: message }, { status });
  }
}
