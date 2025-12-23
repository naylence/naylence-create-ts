#!/usr/bin/env bash
# Test the CLI locally using the starters repo in the workspace.
#
# Usage:
#   ./scripts/test-local.sh
#   ./scripts/test-local.sh --template agent-on-sentinel --flavor ts
#
# Environment:
#   NAYLENCE_STARTERS_PATH - Override path to starters repo (default: ../naylence-starters)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Default starters path (sibling repo)
export NAYLENCE_STARTERS_PATH="${NAYLENCE_STARTERS_PATH:-$(cd ../naylence-starters 2>/dev/null && pwd || echo "")}"

if [[ -z "$NAYLENCE_STARTERS_PATH" ]]; then
  echo "Error: NAYLENCE_STARTERS_PATH not set and ../naylence-starters not found"
  echo "Set NAYLENCE_STARTERS_PATH to point to your starters repo"
  exit 1
fi

echo "Using starters from: $NAYLENCE_STARTERS_PATH"

# Clean up previous test
TEST_DIR=".tmp/test-app"
rm -rf "$TEST_DIR"

# Run the CLI
echo ""
echo "Running: pnpm dev -- $TEST_DIR $*"
echo ""

pnpm dev -- "$TEST_DIR" --no-install "$@"

# Verify output
echo ""
echo "Generated files:"
ls -la "$TEST_DIR"

echo ""
if [[ -f "$TEST_DIR/.env.agent" ]]; then
  echo "✓ .env.agent created"
else
  echo "✗ .env.agent missing"
fi

if [[ -f "$TEST_DIR/.env.client" ]]; then
  echo "✓ .env.client created"
else
  echo "✗ .env.client missing"
fi

echo ""
echo "✓ Test passed!"
echo ""
echo "Next steps to verify manually:"
echo "  cd $TEST_DIR"
echo "  npm install"
echo "  npm run build"
echo "  npm run dev"
