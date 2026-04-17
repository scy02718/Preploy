import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("discloses Vercel Web Analytics in the third-party processors section", () => {
    render(<PrivacyPage />);
    const matches = screen.getAllByText(/Vercel Web Analytics/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
