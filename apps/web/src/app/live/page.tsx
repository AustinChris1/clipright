import { AppWindow, Radio, Stamp } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import type { Metadata } from "next";
import { Studio } from "@/components/live/Studio";

export const metadata: Metadata = { title: "Stamp a stream | Clipright" };

export default function LivePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHead
        eyebrow="Stamp a stream"
        title="Keep streaming where you stream. Clipright stamps beside it."
        steps={[
          { icon: Radio, label: "Live on Twitch, YouTube or X" },
          { icon: AppWindow, label: "Share its tab with sound" },
          { icon: Stamp, label: "A stamp a minute, gas paid" },
        ]}
      />
      <div className="mt-10">
        <Studio />
      </div>
    </section>
  );
}
