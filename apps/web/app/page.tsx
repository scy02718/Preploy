import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingPersonas } from "@/components/landing/LandingPersonas";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingSocialProof } from "@/components/landing/LandingSocialProof";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="flex flex-col">
      <LandingHero />
      <LandingHowItWorks />
      <LandingPersonas />
      <LandingFeatures />
      <LandingSocialProof />
      <LandingFAQ />
      <LandingFooter />
    </div>
  );
}
