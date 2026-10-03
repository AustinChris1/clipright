import type { VerdictFile } from "./server/store";

export function timecode(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

// One wording for the link page, its preview image and its title.
export function verdictCopy(v: Pick<VerdictFile, "status" | "edits" | "streamTitle">) {
  if (v.status === "picture-only") return { tone: "warn", kind: "sound", label: "Sound replaced", headline: `Pictures from ${v.streamTitle}` } as const;
  if (v.edits.length) return { tone: "warn", kind: "edited", label: "Edited", headline: `Edited from ${v.streamTitle}` } as const;
  return { tone: "match", kind: "faithful", label: "Faithful cut", headline: `A faithful cut of ${v.streamTitle}` } as const;
}
