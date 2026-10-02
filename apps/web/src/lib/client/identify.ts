import { SAMPLE_RATE } from "@clipright/engine";
import { decodePcm8k } from "./media";
import { encodeWav } from "./wav";

export interface CatalogHit {
  source: "Wikiquote" | "trace.moe";
  title: string;
  url: string;
  matched: string;
  detail?: string;
}

export interface Identification {
  model: string;
  ai: {
    lines: string[];
    description: string;
    title?: string;
    kind?: string;
    evidence: string[];
    confidence: number;
  };
  catalog: CatalogHit[];
}

const FRAMES = 8;
const WIDTH = 480;
const MAX_AUDIO_SEC = 30;

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// A handful of evenly spaced colour frames, small enough to send.
async function sampleFrames(file: Blob): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("no video"));
    });
    if (!video.videoWidth || !Number.isFinite(video.duration)) return [];
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * WIDTH);
    const ctx = canvas.getContext("2d")!;
    const out: string[] = [];
    for (let i = 0; i < FRAMES; i++) {
      const t = ((i + 0.5) / FRAMES) * video.duration;
      await new Promise<void>((resolve) => {
        const done = () => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        video.currentTime = t;
        setTimeout(done, 3000);
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.72));
      if (blob) out.push(await toBase64(blob));
    }
    return out;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Only a few frames and the sound leave the device, never the clip itself.
export async function identifyClip(file: Blob): Promise<Identification> {
  const [frames, pcm] = await Promise.all([sampleFrames(file), decodePcm8k(file)]);
  const audio = pcm.length ? await toBase64(encodeWav(pcm.subarray(0, MAX_AUDIO_SEC * SAMPLE_RATE), SAMPLE_RATE)) : null;
  const res = await fetch("/api/identify", { method: "POST", body: JSON.stringify({ frames, audio }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Lookup failed (${res.status})`);
  return body as Identification;
}
