import type { TranscriptEntry } from "@interview-assistant/shared";

interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * Groups word-level timestamps into sentence-like segments.
 * A new segment is created when the gap between consecutive words exceeds the pause threshold.
 *
 * @param words - Array of word timestamps from OpenAI verbose_json transcription
 * @param pauseThresholdSec - Gap in seconds that triggers a new segment (default: 1.0)
 * @returns Array of TranscriptEntry with speaker="user" and millisecond timestamps
 */
export function groupWordsIntoSegments(
  words: WordTimestamp[],
  pauseThresholdSec = 0.5
): TranscriptEntry[] {
  if (words.length === 0) return [];

  const segments: TranscriptEntry[] = [];
  let currentWords: string[] = [words[0].word];
  let segmentStartSec = words[0].start;

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;

    if (gap > pauseThresholdSec) {
      // Flush current segment
      segments.push({
        speaker: "user",
        text: currentWords.join(" "),
        timestamp_ms: Math.round(segmentStartSec * 1000),
      });

      // Start new segment
      currentWords = [words[i].word];
      segmentStartSec = words[i].start;
    } else {
      currentWords.push(words[i].word);
    }
  }

  // Flush final segment
  segments.push({
    speaker: "user",
    text: currentWords.join(" "),
    timestamp_ms: Math.round(segmentStartSec * 1000),
  });

  return segments;
}
