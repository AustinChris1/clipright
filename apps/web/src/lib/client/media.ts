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

// Samples the frame on screen every 1/fps seconds, the same rule the Node adapter uses.
export async function clipFrames(file: Blob, fps = 4, onProgress?: (p: number) => void) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("this browser cannot decode the video"));
    });
    const duration = video.duration;
    const frames: ClipFrame[] = [];
    if (!video.videoWidth) return { frames, duration };
    const grabber = new GrayGrabber();
    for (let t = 0; t < duration; t += 1 / fps) {
      await seek(video, Math.min(t, duration - 0.01));
      frames.push({ t, hash: pictureHash(grabber.grab(video, 0, 0, video.videoWidth, video.videoHeight)) });
      onProgress?.(t / duration);
    }
    return { frames, duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fingerprintClip(file: Blob, onProgress?: (stage: string, p: number) => void): Promise<ClipPrint> {
  onProgress?.("Listening", 0);
  const pcm = await decodePcm8k(file);
  const lms = landmarks(pcm);
  onProgress?.("Looking", 0);
  const { frames, duration } = await clipFrames(file, 4, (p) => onProgress?.("Looking", p));
  return { duration: Math.max(pcm.length / SAMPLE_RATE, Number.isFinite(duration) ? duration : 0), landmarks: lms, frames };
}
