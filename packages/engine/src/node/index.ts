import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import type { Hex } from "viem";
import { landmarks, minuteLandmarks, SAMPLE_RATE } from "../audio.ts";
import { buildMinute, type MinuteFile, type SecondPictures } from "../fingerprint.ts";
import type { ClipFrame, ClipPrint } from "../match.ts";
import { PIC_SIZE, pictureHash } from "../picture.ts";
import { resample } from "../resample.ts";

export const ffmpegPath = (ffmpegStatic as unknown as string | null) ?? "ffmpeg";

function run(args: string[], level: string): Promise<{ out: Buffer; err: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-v", level, ...args], { windowsHide: true });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", reject);
    p.on("close", (code) => {
      const errText = Buffer.concat(err).toString();
      code === 0 ? resolve({ out: Buffer.concat(out), err: errText }) : reject(new Error(`ffmpeg exited ${code}: ${errText}`));
    });
  });
}

export async function ffmpeg(args: string[]): Promise<Buffer> {
  return (await run(args, "error")).out;
}

const noStream = (e: unknown) => e instanceof Error && /does not contain any stream|matches no streams/.test(e.message);

export async function decodeAudio8k(file: string): Promise<Float32Array> {
  let buf: Buffer;
  try {
    buf = await ffmpeg(["-i", file, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"]);
  } catch (e) {
    if (noStream(e)) return new Float32Array(0);
    throw e;
  }
  const pcm = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return resample(pcm, 48000, SAMPLE_RATE);
}

export const CROP_CENTER_916 = "crop=ih*9/16:ih";

export interface TimedFrame {
  t: number;
  gray: Uint8Array;
}

// Every decoded frame with its presentation time, downscaled to 64x64 grayscale.
export async function decodeFrames(file: string, crop?: string): Promise<TimedFrame[]> {
  const vf = [crop, `scale=${PIC_SIZE}:${PIC_SIZE}:flags=area`, "format=gray", "showinfo"].filter(Boolean).join(",");
  let out: Buffer;
  let err: string;
  try {
    ({ out, err } = await run(["-i", file, "-an", "-vf", vf, "-fps_mode", "passthrough", "-f", "rawvideo", "-"], "info"));
  } catch (e) {
    if (noStream(e)) return [];
    throw e;
  }
  const times = [...err.matchAll(/pts_time:\s*([-\d.]+)/g)].map((m) => Number(m[1]));
  const size = PIC_SIZE * PIC_SIZE;
  const frames: TimedFrame[] = [];
  for (let i = 0; i < times.length && (i + 1) * size <= out.length; i++)
    frames.push({ t: times[i], gray: new Uint8Array(out.subarray(i * size, (i + 1) * size)) });
  return frames;
}

// The frame on screen at time t, the same rule a browser applies when seeking a <video>.
export function frameAt(frames: TimedFrame[], t: number): TimedFrame | null {
  let lo = 0;
  let hi = frames.length - 1;
  let best: TimedFrame | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t + 1e-6) {
      best = frames[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

// Stream side: sound landmarks plus full and centre 9:16 pictures sampled at s + 0.5.
export async function fingerprintFile(file: string, streamId: Hex): Promise<MinuteFile[]> {
  const [pcm, full, center] = await Promise.all([decodeAudio8k(file), decodeFrames(file), decodeFrames(file, CROP_CENTER_916)]);
  const totalSeconds = Math.floor(pcm.length / SAMPLE_RATE);
  const pictures = new Map<number, SecondPictures>();
  for (let s = 0; s < totalSeconds; s++) {
    const pf = frameAt(full, s + 0.5);
    const pc = frameAt(center, s + 0.5);
    pictures.set(s, { full: pf ? pictureHash(pf.gray) : null, center: pc ? pictureHash(pc.gray) : null });
  }
  const minutes: MinuteFile[] = [];
  for (let m = 0; m * 60 < totalSeconds; m++)
    minutes.push(buildMinute(streamId, m, minuteLandmarks(pcm, m), pictures, Math.min(60, totalSeconds - m * 60)));
  return minutes;
}

export async function fingerprintClip(file: string): Promise<ClipPrint> {
  const pcm = await decodeAudio8k(file);
  return { duration: pcm.length / SAMPLE_RATE, landmarks: landmarks(pcm), frames: await clipFrames(file) };
}

export async function clipFrames(file: string, fps = 4): Promise<ClipFrame[]> {
  const frames = await decodeFrames(file);
  const end = frames.length ? frames[frames.length - 1].t : 0;
  const out: ClipFrame[] = [];
  for (let t = 0; t <= end; t += 1 / fps) {
    const f = frameAt(frames, t);
    out.push({ t, hash: f ? pictureHash(f.gray) : null });
  }
  return out;
}
