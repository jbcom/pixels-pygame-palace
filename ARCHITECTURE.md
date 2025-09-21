# System Architecture Documentation

## Overview

The Pixel's PyGame Palace system follows a microservices architecture with clear separation of concerns between two main services:

1. **Express Backend (Node.js) - Port 5000** - Main API gateway and web server
2. **Flask Backend (Python) - Port 5001** - Dedicated game execution engine

## Service Boundaries

### Express Backend (Port 5000)
**Primary Responsibilities:**
- Frontend serving (React application)
- API gateway and request routing
- Database operations (PostgreSQL via Drizzle ORM)
- User management and authentication
- Project management (CRUD operations)
- Lesson management
- Gallery functionality
- Session management
- Proxying game execution requests to Flask

**Endpoints Owned:**
- `/api/health` - Express service health check
- `/api/flask-health` - Flask service health check
- `/api/lessons/*` - Lesson management
- `/api/progress/*` - User progress tracking
- `/api/projects/*` - Project CRUD operations
- `/api/gallery/*` - Gallery functionality
- All frontend routes

### Flask Backend (Port 5001)
**Primary Responsibilities:**
- Python game code compilation
- Secure game execution in sandboxed environment
- Real-time game streaming via Server-Sent Events (SSE)
- Game session management
- Input handling for running games

**Endpoints Owned (all proxied through Express):**
- `/api/compile` - Compile game from components
- `/api/execute` - Execute Python game code
- `/api/game-stream/:sessionId` - Stream game frames via SSE
- `/api/stop-game/:sessionId` - Stop running game session
- `/api/game-input/:sessionId` - Send input to running game
- `/api/sessions` - List active game sessions

## Data Flow

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Browser   │──────▶│   Express    │──────▶│   Flask     │
│  (React)    │◀──────│   :5000      │◀──────│   :5001     │
└─────────────┘       └──────────────┘       └─────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  PostgreSQL  │
                      └──────────────┘
```

### Request Flow for Game Execution:
1. **User Action**: User clicks "Run Game" in browser
2. **Frontend Request**: React app sends POST to `/api/execute`
3. **Express Proxy**: Express generates JWT token and forwards to Flask
4. **Flask Processing**: Flask validates token, executes game code
5. **Stream Response**: Flask returns session ID, streams game frames
6. **Express Relay**: Express relays SSE stream to browser
7. **Frontend Display**: React renders game frames in real-time

## Authentication & Security

### JWT Token Flow
1. Express generates JWT tokens for Flask service calls
2. Tokens include user ID, session ID, and expiration
3. Flask validates tokens on every request
4. Shared secret key ensures secure communication

### Security Configuration
- **JWT Secret**: Shared between services (environment variable)
- **Token Expiry**: 1 hour
- **Session Timeout**: 5 minutes for game execution
- **Rate Limiting**: Configured per endpoint type
  - General: 100 requests per 15 minutes
  - Strict: 20 requests per 15 minutes  
  - Game Execution: 10 requests per 15 minutes

## Configuration

### Shared Configuration (`shared/config.ts`)
Central configuration file that:
- Defines service ports and URLs
- Sets rate limiting rules
- Configures CORS origins
- Defines game execution parameters
- Manages security settings

### Python Configuration (`backend/config.py`)
Auto-generated from `shared/config.ts` to ensure consistency

## Database Schema

### Primary Tables (managed by Express)
- `users` - User accounts
- `sessions` - Authentication sessions
- `game_projects` - Saved game projects
- `lessons` - Learning content
- `user_progress` - Progress tracking

### Data Types (`shared/schema.ts`)
Single source of truth for:
- Entity interfaces
- Request/response types
- Game execution types
- Service health check types

## Deployment Considerations

### Development Environment
```bash
# Terminal 1: Start Express (includes frontend)
npm run dev

# Terminal 2: Start Flask
cd backend
python app.py
```

### Production Environment
- Express serves on port 5000 (configurable via PORT env)
- Flask serves on port 5001
- Both services should run behind a reverse proxy (nginx/Apache)
- Use process managers (PM2 for Node.js, Gunicorn for Flask)

## Error Handling

### Service Unavailable
When Flask is not running:
- Express returns 503 Service Unavailable
- Includes helpful error message with start instructions
- Frontend displays appropriate user message

### Game Execution Errors
- Code validation errors: Return 400 with details
- Runtime errors: Stream error event via SSE
- Session timeout: Automatic cleanup after 5 minutes

## Monitoring & Health Checks

### Health Check Endpoints
- `/api/health` - Express service status
- `/api/flask-health` - Flask service status (proxied)

### Monitoring Points
- Active game sessions count
- Session duration tracking
- Error rate monitoring
- Service availability checks

## Future Enhancements

### Potential Improvements
1. **WebSocket Support**: Replace SSE with WebSockets for bidirectional communication
2. **Redis Cache**: Add Redis for session management and caching
3. **Queue System**: Implement job queue for game execution
4. **Horizontal Scaling**: Support multiple Flask instances with load balancing
5. **Docker Containers**: Containerize services for easier deployment

## Troubleshooting

### Common Issues

**Issue**: "Game execution service is unavailable"
- **Cause**: Flask backend not running
- **Solution**: Start Flask with `cd backend && python app.py`

**Issue**: "Maximum concurrent sessions reached"
- **Cause**: Too many active game sessions
- **Solution**: Wait for sessions to timeout or manually clear

**Issue**: "Token has expired"
- **Cause**: JWT token older than 1 hour
- **Solution**: Refresh page to generate new token

## API Documentation

For detailed API documentation, see:
- Express endpoints: Defined in `server/routes.ts`
- Flask endpoints: Defined in `backend/app.py`
- Shared types: Defined in `shared/schema.ts`