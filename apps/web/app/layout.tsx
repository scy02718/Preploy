import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shared/Header";
import { Providers } from "@/components/shared/Providers";
import { AchievementToastProvider } from "@/components/shared/AchievementToastProvider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Display — Fraunces, used for h1 / hero / score numerals. Variable with optical
// sizing so it looks right at every display size and reads as editorial rather
// than "another SaaS serif."
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

// Body / UI — Instrument Sans. Neo-grotesque workhorse with real character,
// replaces the previous Geist Sans default. Variable for full weight range.
const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Mono — Geist Mono retained for code editor, transcript, timer, and tabular
// numerals. The existing `--font-geist-mono` variable name is preserved so no
// downstream components need to change.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://preploy.tech";

export const metadata: Metadata = {
  title: {
    default: "Preploy — AI Mock Interview Practice",
    template: "%s | Preploy",
  },
  description:
    "Practice mock interviews with AI and get detailed feedback to improve your performance.",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <AchievementToastProvider />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
