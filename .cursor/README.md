# Cursor Background Agent Environment

This directory contains configuration for Cursor's background agent environment to replicate the Replit development environment.

## Files

- `Dockerfile`: Defines the container environment with all necessary dependencies for Python/TypeScript development, SDL2/arcade graphics, and testing tools
- `environment.json`: Cursor-specific configuration that tells Cursor how to build and use the Docker environment

## Environment Features

The Dockerfile sets up:
- Python 3.13 with uv package manager
- SDL2 and graphics libraries for arcade game development  
- OpenGL libraries for software rendering
- X11 libraries for GUI testing with Xvfb
- Headless mode environment variables for testing
- Just command runner for task automation

## Usage

This configuration is automatically used by Cursor background agents when running tasks in this repository. The environment ensures consistency between local development and CI/CD environments.