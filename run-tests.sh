#!/bin/bash

# Test runner script for the TypeScript-Python pygame builder

echo "TypeScript-Python Pygame Builder Test Suite"
echo "==========================================="
echo ""

# Run different test suites based on the argument
case "$1" in
  "unit")
    echo "Running unit tests..."
    npx vitest run
    ;;
  "ui")
    echo "Opening test UI..."
    npx vitest --ui
    ;;
  "coverage")
    echo "Running tests with coverage..."
    npx vitest run --coverage
    ;;
  "e2e")
    echo "Running E2E tests..."
    npx playwright test
    ;;
  "all")
    echo "Running all tests..."
    npx vitest run --coverage
    echo ""
    echo "Running E2E tests..."
    npx playwright test
    ;;
  *)
    echo "Usage: ./run-tests.sh [unit|ui|coverage|e2e|all]"
    echo ""
    echo "Options:"
    echo "  unit      - Run unit tests"
    echo "  ui        - Open test UI"
    echo "  coverage  - Run tests with coverage report"
    echo "  e2e       - Run end-to-end tests"
    echo "  all       - Run all tests"
    echo ""
    echo "Example: ./run-tests.sh unit"
    exit 1
    ;;
esac