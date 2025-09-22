#!/usr/bin/env bash
set -euo pipefail

# Helper script for running npm tasks in Replit
# Usage: ./scripts/run-npm-task.sh [task-name]

if [ $# -eq 0 ]; then
    echo "Available npm tasks:"
    echo ""
    echo "  install        - Install all dependencies"
    echo "  dev           - Start development server (all services)"
    echo "  dev:python    - Start Python backend only"
    echo "  dev:client    - Start frontend only"
    echo "  dev:server    - Start Node server only"
    echo "  build         - Build for production"
    echo "  test          - Run all tests"
    echo "  test:frontend - Run frontend tests"
    echo "  test:python   - Run backend tests"
    echo "  test:e2e      - Run E2E tests"
    echo "  lint          - Lint all code"
    echo "  format        - Format all code"
    echo "  typecheck     - Run TypeScript checks"
    echo "  clean         - Clean all build artifacts"
    echo "  clean:deps    - Clean all dependencies"
    echo ""
    echo "Usage: $0 <task-name>"
    exit 1
fi

TASK=$1
echo "Running npm task: $TASK"
echo "----------------------------------------"

# Ensure we're in the workspace root
cd "$(dirname "$0")/.."

# Run the npm task
npm run "$TASK"