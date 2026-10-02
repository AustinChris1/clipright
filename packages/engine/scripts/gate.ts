// Day-1 gate: synthesize a stream, cut realistic clips from it, and check the matcher finds the right second.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { keccak256, toHex } from "viem";
import { checkClip, recomputeRoot } from "../src/index.ts";
import { CROP_CENTER_916, ffmpeg, fingerprintClip, fingerprintFile } from "../src/node/index.ts";

const dir = resolve(import.meta.dirname, "../fixtures");
mkdirSync(dir, { recursive: true });
const f = (name: string) => join(dir, name);

const STREAM_TEXT = `Okay chat, we are live. Welcome back everybody, it is a slow Thursday so we are doing the long run today.
First thing, thank you to everyone who stuck around after the raid last night, that was honestly insane.
Right, so the plan is simple. We clear the first two zones without dying, we grab the relic, and then we decide if we push the boss or call it.
Somebody in chat says the boss has a second phase now. I do not believe you. I refuse to believe you.
Let me check the map. Okay, there is a shortcut on the left, past the broken bridge, and if we time the jump right we skip the whole swamp.
Here we go. Three, two, one. No. No no no. Okay that did not happen, nobody clip that.
Fine, attempt number two. Same jump, slower this time. Wait for it. Yes! Look at that, clean landing, I told you it was possible.
Now we loot. Gold, more gold, a weird hat. I am wearing the weird hat for the rest of the stream, that is just the rule.
Quick question for chat while we walk: pineapple on pizza, yes or no? I already know the answer and the answer is yes.
Okay the boss room is right there. Everybody be quiet. If this goes badly I am blaming the hat.
Phase one is easy, dodge left, dodge left, hit, hit, back off. Phase two. Oh. Oh it does have a second phase. Chat, I apologize.
We are fine, we are fine, health is low but the strategy is solid. One more hit. One more hit. And it is down!
That is the run. Thank you all so much for hanging out, seriously, see you all tomorrow, same time, same weird hat.`;

const OTHER_TEXT = `This is a completely different recording about cooking a simple tomato soup.
Start with two onions, chopped small, and soften them in olive oil for ten minutes on a low heat.
Add garlic, a spoon of tomato paste, and then the tinned tomatoes with a little stock.
Let it simmer for twenty minutes, blend it smooth, and finish with salt, pepper and a splash of cream.`;

function tts(text: string, out: string, rate: number) {
  if (existsSync(out)) return;
  const ps = `Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = ${rate}
$s.SetOutputToWaveFile('${out.replace(/'/g, "''")}')
$s.Speak([Console]::In.ReadToEnd())
$s.Dispose()`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { input: text });
}

async function makeFixtures() {
  tts(STREAM_TEXT, f("speech.wav"), 0);
  tts(OTHER_TEXT, f("other.wav"), 1);
  if (!existsSync(f("stream.mp4"))) {
    await ffmpeg([
      "-y",
      "-f", "lavfi", "-i", "mandelbrot=s=640x360:rate=15:end_pts=200,scale=1280:720,format=yuv420p",
      "-i", f("speech.wav"),
      "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.02:r=48000",
      "-filter_complex", "[1:a]aresample=48000,apad[s];[s][2:a]amix=inputs=2:duration=first:normalize=0[a]",
      "-map", "0:v", "-map", "[a]", "-t", "120",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "160k",
      f("stream.mp4"),
    ]);
  }
  const vertical = `[0:v]${CROP_CENTER_916},scale=720:1280,drawbox=y=ih*0.70:w=iw:h=ih*0.12:color=black@0.6:t=fill,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='WAIT FOR IT':fontcolor=white:fontsize=72:x=(w-tw)/2:y=h*0.735[v]`;
  const clips: [string, string[]][] = [
    ["clipA.mp4", ["-ss", "47.3", "-t", "15", "-i", f("stream.mp4"), "-filter_complex", vertical, "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-crf", "30", "-c:a", "aac", "-b:a", "96k"]],
    ["clipB.mp4", ["-ss", "47.3", "-t", "15", "-i", f("stream.mp4"), "-i", f("other.wav"), "-f", "lavfi", "-i", "sine=f=220:r=48000",
      "-filter_complex", `${vertical};[1:a]aresample=48000[o];[2:a]volume=0.15[t];[o][t]amix=inputs=2:duration=first[a]`,
      "-map", "[v]", "-map", "[a]", "-t", "15", "-c:v", "libx264", "-crf", "30", "-c:a", "aac", "-b:a", "96k"]],
    ["clipC.mp4", ["-f", "lavfi", "-i", "testsrc2=s=720x1280:rate=30", "-i", f("other.wav"), "-t", "15", "-c:v", "libx264", "-crf", "30", "-c:a", "aac", "-b:a", "96k"]],
    ["clipD.mp4", ["-ss", "88.6", "-t", "12", "-i", f("stream.mp4"), "-vf", "scale=854:480", "-c:v", "libx264", "-crf", "32", "-c:a", "aac", "-b:a", "64k"]],
  ];
  for (const [name, args] of clips) if (!existsSync(f(name))) await ffmpeg(["-y", ...args, f(name)]);
}

const expected: Record<string, { status: string; offset?: number }> = {
  "clipA.mp4": { status: "match", offset: 47.3 },
  "clipB.mp4": { status: "picture-only", offset: 47.3 },
  "clipC.mp4": { status: "no-match" },
  "clipD.mp4": { status: "match", offset: 88.6 },
};

async function main() {
  console.log("fixtures ->", dir);
  await makeFixtures();
  const streamId = keccak256(toHex("gate-stream"));
  const t0 = performance.now();
  const minutes = await fingerprintFile(f("stream.mp4"), streamId);
  console.log(`stream fingerprinted: ${minutes.length} minutes in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  for (const m of minutes) {
    const lm = m.seconds.reduce((n, s) => n + s.a.length, 0);
    console.log(`  minute ${m.minute}: ${m.seconds.length}s, ${lm} landmarks, root ${m.root.slice(0, 18)}... recompute ok=${recomputeRoot(m) === m.root}`);
  }
  writeFileSync(f("minutes.json"), JSON.stringify(minutes));

  let failed = 0;
  for (const name of Object.keys(expected)) {
    const r = checkClip(await fingerprintClip(f(name)), [{ streamId, minutes }]);
    const audioOk = r.seconds.filter((s) => s.audio).length;
    const picOk = r.seconds.filter((s) => s.picture).length;
    const bits = r.seconds.map((s) => s.pictureBits ?? "-").join(",");
    console.log(`\n${name}: ${r.status} offset=${r.offsetSec?.toFixed(3) ?? "-"}s`);
    if (r.audio) console.log(`  audio hits=${r.audio.hits} runnerUp=${r.audio.runnerUp} perSecond=${r.audio.perClipSecond.join(",")}`);
    if (r.seconds.length) console.log(`  seconds ${r.seconds[0].s}..${r.seconds.at(-1)!.s}: audio ok ${audioOk}/${r.seconds.length}, picture ok ${picOk}/${r.seconds.length}`);
    if (r.seconds.length) console.log(`  picture bits: ${bits}`);
    const exp = expected[name];
    let pass: boolean;
    if (exp.status === "match") pass = r.status === "match" && Math.abs((r.offsetSec ?? 0) - exp.offset!) < 0.05;
    else if (exp.status === "picture-only") pass = r.status === "picture-only" && Math.abs((r.offsetSec ?? 0) - exp.offset!) <= 0.25;
    else pass = r.status === "no-match";
    console.log(`  ${pass ? "PASS" : "FAIL"} (expected ${exp.status}${exp.offset ? ` at ${exp.offset}s` : ""})`);
    if (!pass) failed++;
  }
  console.log(failed ? `\n${failed} gate check(s) failed` : "\ngate passed");
  process.exitCode = failed ? 1 : 0;
}

main();
