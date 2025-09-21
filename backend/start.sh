#!/bin/bash
# Start script for Flask backend game execution service

echo "Starting Flask Game Execution Backend on port 5001..."

# Set environment variables
export FLASK_ENV=development
export FLASK_APP=app.py

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists (optional)
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Install dependencies if needed
if [ ! -f ".deps_installed" ]; then
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
    touch .deps_installed
fi

# Start Flask application
echo "Flask backend starting on http://localhost:5001"
python app.py