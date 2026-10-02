// Stamps a recorded file through a running Clipright instance: node scripts/stamp-file.ts <file> "<title>" [baseUrl]
import { stampRegistryAbi } from "@clipright/contracts/abi";
import { fingerprintFile } from "@clipright/engine/node";
import { createPublicClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const [file, title, base = "http://localhost:3000"] = process.argv.slice(2);
if (!file || !title) throw new Error('usage: node scripts/stamp-file.ts <file> "<title>" [baseUrl]');

const cfg = await (await fetch(`${base}/api/config`)).json();
const client = createPublicClient({ transport: http(cfg.rpcUrl) });
const signer = privateKeyToAccount((process.env.STAMP_KEY as Hex) || generatePrivateKey());
const read = <T>(functionName: string, args: unknown[]) =>
  client.readContract({ address: cfg.registry, abi: stampRegistryAbi, functionName, args } as never) as Promise<T>;

const nonce = await read<bigint>("nonces", [signer.address]);
const openSig = await signer.signMessage({ message: { raw: await read<Hex>("openDigest", [signer.address, nonce, title]) } });
const opened = await fetch(`${base}/api/streams`, { method: "POST", body: JSON.stringify({ signer: signer.address, title, sig: openSig }) }).then((r) => r.json());
if (!opened.streamId) throw new Error(`open failed: ${JSON.stringify(opened)}`);
console.log(`opened ${opened.streamId} (tx ${opened.openTx})`);

for (const minute of await fingerprintFile(file, opened.streamId)) {
  const sig = await signer.signMessage({ message: { raw: await read<Hex>("stampDigest", [minute.streamId, minute.minute, minute.root]) } });
  const res = await fetch(`${base}/api/streams/${minute.streamId}/minutes`, { method: "POST", body: JSON.stringify({ file: minute, sig }) });
  const body = await res.json();
  if (!res.ok) throw new Error(`minute ${minute.minute}: ${body.error}`);
  console.log(`minute ${minute.minute}: ${minute.seconds.length}s stamped in block ${body.block} (tx ${body.tx})`);
}
