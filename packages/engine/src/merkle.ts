import { concat, keccak256, type Hex } from "viem";

export const ZERO32 = `0x${"0".repeat(64)}` as Hex;

// Sorted-pair hashing, matching OpenZeppelin MerkleProof.
export function hashPair(a: Hex, b: Hex): Hex {
  return BigInt(a) < BigInt(b) ? keccak256(concat([a, b])) : keccak256(concat([b, a]));
}

export function merkleLevels(leaves: Hex[]): Hex[][] {
  const levels: Hex[][] = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const level = levels[levels.length - 1];
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    levels.push(next);
  }
  return levels;
}

export function merkleRoot(leaves: Hex[]): Hex {
  if (leaves.length === 0) return ZERO32;
  const levels = merkleLevels(leaves);
  return levels[levels.length - 1][0];
}

export function merkleProof(leaves: Hex[], index: number): Hex[] {
  const levels = merkleLevels(leaves);
  const proof: Hex[] = [];
  let i = index;
  for (let l = 0; l < levels.length - 1; l++) {
    const sibling = i ^ 1;
    if (sibling < levels[l].length) proof.push(levels[l][sibling]);
    i >>= 1;
  }
  return proof;
}

export function verifyProof(leaf: Hex, proof: Hex[], root: Hex): boolean {
  let h = leaf;
  for (const p of proof) h = hashPair(h, p);
  return h.toLowerCase() === root.toLowerCase();
}
