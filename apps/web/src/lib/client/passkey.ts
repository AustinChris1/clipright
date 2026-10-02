import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput, isMeraError } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { sha256, toBytes, type Hex, type LocalAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// A dedicated PRF salt: the same passkey yields this signing key and, separately, any wallet key.
export const STAMP_SALT = toBytes(sha256(toBytes("clipright.stamp.v1")));

export interface StampingKey {
  account: LocalAccount;
  kind: "passkey" | "local";
  end: () => void;
}

function fromSecret(secret: Uint8Array): StampingKey {
  const session = createSecp256k1SigningSession({ privateKey: secret });
  return { account: toViemAccount(session), kind: "passkey", end: () => session.end() };
}

export async function createPasskeyKey(label: string): Promise<StampingKey> {
  const { prfOutput } = await createPasskeyWithPrfOutput({
    rp: { id: location.hostname, name: "Clipright" },
    user: { name: label, displayName: label },
    prfSalt: STAMP_SALT,
  });
  return fromSecret(prfOutput);
}

export async function unlockPasskeyKey(): Promise<StampingKey> {
  const { prfOutput } = await getPasskeyPrfOutput({ rpId: location.hostname, prfSalt: STAMP_SALT });
  return fromSecret(prfOutput);
}

// Fallback for authenticators without PRF; the key lives only in this tab.
export function localKey(): StampingKey {
  let key: Hex | null = null;
  try {
    key = sessionStorage.getItem("clipright.localKey") as Hex | null;
    if (!key) sessionStorage.setItem("clipright.localKey", (key = generatePrivateKey()));
  } catch {
    key = generatePrivateKey();
  }
  return { account: privateKeyToAccount(key), kind: "local", end: () => {} };
}

export function passkeyError(e: unknown): string {
  if (isMeraError(e)) {
    if (e.code === "PRF_UNAVAILABLE")
      return "This passkey manager cannot derive keys (no PRF support). Try iCloud Keychain, Google Password Manager or 1Password, or use a tab-only key.";
    if (e.code === "PASSKEY_OPERATION_FAILED") return "The passkey prompt was cancelled or is unavailable here.";
    return e.message;
  }
  return e instanceof Error ? e.message : "Passkey failed";
}
