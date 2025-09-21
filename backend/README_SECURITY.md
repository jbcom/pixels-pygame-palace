# Security Implementation for Game Executor

## Overview
This backend implements secure sandboxing for executing untrusted Python game code using subprocess execution with enhanced security validation.

## Security Features

### 1. Subprocess Execution
- **Isolated Execution**: All game code runs in separate processes
- **Resource Limits**: 
  - Memory: 256MB max
  - CPU: 50% of one core
  - Process limit: 50 processes
  - Timeout: 5 minutes max execution
- **Environment Control**: Limited environment variables
- **Filesystem Protection**: Games run in temporary directories
- **Non-privileged Execution**: Games run without special privileges

### 2. Code Validation (AST-based)
- **Whitelist Approach**: Only allowed modules can be imported
- **Blacklist Validation**: Dangerous functions and patterns blocked
- **AST Analysis**: Deep code analysis before execution
- **Import Control**: Only pygame and safe standard library modules allowed

### 3. Flask Security
- **Secure SECRET_KEY**: Random generation in development, required env var in production
- **Session Security**: 
  - HTTPS-only cookies in production
  - HTTP-only flag to prevent XSS
  - SameSite protection against CSRF
  - 1-hour session timeout
- **Rate Limiting**: Prevents abuse of execution endpoints
- **CORS Protection**: Explicit origin whitelist

### 4. Virtual Display Security
- **Headless Execution**: Uses SDL dummy driver for graphics
- **Display Isolation**: Each process gets isolated display context
- **No GUI Access**: Games cannot access system GUI

## Setup Instructions

### 1. Install Dependencies
```bash
# Python dependencies (already installed)
pip install flask flask-cors flask-socketio flask-limiter pygame-ce pillow

# System dependencies for pygame (if needed)
apt-get update && apt-get install -y libsdl2-dev
```

### 2. Environment Variables
For production, set these environment variables:
```bash
export FLASK_ENV=production
export FLASK_SECRET_KEY="your-secure-random-secret-key-here"
```

### 3. Run the Backend
```bash
python backend/app.py
```

## Security Configuration

Edit `backend/security_config.py` to adjust:
- Sandbox resource limits
- Allowed modules whitelist
- Blacklisted functions and patterns
- Code validation rules

## Security Validation

The system performs multiple layers of validation:

1. **Static Analysis**: AST parsing to detect dangerous patterns
2. **Import Validation**: Only safe modules allowed
3. **Runtime Limits**: Resource and time constraints
4. **Process Isolation**: Each game runs in its own subprocess

## Whitelist of Allowed Modules

- `pygame` and all pygame submodules
- Safe standard library modules: `math`, `random`, `time`, `sys`, `json`, `collections`, etc.
- No filesystem, network, or system access modules

## Blacklisted Patterns

- File operations (`open`, `file`)
- Network operations (`socket`, `urllib`, `requests`)
- System operations (`os`, `subprocess`)
- Dynamic imports (`__import__`, `importlib`)
- Code execution (`eval`, `exec`, `compile`)

## Testing Security

Run the security test suite:
```bash
python backend/test_security.py
```

This validates that dangerous code patterns are properly blocked and safe code executes correctly.