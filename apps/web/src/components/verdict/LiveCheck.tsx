"use client";

import { Link2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { getStream, verifyOnChain, type MinuteCheck } from "@/lib/client/api";

// Every visit asks Monad again: the fingerprint files are re-hashed here and compared with the stamped roots.
export function LiveCheck({ streamId, seconds }: { streamId: Hex; seconds: number[] }) {
  const [checks, setChecks] = useState<MinuteCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStream(streamId)
      .then((d) => verifyOnChain(streamId, d.minutes, seconds))
      .then(setChecks)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not reach Monad"));
  }, [streamId, seconds]);

  const ok = !!checks?.length && checks.every((c) => c.rootMatches && c.proofOk);
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      {checks === null && !error ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" /> Asking Monad
        </p>
      ) : (
        <p className={`inline-flex items-center gap-2 text-sm font-medium ${ok ? "text-match" : "text-stamp"}`}>
          <Link2 size={16} /> {ok ? "Verified on Monad just now" : (error ?? "Chain check failed")}
        </p>
      )}
      {checks && (
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li key={c.minute} className="flex justify-between font-mono text-xs">
              <span>minute {c.minute}</span>
              <span className={c.rootMatches && c.proofOk ? "text-match" : "text-stamp"}>{c.rootMatches && c.proofOk ? "root and proof valid" : "mismatch"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
