"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "./Mark";

const links = [
  { href: "/try", label: "Try it" },
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
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [path]);
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
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            aria-controls="mobile-menu"
            className="grid size-9 place-items-center rounded-full border border-line text-ink sm:hidden"
          >
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
      </div>
      {menu && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-paper px-4 pb-4 pt-2 sm:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setMenu(false)}
                  className={`block rounded-xl px-3 py-3 text-base ${path?.startsWith(l.href) ? "bg-ink text-paper" : "text-ink hover:bg-card"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

export const themeScript = `try{var t=localStorage.getItem("clipright.theme");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.theme="light"}`;
