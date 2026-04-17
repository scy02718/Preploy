"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FormatSlide {
  key: string;
  title: string;
  content: React.ReactNode;
}

interface TechnicalFormatCarouselProps {
  slides: FormatSlide[];
}

export function TechnicalFormatCarousel({
  slides,
}: TechnicalFormatCarouselProps) {
  const [idx, setIdx] = useState(0);

  const goLeft = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const goRight = () => setIdx((i) => (i + 1) % slides.length);

  const current = slides[idx];

  return (
    <div
      className="space-y-4"
      data-testid="technical-format-carousel"
    >
      {/* Navigation header */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={goLeft}
          aria-label="Previous format"
          data-testid="carousel-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Slide title pills */}
        <div className="flex flex-1 flex-wrap gap-2" role="list" aria-label="Technical interview formats">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              role="listitem"
              onClick={() => setIdx(i)}
              data-testid={`carousel-pill-${slide.key}`}
              aria-current={i === idx ? "true" : undefined}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                i === idx
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30 bg-muted hover:border-primary hover:bg-primary/10",
              ].join(" ")}
            >
              {slide.title}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={goRight}
          aria-label="Next format"
          data-testid="carousel-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Slide content */}
      <div
        key={idx}
        role="region"
        aria-label={current.title}
        data-testid={`carousel-slide-${current.key}`}
        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150 space-y-6"
      >
        {current.content}
      </div>
    </div>
  );
}
