import assert from "node:assert/strict";
import { test } from "node:test";
import { keccak256, toHex } from "viem";
import {
  buildMinute,
  checkClip,
  hamming,
  landmarks,
  merkleProof,
  merkleRoot,
  minuteLandmarks,
  pictureHash,
  recomputeRoot,
  resample,
  SAMPLE_RATE,
  secondProof,
  verifyProof,
} from "../src/index.ts";

function noiseBurstSignal(seconds: number, seed: number): Float32Array {
  const pcm = new Float32Array(seconds * SAMPLE_RATE);
  let x = seed;
  const rand = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let phase = 0;
  for (let i = 0; i < pcm.length; i++) {
    if (i % 1600 === 0) phase = 300 + rand() * 3000;
    pcm[i] = 0.3 * Math.sin((2 * Math.PI * phase * i) / SAMPLE_RATE) + 0.02 * (rand() - 0.5);
  }
  return pcm;
}

test("merkle proofs verify for every leaf, including odd counts", () => {
  for (const n of [1, 2, 3, 7, 60]) {
    const leaves = Array.from({ length: n }, (_, i) => keccak256(toHex(i)));
    const root = merkleRoot(leaves);
    leaves.forEach((leaf, i) => assert.ok(verifyProof(leaf, merkleProof(leaves, i), root)));
    if (n > 1) assert.ok(!verifyProof(keccak256(toHex("x")), merkleProof(leaves, 0), root));
  }
});

test("minute files are tamper evident", () => {
  const id = keccak256(toHex("s"));
  const pcm = noiseBurstSignal(62, 7);
  const file = buildMinute(id, 0, minuteLandmarks(pcm, 0), new Map(), 60);
  assert.equal(recomputeRoot(file), file.root);
  const { leaf, proof } = secondProof(file, 12);
  assert.ok(verifyProof(leaf, proof, file.root));
  file.seconds[12].a[0][0] ^= 1;
  assert.notEqual(recomputeRoot(file), file.root);
});

test("audio matcher finds an excerpt at the right offset and rejects another signal", () => {
  const id = keccak256(toHex("s"));
  const stream = noiseBurstSignal(120, 1);
  const minutes = [0, 1].map((m) => buildMinute(id, m, minuteLandmarks(stream, m), new Map(), 60));
  const start = Math.round(73.4 * SAMPLE_RATE);
  const excerpt = stream.slice(start, start + 10 * SAMPLE_RATE);
  const hit = checkClip({ duration: 10, landmarks: landmarks(excerpt), frames: [] }, [{ streamId: id, minutes }]);
  assert.equal(hit.status, "match");
  assert.ok(Math.abs(hit.offsetSec! - 73.4) < 0.03, `offset ${hit.offsetSec}`);
  const other = noiseBurstSignal(10, 99);
  const miss = checkClip({ duration: 10, landmarks: landmarks(other), frames: [] }, [{ streamId: id, minutes }]);
  assert.equal(miss.status, "no-match");
});

test("a cut inside a clip is reported with its length, and an untouched clip reports none", () => {
  const id = keccak256(toHex("s"));
  const stream = noiseBurstSignal(120, 3);
  const minutes = [0, 1].map((m) => buildMinute(id, m, minuteLandmarks(stream, m), new Map(), 60));
  const at = (sec: number) => Math.round(sec * SAMPLE_RATE);
  const honest = stream.slice(at(40), at(55));
  const cut = new Float32Array(at(15));
  cut.set(stream.slice(at(40), at(45)), 0);
  cut.set(stream.slice(at(47), at(57)), at(5));

  const h = checkClip({ duration: 15, landmarks: landmarks(honest), frames: [] }, [{ streamId: id, minutes }]);
  assert.equal(h.status, "match");
  assert.equal(h.edits.length, 0, JSON.stringify(h.edits));

  const c = checkClip({ duration: 15, landmarks: landmarks(cut), frames: [] }, [{ streamId: id, minutes }]);
  assert.equal(c.status, "match");
  const cuts = c.edits.filter((e) => e.kind === "cut");
  assert.equal(cuts.length, 1, JSON.stringify(c.edits));
  assert.ok(Math.abs(cuts[0].seconds - 2) < 0.15, `cut length ${cuts[0].seconds}`);
  assert.ok(Math.abs(cuts[0].atClipSec - 5) <= 1, `cut at ${cuts[0].atClipSec}`);
});

test("a silent pause inside a clip is not reported as inserted", () => {
  const id = keccak256(toHex("p"));
  const at = (sec: number) => Math.round(sec * SAMPLE_RATE);
  const stream = noiseBurstSignal(60, 7);
  stream.fill(0, at(23.8), at(25.3));
  const minutes = [buildMinute(id, 0, minuteLandmarks(stream, 0), new Map(), 60)];
  const clip = stream.slice(at(20), at(32));
  const r = checkClip({ duration: 12, landmarks: landmarks(clip), frames: [] }, [{ streamId: id, minutes }]);
  assert.equal(r.status, "match");
  assert.equal(r.edits.length, 0, JSON.stringify(r.edits));
});

test("resampler keeps a tone below the new Nyquist and removes one above it", () => {
  const from = 48000;
  const tone = (hz: number) => Float32Array.from({ length: from }, (_, i) => Math.sin((2 * Math.PI * hz * i) / from));
  const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  assert.ok(rms(resample(tone(1000), from, SAMPLE_RATE)) > 0.6);
  assert.ok(rms(resample(tone(6000), from, SAMPLE_RATE)) < 0.05);
});

test("picture hash is stable under brightness change and rejects flat frames", () => {
  const img = Float64Array.from({ length: 4096 }, (_, i) => 128 + 100 * Math.sin((i % 64) / 5) * Math.cos(Math.floor(i / 64) / 7));
  const a = pictureHash(img)!;
  const b = pictureHash(img.map((v) => v * 0.8 + 10))!;
  assert.ok(hamming(a, b) <= 8);
  assert.equal(pictureHash(new Float64Array(4096).fill(90)), null);
});
