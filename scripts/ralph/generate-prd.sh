#!/bin/bash
# Generate PRD from a feature description using Claude Code
# Usage: ./generate-prd.sh "Feature description here"
#        ./generate-prd.sh -f feature-spec.md

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
if ! command -v claude &> /dev/null; then
  log_error "'claude' CLI not found"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  log_error "'jq' not found"
  exit 1
fi

# Parse arguments
DESCRIPTION=""
FROM_FILE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--file)
      FROM_FILE=true
      DESCRIPTION=$(cat "$2")
      shift 2
      ;;
    -h|--help)
      echo "Generate PRD from a feature description"
      echo ""
      echo "Usage:"
      echo "  ./generate-prd.sh \"Add user authentication with OAuth\""
      echo "  ./generate-prd.sh -f feature-spec.md"
      echo ""
      echo "Options:"
      echo "  -f, --file FILE    Read feature description from file"
      echo "  -h, --help         Show this help message"
      exit 0
      ;;
    *)
      DESCRIPTION="$1"
      shift
      ;;
  esac
done

if [ -z "$DESCRIPTION" ]; then
  log_error "No feature description provided"
  echo ""
  echo "Usage: ./generate-prd.sh \"Feature description here\""
  exit 1
fi

# Check if PRD already exists
if [ -f "$PRD_FILE" ]; then
  echo ""
  log_info "Existing prd.json found:"
  jq -r '"  Project: \(.project)\n  Branch: \(.branchName)\n  Stories: \(.userStories | length)"' "$PRD_FILE"
  echo ""
  read -p "Overwrite? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Cancelled"
    exit 0
  fi
fi

log_info "Generating PRD for: $DESCRIPTION"
echo ""

# Generate branch name from description
BRANCH_NAME=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)
BRANCH_NAME="ralph/$BRANCH_NAME"

# Build the prompt
PROMPT="You are a technical product manager creating a PRD (Product Requirements Document) for an autonomous AI coding agent.

The agent will implement features ONE user story at a time, with fresh context for each story. Each story must be:
- Small enough to complete in one context window
- Have clear, testable acceptance criteria
- Be independently verifiable

## Feature to Implement

$DESCRIPTION

## Project Context

This is a Next.js 14+ project with:
- TypeScript, Tailwind CSS, shadcn/ui
- PostgreSQL via Prisma ORM
- Supabase Auth
- App Router structure

Project root: $PROJECT_ROOT

## Your Task

Generate a prd.json file with this EXACT structure:

\`\`\`json
{
  \"project\": \"CompetitorPulse\",
  \"branchName\": \"$BRANCH_NAME\",
  \"description\": \"Brief description of the feature\",
  \"userStories\": [
    {
      \"id\": \"US-001\",
      \"title\": \"Short title\",
      \"description\": \"As a [user], I want [goal] so that [benefit]\",
      \"acceptanceCriteria\": [
        \"Specific testable criterion 1\",
        \"Specific testable criterion 2\",
        \"Typecheck passes\"
      ],
      \"priority\": 1,
      \"passes\": false,
      \"notes\": \"\"
    }
  ]
}
\`\`\`

## Guidelines

1. **Order stories by dependency**: Database/backend first, then API, then UI
2. **Right-size stories**: Each should take 10-30 minutes for an AI to implement
3. **Include quality gates**: Always add \"Typecheck passes\" or \"Tests pass\" to acceptance criteria
4. **Be specific**: Acceptance criteria should be unambiguous
5. **4-8 stories is ideal**: Break down larger features, combine trivial ones
6. **UI stories need browser verification**: Add \"Verify in browser\" to UI stories

Output ONLY the JSON, no explanation or markdown code blocks."

# Run Claude to generate PRD
log_info "Calling Claude to generate PRD..."
OUTPUT=$(echo "$PROMPT" | claude --dangerously-skip-permissions --print 2>&1)

# Extract JSON from output (in case there's any extra text)
JSON_OUTPUT=$(echo "$OUTPUT" | grep -Pzo '(?s)\{.*\}' | tr -d '\0' || echo "$OUTPUT")

# Validate JSON
if ! echo "$JSON_OUTPUT" | jq . > /dev/null 2>&1; then
  log_error "Generated output is not valid JSON"
  echo ""
  echo "Raw output:"
  echo "$OUTPUT"
  exit 1
fi

# Validate structure
STORY_COUNT=$(echo "$JSON_OUTPUT" | jq '.userStories | length' 2>/dev/null || echo "0")
if [ "$STORY_COUNT" = "0" ]; then
  log_error "Generated PRD has no user stories"
  echo "$OUTPUT"
  exit 1
fi

# Save PRD
echo "$JSON_OUTPUT" | jq . > "$PRD_FILE"

echo ""
log_success "PRD generated successfully!"
echo ""
log_info "Summary:"
jq -r '"  Project: \(.project)\n  Branch: \(.branchName)\n  Description: \(.description)\n  Stories: \(.userStories | length)"' "$PRD_FILE"
echo ""
log_info "User Stories:"
jq -r '.userStories[] | "  [\(.id)] \(.title) (priority: \(.priority))"' "$PRD_FILE"
echo ""
log_info "PRD saved to: $PRD_FILE"
echo ""
echo "Next steps:"
echo "  1. Review and edit $PRD_FILE if needed"
echo "  2. Run: ./ralph.sh"
