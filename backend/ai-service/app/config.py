
"""Configuration for AI service."""

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "rescuegrid-ai"
    service_version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8001
    workers: int = 1

    # AI provider settings
    ai_provider: str = "baseline"  # baseline or openrouter

    # OpenRouter settings
    openrouter_api_key: Optional[str] = None
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Fallback behavior
    ai_fallback_to_baseline: bool = True

    request_timeout: float = 30.0
    max_retries: int = 2
    retry_delay: float = 0.5
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout: float = 30.0

    log_level: str = "INFO"
    log_format: str = "json"

    model_config = SettingsConfigDict(
        env_prefix="AI_SERVICE_",
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
