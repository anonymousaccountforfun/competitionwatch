#!/bin/bash
# Ralph for Claude Code - Long-running autonomous AI agent loop
# Adapted from https://github.com/snarktank/ralph for Claude Code CLI
# Usage: ./ralph.sh [max_iterations]

set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# Check for required dependencies
if ! command -v claude &> /dev/null; then
  echo "Error: 'claude' CLI not found. Please install Claude Code first."
  echo "Visit: https://docs.anthropic.com/en/docs/claude-code"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: 'jq' not found. Please install it first."
  echo "  macOS: brew install jq"
  echo "  Ubuntu: apt install jq"
  exit 1
fi

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    # Archive the previous run
    DATE=$(date +%Y-%m-%d)
    # Strip "ralph/" prefix from branch name for folder
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"

    # Reset progress file for new run
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# Check for PRD file
if [ ! -f "$PRD_FILE" ]; then
  echo "Error: No prd.json found at $PRD_FILE"
  echo "Create one from prd.json.example or use Claude Code to generate it."
  exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║     Ralph for Claude Code - Autonomous Agent Loop     ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "PRD: $PRD_FILE"
echo "Progress: $PROGRESS_FILE"
echo "Max iterations: $MAX_ITERATIONS"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  Ralph Iteration $i of $MAX_ITERATIONS"
  echo "═══════════════════════════════════════════════════════"

  # Check how many stories remain
  REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo "?")
  echo "Stories remaining: $REMAINING"
  echo ""

  # Build the prompt from prompt.md
  PROMPT=$(cat "$SCRIPT_DIR/prompt.md")

  # Run Claude Code with the ralph prompt in non-interactive mode
  # Using --dangerously-skip-permissions for autonomous operation
  OUTPUT=$(echo "$PROMPT" | claude --dangerously-skip-permissions --print 2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<ralph>COMPLETE</ralph>"; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║          Ralph completed all tasks!                   ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  # Also check if all stories are now passing
  ALL_PASSING=$(jq '[.userStories[] | select(.passes == false)] | length == 0' "$PRD_FILE" 2>/dev/null || echo "false")
  if [ "$ALL_PASSING" = "true" ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║          All stories passing - Ralph complete!        ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    exit 0
  fi

  echo ""
  echo "Iteration $i complete. Continuing to next story..."
  sleep 2
done

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  Ralph reached max iterations without completing      ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo "Max iterations: $MAX_ITERATIONS"
echo "Check $PROGRESS_FILE for status."
exit 1
