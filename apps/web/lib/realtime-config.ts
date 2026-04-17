/** OpenAI Realtime VAD config + client-side silence-watchdog timing.
 *  Single source of truth shared by useRealtimeVoice and tests. */

/** Voice activity detection sensitivity threshold (0–1).
 *  Higher values require louder speech to trigger; 0.4 reduces false positives
 *  from background noise while still catching soft voices. */
export const VAD_THRESHOLD = 0.4;

/** Milliseconds of audio prepended before detected speech onset.
 *  Prevents clipping the very start of a word when VAD activates late. */
export const VAD_PREFIX_PADDING_MS = 300;

/** Milliseconds of continuous silence after which the server declares the
 *  user's turn complete and triggers a response.
 *  3s gives natural pauses breathing room without cutting off mid-thought. */
export const VAD_SILENCE_DURATION_MS = 3000; // server waits 3s of silence before declaring user-turn end

/** Wall-clock milliseconds from user-turn end to the first gentle nudge.
 *  At 10s the AI sends a one-sentence prompt ("Take your time…") injected
 *  as a system message so the candidate knows the session is still live. */
export const SILENCE_NUDGE_MS = 10_000; // wall-clock from user-turn end → first gentle nudge

/** Wall-clock milliseconds from user-turn end to the polite hand-off.
 *  At 60s the AI acknowledges the silence and moves to the next question.
 *  Matches the acceptance-criterion floor of ≥60s. */
export const SILENCE_HANDOFF_MS = 60_000; // wall-clock from user-turn end → polite hand-off

/** Minimum silence floor required before any AI response may be triggered
 *  (acceptance criterion: "AI waits at least 5s before any response").
 *  The watchdog fires its first audible response at SILENCE_NUDGE_MS (10s),
 *  which is comfortably above this floor. */
export const MID_ANSWER_PAUSE_MIN_MS = 5_000; // floor for the AC "wait ≥5s before any response" check
