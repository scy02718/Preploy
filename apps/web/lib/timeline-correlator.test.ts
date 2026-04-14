import { describe, it, expect } from "vitest";
import { buildTimeline } from "./timeline-correlator";
import type {
  CodeSnapshotInput,
  TranscriptEntryInput,
} from "./validations";
import { timelineEventSchema } from "./validations";

describe("buildTimeline", () => {
  // 1. test_empty_inputs_return_empty_list
  it("returns an empty array when both inputs are empty", () => {
    const result = buildTimeline([], []);
    expect(result).toEqual([]);
  });

  // 2. test_transcript_only_creates_speech_events
  it("creates speech events for transcript-only input", () => {
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: "I would use a hash map here.", timestamp_ms: 1000 },
      { speaker: "user", text: "The time complexity is O(n).", timestamp_ms: 3000 },
    ];
    const result = buildTimeline(transcript, []);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.event_type === "speech")).toBe(true);
  });

  // 3. test_snapshots_only_creates_code_change_events
  it("creates code_change events for snapshot-only input", () => {
    const snapshots: CodeSnapshotInput[] = [
      {
        code: "def foo(): pass",
        language: "python",
        timestamp_ms: 500,
        event_type: "edit",
      },
    ];
    const result = buildTimeline([], snapshots);
    expect(result).toHaveLength(1);
    expect(result[0].event_type).toBe("code_change");
  });

  // 4. test_code_change_events_include_code
  it("includes the original code on code_change events", () => {
    const snapshots: CodeSnapshotInput[] = [
      {
        code: "def foo(): pass",
        language: "python",
        timestamp_ms: 500,
        event_type: "edit",
      },
    ];
    const result = buildTimeline([], snapshots);
    expect(result[0].code).toBe("def foo(): pass");
  });

  // 5. test_speech_events_have_no_code
  it("leaves code null on speech events", () => {
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: "Hello", timestamp_ms: 0 },
    ];
    const result = buildTimeline(transcript, []);
    expect(result[0].code).toBeNull();
  });

  // 6. test_events_are_sorted_by_timestamp
  it("sorts merged events by timestamp_ms ascending", () => {
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: "Let me think about this.", timestamp_ms: 5000 },
    ];
    const snapshots: CodeSnapshotInput[] = [
      { code: "x = 1", language: "python", timestamp_ms: 2000, event_type: "edit" },
      { code: "x = 2", language: "python", timestamp_ms: 8000, event_type: "edit" },
    ];
    const result = buildTimeline(transcript, snapshots);
    const timestamps = result.map((e) => e.timestamp_ms);
    const sorted = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sorted);
  });

  // 7. test_speech_summary_truncated_with_ellipsis — STORY-TRACE TARGET
  it("truncates long speech summaries to <=100 chars ending in ellipsis", () => {
    // Python: `"word " * 40` → 200 chars, then `.strip()` → 199 chars.
    const longText = "word ".repeat(40).trimEnd();
    expect(longText.length).toBe(199);
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: longText, timestamp_ms: 0 },
    ];
    const result = buildTimeline(transcript, []);
    expect(result[0].summary.length).toBeLessThanOrEqual(100);
    expect(result[0].summary.endsWith("...")).toBe(true);
  });

  // 8. test_long_speech_stores_full_text
  it("preserves full_text for long speech entries", () => {
    const longText = "word ".repeat(40).trimEnd();
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: longText, timestamp_ms: 0 },
    ];
    const result = buildTimeline(transcript, []);
    expect(result[0].full_text).toBe(longText);
  });

  // 9. test_speech_summary_short_text_not_truncated
  it("leaves short speech summaries untouched and full_text null", () => {
    const shortText = "Hello world";
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: shortText, timestamp_ms: 0 },
    ];
    const result = buildTimeline(transcript, []);
    expect(result[0].summary).toBe(shortText);
    expect(result[0].full_text).toBeNull();
  });

  // 10. test_code_change_summary_includes_language
  it("includes the language name in code_change summaries", () => {
    const snapshots: CodeSnapshotInput[] = [
      {
        code: "function foo() {}",
        language: "javascript",
        timestamp_ms: 1000,
        event_type: "edit",
      },
    ];
    const result = buildTimeline([], snapshots);
    expect(result[0].summary).toContain("javascript");
  });

  // 11. test_reset_event_summary
  it("uses 'Reset code' as the summary for reset events", () => {
    const snapshots: CodeSnapshotInput[] = [
      {
        code: "def solution(): pass",
        language: "python",
        timestamp_ms: 1000,
        event_type: "reset",
      },
    ];
    const result = buildTimeline([], snapshots);
    expect(result[0].summary).toBe("Reset code");
  });

  // 12. test_submit_event_summary
  it("uses 'Submitted final code (language)' for submit events", () => {
    const snapshots: CodeSnapshotInput[] = [
      {
        code: "def solution(): pass",
        language: "python",
        timestamp_ms: 1000,
        event_type: "submit",
      },
    ];
    const result = buildTimeline([], snapshots);
    expect(result[0].summary).toContain("Submitted");
    expect(result[0].summary).toContain("python");
  });

  // 13. test_merged_timeline_has_correct_count — BYTE-EQUIVALENT FIXTURE
  it("produces one event per input across merged transcript and snapshots", () => {
    // Fixture intentionally mirrors the Python test's field names and values
    // exactly so the merged-timeline path proves byte-equivalent shape.
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: "text1", timestamp_ms: 1000 },
      { speaker: "user", text: "text2", timestamp_ms: 3000 },
    ];
    const snapshots: CodeSnapshotInput[] = [
      { code: "x", language: "python", timestamp_ms: 2000, event_type: "edit" },
    ];
    const result = buildTimeline(transcript, snapshots);
    expect(result).toHaveLength(3);

    // Every event parses cleanly through the TimelineEvent schema (Pydantic parity).
    for (const event of result) {
      expect(timelineEventSchema.safeParse(event).success).toBe(true);
    }

    // Merge+sort order: 1000 (speech "text1"), 2000 (code_change), 3000 (speech "text2").
    expect(result.map((e) => e.timestamp_ms)).toEqual([1000, 2000, 3000]);
    expect(result.map((e) => e.event_type)).toEqual([
      "speech",
      "code_change",
      "speech",
    ]);
    expect(result[0].summary).toBe("text1");
    expect(result[1].summary).toBe("Changed code (python)");
    expect(result[1].code).toBe("x");
    expect(result[2].summary).toBe("text2");
  });

  // 14. test_correct_event_types_in_merged_result
  it("produces speech before code_change when timestamps put speech first", () => {
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text: "hi", timestamp_ms: 0 },
    ];
    const snapshots: CodeSnapshotInput[] = [
      { code: "x", language: "python", timestamp_ms: 1000, event_type: "edit" },
    ];
    const result = buildTimeline(transcript, snapshots);
    expect(result[0].event_type).toBe("speech");
    expect(result[1].event_type).toBe("code_change");
  });

  // 15. (bonus — locks the Python rsplit-no-space branch)
  it("takes the full 97-char prefix when there is no space in the first 97 characters", () => {
    const text = "a".repeat(200);
    const transcript: TranscriptEntryInput[] = [
      { speaker: "user", text, timestamp_ms: 0 },
    ];
    const result = buildTimeline(transcript, []);
    expect(result[0].summary).toBe("a".repeat(97) + "...");
    expect(result[0].summary.length).toBe(100);
    expect(result[0].full_text).toBe(text);
  });
});
