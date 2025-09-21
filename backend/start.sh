#!/bin/bash
# Startup script for Flask backend using uv

set -e

echo "🚀 Starting Pixel's PyGame Palace Backend"

# Check if uv is available
if ! command -v uv &> /dev/null; then
    echo "❌ uv not found. Please install uv first."
    echo "💡 Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")"

# Sync dependencies if needed
echo "📦 Syncing Python dependencies..."
uv sync

# Set default environment
export FLASK_ENV=${FLASK_ENV:-development}
export PORT=${PORT:-5001}

echo "🌍 Environment: $FLASK_ENV"
echo "🔢 Port: $PORT"

# Start the application
if [ "$FLASK_ENV" = "production" ]; then
    echo "🚀 Starting production server with Gunicorn..."
    uv run gunicorn app:app \
        -b 0.0.0.0:$PORT \
        -w 2 \
        --threads 4 \
        --timeout 90 \
        --keep-alive 2 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --log-level info
else
    echo "🔧 Starting development server..."
    uv run python app.py
fi