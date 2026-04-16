"use client";

import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingHero() {
  const handleScrollToHowItWorks = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const section = document.getElementById("how-it-works");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="flex flex-col items-center justify-center text-center py-24 px-4 gap-8">
      <div className="flex flex-col items-center gap-4 max-w-2xl">
        <Image
          src="/logo.svg"
          alt="Preploy"
          width={64}
          height={64}
          className="h-16 w-16"
          priority
        />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Practice interviews until the real one feels easy
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Preploy runs voice-to-voice mock interviews — behavioral and technical — and gives you scored feedback on every answer so you walk in prepared, not guessing.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "min-w-48")}
          data-testid="primary-cta"
        >
          Start a free mock interview
        </Link>
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-w-48"
          )}
          data-testid="secondary-cta"
        >
          See pricing
        </Link>
      </div>
    </section>
  );
}
