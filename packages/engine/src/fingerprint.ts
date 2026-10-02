import { bytesToHex, encodeAbiParameters, keccak256, parseAbiParameters, type Hex } from "viem";
import { FRAMES_PER_SECOND, type Landmark } from "./audio.ts";
import { merkleProof, merkleRoot, ZERO32 } from "./merkle.ts";

export type AudioPair = [hash: number, frame: number];

export interface SecondRecord {
  s: number;
  a: AudioPair[];
  pf: Hex | null;
  pc: Hex | null;
}

export interface MinuteFile {
  v: 1;
  streamId: Hex;
  minute: number;
  root: Hex;
  seconds: SecondRecord[];
}

export interface SecondPictures {
  full: Uint8Array | null;
  center: Uint8Array | null;
}

const LEAF_PARAMS = parseAbiParameters("bytes32, uint32, uint8, bytes32, bytes32, bytes32");

export function audioDigest(pairs: AudioPair[]): Hex {
  const bytes = new Uint8Array(pairs.length * 8);
  const view = new DataView(bytes.buffer);
  pairs.forEach(([hash, frame], i) => {
    view.setUint32(i * 8, hash);
    view.setUint32(i * 8 + 4, frame);
  });
  return keccak256(bytes);
}

// Mirrors StampRegistry.secondLeaf in Solidity.
export function secondLeaf(streamId: Hex, minute: number, rec: SecondRecord): Hex {
  return keccak256(
    encodeAbiParameters(LEAF_PARAMS, [streamId, minute, rec.s - minute * 60, audioDigest(rec.a), rec.pf ?? ZERO32, rec.pc ?? ZERO32]),
  );
}

export function minuteLeaves(file: MinuteFile): Hex[] {
  return file.seconds.map((rec) => secondLeaf(file.streamId, file.minute, rec));
}

export function buildMinute(
  streamId: Hex,
  minute: number,
  lms: Landmark[],
  pictures: Map<number, SecondPictures>,
  secondsInMinute = 60,
): MinuteFile {
  const bySecond = new Map<number, AudioPair[]>();
  for (const l of lms) {
    const s = Math.floor(l.frame / FRAMES_PER_SECOND);
    let list = bySecond.get(s);
    if (!list) bySecond.set(s, (list = []));
    list.push([l.hash, l.frame]);
  }
  const seconds: SecondRecord[] = [];
  for (let i = 0; i < secondsInMinute; i++) {
    const s = minute * 60 + i;
    const a = (bySecond.get(s) ?? []).sort((x, y) => x[1] - y[1] || x[0] - y[0]);
    const pic = pictures.get(s);
    seconds.push({
      s,
      a,
      pf: pic?.full ? bytesToHex(pic.full) : null,
      pc: pic?.center ? bytesToHex(pic.center) : null,
    });
  }
  const file: MinuteFile = { v: 1, streamId, minute, root: ZERO32, seconds };
  file.root = merkleRoot(minuteLeaves(file));
  return file;
}

export function recomputeRoot(file: MinuteFile): Hex {
  return merkleRoot(minuteLeaves(file));
}

export function secondProof(file: MinuteFile, s: number): { leaf: Hex; proof: Hex[] } {
  const index = s - file.minute * 60;
  const leaves = minuteLeaves(file);
  return { leaf: leaves[index], proof: merkleProof(leaves, index) };
}
