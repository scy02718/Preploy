import { CoachingHubNav } from "@/components/coaching/CoachingHubNav";

export default function CoachingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Interview Coaching</h1>
      <p className="mb-6 text-muted-foreground">
        Learn proven techniques and frameworks to ace your interviews. Pick a
        topic and practice.
      </p>
      <CoachingHubNav />
      {/* Content spans the same `max-w-6xl` width as the title + nav so the
          page doesn't look like the body shrinks mid-page. Prior narrower
          reading column was visually jarring against the full-width tabs
          above it. */}
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[var(--duration-base)]">
        {children}
      </div>
    </div>
  );
}
