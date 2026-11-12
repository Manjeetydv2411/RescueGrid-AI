
"""OpenRouter-powered LLM provider for RescueGrid AI."""

import json
from typing import Any

import httpx

from ai.provider import AIProvider, AIProviderError
from app.config import settings


class OpenRouterProvider(AIProvider):
    """LLM provider using OpenRouter's OpenAI-compatible API."""

    CATEGORIES = [
        "FLOOD",
        "FIRE",
        "EARTHQUAKE",
        "LANDSLIDE",
        "MEDICAL",
        "OTHER",
    ]

    @property
    def name(self) -> str:
        return "openrouter"

    @property
    def version(self) -> str:
        return "1.0"

    async def _generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, Any]:
        if not settings.openrouter_api_key:
            raise AIProviderError(
                "OpenRouter API key is not configured.",
                provider=self.name,
            )

        payload = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://rescuegrid.ai",
            "X-Title": "RescueGrid AI",
        }

        try:
            async with httpx.AsyncClient(
                timeout=settings.request_timeout
            ) as client:
                response = await client.post(
                    f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
                    headers=headers,
                    json=payload,
                )

            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            if not isinstance(content, str) or not content.strip():
                raise ValueError("Model returned empty content")

            result = json.loads(content)

            if not isinstance(result, dict):
                raise ValueError("Model response must be a JSON object")

            return result

        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise AIProviderError(
                f"OpenRouter request failed: {type(exc).__name__}: {exc}",
                provider=self.name,
            ) from exc

    async def suggest_category(
        self,
        title: str,
        description: str,
    ) -> dict[str, Any]:
        result = await self._generate_json(
            (
                "You classify emergency incidents. "
                "Return only a JSON object with suggested_category and explanation. "
                "suggested_category must be one of: "
                + ", ".join(self.CATEGORIES)
                + ". Never invent facts."
            ),
            json.dumps({"title": title, "description": description}),
        )

        category = str(result.get("suggested_category", "")).upper()
        if category not in self.CATEGORIES:
            raise AIProviderError(
                "Model returned an invalid incident category.",
                provider=self.name,
            )

        explanation = result.get("explanation")
        if not isinstance(explanation, str) or not explanation.strip():
            raise AIProviderError(
                "Model returned an invalid category explanation.",
                provider=self.name,
            )

        return {
            "suggested_category": category,
            "explanation": explanation,
            "matched_keywords": [],
            "total_matches": 0,
        }

    async def generate_summary(
        self,
        incident_data: dict[str, Any],
    ) -> dict[str, Any]:
        result = await self._generate_json(
            (
                "You are an emergency incident analyst. "
                "Create a concise factual incident summary. "
                "Return JSON with summary (string), key_points (array of strings), "
                "and estimated_impact (string). "
                "Do not invent casualty counts, locations, or damage estimates. "
                "Clearly distinguish known facts from uncertainty."
            ),
            json.dumps(incident_data, default=str),
        )

        summary = result.get("summary")
        key_points = result.get("key_points")
        impact = result.get("estimated_impact")

        if (
            not isinstance(summary, str)
            or not summary.strip()
            or not isinstance(key_points, list)
            or not all(isinstance(item, str) for item in key_points)
            or not isinstance(impact, str)
            or not impact.strip()
        ):
            raise AIProviderError(
                "Model returned an invalid summary structure.",
                provider=self.name,
            )

        return {
            "summary": summary,
            "key_points": key_points,
            "estimated_impact": impact,
        }

    async def score_priority(
        self,
        incident_data: dict[str, Any],
    ) -> dict[str, Any]:
        result = await self._generate_json(
            (
                "You are an emergency response triage assistant. "
                "Recommend a priority score from 0 to 10 using only the supplied facts. "
                "Return JSON with score (integer 0-10) and factors (array of strings). "
                "Higher scores mean greater urgency. "
                "Do not replace professional emergency-dispatch judgment."
            ),
            json.dumps(incident_data, default=str),
        )

        score = result.get("score")
        factors = result.get("factors")

        if (
            isinstance(score, bool)
            or not isinstance(score, int)
            or not 0 <= score <= 10
            or not isinstance(factors, list)
            or not all(isinstance(item, str) for item in factors)
        ):
            raise AIProviderError(
                "Model returned an invalid priority score.",
                provider=self.name,
            )

        return {
            "score": score,
            "factors": factors,
            "max_score": 10,
        }

    async def flag_missing_info(
        self,
        incident_data: dict[str, Any],
    ) -> list[dict[str, Any]]:
        raise AIProviderError(
            "Missing-information checks use deterministic baseline rules.",
            provider=self.name,
        )
