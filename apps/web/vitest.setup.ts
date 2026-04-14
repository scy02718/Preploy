import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount all React trees after each test. Without this, React 19's concurrent
// scheduler can continue processing queued work after jsdom's `window` has been
// torn down at the end of a test file, producing "window is not defined"
// uncaught exceptions unrelated to any individual assertion.
afterEach(() => {
  cleanup();
});
