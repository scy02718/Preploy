import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanCardMenu } from "./PlanCardMenu";

// Mock next/navigation (not used in this component, but included for safety)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/planner",
}));

const PLAN_ID = "00000000-0000-0000-0000-000000000001";

describe("PlanCardMenu", () => {
  const onArchive = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the kebab menu trigger button", () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={false}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    expect(screen.getByRole("button", { name: /plan options/i })).toBeDefined();
  });

  it("shows Archive and Delete options when not archived", async () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={false}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /plan options/i }));
    await waitFor(() => {
      const archiveItems = screen.getAllByText(/archive/i);
      expect(archiveItems.length).toBeGreaterThan(0);
    });
    const deleteItems = screen.getAllByText(/delete/i);
    expect(deleteItems.length).toBeGreaterThan(0);
  });

  it("shows Unarchive option when plan is archived", async () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={true}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /plan options/i }));
    await waitFor(() => {
      const items = screen.getAllByText(/unarchive/i);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  it("calls onArchive with archived=true when Archive is clicked", async () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={false}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /plan options/i }));
    await waitFor(() => {
      const archiveItems = screen.getAllByText(/^archive$/i);
      expect(archiveItems.length).toBeGreaterThan(0);
    });
    const archiveItem = screen.getAllByText(/^archive$/i)[0];
    fireEvent.click(archiveItem);
    await waitFor(() => {
      expect(onArchive).toHaveBeenCalledWith(PLAN_ID, true);
    });
  });

  it("calls onArchive with archived=false (unarchive) when Unarchive is clicked", async () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={true}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /plan options/i }));
    await waitFor(() => {
      const items = screen.getAllByText(/unarchive/i);
      expect(items.length).toBeGreaterThan(0);
    });
    const unarchiveItem = screen.getAllByText(/unarchive/i)[0];
    fireEvent.click(unarchiveItem);
    await waitFor(() => {
      expect(onArchive).toHaveBeenCalledWith(PLAN_ID, false);
    });
  });

  it("opens confirmation dialog when Delete is clicked", async () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={false}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /plan options/i }));
    await waitFor(() => {
      const deleteItems = screen.getAllByText(/delete/i);
      expect(deleteItems.length).toBeGreaterThan(0);
    });
    const deleteItem = screen.getAllByText(/^delete$/i)[0];
    fireEvent.click(deleteItem);
    await waitFor(() => {
      const dialogTitles = screen.getAllByText(/delete this plan/i);
      expect(dialogTitles.length).toBeGreaterThan(0);
    });
  });

  it("does NOT call onDelete until dialog is confirmed", async () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={false}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /plan options/i }));
    await waitFor(() => {
      const deleteItems = screen.getAllByText(/^delete$/i);
      expect(deleteItems.length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/^delete$/i)[0]);
    // Dialog opened but not confirmed
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete after confirming in the dialog", async () => {
    render(
      <PlanCardMenu
        planId={PLAN_ID}
        isArchived={false}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /plan options/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/^delete$/i).length).toBeGreaterThan(0);
    });
    // Click Delete in dropdown to open dialog
    fireEvent.click(screen.getAllByText(/^delete$/i)[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/delete this plan/i).length).toBeGreaterThan(0);
    });
    // Click the confirm Delete button in dialog
    const confirmButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(PLAN_ID);
    });
  });
});
