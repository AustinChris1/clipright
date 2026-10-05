import { checkClip, type ClipPrint } from "@clipright/engine";
import { randomBytes } from "node:crypto";
import type { Hex } from "viem";
import { registryEvents } from "./chainEvents";
import { getStream, loadStream, saveVerdict, type VerdictFile } from "./store";

export interface VerdictRequest {
  streamId: Hex;
  duration: number;
  landmarks: [number, number][];
  frames: [number, string | null][];
  thumb: string | null;
}

const MAX_LANDMARKS = 40_000;
const MAX_FRAMES = 4_000;
const MAX_THUMB = 200_000;

export function parseRequest(body: unknown): VerdictRequest | string {
  const b = body as Partial<VerdictRequest> | null;
  if (!b || typeof b.streamId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(b.streamId)) return "bad stream id";
  if (typeof b.duration !== "number" || !(b.duration > 0) || b.duration > 900) return "bad duration";
  if (!Array.isArray(b.landmarks) || !b.landmarks.length || b.landmarks.length > MAX_LANDMARKS) return "bad landmarks";
  if (!b.landmarks.every((p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]))) return "bad landmarks";
  const frames = Array.isArray(b.frames) ? b.frames.slice(0, MAX_FRAMES) : [];
  if (!frames.every((f) => Array.isArray(f) && typeof f[0] === "number" && (f[1] === null || (typeof f[1] === "string" && /^[0-9a-f]{64}$/.test(f[1]))))) return "bad frames";
  const thumb = typeof b.thumb === "string" && b.thumb.length < MAX_THUMB && /^[A-Za-z0-9+/=]+$/.test(b.thumb) ? b.thumb : null;
  return { streamId: b.streamId as Hex, duration: b.duration, landmarks: b.landmarks, frames, thumb };
}

// The browser's verdict is not trusted: the clip's fingerprint is matched again here against the stored stream.
export async function createVerdict(req: VerdictRequest): Promise<VerdictFile | string> {
  const meta = await getStream(req.streamId);
  if (!meta) return "unknown stream";
  const { minutes } = await loadStream(req.streamId);
  if (!minutes.length) return "this stream has no stamped minutes";
  const clip: ClipPrint = {
    duration: req.duration,
    landmarks: req.landmarks.map(([hash, frame]) => ({ hash, frame })),
    frames: req.frames.map(([t, h]) => ({ t, hash: h ? new Uint8Array(Buffer.from(h, "hex")) : null })),
  };
  const result = checkClip(clip, [{ streamId: req.streamId, minutes }]);
  if (result.status === "no-match" || result.offsetSec === null) return "this clip does not match the stream, so there is nothing to share";
  const end = result.segments.length ? Math.max(...result.segments.map((g) => g.offsetSec + g.clipEnd)) : result.offsetSec + req.duration;
  const owner = (await registryEvents().catch(() => null))?.ownerOf.get(meta.signer.toLowerCase()) ?? null;
  const verdict: VerdictFile = {
    id: randomBytes(6).toString("base64url"),
    createdAt: Date.now(),
    streamId: req.streamId,
    streamTitle: meta.title,
    owner,
    status: result.status,
    offsetSec: result.offsetSec,
    endSec: end,
    duration: req.duration,
    hasVideo: clip.frames.length > 0,
    audioHits: result.audio?.hits ?? 0,
    seconds: result.seconds.map(({ s, audio, picture, audioHits, pictureBits, quiet }) => ({ s, audio, picture, audioHits, pictureBits, quiet })),
    edits: result.edits,
    thumb: req.thumb,
    landmarks: req.landmarks,
  };
  await saveVerdict(verdict);
  return verdict;
}
