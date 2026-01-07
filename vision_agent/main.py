#!/usr/bin/env python3
"""
Vision-Driven Web Agent CLI

A command-line tool for navigating telehealth intake funnels using
vision-based AI analysis.

Usage:
    python main.py --url https://example.com --persona '{"age": 35, "gender": "male"}'
    python main.py --interactive
    python main.py --config persona.json
"""

import json
import os
import sys
from pathlib import Path

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, Confirm

from agent import FunnelWalker, LLMProvider, FunnelReport

# Load environment variables
load_dotenv()

console = Console()

# Default personas for quick testing
DEFAULT_PERSONAS = {
    "hair_loss_male": {
        "age": 35,
        "gender": "male",
        "symptoms": "hair loss",
        "symptom_duration": "2 years",
        "previous_treatment": "none",
        "medical_history": "none",
        "medications": "none",
        "allergies": "none",
    },
    "weight_loss_female": {
        "age": 42,
        "gender": "female",
        "goal": "weight loss",
        "current_weight": "180 lbs",
        "target_weight": "150 lbs",
        "medical_history": "none",
        "medications": "none",
        "activity_level": "sedentary",
    },
    "ed_male": {
        "age": 45,
        "gender": "male",
        "symptoms": "erectile dysfunction",
        "symptom_duration": "6 months",
        "previous_treatment": "none",
        "medical_history": "none",
        "medications": "none",
        "cardiovascular_issues": "none",
    },
    "skincare_female": {
        "age": 28,
        "gender": "female",
        "concern": "acne",
        "skin_type": "oily",
        "current_routine": "basic cleanser",
        "allergies": "none",
        "previous_prescriptions": "none",
    },
    "mental_health": {
        "age": 32,
        "gender": "non-binary",
        "concern": "anxiety",
        "symptom_duration": "1 year",
        "severity": "moderate",
        "previous_therapy": "none",
        "medications": "none",
        "sleep_quality": "poor",
    },
}


def validate_api_keys() -> tuple[bool, str]:
    """Check if required API keys are configured."""
    provider = os.getenv("LLM_PROVIDER", "anthropic").lower()

    if provider == "anthropic":
        if os.getenv("ANTHROPIC_API_KEY"):
            return True, "anthropic"
        elif os.getenv("OPENAI_API_KEY"):
            console.print("[yellow]ANTHROPIC_API_KEY not found, falling back to OpenAI[/yellow]")
            return True, "openai"
    else:
        if os.getenv("OPENAI_API_KEY"):
            return True, "openai"
        elif os.getenv("ANTHROPIC_API_KEY"):
            console.print("[yellow]OPENAI_API_KEY not found, falling back to Anthropic[/yellow]")
            return True, "anthropic"

    return False, ""


def get_config_from_env() -> dict:
    """Get configuration from environment variables."""
    return {
        "headless": os.getenv("HEADLESS", "false").lower() == "true",
        "viewport_width": int(os.getenv("VIEWPORT_WIDTH", "1280")),
        "viewport_height": int(os.getenv("VIEWPORT_HEIGHT", "800")),
        "max_steps": int(os.getenv("MAX_STEPS", "50")),
        "action_delay": float(os.getenv("ACTION_DELAY", "1500")) / 1000,  # Convert ms to seconds
        "output_dir": os.getenv("OUTPUT_DIR", "./output"),
        "debug": os.getenv("DEBUG", "false").lower() == "true",
    }


def interactive_mode() -> tuple[str, dict]:
    """Run interactive mode to gather URL and persona from user."""
    console.print(Panel.fit(
        "[bold cyan]Vision-Driven Web Agent[/bold cyan]\n"
        "Interactive Mode",
        title="Welcome",
    ))

    # Get URL
    url = Prompt.ask(
        "\n[bold]Enter the starting URL[/bold]",
        default="https://www.forhims.com/hair-loss",
    )

    # Choose persona type
    console.print("\n[bold]Available preset personas:[/bold]")
    for i, (key, persona) in enumerate(DEFAULT_PERSONAS.items(), 1):
        console.print(f"  {i}. {key} - {persona.get('symptoms', persona.get('goal', persona.get('concern', 'general')))}")
    console.print(f"  {len(DEFAULT_PERSONAS) + 1}. Custom (enter your own)")

    choice = Prompt.ask(
        "\n[bold]Select a persona[/bold]",
        default="1",
    )

    try:
        choice_num = int(choice)
        if 1 <= choice_num <= len(DEFAULT_PERSONAS):
            persona_key = list(DEFAULT_PERSONAS.keys())[choice_num - 1]
            persona = DEFAULT_PERSONAS[persona_key].copy()
            console.print(f"\n[green]Using preset: {persona_key}[/green]")
        else:
            # Custom persona
            console.print("\n[bold]Enter custom persona as JSON:[/bold]")
            persona_json = Prompt.ask("Persona JSON")
            persona = json.loads(persona_json)
    except (ValueError, json.JSONDecodeError) as e:
        console.print(f"[red]Invalid input: {e}. Using default persona.[/red]")
        persona = DEFAULT_PERSONAS["hair_loss_male"].copy()

    # Allow modifications
    if Confirm.ask("\n[bold]Would you like to modify the persona?[/bold]", default=False):
        console.print("\nCurrent persona:")
        for key, value in persona.items():
            console.print(f"  {key}: {value}")

        while True:
            key = Prompt.ask("\nEnter field to modify (or 'done' to finish)")
            if key.lower() == "done":
                break
            if key in persona:
                value = Prompt.ask(f"New value for '{key}'")
                persona[key] = value
            else:
                if Confirm.ask(f"'{key}' doesn't exist. Add it?", default=True):
                    value = Prompt.ask(f"Value for '{key}'")
                    persona[key] = value

    console.print("\n[bold green]Final configuration:[/bold green]")
    console.print(f"  URL: {url}")
    console.print(f"  Persona: {json.dumps(persona, indent=4)}")

    if not Confirm.ask("\n[bold]Proceed with this configuration?[/bold]", default=True):
        console.print("[yellow]Aborted by user[/yellow]")
        sys.exit(0)

    return url, persona


def print_report_summary(report: FunnelReport) -> None:
    """Print a summary of the funnel report."""
    console.print("\n")
    console.print(Panel.fit(
        f"[bold]Funnel Walkthrough Summary[/bold]\n\n"
        f"✅ Completed: {'Yes' if report.completed else 'No'}\n"
        f"📊 Total Steps: {len(report.steps)}\n"
        f"💰 Final Price: {report.final_price or 'Not detected'}\n"
        f"⚠️  Friction Points: {len(report.friction_points)}\n"
        f"❌ Error: {report.error or 'None'}",
        title="Results",
        border_style="green" if report.completed else "yellow",
    ))

    if report.friction_points:
        console.print("\n[bold yellow]Friction Points Detected:[/bold yellow]")
        for i, point in enumerate(report.friction_points, 1):
            console.print(f"  {i}. {point}")


@click.command()
@click.option(
    "--url", "-u",
    help="Starting URL for the funnel",
)
@click.option(
    "--persona", "-p",
    help="User persona as JSON string",
)
@click.option(
    "--persona-file", "-f",
    type=click.Path(exists=True),
    help="Path to JSON file containing user persona",
)
@click.option(
    "--preset",
    type=click.Choice(list(DEFAULT_PERSONAS.keys())),
    help="Use a preset persona",
)
@click.option(
    "--output", "-o",
    default="./output",
    help="Output directory for screenshots and report",
)
@click.option(
    "--headless/--no-headless",
    default=None,
    help="Run browser in headless mode",
)
@click.option(
    "--max-steps",
    type=int,
    help="Maximum number of steps before terminating",
)
@click.option(
    "--provider",
    type=click.Choice(["anthropic", "openai"]),
    help="LLM provider to use",
)
@click.option(
    "--model",
    help="Specific model to use (e.g., claude-3-5-sonnet-20241022, gpt-4o)",
)
@click.option(
    "--interactive", "-i",
    is_flag=True,
    help="Run in interactive mode",
)
@click.option(
    "--debug",
    is_flag=True,
    help="Enable debug logging",
)
def main(
    url: str,
    persona: str,
    persona_file: str,
    preset: str,
    output: str,
    headless: bool,
    max_steps: int,
    provider: str,
    model: str,
    interactive: bool,
    debug: bool,
):
    """
    Vision-Driven Web Agent for Telehealth Funnel Navigation

    Navigate multi-step intake forms using AI-powered visual analysis.

    Examples:

        # Interactive mode
        python main.py --interactive

        # With URL and preset persona
        python main.py --url https://example.com --preset hair_loss_male

        # With custom persona JSON
        python main.py --url https://example.com --persona '{"age": 35, "gender": "male"}'

        # With persona file
        python main.py --url https://example.com --persona-file persona.json

        # With specific LLM provider
        python main.py --url https://example.com --preset ed_male --provider openai
    """

    # Print banner
    console.print(Panel.fit(
        "[bold cyan]Vision-Driven Web Agent[/bold cyan]\n"
        "[dim]Autonomous Telehealth Funnel Navigator[/dim]",
        border_style="cyan",
    ))

    # Check API keys
    valid, detected_provider = validate_api_keys()
    if not valid:
        console.print("[red bold]Error: No API keys found![/red bold]")
        console.print("Please set ANTHROPIC_API_KEY or OPENAI_API_KEY in your .env file")
        console.print("See .env.example for configuration options")
        sys.exit(1)

    # Get config from environment
    env_config = get_config_from_env()

    # Handle interactive mode
    if interactive or (not url and not persona and not persona_file and not preset):
        url, user_persona = interactive_mode()
    else:
        # Validate URL
        if not url:
            console.print("[red]Error: --url is required (or use --interactive)[/red]")
            sys.exit(1)

        # Get persona
        if persona_file:
            with open(persona_file) as f:
                user_persona = json.load(f)
        elif persona:
            try:
                user_persona = json.loads(persona)
            except json.JSONDecodeError as e:
                console.print(f"[red]Error parsing persona JSON: {e}[/red]")
                sys.exit(1)
        elif preset:
            user_persona = DEFAULT_PERSONAS[preset].copy()
        else:
            console.print("[yellow]No persona specified, using default (hair_loss_male)[/yellow]")
            user_persona = DEFAULT_PERSONAS["hair_loss_male"].copy()

    # Determine LLM provider
    if provider:
        llm_provider = LLMProvider(provider)
    else:
        llm_provider = LLMProvider(detected_provider)

    # Build configuration
    config = {
        "start_url": url,
        "user_persona": user_persona,
        "output_dir": output or env_config["output_dir"],
        "llm_provider": llm_provider,
        "llm_model": model,
        "headless": headless if headless is not None else env_config["headless"],
        "max_steps": max_steps or env_config["max_steps"],
        "action_delay": env_config["action_delay"],
        "debug": debug or env_config["debug"],
    }

    console.print(f"\n[dim]Provider: {llm_provider.value}[/dim]")
    console.print(f"[dim]Model: {model or 'default'}[/dim]")
    console.print(f"[dim]Headless: {config['headless']}[/dim]")
    console.print(f"[dim]Max Steps: {config['max_steps']}[/dim]")
    console.print(f"[dim]Output: {config['output_dir']}[/dim]")

    # Create and run agent
    try:
        walker = FunnelWalker(**config)
        report = walker.run()
        print_report_summary(report)

    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"\n[red bold]Error: {e}[/red bold]")
        if debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
