// Brackets closing on one bar: a clip locking onto the exact second it came from.
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path d="M10 5H5v22h5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" />
      <path d="M22 5h5v22h-5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" />
      <path d="M11.5 13v6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.45" />
      <path d="M16 9v14" stroke="var(--stamp)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M20.5 12v8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <Mark size={26} />
      <span className="font-display text-[1.35rem] font-semibold tracking-[-0.03em]">clipright</span>
    </span>
  );
}
