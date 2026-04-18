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
      {/* Article-style coaching pages read better in a narrower column.
          The outer layout keeps `max-w-6xl` for the nav; the inner
          `max-w-3xl` applies only to the content pane. */}
      <div className="mx-auto max-w-3xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[var(--duration-base)]">
        {children}
      </div>
    </div>
  );
}
