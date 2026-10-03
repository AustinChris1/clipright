import type { ClipPrint } from "@clipright/engine";
import type { Hex } from "viem";

const THUMB_WIDTH = 360;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// One small frame so the link page shows which clip was checked; audio-only files have none.
async function thumbnail(file: Blob): Promise<string | null> {
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
    if (!video.videoWidth) return null;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Number.isFinite(video.duration) ? video.duration * 0.4 : 0;
      setTimeout(resolve, 3000);
    });
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_WIDTH;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * THUMB_WIDTH);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72).split(",")[1] ?? null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The server matches this fingerprint again before it will vouch for it.
export async function createShareLink(file: Blob, print: ClipPrint, streamId: Hex): Promise<string> {
  const body = {
    streamId,
    duration: print.duration,
    landmarks: print.landmarks.map((l) => [l.hash, l.frame]),
    frames: print.frames.map((f) => [f.t, f.hash ? hex(f.hash) : null]),
    thumb: await thumbnail(file),
  };
  const res = await fetch("/api/verdicts", { method: "POST", body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Could not create the link (${res.status})`);
  return new URL(json.url, location.origin).toString();
}
