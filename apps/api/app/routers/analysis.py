import logging

from fastapi import APIRouter, HTTPException

from app.schemas import FeedbackRequest, FeedbackResponse
from app.services.feedback_generator import generate_behavioral_feedback

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analysis/behavioral", response_model=FeedbackResponse)
async def analyze_behavioral_interview(request: FeedbackRequest) -> FeedbackResponse:
    """Analyze a behavioral interview transcript and return structured feedback."""
    if not request.transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty")

    try:
        feedback = await generate_behavioral_feedback(
            transcript=request.transcript,
            config=request.config,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.exception("Feedback generation failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    return feedback
