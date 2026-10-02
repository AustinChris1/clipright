import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { buildMinute, minuteLandmarks, SAMPLE_RATE, secondProof, audioDigest, ZERO32 } from "@clipright/engine";

function signal(seconds: number): Float32Array {
  const pcm = new Float32Array(seconds * SAMPLE_RATE);
  let f = 500;
  for (let i = 0; i < pcm.length; i++) {
    if (i % 1200 === 0) f = 300 + ((i * 7919) % 3000);
    pcm[i] = 0.3 * Math.sin((2 * Math.PI * f * i) / SAMPLE_RATE);
  }
  return pcm;
}

describe("engine and contract agree", async () => {
  const { viem } = await network.create();

  it("verifies an engine-built second proof onchain after a relayed stamp", async () => {
    const reg = await viem.deployContract("StampRegistry");
    const signer = privateKeyToAccount(generatePrivateKey());

    const openDigest = await reg.read.openDigest([signer.address, 0n, "parity"]);
    await reg.write.openStream([signer.address, "parity", await signer.signMessage({ message: { raw: openDigest } })]);
    const [log] = await reg.getEvents.StreamOpened();
    const streamId = log.args.streamId!;

    const pictures = new Map([[42, { full: new Uint8Array(32).fill(7), center: null }]]);
    const file = buildMinute(streamId, 0, minuteLandmarks(signal(61), 0), pictures, 60);
    const stampDigest = await reg.read.stampDigest([streamId, 0, file.root]);
    const publicClient = await viem.getPublicClient();
    const hash = await reg.write.stamp([streamId, 0, file.root, await signer.signMessage({ message: { raw: stampDigest } })]);
    const { gasUsed } = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`    stamp gasUsed=${gasUsed}`);
    assert.ok(gasUsed < 100_000n);

    const rec = file.seconds[42];
    const { leaf, proof } = secondProof(file, 42);
    const onchainLeaf = await reg.read.secondLeaf([streamId, 0, 42, audioDigest(rec.a), rec.pf!, ZERO32]);
    assert.equal(onchainLeaf, leaf);

    const [ok, at] = await reg.read.verifySecond([streamId, 0, 42, audioDigest(rec.a), rec.pf!, ZERO32, proof]);
    assert.equal(ok, true);
    assert.ok(at > 0n);

    const [tampered] = await reg.read.verifySecond([streamId, 0, 42, audioDigest(rec.a), ZERO32, ZERO32, proof]);
    assert.equal(tampered, false);
  });
});
