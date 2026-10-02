import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { list, put } from "@vercel/blob";
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

const store = () => (process.env.BLOB_READ_WRITE_TOKEN ? blob : files);
const base = (id: Hex) => `streams/${key(id)}/`;

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
  const names = (await store().names(base(streamId))).filter((n) => /stamp-\d+\.json$/.test(n));
  const stamps = await Promise.all(names.map((n) => store().read<StampReceipt>(n)));
  return stamps.filter((s): s is StampReceipt => !!s).sort((a, b) => a.minute - b.minute);
}

// Only minutes that reached the chain are served.
export async function loadMinutes(streamId: Hex): Promise<MinuteFile[]> {
  const stamped = new Set((await loadStamps(streamId)).map((s) => s.minute));
  const names = (await store().names(base(streamId))).filter((n) => {
    const m = n.match(/minute-(\d+)\.json$/);
    return m && stamped.has(Number(m[1]));
  });
  const minutes = await Promise.all(names.map((n) => store().read<MinuteFile>(n)));
  return minutes.filter((f): f is MinuteFile => !!f).sort((a, b) => a.minute - b.minute);
}
