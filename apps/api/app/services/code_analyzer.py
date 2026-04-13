"""Code analyzer: builds the GPT prompt for technical interview analysis and
generates structured feedback from transcript + code snapshots."""

import json
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.schemas import (
    CodeSnapshot,
    TechnicalFeedbackResponse,
    TimelineEvent,
    TranscriptEntry,
)
from app.services.timeline_correlator import build_timeline

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=settings.openai_api_key)

TECHNICAL_ANALYSIS_SYSTEM_PROMPT = """You are an expert technical interview coach analyzing a coding interview session.

You will receive:
- A full transcript of the candidate's verbal explanations
- The candidate's code evolution (all snapshots from start to final submission)
- Session configuration (problem type, focus areas, difficulty)

Evaluate the candidate on two dimensions:

1. **Code Quality (0-10)**: correctness, efficiency, readability,
   edge case handling, time/space complexity awareness
2. **Explanation Quality (0-10)**: clarity of thought process,
   problem decomposition, trade-off discussion, communication

Analyze distinct aspects of the candidate's performance.
Use these categories for the answer_analyses array:
- **Approach & Problem Decomposition**: How the candidate broke
  down the problem and chose their strategy
- **Implementation**: Code correctness, structure, and style —
  reference specific lines or functions from the code snapshots
- **Complexity Analysis**: Whether the candidate discussed
  time/space complexity and if their analysis was correct
- **Edge Cases & Testing**: Whether edge cases were considered in code or discussion
- **Communication**: How well the candidate explained their thinking throughout

For each analysis, reference specific code from the snapshots
(e.g., "The loop on line 3 could use enumerate instead") and
specific quotes from the transcript when relevant.

Respond ONLY with valid JSON matching this exact structure:
{
  "overall_score": <float 0-10>,
  "summary": "<2-3 sentence overall assessment referencing specific parts of the code>",
  "strengths": ["<strength — cite code or transcript>", "<strength>", "<strength>"],
  "weaknesses": ["<weakness — cite code or transcript>", "<weakness>", "<weakness>"],
  "code_quality_score": <float 0-10>,
  "explanation_quality_score": <float 0-10>,
  "answer_analyses": [
    {
      "question": "<aspect being evaluated, e.g. 'Approach & Problem Decomposition'>",
      "answer_summary": "<1-2 sentence summary of what the candidate did, referencing code>",
      "score": <float 0-10>,
      "feedback": "<specific feedback citing code lines and transcript quotes>",
      "suggestions": ["<actionable suggestion>", "<actionable suggestion>"]
    }
  ]
}"""


def build_technical_analysis_prompt(
    transcript: list[TranscriptEntry],
    code_snapshots: list[CodeSnapshot],
    config: dict,
) -> str:
    """Build the user message for GPT technical analysis."""
    parts: list[str] = []

    # Session config context
    interview_type = config.get("interview_type", "leetcode")
    focus_areas = config.get("focus_areas", [])
    difficulty = config.get("difficulty", "medium")
    language = config.get("language", "python")

    parts.append(f"Interview Type: {interview_type}")
    parts.append(f"Difficulty: {difficulty.capitalize()}")
    parts.append(f"Language: {language}")
    if focus_areas:
        areas_str = ", ".join(str(a).replace("_", " ").title() for a in focus_areas)
        parts.append(f"Focus Areas: {areas_str}")

    # Code evolution — include all snapshots so GPT can reference the progression
    parts.append("\n--- CODE EVOLUTION ---")
    if code_snapshots:
        sorted_snapshots = sorted(code_snapshots, key=lambda s: s.timestamp_ms)
        parts.append(f"Language used: {sorted_snapshots[-1].language}")
        parts.append(f"Total snapshots: {len(sorted_snapshots)}")

        for idx, snap in enumerate(sorted_snapshots):
            minutes = snap.timestamp_ms // 60000
            seconds = (snap.timestamp_ms % 60000) // 1000
            is_last = idx == len(sorted_snapshots) - 1
            label = "FINAL SUBMISSION" if is_last else f"Snapshot {idx + 1}"
            parts.append(
                f"\n[{label} at {minutes:02d}:{seconds:02d} — {snap.event_type}, {snap.language}]"
                f"\n```{snap.language}\n{snap.code}\n```"
            )
    else:
        parts.append("No code was written.")
    parts.append("--- END CODE ---")

    # Transcript
    parts.append("\n--- TRANSCRIPT ---")
    for entry in transcript:
        speaker = "Candidate" if entry.speaker == "user" else "Interviewer"
        parts.append(f"{speaker}: {entry.text}")
    parts.append("--- END TRANSCRIPT ---")

    parts.append("\nAnalyze this technical interview and provide structured feedback as JSON.")

    return "\n".join(parts)


async def generate_technical_feedback(
    transcript: list[TranscriptEntry],
    code_snapshots: list[CodeSnapshot],
    config: dict,
) -> TechnicalFeedbackResponse:
    """Send transcript + code snapshots to GPT for analysis and return structured feedback."""
    if not transcript:
        raise ValueError("Transcript is empty")

    user_prompt = build_technical_analysis_prompt(transcript, code_snapshots, config)
    timeline: list[TimelineEvent] = build_timeline(transcript, code_snapshots)

    # Retry once on malformed GPT response (empty, invalid JSON, or schema mismatch).
    # Mirrors the pattern in apps/web/app/api/problems/generate/route.ts.
    for attempt in range(2):
        response = await client.chat.completions.create(
            model="gpt-5.4-mini",
            messages=[
                {"role": "system", "content": TECHNICAL_ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_completion_tokens=4000,
        )

        raw = response.choices[0].message.content
        if not raw:
            if attempt == 0:
                logger.warning(
                    "GPT response malformed, retrying",
                    extra={
                        "attempt": 1,
                        "service": "code_analyzer",
                        "reason": "empty",
                    },
                )
                continue
            raise RuntimeError("GPT-5.4-mini returned empty response")

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            if attempt == 0:
                logger.warning(
                    "GPT response malformed, retrying",
                    extra={
                        "attempt": 1,
                        "service": "code_analyzer",
                        "reason": "invalid_json",
                    },
                )
                continue
            logger.error("Failed to parse GPT-5.4-mini response: %s", raw[:500])
            raise RuntimeError(f"GPT-5.4-mini returned invalid JSON: {e}") from e

        # Inject the deterministic timeline (not from GPT) before validation.
        data["timeline_analysis"] = [event.model_dump() for event in timeline]

        try:
            feedback = TechnicalFeedbackResponse.model_validate(data)
        except Exception as e:
            if attempt == 0:
                logger.warning(
                    "GPT response malformed, retrying",
                    extra={
                        "attempt": 1,
                        "service": "code_analyzer",
                        "reason": "schema_mismatch",
                    },
                )
                continue
            logger.error("GPT-5.4-mini response failed validation: %s", data)
            raise RuntimeError(f"GPT-5.4-mini response doesn't match expected schema: {e}") from e

        return feedback

    # Defensive: loop always returns or raises above.
    raise RuntimeError("GPT-5.4-mini retry loop exited without result")
