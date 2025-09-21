# Pixel's PyGame Palace - Replit Architecture

## Overview

Full-stack educational platform teaching Python game development through conversational guidance. Features a React frontend with Express server and Flask backend that executes real Pygame code with live streaming.

## Architecture

### Mixed Stack Orchestration
- **Frontend**: React + TypeScript + Vite (port 5173 dev / 5000 prod)
- **API Server**: Express.js with TypeScript (port 5000)
- **Game Engine**: Flask + Python with Pygame execution (port 5001)
- **Orchestration**: npm manages both Node.js and Python environments

### Process Management
All services managed through npm scripts using `concurrently`:
```bash
npm run dev      # Starts all services in development mode
npm run build    # Builds frontend, server, and syncs Python deps
npm run start    # Production mode with all services
```

## Configuration

### Unified Config System
Single source of truth in `shared/config.json`:
- TypeScript: Loaded and validated with Zod in `shared/config.ts`
- Python: Loaded with environment overrides in `backend/config.py`
- Environment variables override defaults for both stacks

### Environment Variables
```env
PORT=5000                    # Express server port
FLASK_PORT=5001             # Flask backend port
FLASK_ENV=development       # Flask environment
NODE_ENV=development        # Node environment
JWT_SECRET=dev-secret       # Authentication secret
```

## Development Workflow

### Initial Setup
```bash
npm install          # Installs Node deps + Python env via postinstall
```

### Development Commands
```bash
npm run dev          # Start all services with hot reload
npm run check        # TypeScript + Python type checking
npm run test:all     # Run tests for both stacks
npm run lint         # Lint TypeScript and Python
npm run format       # Format all code
```

### Service-Specific Commands
```bash
npm run dev:client   # Vite dev server only
npm run dev:server   # Express server only
npm run dev:python   # Flask backend only
```

## Project Structure

```
/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   └── pages/       # Route components
│   └── index.html       # Entry point
├── server/              # Express backend
│   ├── index.ts         # Server entry
│   ├── routes/          # API routes
│   └── db/             # Database schema
├── backend/            # Python Flask backend
│   ├── app.py          # Flask application
│   ├── config.py       # Configuration loader
│   ├── game_executor.py # Pygame execution engine
│   └── pyproject.toml  # Python dependencies
├── shared/             # Shared between stacks
│   ├── config.json     # Configuration source
│   └── config.ts       # TypeScript config loader
├── package.json        # Node dependencies & scripts
└── .replit            # Replit configuration
```

## Backend Services

### Express API Server (Port 5000)
- Serves React application
- Handles user authentication
- Manages project storage
- Proxies WebSocket to Flask

### Flask Game Engine (Port 5001)
- Executes real Pygame code
- Streams game frames via SSE
- Handles game input via WebSocket
- Manages virtual display with Xvfb

## Real Pygame Execution

### Server-Side Execution
- **Process Isolation**: Each game runs in subprocess
- **Virtual Display**: Xvfb provides headless framebuffer
- **Frame Capture**: SDL2 frames encoded as PNG
- **Stream Protocol**: Server-Sent Events at 30 FPS
- **Input Handling**: WebSocket for keyboard/mouse events

### API Endpoints
```
POST /api/compile          # Convert components to Pygame code
POST /api/execute          # Start game execution, returns session ID
GET  /api/game-stream/:id  # SSE stream of game frames
WS   /socket.io           # WebSocket for game input
GET  /api/projects        # List user projects
POST /api/projects        # Create new project
```

## Port Configuration

| Service | Dev Port | Prod Port | Purpose |
|---------|----------|-----------|---------|
| Vite | 5173 | - | Frontend dev server |
| Express | 5000 | 5000 | API & static serving |
| Flask | 5001 | 5001 | Game execution |

## Replit Configuration

### Nix Dependencies
The `replit.nix` includes all required system packages:
- **Python**: 3.13 with uv package manager
- **Node.js**: v24 (via modules)
- **SDL2**: Full SDL2 stack for Pygame
- **Xvfb**: Virtual display for headless execution
- **Build Tools**: gcc, make, pkg-config
- **Browser Testing**: Chromium, ChromeDriver

### Auto-Bootstrap
On container boot:
1. `npm install` runs automatically
2. `postinstall` sets up Python environment
3. `predev` validates configuration
4. All services start with `npm run dev`

## Dependencies Management

### Node.js (package.json)
- **Frontend**: React, Radix UI, Tailwind CSS
- **Backend**: Express, Drizzle ORM, Passport
- **Tooling**: Vite, TypeScript, ESLint, Prettier
- **Process**: Concurrently for multi-service orchestration

### Python (pyproject.toml)
- **Framework**: Flask, Flask-CORS, Flask-SocketIO
- **Game Engine**: Pygame, Pillow
- **Tooling**: Black, Ruff, MyPy, Pytest

## Deployment

### Build Process
```bash
npm run build
# - Builds React app with Vite
# - Bundles Express server with esbuild  
# - Syncs Python dependencies with uv
```

### Production Start
```bash
npm run start
# - Starts Flask with Gunicorn (eventlet worker)
# - Starts Express in production mode
# - All managed by concurrently
```

## Development Tips

### Config Changes
1. Edit `shared/config.json`
2. Run `npm run validate:config` to verify
3. Both TypeScript and Python auto-load changes

### Adding Dependencies
```bash
# Node.js dependency
npm install <package>

# Python dependency
cd backend && uv add <package>
```

### Debugging Services
Each service logs with color-coded prefix:
- 🟡 Yellow: Python/Flask backend
- 🔵 Cyan: Express server
- 🟢 Green: Vite frontend

### Performance Optimization
- Vite provides HMR for instant frontend updates
- Flask debug mode for backend auto-reload
- Shared config prevents drift between services
- Process isolation ensures clean game execution

## Troubleshooting

### Common Issues
1. **Port conflicts**: Check nothing else uses 5000/5001/5173
2. **Python env issues**: Run `cd backend && uv sync`
3. **Display errors**: Ensure Xvfb is installed (in replit.nix)
4. **Config mismatch**: Run `npm run validate:config`

### Logs Location
- Frontend: Browser console
- Express: Terminal output (cyan prefix)
- Flask: Terminal output (yellow prefix)
- Pygame: Subprocess stdout captured by Flask

## Security Notes

- Game execution isolated in subprocesses
- Temporary directories cleaned automatically
- JWT secrets must be changed in production
- CORS configured for local development only
- Virtual display prevents GUI access
- 