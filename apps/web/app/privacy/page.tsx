import type { Metadata } from "next";

// Pure static content — no auth, no DB, no per-user data. Force static
// rendering so it serves from Vercel's edge CDN instead of going through
// a fresh Lambda on every request.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Preploy privacy policy — coming before launch.",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-24">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-muted-foreground">
        Our full privacy policy will be published here before public launch.
        In the meantime, questions about what we collect and how we use it can
        be sent to{" "}
        <a
          href="mailto:support@preploy.app"
          className="underline hover:text-foreground"
        >
          support@preploy.app
        </a>
        .
      </p>
    </main>
  );
}
