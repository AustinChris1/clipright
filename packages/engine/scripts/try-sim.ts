// Replays the Try it flow offline on a WAV: stamp it, trim an honest copy, cut a stretch out of another, check both.
// node scripts/try-sim.ts <file.wav> <cutAtSec> <cutLenSec> [recordSec]
import { readFileSync } from "node:fs";
import { buildMinute, checkClip, landmarks, landmarksForMinuteSlice, resample, SAMPLE_RATE, type MinuteFile } from "../src/index.ts";

const [file, cutAtArg, cutLenArg, recordArg] = process.argv.slice(2);
const buf = readFileSync(file);
const rate = buf.readUInt32LE(24);
const all = new Float32Array((buf.length - 44) >> 1).map((_, i) => buf.readInt16LE(44 + i * 2) / 0x8000);
const data = all.slice(0, Math.round(Number(recordArg ?? all.length / rate) * rate));
const duration = data.length / rate;
const at = (s: number) => Math.round(s * rate);
const streamId = `0x${"ab".repeat(32)}` as const;
const file0: MinuteFile = buildMinute(streamId, 0, landmarksForMinuteSlice(resample(data, rate, SAMPLE_RATE), 0), new Map(), Math.floor(duration));

const check = (pcm: Float32Array) => {
  const c = resample(pcm, rate, SAMPLE_RATE);
  const r = checkClip({ duration: c.length / SAMPLE_RATE, landmarks: landmarks(c), frames: [] }, [{ streamId, minutes: [file0] }]);
  return { status: r.status, segments: r.segments.map((s) => `${s.clipStart}-${s.clipEnd}@${s.offsetSec.toFixed(2)}`), edits: r.edits };
};

const honest = data.slice(at(0.5), at(duration - 0.3));
const cutStart = Number(cutAtArg);
const cutLen = Number(cutLenArg);
const edited = new Float32Array(data.length - at(cutLen));
edited.set(data.subarray(0, at(cutStart)), 0);
edited.set(data.subarray(at(cutStart + cutLen)), at(cutStart));
console.log("honest", JSON.stringify(check(honest)));
console.log("edited", JSON.stringify(check(edited)));
