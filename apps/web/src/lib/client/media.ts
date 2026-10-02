import { landmarks, PIC_SIZE, pictureHash, resample, SAMPLE_RATE, type ClipFrame, type ClipPrint } from "@clipright/engine";

const WORK = PIC_SIZE * 4;

// Box-averages a 256px draw down to 64x64 luma, close to ffmpeg's area scaler.
export class GrayGrabber {
  private ctx: CanvasRenderingContext2D;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = WORK;
    canvas.height = WORK;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    this.ctx.imageSmoothingQuality = "high";
  }

  grab(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Float32Array {
    this.ctx.drawImage(src, sx, sy, sw, sh, 0, 0, WORK, WORK);
    const { data } = this.ctx.getImageData(0, 0, WORK, WORK);
    const out = new Float32Array(PIC_SIZE * PIC_SIZE);
    for (let y = 0; y < WORK; y++)
      for (let x = 0; x < WORK; x++) {
        const i = (y * WORK + x) * 4;
        out[(y >> 2) * PIC_SIZE + (x >> 2)] += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 16;
      }
    return out;
  }
}

export function centreCrop916(w: number, h: number) {
  const sw = Math.min(w, Math.round((h * 9) / 16));
  return { sx: Math.round((w - sw) / 2), sy: 0, sw, sh: h };
}

export async function decodePcm8k(file: Blob): Promise<Float32Array> {
  try {
    const audio = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await file.arrayBuffer());
    const mono = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += ch[i] / audio.numberOfChannels;
    }
    return resample(mono, audio.sampleRate, SAMPLE_RATE);
  } catch {
    return new Float32Array(0);
  }
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

const PLAYBACK_RATE = 8;
const FILL_TOLERANCE = 0.06;
const PLAYBACK_SLOTS = 8;
const SEEK_FPS = 4;

// Fast path: play muted at 8x and keep, per slot, the decoded frame closest to it, with its exact time.
function framesByPlayback(video: HTMLVideoElement, duration: number, fps: number, onProgress?: (p: number) => void): Promise<ClipFrame[]> {
  const step = 1 / fps;
  const grabber = new GrayGrabber();
  const slots = new Map<number, { t: number; err: number; hash: Uint8Array | null }>();
  return new Promise((resolve, reject) => {
    let lastFrameAt = performance.now();
    const finish = () => {
      clearInterval(watchdog);
      video.pause();
      resolve([...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => ({ t: v.t, hash: v.hash })));
    };
    const watchdog = setInterval(() => {
      if (performance.now() - lastFrameAt > 4000) finish();
    }, 500);
    const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      lastFrameAt = performance.now();
      const t = meta.mediaTime;
      const slot = Math.round(t / step);
      const err = Math.abs(t - slot * step);
      const prev = slots.get(slot);
      if (!prev || err < prev.err) slots.set(slot, { t, err, hash: pictureHash(grabber.grab(video, 0, 0, video.videoWidth, video.videoHeight)) });
      if (Number.isFinite(duration) && duration > 0) onProgress?.(Math.min(1, t / duration));
      if (!video.ended) video.requestVideoFrameCallback(onFrame);
    };
    video.onended = finish;
    video.onerror = () => {
      clearInterval(watchdog);
      reject(new Error("this browser cannot decode the video"));
    };
    // Large frames decode slower, so full HD plays at about 4x to leave fewer gaps to seek.
    video.playbackRate = Math.max(2, Math.min(PLAYBACK_RATE, (PLAYBACK_RATE * 1280 * 720) / (video.videoWidth * video.videoHeight)));
    video.requestVideoFrameCallback(onFrame);
    video.play().catch((e) => {
      clearInterval(watchdog);
      reject(e);
    });
  });
}

// Seek only to the requested times that no captured frame is within FILL_TOLERANCE of.
async function fillGaps(video: HTMLVideoElement, frames: ClipFrame[], targets: number[]): Promise<ClipFrame[]> {
  const grabber = new GrayGrabber();
  const times = frames.map((f) => f.t).sort((a, b) => a - b);
  const covered = (t: number) => {
    let lo = 0;
    let hi = times.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (Math.abs(times[mid] - t) <= FILL_TOLERANCE) return true;
      if (times[mid] < t) lo = mid + 1;
      else hi = mid - 1;
    }
    return false;
  };
  const extra: ClipFrame[] = [];
  const end = video.duration;
  for (const t of targets) {
    if (t < 0 || (Number.isFinite(end) && t > end) || covered(t)) continue;
    await seek(video, Number.isFinite(end) ? Math.min(t, end - 0.01) : t);
    extra.push({ t, hash: pictureHash(grabber.grab(video, 0, 0, video.videoWidth, video.videoHeight)) });
  }
  return [...frames, ...extra].sort((a, b) => a.t - b.t);
}

// Fallback: seek to each sample time; slower on long clips with sparse keyframes.
async function framesBySeeking(video: HTMLVideoElement, duration: number, fps: number, onProgress?: (p: number) => void): Promise<ClipFrame[]> {
  const grabber = new GrayGrabber();
  const frames: ClipFrame[] = [];
  for (let t = 0; t < duration; t += 1 / fps) {
    await seek(video, Math.min(t, duration - 0.01));
    frames.push({ t, hash: pictureHash(grabber.grab(video, 0, 0, video.videoWidth, video.videoHeight)) });
    onProgress?.(t / duration);
  }
  return frames;
}

// Some downloaded MP4s report an infinite duration until the end has been located.
async function resolveDuration(video: HTMLVideoElement, fallback: number): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 3000);
    video.addEventListener("durationchange", () => {
      if (Number.isFinite(video.duration)) {
        clearTimeout(timer);
        resolve();
      }
    });
    video.currentTime = 1e9;
  });
  await seek(video, 0);
  return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : fallback;
}

export interface OpenedClip {
  print: ClipPrint;
  // Seeks to any of these clip times that no captured frame is close to, adding them to print.frames.
  fill: (times: number[]) => Promise<void>;
  close: () => void;
}

// Captures frames by fast playback and keeps the video open, so the check can later seek to exact moments.
export async function openClip(file: Blob, onProgress?: (stage: string, p: number) => void): Promise<OpenedClip> {
  onProgress?.("Listening", 0);
  const pcm = await decodePcm8k(file);
  const print: ClipPrint = { duration: pcm.length / SAMPLE_RATE, landmarks: landmarks(pcm), frames: [] };
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  const close = () => {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  };
  const fill = async (times: number[]) => {
    if (!video.videoWidth) return;
    print.frames = await fillGaps(video, print.frames, times);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("this browser cannot decode the video"));
    });
  } catch (e) {
    if (pcm.length) return { print, fill: async () => {}, close };
    close();
    throw e;
  }
  if (!video.videoWidth) return { print, fill, close };
  onProgress?.("Looking", 0);
  const duration = await resolveDuration(video, print.duration);
  print.duration = Math.max(print.duration, Number.isFinite(duration) ? duration : 0);
  const expected = Math.floor(duration * SEEK_FPS);
  if ("requestVideoFrameCallback" in video) {
    print.frames = await framesByPlayback(video, duration, PLAYBACK_SLOTS, (p) => onProgress?.("Looking", p)).catch(() => [] as ClipFrame[]);
    if (print.frames.length >= expected * 0.5) return { print, fill, close };
    await seek(video, 0);
  }
  if (duration > 0) print.frames = await framesBySeeking(video, duration, SEEK_FPS, (p) => onProgress?.("Looking", p));
  return { print, fill, close };
}
