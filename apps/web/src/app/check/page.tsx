import { AudioWaveform, ShieldCheck, Upload } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import type { Metadata } from "next";
import { Checker } from "@/components/check/Checker";

export const metadata: Metadata = { title: "Check a clip | Clipright" };

export default function CheckPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHead
        eyebrow="Check"
        title="Where did this clip come from?"
        steps={[
          { icon: Upload, label: "Drop a clip" },
          { icon: AudioWaveform, label: "Matched on your device" },
          { icon: ShieldCheck, label: "Proven on Monad" },
        ]}
      />
      <div className="mt-10">
        <Checker />
      </div>
    </section>
  );
}
