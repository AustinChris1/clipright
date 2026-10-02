import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Proofs } from "@/components/landing/Proofs";
import { WhyMonad } from "@/components/landing/WhyMonad";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Proofs />
      <WhyMonad />
    </>
  );
}
