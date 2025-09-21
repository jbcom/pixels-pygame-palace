#!/bin/bash

# Build script for the secure game executor Docker image

set -e

echo "Building secure game executor Docker image..."

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker daemon is not running. Please start Docker first."
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Navigate to backend directory
cd "$SCRIPT_DIR"

# Build the Docker image
echo "Building Docker image: game-executor:latest..."
docker build -f Dockerfile.game-executor -t game-executor:latest .

if [ $? -eq 0 ]; then
    echo "✓ Docker image built successfully: game-executor:latest"
    echo ""
    echo "Image details:"
    docker images game-executor:latest
    echo ""
    echo "To test the image manually, run:"
    echo "  docker run --rm -it game-executor:latest /bin/sh"
    echo ""
    echo "The Flask backend will automatically use this image for game execution."
else
    echo "✗ Failed to build Docker image"
    exit 1
fi