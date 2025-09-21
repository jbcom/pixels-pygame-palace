# Backend - Pixel's PyGame Palace

This backend provides a secure environment for executing pygame games with real-time streaming capabilities using subprocess execution.

## Key Features

- **pygame-ce Integration**: Uses pygame-ce (Community Edition) for enhanced pygame support with better maintenance, bug fixes, and new features
- **Secure Execution**: Subprocess-based execution with security controls
- **Real-time Streaming**: Live game frame capture and streaming
- **Code Validation**: AST-based security validation before execution
- **Resource Management**: Memory, CPU, and time limits for safe execution

## pygame-ce Benefits

This backend uses [pygame-ce](https://github.com/pygame-community/pygame-ce) (Community Edition) instead of standard pygame:

- **Better Maintenance**: Active community-driven development
- **Bug Fixes**: Faster resolution of issues
- **New Features**: Enhanced functionality while maintaining API compatibility
- **Drop-in Replacement**: No code changes needed, just install pygame-ce instead of pygame

## Quick Start

1. **Install Dependencies**: `uv sync` (pygame-ce is already configured in pyproject.toml)
2. **Run Backend**: `python app.py`

## Security

See [README_SECURITY.md](README_SECURITY.md) for comprehensive security implementation details.

## Development

The backend automatically detects pygame code and runs it in a secure subprocess environment. Games are executed with:
- Memory limit: 256MB
- CPU limit: 50% of one core  
- Time limit: 5 minutes
- Code validation and sandboxing

All pygame code continues to work exactly as before thanks to pygame-ce's compatibility and the secure subprocess execution environment.