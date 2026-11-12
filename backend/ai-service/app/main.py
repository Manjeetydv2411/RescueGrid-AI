"""FastAPI application for RescueGrid AI service."""

import time
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from ai.baseline import BaselineProvider
from ai.openrouter import OpenRouterProvider
from ai.provider import AIProvider, AIProviderError
from ai.types import (
    ErrorResponse,
    FlagMissingInfoRequest,
    FlagMissingInfoResponse,
    GenerateSummaryRequest,
    GenerateSummaryResponse,
    HealthResponse,
    ScorePriorityRequest,
    ScorePriorityResponse,
    SuggestCategoryRequest,
    SuggestCategoryResponse,
)
from app.config import settings
from app.logging import logger

# Global state
_provider: AIProvider | None = None
_start_time: float = 0
_error_count_24h: int = 0



def get_provider() -> AIProvider:
    """Get or create the configured AI provider."""
    global _provider

    if _provider is not None:
        return _provider

    if settings.ai_provider == "baseline":
        _provider = BaselineProvider()

    elif settings.ai_provider == "openrouter":
        if not settings.openrouter_api_key:
            raise AIProviderError(
                "OpenRouter API key is not configured.",
                provider="openrouter",
            )

        _provider = OpenRouterProvider()

    else:
        raise AIProviderError(
            f"Unsupported AI provider: {settings.ai_provider}",
        )

    return _provider



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    global _start_time, _error_count_24h
    _start_time = time.time()
    _error_count_24h = 0

    logger.info(
        f"Starting {settings.service_name} v{settings.service_version}",
        extra={"provider": settings.ai_provider}
    )

    yield

    logger.info(f"Shutting down {settings.service_name}")


app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description="AI-assisted incident intelligence for RescueGrid AI emergency response platform",
    lifespan=lifespan,
)


@app.exception_handler(AIProviderError)
async def ai_provider_exception_handler(request: Request, exc: AIProviderError):
    """Handle AI provider exceptions."""
    global _error_count_24h
    _error_count_24h += 1

    logger.error(
        f"AI provider error: {exc.message}",
        extra={"provider": exc.provider, "request_id": getattr(request.state, "request_id", None)}
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": exc.message,
            "code": "AI_PROVIDER_ERROR",
            "provider": exc.provider,
            "timestamp": str(time.time()),
        },
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    """Handle Pydantic validation errors."""
    global _error_count_24h
    _error_count_24h += 1

    logger.error(
        f"Validation error: {str(exc)}",
        extra={
            "errors": exc.errors(),
            "request_id": getattr(request.state, "request_id", None)
        }
    )

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "Validation failed",
            "code": "VALIDATION_ERROR",
            "details": exc.errors(),
            "timestamp": str(time.time()),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    global _error_count_24h
    _error_count_24h += 1

    logger.error(
        f"Unexpected error: {str(exc)}",
        extra={
            "traceback": traceback.format_exc(),
            "request_id": getattr(request.state, "request_id", None)
        }
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "code": "INTERNAL_ERROR",
            "timestamp": str(time.time()),
        },
    )


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request ID to all requests."""
    request_id = f"req_{int(time.time() * 1000)}"
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Health check endpoints
@app.get("/health/live", response_model=HealthResponse)
async def health_live():
    """Liveness probe - confirms service is running."""
    return HealthResponse(
        status="healthy",
        version=settings.service_version,
        provider=settings.ai_provider if _provider else None,
        uptime_seconds=time.time() - _start_time,
        errors_24h=_error_count_24h,
    )


@app.get("/health/ready", response_model=HealthResponse)
async def health_ready():
    """Readiness probe - confirms service is ready to receive traffic."""
    try:
        provider = get_provider()
        return HealthResponse(
            status="healthy",
            version=settings.service_version,
            provider=provider.name,
            uptime_seconds=time.time() - _start_time,
            errors_24h=_error_count_24h,
        )
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            version=settings.service_version,
            errors_24h=_error_count_24h,
        )


@app.get("/ai/health", response_model=HealthResponse)
async def ai_health():
    """AI service health check."""
    try:
        provider = get_provider()
        return HealthResponse(
            status="healthy",
            version=settings.service_version,
            provider=provider.name,
            uptime_seconds=time.time() - _start_time,
            errors_24h=_error_count_24h,
        )
    except Exception as e:
        logger.error(f"AI health check failed: {e}")
        return HealthResponse(
            status="degraded",
            version=settings.service_version,
            errors_24h=_error_count_24h,
        )


# AI endpoints
@app.post("/v1/category-suggestion", response_model=SuggestCategoryResponse)
async def suggest_category(request: SuggestCategoryRequest):
    """
    Suggest an incident category from textual description.

    Returns suggested category with explanation and matched keywords.
    """
    provider = get_provider()
    logger.info("Processing category suggestion request")

    result = await provider.suggest_category(request.title, request.description)

    return SuggestCategoryResponse(
        version=request.version,
        suggested_category=result["suggested_category"],
        confidence=None,  # Not meaningful for rule-based baseline
        explanation=result["explanation"],
        matched_keywords=result.get("matched_keywords"),
        total_matches=result.get("total_matches"),
    )


@app.post("/v1/summary", response_model=GenerateSummaryResponse)
async def generate_summary(request: GenerateSummaryRequest):
    """
    Generate a structured incident summary from data.

    Extracts key facts and estimates impact based on incident details.
    """
    provider = get_provider()
    logger.info("Processing summary generation request")

    result = await provider.generate_summary(request.incident_data)

    return GenerateSummaryResponse(
        version=request.version,
        summary=result["summary"],
        key_points=result["key_points"],
        estimated_impact=result["estimated_impact"],
    )


@app.post("/v1/priority-score", response_model=ScorePriorityResponse)
async def score_priority(request: ScorePriorityRequest):
    """
    Recommend a priority score (0-10) with contributing factors.

    Score is calculated based on severity, category, and keyword indicators.
    """
    provider = get_provider()
    logger.info("Processing priority scoring request")

    result = await provider.score_priority(request.incident_data)

    return ScorePriorityResponse(
        version=request.version,
        score=result["score"],
        factors=result["factors"],
        max_score=result["max_score"],
        confidence=None,  # Not meaningful for rule-based baseline
    )


@app.post("/v1/missing-info", response_model=FlagMissingInfoResponse)
async def flag_missing_info(request: FlagMissingInfoRequest):
    """
    Identify missing or incomplete information that needs verification.

    Returns list of fields needing attention with verification suggestions.
    """
    logger.info("Processing missing info flagging request")

    result = await BaselineProvider().flag_missing_info(
        request.incident_data
    )

    return FlagMissingInfoResponse(
        version=request.version,
        missing_fields=result,
    )


# API root
@app.get("/")
async def root():
    """API root with version info."""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "provider": settings.ai_provider,
        "endpoints": [
            "/health/live",
            "/health/ready",
            "/ai/health",
            "/v1/category-suggestion",
            "/v1/summary",
            "/v1/priority-score",
            "/v1/missing-info",
        ],
    }
