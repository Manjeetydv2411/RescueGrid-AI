"""Audit models for AI recommendations in RescueGrid AI."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AIRecommendation(BaseModel):
    """Stored AI recommendation with metadata."""

    recommendation_id: str = Field(..., description="Unique ID for the recommendation")
    request_type: str = Field(..., description="Type of AI request (category-suggestion, summary, priority-score, missing-info)")
    incident_id: str | None = Field(None, description="ID of the incident being analyzed")
    model_version: str = Field(..., description="Version of the AI model used")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When recommendation was made")
    human_reviewed: bool = Field(False, description="Whether human reviewed the recommendation")
    human_override: bool | None = Field(None, description="Whether human changed the recommendation")
    human_reviewed_at: datetime | None = Field(None, description="When human reviewed the recommendation")

    # Recommendation data
    data: dict[str, Any] = Field(..., description="Original AI recommendation data")

    # Audit trail
    created_by: str | None = Field(None, description="User ID of the requester")
    action_taken: str | None = Field(None, description="Action taken based on recommendation")

    class Config:
        json_schema_extra = {
            "example": {
                "recommendation_id": "rec_12345",
                "request_type": "priority-score",
                "incident_id": "inc_67890",
                "model_version": "1.0",
                "timestamp": "2026-10-20T12:00:00Z",
                "human_reviewed": True,
                "human_override": False,
                "data": {"score": 8, "factors": ["Severity: HIGH", "Category: FIRE"]},
                "created_by": "user_123",
                "action_taken": "dispatched_resources",
            }
        }


class AuditLogEntry(BaseModel):
    """Audit log entry for AI-related actions."""

    action: str = Field(..., description="Action performed")
    action_type: str = Field(..., description="Type of action (recommendation, review, override)")
    actor_id: str | None = Field(None, description="User ID performing the action")
    actor_role: str | None = Field(None, description="User role")
    related_id: str | None = Field(None, description="Related incident/assignment ID")
    details: dict[str, Any] = Field(default_factory=dict, description="Additional details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "action": "AI priority score generated",
                "action_type": "recommendation",
                "actor_id": "system",
                "actor_role": "system",
                "related_id": "inc_67890",
                "details": {"score": 8, "model": "baseline", "version": "1.0"},
                "timestamp": "2026-10-20T12:00:00Z",
            }
        }


def create_ai_recommendation(
    recommendation_id: str,
    request_type: str,
    incident_id: str | None,
    model_version: str,
    data: dict[str, Any],
    created_by: str | None = None,
) -> AIRecommendation:
    """Factory function to create an AIRecommendation."""
    return AIRecommendation(
        recommendation_id=recommendation_id,
        request_type=request_type,
        incident_id=incident_id,
        model_version=model_version,
        data=data,
        created_by=created_by,
    )


def create_audit_log_entry(
    action: str,
    action_type: str,
    related_id: str | None = None,
    actor_id: str | None = None,
    actor_role: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLogEntry:
    """Factory function to create an AuditLogEntry."""
    return AuditLogEntry(
        action=action,
        action_type=action_type,
        related_id=related_id,
        actor_id=actor_id,
        actor_role=actor_role,
        details=details or {},
    )
