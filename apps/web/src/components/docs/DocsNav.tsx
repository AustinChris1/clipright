"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const docPages = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/how-to-use", label: "How to use" },
  { href: "/docs/use-cases", label: "Use cases" },
  { href: "/docs/how-it-works", label: "How it works" },
  { href: "/docs/test-it", label: "Test it yourself" },
  { href: "/docs/reference", label: "Contract and API" },
  { href: "/docs/built-with", label: "Built with" },
  { href: "/docs/faq", label: "Limits and FAQ" },
];

function PageLinks({ path, onPick }: { path: string | null; onPick?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {docPages.map((p) => {
        const active = path === p.href;
        return (
          <li key={p.href}>
            <Link
              href={p.href}
              onClick={onPick}
              aria-current={active ? "page" : undefined}
              className={`block rounded-xl px-3 py-2.5 text-sm transition lg:py-1.5 ${active ? "bg-ink text-paper" : "text-muted hover:bg-card hover:text-ink"}`}
            >
              {p.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DocsNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = docPages.find((p) => p.href === path)?.label ?? "Docs";

  useEffect(() => setOpen(false), [path]);

  return (
    <nav aria-label="Docs">
      <div className="hidden lg:sticky lg:top-24 lg:block">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">Docs</p>
        <PageLinks path={path} />
      </div>

      {/* Phones and tablets: a bar that stays under the header, so any doc is one tap away mid-page. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="docs-menu"
          className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Docs</span>
            <span className="block truncate font-medium">{current}</span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div id="docs-menu" className="mt-2 rounded-2xl border border-line bg-card p-2 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.4)]">
            <PageLinks path={path} onPick={() => setOpen(false)} />
          </div>
        )}
      </div>
    </nav>
  );
}
