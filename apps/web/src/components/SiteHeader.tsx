"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "./Mark";

const links = [
  { href: "/check", label: "Check a clip" },
  { href: "/live", label: "Go live" },
  { href: "/streams", label: "Streams" },
  { href: "/docs", label: "Docs" },
];

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("clipright.theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      onClick={flip}
      aria-label="Toggle theme"
      className="grid size-9 place-items-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Clipright home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`hidden rounded-full px-3 py-1.5 text-sm transition sm:inline-block ${
                path?.startsWith(l.href) ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/check" className="rounded-full bg-ink px-3 py-1.5 text-sm text-paper sm:hidden">
            Check
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export const themeScript = `try{var t=localStorage.getItem("clipright.theme");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.theme="light"}`;
