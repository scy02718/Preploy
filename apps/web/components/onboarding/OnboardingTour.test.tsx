import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// --- Mock react-joyride as a stub that exposes callbacks for testing ---
type JoyrideCallback = (data: { status: string }) => void;

let capturedCallback: JoyrideCallback | null = null;

vi.mock("react-joyride", () => ({
  default: vi.fn(
    ({
      run,
      callback,
    }: {
      run: boolean;
      callback: JoyrideCallback;
    }) => {
      capturedCallback = callback;
      return run ? <div data-testid="joyride-running">tour-running</div> : null;
    }
  ),
}));

// Mock next/dynamic to render synchronously in tests
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: unknown }>) => {
    let Component: React.ComponentType<Record<string, unknown>> | null = null;
    fn().then((mod) => {
      Component = mod.default as React.ComponentType<Record<string, unknown>>;
    });
    return function DynamicComponent(props: Record<string, unknown>) {
      if (!Component) return null;
      return <Component {...props} />;
    };
  },
}));

import { OnboardingTour } from "./OnboardingTour";

// We need React for JSX in the mock
import React from "react";

describe("OnboardingTour", () => {
  beforeEach(() => {
    capturedCallback = null;
    vi.clearAllMocks();
  });

  // 118-E: component renders tour when run=true
  it("118-E: renders tour indicator when run is true", async () => {
    await act(async () => {
      render(
        <OnboardingTour run={true} onFinish={vi.fn()} onSkip={vi.fn()} />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    const Joyride = (await import("react-joyride")).default as ReturnType<
      typeof vi.fn
    >;
    const calls = Joyride.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1][0]).toMatchObject({ run: true });
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
    });
    const Joyride = (await import("react-joyride")).default as ReturnType<
      typeof vi.fn
    >;
    const calls = Joyride.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1][0]).toMatchObject({ run: false });
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
    });

    // Trigger the skip callback
    act(() => {
      capturedCallback?.({ status: "skipped" });
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
    });

    act(() => {
      capturedCallback?.({ status: "finished" });
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
    });

    act(() => {
      capturedCallback?.({ status: "running" });
    });

    expect(onSkip).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
