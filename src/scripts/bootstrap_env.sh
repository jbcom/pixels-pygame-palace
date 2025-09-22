#!/usr/bin/env bash
set -euo pipefail

# If we have a backend with Python deps, sync them
if [[ -d backend ]] && [[ -f backend/pyproject.toml ]]; then
  cd backend
  if [[ -f uv.lock ]]; then
    uv sync --frozen || uv sync
  else
    uv sync
  fi
  cd ..
fi

# Install Node deps
if [[ -f package.json ]]; then
  npm install
fi
