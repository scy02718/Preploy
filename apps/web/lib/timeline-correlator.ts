/**
 * Timeline correlator: merges transcript entries and code snapshots into a single
 * sorted timeline of events. Pure function — no AI calls, no I/O, no async.
 *
 * Ported from apps/api/app/services/timeline_correlator.py. The semantics
 * (word-boundary truncation, summary strings, sort order) are intentionally
 * byte-equivalent with the Python implementation so the cutover in Story 23
 * produces identical feedback inputs.
 */

import type {
  CodeSnapshotInput,
  TimelineEvent,
  TranscriptEntryInput,
} from "./validations";

/**
 * Mirror of Python's `text[:97].rsplit(" ", 1)[0] + "..."` word-boundary
 * truncation. If no space exists in the first 97 characters, Python's
 * `rsplit(" ", 1)` returns a single-element list containing the whole prefix,
 * which we replicate via the `lastSpace >= 0` branch below.
 */
function summarizeSpeech(text: string): {
  summary: string;
  fullText: string | null;
} {
  if (text.length <= 100) {
    return { summary: text, fullText: null };
  }
  const prefix = text.slice(0, 97);
  const lastSpace = prefix.lastIndexOf(" ");
  const truncated = lastSpace >= 0 ? prefix.slice(0, lastSpace) : prefix;
  return { summary: truncated + "...", fullText: text };
}

/**
 * Merge transcript entries and code snapshots into a chronological timeline.
 *
 * Callers are responsible for validating inputs with `transcriptEntryInputSchema`
 * and `codeSnapshotInputSchema` before invoking this function — the Python
 * version relied on FastAPI/Pydantic at the boundary, and we mirror that here.
 */
export function buildTimeline(
  transcript: TranscriptEntryInput[],
  codeSnapshots: CodeSnapshotInput[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const entry of transcript) {
    const { summary, fullText } = summarizeSpeech(entry.text);
    events.push({
      timestamp_ms: entry.timestamp_ms,
      event_type: "speech",
      summary,
      code: null,
      full_text: fullText,
    });
  }

  for (const snapshot of codeSnapshots) {
    let summary: string;
    if (snapshot.event_type === "reset") {
      summary = "Reset code";
    } else if (snapshot.event_type === "submit") {
      summary = `Submitted final code (${snapshot.language})`;
    } else {
      summary = `Changed code (${snapshot.language})`;
    }
    events.push({
      timestamp_ms: snapshot.timestamp_ms,
      event_type: "code_change",
      summary,
      code: snapshot.code,
      full_text: null,
    });
  }

  // V8's Array.prototype.sort is stable (Node 12+), matching Python's sorted().
  events.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  return events;
}
