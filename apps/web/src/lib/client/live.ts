import {
  buildMinute,
  landmarksForMinuteSlice,
  pictureHash,
  resample,
  SAMPLE_RATE,
  type MinuteFile,
  type SecondPictures,
} from "@clipright/engine";
import type { Hex } from "viem";
import { centreCrop916, GrayGrabber } from "./media";

const LOOKAHEAD_SEC = 1.1;

export interface LiveCallbacks {
  onMinute: (file: MinuteFile) => void;
  onSecond?: (s: number) => void;
}

// Fingerprints a live MediaStream on the audio clock and hands over one finished minute at a time.
export class LiveRecorder {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: { start: number; data: Float32Array }[] = [];
  private total = 0;
  private rate = 48000;
  private pictures = new Map<number, SecondPictures>();
  private nextPicture = 0;
  private nextMinute = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private grabber = new GrayGrabber();

  constructor(
    private stream: MediaStream,
    private video: HTMLVideoElement,
    private streamId: Hex,
    private cb: LiveCallbacks,
  ) {}

  get elapsed() {
    return this.total / this.rate;
  }

  async start() {
    this.ctx = new AudioContext();
    this.rate = this.ctx.sampleRate;
    await this.ctx.audioWorklet.addModule("/pcm-capture.js");
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "pcm-capture");
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      this.chunks.push({ start: this.total, data: e.data });
      this.total += e.data.length;
    };
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(this.node).connect(mute).connect(this.ctx.destination);
    this.timer = setInterval(() => this.tick(), 100);
  }

  private grabPictures(): SecondPictures {
    const v = this.video;
    if (!v.videoWidth) return { full: null, center: null };
    const c = centreCrop916(v.videoWidth, v.videoHeight);
    return {
      full: pictureHash(this.grabber.grab(v, 0, 0, v.videoWidth, v.videoHeight)),
      center: pictureHash(this.grabber.grab(v, c.sx, c.sy, c.sw, c.sh)),
    };
  }

  private tick() {
    const el = this.elapsed;
    while (el >= this.nextPicture + 0.5) {
      const s = this.nextPicture++;
      this.pictures.set(s, el - (s + 0.5) < 0.3 ? this.grabPictures() : { full: null, center: null });
      this.cb.onSecond?.(s);
    }
    if (el >= (this.nextMinute + 1) * 60 + LOOKAHEAD_SEC) this.finalize(this.nextMinute, 60);
  }

  private slice(from: number, to: number): Float32Array {
    const out = new Float32Array(Math.max(0, to - from));
    for (const c of this.chunks) {
      const a = Math.max(from, c.start);
      const b = Math.min(to, c.start + c.data.length);
      if (a < b) out.set(c.data.subarray(a - c.start, b - c.start), a - from);
    }
    return out;
  }

  private finalize(minute: number, seconds: number) {
    const from = minute * 60 * this.rate;
    const to = Math.min(this.total, Math.round(((minute + 1) * 60 + LOOKAHEAD_SEC) * this.rate));
    const pcm8k = resample(this.slice(from, to), this.rate, SAMPLE_RATE);
    const file = buildMinute(this.streamId, minute, landmarksForMinuteSlice(pcm8k, minute), this.pictures, seconds);
    const keepFrom = (minute + 1) * 60 * this.rate;
    this.chunks = this.chunks.filter((c) => c.start + c.data.length > keepFrom);
    for (const s of this.pictures.keys()) if (s < (minute + 1) * 60) this.pictures.delete(s);
    this.nextMinute = minute + 1;
    this.cb.onMinute(file);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.tick();
    const remaining = Math.floor(this.elapsed - this.nextMinute * 60);
    if (remaining >= 1) this.finalize(this.nextMinute, Math.min(60, remaining));
    this.node?.disconnect();
    await this.ctx?.close();
  }
}
