/**
 * Predicate helpers for reasoning about session feedback row completeness.
 *
 * Technical feedback rows must have all three technical-specific fields set:
 * `codeQualityScore`, `explanationQualityScore`, and `timelineAnalysis`. If any
 * of them is null, the row is considered incomplete/stale and should be
 * regenerated instead of being returned from the idempotency short-circuit.
 */
export type TechnicalFeedbackShape = {
  codeQualityScore: number | null;
  explanationQualityScore: number | null;
  timelineAnalysis: unknown;
};

/**
 * Returns true when all three technical feedback fields are populated
 * (non-null). Returns false if any are null.
 */
export function isTechnicalFeedbackComplete(
  row: TechnicalFeedbackShape
): boolean {
  return (
    row.codeQualityScore != null &&
    row.explanationQualityScore != null &&
    row.timelineAnalysis != null
  );
}
