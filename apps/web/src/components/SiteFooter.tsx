import { addressUrl, chain, REGISTRY } from "@/lib/config";
import { Mark } from "./Mark";

export function SiteFooter() {
  const url = REGISTRY ? addressUrl(REGISTRY) : null;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="inline-flex items-center gap-2">
          <Mark size={18} /> Built for Monad Metropolis, Track 04
        </span>
        <span className="font-mono text-xs">
          {chain.name} registry{" "}
          {REGISTRY ? (
            url ? (
              <a className="underline decoration-line underline-offset-4 hover:text-ink" href={url} target="_blank" rel="noreferrer">
                {REGISTRY.slice(0, 8)}...{REGISTRY.slice(-6)}
              </a>
            ) : (
              `${REGISTRY.slice(0, 8)}...${REGISTRY.slice(-6)}`
            )
          ) : (
            "not deployed"
          )}
        </span>
      </div>
    </footer>
  );
}
