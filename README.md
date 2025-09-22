# Pixel's PyGame Palace - Monorepo

A production-ready monorepo for Pixel's PyGame Palace, featuring a Python Flask backend, React frontend, and Node.js server.

## 🏗️ Project Structure

```
pixels-pygame-palace/
├── apps/                    # Application packages
│   ├── backend/            # Python Flask backend
│   │   ├── app.py         # Main Flask application
│   │   ├── pyproject.toml # Python dependencies
│   │   └── ...
│   ├── frontend/          # React frontend
│   │   ├── src/          # React source code
│   │   ├── index.html    # Entry HTML
│   │   ├── package.json  # Frontend dependencies
│   │   └── ...
│   └── server/           # Node.js Express server
│       ├── index.ts      # Server entry point
│       └── package.json  # Server dependencies
├── packages/              # Shared packages
│   ├── shared/           # Shared configurations and utilities
│   └── assets/           # Game assets and resources
├── tests/                # Test suites
│   └── e2e/             # End-to-end tests
├── scripts/             # Build and utility scripts
├── docs/                # Documentation
├── package.json         # Root workspace configuration
├── pyproject.toml       # Root Python configuration
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Python >= 3.13
- npm or yarn

### Installation

1. Install dependencies for all workspaces:
```bash
npm install
```

2. Install Python dependencies:
```bash
cd apps/backend && pip install -e .
```

### Development

Run all services concurrently:
```bash
npm run dev:all
```

Or run individual services:
```bash
# Backend (Flask)
npm run dev:backend

# Frontend (React + Vite)
npm run dev:frontend

# Server (Express)
npm run dev:server
```

### Building for Production

```bash
npm run build
```

This will:
- Build the React frontend with Vite
- Bundle the Express server with esbuild
- Prepare Python backend for deployment

### Testing

```bash
# Run all tests
npm run test:all

# Run JavaScript/TypeScript tests
npm run test

# Run Python tests
npm run test:python

# Run E2E tests
npx playwright test
```

## 📦 Workspace Packages

### @pixels/backend
Python Flask backend handling game compilation, execution, and WebSocket communication.

### @pixels/frontend
React frontend with Vite, featuring the game editor and preview interface.

### @pixels/server
Express server handling static file serving and development middleware.

### @pixels/shared
Shared configurations, types, and utilities used across the monorepo.

### @pixels/assets
Game assets including sprites, sounds, and other resources.

## 🛠️ Configuration

- **Workspaces**: Managed via npm workspaces in root `package.json`
- **TypeScript**: Project references for proper type checking across packages
- **Vite**: Configured with proper aliases and build paths
- **Python**: Using modern pyproject.toml with hatchling

## 🔧 Environment Variables

Create a `.env` file in the root:

```env
FLASK_PORT=5001
NODE_ENV=development
PORT=5000
```

## 📝 License

MIT