import { fftInPlace } from "./fft.ts";

export const SAMPLE_RATE = 8000;
export const N_FFT = 512;
export const HOP = 128;
export const FRAMES_PER_SECOND = SAMPLE_RATE / HOP;
export const FRAMES_PER_MINUTE = FRAMES_PER_SECOND * 60;

const BINS = N_FFT / 2;
const MIN_BIN = 3;
const PEAK_DT = 5;
const PEAK_DF = 10;
const PEAKS_PER_SECOND = 30;
const FANOUT = 5;
const MAX_DT = 63;
const MAX_DF = 63;
const FLOOR = Math.log(1e-3);

export interface Peak {
  t: number;
  f: number;
  v: number;
}

export interface Landmark {
  hash: number;
  frame: number;
}

const hann = new Float64Array(N_FFT).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT));

export function spectrogram(pcm: Float32Array): Float32Array[] {
  const frames = pcm.length < N_FFT ? 0 : Math.floor((pcm.length - N_FFT) / HOP) + 1;
  const out: Float32Array[] = new Array(frames);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  for (let t = 0; t < frames; t++) {
    const o = t * HOP;
    for (let i = 0; i < N_FFT; i++) {
      re[i] = pcm[o + i] * hann[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    const row = new Float32Array(BINS);
    for (let f = 0; f < BINS; f++) row[f] = 0.5 * Math.log(re[f] * re[f] + im[f] * im[f] + 1e-12);
    out[t] = row;
  }
  return out;
}

// frameOffset places local frames on the absolute stream timeline so per-second buckets line up.
export function findPeaks(spec: Float32Array[], frameOffset = 0): Peak[] {
  const T = spec.length;
  const freqMax = spec.map((row) => {
    const m = new Float32Array(BINS);
    for (let f = 0; f < BINS; f++) {
      let best = -Infinity;
      const lo = Math.max(0, f - PEAK_DF);
      const hi = Math.min(BINS - 1, f + PEAK_DF);
      for (let g = lo; g <= hi; g++) if (row[g] > best) best = row[g];
      m[f] = best;
    }
    return m;
  });
  const buckets = new Map<number, Peak[]>();
  for (let t = 0; t < T; t++) {
    const lo = Math.max(0, t - PEAK_DT);
    const hi = Math.min(T - 1, t + PEAK_DT);
    const row = spec[t];
    for (let f = MIN_BIN; f < BINS; f++) {
      const v = row[f];
      if (v <= FLOOR || v < freqMax[t][f]) continue;
      let isPeak = true;
      for (let u = lo; u <= hi && isPeak; u++) if (freqMax[u][f] > v) isPeak = false;
      if (!isPeak) continue;
      const abs = t + frameOffset;
      const key = Math.floor(abs / FRAMES_PER_SECOND);
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push({ t: abs, f, v });
    }
  }
  const peaks: Peak[] = [];
  for (const list of buckets.values()) {
    list.sort((a, b) => b.v - a.v);
    peaks.push(...list.slice(0, PEAKS_PER_SECOND));
  }
  return peaks.sort((a, b) => a.t - b.t || a.f - b.f);
}

export function pairPeaks(peaks: Peak[]): Landmark[] {
  const out: Landmark[] = [];
  for (let i = 0; i < peaks.length; i++) {
    const a = peaks[i];
    let made = 0;
    for (let j = i + 1; j < peaks.length && made < FANOUT; j++) {
      const b = peaks[j];
      const dt = b.t - a.t;
      if (dt > MAX_DT) break;
      if (dt < 1) continue;
      const df = b.f - a.f;
      if (df < -MAX_DF || df > MAX_DF) continue;
      out.push({ hash: (a.f << 13) | ((df + 64) << 6) | dt, frame: a.t });
      made++;
    }
  }
  return out;
}

export function landmarks(pcm8k: Float32Array, frameOffset = 0): Landmark[] {
  return pairPeaks(findPeaks(spectrogram(pcm8k), frameOffset));
}

// Landmarks anchored inside one minute, using up to a second of lookahead for pairing.
export function minuteLandmarks(pcm8k: Float32Array, minute: number): Landmark[] {
  const start = minute * 60 * SAMPLE_RATE;
  const end = Math.min(pcm8k.length, start + 61 * SAMPLE_RATE + N_FFT);
  const firstFrame = minute * FRAMES_PER_MINUTE;
  return landmarks(pcm8k.subarray(start, end), firstFrame).filter((l) => l.frame < firstFrame + FRAMES_PER_MINUTE);
}
