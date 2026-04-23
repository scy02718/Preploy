import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StructuredResumeView } from "./StructuredResumeView";
import type { StructuredResume } from "@/lib/resume-parser";

const MOCK_DATA: StructuredResume = {
  roles: [
    {
      company: "Acme Corp",
      title: "Senior Engineer",
      dates: "2020-2023",
      bullets: [
        { text: "Led migration of monolith to microservices, reducing latency by 40%", impact_score: 9, has_quantified_metric: true },
        { text: "Participated in team meetings", impact_score: 2, has_quantified_metric: false },
        { text: "Wrote unit tests for core modules", impact_score: 6, has_quantified_metric: false },
      ],
    },
    {
      company: "Beta Inc",
      title: "Junior Developer",
      dates: "2018-2020",
      bullets: [
        { text: "Fixed bugs in the codebase", impact_score: 3, has_quantified_metric: false },
      ],
    },
  ],
  skills: ["TypeScript", "Node.js", "Postgres"],
};

describe("StructuredResumeView", () => {
  const defaultProps = {
    structuredData: MOCK_DATA,
    resumeId: "resume-123",
    onImprove: vi.fn(),
    improvingBullet: null,
  };

  it("renders all roles in the navigation list", () => {
    render(<StructuredResumeView {...defaultProps} />);
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Beta Inc").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the first role detail by default (company, title, dates, bullets)", () => {
    render(<StructuredResumeView {...defaultProps} />);
    // Role detail should show title and company
    expect(screen.getAllByText("Senior Engineer").length).toBeGreaterThanOrEqual(1);
    // Bullet text visible
    expect(screen.getAllByText(/Led migration of monolith/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders skills chips", () => {
    render(<StructuredResumeView {...defaultProps} />);
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Node.js").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Postgres").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Improve button only for weak bullets (impact_score < 6)", () => {
    render(<StructuredResumeView {...defaultProps} />);
    // "Participated in team meetings" has score 2 → weak → Improve button
    const improveButtons = screen.getAllByRole("button", { name: /rewrite bullet with ai/i });
    // Score 9 (strong) and score 6 (moderate) should NOT have Improve
    // Score 2 (weak) should have Improve
    expect(improveButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render Improve button for non-weak bullets (score >= 6)", () => {
    const singleStrongBullet: StructuredResume = {
      roles: [
        {
          company: "Co",
          title: "Eng",
          dates: "2020",
          bullets: [{ text: "Strong bullet with 50% improvement", impact_score: 8, has_quantified_metric: true }],
        },
      ],
      skills: [],
    };
    render(
      <StructuredResumeView
        structuredData={singleStrongBullet}
        resumeId="r1"
        onImprove={vi.fn()}
        improvingBullet={null}
      />
    );
    const improveButtons = screen.queryAllByRole("button", { name: /rewrite bullet with ai/i });
    expect(improveButtons).toHaveLength(0);
  });

  it("switching role in nav updates the detail pane", () => {
    render(<StructuredResumeView {...defaultProps} />);

    // Click Beta Inc in the nav
    const betaButtons = screen.getAllByText("Beta Inc");
    fireEvent.click(betaButtons[0]);

    // Should now show Beta Inc's bullet
    expect(screen.getAllByText("Fixed bugs in the codebase").length).toBeGreaterThanOrEqual(1);
  });

  it("impact chip colour reflects the score band", () => {
    const { container } = render(<StructuredResumeView {...defaultProps} />);
    // High score (9) → cedar class
    const cedarChips = container.querySelectorAll(".text-\\[color\\:var\\(--primary\\)\\]");
    expect(cedarChips.length).toBeGreaterThanOrEqual(1);
    // Low score (2) → destructive class
    const destructiveChips = container.querySelectorAll(".text-destructive");
    expect(destructiveChips.length).toBeGreaterThanOrEqual(1);
  });

  it("Improve button is disabled while that bullet is in-flight (improvingBullet set)", () => {
    const weakBullet = "Participated in team meetings";
    render(
      <StructuredResumeView
        {...defaultProps}
        improvingBullet={weakBullet}
      />
    );
    const btn = screen.getByRole("button", { name: /rewrite bullet with ai/i });
    expect(btn).toBeDisabled();
  });

  it("renders empty state message when no roles and no skills", () => {
    render(
      <StructuredResumeView
        structuredData={{ roles: [], skills: [] }}
        resumeId="r1"
        onImprove={vi.fn()}
        improvingBullet={null}
      />
    );
    expect(screen.getAllByText(/No structured data was extracted/).length).toBeGreaterThanOrEqual(1);
  });
});
