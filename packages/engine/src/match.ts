import { hexToBytes, type Hex } from "viem";
import { FRAMES_PER_SECOND, type Landmark } from "./audio.ts";
import type { MinuteFile, SecondRecord } from "./fingerprint.ts";
import { hamming } from "./picture.ts";

export const AUDIO_MIN_HITS = 20;
export const AUDIO_MIN_RATIO = 4;
export const PICTURE_MATCH_BITS = 64;
const PICTURE_VOTE_BITS = 70;
const VOTE_BIN = 0.25;
const SEGMENT_MIN_HITS = 12;
const MAX_SEGMENTS = 4;
const QUIET_MIN_LANDMARKS = 4;
const QUIET_SHARE = 0.3;

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
  quiet?: boolean;
}

export interface AlsoFound {
  streamId: Hex;
  offsetSec: number;
  hits: number;
}

export interface Segment {
  clipStart: number;
  clipEnd: number;
  offsetSec: number;
  hits: number;
}

export interface Edit {
  kind: "cut" | "inserted" | "reordered";
  atClipSec: number;
  seconds: number;
}

export interface CheckResult {
  status: "match" | "picture-only" | "no-match";
  streamId: Hex | null;
  offsetSec: number | null;
  audio: AudioMatch | null;
  seconds: SecondVerdict[];
  alsoFound: AlsoFound[];
  segments: Segment[];
  edits: Edit[];
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

function perSecondAt(clip: Landmark[], index: Map<number, number[]>, clipSeconds: number, deltaFrames: number): number[] {
  const out = new Array(Math.max(1, Math.ceil(clipSeconds))).fill(0);
  for (const { hash, frame } of clip) {
    const list = index.get(hash);
    if (!list?.some((sf) => Math.abs(sf - frame - deltaFrames) <= 1)) continue;
    const s = Math.floor(frame / FRAMES_PER_SECOND);
    if (s < out.length) out[s]++;
  }
  return out;
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
  // Background is the strongest chance peak elsewhere. Peaks that are themselves a large share of the best
  // are other genuine pieces of a stitched clip, not chance, so they are left out.
  let runnerUp = 0;
  for (const d of hist.keys()) {
    const c = smooth(d);
    if (Math.abs(d - bestD) > FRAMES_PER_SECOND && c < hits * 0.25) runnerUp = Math.max(runnerUp, c);
  }

  let wsum = 0;
  let wd = 0;
  for (let d = bestD - 1; d <= bestD + 1; d++) {
    const c = hist.get(d) ?? 0;
    wsum += c;
    wd += c * d;
  }
  const offsetFrames = wd / wsum;
  return { offsetFrames, offsetSec: offsetFrames / FRAMES_PER_SECOND, hits, runnerUp, perClipSecond: perSecondAt(clip, index, clipSeconds, bestD) };
}

export function audioIsMatch(m: AudioMatch | null): boolean {
  return !!m && m.hits >= AUDIO_MIN_HITS && m.hits >= AUDIO_MIN_RATIO * Math.max(1, m.runnerUp);
}

// A clip stitched from several moments lines up at several offsets. Find each offset and the seconds it explains.
// Seconds of the clip with little sound in them, such as a pause, judged against the clip's own typical second.
export function quietSeconds(clip: Landmark[], seconds: number): boolean[] {
  const density = new Array(seconds).fill(0);
  for (const l of clip) {
    const s = Math.floor(l.frame / FRAMES_PER_SECOND);
    if (s < seconds) density[s]++;
  }
  const sorted = density.filter((n) => n > 0).sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return density.map((n) => n < Math.max(QUIET_MIN_LANDMARKS, typical * QUIET_SHARE));
}

export function findSegments(clip: Landmark[], index: Map<number, number[]>, clipSeconds: number, primary: AudioMatch): { segments: Segment[]; edits: Edit[] } {
  const items = clip.map((l) => ({ second: Math.floor(l.frame / FRAMES_PER_SECOND), ds: (index.get(l.hash) ?? []).map((sf) => sf - l.frame) }));
  const explains = (ds: number[], d0: number) => ds.some((d) => Math.abs(d - d0) <= 1);
  const offsets = [Math.round(primary.offsetFrames)];
  while (offsets.length < MAX_SEGMENTS) {
    const hist = new Map<number, number>();
    for (const { ds } of items) if (!offsets.some((o) => explains(ds, o))) for (const d of ds) hist.set(d, (hist.get(d) ?? 0) + 1);
    const smooth = (d: number) => (hist.get(d - 1) ?? 0) + (hist.get(d) ?? 0) + (hist.get(d + 1) ?? 0);
    let best = 0;
    let bestD = 0;
    for (const d of hist.keys()) {
      const c = smooth(d);
      if (c > best) {
        best = c;
        bestD = d;
      }
    }
    let background = 0;
    for (const d of hist.keys()) if (Math.abs(d - bestD) > FRAMES_PER_SECOND) background = Math.max(background, smooth(d));
    if (best < Math.max(SEGMENT_MIN_HITS, primary.hits * 0.1) || best < AUDIO_MIN_RATIO * Math.max(1, background)) break;
    offsets.push(bestD);
  }

  const seconds = Math.max(1, Math.ceil(clipSeconds));
  const counts = offsets.map((o) => perSecondAt(clip, index, clipSeconds, o));
  const owner: number[] = [];
  for (let s = 0; s < seconds; s++) {
    let bi = -1;
    for (let i = 0; i < offsets.length; i++) if (counts[i][s] >= 2 && (bi === -1 || counts[i][s] > counts[bi][s])) bi = i;
    owner.push(bi);
  }

  // A second with little sound in the clip (a pause) is no evidence of an edit; it continues the segment around it.
  const silent = quietSeconds(clip, seconds);
  const quiet = (s: number) => silent[s];

  let runs: Segment[] = [];
  for (let s = 0; s < seconds; s++) {
    if (owner[s] === -1) {
      const last = runs[runs.length - 1];
      if (last && quiet(s) && last.clipEnd === s) last.clipEnd = Math.min(s + 1, clipSeconds);
      continue;
    }
    const offsetSec = offsets[owner[s]] / FRAMES_PER_SECOND;
    const last = runs[runs.length - 1];
    if (last && last.offsetSec === offsetSec && last.clipEnd >= s) {
      last.clipEnd = Math.min(s + 1, clipSeconds);
      last.hits += counts[owner[s]][s];
    } else runs.push({ clipStart: s, clipEnd: Math.min(s + 1, clipSeconds), offsetSec, hits: counts[owner[s]][s] });
  }
  // A lone second claimed by a different offset in the middle of the clip is noise, not an edit.
  if (runs.length > 2) runs = runs.filter((r, i) => i === 0 || i === runs.length - 1 || r.clipEnd - r.clipStart >= 2);
  // Offsets within a frame or two of the primary are the primary; use its refined value.
  for (const r of runs) if (Math.abs(r.offsetSec - primary.offsetSec) < 0.05) r.offsetSec = primary.offsetSec;
  const merged: Segment[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && last.offsetSec === r.offsetSec && r.clipStart - last.clipEnd < 1) {
      last.clipEnd = r.clipEnd;
      last.hits += r.hits;
    } else merged.push({ ...r });
  }

  const edits: Edit[] = [];
  for (let i = 1; i < merged.length; i++) {
    const a = merged[i - 1];
    const b = merged[i];
    const gap = b.clipStart - a.clipEnd;
    if (gap >= 1) edits.push({ kind: "inserted", atClipSec: a.clipEnd, seconds: gap });
    // Stream time skipped beyond the clip time that passed: that much of the original is missing.
    const jump = Math.round((b.offsetSec - a.offsetSec) * 10) / 10;
    if (jump >= 0.3) edits.push({ kind: "cut", atClipSec: b.clipStart, seconds: jump });
    else if (jump <= -0.3) edits.push({ kind: "reordered", atClipSec: b.clipStart, seconds: -jump });
  }
  return { segments: merged, edits };
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

// Scores stream seconds covered by clip time [fromClip, toClip) at one offset.
export function verdicts(
  clip: ClipPrint,
  records: SecondRecord[],
  offsetSec: number,
  perClipSecond: number[] | null,
  fromClip = 0,
  toClip = clip.duration,
): SecondVerdict[] {
  const bySecond = new Map(records.map((r) => [r.s, r]));
  const silent = quietSeconds(clip.landmarks, Math.max(1, Math.ceil(clip.duration)));
  const first = Math.ceil(offsetSec + fromClip);
  const last = Math.floor(offsetSec + toClip) - 1;
  const out: SecondVerdict[] = [];
  for (let s = first; s <= last; s++) {
    const rec = bySecond.get(s);
    const clipSecond = Math.floor(s + 0.5 - offsetSec);
    const audioHits = perClipSecond && clipSecond >= 0 && clipSecond < perClipSecond.length ? perClipSecond[clipSecond] : 0;
    const frame = nearestFrame(clip.frames, s + 0.5 - offsetSec);
    const hashes = rec ? recordHashes(rec) : [];
    const pictureBits = frame?.hash && hashes.length ? bestDistance(frame.hash, hashes) : null;
    out.push({
      s,
      audioHits,
      pictureBits,
      audio: audioHits >= 2,
      picture: pictureBits !== null && pictureBits <= PICTURE_MATCH_BITS,
      quiet: clipSecond >= 0 && clipSecond < silent.length ? silent[clipSecond] : false,
    });
  }
  return out;
}

export function checkClip(clip: ClipPrint, streams: { streamId: Hex; minutes: MinuteFile[] }[]): CheckResult {
  const audioHits: { streamId: Hex; audio: AudioMatch; records: SecondRecord[]; index: Map<number, number[]> }[] = [];
  for (const st of streams) {
    const index = buildAudioIndex(st.minutes);
    const audio = matchAudio(clip.landmarks, index, clip.duration);
    if (audioIsMatch(audio)) audioHits.push({ streamId: st.streamId, audio: audio!, records: st.minutes.flatMap((m) => m.seconds), index });
  }
  audioHits.sort((a, b) => b.audio.hits - a.audio.hits);
  if (audioHits.length) {
    const [best, ...rest] = audioHits;
    const { segments, edits } = findSegments(clip.landmarks, best.index, clip.duration, best.audio);
    const stitched = new Set(segments.map((g) => g.offsetSec)).size > 1;
    // A stitched clip is scored segment by segment, each against its own part of the stream.
    const seconds = stitched
      ? segments.flatMap((g) =>
          verdicts(clip, best.records, g.offsetSec, perSecondAt(clip.landmarks, best.index, clip.duration, Math.round(g.offsetSec * FRAMES_PER_SECOND)), g.clipStart, g.clipEnd),
        )
      : verdicts(clip, best.records, best.audio.offsetSec, best.audio.perClipSecond);
    return {
      status: "match",
      streamId: best.streamId,
      // Where the clip starts in the stream; for a stitched clip that is its first piece.
      offsetSec: segments[0]?.offsetSec ?? best.audio.offsetSec,
      audio: best.audio,
      seconds,
      alsoFound: rest.map((r) => ({ streamId: r.streamId, offsetSec: r.audio.offsetSec, hits: r.audio.hits })),
      segments,
      edits,
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
      alsoFound: [],
      segments: [],
      edits: [],
    };
  }
  return { status: "no-match", streamId: null, offsetSec: null, audio: null, seconds: [], alsoFound: [], segments: [], edits: [] };
}
