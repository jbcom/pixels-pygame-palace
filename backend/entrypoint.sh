#!/bin/sh
# Flask Service Entrypoint Script

set -e

echo "Starting Flask Game Execution Service..."

# Wait for database to be ready
echo "Waiting for database connection..."
until pg_isready -h postgres -p 5432 -U ${POSTGRES_USER:-postgres}; do
  echo "Database is unavailable - sleeping"
  sleep 2
done
echo "Database is ready!"

# Verify Docker is available in production
if [ "$FORCE_DOCKER_EXECUTION" = "true" ]; then
    echo "Production mode: Verifying Docker availability..."
    if ! docker info >/dev/null 2>&1; then
        echo "FATAL: Docker is not available but FORCE_DOCKER_EXECUTION=true"
        echo "Production deployment requires Docker for secure game execution"
        exit 1
    fi
    echo "Docker verification successful"
fi

# Build game executor image if it doesn't exist
echo "Ensuring game executor image is available..."
if ! docker images | grep -q "game-executor"; then
    echo "Building game executor image..."
    docker build -t game-executor:latest -f Dockerfile.game-executor .
else
    echo "Game executor image found"
fi

# Start the Flask application
echo "Starting Flask application on port ${FLASK_PORT:-5001}..."
exec "$@"