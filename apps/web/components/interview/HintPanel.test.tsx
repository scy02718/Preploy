import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HintPanel } from "./HintPanel";

describe("HintPanel", () => {
  it("renders nothing when hints is empty and isHintLoading is false", () => {
    const { container } = render(
      <HintPanel hints={[]} isHintLoading={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders both hint texts when two hints are provided", () => {
    render(
      <HintPanel
        hints={["first hint", "second hint"]}
        isHintLoading={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("first hint")).toBeDefined();
    expect(screen.getByText("second hint")).toBeDefined();
  });

  it("labels hints with 'Hint 1', 'Hint 2' numbering", () => {
    render(
      <HintPanel
        hints={["first hint", "second hint"]}
        isHintLoading={false}
        onClose={vi.fn()}
      />
    );
    const labels = screen.getAllByText(/Hint \d+/);
    expect(labels.length).toBeGreaterThanOrEqual(2);
    const labelTexts = labels.map((el) => el.textContent);
    expect(labelTexts).toContain("Hint 1");
    expect(labelTexts).toContain("Hint 2");
  });

  it("renders the loading skeleton when isHintLoading is true", () => {
    const { container } = render(
      <HintPanel hints={[]} isHintLoading={true} onClose={vi.fn()} />
    );
    // The skeleton wrapper carries animate-pulse
    const skeletonBlock = container.querySelector(".animate-pulse");
    expect(skeletonBlock).not.toBeNull();
  });

  it("renders three skeleton line divs inside the animate-pulse block", () => {
    const { container } = render(
      <HintPanel hints={[]} isHintLoading={true} onClose={vi.fn()} />
    );
    const skeletonBlock = container.querySelector(".animate-pulse");
    // Inner space-y container holds the three line divs
    const spaceContainer = skeletonBlock?.querySelector(".space-y-1\\.5");
    const lines = spaceContainer?.querySelectorAll("div") ?? [];
    expect(lines.length).toBe(3);
  });

  it("calls onClose exactly once when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <HintPanel hints={["a hint"]} isHintLoading={false} onClose={onClose} />
    );
    const closeButton = screen.getByRole("button", { name: "Close hint panel" });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the panel when only isHintLoading is true (no existing hints)", () => {
    render(
      <HintPanel hints={[]} isHintLoading={true} onClose={vi.fn()} />
    );
    // The complementary landmark is present
    expect(screen.getByRole("complementary", { name: "Coaching hints" })).toBeDefined();
  });

  it("renders both existing hints and loading skeleton simultaneously", () => {
    const { container } = render(
      <HintPanel hints={["existing hint"]} isHintLoading={true} onClose={vi.fn()} />
    );
    expect(screen.getByText("existing hint")).toBeDefined();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
});
