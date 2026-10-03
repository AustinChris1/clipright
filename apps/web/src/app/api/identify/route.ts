// Where might an unstamped clip come from? Open catalogs first (Wikiquote, trace.moe), then an AI guess.
// None of this is proof; the UI keeps it apart from what is verified on Monad.
import { rememberLead, wavToPcm } from "@/lib/server/leads";
import type { CatalogHit } from "@/lib/server/store";

export const maxDuration = 60;

// Fall through these on overload; the newest model is often busy on the free tier.
const MODELS = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];
const RETRYABLE = new Set([404, 500, 502, 503, 504]);
const MAX_FRAMES = 10;
const MAX_FRAME_BYTES = 400_000;
const MAX_AUDIO_BYTES = 1_500_000;
const PER_MINUTE = Number(process.env.LIMIT_IDENTIFY_PER_MINUTE || 8);
const UA = "Clipright/1.0 (https://clipright.vercel.app)";

const PROMPT = `You are helping someone find where a short clip from social media comes from.
You get still frames from the clip in order, and its audio.
Most important: transcribe the most distinctive spoken lines word for word into lines (up to 4, each a full sentence, in the language spoken). Leave lines empty if nobody speaks.
Then describe what you see in one or two sentences.
Then give your own guess at the source (film, TV episode, livestream, game, music video, sports, news, ad, viral video) in title, but only if you are genuinely confident; otherwise leave title empty. Never invent season or episode numbers.
evidence lists 1 to 4 specific things you recognised. confidence is your honest probability, from 0 to 1, that title is right.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    lines: { type: "ARRAY", items: { type: "STRING" } },
    description: { type: "STRING" },
    title: { type: "STRING" },
    kind: { type: "STRING", enum: ["tv_episode", "film", "livestream", "game", "music_video", "sports", "news", "ad", "viral_video", "other", "unknown"] },
    evidence: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "NUMBER" },
  },
  required: ["lines", "description", "evidence", "confidence"],
};

interface AiAnswer {
  lines: string[];
  description: string;
  title?: string;
  kind?: string;
  evidence: string[];
  confidence: number;
}

// Whisper on Groq writes down the speech when Gemini is busy or out of quota; no picture description then.
async function transcribe(audio: string): Promise<string[]> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return [];
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(audio, "base64")], { type: "audio/wav" }), "clip.wav");
  form.append("model", process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo");
  form.append("response_format", "json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`Whisper answered ${res.status}`);
  const text = String((await res.json()).text ?? "").trim();
  return text
    .split(/(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter((l) => l.split(/\s+/).length >= 4)
    .slice(0, 6);
}

// Best effort per serverless instance; Gemini's own free-tier quota is the hard limit.
const recent: number[] = [];

async function askGemini(key: string, frames: string[], audio: string | null): Promise<{ model: string; ai: AiAnswer }> {
  const parts = [
    { text: PROMPT },
    { text: frames.length ? `There are ${frames.length} frames.` : "This clip is audio only: there are no frames. Describe only what you hear, never invent visuals." },
    ...frames.map((data) => ({ inline_data: { mime_type: "image/jpeg", data } })),
    ...(audio ? [{ inline_data: { mime_type: "audio/wav", data: audio } }] : []),
  ];
  let lastError = "AI identification failed";
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA } }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      const text = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
      try {
        return { model, ai: JSON.parse(text) };
      } catch {
        lastError = "The AI answer could not be read.";
        continue;
      }
    }
    lastError = json?.error?.message?.split("\n")[0] ?? `Gemini answered ${res.status}`;
    if (res.status === 429) throw Object.assign(new Error("The free AI quota is used up for now. Try again in a minute."), { status: 429 });
    if (!RETRYABLE.has(res.status)) break;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw Object.assign(new Error(lastError), { status: 502 });
}

const unescape = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");

// Exact-phrase search of Wikiquote, an open catalog of film and TV dialogue.
async function wikiquote(lines: string[]): Promise<CatalogHit[]> {
  const hits = new Map<string, CatalogHit>();
  await Promise.all(
    lines
      .map((l) => l.replace(/["“”]/g, "").trim())
      .filter((l) => l.split(/\s+/).length >= 4)
      .slice(0, 6)
      .map(async (line) => {
        const phrase = line.split(/\s+/).slice(0, 10).join(" ").replace(/[.,!?;:]+$/, "");
        const url = `https://en.wikiquote.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=${encodeURIComponent(`"${phrase}"`)}`;
        const res = await fetch(url, { headers: { "user-agent": UA } }).catch(() => null);
        const json = await res?.json().catch(() => null);
        for (const r of json?.query?.search ?? []) {
          if (hits.has(r.title)) continue;
          hits.set(r.title, {
            source: "Wikiquote",
            title: r.title,
            url: `https://en.wikiquote.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
            matched: line,
            detail: unescape(String(r.snippet ?? "")).slice(0, 220),
          });
        }
      }),
  );
  return [...hits.values()];
}

// trace.moe finds the anime, episode and second for a frame; only near-certain matches are kept.
async function traceMoe(frames: string[]): Promise<CatalogHit[]> {
  const frame = frames[Math.floor(frames.length / 2)];
  if (!frame) return [];
  const form = new FormData();
  form.append("image", new Blob([Buffer.from(frame, "base64")], { type: "image/jpeg" }), "frame.jpg");
  const res = await fetch("https://api.trace.moe/search?anilistInfo", { method: "POST", body: form, headers: { "user-agent": UA } }).catch(() => null);
  const json = await res?.json().catch(() => null);
  const top = json?.result?.[0];
  if (!top || top.similarity < 0.92) return [];
  const title = top.anilist?.title?.english || top.anilist?.title?.romaji || String(top.filename ?? "Unknown anime");
  const at = Math.floor(top.from ?? 0);
  return [
    {
      source: "trace.moe",
      title,
      url: typeof top.anilist === "object" ? `https://anilist.co/anime/${top.anilist.id}` : "https://trace.moe",
      matched: `frame similarity ${(top.similarity * 100).toFixed(1)}%`,
      detail: `Episode ${top.episode ?? "?"}, around ${Math.floor(at / 60)}:${String(at % 60).padStart(2, "0")}`,
    },
  ];
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key && !process.env.GROQ_API_KEY) return Response.json({ error: "AI identification is not configured here." }, { status: 503 });
  const now = Date.now();
  while (recent.length && now - recent[0] > 60_000) recent.shift();
  if (recent.length >= PER_MINUTE) return Response.json({ error: "Too many lookups this minute. Try again shortly." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { frames?: string[]; audio?: string | null } | null;
  const frames = Array.isArray(body?.frames) ? body.frames.slice(0, MAX_FRAMES).filter((f) => typeof f === "string" && f.length < MAX_FRAME_BYTES * 1.4) : [];
  const audio = typeof body?.audio === "string" && body.audio.length < MAX_AUDIO_BYTES * 1.4 ? body.audio : null;
  if (!frames.length && !audio) return Response.json({ error: "Send at least one frame or the audio." }, { status: 400 });
  recent.push(now);

  const [gemini, anime] = await Promise.all([
    key ? askGemini(key, frames, audio).catch((e: Error & { status?: number }) => e) : Object.assign(new Error("Gemini is not configured."), { status: 503 }),
    traceMoe(frames).catch(() => [] as CatalogHit[]),
  ]);
  let lines: string[] = [];
  let ai: Omit<AiAnswer, "lines" | "confidence"> | null = null;
  let model = "";
  if (!(gemini instanceof Error)) {
    lines = (gemini.ai.lines ?? []).filter(Boolean);
    ai = { description: gemini.ai.description, title: gemini.ai.title || undefined, kind: gemini.ai.kind, evidence: gemini.ai.evidence ?? [] };
    model = gemini.model;
  } else if (audio) {
    lines = await transcribe(audio).catch(() => []);
    model = "whisper on Groq";
  }
  if (gemini instanceof Error && !lines.length && !anime.length) {
    console.error("identify failed", gemini);
    return Response.json({ error: gemini.message }, { status: gemini.status ?? 502 });
  }
  const catalog = [...anime, ...(await wikiquote(lines).catch(() => []))];
  if (audio && catalog.length) await rememberLead(wavToPcm(audio), catalog).catch((e) => console.error("lead save failed", e));
  return Response.json({ model, lines, ai, catalog });
}
