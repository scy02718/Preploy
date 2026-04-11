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
- The candidate's code evolution (first and final snapshots)
- Session configuration (problem type, focus areas, difficulty)

Evaluate the candidate on two dimensions:

1. **Code Quality (0-10)**: correctness, efficiency, readability, edge case handling, time/space complexity awareness
2. **Explanation Quality (0-10)**: clarity of thought process, problem decomposition, trade-off discussion, communication

Also identify question-answer pairs from the verbal transcript (treat the candidate's explanations as answers to implicit interview prompts like "walk me through your approach", "what is the time complexity?", etc.).

Respond ONLY with valid JSON matching this exact structure:
{
  "overall_score": <float 0-10>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "code_quality_score": <float 0-10>,
  "explanation_quality_score": <float 0-10>,
  "answer_analyses": [
    {
      "question": "<implicit or explicit question being addressed>",
      "answer_summary": "<1-2 sentence summary>",
      "score": <float 0-10>,
      "feedback": "<specific feedback>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
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

    # Code evolution summary
    parts.append("\n--- CODE EVOLUTION ---")
    if code_snapshots:
        # Sort by timestamp to ensure correct order regardless of caller ordering
        sorted_snapshots = sorted(code_snapshots, key=lambda s: s.timestamp_ms)
        first = sorted_snapshots[0]
        last = sorted_snapshots[-1]
        parts.append(f"Language used: {last.language}")
        parts.append(f"Total snapshots: {len(sorted_snapshots)}")
        if len(sorted_snapshots) > 1:
            parts.append(f"\nInitial code ({first.language}):\n```\n{first.code}\n```")
        parts.append(f"\nFinal code ({last.language}):\n```\n{last.code}\n```")
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
        raise RuntimeError("GPT-5.4-mini returned empty response")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse GPT-5.4-mini response: %s", raw[:500])
        raise RuntimeError(f"GPT-5.4-mini returned invalid JSON: {e}") from e

    # Inject the deterministic timeline (not from GPT)
    data["timeline_analysis"] = [event.model_dump() for event in timeline]

    try:
        feedback = TechnicalFeedbackResponse.model_validate(data)
    except Exception as e:
        logger.error("GPT-5.4-mini response failed validation: %s", data)
        raise RuntimeError(f"GPT-5.4-mini response doesn't match expected schema: {e}") from e

    return feedback
