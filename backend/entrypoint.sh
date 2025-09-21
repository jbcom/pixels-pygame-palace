#!/bin/sh
# Flask Service Entrypoint Script

set -e

echo "Starting Flask Game Execution Service..."

# Wait for database to be ready (if using PostgreSQL)
if command -v pg_isready >/dev/null 2>&1; then
    echo "Waiting for database connection..."
    until pg_isready -h ${POSTGRES_HOST:-postgres} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-postgres}; do
      echo "Database is unavailable - sleeping"
      sleep 2
    done
    echo "Database is ready!"
fi

# Start the Flask application
echo "Starting Flask application on port ${FLASK_PORT:-5001}..."
exec "$@"