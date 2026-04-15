import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingPersonas } from "@/components/landing/LandingPersonas";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingSocialProof } from "@/components/landing/LandingSocialProof";
import { LandingFooter } from "@/components/landing/LandingFooter";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://preploy.app";

export const metadata: Metadata = {
  title: "Preploy — AI Mock Interview Practice",
  description:
    "Ace your next job interview with Preploy. Practice mock interviews with an AI interviewer and get instant, detailed feedback on your answers.",
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    title: "Preploy — AI Mock Interview Practice",
    description:
      "Ace your next job interview with Preploy. Practice mock interviews with an AI interviewer and get instant, detailed feedback on your answers.",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Preploy — AI Mock Interview Practice",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Preploy — AI Mock Interview Practice",
    description:
      "Ace your next job interview with Preploy. Practice mock interviews with an AI interviewer and get instant, detailed feedback on your answers.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Preploy",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: BASE_URL,
  description:
    "Ace your next job interview with Preploy. Practice mock interviews with an AI interviewer and get instant, detailed feedback on your answers.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col">
        <LandingHero />
        <LandingHowItWorks />
        <LandingPersonas />
        <LandingFeatures />
        <LandingSocialProof />
        <LandingFAQ />
        <LandingFooter />
      </div>
    </>
  );
}
