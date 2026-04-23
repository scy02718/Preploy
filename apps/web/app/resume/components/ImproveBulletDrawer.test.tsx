import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImproveBulletDrawer } from "./ImproveBulletDrawer";

const MOCK_VARIANTS = [
  "Led 15-person team, reducing latency by 40%",
  "Drove migration delivering 40% throughput improvement",
  "Spearheaded architecture overhaul cutting P99 latency by 40%",
];

function makeDefaultProps(overrides?: Partial<Parameters<typeof ImproveBulletDrawer>[0]>) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    bullet: "Participated in team meetings",
    roleTitle: "Software Engineer",
    roleCompany: "Acme Corp",
    resumeId: "resume-123",
    onAccept: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("ImproveBulletDrawer", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ variants: MOCK_VARIANTS }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    // Make fetch hang so skeleton stays visible
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
    render(<ImproveBulletDrawer {...makeDefaultProps()} />);
    // Skeleton blocks should be present (animate-pulse)
    const skeleton = document.querySelectorAll(".animate-pulse");
    expect(skeleton.length).toBeGreaterThan(0);
  });

  it("renders 3 variant choices after fetch resolves", async () => {
    render(<ImproveBulletDrawer {...makeDefaultProps()} />);
    await waitFor(() => {
      expect(screen.getAllByText(MOCK_VARIANTS[0]).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(MOCK_VARIANTS[1]).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(MOCK_VARIANTS[2]).length).toBeGreaterThanOrEqual(1);
  });

  it("Accept button calls onAccept with the correct old and new bullet, then closes", async () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <ImproveBulletDrawer
        {...makeDefaultProps({ onAccept, onOpenChange })}
      />
    );
    await waitFor(() => {
      expect(screen.getAllByText(MOCK_VARIANTS[0]).length).toBeGreaterThanOrEqual(1);
    });

    // Click the first Accept button
    const acceptButtons = screen.getAllByRole("button", { name: /accept/i });
    fireEvent.click(acceptButtons[0]);

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith("Participated in team meetings", MOCK_VARIANTS[0]);
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("surfaces 429 rate-limit inline banner (not alert/dialog)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many requests" }),
    }) as unknown as typeof fetch;

    render(<ImproveBulletDrawer {...makeDefaultProps()} />);

    await waitFor(() => {
      const banner = screen.getByRole("status");
      expect(banner.textContent).toMatch(/hit the AI usage limit/i);
    });
  });

  it("renders the original bullet text in the drawer", async () => {
    render(<ImproveBulletDrawer {...makeDefaultProps()} />);
    // Original bullet should be visible
    await waitFor(() => {
      expect(screen.getAllByText("Participated in team meetings").length).toBeGreaterThanOrEqual(1);
    });
  });
});
