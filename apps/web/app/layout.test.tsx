import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/font/google before importing layout
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-sans", className: "geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "geist-mono" }),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signOut: vi.fn(),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock @vercel/analytics/next with a stub that emits a testid
vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-testid="analytics-mounted" />,
}));

// Mock @vercel/speed-insights/next with a stub that emits a testid
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <div data-testid="speed-insights-mounted" />,
}));

// Mock Header to avoid complex nav rendering
vi.mock("@/components/shared/Header", () => ({
  Header: () => <nav data-testid="header-stub" />,
}));

// Mock AchievementToastProvider
vi.mock("@/components/shared/AchievementToastProvider", () => ({
  AchievementToastProvider: () => null,
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("mounts Vercel Analytics and Speed Insights in the root layout", () => {
    render(
      <RootLayout>
        <div data-testid="child-content">Hello</div>
      </RootLayout>
    );
    expect(screen.getByTestId("analytics-mounted")).toBeInTheDocument();
    expect(screen.getByTestId("speed-insights-mounted")).toBeInTheDocument();
  });
});
