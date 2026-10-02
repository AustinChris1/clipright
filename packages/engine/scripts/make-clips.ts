// Cuts test clips from a recording: node scripts/make-clips.ts <recording> <startSec> [outDir]
import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { ffmpeg } from "../src/node/index.ts";

const [input, startArg, outArg] = process.argv.slice(2);
if (!input || !startArg) throw new Error("usage: node scripts/make-clips.ts <recording> <startSec> [outDir]");
const start = String(Number(startArg));
const out = resolve(outArg ?? "clips");
mkdirSync(out, { recursive: true });

const crop = "crop=ih*9/16:ih,scale=720:1280,drawbox=y=ih*0.70:w=iw:h=ih*0.12:color=black@0.6:t=fill";
const caption = "drawtext=text='WAIT FOR IT':fontcolor=white:fontsize=72:x=(w-tw)/2:y=h*0.735";
const encode = ["-c:v", "libx264", "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"];
// A generated melody stands in for a trending sound, so no one else's music is needed.
const melody = "aevalsrc='0.25*sin(2*PI*(220+110*floor(mod(t*2,4)))*t)+0.15*sin(2*PI*330*t)':s=48000:d=15";

// Burned-in captions need a font; fall back to the caption bar alone if drawtext is unavailable.
async function withCaption(make: (vf: string) => string[]) {
  try {
    await ffmpeg(make(`${crop},${caption}`));
  } catch {
    await ffmpeg(make(crop));
  }
}

await withCaption((vf) => ["-y", "-ss", start, "-t", "15", "-i", input, "-vf", vf, ...encode, join(out, "vertical.mp4")]);
await withCaption((vf) => [
  "-y", "-ss", start, "-t", "15", "-i", input, "-f", "lavfi", "-i", melody,
  "-filter_complex", `[0:v]${vf}[v]`, "-map", "[v]", "-map", "1:a", "-shortest", ...encode, join(out, "sound-swapped.mp4"),
]);
await ffmpeg([
  "-y", "-f", "lavfi", "-i", "testsrc2=s=720x1280:rate=30:d=15", "-f", "lavfi", "-i", melody,
  "-map", "0:v", "-map", "1:a", "-shortest", ...encode, join(out, "unrelated.mp4"),
]);

console.log(`from ${basename(input)} at ${start}s ->`);
for (const f of ["vertical.mp4", "sound-swapped.mp4", "unrelated.mp4"]) console.log(`  ${join(out, f)}`);
