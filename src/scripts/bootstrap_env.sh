#!/usr/bin/env bash
set -euo pipefail

# If we have a backend with Python deps, sync them
if [[ -d src/backend ]] && [[ -f pyproject.toml ]]; then
  if [[ -f uv.lock ]]; then
    uv sync --frozen || uv sync
  else
    uv sync
  fi
fi

# Install Node deps
if [[ -f package.json ]]; then
  npm install
fi
