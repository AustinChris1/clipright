import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { list, put } from "@vercel/blob";
import postgres from "postgres";
import type { MinuteFile } from "@clipright/engine";
import type { Hex } from "viem";
import type { StampReceipt, StreamMeta } from "../types";

// Fingerprint files live off-chain; the onchain root is what makes them tamper evident.
const ID = /^0x[0-9a-f]{64}$/;

function key(streamId: Hex) {
  const id = streamId.toLowerCase();
  if (!ID.test(id)) throw new Error("bad stream id");
  return id;
}

interface Backend {
  write(path: string, body: string): Promise<void>;
  read<T>(path: string): Promise<T | null>;
  names(prefix: string): Promise<string[]>;
  folders(prefix: string): Promise<string[]>;
  entries?(prefix: string): Promise<[string, unknown][]>;
}

const files: Backend = (() => {
  const root = join(process.cwd(), "data");
  return {
    async write(path, body) {
      await mkdir(join(root, path, ".."), { recursive: true });
      await writeFile(join(root, path), body);
    },
    async read(path) {
      try {
        return JSON.parse(await readFile(join(root, path), "utf8"));
      } catch {
        return null;
      }
    },
    async names(prefix) {
      try {
        return (await readdir(join(root, prefix))).map((n) => prefix + n);
      } catch {
        return [];
      }
    },
    async folders(prefix) {
      try {
        return await readdir(join(root, prefix));
      } catch {
        return [];
      }
    },
  };
})();

// Public blobs: fingerprints are meant to be checked by anyone.
const blob: Backend = (() => {
  const urls = new Map<string, string>();
  return {
    async write(path, body) {
      const r = await put(path, body, { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
      urls.set(path, r.url);
    },
    async read(path) {
      let url = urls.get(path);
      if (!url) {
        const { blobs } = await list({ prefix: path, limit: 1 });
        url = blobs.find((b) => b.pathname === path)?.url;
        if (!url) return null;
        urls.set(path, url);
      }
      const res = await fetch(url, { cache: "no-store" });
      return res.ok ? res.json() : null;
    },
    async names(prefix) {
      const out: string[] = [];
      let cursor: string | undefined;
      do {
        const r = await list({ prefix, cursor, limit: 1000 });
        for (const b of r.blobs) {
          urls.set(b.pathname, b.url);
          out.push(b.pathname);
        }
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return out;
    },
    async folders(prefix) {
      const r = await list({ prefix, mode: "folded", limit: 1000 });
      return r.folders.map((f) => f.slice(prefix.length).replace(/\/$/, ""));
    },
  };
})();

// Postgres (Neon or Supabase): one row per file, no per-operation quota.
const DB_URL = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pg: Backend = (() => {
  let sql: ReturnType<typeof postgres> | null = null;
  let ready: Promise<unknown> | null = null;
  const db = async () => {
    sql ??= postgres(DB_URL!, { ssl: DB_URL!.includes("localhost") ? false : "require", max: 3, prepare: false, idle_timeout: 20 });
    ready ??= sql`create table if not exists clipright_files (path text primary key, body text not null, updated_at timestamptz not null default now())`;
    await ready;
    return sql;
  };
  return {
    async write(path, body) {
      const q = await db();
      await q`insert into clipright_files (path, body) values (${path}, ${body}) on conflict (path) do update set body = excluded.body, updated_at = now()`;
    },
    async read(path) {
      const q = await db();
      const rows = await q`select body from clipright_files where path = ${path}`;
      return rows.length ? JSON.parse(rows[0].body) : null;
    },
    async names(prefix) {
      const q = await db();
      return (await q`select path from clipright_files where starts_with(path, ${prefix})`).map((r) => r.path as string);
    },
    async folders(prefix) {
      const q = await db();
      const rows = await q`select distinct split_part(substr(path, ${prefix.length + 1}), '/', 1) as f from clipright_files where starts_with(path, ${prefix}) and strpos(substr(path, ${prefix.length + 1}), '/') > 0`;
      return rows.map((r) => r.f as string);
    },
    async entries(prefix) {
      const q = await db();
      return (await q`select path, body from clipright_files where starts_with(path, ${prefix})`).map((r) => [r.path as string, JSON.parse(r.body)]);
    },
  };
})();

const store = () => (DB_URL ? pg : process.env.BLOB_READ_WRITE_TOKEN ? blob : files);
const base = (id: Hex) => `streams/${key(id)}/`;

// Every file under a prefix in one query where the backend allows it.
async function entries(prefix: string): Promise<[string, unknown][]> {
  const s = store();
  if (s.entries) return s.entries(prefix);
  const names = await s.names(prefix);
  return Promise.all(names.map(async (n) => [n, await s.read(n)] as [string, unknown]));
}

export async function saveStream(meta: StreamMeta) {
  await store().write(`${base(meta.streamId)}meta.json`, JSON.stringify(meta));
}

export async function getStream(streamId: Hex) {
  return store().read<StreamMeta>(`${base(streamId)}meta.json`);
}

export async function listStreams(): Promise<StreamMeta[]> {
  const ids = (await store().folders("streams/")).filter((id) => ID.test(id));
  const metas = await Promise.all(ids.map((id) => getStream(id as Hex)));
  return metas.filter((m): m is StreamMeta => !!m);
}

// Written before the stamp is relayed, so a paid stamp never lacks its fingerprints.
export async function saveMinute(file: MinuteFile) {
  await store().write(`${base(file.streamId)}minute-${file.minute}.json`, JSON.stringify(file));
}

export async function saveReceipt(streamId: Hex, receipt: StampReceipt) {
  await store().write(`${base(streamId)}stamp-${receipt.minute}.json`, JSON.stringify(receipt));
}

export async function loadStamps(streamId: Hex): Promise<StampReceipt[]> {
  return (await loadStream(streamId)).stamps;
}

// Only minutes that reached the chain are served.
export async function loadMinutes(streamId: Hex): Promise<MinuteFile[]> {
  return (await loadStream(streamId)).minutes;
}

export async function loadStream(streamId: Hex): Promise<{ stamps: StampReceipt[]; minutes: MinuteFile[] }> {
  const all = (await entries(base(streamId))).filter(([, v]) => !!v);
  const stamps = all.filter(([n]) => /stamp-\d+\.json$/.test(n)).map(([, v]) => v as StampReceipt).sort((a, b) => a.minute - b.minute);
  const stamped = new Set(stamps.map((s) => s.minute));
  const minutes = all
    .filter(([n]) => /minute-\d+\.json$/.test(n))
    .map(([, v]) => v as MinuteFile)
    .filter((m) => stamped.has(m.minute))
    .sort((a, b) => a.minute - b.minute);
  return { stamps, minutes };
}

// Leads for unstamped clips: the clip's sound landmarks and the catalog hits found for it, never the AI guess.
export interface CatalogHit {
  source: "Wikiquote" | "trace.moe";
  title: string;
  url: string;
  matched: string;
  detail?: string;
}

export interface LeadFile {
  id: string;
  createdAt: number;
  landmarks: [hash: number, frame: number][];
  catalog: CatalogHit[];
}

export async function saveLead(lead: LeadFile) {
  await store().write(`leads/${lead.id}.json`, JSON.stringify(lead));
}

export async function loadLeads(): Promise<LeadFile[]> {
  return (await entries("leads/")).filter(([n, v]) => /leads\/[0-9a-f]{16}\.json$/.test(n) && !!v).map(([, v]) => v as LeadFile);
}

// A shareable result: what the server itself found for a clip's fingerprint, plus that fingerprint for re-checks.
export interface VerdictFile {
  id: string;
  createdAt: number;
  streamId: Hex;
  streamTitle: string;
  owner: Hex | null;
  status: "match" | "picture-only";
  offsetSec: number;
  endSec: number;
  duration: number;
  hasVideo: boolean;
  audioHits: number;
  seconds: { s: number; audio: boolean; picture: boolean; audioHits: number; pictureBits: number | null }[];
  edits: { kind: "cut" | "inserted" | "reordered"; atClipSec: number; seconds: number }[];
  thumb: string | null;
  landmarks: [hash: number, frame: number][];
}

export async function saveVerdict(v: VerdictFile) {
  await store().write(`verdicts/${v.id}.json`, JSON.stringify(v));
}

export async function getVerdict(id: string): Promise<VerdictFile | null> {
  if (!/^[A-Za-z0-9_-]{8,16}$/.test(id)) return null;
  return store().read<VerdictFile>(`verdicts/${id}.json`);
}
