#!/bin/bash
# Ralph for Claude Code - Autonomous AI Agent Loop
# Adapted from https://github.com/snarktank/ralph for Claude Code CLI
#
# Usage: ./ralph.sh [options]
#   -n, --max-iterations N   Maximum iterations (default: 10)
#   -r, --retry N            Retries per story on failure (default: 2)
#   -v, --verbose            Show full Claude output
#   -c, --continue           Continue from last run (don't reset on branch change)
#   -h, --help               Show this help message

set -e

# Default configuration
MAX_ITERATIONS=10
MAX_RETRIES=2
VERBOSE=false
CONTINUE_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -n|--max-iterations)
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    -r|--retry)
      MAX_RETRIES="$2"
      shift 2
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -c|--continue)
      CONTINUE_MODE=true
      shift
      ;;
    -h|--help)
      echo "Ralph for Claude Code - Autonomous AI Agent Loop"
      echo ""
      echo "Usage: ./ralph.sh [options]"
      echo ""
      echo "Options:"
      echo "  -n, --max-iterations N   Maximum iterations (default: 10)"
      echo "  -r, --retry N            Retries per story on failure (default: 2)"
      echo "  -v, --verbose            Show full Claude output"
      echo "  -c, --continue           Continue from last run"
      echo "  -h, --help               Show this help message"
      exit 0
      ;;
    *)
      # Legacy: first positional arg is max iterations
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Setup paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
STATE_FILE="$SCRIPT_DIR/.ralph-state"
LOG_DIR="$SCRIPT_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check for required dependencies
check_dependencies() {
  if ! command -v claude &> /dev/null; then
    log_error "'claude' CLI not found. Please install Claude Code first."
    echo "  Visit: https://docs.anthropic.com/en/docs/claude-code"
    exit 1
  fi

  if ! command -v jq &> /dev/null; then
    log_error "'jq' not found. Please install it first."
    echo "  macOS: brew install jq"
    echo "  Ubuntu: apt install jq"
    exit 1
  fi
}

# Archive previous run if branch changed
archive_previous_run() {
  if [ "$CONTINUE_MODE" = true ]; then
    return
  fi

  if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

    if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
      DATE=$(date +%Y-%m-%d)
      FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||' | sed 's|/|_|g')
      ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

      log_info "Archiving previous run: $LAST_BRANCH"
      mkdir -p "$ARCHIVE_FOLDER"
      [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
      [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
      [ -f "$STATE_FILE" ] && cp "$STATE_FILE" "$ARCHIVE_FOLDER/"
      [ -d "$LOG_DIR" ] && cp -r "$LOG_DIR" "$ARCHIVE_FOLDER/" 2>/dev/null || true
      log_success "Archived to: $ARCHIVE_FOLDER"

      # Reset for new run
      echo "# Ralph Progress Log" > "$PROGRESS_FILE"
      echo "Started: $(date)" >> "$PROGRESS_FILE"
      echo "Branch: $CURRENT_BRANCH" >> "$PROGRESS_FILE"
      echo "---" >> "$PROGRESS_FILE"
      rm -f "$STATE_FILE"
      rm -rf "$LOG_DIR"
    fi
  fi
}

# Track current branch
track_branch() {
  if [ -f "$PRD_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    if [ -n "$CURRENT_BRANCH" ]; then
      echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
    fi
  fi
}

# Initialize progress file if needed
init_progress() {
  if [ ! -f "$PROGRESS_FILE" ]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    if [ -f "$PRD_FILE" ]; then
      BRANCH=$(jq -r '.branchName // "unknown"' "$PRD_FILE" 2>/dev/null)
      echo "Branch: $BRANCH" >> "$PROGRESS_FILE"
    fi
    echo "---" >> "$PROGRESS_FILE"
  fi
}

# Get current story being worked on
get_current_story() {
  jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE" 2>/dev/null || echo "unknown"
}

# Count remaining stories
count_remaining() {
  jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo "?"
}

# Count completed stories
count_completed() {
  jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE" 2>/dev/null || echo "0"
}

# Count total stories
count_total() {
  jq '.userStories | length' "$PRD_FILE" 2>/dev/null || echo "?"
}

# Check if all stories are complete
all_complete() {
  local remaining=$(count_remaining)
  [ "$remaining" = "0" ]
}

# Save state for resume
save_state() {
  local iteration=$1
  local story_id=$2
  local status=$3
  echo "{\"iteration\": $iteration, \"story_id\": \"$story_id\", \"status\": \"$status\", \"timestamp\": \"$(date -Iseconds)\"}" > "$STATE_FILE"
}

# Run a single iteration
run_iteration() {
  local iteration=$1
  local retry=$2
  local story=$(get_current_story)
  local story_id=$(echo "$story" | cut -d: -f1)

  mkdir -p "$LOG_DIR"
  local log_file="$LOG_DIR/iteration-${iteration}-retry-${retry}.log"

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Iteration $iteration of $MAX_ITERATIONS $([ $retry -gt 0 ] && echo "(retry $retry)")"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  log_info "Current story: $story"
  log_info "Progress: $(count_completed)/$(count_total) complete, $(count_remaining) remaining"
  echo ""

  save_state "$iteration" "$story_id" "in_progress"

  # Build prompt with context
  local full_prompt="$PROMPT

# Current Working Directory
$PROJECT_ROOT

# Current Story
$story

# Iteration Info
Iteration: $iteration of $MAX_ITERATIONS
$([ $retry -gt 0 ] && echo "This is retry attempt $retry after a previous failure. Check progress.txt for what went wrong.")
"

  # Run Claude Code
  local exit_code=0
  if [ "$VERBOSE" = true ]; then
    echo "$full_prompt" | claude --dangerously-skip-permissions --print 2>&1 | tee "$log_file" || exit_code=$?
  else
    echo "$full_prompt" | claude --dangerously-skip-permissions --print > "$log_file" 2>&1 || exit_code=$?
    # Show summary
    if [ -f "$log_file" ]; then
      echo ""
      log_info "Claude output summary (last 20 lines):"
      tail -20 "$log_file" | sed 's/^/  /'
    fi
  fi

  local output=$(cat "$log_file" 2>/dev/null || echo "")

  # Check for completion signal
  if echo "$output" | grep -q "<ralph>COMPLETE</ralph>"; then
    save_state "$iteration" "$story_id" "all_complete"
    return 0
  fi

  # Check for story completion (passes changed to true)
  if all_complete; then
    save_state "$iteration" "$story_id" "all_complete"
    return 0
  fi

  # Check if this story was completed
  local story_now_passes=$(jq -r --arg id "$story_id" '.userStories[] | select(.id == $id) | .passes' "$PRD_FILE" 2>/dev/null || echo "false")
  if [ "$story_now_passes" = "true" ]; then
    save_state "$iteration" "$story_id" "story_complete"
    log_success "Story $story_id completed!"
    return 1  # Continue to next story
  fi

  # Check for errors in output
  if echo "$output" | grep -qi "error\|failed\|exception"; then
    save_state "$iteration" "$story_id" "error"
    log_warn "Potential error detected in output"
    return 2  # Retry
  fi

  save_state "$iteration" "$story_id" "incomplete"
  return 1  # Continue to next iteration
}

# Main execution
main() {
  check_dependencies

  # Check for PRD file
  if [ ! -f "$PRD_FILE" ]; then
    log_error "No prd.json found at $PRD_FILE"
    echo ""
    echo "To get started:"
    echo "  1. cp $SCRIPT_DIR/prd.json.example $PRD_FILE"
    echo "  2. Edit prd.json with your user stories"
    echo "  3. Run ./ralph.sh"
    echo ""
    echo "Or use generate-prd.sh to create one from a description:"
    echo "  ./generate-prd.sh \"Add user authentication with OAuth\""
    exit 1
  fi

  if [ ! -f "$PROMPT_FILE" ]; then
    log_error "No prompt.md found at $PROMPT_FILE"
    exit 1
  fi

  PROMPT=$(cat "$PROMPT_FILE")

  archive_previous_run
  track_branch
  init_progress

  # Header
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║       Ralph for Claude Code - Autonomous Agent Loop           ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""
  log_info "PRD: $PRD_FILE"
  log_info "Progress: $PROGRESS_FILE"
  log_info "Max iterations: $MAX_ITERATIONS"
  log_info "Max retries per story: $MAX_RETRIES"
  log_info "Project: $(jq -r '.project // "unknown"' "$PRD_FILE")"
  log_info "Branch: $(jq -r '.branchName // "unknown"' "$PRD_FILE")"
  echo ""

  # Check if already complete
  if all_complete; then
    log_success "All stories already complete!"
    exit 0
  fi

  local consecutive_failures=0
  local iteration=1

  while [ $iteration -le $MAX_ITERATIONS ]; do
    local retry=0
    local result=1

    while [ $retry -le $MAX_RETRIES ]; do
      run_iteration $iteration $retry
      result=$?

      if [ $result -eq 0 ]; then
        # All complete
        echo ""
        echo "╔═══════════════════════════════════════════════════════════════╗"
        echo "║              Ralph completed all tasks!                        ║"
        echo "╚═══════════════════════════════════════════════════════════════╝"
        echo ""
        log_success "Completed at iteration $iteration"
        log_success "Total stories: $(count_total)"
        exit 0
      elif [ $result -eq 1 ]; then
        # Story complete or progress made, continue
        consecutive_failures=0
        break
      else
        # Error, retry
        retry=$((retry + 1))
        if [ $retry -le $MAX_RETRIES ]; then
          log_warn "Retrying... ($retry/$MAX_RETRIES)"
          sleep 3
        fi
      fi
    done

    if [ $result -eq 2 ]; then
      consecutive_failures=$((consecutive_failures + 1))
      log_error "Story failed after $MAX_RETRIES retries"

      if [ $consecutive_failures -ge 3 ]; then
        log_error "Too many consecutive failures. Stopping."
        echo ""
        echo "Check $LOG_DIR for detailed logs."
        exit 1
      fi
    fi

    # Check if complete after iteration
    if all_complete; then
      echo ""
      echo "╔═══════════════════════════════════════════════════════════════╗"
      echo "║              All stories passing - Ralph complete!            ║"
      echo "╚═══════════════════════════════════════════════════════════════╝"
      exit 0
    fi

    iteration=$((iteration + 1))

    if [ $iteration -le $MAX_ITERATIONS ]; then
      log_info "Continuing to next iteration..."
      sleep 2
    fi
  done

  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║      Ralph reached max iterations without completing          ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""
  log_warn "Max iterations: $MAX_ITERATIONS"
  log_warn "Stories completed: $(count_completed)/$(count_total)"
  log_info "Check $PROGRESS_FILE for status"
  log_info "Check $LOG_DIR for detailed logs"
  echo ""
  echo "To continue, run: ./ralph.sh --continue"
  exit 1
}

main "$@"
