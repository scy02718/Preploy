import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TechnicalFormatCarousel,
  type FormatSlide,
} from "./TechnicalFormatCarousel";

const SAMPLE_SLIDES: FormatSlide[] = [
  {
    key: "leetcode",
    title: "LeetCode Interviews",
    content: <div data-testid="slide-content-leetcode">LeetCode content here</div>,
  },
  {
    key: "system_design",
    title: "System Design Interviews",
    content: <div data-testid="slide-content-system_design">System Design content here</div>,
  },
  {
    key: "frontend",
    title: "Frontend Interviews",
    content: <div data-testid="slide-content-frontend">Frontend content here</div>,
  },
  {
    key: "backend",
    title: "Backend Interviews",
    content: <div data-testid="slide-content-backend">Backend content here</div>,
  },
];

describe("TechnicalFormatCarousel", () => {
  it("renders the first slide's content initially", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    expect(screen.getByTestId("slide-content-leetcode")).toBeTruthy();
    expect(screen.queryByTestId("slide-content-system_design")).toBeNull();
    expect(screen.queryByTestId("slide-content-frontend")).toBeNull();
    expect(screen.queryByTestId("slide-content-backend")).toBeNull();
  });

  it("clicking the right arrow shows the second slide and hides the first", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    fireEvent.click(screen.getByTestId("carousel-next"));
    expect(screen.queryByTestId("slide-content-leetcode")).toBeNull();
    expect(screen.getByTestId("slide-content-system_design")).toBeTruthy();
  });

  it("clicking the left arrow from slide 0 wraps to the last slide", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    fireEvent.click(screen.getByTestId("carousel-prev"));
    // Should wrap to the last slide (backend)
    expect(screen.queryByTestId("slide-content-leetcode")).toBeNull();
    expect(screen.getByTestId("slide-content-backend")).toBeTruthy();
  });

  it("clicking a specific pill jumps directly to that slide", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    fireEvent.click(screen.getByTestId("carousel-pill-frontend"));
    expect(screen.getByTestId("slide-content-frontend")).toBeTruthy();
    expect(screen.queryByTestId("slide-content-leetcode")).toBeNull();
  });

  it("previous arrow button has correct aria-label", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    const prevBtn = screen.getByTestId("carousel-prev");
    expect(prevBtn).toHaveAttribute("aria-label", "Previous format");
  });

  it("next arrow button has correct aria-label", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    const nextBtn = screen.getByTestId("carousel-next");
    expect(nextBtn).toHaveAttribute("aria-label", "Next format");
  });

  it("navigating forward past the last slide wraps to the first slide", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    // Advance through all 4 slides
    fireEvent.click(screen.getByTestId("carousel-next")); // → system_design
    fireEvent.click(screen.getByTestId("carousel-next")); // → frontend
    fireEvent.click(screen.getByTestId("carousel-next")); // → backend
    fireEvent.click(screen.getByTestId("carousel-next")); // → wraps to leetcode
    expect(screen.getByTestId("slide-content-leetcode")).toBeTruthy();
    expect(screen.queryByTestId("slide-content-backend")).toBeNull();
  });

  it("renders all slide title pills", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    expect(screen.getByTestId("carousel-pill-leetcode")).toBeTruthy();
    expect(screen.getByTestId("carousel-pill-system_design")).toBeTruthy();
    expect(screen.getByTestId("carousel-pill-frontend")).toBeTruthy();
    expect(screen.getByTestId("carousel-pill-backend")).toBeTruthy();
  });

  it("the active slide's pill has aria-current set", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    const activePill = screen.getByTestId("carousel-pill-leetcode");
    expect(activePill).toHaveAttribute("aria-current", "true");
    const inactivePill = screen.getByTestId("carousel-pill-system_design");
    expect(inactivePill).not.toHaveAttribute("aria-current");
  });

  it("slide region has role=region with aria-label matching slide title", () => {
    render(<TechnicalFormatCarousel slides={SAMPLE_SLIDES} />);
    const region = screen.getByRole("region", { name: "LeetCode Interviews" });
    expect(region).toBeTruthy();
  });
});
