"""AI-assisted incident intelligence module for RescueGrid AI."""

from .provider import AIProvider, AIProviderError
from .baseline import BaselineProvider
from .types import (
    SuggestCategoryRequest,
    SuggestCategoryResponse,
    GenerateSummaryRequest,
    GenerateSummaryResponse,
    ScorePriorityRequest,
    ScorePriorityResponse,
    FlagMissingInfoRequest,
    FlagMissingInfoResponse,
)

__all__ = [
    "AIProvider",
    "AIProviderError",
    "BaselineProvider",
    "SuggestCategoryRequest",
    "SuggestCategoryResponse",
    "GenerateSummaryRequest",
    "GenerateSummaryResponse",
    "ScorePriorityRequest",
    "ScorePriorityResponse",
    "FlagMissingInfoRequest",
    "FlagMissingInfoResponse",
]
