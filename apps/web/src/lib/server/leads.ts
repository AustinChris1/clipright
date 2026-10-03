import { audioIsMatch, landmarks, matchAudio, SAMPLE_RATE, type Landmark } from "@clipright/engine";
import { randomBytes } from "node:crypto";
import { loadLeads, saveLead, type CatalogHit, type LeadFile } from "./store";

const REFRESH_MS = 60_000;
let cache: { at: number; leads: { lead: LeadFile; index: Map<number, number[]> }[] } | null = null;

function indexOf(lead: LeadFile) {
  const index = new Map<number, number[]>();
  for (const [hash, frame] of lead.landmarks) {
    let list = index.get(hash);
    if (!list) index.set(hash, (list = []));
    list.push(frame);
  }
  return index;
}

async function leads() {
  if (!cache || Date.now() - cache.at > REFRESH_MS) cache = { at: Date.now(), leads: (await loadLeads()).map((lead) => ({ lead, index: indexOf(lead) })) };
  return cache.leads;
}

// Same matcher as stamped streams: a re-upload or re-crop of a clip someone already looked up finds its lead.
export async function findLead(clip: Landmark[], clipSeconds: number): Promise<LeadFile | null> {
  let best: { lead: LeadFile; hits: number } | null = null;
  for (const { lead, index } of await leads()) {
    const m = matchAudio(clip, index, clipSeconds);
    if (audioIsMatch(m) && (!best || m!.hits > best.hits)) best = { lead, hits: m!.hits };
  }
  return best?.lead ?? null;
}

// The 16-bit WAV the browser sent, back to samples, so landmarks are made here and cannot be swapped.
export function wavToPcm(base64: string): Float32Array {
  const buf = Buffer.from(base64, "base64");
  const pcm = new Float32Array(Math.max(0, (buf.length - 44) >> 1));
  for (let i = 0; i < pcm.length; i++) pcm[i] = buf.readInt16LE(44 + i * 2) / 0x8000;
  return pcm;
}

export async function rememberLead(pcm: Float32Array, catalog: CatalogHit[]) {
  if (!catalog.length || pcm.length < SAMPLE_RATE * 3) return;
  const marks = landmarks(pcm);
  if (await findLead(marks, pcm.length / SAMPLE_RATE)) return;
  const lead: LeadFile = { id: randomBytes(8).toString("hex"), createdAt: Date.now(), landmarks: marks.map((l) => [l.hash, l.frame]), catalog };
  await saveLead(lead);
  cache?.leads.push({ lead, index: indexOf(lead) });
}
