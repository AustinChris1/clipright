// Windowed-sinc resampler, so browser and Node produce the same 8 kHz signal.
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input.slice();
  const ratio = from / to;
  const fc = (0.45 * Math.min(from, to)) / from;
  const half = Math.ceil(4 * Math.max(1, ratio));
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const x = i * ratio;
    const centre = Math.floor(x);
    let acc = 0;
    let norm = 0;
    for (let k = centre - half + 1; k <= centre + half; k++) {
      if (k < 0 || k >= input.length) continue;
      const d = x - k;
      const u = d / half;
      if (u <= -1 || u >= 1) continue;
      const arg = 2 * fc * d;
      const sinc = arg === 0 ? 1 : Math.sin(Math.PI * arg) / (Math.PI * arg);
      const w = 0.5 + 0.5 * Math.cos(Math.PI * u);
      const tap = sinc * w;
      acc += input[k] * tap;
      norm += tap;
    }
    out[i] = norm === 0 ? 0 : acc / norm;
  }
  return out;
}
