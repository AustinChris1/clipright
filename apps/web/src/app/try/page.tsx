import { Mic, ScanSearch, Scissors, Stamp } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import type { Metadata } from "next";
import { TryIt } from "@/components/try/TryIt";

export const metadata: Metadata = { title: "Try it | Clipright" };

export default function TryPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHead
        eyebrow="Try it in a minute"
        title="Can someone change what you said?"
        steps={[
          { icon: Mic, label: "Say one line" },
          { icon: Stamp, label: "Stamped on Monad" },
          { icon: Scissors, label: "A copy is cut" },
          { icon: ScanSearch, label: "Both checked" },
        ]}
      />
      <div className="mt-10">
        <TryIt />
      </div>
    </section>
  );
}
