/**
 * Silence-watchdog unit tests for useRealtimeVoice (story #108).
 *
 * Strategy:
 *  - Mock WebSocket globally with a recording MockWebSocket that captures
 *    every send() call in an array for later inspection.
 *  - Mock fetch (token endpoint) and getUserMedia so connect() succeeds.
 *  - Call connect(), trigger ws.onopen to finish setup, then simulate
 *    WebSocket events through ws.onmessage({data: JSON.stringify(...)}).
 *  - Use vi.useFakeTimers() to advance wall-clock without real delays.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── MockWebSocket (must be defined before vi.stubGlobal) ──────────────────────

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

// Track the latest instance so tests can reach into it
let mockWs: MockWebSocket;

// Subclass that records itself — used as the global WebSocket constructor
class TrackingWebSocket extends MockWebSocket {
  constructor(_url: string, _protocols?: string | string[]) {
    super();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    mockWs = this;
  }
}
// Copy static OPEN / CLOSED so the hook's `ws.readyState !== WebSocket.OPEN` check works
TrackingWebSocket.OPEN = MockWebSocket.OPEN;
TrackingWebSocket.CLOSED = MockWebSocket.CLOSED;

// ── Global mocks ─────────────────────────────────────────────────────────────

// WebSocket constructor
vi.stubGlobal("WebSocket", TrackingWebSocket);

// Stub AudioContext and related Web Audio APIs (jsdom doesn't implement them)
const mockAnalyser = {
  fftSize: 1024,
  smoothingTimeConstant: 0.8,
  connect: vi.fn(),
};
const mockAudioCtx = {
  sampleRate: 24000,
  currentTime: 0,
  state: "running",
  createAnalyser: vi.fn(() => mockAnalyser),
  createBuffer: vi.fn(() => ({
    getChannelData: () => new Float32Array(0),
    duration: 0,
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
  })),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  audioWorklet: {
    addModule: vi.fn().mockResolvedValue(undefined),
  },
  close: vi.fn(),
  resume: vi.fn(),
  destination: {},
};

class MockAudioContext {
  sampleRate = mockAudioCtx.sampleRate;
  currentTime = mockAudioCtx.currentTime;
  state = mockAudioCtx.state;
  createAnalyser = mockAudioCtx.createAnalyser;
  createBuffer = mockAudioCtx.createBuffer;
  createBufferSource = mockAudioCtx.createBufferSource;
  createMediaStreamSource = mockAudioCtx.createMediaStreamSource;
  audioWorklet = mockAudioCtx.audioWorklet;
  close = mockAudioCtx.close;
  resume = mockAudioCtx.resume;
  destination = mockAudioCtx.destination;
}
vi.stubGlobal("AudioContext", MockAudioContext);

class MockAudioWorkletNode {
  port = { onmessage: null as null | ((e: MessageEvent) => void) };
  connect = vi.fn();
}
vi.stubGlobal("AudioWorkletNode", MockAudioWorkletNode);

// ── Import hook (after mocks are in place) ───────────────────────────────────

import { useRealtimeVoice } from "./useRealtimeVoice";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_STREAM = {
  getTracks: () => [{ stop: vi.fn() }],
} as unknown as MediaStream;

/** Boot the hook: call connect() and fire onopen to complete setup. */
async function openHook(
  result: { current: ReturnType<typeof useRealtimeVoice> }
) {
  // connect() is async (fetch + getUserMedia), so await inside act
  await act(async () => {
    await result.current.connect();
  });

  // Fire ws.onopen synchronously so the session.update send goes out
  await act(async () => {
    if (mockWs?.onopen) {
      mockWs.onopen(new Event("open"));
    }
    // Let the audioWorklet.addModule promise settle
    await Promise.resolve();
  });
}

/** Deliver a fake WebSocket server event to the hook's onmessage handler. */
function deliver(type: string, extra: Record<string, unknown> = {}) {
  act(() => {
    if (mockWs?.onmessage) {
      mockWs.onmessage({
        data: JSON.stringify({ type, ...extra }),
      } as MessageEvent);
    }
  });
}

/** Parsed sends recorded AFTER the initial session.update preamble. */
function extraSends(): ReturnType<typeof JSON.parse>[] {
  // The very first send is always the session.update — skip it
  return mockWs.sends.slice(1).map((s) => JSON.parse(s));
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useRealtimeVoice silence watchdog (108-A / 108-B / 108-E)", () => {
  /**
   * Test 1 — 108-B / 108-F:
   * No send before the 10s nudge threshold.
   * After speech_stopped, advancing 9.9s must produce zero new sends.
   */
  it("produces no send before 10s after speech_stopped (108-B / 108-F)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);
    const countAfterSetup = mockWs.sends.length;

    deliver("input_audio_buffer.speech_stopped");

    act(() => {
      vi.advanceTimersByTime(9_900);
    });

    expect(mockWs.sends.length).toBe(countAfterSetup);
  });

  /**
   * Test 2 — 108-A:
   * At exactly 10s+, the nudge pair fires:
   *   conversation.item.create (with nudge text) + response.create.
   */
  it("sends nudge pair at 10s mark after speech_stopped (108-A / 108-E)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);

    deliver("input_audio_buffer.speech_stopped");

    act(() => {
      vi.advanceTimersByTime(10_100); // just past 10s nudge
    });

    const sends = extraSends();
    expect(sends.length).toBeGreaterThanOrEqual(2);

    const [itemCreate, responseCreate] = sends;
    expect(itemCreate.type).toBe("conversation.item.create");

    const nudgeText: string = itemCreate.item?.content?.[0]?.text ?? "";
    // The nudge must mention one of these concepts (loose match lets the
    // prompt wording evolve without breaking the test)
    expect(
      nudgeText.toLowerCase().includes("repeat the question") ||
        nudgeText.toLowerCase().includes("take your time") ||
        nudgeText.toLowerCase().includes("silent")
    ).toBe(true);

    expect(responseCreate.type).toBe("response.create");
  });

  /**
   * Test 3 — 108-A:
   * speech_started before the nudge fires clears the watchdog.
   * No sends must appear even after 10s would have elapsed.
   */
  it("cancels watchdog when speech_started fires before the nudge threshold (108-A)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);
    const countAfterSetup = mockWs.sends.length;

    deliver("input_audio_buffer.speech_stopped");
    act(() => {
      vi.advanceTimersByTime(5_000); // 5s in — before the nudge
    });

    // User resumes speaking → watchdog cleared
    deliver("input_audio_buffer.speech_started");

    act(() => {
      vi.advanceTimersByTime(5_500); // 10.5s total — would have crossed 10s threshold
    });

    expect(mockWs.sends.length).toBe(countAfterSetup);
  });

  /**
   * Test 4 — 108-E:
   * After the 10s nudge, advancing to 60s fires the hand-off pair:
   *   conversation.item.create (hand-off text) + response.create.
   */
  it("sends hand-off pair at 60s mark after speech_stopped (108-E)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);

    deliver("input_audio_buffer.speech_stopped");

    // Cross the 10s nudge mark first
    act(() => {
      vi.advanceTimersByTime(10_100);
    });
    const countAfterNudge = mockWs.sends.length;

    // Advance past the 60s hand-off
    act(() => {
      vi.advanceTimersByTime(50_000); // 10_100 + 50_000 = 60_100ms total
    });

    const handoffSends = mockWs.sends
      .slice(countAfterNudge)
      .map((s) => JSON.parse(s));

    expect(handoffSends.length).toBeGreaterThanOrEqual(2);
    expect(handoffSends[0].type).toBe("conversation.item.create");

    const handoffText: string =
      handoffSends[0].item?.content?.[0]?.text ?? "";
    expect(
      handoffText.toLowerCase().includes("silent") ||
        handoffText.toLowerCase().includes("next") ||
        handoffText.toLowerCase().includes("move")
    ).toBe(true);

    expect(handoffSends[1].type).toBe("response.create");
  });

  /**
   * Test 5 — 108-A:
   * disconnect() cancels the watchdog — no sends after disconnect even
   * if timers would have elapsed.
   */
  it("produces no sends after disconnect() clears the watchdog (108-A)", async () => {
    const { result } = renderHook(() =>
      useRealtimeVoice({ systemPrompt: "Test" })
    );
    await openHook(result);

    deliver("input_audio_buffer.speech_stopped");

    act(() => {
      vi.advanceTimersByTime(5_000); // 5s — before the nudge
    });

    const countBeforeDisconnect = mockWs.sends.length;

    act(() => {
      result.current.disconnect();
    });

    // Advance well past both the 10s nudge and the 60s hand-off
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // WebSocket is CLOSED after disconnect so sendSilenceNudge returns early;
    // no new sends must have been recorded
    expect(mockWs.sends.length).toBe(countBeforeDisconnect);
  });
});
