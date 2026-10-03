import type { LucideIcon } from "lucide-react";
import { Fragment } from "react";

// Eyebrow, headline, then the flow as icons instead of a paragraph.
export function PageHead({ eyebrow, title, steps }: { eyebrow: string; title: string; steps: { icon: LucideIcon; label: string }[] }) {
  return (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && <li aria-hidden className="hidden h-px w-6 bg-line sm:block" />}
            <li className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3">
              <span className="grid size-7 place-items-center rounded-full bg-ink text-paper">
                <s.icon size={14} />
              </span>
              {s.label}
            </li>
          </Fragment>
        ))}
      </ol>
    </>
  );
}
