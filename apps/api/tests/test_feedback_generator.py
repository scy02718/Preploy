"""Tests for the feedback generator service.

Mocks the OpenAI API call; tests prompt building, response parsing, and error handling.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas import BehavioralConfig, FeedbackResponse, TranscriptEntry
from app.services.feedback_generator import (
    _build_analysis_prompt,
    generate_behavioral_feedback,
)

# ---- Fixtures ----

SAMPLE_TRANSCRIPT = [
    TranscriptEntry(speaker="ai", text="Tell me about a time you led a team.", timestamp_ms=0),
    TranscriptEntry(
        speaker="user",
        text="At my previous company, I led a team of 5 engineers to ship a new feature in 3 weeks.",
        timestamp_ms=5000,
    ),
    TranscriptEntry(speaker="ai", text="What challenges did you face?", timestamp_ms=15000),
    TranscriptEntry(
        speaker="user",
        text="We had tight deadlines and had to cut some scope. I facilitated a prioritization session.",
        timestamp_ms=20000,
    ),
]

SAMPLE_CONFIG = BehavioralConfig(
    company_name="Google",
    job_description="Senior Software Engineer",
    difficulty=0.8,
)

VALID_GPT_RESPONSE = {
    "overall_score": 7.5,
    "summary": "The candidate showed good leadership skills with concrete examples.",
    "strengths": [
        "Clear communication",
        "Concrete examples with metrics",
        "Good STAR method usage",
    ],
    "weaknesses": [
        "Could elaborate more on results",
        "Lacked discussion of alternative approaches",
        "No mention of lessons learned",
    ],
    "answer_analyses": [
        {
            "question": "Tell me about a time you led a team.",
            "answer_summary": "Led a team of 5 engineers to ship a feature in 3 weeks.",
            "score": 8.0,
            "feedback": "Good specific example with metrics. Could include more about the result.",
            "suggestions": [
                "Quantify the business impact of the feature",
                "Describe how you delegated tasks",
            ],
        },
        {
            "question": "What challenges did you face?",
            "answer_summary": "Managed tight deadlines through scope prioritization.",
            "score": 7.0,
            "feedback": "Good problem-solving, but could go deeper on the process.",
            "suggestions": [
                "Explain the criteria used for prioritization",
            ],
        },
    ],
}


# ---- Prompt building tests ----


class TestBuildAnalysisPrompt:
    def test_includes_company_name(self):
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)
        assert "Company: Google" in prompt

    def test_includes_job_description(self):
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)
        assert "Senior Software Engineer" in prompt

    def test_includes_difficulty_level(self):
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)
        assert "Senior/Staff" in prompt

    def test_entry_level_difficulty(self):
        config = BehavioralConfig(difficulty=0.2)
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, config)
        assert "Entry-level" in prompt

    def test_mid_level_difficulty(self):
        config = BehavioralConfig(difficulty=0.5)
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, config)
        assert "Mid-level" in prompt

    def test_maps_speaker_labels(self):
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)
        assert "Interviewer: Tell me about a time" in prompt
        assert "Candidate: At my previous company" in prompt

    def test_omits_company_when_none(self):
        config = BehavioralConfig()
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, config)
        assert "Company:" not in prompt

    def test_contains_transcript_markers(self):
        prompt = _build_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)
        assert "--- TRANSCRIPT ---" in prompt
        assert "--- END TRANSCRIPT ---" in prompt


# ---- Feedback generation tests ----


def _mock_openai_response(content: str):
    """Create a mock OpenAI chat completion response."""
    message = MagicMock()
    message.content = content
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


class TestGenerateBehavioralFeedback:
    @pytest.mark.asyncio
    async def test_valid_transcript_returns_feedback(self):
        mock_response = _mock_openai_response(json.dumps(VALID_GPT_RESPONSE))

        with patch(
            "app.services.feedback_generator.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await generate_behavioral_feedback(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)

        assert isinstance(result, FeedbackResponse)
        assert result.overall_score == 7.5
        assert len(result.strengths) == 3
        assert len(result.weaknesses) == 3
        assert len(result.answer_analyses) == 2
        assert result.answer_analyses[0].score == 8.0

    @pytest.mark.asyncio
    async def test_empty_transcript_raises_error(self):
        with pytest.raises(ValueError, match="Transcript is empty"):
            await generate_behavioral_feedback([], SAMPLE_CONFIG)

    @pytest.mark.asyncio
    async def test_empty_gpt_response_raises_error(self):
        mock_response = _mock_openai_response(None)

        with patch(
            "app.services.feedback_generator.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            with pytest.raises(RuntimeError, match="empty response"):
                await generate_behavioral_feedback(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)

    @pytest.mark.asyncio
    async def test_invalid_json_raises_error(self):
        mock_response = _mock_openai_response("not valid json {{{")

        with patch(
            "app.services.feedback_generator.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            with pytest.raises(RuntimeError, match="invalid JSON"):
                await generate_behavioral_feedback(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)

    @pytest.mark.asyncio
    async def test_malformed_schema_raises_error(self):
        """GPT returns valid JSON but missing required fields."""
        bad_response = {"overall_score": 5.0}  # missing summary, strengths, etc.
        mock_response = _mock_openai_response(json.dumps(bad_response))

        with patch(
            "app.services.feedback_generator.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            with pytest.raises(RuntimeError, match="doesn't match expected schema"):
                await generate_behavioral_feedback(SAMPLE_TRANSCRIPT, SAMPLE_CONFIG)
