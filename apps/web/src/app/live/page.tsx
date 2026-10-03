import { KeyRound, Stamp, Video } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import type { Metadata } from "next";
import { Studio } from "@/components/live/Studio";

export const metadata: Metadata = { title: "Go live | Clipright" };

export default function LivePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHead
        eyebrow="Go live"
        title="Stamp every minute as you stream."
        steps={[
          { icon: KeyRound, label: "Passkey" },
          { icon: Video, label: "Stream" },
          { icon: Stamp, label: "A stamp a minute, gas paid" },
        ]}
      />
      <div className="mt-10">
        <Studio />
      </div>
    </section>
  );
}
