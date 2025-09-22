#!/usr/bin/env bash
set -euo pipefail

# Install Node deps at workspace root
if [[ -f package.json ]]; then
  npm install
fi

# Python deps are handled by npm postinstall script which calls uv sync
