/**
 * Model selection for analysis runs. Pro users get a stronger model;
 * Free users get the default mini model.
 *
 * The model string is passed through to both the OpenAI chat.completions.create
 * call and the withOpenAIRetry `model` option (for usage attribution).
 */

export const FREE_ANALYSIS_MODEL = "gpt-5.4-mini";
export const DEFAULT_PRO_ANALYSIS_MODEL = "gpt-5";
export type AnalysisTier = "free" | "pro";

/**
 * Return the OpenAI model string to use for an analysis run.
 * Pro tier honours the `PRO_ANALYSIS_MODEL` env override (e.g. point at
 * `gpt-4o` until `gpt-5` is GA). An empty-string env value is treated as
 * unset and falls through to the default.
 */
export function modelFor(tier: AnalysisTier): string {
  if (tier === "pro") {
    const override = process.env.PRO_ANALYSIS_MODEL;
    if (override && override.length > 0) return override;
    return DEFAULT_PRO_ANALYSIS_MODEL;
  }
  return FREE_ANALYSIS_MODEL;
}
