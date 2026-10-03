import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getVerdict } from "@/lib/server/store";
import { timecode as tc, verdictCopy } from "@/lib/verdictCopy";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A clip checked on Clipright";

const C = { paper: "#f4f1ea", card: "#fbf9f4", ink: "#15130f", muted: "#6b655b", line: "#ddd6c8", stamp: "#d9452b", match: "#1f8a5b", warn: "#b97c0c" };


const font = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));

function Mark({ size: s }: { size: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M10 5H5v22h5" stroke={C.ink} strokeWidth="3.2" />
      <path d="M22 5h5v22h-5" stroke={C.ink} strokeWidth="3.2" />
      <path d="M16 9v14" stroke={C.stamp} strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const v = await getVerdict((await params).id);
  const [display, sans, sansBold, mono] = await Promise.all([font("bricolage-600.ttf"), font("geist-400.ttf"), font("geist-600.ttf"), font("jetbrains-400.ttf")]);
  const fonts = [
    { name: "Display", data: display, weight: 600 as const },
    { name: "Sans", data: sans, weight: 400 as const },
    { name: "Sans", data: sansBold, weight: 600 as const },
    { name: "Mono", data: mono, weight: 400 as const },
  ];
  if (!v)
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.paper, alignItems: "center", justifyContent: "center", fontFamily: "Display", fontSize: 64 }}>
        clipright
      </div>,
      { ...size, fonts },
    );

  const c = verdictCopy(v);
  const tone = c.tone === "match" ? C.match : C.warn;
  const title = c.headline.length > 70 ? c.headline.slice(0, 68) + "..." : c.headline;
  const cells = v.seconds.slice(0, 30);
  const cut = v.edits[0];

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: C.paper, padding: 56, gap: 48, fontFamily: "Sans", color: C.ink }}>
      {v.thumb && (
        <div style={{ display: "flex", width: 300, height: 518, borderRadius: 28, background: C.ink, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/jpeg;base64,${v.thumb}`} alt="" style={{ width: 300, height: 518, objectFit: "contain" }} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: tone, fontSize: 30, fontWeight: 600 }}>
          <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: tone }} />
          {c.label}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontFamily: "Display", fontSize: v.thumb ? 60 : 72, lineHeight: 1.02, letterSpacing: -1.5 }}>{title}</div>
        <div style={{ display: "flex", marginTop: 22, fontFamily: "Mono", fontSize: 28 }}>
          {tc(v.offsetSec)} to {tc(v.endSec)}
          <span style={{ color: C.muted, marginLeft: 14, fontFamily: "Sans", fontSize: 24, alignSelf: "center" }}>into the stream</span>
        </div>
        {cut && (
          <div style={{ display: "flex", marginTop: 16, fontSize: 26, color: C.warn, fontWeight: 600 }}>
            {cut.kind === "cut" ? `${cut.seconds.toFixed(1)} s cut out at ${Math.floor(cut.atClipSec / 60)}:${String(Math.floor(cut.atClipSec % 60)).padStart(2, "0")}` : "Part of the clip is not from the stream"}
          </div>
        )}
        <div style={{ display: "flex", gap: 5, marginTop: 30 }}>
          {cells.map((s, i) => {
            const jump = i > 0 && s.s !== cells[i - 1].s + 1;
            const bg = s.audio && s.picture ? C.match : s.audio ? "#7fb89c" : s.picture ? "#d6b16a" : C.stamp;
            return <div key={i} style={{ display: "flex", flex: 1, height: 44, borderRadius: 7, background: bg, marginLeft: jump ? 14 : 0 }} />;
          })}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Display", fontSize: 34 }}>
            <Mark size={38} /> clipright
          </div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 20, color: C.muted }}>checked against Monad</div>
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
