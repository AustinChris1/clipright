import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MinuteFile } from "@clipright/engine";
import type { Hex } from "viem";
import type { StampReceipt, StreamMeta } from "../types";

// Fingerprint files live off-chain; the onchain root is what makes them tamper evident.
const ROOT = join(process.cwd(), "data", "streams");
const ID = /^0x[0-9a-f]{64}$/;

function dir(streamId: Hex) {
  const id = streamId.toLowerCase();
  if (!ID.test(id)) throw new Error("bad stream id");
  return join(ROOT, id);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function saveStream(meta: StreamMeta) {
  await mkdir(dir(meta.streamId), { recursive: true });
  await writeFile(join(dir(meta.streamId), "meta.json"), JSON.stringify(meta));
}

export async function getStream(streamId: Hex) {
  return readJson<StreamMeta>(join(dir(streamId), "meta.json"));
}

export async function listStreams(): Promise<StreamMeta[]> {
  let ids: string[] = [];
  try {
    ids = await readdir(ROOT);
  } catch {
    return [];
  }
  const metas = await Promise.all(ids.filter((id) => ID.test(id)).map((id) => getStream(id as Hex)));
  return metas.filter((m): m is StreamMeta => !!m).sort((a, b) => b.openedAt - a.openedAt);
}

export async function saveMinute(file: MinuteFile, receipt: StampReceipt) {
  const d = dir(file.streamId);
  await mkdir(d, { recursive: true });
  await writeFile(join(d, `minute-${file.minute}.json`), JSON.stringify(file));
  await writeFile(join(d, `stamp-${file.minute}.json`), JSON.stringify(receipt));
}

export async function loadMinutes(streamId: Hex): Promise<MinuteFile[]> {
  const d = dir(streamId);
  let names: string[] = [];
  try {
    names = await readdir(d);
  } catch {
    return [];
  }
  const files = await Promise.all(names.filter((n) => n.startsWith("minute-")).map((n) => readJson<MinuteFile>(join(d, n))));
  return files.filter((f): f is MinuteFile => !!f).sort((a, b) => a.minute - b.minute);
}

export async function loadStamps(streamId: Hex): Promise<StampReceipt[]> {
  const d = dir(streamId);
  let names: string[] = [];
  try {
    names = await readdir(d);
  } catch {
    return [];
  }
  const stamps = await Promise.all(names.filter((n) => n.startsWith("stamp-")).map((n) => readJson<StampReceipt>(join(d, n))));
  return stamps.filter((s): s is StampReceipt => !!s).sort((a, b) => a.minute - b.minute);
}
