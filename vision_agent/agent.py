"""
Vision-Driven Web Agent for Telehealth Funnel Navigation

This module contains the FunnelWalker class that uses vision-based LLM analysis
to autonomously navigate multi-step intake forms and quizzes.
"""

import base64
import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from PIL import Image
from playwright.sync_api import Page, sync_playwright, Browser, BrowserContext
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

# LLM Clients
import anthropic
import openai

console = Console()


class LLMProvider(Enum):
    """Supported LLM providers for vision analysis."""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"


class ActionType(Enum):
    """Types of actions the agent can perform."""
    CLICK = "click"
    TYPE = "type"
    SCROLL = "scroll"
    WAIT = "wait"
    CLOSE_POPUP = "close_popup"
    TERMINATE = "terminate"


@dataclass
class AgentAction:
    """Represents an action to be performed by the agent."""
    action_type: ActionType
    analysis: str
    element_description: str
    coordinates: Optional[tuple[int, int]] = None
    text_to_type: Optional[str] = None
    confidence: float = 0.0
    raw_response: Optional[dict] = None


@dataclass
class StepResult:
    """Result of a single navigation step."""
    step_number: int
    timestamp: datetime
    screenshot_path: str
    action: AgentAction
    success: bool
    error_message: Optional[str] = None
    page_url: str = ""
    page_title: str = ""


@dataclass
class FunnelReport:
    """Final report of the funnel walkthrough."""
    start_url: str
    user_persona: dict
    steps: list[StepResult] = field(default_factory=list)
    final_price: Optional[str] = None
    friction_points: list[str] = field(default_factory=list)
    completed: bool = False
    error: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class VisionAnalyzer:
    """Handles LLM-based vision analysis of screenshots."""

    SYSTEM_PROMPT = """You are an expert web navigation agent specializing in medical intake forms and telehealth quizzes.
Your task is to analyze screenshots and determine the appropriate action to take.

You must respond with ONLY valid JSON in this exact format:
{
    "analysis": "Brief description of what the page is showing/asking",
    "action": "click|type|scroll|wait|close_popup|terminate",
    "element_description": "Description of the element to interact with",
    "coordinates": [x, y],
    "text_to_type": "text if action is type, otherwise null",
    "confidence": 0.95,
    "is_checkout": false,
    "detected_price": null,
    "is_popup_or_banner": false,
    "friction_point": null
}

Rules:
1. For click actions, provide pixel coordinates [x, y] of the CENTER of the element to click.
2. If you see a cookie banner, popup, or modal overlay, prioritize closing it first (action: "close_popup").
3. If this appears to be a checkout/payment page, set "is_checkout": true and extract any visible price to "detected_price".
4. If you detect any UX friction (confusing layout, hidden options, manipulative patterns), describe it in "friction_point".
5. Return action "terminate" when you've reached checkout, payment, or the flow is complete.
6. Coordinates should be based on the visible viewport - estimate the center of clickable elements.
7. If text input is required, use action "type" and provide "text_to_type".
8. If the page is loading or needs time, use action "wait".
9. Match persona attributes to questions being asked (age ranges, symptoms, gender, etc.)."""

    def __init__(
        self,
        provider: LLMProvider = LLMProvider.ANTHROPIC,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self.provider = provider

        if provider == LLMProvider.ANTHROPIC:
            self.model = model or "claude-3-5-sonnet-20241022"
            self.client = anthropic.Anthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))
        else:
            self.model = model or "gpt-4o"
            self.client = openai.OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64 for LLM API."""
        with open(image_path, "rb") as f:
            return base64.standard_b64encode(f.read()).decode("utf-8")

    def _build_user_prompt(self, persona: dict, step_number: int) -> str:
        """Build the user prompt with persona context."""
        persona_str = "\n".join([f"  - {k}: {v}" for k, v in persona.items()])
        return f"""You are navigating a medical intake form. Here is a screenshot of the current page (Step {step_number}).

The user persona is:
{persona_str}

Instructions:
1. Identify the question being asked or the current state of the page.
2. Select the option that best matches the persona above.
3. Return the coordinates of the button/element I should click.
4. If this is a checkout/payment page, return action "terminate".
5. If there's a popup or cookie banner blocking the view, close it first.

Respond with ONLY the JSON object, no other text."""

    def analyze_screenshot(
        self,
        screenshot_path: str,
        persona: dict,
        step_number: int,
    ) -> AgentAction:
        """Analyze a screenshot and determine the next action."""

        image_data = self._encode_image(screenshot_path)
        user_prompt = self._build_user_prompt(persona, step_number)

        try:
            if self.provider == LLMProvider.ANTHROPIC:
                response = self._analyze_with_anthropic(image_data, user_prompt)
            else:
                response = self._analyze_with_openai(image_data, user_prompt)

            return self._parse_response(response)

        except Exception as e:
            console.print(f"[red]Error analyzing screenshot: {e}[/red]")
            # Return a wait action on error
            return AgentAction(
                action_type=ActionType.WAIT,
                analysis=f"Error during analysis: {str(e)}",
                element_description="",
                confidence=0.0,
            )

    def _analyze_with_anthropic(self, image_data: str, user_prompt: str) -> dict:
        """Analyze using Anthropic Claude."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=self.SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": user_prompt,
                        },
                    ],
                }
            ],
        )

        response_text = message.content[0].text
        return self._extract_json(response_text)

    def _analyze_with_openai(self, image_data: str, user_prompt: str) -> dict:
        """Analyze using OpenAI GPT-4o."""
        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_data}",
                            },
                        },
                        {
                            "type": "text",
                            "text": user_prompt,
                        },
                    ],
                },
            ],
        )

        response_text = response.choices[0].message.content
        return self._extract_json(response_text)

    def _extract_json(self, text: str) -> dict:
        """Extract JSON from LLM response text."""
        # Try to find JSON in the response
        text = text.strip()

        # If the response starts with ```, extract content
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
            if match:
                text = match.group(1).strip()

        # Try to parse as JSON
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in text
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass

        # Return empty dict on failure
        console.print(f"[yellow]Warning: Could not parse JSON from response: {text[:200]}...[/yellow]")
        return {}

    def _parse_response(self, response: dict) -> AgentAction:
        """Parse LLM response into an AgentAction."""

        action_str = response.get("action", "wait").lower()

        try:
            action_type = ActionType(action_str)
        except ValueError:
            action_type = ActionType.WAIT

        # Check for termination conditions
        if response.get("is_checkout") or action_str == "terminate":
            action_type = ActionType.TERMINATE

        # Parse coordinates
        coords = response.get("coordinates")
        if coords and isinstance(coords, list) and len(coords) >= 2:
            coordinates = (int(coords[0]), int(coords[1]))
        else:
            coordinates = None

        return AgentAction(
            action_type=action_type,
            analysis=response.get("analysis", ""),
            element_description=response.get("element_description", ""),
            coordinates=coordinates,
            text_to_type=response.get("text_to_type"),
            confidence=response.get("confidence", 0.5),
            raw_response=response,
        )


class BrowserController:
    """Handles browser automation with stealth features."""

    def __init__(
        self,
        headless: bool = False,
        viewport_width: int = 1280,
        viewport_height: int = 800,
        user_agent: Optional[str] = None,
    ):
        self.headless = headless
        self.viewport_width = viewport_width
        self.viewport_height = viewport_height
        self.user_agent = user_agent or self._get_stealth_user_agent()

        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    def _get_stealth_user_agent(self) -> str:
        """Get a realistic user agent string."""
        try:
            from fake_useragent import UserAgent
            ua = UserAgent()
            return ua.chrome
        except Exception:
            # Fallback user agent
            return (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )

    def start(self) -> Page:
        """Start the browser and return the page object."""
        self._playwright = sync_playwright().start()

        # Launch browser with stealth settings
        self._browser = self._playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-position=0,0",
                f"--window-size={self.viewport_width},{self.viewport_height}",
            ],
        )

        # Create context with stealth settings
        self._context = self._browser.new_context(
            viewport={"width": self.viewport_width, "height": self.viewport_height},
            user_agent=self.user_agent,
            locale="en-US",
            timezone_id="America/New_York",
            permissions=["geolocation"],
            geolocation={"latitude": 40.7128, "longitude": -74.0060},  # NYC
            color_scheme="light",
        )

        # Add stealth scripts
        self._context.add_init_script("""
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32',
            });

            // Mock chrome runtime
            window.chrome = {
                runtime: {},
            };
        """)

        self._page = self._context.new_page()
        return self._page

    @property
    def page(self) -> Page:
        """Get the current page object."""
        if self._page is None:
            raise RuntimeError("Browser not started. Call start() first.")
        return self._page

    def navigate(self, url: str, timeout: int = 30000) -> None:
        """Navigate to a URL."""
        self.page.goto(url, timeout=timeout, wait_until="domcontentloaded")
        # Additional wait for dynamic content
        time.sleep(1)

    def screenshot(self, path: str) -> str:
        """Take a screenshot of the current viewport."""
        self.page.screenshot(path=path)
        return path

    def click_at(self, x: int, y: int) -> None:
        """Click at specific coordinates."""
        self.page.mouse.click(x, y)

    def type_text(self, text: str) -> None:
        """Type text (assumes an input is focused)."""
        self.page.keyboard.type(text, delay=50)

    def scroll(self, direction: str = "down", amount: int = 300) -> None:
        """Scroll the page."""
        if direction == "down":
            self.page.mouse.wheel(0, amount)
        else:
            self.page.mouse.wheel(0, -amount)

    def wait_for_stable(self, timeout: int = 5000) -> None:
        """Wait for the page to become stable (no network activity)."""
        try:
            self.page.wait_for_load_state("networkidle", timeout=timeout)
        except Exception:
            # Timeout is acceptable, page might have long-polling
            pass

    def get_page_info(self) -> tuple[str, str]:
        """Get current page URL and title."""
        return self.page.url, self.page.title()

    def close(self) -> None:
        """Close the browser."""
        if self._page:
            self._page.close()
        if self._context:
            self._context.close()
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()


class FunnelWalker:
    """
    Main class for navigating telehealth intake funnels using vision-based AI.

    This agent captures screenshots, analyzes them with an LLM, and performs
    actions to navigate through multi-step forms autonomously.
    """

    # Keywords that indicate we've reached the end of the funnel
    CHECKOUT_KEYWORDS = [
        "checkout", "payment", "pay now", "complete purchase",
        "order summary", "billing", "credit card", "card number",
        "place order", "submit order", "confirm order",
    ]

    def __init__(
        self,
        start_url: str,
        user_persona: dict[str, Any],
        output_dir: str = "./output",
        llm_provider: LLMProvider = LLMProvider.ANTHROPIC,
        llm_model: Optional[str] = None,
        headless: bool = False,
        max_steps: int = 50,
        action_delay: float = 1.5,
        debug: bool = False,
    ):
        """
        Initialize the FunnelWalker.

        Args:
            start_url: The URL to start navigating from.
            user_persona: Dictionary containing user attributes for form filling.
            output_dir: Directory to save screenshots and reports.
            llm_provider: Which LLM provider to use (Anthropic or OpenAI).
            llm_model: Specific model to use (defaults to provider's best).
            headless: Whether to run browser in headless mode.
            max_steps: Maximum steps before terminating (safety limit).
            action_delay: Delay between actions in seconds.
            debug: Enable verbose debug logging.
        """
        self.start_url = start_url
        self.user_persona = user_persona
        self.output_dir = Path(output_dir)
        self.max_steps = max_steps
        self.action_delay = action_delay
        self.debug = debug

        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Initialize components
        self.analyzer = VisionAnalyzer(provider=llm_provider, model=llm_model)
        self.browser = BrowserController(headless=headless)

        # State
        self.report = FunnelReport(
            start_url=start_url,
            user_persona=user_persona,
        )
        self.current_step = 0
        self._running = False

    def _log(self, message: str, style: str = "white") -> None:
        """Log a message to the console."""
        console.print(f"[{style}]{message}[/{style}]")

    def _log_thinking(self, action: AgentAction) -> None:
        """Log what the agent is thinking/doing."""
        table = Table(title=f"Step {self.current_step} - Agent Analysis", show_header=False)
        table.add_column("Field", style="cyan")
        table.add_column("Value", style="white")

        table.add_row("Analysis", action.analysis)
        table.add_row("Action", action.action_type.value)
        table.add_row("Target", action.element_description)
        if action.coordinates:
            table.add_row("Coordinates", f"({action.coordinates[0]}, {action.coordinates[1]})")
        table.add_row("Confidence", f"{action.confidence:.0%}")

        console.print(table)

    def _take_screenshot(self) -> str:
        """Take a screenshot and save it."""
        screenshot_path = self.output_dir / f"step_{self.current_step:02d}.png"
        self.browser.screenshot(str(screenshot_path))
        self._log(f"Screenshot saved: {screenshot_path.name}", "dim")
        return str(screenshot_path)

    def _check_for_checkout(self) -> bool:
        """Check if we've reached a checkout page based on page content."""
        try:
            page_text = self.browser.page.inner_text("body").lower()
            return any(keyword in page_text for keyword in self.CHECKOUT_KEYWORDS)
        except Exception:
            return False

    def _execute_action(self, action: AgentAction) -> bool:
        """Execute an action and return success status."""
        try:
            if action.action_type == ActionType.CLICK:
                if action.coordinates:
                    self._log(f"Clicking at ({action.coordinates[0]}, {action.coordinates[1]})", "green")
                    self.browser.click_at(*action.coordinates)
                else:
                    self._log("No coordinates provided for click action", "yellow")
                    return False

            elif action.action_type == ActionType.TYPE:
                if action.text_to_type:
                    self._log(f"Typing: {action.text_to_type}", "green")
                    self.browser.type_text(action.text_to_type)
                else:
                    self._log("No text provided for type action", "yellow")
                    return False

            elif action.action_type == ActionType.SCROLL:
                self._log("Scrolling page", "green")
                self.browser.scroll()

            elif action.action_type == ActionType.CLOSE_POPUP:
                if action.coordinates:
                    self._log(f"Closing popup at ({action.coordinates[0]}, {action.coordinates[1]})", "green")
                    self.browser.click_at(*action.coordinates)
                else:
                    # Try pressing Escape
                    self._log("Attempting to close popup with Escape key", "green")
                    self.browser.page.keyboard.press("Escape")

            elif action.action_type == ActionType.WAIT:
                self._log("Waiting for page to load...", "dim")
                self.browser.wait_for_stable()

            elif action.action_type == ActionType.TERMINATE:
                self._log("Termination signal received", "cyan")
                return True

            # Wait for action to take effect
            time.sleep(self.action_delay)
            self.browser.wait_for_stable(timeout=3000)

            return True

        except Exception as e:
            self._log(f"Error executing action: {e}", "red")
            return False

    def _record_step(self, screenshot_path: str, action: AgentAction, success: bool, error: Optional[str] = None) -> None:
        """Record a step result."""
        url, title = self.browser.get_page_info()

        step_result = StepResult(
            step_number=self.current_step,
            timestamp=datetime.now(),
            screenshot_path=screenshot_path,
            action=action,
            success=success,
            error_message=error,
            page_url=url,
            page_title=title,
        )

        self.report.steps.append(step_result)

        # Check for friction points
        if action.raw_response and action.raw_response.get("friction_point"):
            self.report.friction_points.append(action.raw_response["friction_point"])

        # Check for detected price
        if action.raw_response and action.raw_response.get("detected_price"):
            self.report.final_price = action.raw_response["detected_price"]

    def run(self) -> FunnelReport:
        """
        Run the funnel navigation process.

        Returns:
            FunnelReport containing all steps, findings, and final state.
        """
        self._running = True
        self.report.start_time = datetime.now()

        console.print(Panel.fit(
            f"[bold cyan]Starting Funnel Walker[/bold cyan]\n"
            f"URL: {self.start_url}\n"
            f"Persona: {json.dumps(self.user_persona, indent=2)}",
            title="Vision-Driven Web Agent",
        ))

        try:
            # Start browser and navigate
            self.browser.start()
            self._log(f"Navigating to: {self.start_url}", "cyan")
            self.browser.navigate(self.start_url)

            # Main navigation loop
            while self._running and self.current_step < self.max_steps:
                self.current_step += 1

                self._log(f"\n{'='*50}", "dim")
                self._log(f"STEP {self.current_step}", "bold cyan")
                self._log(f"{'='*50}", "dim")

                # Take screenshot
                screenshot_path = self._take_screenshot()

                # Check for checkout before analysis
                if self._check_for_checkout():
                    self._log("Checkout page detected!", "green bold")
                    self.report.completed = True
                    self._record_step(
                        screenshot_path,
                        AgentAction(
                            action_type=ActionType.TERMINATE,
                            analysis="Checkout page reached",
                            element_description="Checkout/Payment form",
                        ),
                        success=True,
                    )
                    break

                # Analyze screenshot with LLM
                self._log("Analyzing screenshot with vision model...", "dim")
                action = self.analyzer.analyze_screenshot(
                    screenshot_path,
                    self.user_persona,
                    self.current_step,
                )

                # Log agent's thinking
                self._log_thinking(action)

                # Check for termination
                if action.action_type == ActionType.TERMINATE:
                    self._log("Agent determined flow is complete", "green bold")
                    self.report.completed = True
                    self._record_step(screenshot_path, action, success=True)
                    break

                # Execute action
                success = self._execute_action(action)
                self._record_step(screenshot_path, action, success)

                if not success:
                    self._log("Action failed, will retry on next step", "yellow")

            if self.current_step >= self.max_steps:
                self._log(f"Reached maximum steps ({self.max_steps})", "yellow bold")
                self.report.error = "Maximum steps reached"

        except Exception as e:
            self._log(f"Fatal error: {e}", "red bold")
            self.report.error = str(e)

        finally:
            self._running = False
            self.report.end_time = datetime.now()
            self.browser.close()

            # Generate report
            self._generate_report()

        return self.report

    def stop(self) -> None:
        """Stop the navigation process."""
        self._running = False
        self._log("Stop signal received", "yellow")

    def _generate_report(self) -> None:
        """Generate a markdown report of the funnel walkthrough."""
        report_path = self.output_dir / "report.md"

        duration = None
        if self.report.start_time and self.report.end_time:
            duration = self.report.end_time - self.report.start_time

        content = f"""# Funnel Walkthrough Report

## Overview

- **Start URL:** {self.report.start_url}
- **Start Time:** {self.report.start_time.isoformat() if self.report.start_time else 'N/A'}
- **End Time:** {self.report.end_time.isoformat() if self.report.end_time else 'N/A'}
- **Duration:** {duration if duration else 'N/A'}
- **Total Steps:** {len(self.report.steps)}
- **Completed:** {'Yes' if self.report.completed else 'No'}
- **Final Price:** {self.report.final_price or 'Not detected'}

## User Persona

```json
{json.dumps(self.report.user_persona, indent=2)}
```

## Navigation Steps

| Step | Analysis | Action | Element | Success |
|------|----------|--------|---------|---------|
"""

        for step in self.report.steps:
            analysis = step.action.analysis[:50] + "..." if len(step.action.analysis) > 50 else step.action.analysis
            element = step.action.element_description[:30] + "..." if len(step.action.element_description) > 30 else step.action.element_description
            content += f"| {step.step_number} | {analysis} | {step.action.action_type.value} | {element} | {'✅' if step.success else '❌'} |\n"

        content += "\n## Step Details\n\n"

        for step in self.report.steps:
            content += f"""### Step {step.step_number}

- **Timestamp:** {step.timestamp.isoformat()}
- **URL:** {step.page_url}
- **Title:** {step.page_title}
- **Screenshot:** `{Path(step.screenshot_path).name}`
- **Analysis:** {step.action.analysis}
- **Action:** {step.action.action_type.value}
- **Target:** {step.action.element_description}
- **Coordinates:** {step.action.coordinates}
- **Confidence:** {step.action.confidence:.0%}
- **Success:** {'Yes' if step.success else 'No'}
{f'- **Error:** {step.error_message}' if step.error_message else ''}

"""

        if self.report.friction_points:
            content += "## Friction Points Detected\n\n"
            for i, point in enumerate(self.report.friction_points, 1):
                content += f"{i}. {point}\n"
            content += "\n"

        if self.report.error:
            content += f"""## Errors

The walkthrough encountered an error: `{self.report.error}`
"""

        content += """
## Screenshots

All screenshots are saved in the output directory with naming convention `step_XX.png`.

---
*Generated by Vision-Driven Web Agent*
"""

        with open(report_path, "w") as f:
            f.write(content)

        self._log(f"\nReport saved to: {report_path}", "green bold")
        console.print(Panel.fit(
            f"[bold green]Funnel walkthrough complete![/bold green]\n"
            f"Steps: {len(self.report.steps)}\n"
            f"Completed: {'Yes' if self.report.completed else 'No'}\n"
            f"Report: {report_path}",
            title="Summary",
        ))
