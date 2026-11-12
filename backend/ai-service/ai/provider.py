"""AI provider interface for RescueGrid AI."""

from abc import ABC, abstractmethod
from typing import Any


class AIProviderError(Exception):
    """Base exception for AI provider errors."""

    def __init__(self, message: str, provider: str | None = None):
        self.message = message
        self.provider = provider or "AIProvider"
        super().__init__(f"[{self.provider}] {message}")


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the provider name."""
        pass

    @property
    @abstractmethod
    def version(self) -> str:
        """Return the provider version."""
        pass

    @abstractmethod
    async def suggest_category(self, title: str, description: str) -> dict[str, Any]:
        """
        Suggest an incident category from text.

        Args:
            title: Incident title
            description: Incident description

        Returns:
            Dict with suggested_category, confidence (optional), explanation
        """
        pass

    @abstractmethod
    async def generate_summary(self, incident_data: dict[str, Any]) -> dict[str, Any]:
        """
        Generate a structured incident summary.

        Args:
            incident_data: Incident information dict

        Returns:
            Dict with summary, key_points, and estimated_impact
        """
        pass

    @abstractmethod
    async def score_priority(self, incident_data: dict[str, Any]) -> dict[str, Any]:
        """
        Recommend a priority score with factors.

        Args:
            incident_data: Incident information dict

        Returns:
            Dict with score (0-10), factors list, and confidence (optional)
        """
        pass

    @abstractmethod
    async def flag_missing_info(self, incident_data: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Identify missing or incomplete information.

        Args:
            incident_data: Incident information dict

        Returns:
            List of missing fields with severity and suggested verification
        """
        pass
