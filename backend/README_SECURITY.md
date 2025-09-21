# Security Implementation for Game Executor

## Overview
This backend implements secure sandboxing for executing untrusted Python game code using Docker containerization and enhanced security validation.

## Security Features

### 1. Docker Containerization
- **Isolated Execution**: All game code runs in Docker containers with strict isolation
- **Resource Limits**: 
  - Memory: 256MB max
  - CPU: 50% of one core
  - Process limit: 50 processes
  - Timeout: 5 minutes max execution
- **Network Isolation**: Containers run with `--network=none`
- **Filesystem Protection**: Read-only filesystem except `/tmp`
- **Non-root Execution**: Games run as unprivileged `gamerunner` user
- **Capability Dropping**: All Linux capabilities dropped
- **No New Privileges**: Prevents privilege escalation

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

### 4. Xvfb Security
- **Authentication**: Uses `.Xauthority` file instead of `-ac` flag
- **Display Isolation**: Each container gets its own virtual display
- **No Access Control Bypass**: Removed insecure `-ac` flag

## Setup Instructions

### 1. Install Dependencies
```bash
# Python dependencies (already installed)
pip install docker flask flask-cors flask-socketio flask-limiter pygame-ce pillow

# System dependencies
apt-get update && apt-get install -y docker.io xvfb
```

### 2. Build Docker Image
```bash
cd backend
./build_docker.sh
```

### 3. Environment Variables
For production, set these environment variables:
```bash
export FLASK_ENV=production
export FLASK_SECRET_KEY="your-secure-random-secret-key-here"
export USE_DOCKER=true  # Force Docker usage
```

### 4. Run the Backend
```bash
python backend/app.py
```

## Security Configuration

Edit `backend/security_config.py` to adjust:
- Sandbox resource limits
- Allowed Python modules
- Blacklisted functions
- Docker container settings

## Testing Security

### Test 1: Attempt File Access
```python
# This should be blocked
with open('/etc/passwd', 'r') as f:
    print(f.read())
```

### Test 2: Attempt Network Access
```python
# This should be blocked
import socket
s = socket.socket()
s.connect(('google.com', 80))
```

### Test 3: Attempt Process Spawn
```python
# This should be blocked
import subprocess
subprocess.run(['ls', '/'])
```

### Test 4: Valid Game Code
```python
# This should work
import pygame
pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("Safe Game")

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    screen.fill((0, 0, 0))
    pygame.display.flip()

pygame.quit()
```

## Monitoring & Logs

- Container logs: `docker logs game_<session_id>`
- Flask logs: Check console output
- Security violations: Logged to stderr

## Troubleshooting

### Docker Not Available
If Docker is not available, the system falls back to subprocess execution with:
- Resource limits via `resource` module
- Code validation still enforced
- Xvfb with authentication
- Warning logged about reduced security

### Building Docker Image Fails
1. Ensure Docker daemon is running: `sudo systemctl start docker`
2. Check Docker permissions: `sudo usermod -aG docker $USER`
3. Verify Dockerfile syntax

### Game Execution Fails
1. Check Docker image exists: `docker images | grep game-executor`
2. Verify container can start: `docker run --rm game-executor:latest echo "test"`
3. Check Flask logs for validation errors

## Security Considerations

1. **Never disable code validation** - This is the first line of defense
2. **Always use Docker in production** - Subprocess fallback is development-only
3. **Monitor resource usage** - Containers enforce limits but monitor for DoS
4. **Regular updates** - Keep Docker, Python packages, and system packages updated
5. **Audit logs** - Review execution logs for suspicious patterns

## Future Improvements

1. **Kubernetes Integration**: For better orchestration at scale
2. **gVisor/Firecracker**: Alternative sandboxing technologies
3. **Code Signing**: Validate trusted code sources
4. **Machine Learning**: Detect malicious patterns
5. **Distributed Execution**: Run games on separate worker nodes