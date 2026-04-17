import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { StarStoryForPDF, StarAnalysisForPDF } from "./StarStoryPDF";

// ---------------------------------------------------------------------------
// Mock @react-pdf/renderer so dynamic import inside the handler works
// ---------------------------------------------------------------------------

vi.mock("@react-pdf/renderer", () => ({
  pdf: vi.fn().mockReturnValue({
    toBlob: vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" })),
  }),
  Document: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

// Mock the StarStoryPDF module so the dynamic import inside the handler resolves
vi.mock("./StarStoryPDF", () => ({
  StarStoryPDF: () => <div />,
  StarStoriesBundlePDF: () => <div />,
}));

import { StarPdfExportButton } from "./StarPdfExportButton";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STORY: StarStoryForPDF = {
  id: "s1",
  title: "Led Microservices Migration",
  role: "Senior Software Engineer",
  expectedQuestions: ["Tell me about a technical challenge."],
  situation: "Monolith was slow.",
  task: "Design migration.",
  action: "Split into services.",
  result: "10× faster deploys.",
  createdAt: new Date().toISOString(),
};

const ANALYSES: StarAnalysisForPDF[] = [];

// ---------------------------------------------------------------------------
// URL / anchor helpers
// ---------------------------------------------------------------------------

let mockObjectUrl = "blob:http://localhost/fake-url";
const mockCreateObjectURL = vi.fn(() => mockObjectUrl);
const mockRevokeObjectURL = vi.fn();
const mockAnchorClick = vi.fn();

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  URL.createObjectURL = mockCreateObjectURL;
  URL.revokeObjectURL = mockRevokeObjectURL;

  // Intercept document.createElement so we can inspect/control anchor behaviour
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      const anchor = originalCreateElement("a");
      anchor.click = mockAnchorClick;
      return anchor;
    }
    return originalCreateElement(tag);
  });

  vi.clearAllMocks();
  // Re-set the mock return value after clearAllMocks
  URL.createObjectURL = mockCreateObjectURL;
  URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StarPdfExportButton", () => {
  it("renders the Export PDF label and Download icon", () => {
    render(<StarPdfExportButton story={STORY} analyses={ANALYSES} />);
    expect(screen.getAllByText("Export PDF").length).toBeGreaterThanOrEqual(1);
    // Button is enabled when idle
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
  });

  it("clicking the button calls pdf() and creates an anchor with correct download filename", async () => {
    const { pdf } = await import("@react-pdf/renderer");
    render(<StarPdfExportButton story={STORY} analyses={ANALYSES} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(pdf).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAnchorClick).toHaveBeenCalled();
    });

    // Verify the anchor's download attribute — uses slug of the title
    // document.createElement spy captures the anchor element
    const createElementSpy = vi.mocked(document.createElement);
    const anchorCall = createElementSpy.mock.results.find(
      (r) => r.type === "return" && (r.value as HTMLElement).tagName === "A"
    );
    expect(anchorCall).toBeDefined();
    const anchor = anchorCall!.value as HTMLAnchorElement;
    // "Led Microservices Migration" → "led-microservices-migration"
    expect(anchor.download).toBe("star-led-microservices-migration.pdf");
  });

  it("shows Exporting... spinner and disables button while in-flight", async () => {
    // Use a deferred promise so the export hangs while we inspect the UI
    let resolve!: () => void;
    const deferred = new Promise<void>((res) => { resolve = res; });

    const { pdf } = await import("@react-pdf/renderer");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(pdf).mockReturnValueOnce({
      toBlob: vi.fn().mockReturnValue(deferred.then(() => new Blob(["pdf"]))),
    } as any);

    render(<StarPdfExportButton story={STORY} analyses={ANALYSES} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getAllByText("Exporting...").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    // Resolve the deferred to clean up
    resolve();
    await waitFor(() => {
      expect(screen.getAllByText("Export PDF").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("revokes the object URL after the anchor is clicked", async () => {
    render(<StarPdfExportButton story={STORY} analyses={ANALYSES} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
    });
  });
});
