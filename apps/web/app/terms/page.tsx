import type { Metadata } from "next";

// Pure static content — no auth, no DB, no per-user data. Force static
// rendering so it serves from Vercel's edge CDN instead of going through
// a fresh Lambda on every request.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms",
  description: "Preploy terms of service — coming before launch.",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-24">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-muted-foreground">
        Our full terms of service will be published here before public launch.
        Questions in the meantime can be sent to{" "}
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
