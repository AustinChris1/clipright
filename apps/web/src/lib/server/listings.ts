import type { StreamListing } from "../types";
import { registryEvents } from "./chainEvents";
import { listStreams } from "./store";

// The chain is the source of truth for which streams exist; local files only add fingerprints.
export async function streamListings(): Promise<{ streams: StreamListing[]; source: string }> {
  const [events, local] = await Promise.all([registryEvents(), listStreams()]);
  const haveFiles = new Set(local.map((s) => s.streamId.toLowerCase()));
  const streams = events.opened
    .map((o) => ({
      streamId: o.streamId,
      signer: o.signer,
      title: o.title,
      openTx: o.tx,
      openedBlock: o.block,
      stamps: events.stamped.filter((s) => s.streamId === o.streamId).length,
      fingerprints: haveFiles.has(o.streamId.toLowerCase()),
      owner: events.ownerOf.get(o.signer.toLowerCase()) ?? null,
    }))
    .sort((a, b) => b.openedBlock - a.openedBlock);
  return { streams, source: events.source };
}
