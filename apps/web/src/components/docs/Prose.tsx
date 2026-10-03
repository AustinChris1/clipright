import type { ReactNode } from "react";

export function DocHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: ReactNode }) {
  return (
    <header className="border-b border-line pb-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{lead}</p>
    </header>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 pt-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        <a href={`#${id}`} className="hover:text-stamp">
          {title}
        </a>
      </h2>
      <div className="mt-4 space-y-4 leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-card px-1.5 py-0.5 font-mono text-[0.85em] ring-1 ring-line">{children}</code>;
}

export function Block({ label, children }: { label?: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {label && <div className="border-b border-line px-4 py-2 font-mono text-xs text-muted">{label}</div>}
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

const tones = {
  note: "border-line bg-card",
  good: "border-match/40 bg-match/5",
  warn: "border-warn/40 bg-warn/5",
  limit: "border-stamp/40 bg-stamp/5",
};

export function Callout({ tone = "note", title, children }: { tone?: keyof typeof tones; title: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-sm text-muted">{children}</div>
    </div>
  );
}

export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs text-paper">{i + 1}</span>
          <div className="pt-1">
            <p className="font-medium">{s.title}</p>
            <div className="mt-1 text-muted">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[520px] text-left text-sm">
        {head.some(Boolean) && (
          <thead className="bg-card text-xs text-muted">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-4 py-3 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NextPage({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-16 border-t border-line pt-6">
      <a href={href} className="group inline-flex flex-col">
        <span className="text-xs text-muted">Next</span>
        <span className="font-display text-xl font-semibold group-hover:text-stamp">{label} →</span>
      </a>
    </div>
  );
}
