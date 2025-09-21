# Docker Production Deployment Guide

This directory contains production Docker deployment configuration for Pixel's PyGame Palace.

## Architecture

The production deployment consists of three main services:

1. **PostgreSQL Database** (postgres:16-alpine)
   - Persistent data storage for lessons, user progress, projects
   - Health checks: `pg_isready`
   - Volumes: `postgres_data`

2. **Express API Gateway** (Node.js 20)
   - Frontend serving, API routing, database management
   - Proxies game execution requests to Flask service
   - Health checks: `/api/health`
   - Dependencies: PostgreSQL

3. **Flask Game Execution Service** (Python 3.11)
   - Secure game code execution in Docker containers
   - Uses game-executor image for sandboxed execution
   - Health checks: `/api/health`
   - Dependencies: Express service, Docker daemon

## Environment Variables

### Required for Production

```bash
# Database
POSTGRES_DB=pixel_gamedev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure-password>

# Security
JWT_SECRET=<cryptographically-secure-random-string>
FLASK_SECRET_KEY=<another-secure-random-string>

# Docker Enforcement
FORCE_DOCKER_EXECUTION=true
```

### Optional Configuration

```bash
# Logging
LOG_LEVEL=info

# Resource Limits
MAX_CONCURRENT_SESSIONS=5
MAX_SESSION_TIME=300
MAX_CODE_SIZE=100000

# Monitoring
ENABLE_METRICS=true
SENTRY_DSN=<sentry-dsn>
```

## Deployment Commands

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

### Build Only
```bash
docker-compose build
```

### View Logs
```bash
docker-compose logs -f [service-name]
```

## Health Checks

All services include comprehensive health checks:

### Express (`/api/health`)
- Database connectivity
- Flask service availability 
- Docker daemon status (production)
- Memory and uptime metrics

### Flask (`/api/health`)
- Docker daemon connectivity
- Game executor image availability
- Resource usage monitoring
- Active session tracking

### PostgreSQL
- Built-in `pg_isready` check
- Connection validation

## Security Features

1. **Non-root containers**: All services run as user 1000:1000
2. **Read-only filesystems**: Containers are read-only except for specific tmpfs mounts
3. **Network isolation**: Services communicate via internal Docker network
4. **Resource limits**: CPU and memory constraints prevent resource exhaustion
5. **Docker-only execution**: Production mode enforces containerized game execution
6. **Capability dropping**: Containers run with minimal capabilities

## Monitoring

Health check endpoints provide detailed status information:

```bash
# Express service health
curl http://localhost:5000/api/health

# Flask service health  
curl http://localhost:5001/api/health

# Database status via Express
curl http://localhost:5000/api/flask-health
```

## Troubleshooting

### Service won't start
1. Check environment variables are set
2. Verify Docker daemon is running
3. Check service logs: `docker-compose logs [service]`

### Game execution fails
1. Verify `FORCE_DOCKER_EXECUTION=true`
2. Check Docker daemon connectivity from Flask container
3. Ensure game-executor image is built
4. Check Flask service logs for detailed errors

### Database connection issues
1. Verify PostgreSQL is healthy: `docker-compose ps`
2. Check database credentials
3. Ensure PostgreSQL is accepting connections

### Performance issues
1. Monitor resource usage via health endpoints
2. Check Docker resource limits
3. Review active game sessions count
4. Monitor system memory and CPU usage

## File Structure

```
docker/
├── README.md                 # This file
└── postgres/
    └── init.sql             # Database initialization

backend/
├── Dockerfile.flask         # Flask service container
├── Dockerfile.game-executor # Game execution sandbox
├── entrypoint.sh           # Flask startup script
└── requirements.txt        # Python dependencies

Dockerfile.express          # Express service container
docker-compose.yml          # Base compose configuration
docker-compose.production.yml # Production overrides
```