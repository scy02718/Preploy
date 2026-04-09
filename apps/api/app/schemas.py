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
