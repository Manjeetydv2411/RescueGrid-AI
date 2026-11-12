"""Tests for AI provider interface."""

import pytest

from ai.baseline import BaselineProvider
from ai.provider import AIProvider, AIProviderError


class TestProviderInterface:
    """Test AI provider abstract interface."""

    def test_baseline_provider_has_required_properties(self):
        """Test that baseline provider implements required properties."""
        provider = BaselineProvider()

        assert provider.name == "baseline"
        assert provider.version == "1.0"

    @pytest.mark.asyncio
    async def test_baseline_suggest_category_with_valid_input(self):
        """Test category suggestion with valid inputs."""
        provider = BaselineProvider()

        result = await provider.suggest_category(
            "House Fire",
            "A house is burning with smoke visible from miles away"
        )

        assert "suggested_category" in result
        assert result["suggested_category"] == "FIRE"
        assert "explanation" in result

    @pytest.mark.asyncio
    async def test_baseline_suggest_category_empty_input_raises_error(self):
        """Test that empty input raises AIProviderError."""
        provider = BaselineProvider()

        with pytest.raises(AIProviderError, match="Title and description are required"):
            await provider.suggest_category("", "Some description")

        with pytest.raises(AIProviderError, match="Title and description are required"):
            await provider.suggest_category("Title", "")

    @pytest.mark.asyncio
    async def test_baseline_generate_summary_missing_fields_raises_error(self):
        """Test that missing required fields raises error."""
        provider = BaselineProvider()

        with pytest.raises(AIProviderError, match="Missing required fields"):
            await provider.generate_summary({})

    @pytest.mark.asyncio
    async def test_baseline_score_priority_missing_fields_raises_error(self):
        """Test that missing required fields raises error."""
        provider = BaselineProvider()

        with pytest.raises(AIProviderError, match="Missing required fields"):
            await provider.score_priority({})

    @pytest.mark.asyncio
    async def test_baseline_flag_missing_info_returns_list(self):
        """Test that flag_missing_info returns a list."""
        provider = BaselineProvider()

        result = await provider.flag_missing_info({})

        assert isinstance(result, list)
        assert len(result) > 0
        assert all(isinstance(item, dict) for item in result)


class TestBaselineProvider:
    """Test baseline provider specific functionality."""

    @pytest.mark.asyncio
    async def test_category_keyword_matching_flood(self):
        """Test category matching for flood keywords."""
        provider = BaselineProvider()

        result = await provider.suggest_category(
            "Flash Flood",
            "River has overflowed and streets are underwater"
        )

        assert result["suggested_category"] == "FLOOD"
        assert result["total_matches"] > 0

    @pytest.mark.asyncio
    async def test_category_keyword_matching_earthquake(self):
        """Test category matching for earthquake keywords."""
        provider = BaselineProvider()

        result = await provider.suggest_category(
            "Earthquake Alert",
            "Strong tremors felt across the region"
        )

        assert result["suggested_category"] == "EARTHQUAKE"

    @pytest.mark.asyncio
    async def test_category_keyword_matching_medical(self):
        """Test category matching for medical keywords."""
        provider = BaselineProvider()

        result = await provider.suggest_category(
            "Emergency Medical",
            "Multiple patients require immediate hospital transport"
        )

        assert result["suggested_category"] == "MEDICAL"

    @pytest.mark.asyncio
    async def test_priority_scoring_with_high_severity(self):
        """Test priority scoring for high severity incidents."""
        provider = BaselineProvider()

        incident_data = {
            "severity": "CRITICAL",
            "category": "FIRE",
            "title": "Major Wildfire Threatening Residential Area",
            "description": "Large fire spreading rapidly towards homes"
        }

        result = await provider.score_priority(incident_data)

        assert result["score"] > 7
        assert result["score"] <= 10
        assert isinstance(result["factors"], list)

    @pytest.mark.asyncio
    async def test_priority_scoring_with_low_severity(self):
        """Test priority scoring for low severity incidents."""
        provider = BaselineProvider()

        incident_data = {
            "severity": "LOW",
            "category": "OTHER",
            "title": "Minor Road Closure",
            "description": "Small pothole requiring repair"
        }

        result = await provider.score_priority(incident_data)

        assert result["score"] <= 4

    @pytest.mark.asyncio
    async def test_missing_info_detection(self):
        """Test that missing fields are detected."""
        provider = BaselineProvider()

        result = await provider.flag_missing_info({})

        # Should detect all required fields as missing
        field_names = [item["field"] for item in result]
        assert "title" in field_names
        assert "description" in field_names
        assert "location" in field_names

    @pytest.mark.asyncio
    async def test_location_incomplete_detection(self):
        """Test that incomplete location data is detected."""
        provider = BaselineProvider()

        result = await provider.flag_missing_info({
            "title": "Test",
            "description": "Test",
            "location": {"type": "Point"}
            # Missing coordinates
        })

        field_names = [item["field"] for item in result]
        assert "location.coordinates" in field_names

    @pytest.mark.asyncio
    async def test_summary_generation(self):
        """Test summary generation with valid data."""
        provider = BaselineProvider()

        incident_data = {
            "title": "Flood Emergency",
            "description": "Severe flooding in downtown area with multiple reports of submerged vehicles",
            "severity": "HIGH",
            "category": "FLOOD",
            "location": {"type": "Point", "coordinates": [-122.4194, 37.7749]}
        }

        result = await provider.generate_summary(incident_data)

        assert "summary" in result
        assert "key_points" in result
        assert "estimated_impact" in result
        assert len(result["key_points"]) > 0