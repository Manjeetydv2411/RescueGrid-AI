"""Integration tests for AI service endpoints."""

import pytest
from httpx import AsyncClient

pytest.importorskip("fastapi")
pytest.importorskip("httpx")


# Mock app fixture
@pytest.fixture
def app():
    """Import and return the FastAPI app."""
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from app.main import app
    return app


@pytest.mark.asyncio
async def test_health_live_endpoint(app):
    """Test the /health/live endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health/live")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "uptime_seconds" in data


@pytest.mark.asyncio
async def test_health_ready_endpoint(app):
    """Test the /health/ready endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health/ready")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["provider"] == "baseline"


@pytest.mark.asyncio
async def test_ai_health_endpoint(app):
    """Test the /ai/health endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/ai/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["provider"] == "baseline"


@pytest.mark.asyncio
async def test_category_suggestion_endpoint(app):
    """Test the /v1/category-suggestion endpoint."""
    payload = {
        "version": "1.0",
        "title": "House Fire",
        "description": "Building is burning with smoke visible from miles away"
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/category-suggestion", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0"
    assert data["suggested_category"] == "FIRE"
    assert "explanation" in data


@pytest.mark.asyncio
async def test_category_suggestion_validation_error(app):
    """Test that validation errors return 400."""
    payload = {
        "version": "1.0",
        "title": "",
        "description": ""
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/category-suggestion", json=payload)

    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert "VALIDATION_ERROR" in data["code"]


@pytest.mark.asyncio
async def test_summary_generation_endpoint(app):
    """Test the /v1/summary endpoint."""
    payload = {
        "version": "1.0",
        "incident_data": {
            "title": "Flood Emergency",
            "description": "Severe flooding in downtown area",
            "severity": "HIGH",
            "category": "FLOOD"
        }
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/summary", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0"
    assert "summary" in data
    assert "key_points" in data


@pytest.mark.asyncio
async def test_priority_score_endpoint(app):
    """Test the /v1/priority-score endpoint."""
    payload = {
        "version": "1.0",
        "incident_data": {
            "severity": "CRITICAL",
            "category": "EARTHQUAKE",
            "title": "Major Earthquake",
            "description": "Strong tremors across the region"
        }
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/priority-score", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0"
    assert 0 <= data["score"] <= 10
    assert "factors" in data


@pytest.mark.asyncio
async def test_missing_info_endpoint(app):
    """Test the /v1/missing-info endpoint."""
    payload = {
        "version": "1.0",
        "incident_data": {
            "title": "Test",
            "description": "Test"
        }
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/missing-info", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "1.0"
    assert isinstance(data["missing_fields"], list)
    assert len(data["missing_fields"]) > 0


@pytest.mark.asyncio
async def test_root_endpoint(app):
    """Test the root endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "rescuegrid-ai"
    assert "version" in data
    assert "endpoints" in data


# Adversarial tests
@pytest.mark.asyncio
async def test_category_suggestion_with_injection_attempts(app):
    """Test that SQL injection attempts are handled."""
    payload = {
        "version": "1.0",
        "title": "Test'; DROP TABLE users; --",
        "description": "Normal description text"
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/category-suggestion", json=payload)

    # Should not raise an error, but should handle gracefully
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_category_suggestion_with_special_characters(app):
    """Test handling of special characters."""
    payload = {
        "version": "1.0",
        "title": "Test🔥Emoji🔥Incident",
        "description": "Description with special chars: 🌊🚗💥"
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/category-suggestion", json=payload)

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_category_suggestion_with_unicode(app):
    """Test handling of unicode characters."""
    payload = {
        "version": "1.0",
        "title": "Tëst Ýncidënt",
        "description": "Dëscriptiön withe unicöde"
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/category-suggestion", json=payload)

    assert response.status_code == 200