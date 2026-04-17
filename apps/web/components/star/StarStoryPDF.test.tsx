import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// @react-pdf/renderer does not work in jsdom — mock all exports we use.
vi.mock("@react-pdf/renderer", () => ({
  Document: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-page">{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

import {
  StarStoryPDF,
  StarStoriesBundlePDF,
  type StarStoryForPDF,
  type StarAnalysisForPDF,
} from "./StarStoryPDF";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STORY: StarStoryForPDF = {
  id: "s1",
  title: "Led microservices migration",
  role: "Senior Software Engineer",
  expectedQuestions: ["Tell me about a technical challenge you overcame."],
  situation: "Our monolith was slow.",
  task: "Design the migration plan.",
  action: "Broke it into 8 services.",
  result: "Deploys went from 2h to 10min.",
  createdAt: new Date().toISOString(),
};

const ANALYSIS: StarAnalysisForPDF = {
  id: "a1",
  storyId: "s1",
  scores: {
    persuasiveness_score: 78,
    persuasiveness_justification: "Clear narrative arc.",
    star_alignment_score: 85,
    star_breakdown: { situation: 80, task: 75, action: 90, result: 88 },
    role_fit_score: 82,
    role_fit_justification: "Matches SSE expectations.",
    question_fit_score: 79,
    question_fit_justification: "Directly addresses the question.",
  },
  suggestions: ["Add quantified impact.", "Mention team size."],
  model: "gpt-4o",
  createdAt: new Date().toISOString(),
};

const STORY_2: StarStoryForPDF = {
  id: "s2",
  title: "Handled cross-team conflict",
  role: "Tech Lead",
  expectedQuestions: [],
  situation: "Two teams disagreed.",
  task: "Mediate the decision.",
  action: "Ran a structured review.",
  result: "Reached consensus.",
  createdAt: new Date().toISOString(),
};

const STORY_3: StarStoryForPDF = {
  id: "s3",
  title: "Shipped zero-downtime deploy",
  role: "Platform Engineer",
  expectedQuestions: ["Describe a deployment challenge."],
  situation: "Legacy deploy caused outages.",
  task: "Re-architect the pipeline.",
  action: "Implemented blue-green deploys.",
  result: "Zero downtime for 6 months.",
  createdAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StarStoryPDF", () => {
  it("renders without throwing — story only (no analyses)", () => {
    expect(() => render(<StarStoryPDF story={STORY} analyses={[]} date="April 17, 2026" />)).not.toThrow();
  });

  it("renders without throwing — story with one analysis", () => {
    expect(() =>
      render(<StarStoryPDF story={STORY} analyses={[ANALYSIS]} date="April 17, 2026" />)
    ).not.toThrow();
  });

  it("includes story title and STAR section labels in output", () => {
    const { getAllByText } = render(
      <StarStoryPDF story={STORY} analyses={[]} date="April 17, 2026" />
    );
    // Title appears at least once
    expect(getAllByText("Led microservices migration").length).toBeGreaterThanOrEqual(1);
    // STAR labels
    expect(getAllByText("SITUATION").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("ACTION").length).toBeGreaterThanOrEqual(1);
  });

  it("shows analysis scores when analyses are provided", () => {
    const { getAllByText } = render(
      <StarStoryPDF story={STORY} analyses={[ANALYSIS]} date="April 17, 2026" />
    );
    expect(getAllByText("Persuasiveness").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("STAR Alignment").length).toBeGreaterThanOrEqual(1);
  });

  it("omits Expected Questions section when array is empty", () => {
    const storyNoQ: StarStoryForPDF = { ...STORY, expectedQuestions: [] };
    const { queryByText } = render(
      <StarStoryPDF story={storyNoQ} analyses={[]} date="April 17, 2026" />
    );
    expect(queryByText("Expected Questions")).toBeNull();
  });
});

describe("StarStoriesBundlePDF", () => {
  it("renders bundle of 3 stories without throwing", () => {
    const bundle = [
      { story: STORY, analyses: [ANALYSIS] },
      { story: STORY_2, analyses: [] },
      { story: STORY_3, analyses: [] },
    ];
    expect(() =>
      render(<StarStoriesBundlePDF stories={bundle} date="April 17, 2026" />)
    ).not.toThrow();
  });

  it("renders one pdf-page element per story in the bundle", () => {
    const bundle = [
      { story: STORY, analyses: [] },
      { story: STORY_2, analyses: [] },
      { story: STORY_3, analyses: [] },
    ];
    const { getAllByTestId } = render(
      <StarStoriesBundlePDF stories={bundle} date="April 17, 2026" />
    );
    expect(getAllByTestId("pdf-page").length).toBe(3);
  });
});
