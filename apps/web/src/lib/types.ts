import type { Hex } from "viem";

export interface StreamMeta {
  streamId: Hex;
  signer: Hex;
  title: string;
  openedAt: number;
  openTx: Hex;
}

export interface StampReceipt {
  minute: number;
  root: Hex;
  tx: Hex;
  block: number;
  at: number;
}

export interface StreamDetail {
  meta: StreamMeta;
  stamps: StampReceipt[];
}

export interface StreamListing {
  streamId: Hex;
  signer: Hex;
  title: string;
  openTx: Hex;
  openedBlock: number;
  stamps: number;
  fingerprints: boolean;
  owner: Hex | null;
}
