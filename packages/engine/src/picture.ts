export const PIC_SIZE = 64;
export const HASH_BYTES = 32;

const K = 16;
const MIN_QUALITY = 1.5;

const dct = (() => {
  const m = new Float64Array(K * PIC_SIZE);
  for (let k = 0; k < K; k++)
    for (let n = 0; n < PIC_SIZE; n++) m[k * PIC_SIZE + n] = Math.cos((Math.PI * (2 * n + 1) * k) / (2 * PIC_SIZE));
  return m;
})();

// 256-bit DCT hash in the style of PDQ; returns null for flat frames that carry no signal.
export function pictureHash(gray: ArrayLike<number>): Uint8Array | null {
  if (gray.length !== PIC_SIZE * PIC_SIZE) throw new Error(`expected ${PIC_SIZE}x${PIC_SIZE} grayscale`);
  let grad = 0;
  for (let y = 0; y < PIC_SIZE; y++)
    for (let x = 0; x < PIC_SIZE - 1; x++) {
      grad += Math.abs(gray[y * PIC_SIZE + x + 1] - gray[y * PIC_SIZE + x]);
      grad += Math.abs(gray[(x + 1) * PIC_SIZE + y] - gray[x * PIC_SIZE + y]);
    }
  if (grad / (2 * (PIC_SIZE - 1) * PIC_SIZE) < MIN_QUALITY) return null;

  const tmp = new Float64Array(K * PIC_SIZE);
  for (let k = 0; k < K; k++)
    for (let x = 0; x < PIC_SIZE; x++) {
      let s = 0;
      for (let y = 0; y < PIC_SIZE; y++) s += dct[k * PIC_SIZE + y] * gray[y * PIC_SIZE + x];
      tmp[k * PIC_SIZE + x] = s;
    }
  const coef = new Float64Array(K * K);
  for (let k = 0; k < K; k++)
    for (let l = 0; l < K; l++) {
      let s = 0;
      for (let x = 0; x < PIC_SIZE; x++) s += tmp[k * PIC_SIZE + x] * dct[l * PIC_SIZE + x];
      coef[k * K + l] = s;
    }
  const sorted = Array.from(coef).sort((a, b) => a - b);
  const median = (sorted[127] + sorted[128]) / 2;
  const out = new Uint8Array(HASH_BYTES);
  for (let i = 0; i < K * K; i++) if (coef[i] > median) out[i >> 3] |= 1 << (7 - (i & 7));
  return out;
}

const POP = new Uint8Array(256).map((_, i) => {
  let c = 0;
  for (let v = i; v; v >>= 1) c += v & 1;
  return c;
});

export function hamming(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POP[a[i] ^ b[i]];
  return d;
}
