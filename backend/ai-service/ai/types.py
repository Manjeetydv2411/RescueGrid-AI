"""Pydantic models for AI service request/response contracts."""

from typing import Any
from typing_extensions import Literal

from pydantic import BaseModel, Field


# Request Models
class SuggestCategoryRequest(BaseModel):
    """Request model for category suggestion."""
    version: Literal["1.0"] = Field(default="1.0", description="API version")
    title: str = Field(..., min_length=1, max_length=200, description="Incident title")
    description: str = Field(..., min_length=1, max_length=2000, description="Incident description")


class GenerateSummaryRequest(BaseModel):
    """Request model for summary generation."""
    version: Literal["1.0"] = Field(default="1.0", description="API version")
    incident_data: dict[str, Any] = Field(
        ..., description="Incident information including title, description, severity, category, location"
    )


class ScorePriorityRequest(BaseModel):
    """Request model for priority scoring."""
    version: Literal["1.0"] = Field(default="1.0", description="API version")
    incident_data: dict[str, Any] = Field(
        ..., description="Incident information including severity, category, title, description"
    )


class FlagMissingInfoRequest(BaseModel):
    """Request model for missing information flagging."""
    version: Literal["1.0"] = Field(default="1.0", description="API version")
    incident_data: dict[str, Any] = Field(
        ..., description="Incident information to check for completeness"
    )


# Response Models
class SuggestCategoryResponse(BaseModel):
    """Response model for category suggestion."""
    version: Literal["1.0"]
    suggested_category: str = Field(
        ..., description="Suggested incident category (FLOOD, FIRE, EARTHQUAKE, LANDSLIDE, MEDICAL, OTHER)"
    )
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Confidence score (only when meaningful basis for assessment)"
    )
    explanation: str = Field(..., description="Explanation of the suggestion")
    matched_keywords: list[str] | None = Field(default=None, description="Keywords that matched")
    total_matches: int | None = Field(default=None, description="Total keyword matches")


class GenerateSummaryResponse(BaseModel):
    """Response model for summary generation."""
    version: Literal["1.0"]
    summary: str = Field(..., description="Generated incident summary")
    key_points: list[str] = Field(..., description="Key extracted facts")
    estimated_impact: str = Field(..., description="Estimated impact assessment")


class ScorePriorityResponse(BaseModel):
    """Response model for priority scoring."""
    version: Literal["1.0"]
    score: int = Field(..., ge=0, le=10, description="Priority score from 0-10")
    factors: list[str] = Field(..., description="Factors that contributed to the score")
    max_score: int = Field(default=10, description="Maximum possible score")
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Confidence score"
    )


class FlagMissingInfoResponse(BaseModel):
    """Response model for missing information flagging."""
    version: Literal["1.0"]
    missing_fields: list[dict[str, Any]] = Field(
        ..., description="List of missing/incomplete fields with severity and suggestions"
    )


# Common models
class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")
    provider: str | None = Field(default=None, description="AI provider name")
    timestamp: str = Field(..., description="ISO 8601 timestamp")


class HealthResponse(BaseModel):
    """Health check response model."""
    status: Literal["healthy", "degraded", "unhealthy"]
    version: str = Field(default="1.0", description="API version")
    provider: str | None = Field(default=None, description="Active AI provider")
    uptime_seconds: float | None = Field(default=None, description="Service uptime")
    errors_24h: int | None = Field(default=0, description="Error count in last 24 hours")