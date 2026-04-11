"""Unit tests for the code analyzer service.

Mocks the OpenAI API call; tests prompt building, response parsing, and error handling.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas import CodeSnapshot, TechnicalFeedbackResponse, TranscriptEntry
from app.services.code_analyzer import (
    build_technical_analysis_prompt,
    generate_technical_feedback,
)


# ---- Fixtures ----

SAMPLE_TRANSCRIPT = [
    TranscriptEntry(speaker="user", text="I'll use a sliding window approach.", timestamp_ms=1000),
    TranscriptEntry(speaker="user", text="The time complexity is O(n).", timestamp_ms=5000),
]

SAMPLE_SNAPSHOTS = [
    CodeSnapshot(code="def solution(): pass", language="python", timestamp_ms=500, event_type="edit"),
    CodeSnapshot(
        code="def solution(nums):\n    return max(nums)",
        language="python",
        timestamp_ms=8000,
        event_type="edit",
    ),
]

SAMPLE_CONFIG = {
    "interview_type": "leetcode",
    "focus_areas": ["arrays", "sliding_window"],
    "difficulty": "medium",
    "language": "python",
}

VALID_GPT_RESPONSE = {
    "overall_score": 7.0,
    "summary": "Candidate demonstrated solid problem-solving skills.",
    "strengths": ["Clear explanation", "Correct approach", "Good complexity analysis"],
    "weaknesses": ["Edge cases not discussed", "No error handling", "Could optimize further"],
    "code_quality_score": 6.5,
    "explanation_quality_score": 7.5,
    "answer_analyses": [
        {
            "question": "Walk me through your approach.",
            "answer_summary": "Candidate used a sliding window.",
            "score": 7.0,
            "feedback": "Good approach but could discuss alternatives.",
            "suggestions": ["Mention brute force first", "Discuss trade-offs"],
        }
    ],
}


# ---- Prompt building tests ----


class TestBuildTechnicalAnalysisPrompt:
    def test_includes_interview_type(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "leetcode" in prompt.lower()

    def test_includes_difficulty(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "Medium" in prompt

    def test_includes_language(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "python" in prompt.lower()

    def test_includes_focus_areas(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "Arrays" in prompt
        assert "Sliding Window" in prompt

    def test_includes_final_code(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "max(nums)" in prompt

    def test_includes_transcript_text(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "sliding window approach" in prompt

    def test_candidate_label_used(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "Candidate:" in prompt

    def test_empty_snapshots_handled(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, [], SAMPLE_CONFIG)
        assert "No code was written" in prompt

    def test_all_snapshots_included_with_timestamps(self):
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)
        assert "Snapshot 1" in prompt
        assert "FINAL SUBMISSION" in prompt
        # Both initial and final code should be present
        assert "def solution(): pass" in prompt
        assert "max(nums)" in prompt

    def test_system_design_config(self):
        config = {
            "interview_type": "system_design",
            "focus_areas": ["scalability"],
            "difficulty": "hard",
            "language": "any",
        }
        prompt = build_technical_analysis_prompt(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, config)
        assert "system_design" in prompt.lower()
        assert "Hard" in prompt


# ---- Feedback generation tests ----


def _mock_openai_response(content: str):
    message = MagicMock()
    message.content = content
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


class TestGenerateTechnicalFeedback:
    @pytest.mark.asyncio
    async def test_valid_inputs_return_feedback(self):
        mock_response = _mock_openai_response(json.dumps(VALID_GPT_RESPONSE))

        with patch(
            "app.services.code_analyzer.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await generate_technical_feedback(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)

        assert isinstance(result, TechnicalFeedbackResponse)
        assert result.overall_score == 7.0
        assert result.code_quality_score == 6.5
        assert result.explanation_quality_score == 7.5
        assert len(result.strengths) == 3
        assert len(result.timeline_analysis) == len(SAMPLE_TRANSCRIPT) + len(SAMPLE_SNAPSHOTS)

    @pytest.mark.asyncio
    async def test_empty_transcript_raises_value_error(self):
        with pytest.raises(ValueError, match="Transcript is empty"):
            await generate_technical_feedback([], SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)

    @pytest.mark.asyncio
    async def test_empty_gpt_response_raises_runtime_error(self):
        mock_response = _mock_openai_response(None)

        with patch(
            "app.services.code_analyzer.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            with pytest.raises(RuntimeError, match="empty response"):
                await generate_technical_feedback(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)

    @pytest.mark.asyncio
    async def test_invalid_json_raises_runtime_error(self):
        mock_response = _mock_openai_response("not valid json {{{")

        with patch(
            "app.services.code_analyzer.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            with pytest.raises(RuntimeError, match="invalid JSON"):
                await generate_technical_feedback(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)

    @pytest.mark.asyncio
    async def test_malformed_schema_raises_runtime_error(self):
        bad_response = {"overall_score": 5.0}  # missing required fields
        mock_response = _mock_openai_response(json.dumps(bad_response))

        with patch(
            "app.services.code_analyzer.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            with pytest.raises(RuntimeError, match="doesn't match expected schema"):
                await generate_technical_feedback(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)

    @pytest.mark.asyncio
    async def test_timeline_injected_from_correlator_not_gpt(self):
        """Timeline should come from build_timeline(), not from GPT response."""
        gpt_response = {**VALID_GPT_RESPONSE, "timeline_analysis": []}  # GPT returns empty timeline
        mock_response = _mock_openai_response(json.dumps(gpt_response))

        with patch(
            "app.services.code_analyzer.client.chat.completions.create",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await generate_technical_feedback(SAMPLE_TRANSCRIPT, SAMPLE_SNAPSHOTS, SAMPLE_CONFIG)

        # Timeline should be built from actual data, not GPT's empty list
        assert len(result.timeline_analysis) > 0
