import { hexToBytes, type Hex } from "viem";
import { FRAMES_PER_SECOND, type Landmark } from "./audio.ts";
import type { MinuteFile, SecondRecord } from "./fingerprint.ts";
import { hamming } from "./picture.ts";

export const AUDIO_MIN_HITS = 20;
export const AUDIO_MIN_RATIO = 4;
export const PICTURE_MATCH_BITS = 64;
const PICTURE_VOTE_BITS = 70;
const VOTE_BIN = 0.25;

export interface ClipFrame {
  t: number;
  hash: Uint8Array | null;
}

export interface ClipPrint {
  duration: number;
  landmarks: Landmark[];
  frames: ClipFrame[];
}

export interface AudioMatch {
  offsetFrames: number;
  offsetSec: number;
  hits: number;
  runnerUp: number;
  perClipSecond: number[];
}

export interface SecondVerdict {
  s: number;
  audioHits: number;
  pictureBits: number | null;
  audio: boolean;
  picture: boolean;
}

export interface CheckResult {
  status: "match" | "picture-only" | "no-match";
  streamId: Hex | null;
  offsetSec: number | null;
  audio: AudioMatch | null;
  seconds: SecondVerdict[];
}

export function buildAudioIndex(minutes: MinuteFile[]): Map<number, number[]> {
  const index = new Map<number, number[]>();
  for (const m of minutes)
    for (const rec of m.seconds)
      for (const [hash, frame] of rec.a) {
        let list = index.get(hash);
        if (!list) index.set(hash, (list = []));
        list.push(frame);
      }
  return index;
}

export function matchAudio(clip: Landmark[], index: Map<number, number[]>, clipSeconds: number): AudioMatch | null {
  const hist = new Map<number, number>();
  for (const { hash, frame } of clip) {
    const list = index.get(hash);
    if (!list) continue;
    for (const sf of list) {
      const d = sf - frame;
      hist.set(d, (hist.get(d) ?? 0) + 1);
    }
  }
  if (hist.size === 0) return null;
  const smooth = (d: number) => (hist.get(d - 1) ?? 0) + (hist.get(d) ?? 0) + (hist.get(d + 1) ?? 0);
  let hits = -1;
  let bestD = 0;
  for (const d of hist.keys()) {
    const c = smooth(d);
    if (c > hits) {
      hits = c;
      bestD = d;
    }
  }
  let runnerUp = 0;
  for (const d of hist.keys()) if (Math.abs(d - bestD) > FRAMES_PER_SECOND) runnerUp = Math.max(runnerUp, smooth(d));

  let wsum = 0;
  let wd = 0;
  for (let d = bestD - 1; d <= bestD + 1; d++) {
    const c = hist.get(d) ?? 0;
    wsum += c;
    wd += c * d;
  }
  const offsetFrames = wd / wsum;

  const perClipSecond = new Array(Math.max(1, Math.ceil(clipSeconds))).fill(0);
  for (const { hash, frame } of clip) {
    const list = index.get(hash);
    if (!list) continue;
    if (list.some((sf) => Math.abs(sf - frame - bestD) <= 1)) {
      const s = Math.floor(frame / FRAMES_PER_SECOND);
      if (s < perClipSecond.length) perClipSecond[s]++;
    }
  }
  return { offsetFrames, offsetSec: offsetFrames / FRAMES_PER_SECOND, hits, runnerUp, perClipSecond };
}

export function audioIsMatch(m: AudioMatch | null): boolean {
  return !!m && m.hits >= AUDIO_MIN_HITS && m.hits >= AUDIO_MIN_RATIO * Math.max(1, m.runnerUp);
}

function recordHashes(rec: SecondRecord): Uint8Array[] {
  const out: Uint8Array[] = [];
  if (rec.pf) out.push(hexToBytes(rec.pf));
  if (rec.pc) out.push(hexToBytes(rec.pc));
  return out;
}

function bestDistance(hash: Uint8Array, candidates: Uint8Array[]): number {
  let best = Infinity;
  for (const c of candidates) best = Math.min(best, hamming(hash, c));
  return best;
}

// Stream pictures are sampled at s + 0.5, so votes for one offset spread over a second; smooth, then refine.
export function votePictureOffset(frames: ClipFrame[], records: SecondRecord[]): { offsetSec: number; votes: number } | null {
  const votes = new Map<number, number>();
  const hashed = records.map((r) => ({ s: r.s, hashes: recordHashes(r) })).filter((r) => r.hashes.length);
  for (const f of frames) {
    if (!f.hash) continue;
    const seen = new Set<number>();
    for (const r of hashed) {
      if (bestDistance(f.hash, r.hashes) > PICTURE_VOTE_BITS) continue;
      const bin = Math.round((r.s + 0.5 - f.t) / VOTE_BIN);
      if (seen.has(bin)) continue;
      seen.add(bin);
      votes.set(bin, (votes.get(bin) ?? 0) + 1);
    }
  }
  const span = Math.round(0.5 / VOTE_BIN);
  let bestBin = 0;
  let bestVotes = 0;
  for (const bin of votes.keys()) {
    let v = 0;
    for (let d = -span; d <= span; d++) v += votes.get(bin + d) ?? 0;
    if (v > bestVotes) {
      bestVotes = v;
      bestBin = bin;
    }
  }
  const usable = frames.filter((f) => f.hash).length;
  if (bestVotes < Math.max(3, Math.ceil(usable * 0.3))) return null;

  const bySecond = new Map(hashed.map((r) => [r.s, r.hashes]));
  let offsetSec = bestBin * VOTE_BIN;
  let bestCost = Infinity;
  for (let d = -span; d <= span; d++) {
    const candidate = (bestBin + d) * VOTE_BIN;
    let cost = 0;
    let n = 0;
    for (const [s, hashes] of bySecond) {
      const frame = nearestFrame(frames, s + 0.5 - candidate);
      if (!frame?.hash) continue;
      cost += bestDistance(frame.hash, hashes);
      n++;
    }
    if (n && cost / n < bestCost) {
      bestCost = cost / n;
      offsetSec = candidate;
    }
  }
  return { offsetSec, votes: bestVotes };
}

function nearestFrame(frames: ClipFrame[], t: number): ClipFrame | null {
  let best: ClipFrame | null = null;
  for (const f of frames) if (!best || Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
  return best && Math.abs(best.t - t) <= 0.13 ? best : null;
}

export function verdicts(clip: ClipPrint, records: SecondRecord[], offsetSec: number, audio: AudioMatch | null): SecondVerdict[] {
  const bySecond = new Map(records.map((r) => [r.s, r]));
  const first = Math.ceil(offsetSec);
  const last = Math.floor(offsetSec + clip.duration) - 1;
  const out: SecondVerdict[] = [];
  for (let s = first; s <= last; s++) {
    const rec = bySecond.get(s);
    const clipSecond = Math.floor(s + 0.5 - offsetSec);
    const audioHits = audio && clipSecond >= 0 && clipSecond < audio.perClipSecond.length ? audio.perClipSecond[clipSecond] : 0;
    const frame = nearestFrame(clip.frames, s + 0.5 - offsetSec);
    const hashes = rec ? recordHashes(rec) : [];
    const pictureBits = frame?.hash && hashes.length ? bestDistance(frame.hash, hashes) : null;
    out.push({
      s,
      audioHits,
      pictureBits,
      audio: audioHits >= 2,
      picture: pictureBits !== null && pictureBits <= PICTURE_MATCH_BITS,
    });
  }
  return out;
}

export function checkClip(clip: ClipPrint, streams: { streamId: Hex; minutes: MinuteFile[] }[]): CheckResult {
  let best: { streamId: Hex; audio: AudioMatch; records: SecondRecord[] } | null = null;
  for (const st of streams) {
    const audio = matchAudio(clip.landmarks, buildAudioIndex(st.minutes), clip.duration);
    if (audioIsMatch(audio) && (!best || audio!.hits > best.audio.hits))
      best = { streamId: st.streamId, audio: audio!, records: st.minutes.flatMap((m) => m.seconds) };
  }
  if (best) {
    return {
      status: "match",
      streamId: best.streamId,
      offsetSec: best.audio.offsetSec,
      audio: best.audio,
      seconds: verdicts(clip, best.records, best.audio.offsetSec, best.audio),
    };
  }
  let pic: { streamId: Hex; offsetSec: number; votes: number; records: SecondRecord[] } | null = null;
  for (const st of streams) {
    const records = st.minutes.flatMap((m) => m.seconds);
    const v = votePictureOffset(clip.frames, records);
    if (v && (!pic || v.votes > pic.votes)) pic = { streamId: st.streamId, ...v, records };
  }
  if (pic) {
    return {
      status: "picture-only",
      streamId: pic.streamId,
      offsetSec: pic.offsetSec,
      audio: null,
      seconds: verdicts(clip, pic.records, pic.offsetSec, null),
    };
  }
  return { status: "no-match", streamId: null, offsetSec: null, audio: null, seconds: [] };
}
