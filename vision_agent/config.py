"""
Configuration management for Vision-Driven Web Agent.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


@dataclass
class BrowserConfig:
    """Browser-related configuration."""
    headless: bool = False
    viewport_width: int = 1280
    viewport_height: int = 800
    navigation_timeout: int = 30000  # milliseconds
    user_agent: Optional[str] = None


@dataclass
class LLMConfig:
    """LLM-related configuration."""
    provider: str = "anthropic"
    model: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None


@dataclass
class AgentConfig:
    """Agent behavior configuration."""
    max_steps: int = 50
    action_delay: float = 1.5  # seconds
    debug: bool = False
    save_llm_responses: bool = False


@dataclass
class OutputConfig:
    """Output-related configuration."""
    output_dir: Path = field(default_factory=lambda: Path("./output"))
    screenshot_format: str = "png"
    generate_report: bool = True


@dataclass
class Config:
    """Complete configuration for the Vision-Driven Web Agent."""
    browser: BrowserConfig = field(default_factory=BrowserConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    agent: AgentConfig = field(default_factory=AgentConfig)
    output: OutputConfig = field(default_factory=OutputConfig)

    @classmethod
    def from_env(cls, env_file: Optional[str] = None) -> "Config":
        """
        Load configuration from environment variables.

        Args:
            env_file: Optional path to .env file

        Returns:
            Config object with values from environment
        """
        if env_file:
            load_dotenv(env_file)
        else:
            load_dotenv()

        return cls(
            browser=BrowserConfig(
                headless=os.getenv("HEADLESS", "false").lower() == "true",
                viewport_width=int(os.getenv("VIEWPORT_WIDTH", "1280")),
                viewport_height=int(os.getenv("VIEWPORT_HEIGHT", "800")),
                navigation_timeout=int(os.getenv("NAVIGATION_TIMEOUT", "30000")),
            ),
            llm=LLMConfig(
                provider=os.getenv("LLM_PROVIDER", "anthropic"),
                model=os.getenv("LLM_MODEL"),
                anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
                openai_api_key=os.getenv("OPENAI_API_KEY"),
            ),
            agent=AgentConfig(
                max_steps=int(os.getenv("MAX_STEPS", "50")),
                action_delay=float(os.getenv("ACTION_DELAY", "1500")) / 1000,
                debug=os.getenv("DEBUG", "false").lower() == "true",
                save_llm_responses=os.getenv("SAVE_LLM_RESPONSES", "false").lower() == "true",
            ),
            output=OutputConfig(
                output_dir=Path(os.getenv("OUTPUT_DIR", "./output")),
            ),
        )

    def validate(self) -> list[str]:
        """
        Validate configuration and return list of errors.

        Returns:
            List of error messages (empty if valid)
        """
        errors = []

        # Check API keys
        if self.llm.provider == "anthropic" and not self.llm.anthropic_api_key:
            if not self.llm.openai_api_key:
                errors.append("ANTHROPIC_API_KEY or OPENAI_API_KEY is required")
        elif self.llm.provider == "openai" and not self.llm.openai_api_key:
            if not self.llm.anthropic_api_key:
                errors.append("OPENAI_API_KEY or ANTHROPIC_API_KEY is required")

        # Validate viewport
        if self.browser.viewport_width < 800:
            errors.append("Viewport width should be at least 800 pixels")
        if self.browser.viewport_height < 600:
            errors.append("Viewport height should be at least 600 pixels")

        # Validate agent settings
        if self.agent.max_steps < 1:
            errors.append("max_steps must be at least 1")
        if self.agent.action_delay < 0:
            errors.append("action_delay cannot be negative")

        return errors


def get_default_config() -> Config:
    """Get configuration with default values."""
    return Config()


def load_config(env_file: Optional[str] = None) -> Config:
    """
    Load and validate configuration.

    Args:
        env_file: Optional path to .env file

    Returns:
        Validated Config object

    Raises:
        ValueError: If configuration is invalid
    """
    config = Config.from_env(env_file)
    errors = config.validate()

    if errors:
        raise ValueError(f"Configuration errors: {'; '.join(errors)}")

    return config
