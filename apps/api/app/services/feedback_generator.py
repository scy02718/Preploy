import json
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.schemas import (
    BehavioralConfig,
    FeedbackResponse,
    TranscriptEntry,
)

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=settings.openai_api_key)

ANALYSIS_SYSTEM_PROMPT = """You are an expert interview coach analyzing a behavioral interview transcript.

Your task is to evaluate the candidate's performance and provide structured, actionable feedback.

For each question-answer pair you identify in the transcript:
1. Extract the interviewer's question
2. Summarize the candidate's answer in 1-2 sentences
3. Score the answer from 0-10 based on:
   - Use of STAR method (Situation, Task, Action, Result)
   - Specificity and concrete examples
   - Relevance to the question
   - Communication clarity
   - Depth and thoughtfulness
4. Provide specific feedback on what was good and what could improve
5. Give 1-3 actionable suggestions

Then provide an overall assessment:
- Overall score (weighted average of individual answers)
- 2-3 sentence summary
- Top 3 strengths
- Top 3 areas for improvement

Respond ONLY with valid JSON matching this exact structure:
{
  "overall_score": <float 0-10>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "answer_analyses": [
    {
      "question": "<the interviewer's question>",
      "answer_summary": "<1-2 sentence summary of candidate's answer>",
      "score": <float 0-10>,
      "feedback": "<specific feedback on this answer>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
    }
  ]
}"""


def _build_analysis_prompt(
    transcript: list[TranscriptEntry],
    config: BehavioralConfig,
) -> str:
    """Build the user message for GPT-5.4-mini analysis."""
    parts: list[str] = []

    # Context
    if config.company_name:
        parts.append(f"Company: {config.company_name}")
    if config.job_description:
        parts.append(f"Job Description:\n{config.job_description}")

    # Difficulty context
    if config.difficulty <= 0.3:
        parts.append("Interview level: Entry-level")
    elif config.difficulty >= 0.7:
        parts.append("Interview level: Senior/Staff")
    else:
        parts.append("Interview level: Mid-level")

    parts.append("\n--- TRANSCRIPT ---\n")

    for entry in transcript:
        speaker = "Interviewer" if entry.speaker == "ai" else "Candidate"
        parts.append(f"{speaker}: {entry.text}")

    parts.append("\n--- END TRANSCRIPT ---")
    parts.append("\nAnalyze this interview and provide structured feedback as JSON.")

    return "\n".join(parts)


async def generate_behavioral_feedback(
    transcript: list[TranscriptEntry],
    config: BehavioralConfig,
) -> FeedbackResponse:
    """Send transcript to GPT-5.4-mini for analysis and return structured feedback."""
    if not transcript:
        raise ValueError("Transcript is empty")

    user_prompt = _build_analysis_prompt(transcript, config)

    # Retry once on malformed GPT response (empty, invalid JSON, or schema mismatch).
    # Mirrors the pattern in apps/web/app/api/problems/generate/route.ts.
    for attempt in range(2):
        response = await client.chat.completions.create(
            model="gpt-5.4-mini",
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
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
                        "service": "feedback_generator",
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
                        "service": "feedback_generator",
                        "reason": "invalid_json",
                    },
                )
                continue
            logger.error("Failed to parse GPT-5.4-mini response: %s", raw[:500])
            raise RuntimeError(f"GPT-5.4-mini returned invalid JSON: {e}") from e

        try:
            feedback = FeedbackResponse.model_validate(data)
        except Exception as e:
            if attempt == 0:
                logger.warning(
                    "GPT response malformed, retrying",
                    extra={
                        "attempt": 1,
                        "service": "feedback_generator",
                        "reason": "schema_mismatch",
                    },
                )
                continue
            logger.error("GPT-5.4-mini response failed validation: %s", data)
            raise RuntimeError(f"GPT-5.4-mini response doesn't match expected schema: {e}") from e

        return feedback

    # Defensive: loop always returns or raises above.
    raise RuntimeError("GPT-5.4-mini retry loop exited without result")
