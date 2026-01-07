"""
Vision-Driven Web Agent

A Python toolkit for autonomously navigating telehealth intake funnels
using vision-based AI analysis.
"""

from .agent import (
    FunnelWalker,
    VisionAnalyzer,
    BrowserController,
    LLMProvider,
    ActionType,
    AgentAction,
    StepResult,
    FunnelReport,
)

__version__ = "1.0.0"
__all__ = [
    "FunnelWalker",
    "VisionAnalyzer",
    "BrowserController",
    "LLMProvider",
    "ActionType",
    "AgentAction",
    "StepResult",
    "FunnelReport",
]
