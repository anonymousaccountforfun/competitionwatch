"""
Utility functions for Vision-Driven Web Agent.
"""

import hashlib
import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

from PIL import Image
from rich.console import Console

console = Console()


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a string to be safe for use as a filename.

    Args:
        filename: The string to sanitize

    Returns:
        A filesystem-safe string
    """
    # Remove or replace unsafe characters
    safe = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Limit length
    return safe[:100]


def generate_session_id() -> str:
    """
    Generate a unique session ID for this run.

    Returns:
        A unique session identifier
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_hash = hashlib.md5(str(time.time()).encode()).hexdigest()[:8]
    return f"{timestamp}_{random_hash}"


def create_output_directory(base_dir: str, session_id: Optional[str] = None) -> Path:
    """
    Create an output directory for the current session.

    Args:
        base_dir: Base output directory
        session_id: Optional session ID (generated if not provided)

    Returns:
        Path to the created directory
    """
    if session_id is None:
        session_id = generate_session_id()

    output_path = Path(base_dir) / session_id
    output_path.mkdir(parents=True, exist_ok=True)
    return output_path


def extract_domain(url: str) -> str:
    """
    Extract the domain from a URL.

    Args:
        url: The URL to parse

    Returns:
        The domain (e.g., 'example.com')
    """
    parsed = urlparse(url)
    return parsed.netloc or parsed.path.split('/')[0]


def compress_screenshot(
    input_path: str,
    output_path: Optional[str] = None,
    quality: int = 85,
    max_size: tuple[int, int] = (1920, 1080),
) -> str:
    """
    Compress and optionally resize a screenshot.

    Args:
        input_path: Path to the original screenshot
        output_path: Path for compressed image (defaults to overwriting)
        quality: JPEG quality (1-100)
        max_size: Maximum dimensions (width, height)

    Returns:
        Path to the compressed image
    """
    output_path = output_path or input_path

    with Image.open(input_path) as img:
        # Convert RGBA to RGB if needed
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background

        # Resize if larger than max_size
        if img.width > max_size[0] or img.height > max_size[1]:
            img.thumbnail(max_size, Image.Resampling.LANCZOS)

        # Save with compression
        img.save(output_path, "PNG", optimize=True)

    return output_path


def extract_price(text: str) -> Optional[str]:
    """
    Extract price from text.

    Args:
        text: Text that may contain a price

    Returns:
        The extracted price string or None
    """
    # Common price patterns
    patterns = [
        r'\$\d+(?:\.\d{2})?(?:/\s*(?:mo|month|year|yr))?',  # $29/mo, $29.99
        r'\d+(?:\.\d{2})?\s*(?:USD|usd)',  # 29.99 USD
        r'(?:USD|usd)\s*\d+(?:\.\d{2})?',  # USD 29.99
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group()

    return None


def detect_checkout_keywords(text: str) -> bool:
    """
    Check if text contains checkout-related keywords.

    Args:
        text: Page text to analyze

    Returns:
        True if checkout keywords are detected
    """
    keywords = [
        'checkout', 'payment', 'pay now', 'complete purchase',
        'order summary', 'billing', 'credit card', 'card number',
        'place order', 'submit order', 'confirm order', 'shipping address',
        'payment method', 'total:', 'subtotal', 'order total',
    ]

    text_lower = text.lower()
    return any(keyword in text_lower for keyword in keywords)


def detect_form_elements(text: str) -> dict[str, bool]:
    """
    Detect what types of form elements might be on a page.

    Args:
        text: Page text to analyze

    Returns:
        Dictionary indicating detected element types
    """
    return {
        'has_age_question': bool(re.search(r'(?:how old|your age|date of birth|birthday)', text, re.I)),
        'has_gender_question': bool(re.search(r'(?:gender|male|female|sex)', text, re.I)),
        'has_symptom_question': bool(re.search(r'(?:symptom|condition|experiencing|suffering)', text, re.I)),
        'has_medical_history': bool(re.search(r'(?:medical history|previous|diagnosed|conditions)', text, re.I)),
        'has_medication_question': bool(re.search(r'(?:medication|taking|prescri|drugs)', text, re.I)),
        'has_input_field': bool(re.search(r'(?:enter|type|input|fill)', text, re.I)),
        'has_continue_button': bool(re.search(r'(?:continue|next|proceed|submit)', text, re.I)),
    }


def calculate_element_center(
    bounding_box: dict[str, float],
) -> tuple[int, int]:
    """
    Calculate the center point of an element's bounding box.

    Args:
        bounding_box: Dict with x, y, width, height

    Returns:
        Tuple of (center_x, center_y)
    """
    x = bounding_box.get('x', 0)
    y = bounding_box.get('y', 0)
    width = bounding_box.get('width', 0)
    height = bounding_box.get('height', 0)

    center_x = int(x + width / 2)
    center_y = int(y + height / 2)

    return center_x, center_y


def format_duration(seconds: float) -> str:
    """
    Format a duration in seconds to a human-readable string.

    Args:
        seconds: Duration in seconds

    Returns:
        Formatted string (e.g., "2m 30s")
    """
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}m"


def log_json(data: Any, title: str = "Data") -> None:
    """
    Pretty print JSON data to console.

    Args:
        data: Data to print
        title: Optional title for the output
    """
    console.print(f"\n[bold]{title}:[/bold]")
    console.print_json(json.dumps(data, indent=2, default=str))


class RateLimiter:
    """Simple rate limiter for API calls."""

    def __init__(self, calls_per_minute: int = 20):
        """
        Initialize rate limiter.

        Args:
            calls_per_minute: Maximum calls allowed per minute
        """
        self.calls_per_minute = calls_per_minute
        self.calls: list[float] = []

    def wait_if_needed(self) -> None:
        """Wait if rate limit would be exceeded."""
        now = time.time()

        # Remove calls older than 1 minute
        self.calls = [t for t in self.calls if now - t < 60]

        if len(self.calls) >= self.calls_per_minute:
            # Wait until oldest call expires
            wait_time = 60 - (now - self.calls[0]) + 0.1
            if wait_time > 0:
                console.print(f"[dim]Rate limiting: waiting {wait_time:.1f}s[/dim]")
                time.sleep(wait_time)

        self.calls.append(time.time())


class RetryHandler:
    """Handle retries with exponential backoff."""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
    ):
        """
        Initialize retry handler.

        Args:
            max_retries: Maximum number of retry attempts
            base_delay: Initial delay between retries
            max_delay: Maximum delay between retries
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay

    def execute(self, func, *args, **kwargs) -> Any:
        """
        Execute a function with retry logic.

        Args:
            func: Function to execute
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns:
            Result of the function

        Raises:
            Exception: The last exception if all retries fail
        """
        last_exception = None

        for attempt in range(self.max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e

                if attempt < self.max_retries:
                    delay = min(
                        self.base_delay * (2 ** attempt),
                        self.max_delay,
                    )
                    console.print(
                        f"[yellow]Attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay:.1f}s...[/yellow]"
                    )
                    time.sleep(delay)

        raise last_exception
