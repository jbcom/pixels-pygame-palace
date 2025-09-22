# Just command runner configuration
# https://just.systems/

# Default recipe - show available commands
default:
    @just --list

# Install all dependencies
install:
    npm install
    cd apps/backend && uv sync
    cd apps/frontend && npm install
    cd apps/server && npm install

# Run all tests
test: test-backend test-frontend test-e2e

# Run backend tests
test-backend:
    cd apps/backend && uv run pytest

# Run frontend tests
test-frontend:
    npm run test:frontend

# Run E2E tests
test-e2e:
    npm run test:e2e

# Start development servers
dev:
    npm run dev

# Build for production
build:
    npm run build

# Clean build artifacts and dependencies
clean:
    rm -rf node_modules
    rm -rf apps/*/node_modules
    rm -rf packages/*/node_modules
    rm -rf apps/backend/.venv
    rm -rf dist
    rm -rf apps/*/dist
    rm -rf coverage
    rm -rf .pytest_cache
    rm -rf .turbo

# Format code
format:
    npm run format
    cd apps/backend && uv run ruff format .

# Lint code
lint:
    npm run lint
    cd apps/backend && uv run ruff check .

# Type check
typecheck:
    npm run typecheck

# Run in headless mode for CI/testing
headless:
    #!/usr/bin/env bash
    set -e
    echo "Starting Xvfb..."
    Xvfb :99 -screen 0 1024x768x24 &
    export DISPLAY=:99
    just test

# Generate assets
generate-assets:
    cd packages/assets && uv run python generate_assets.py

# Generate sounds
generate-sounds:
    cd packages/assets && uv run python generate_sounds.py