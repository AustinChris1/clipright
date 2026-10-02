"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const docPages = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/how-to-use", label: "How to use" },
  { href: "/docs/use-cases", label: "Use cases" },
  { href: "/docs/how-it-works", label: "How it works" },
  { href: "/docs/test-it", label: "Test it yourself" },
  { href: "/docs/reference", label: "Contract and API" },
  { href: "/docs/faq", label: "Limits and FAQ" },
];

export function DocsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Docs" className="lg:sticky lg:top-24">
      <p className="mb-3 hidden font-mono text-xs uppercase tracking-[0.2em] text-muted lg:block">Docs</p>
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {docPages.map((p) => {
          const active = path === p.href;
          return (
            <li key={p.href} className="shrink-0">
              <Link
                href={p.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-3 py-1.5 text-sm transition lg:rounded-xl ${
                  active ? "bg-ink text-paper" : "text-muted hover:bg-card hover:text-ink"
                }`}
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
