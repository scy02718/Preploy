import { describe, it, expect } from "vitest";
import { groupWordsIntoSegments } from "./transcription";

describe("groupWordsIntoSegments", () => {
  it("returns empty array for empty input", () => {
    expect(groupWordsIntoSegments([])).toEqual([]);
  });

  it("returns one segment for a single word", () => {
    const result = groupWordsIntoSegments([
      { word: "hello", start: 0.5, end: 0.9 },
    ]);
    expect(result).toEqual([
      { speaker: "user", text: "hello", timestamp_ms: 500 },
    ]);
  });

  it("groups continuous speech into one segment", () => {
    const result = groupWordsIntoSegments([
      { word: "I", start: 0.0, end: 0.1 },
      { word: "think", start: 0.15, end: 0.4 },
      { word: "we", start: 0.45, end: 0.55 },
      { word: "should", start: 0.6, end: 0.85 },
      { word: "use", start: 0.9, end: 1.1 },
      { word: "a", start: 1.15, end: 1.2 },
      { word: "hash", start: 1.25, end: 1.5 },
      { word: "map", start: 1.55, end: 1.8 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("I think we should use a hash map");
    expect(result[0].timestamp_ms).toBe(0);
    expect(result[0].speaker).toBe("user");
  });

  it("splits on pause > 1 second", () => {
    const result = groupWordsIntoSegments([
      { word: "first", start: 0.0, end: 0.3 },
      { word: "sentence", start: 0.35, end: 0.7 },
      // 1.5s gap
      { word: "second", start: 2.2, end: 2.5 },
      { word: "sentence", start: 2.55, end: 2.9 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      speaker: "user",
      text: "first sentence",
      timestamp_ms: 0,
    });
    expect(result[1]).toEqual({
      speaker: "user",
      text: "second sentence",
      timestamp_ms: 2200,
    });
  });

  it("creates multiple segments for multiple pauses", () => {
    const result = groupWordsIntoSegments([
      { word: "one", start: 0.0, end: 0.3 },
      // 2s gap
      { word: "two", start: 2.3, end: 2.6 },
      // 1.5s gap
      { word: "three", start: 4.1, end: 4.4 },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("one");
    expect(result[1].text).toBe("two");
    expect(result[2].text).toBe("three");
  });

  it("converts timestamps to milliseconds correctly", () => {
    const result = groupWordsIntoSegments([
      { word: "test", start: 1.234, end: 1.5 },
    ]);
    expect(result[0].timestamp_ms).toBe(1234);
  });

  it("does not split on exactly 1 second pause", () => {
    const result = groupWordsIntoSegments([
      { word: "hello", start: 0.0, end: 0.5 },
      // exactly 1.0s gap (not > 1.0)
      { word: "world", start: 1.5, end: 1.8 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("hello world");
  });

  it("respects custom pause threshold", () => {
    const words = [
      { word: "fast", start: 0.0, end: 0.2 },
      // 0.6s gap
      { word: "speech", start: 0.8, end: 1.0 },
    ];
    // Default 1.0s threshold: single segment
    expect(groupWordsIntoSegments(words)).toHaveLength(1);
    // Custom 0.5s threshold: two segments
    expect(groupWordsIntoSegments(words, 0.5)).toHaveLength(2);
  });

  it("all entries have speaker set to user", () => {
    const result = groupWordsIntoSegments([
      { word: "a", start: 0, end: 0.1 },
      { word: "b", start: 5, end: 5.1 },
      { word: "c", start: 10, end: 10.1 },
    ]);
    for (const entry of result) {
      expect(entry.speaker).toBe("user");
    }
  });
});
