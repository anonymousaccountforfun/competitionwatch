# Vision-Driven Web Agent

A Python CLI tool for autonomously navigating multi-step telehealth intake funnels using vision-based AI analysis.

## Overview

Traditional web scraping fails on modern telehealth sites because:
- DOMs are dynamic and obfuscated
- Flows are 20+ steps long with complex conditional logic
- Elements change based on user responses

This agent solves these challenges by "looking" at the screen like a human would, using vision-capable LLMs (GPT-4o or Claude 3.5 Sonnet) to understand what's being asked and determine the appropriate response.

## Features

- **Vision-Based Navigation**: Uses LLM vision capabilities to understand page content
- **Persona-Driven Responses**: Answers form questions based on a configurable user persona
- **Stealth Mode**: Built-in anti-detection measures to avoid bot blocking
- **Automatic Popup Handling**: Detects and dismisses cookie banners and modals
- **Comprehensive Reporting**: Generates markdown reports with screenshots
- **Friction Point Detection**: Identifies UX issues and dark patterns

## Installation

```bash
# Navigate to the vision_agent directory
cd vision_agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Add your API keys to `.env`:
```env
ANTHROPIC_API_KEY=your_key_here
# OR
OPENAI_API_KEY=your_key_here
```

## Usage

### Interactive Mode (Recommended for First-Time Users)

```bash
python main.py --interactive
```

This will guide you through:
- Entering the target URL
- Selecting or customizing a user persona
- Confirming settings before starting

### Command Line Options

```bash
# Basic usage with preset persona
python main.py --url https://example.com/quiz --preset hair_loss_male

# Custom persona as JSON
python main.py --url https://example.com --persona '{"age": 35, "gender": "male", "symptoms": "hair loss"}'

# Load persona from file
python main.py --url https://example.com --persona-file my_persona.json

# Use specific LLM provider
python main.py --url https://example.com --preset ed_male --provider openai

# Run in headless mode (no visible browser)
python main.py --url https://example.com --preset weight_loss_female --headless

# Custom output directory
python main.py --url https://example.com --output ./my_output

# Enable debug mode
python main.py --url https://example.com --debug
```

### Available Presets

| Preset | Description |
|--------|-------------|
| `hair_loss_male` | 35-year-old male with hair loss concerns |
| `weight_loss_female` | 42-year-old female seeking weight loss solutions |
| `ed_male` | 45-year-old male with ED symptoms |
| `skincare_female` | 28-year-old female with acne concerns |
| `mental_health` | 32-year-old seeking anxiety treatment |

### Programmatic Usage

```python
from vision_agent import FunnelWalker, LLMProvider

# Define persona
persona = {
    "age": 35,
    "gender": "male",
    "symptoms": "hair loss",
    "symptom_duration": "2 years",
    "previous_treatment": "none",
}

# Create and run agent
walker = FunnelWalker(
    start_url="https://example.com/quiz",
    user_persona=persona,
    llm_provider=LLMProvider.ANTHROPIC,
    headless=False,
    max_steps=30,
)

report = walker.run()

# Access results
print(f"Completed: {report.completed}")
print(f"Steps taken: {len(report.steps)}")
print(f"Final price: {report.final_price}")
print(f"Friction points: {report.friction_points}")
```

## Output

After a run completes, you'll find in the output directory:

```
output/
├── step_01.png    # Screenshot of step 1
├── step_02.png    # Screenshot of step 2
├── ...
└── report.md      # Comprehensive markdown report
```

### Report Contents

- **Overview**: Start URL, duration, completion status
- **User Persona**: The persona used for navigation
- **Navigation Steps**: Table of all steps taken
- **Step Details**: Full analysis for each step
- **Friction Points**: Detected UX issues
- **Final Price**: Extracted pricing information

## How It Works

1. **Screenshot Capture**: Takes a full viewport screenshot
2. **Vision Analysis**: Sends screenshot + persona to LLM
3. **Action Determination**: LLM returns structured JSON with:
   - Analysis of what the page is asking
   - Recommended action (click, type, scroll, etc.)
   - Element coordinates or text to type
4. **Action Execution**: Playwright performs the action
5. **Loop**: Repeat until checkout or max steps reached

## Troubleshooting

### "No API keys found"
Ensure your `.env` file contains `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.

### Browser is blocked / CAPTCHA appears
Some sites have aggressive bot detection. Try:
- Running with `--no-headless` (visible browser)
- Reducing speed by increasing `ACTION_DELAY` in `.env`
- Using a residential proxy (not included)

### Agent clicks wrong elements
The LLM's coordinate estimation can be imprecise. Try:
- Increasing viewport size
- Using a different LLM provider
- Adding more detail to the persona

### Rate limiting errors
The default rate limits are conservative. If you hit limits:
- Wait a few minutes before retrying
- Reduce `MAX_STEPS` to complete faster

## Architecture

```
vision_agent/
├── agent.py      # FunnelWalker, VisionAnalyzer, BrowserController
├── config.py     # Configuration management
├── utils.py      # Utility functions
├── main.py       # CLI entry point
└── __init__.py   # Package exports
```

## Limitations

- Cannot solve CAPTCHAs
- Coordinate-based clicking can miss small elements
- May struggle with complex interactive elements (sliders, date pickers)
- Rate limited by LLM API quotas

## Legal & Ethical Considerations

This tool is intended for:
- Competitive analysis of your own industry
- UX research and funnel optimization
- Testing accessibility of intake flows

Always respect:
- Website Terms of Service
- Rate limits and server load
- HIPAA and privacy regulations when handling health data

## License

MIT License - See LICENSE file for details.
