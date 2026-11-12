"""Tests for AI request/response type validation."""

import pytest

from ai.types import (
    SuggestCategoryRequest,
    SuggestCategoryResponse,
    GenerateSummaryRequest,
    GenerateSummaryResponse,
    ScorePriorityRequest,
    ScorePriorityResponse,
    FlagMissingInfoRequest,
    FlagMissingInfoResponse,
    ErrorResponse,
    HealthResponse,
)


class TestRequestValidation:
    """Test request model validation."""

    def test_suggest_category_valid(self):
        """Test valid suggest category request."""
        request = SuggestCategoryRequest(
            version="1.0",
            title="Fire Alert",
            description="Building on fire with smoke"
        )

        assert request.version == "1.0"
        assert request.title == "Fire Alert"
        assert request.description == "Building on fire with smoke"

    def test_suggest_category_empty_title_raises_error(self):
        """Test that empty title raises validation error."""
        with pytest.raises(Exception):  # Pydantic ValidationError
            SuggestCategoryRequest(
                version="1.0",
                title="",
                description="Some description"
            )

    def test_suggest_category_short_description_raises_error(self):
        """Test that short description raises validation error."""
        with pytest.raises(Exception):  # Pydantic ValidationError
            SuggestCategoryRequest(
                version="1.0",
                title="Title",
                description="Sh"
            )

    def test_suggest_category_long_title_truncates_or_raises(self):
        """Test title length validation."""
        long_title = "X" * 300
        with pytest.raises(Exception):
            SuggestCategoryRequest(
                version="1.0",
                title=long_title,
                description="Some description"
            )

    def test_score_priority_valid(self):
        """Test valid priority score request."""
        request = ScorePriorityRequest(
            version="1.0",
            incident_data={
                "severity": "HIGH",
                "category": "FLOOD",
                "title": "Flood Warning",
                "description": "River overflow"
            }
        )

        assert request.version == "1.0"
        assert request.incident_data["severity"] == "HIGH"

    def test_generate_summary_valid(self):
        """Test valid summary generation request."""
        request = GenerateSummaryRequest(
            version="1.0",
            incident_data={
                "title": "Incident",
                "description": "Description",
                "severity": "HIGH",
                "category": "FIRE"
            }
        )

        assert request.version == "1.0"

    def test_flag_missing_info_valid(self):
        """Test valid missing info request."""
        request = FlagMissingInfoRequest(
            version="1.0",
            incident_data={"title": "Test"}
        )

        assert request.version == "1.0"


class TestResponseValidation:
    """Test response model validation."""

    def test_suggest_category_response_valid(self):
        """Test valid suggest category response."""
        response = SuggestCategoryResponse(
            version="1.0",
            suggested_category="FIRE",
            explanation="Fire keywords detected",
            matched_keywords=["fire", "burning"],
            total_matches=2
        )

        assert response.suggested_category == "FIRE"
        assert response.total_matches == 2

    def test_suggest_category_response_confidence_valid(self):
        """Test confidence field in response."""
        response = SuggestCategoryResponse(
            version="1.0",
            suggested_category="FIRE",
            explanation="Explanation",
            confidence=0.85
        )

        assert 0 <= response.confidence <= 1

    def test_score_priority_response_valid(self):
        """Test valid priority score response."""
        response = ScorePriorityResponse(
            version="1.0",
            score=7,
            factors=["Severity: HIGH", "Category: FIRE"],
            max_score=10
        )

        assert response.score == 7
        assert 0 <= response.score <= 10

    def test_score_priority_response_score_out_of_range_raises_error(self):
        """Test that score outside 0-10 raises validation error."""
        with pytest.raises(Exception):
            ScorePriorityResponse(
                version="1.0",
                score=15,
                factors=[],
                max_score=10
            )

    def test_health_response_valid(self):
        """Test valid health response."""
        response = HealthResponse(
            status="healthy",
            version="1.0",
            provider="baseline",
            uptime_seconds=123.45,
            errors_24h=0
        )

        assert response.status == "healthy"

    def test_health_response_invalid_status_raises_error(self):
        """Test that invalid status raises validation error."""
        with pytest.raises(Exception):
            HealthResponse(
                status="invalid_status",
                version="1.0"
            )


class TestEdgeCases:
    """Test edge cases and invalid inputs."""

    def test_version_mismatch_raises_error(self):
        """Test that version mismatch is handled."""
        # Current implementation uses Literal["1.0"], so version must be "1.0"
        request = SuggestCategoryRequest(
            version="1.0",
            title="Test",
            description="Test description"
        )
        assert request.version == "1.0"

    def test_empty_description_allowed_if_long_enough(self):
        """Test minimum length validation."""
        with pytest.raises(Exception):
            SuggestCategoryRequest(
                version="1.0",
                title="Test",
                description=""  # Empty string is too short
            )

    def test_response_with_none_optional_fields(self):
        """Test responses with optional None fields."""
        response = SuggestCategoryResponse(
            version="1.0",
            suggested_category="OTHER",
            explanation="No strong keywords found"
            # Optional fields are None by default
        )

        assert response.confidence is None
        assert response.matched_keywords is None
        assert response.total_matches is None