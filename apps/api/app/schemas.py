from typing import Literal

from pydantic import BaseModel, Field


class TranscriptEntry(BaseModel):
    speaker: str  # "user" or "ai"
    text: str
    timestamp_ms: int


class BehavioralConfig(BaseModel):
    company_name: str | None = None
    job_description: str | None = None
    expected_questions: list[str] | None = None
    interview_style: float = 0.5
    difficulty: float = 0.5


class FeedbackRequest(BaseModel):
    session_id: str
    transcript: list[TranscriptEntry]
    config: BehavioralConfig = BehavioralConfig()


class AnswerAnalysis(BaseModel):
    question: str
    answer_summary: str
    score: float = Field(ge=0, le=10)
    feedback: str
    suggestions: list[str]


class FeedbackResponse(BaseModel):
    overall_score: float = Field(ge=0, le=10)
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    answer_analyses: list[AnswerAnalysis]


# ---- Technical interview schemas ----


class CodeSnapshot(BaseModel):
    code: str
    language: str
    timestamp_ms: int
    event_type: str


class TechnicalFeedbackRequest(BaseModel):
    session_id: str
    transcript: list[TranscriptEntry]
    code_snapshots: list[CodeSnapshot]
    config: dict


class TimelineEvent(BaseModel):
    timestamp_ms: int
    event_type: Literal["speech", "code_change"]
    summary: str
    code: str | None = None
    full_text: str | None = None


class TechnicalFeedbackResponse(BaseModel):
    overall_score: float = Field(ge=0, le=10)
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    code_quality_score: float = Field(ge=0, le=10)
    explanation_quality_score: float = Field(ge=0, le=10)
    answer_analyses: list[AnswerAnalysis]
    timeline_analysis: list[TimelineEvent]
