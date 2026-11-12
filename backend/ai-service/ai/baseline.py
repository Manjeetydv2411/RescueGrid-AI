"""Transparent baseline AI implementation for RescueGrid AI.

This module provides rule-based, keyword-driven AI features without external dependencies.
Fully auditable and explainable - no model training required.
"""

import re
from typing import Any

from .provider import AIProvider, AIProviderError

# Category keywords mapping
CATEGORY_KEYWORDS = {
    "FLOOD": [
        "flood", "flooding", "overflow", "water", "river", "dam", "rain",
        "submerged", "drown", "deluge", "drainage", "storm surge", "tsunami",
        "flash flood", " inundation", "overflowing"
    ],
    "FIRE": [
        "fire", "flame", "burning", "combustion", "smoke", "wildfire",
        "blaze", "ignition", "firefighter", "burned", "ash", "smoldering",
        "fire department", "extinguish", "conflagration", "prescribed burn"
    ],
    "EARTHQUAKE": [
        "earthquake", "seismic", "tremor", "quake", "fault line", "aftershock",
        "seismograph", "tectonic", "epicenter", "richter", "subduction", "plate",
        "shockwave", "landslide", "liquefaction"
    ],
    "LANDSLIDE": [
        "landslide", "mudslide", "rockfall", "debris flow", "avalanche",
        "slumping", "ground movement", "slope failure", "eruption", "volcanic",
        "subsidence", "land slip", "mud flow", "rockslide"
    ],
    "MEDICAL": [
        "medical", "injury", "hospital", "ambulance", "patient", "emergency",
        "doctor", "nurse", "critical", "trauma", "cardiac", "respiratory",
        "bleeding", "choking", "overdose", "diabetic", "allergic reaction"
    ],
    "OTHER": [
        "other", "uncategorized", "unknown", "general", "miscellaneous",
        "undefined", "unspecified"
    ],
}

# Priority weight factors
SEVERITY_WEIGHTS = {
    "CRITICAL": 4.0,
    "HIGH": 3.0,
    "MEDIUM": 2.0,
    "LOW": 1.0,
}

CATEGORY_PRIORITY_MULTIPLIERS = {
    "FLOOD": 1.1,
    "FIRE": 1.2,
    "EARTHQUAKE": 1.3,
    "LANDSLIDE": 1.2,
    "MEDICAL": 0.9,
    "OTHER": 1.0,
}


class BaselineProvider(AIProvider):
    """Rule-based baseline AI provider."""

    @property
    def name(self) -> str:
        return "baseline"

    @property
    def version(self) -> str:
        return "1.0"

    def _count_keyword_matches(self, text: str, category: str) -> int:
        """Count keyword matches for a category in text."""
        keywords = CATEGORY_KEYWORDS.get(category, [])
        count = 0
        text_lower = text.lower()
        for keyword in keywords:
            # Count occurrences using regex word boundaries
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            count += len(re.findall(pattern, text_lower))
        return count

    def _find_best_category(self, title: str, description: str) -> tuple[str, int]:
        """Find the category with highest keyword match count."""
        text = f"{title} {description}"
        best_category = "OTHER"
        best_count = 0

        for category in CATEGORY_KEYWORDS.keys():
            count = self._count_keyword_matches(text, category)
            if count > best_count:
                best_count = count
                best_category = category

        return best_category, best_count

    async def suggest_category(self, title: str, description: str) -> dict[str, Any]:
        """
        Suggest incident category using keyword matching.

        Returns:
            {
                "suggested_category": str,
                "explanation": str,
                "matched_keywords": list[str],
                "total_matches": int
            }
        """
        if not title or not description:
            raise AIProviderError(
                "Title and description are required",
                provider=self.name
            )

        suggested, match_count = self._find_best_category(title, description)

        # Find the matched keywords for explanation
        text = f"{title} {description}"
        matched_keywords = []
        for keyword in CATEGORY_KEYWORDS.get(suggested, []):
            if re.search(r'\b' + re.escape(keyword.lower()) + r'\b', text.lower()):
                matched_keywords.append(keyword)

        explanation = (
            f"Category '{suggested}' suggested based on {len(matched_keywords)} "
            f"keyword match(es) in incident description."
        )

        return {
            "suggested_category": suggested,
            "explanation": explanation,
            "matched_keywords": matched_keywords,
            "total_matches": match_count,
        }

    async def generate_summary(self, incident_data: dict[str, Any]) -> dict[str, Any]:
        """
        Generate structured incident summary from data.

        Returns:
            {
                "summary": str,
                "key_points": list[str],
                "estimated_impact": str
            }
        """
        required_fields = ["title", "description", "severity", "category"]
        missing = [f for f in required_fields if f not in incident_data]
        if missing:
            raise AIProviderError(
                f"Missing required fields: {', '.join(missing)}",
                provider=self.name
            )

        title = incident_data["title"]
        description = incident_data["description"]
        severity = incident_data["severity"]
        category = incident_data["category"]

        # Extract key facts from description
        key_points = []

        # Check for location indicators
        if "location" in incident_data:
            loc = incident_data["location"]
            if isinstance(loc, dict) and "coordinates" in loc:
                coords = loc["coordinates"]
                if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                    key_points.append(f"Location: {coords[0]:.4f}, {coords[1]:.4f}")

        # Extract severity note
        key_points.append(f"Severity: {severity}")

        # Extract category note
        key_points.append(f"Category: {category}")

        # Create summary based on available data
        summary = (
            f"Emergency incident reported: {title}. "
            f"A {severity} severity {category} incident requiring immediate attention. "
            f"Details: {description[:200]}{'...' if len(description) > 200 else ''}"
        )

        # Estimate impact based on category and severity
        impact_factors = []
        if category in ["FLOOD", "LANDSLIDE"]:
            impact_factors.append("Potential widespread area impact")
        if category == "FIRE":
            impact_factors.append("Risk of property damage")
        if category == "MEDICAL":
            impact_factors.append("Human health emergency")
        if severity in ["CRITICAL", "HIGH"]:
            impact_factors.append("High resource demand expected")

        estimated_impact = (
            f"Moderate impact expected. "
            f"{' '.join(impact_factors) if impact_factors else 'Standard response required'}."
        )

        return {
            "summary": summary,
            "key_points": key_points,
            "estimated_impact": estimated_impact,
        }

    async def score_priority(self, incident_data: dict[str, Any]) -> dict[str, Any]:
        """
        Score priority (0-10) based on severity, category, and keyword indicators.

        Returns:
            {
                "score": int,
                "factors": list[str],
                "max_score": 10,
                "category_multiplier": float
            }
        """
        required_fields = ["severity", "category"]
        missing = [f for f in required_fields if f not in incident_data]
        if missing:
            raise AIProviderError(
                f"Missing required fields: {', '.join(missing)}",
                provider=self.name
            )

        severity = incident_data["severity"]
        category = incident_data["category"]
        title = incident_data.get("title", "")
        description = incident_data.get("description", "")

        # Base score from severity
        base_score = SEVERITY_WEIGHTS.get(severity, 1.0)

        # Category multiplier
        multiplier = CATEGORY_PRIORITY_MULTIPLIERS.get(category, 1.0)

        # Calculate raw score
        raw_score = base_score * multiplier * 10 / 4  # Normalize to ~10 max

        # Add factors
        factors = [f"Severity weight: {base_score}"]
        factors.append(f"Category multiplier: {multiplier} ({category})")

        # Add keyword-based factors
        text = f"{title} {description}"
        high_priority_keywords = [
            "multiple", "many", "dozens", "hundreds", "critical condition",
            "trapped", "under debris", "life-threatening", "evacuation",
            "emergency services", "rescue operation", "stranded"
        ]

        found_keywords = []
        for kw in high_priority_keywords:
            if kw.lower() in text.lower():
                found_keywords.append(kw)

        if found_keywords:
            raw_score += min(len(found_keywords) * 0.5, 2.0)  # Cap at +2
            factors.append(f"High-priority keywords found: {', '.join(found_keywords[:3])}")

        # Final score capped at 10
        final_score = min(round(raw_score), 10)

        return {
            "score": final_score,
            "factors": factors,
            "max_score": 10,
            "category_multiplier": multiplier,
        }

    async def flag_missing_info(self, incident_data: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Identify missing or incomplete information that needs verification.

        Returns:
            List of dicts with field, severity, and verification_suggestion
        """
        missing_info = []

        # Required fields for incident reporting
        required_fields = {
            "title": ("short", "A descriptive title helps responders understand the incident"),
            "description": ("long", "Detailed description guides response planning"),
            "location": ("required", "Exact location determines response resources"),
            "severity": ("required", "Severity level sets priority for response"),
            "category": ("required", "Category helps deploy appropriate resources"),
        }

        for field, (field_type, suggestion) in required_fields.items():
            if field not in incident_data or not incident_data[field]:
                severity = "high" if field_type in ["required", "location"] else "medium"
                missing_info.append({
                    "field": field,
                    "severity": severity,
                    "verification_suggestion": suggestion,
                })

        # Check for location completeness
        if "location" in incident_data and incident_data["location"]:
            loc = incident_data["location"]
            if isinstance(loc, dict):
                if "type" not in loc and "coordinates" in loc:
                    missing_info.append({
                        "field": "location.type",
                        "severity": "medium",
                        "verification_suggestion": "Add location type (e.g., Point) for geospatial indexing",
                    })
                if "coordinates" not in loc and "type" in loc:
                    missing_info.append({
                        "field": "location.coordinates",
                        "severity": "high",
                        "verification_suggestion": "Provide coordinates for accurate location mapping",
                    })

        # Check for address completeness
        if "address" in incident_data and incident_data["address"]:
            addr = str(incident_data["address"])
            if len(addr) < 5:
                missing_info.append({
                    "field": "address",
                    "severity": "medium",
                    "verification_suggestion": "Address seems incomplete - add more specific details",
                })

        # Check tags for useful categorization
        if "tags" not in incident_data or not incident_data.get("tags"):
            missing_info.append({
                "field": "tags",
                "severity": "low",
                "verification_suggestion": "Add tags like 'urban', 'rural', 'coastal' for better filtering",
            })

        return missing_info
