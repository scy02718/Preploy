/**
 * Silence-watchdog unit tests for useRealtimeVoice (story #108).
 *
 * Strategy:
 *  - Mock WebSocket globally with a recording class that captures every
 *    send() call in an array for later inspection.
 *  - Mock fetch (token endpoint) and getUserMedia so connect() succeeds.
 *  - Call connect(), trigger ws.onopen to finish setup, then simulate
 *    WebSocket events through ws.onmessage({data: JSON.stringify(...)}).
 *  - Use vi.useFakeTimers() to advance wall-clock without real delays.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { SILENCE_NUDGE_MS, SILENCE_HANDOFF_MS } from "@/lib/realtime-config";

// ── MockWebSocket ────────────────────────────────────────────────────────────

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  sends: string[] = [];

  send(data: string) {
    this.sends.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000 } as CloseEvent);
  }
}

// Track the latest instance created by the hook so tests can inspect it
let mockWs: MockWebSocket = new MockWebSocket();

// Factory wrapped as a class so `new WebSocket(...)` doesn't throw.
// We override the global with this to intercept each construction.
class SpyWebSocket extends MockWebSocket {
  constructor(
    _url: string | URL,
    _protocols?: string | string[] | undefined
  ) {
    super();
    // Assign the newly constructed instance to the shared variable.
    // We do this by mutating the outer `mockWs` binding via the module scope.
    SpyWebSocket.latest = this; // eslint-disable-line @typescript-eslint/no-use-before-define
  }

  static latest: MockWebSocket = new MockWebSocket();
}
// Copy the static OPEN/CLOSED constants so the hook's WebSocket.OPEN check works
SpyWebSocket.OPEN = MockWebSocket.OPEN;
SpyWebSocket.CLOSED = MockWebSocket.CLOSED;

// Keep the module-level reference in sync with SpyWebSocket.latest
Object.defineProperty(SpyWebSocket, "latest", {
  get() {
    return mockWs;
  },
  set(v: MockWebSocket) {
    mockWs = v;
  },
});

vi.stubGlobal("WebSocket", SpyWebSocket);

// ── Stub Web Audio (jsdom doesn't implement it) ───────────────────────────────

class MockAudioContext {
  sampleRate = 24000;
  currentTime = 0;
  state = "running";
  destination = {};
  createAnalyser() {
    return { fftSize: 1024, smoothingTimeConstant: 0.8, connect: vi.fn() };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(0), duration: 0 };
  }
  createBufferSource() {
    return { buffer: null, connect: vi.fn(), start: vi.fn() };
  }
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  close = vi.fn();
  resume = vi.fn();
}
vi.stubGlobal("AudioContext", MockAudioContext);

class MockAudioWorkletNode {
  port = { onmessage: null as null | ((e: MessageEvent) => void) };
  connect = vi.fn();
}
vi.stubGlobal("AudioWorkletNode", MockAudioWorkletNode);

// ── Import hook (after all global mocks are registered) ──────────────────────

import { useRealtimeVoice } from "./useRealtimeVoice";

// ── Per-test setup / teardown ─────────────────────────────────────────────────

const MOCK_STREAM = {
  getTracks: () => [{ stop: vi.fn() }],
} as unknown as MediaStream;

beforeEach(() => {
  vi.useFakeTimers();

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: "ek_test_key" }), { status: 200 })
    )
  );

  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(MOCK_STREAM),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Boot the hook: call connect() and fire ws.onopen so session.update goes out. */
async function openHook(
  result: { current: ReturnType<typeof useRealtimeVoice> }
) {
  await act(async () => {
    await result.current.connect();
  });
  await act(async () => {
    if (mockWs?.onopen) {
      mockWs.onopen(new Event("open"));
    }
    await Promise.resolve(); // let audioWorklet.addModule promise settle
  });
}

/** Deliver a fake server event to the hook's message handler. */
function deliver(type: string, extra: Record<string, unknown> = {}) {
  act(() => {
    if (mockWs?.onmessage) {
      mockWs.onmessage({
        data: JSON.stringify({ type, ...extra }),
      } as MessageEvent);
    }
  });
}

/**
 * Parsed sends after the initial session.update.
 * The very first send on ws.open is always the session.update preamble.
 */
function extraSends(): Record<string, unknown>[] {
  return mockWs.sends.slice(1).map((s) => JSON.parse(s) as Record<string, unknown>);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useRealtimeVoice silence watchdog (108-A / 108-B / 108-E)", () => {
  /**
   * 108-B / 108-F — No send within the first (SILENCE_NUDGE_MS - 100)ms after speech_stopped.
   */
  it("produces no send before the nudge threshold after speech_stopped (108-B / 108-F)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);
    const countAfterSetup = mockWs.sends.length;

    deliver("input_audio_buffer.speech_stopped");

    act(() => { vi.advanceTimersByTime(SILENCE_NUDGE_MS - 100); });

    // Watchdog must not have fired yet
    expect(mockWs.sends.length).toBe(countAfterSetup);
  });

  /**
   * 108-A — At SILENCE_NUDGE_MS+, nudge pair fires:
   *   [0] conversation.item.create (with nudge text)
   *   [1] response.create
   */
  it("sends nudge pair at the nudge threshold after speech_stopped (108-A / 108-E)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);

    deliver("input_audio_buffer.speech_stopped");
    act(() => { vi.advanceTimersByTime(SILENCE_NUDGE_MS + 100); });

    const sends = extraSends();
    expect(sends.length).toBeGreaterThanOrEqual(2);

    const [itemCreate, responseCreate] = sends;
    expect(itemCreate.type).toBe("conversation.item.create");

    const item = itemCreate.item as { content?: Array<{ text?: string }> };
    const nudgeText = item?.content?.[0]?.text ?? "";
    expect(
      nudgeText.toLowerCase().includes("repeat the question") ||
        nudgeText.toLowerCase().includes("take your time") ||
        nudgeText.toLowerCase().includes("silent")
    ).toBe(true);

    expect(responseCreate.type).toBe("response.create");
  });

  /**
   * 108-A — speech_started before the nudge clears the watchdog; no sends fire.
   */
  it("cancels watchdog when speech_started fires before the nudge threshold (108-A)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);
    const countAfterSetup = mockWs.sends.length;

    deliver("input_audio_buffer.speech_stopped");
    // Advance well below threshold (SILENCE_NUDGE_MS - 1000ms)
    act(() => { vi.advanceTimersByTime(SILENCE_NUDGE_MS - 1000); });

    deliver("input_audio_buffer.speech_started"); // user resumes speaking

    // Advance 5500ms more — total now exceeds SILENCE_NUDGE_MS, proving cancellation
    act(() => { vi.advanceTimersByTime(5_500); });

    expect(mockWs.sends.length).toBe(countAfterSetup);
  });

  /**
   * 108-E — At SILENCE_HANDOFF_MS+, hand-off pair fires after the earlier nudge.
   */
  it("sends hand-off pair at the handoff threshold after speech_stopped (108-E)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);

    deliver("input_audio_buffer.speech_stopped");

    act(() => { vi.advanceTimersByTime(SILENCE_NUDGE_MS + 100); }); // cross the nudge
    const countAfterNudge = mockWs.sends.length;

    act(() => { vi.advanceTimersByTime(SILENCE_HANDOFF_MS - SILENCE_NUDGE_MS + 100); }); // cross hand-off

    const handoffSends = mockWs.sends
      .slice(countAfterNudge)
      .map((s) => JSON.parse(s) as Record<string, unknown>);

    expect(handoffSends.length).toBeGreaterThanOrEqual(2);
    expect(handoffSends[0].type).toBe("conversation.item.create");

    const hItem = handoffSends[0].item as { content?: Array<{ text?: string }> };
    const handoffText = hItem?.content?.[0]?.text ?? "";
    expect(
      handoffText.toLowerCase().includes("silent") ||
        handoffText.toLowerCase().includes("next") ||
        handoffText.toLowerCase().includes("move")
    ).toBe(true);

    expect(handoffSends[1].type).toBe("response.create");
  });

  /**
   * 108-A — disconnect() cancels timers; no sends appear afterwards.
   */
  it("produces no sends after disconnect() clears the watchdog (108-A)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);

    deliver("input_audio_buffer.speech_stopped");
    act(() => { vi.advanceTimersByTime(SILENCE_NUDGE_MS - 1000); }); // below nudge

    const countBeforeDisconnect = mockWs.sends.length;

    act(() => { result.current.disconnect(); });

    // Advance well past both nudge and handoff thresholds
    act(() => { vi.advanceTimersByTime(SILENCE_HANDOFF_MS); });

    // WebSocket is CLOSED after disconnect so sendSilenceNudge returns early;
    // no new sends must appear
    expect(mockWs.sends.length).toBe(countBeforeDisconnect);
  });

  /**
   * Regression — transcript.done arrived while TTS was still playing (or
   * before any audio chunks were queued). The previous implementation gated
   * arming on isSpeakingRef, which is false at that moment because
   * drainQueue hasn't run yet. That armed the 10s timer mid-speech and the
   * AI "nudged" the user while still talking.
   *
   * Fix contract: transcript.done must NOT arm the watchdog on its own. It
   * must only set pendingWatchdogArmRef — arming happens later from
   * drainQueue's speakingTimeout or from response.done.
   */
  it("does NOT arm the watchdog on transcript.done alone (race fix)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);
    const countAfterSetup = mockWs.sends.length;

    // Transcript.done fires. isSpeakingRef is false (no audio deltas yet /
    // drainQueue hasn't run in this test) — under the old code path the
    // watchdog would arm and nudge at SILENCE_NUDGE_MS.
    deliver("response.output_audio_transcript.done");

    act(() => { vi.advanceTimersByTime(SILENCE_NUDGE_MS + 2000); });

    expect(mockWs.sends.length).toBe(countAfterSetup);
  });

  /**
   * Regression — response.done is the safety net. If no audio was ever
   * queued (text-only response, or audio played and fully drained before
   * response.done arrived), transcript.done sets pending but nothing clears
   * it. response.done must arm the watchdog in that state.
   */
  it("arms the watchdog on response.done when nothing is speaking (safety net)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);
    const countAfterSetup = mockWs.sends.length;

    // Full sequence for a text-only / already-finished response.
    deliver("response.output_audio_transcript.done");
    deliver("response.done");

    // Now the watchdog should be armed — nudge fires after SILENCE_NUDGE_MS.
    act(() => { vi.advanceTimersByTime(SILENCE_NUDGE_MS + 100); });

    expect(mockWs.sends.length).toBeGreaterThan(countAfterSetup);
    const sends = extraSends();
    const itemCreate = sends[0];
    expect(itemCreate.type).toBe("conversation.item.create");
  });
});
