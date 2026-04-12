import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScoreTrendChart, ScoreTrendPoint } from "./ScoreTrendChart";

// Mock recharts to avoid canvas issues in jsdom
vi.mock("recharts", () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockLineChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  );
  const MockLine = (props: { dataKey?: string; name?: string }) => (
    <div data-testid={`line-${props.dataKey}`}>{props.name}</div>
  );
  return {
    ResponsiveContainer: MockResponsiveContainer,
    LineChart: MockLineChart,
    Line: MockLine,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

const SAMPLE_DATA: ScoreTrendPoint[] = [
  { date: "2026-04-01", score: 6.5, type: "behavioral" },
  { date: "2026-04-02", score: 7.0, type: "technical" },
  { date: "2026-04-03", score: 8.0, type: "behavioral" },
];

describe("ScoreTrendChart", () => {
  it("renders chart with data", () => {
    render(<ScoreTrendChart data={SAMPLE_DATA} />);
    expect(screen.getAllByText("Score Trend").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("line-chart")).toBeDefined();
  });

  it("renders both behavioral and technical lines", () => {
    render(<ScoreTrendChart data={SAMPLE_DATA} />);
    expect(screen.getAllByTestId("line-behavioral").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("line-technical").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no data", () => {
    render(<ScoreTrendChart data={[]} />);
    expect(
      screen.getAllByText(/No score data yet/).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("does not render technical line when only behavioral data", () => {
    cleanup();
    const behavioralOnly: ScoreTrendPoint[] = [
      { date: "2026-04-01", score: 6.5, type: "behavioral" },
    ];
    const { container } = render(<ScoreTrendChart data={behavioralOnly} />);
    // Within this specific render, check the container directly
    const behavioralLines = container.querySelectorAll('[data-testid="line-behavioral"]');
    const technicalLines = container.querySelectorAll('[data-testid="line-technical"]');
    expect(behavioralLines.length).toBeGreaterThanOrEqual(1);
    expect(technicalLines.length).toBe(0);
  });
});
