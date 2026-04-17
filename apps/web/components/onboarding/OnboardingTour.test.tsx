import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

// --- Hoist the mock fn so it's available before vi.mock factory runs ---
const { mockJoyrideFn, capturedCallbacks } = vi.hoisted(() => {
  const capturedCallbacks: Array<(data: { status: string }) => void> = [];
  const mockJoyrideFn = vi.fn(
    ({
      run,
      onEvent,
    }: {
      run: boolean;
      onEvent?: (data: { status: string }) => void;
    }) => {
      if (onEvent) capturedCallbacks.push(onEvent);
      return run
        ? React.createElement("div", { "data-testid": "joyride-running" }, "tour-running")
        : null;
    }
  );
  return { mockJoyrideFn, capturedCallbacks };
});

// Mock react-joyride with named export { Joyride }
vi.mock("react-joyride", () => ({
  Joyride: mockJoyrideFn,
  STATUS: { FINISHED: "finished", SKIPPED: "skipped" },
}));

// Mock next/dynamic to render synchronously in tests.
// Our component calls: import("react-joyride").then(mod => ({ default: mod.Joyride }))
// The dynamic wrapper needs to resolve immediately for tests.
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    // Start resolving immediately
    fn().then((mod) => {
      ResolvedComponent = mod.default;
    });
    // Return a component that will try to render after resolution
    const DynamicComponent = (props: Record<string, unknown>) => {
      if (!ResolvedComponent) return null;
      return React.createElement(ResolvedComponent, props);
    };
    DynamicComponent.displayName = "DynamicComponent";
    return DynamicComponent;
  },
}));

import { OnboardingTour } from "./OnboardingTour";

describe("OnboardingTour", () => {
  beforeEach(() => {
    mockJoyrideFn.mockClear();
    capturedCallbacks.length = 0;
  });

  // 118-E: component renders tour when run=true
  it("118-E: renders tour indicator when run is true", async () => {
    await act(async () => {
      render(
        <OnboardingTour run={true} onFinish={vi.fn()} onSkip={vi.fn()} />
      );
    });
    // Allow the dynamic import promise to resolve
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // After async resolution, re-render triggers
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockJoyrideFn.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(mockJoyrideFn.mock.calls[mockJoyrideFn.mock.calls.length - 1][0]).toMatchObject({ run: true });
  });

  // 118-E: renders nothing / passes run=false when not running
  it("118-E: passes run=false to Joyride when run is false", async () => {
    await act(async () => {
      render(
        <OnboardingTour run={false} onFinish={vi.fn()} onSkip={vi.fn()} />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockJoyrideFn.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(mockJoyrideFn.mock.calls[mockJoyrideFn.mock.calls.length - 1][0]).toMatchObject({ run: false });
  });

  // 118-F: Skip status calls onSkip
  it("118-F: callback with status=skipped calls onSkip", async () => {
    const onSkip = vi.fn();
    const onFinish = vi.fn();

    await act(async () => {
      render(
        <OnboardingTour run={true} onFinish={onFinish} onSkip={onSkip} />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Trigger the skip callback (use the last captured one)
    const cb = capturedCallbacks[capturedCallbacks.length - 1];
    act(() => {
      cb?.({ status: "skipped" });
    });

    expect(onSkip).toHaveBeenCalledOnce();
    expect(onFinish).not.toHaveBeenCalled();
  });

  // 118-H: Finish status calls onFinish
  it("118-H: callback with status=finished calls onFinish", async () => {
    const onSkip = vi.fn();
    const onFinish = vi.fn();

    await act(async () => {
      render(
        <OnboardingTour run={true} onFinish={onFinish} onSkip={onSkip} />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const cb = capturedCallbacks[capturedCallbacks.length - 1];
    act(() => {
      cb?.({ status: "finished" });
    });

    expect(onFinish).toHaveBeenCalledOnce();
    expect(onSkip).not.toHaveBeenCalled();
  });

  // 118-G: Other status values do not call callbacks
  it("118-G: callback with status=running does not call onSkip or onFinish", async () => {
    const onSkip = vi.fn();
    const onFinish = vi.fn();

    await act(async () => {
      render(
        <OnboardingTour run={true} onFinish={onFinish} onSkip={onSkip} />
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const cb = capturedCallbacks[capturedCallbacks.length - 1];
    act(() => {
      cb?.({ status: "running" });
    });

    expect(onSkip).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
