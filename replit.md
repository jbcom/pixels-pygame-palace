# Pixel's PyGame Palace

## Replit Configuration

This project is configured for Replit with the following setup:

### Environment
- **Node.js**: Version 24 (installed via Replit modules)
- **Python**: Version 3.13 (installed via Nix)
- **Web**: HTML/CSS/JS support (via Replit modules)

### Running NPM Commands
Since Replit agents cannot run npm commands directly, use one of these methods:

1. **Shell Script**: `./scripts/run-npm-task.sh [task-name]`
2. **Replit Tasks**: Use the task runner UI in Replit
3. **GitHub Actions**: Trigger workflows manually from the Actions tab

Available tasks:
- `install` - Install all dependencies
- `dev` - Start development server (all services)
- `build` - Build for production
- `test` - Run all tests
- `lint` - Lint all code
- `format` - Format all code

### Port Configuration
- Frontend (Vite): 5173 → 80 (external)
- Node Server: 5000 → 3000 (external)  
- Python Backend: 5001 → 3001 (external)

## Overview

Pixel's PyGame Palace is a comprehensive educational platform that teaches Python game development through an interactive, conversational approach. The system features a mascot named "Pixel" who guides users through creating six different game types (platformer, RPG, puzzle, racing, space shooter, dungeon crawler) via an intuitive wizard interface. The platform combines visual game development with real-time code generation, allowing users to see their games come to life as they make design choices. Built with modern web technologies, it serves both as a learning tool for beginners and a rapid prototyping environment for more experienced developers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built as a modern React 18 application with TypeScript, utilizing Vite for fast development and hot module replacement. The UI is constructed using Radix UI components with Tailwind CSS for styling, providing a responsive design that works across desktop, tablet, and mobile viewports. State management is handled through TanStack Query for server state, while the conversational wizard system guides users through game creation with real-time preview capabilities. The application supports comprehensive end-to-end testing via Playwright across multiple resolutions.

### Backend Architecture
The system employs a dual-backend architecture separating concerns between web serving and game compilation. An Express.js server (port 5000) handles frontend serving, API routing, JWT authentication, and project management. A Flask + Python backend (port 5001) manages PyGame code compilation, execution, and real-time WebSocket connections for live game preview. The Python backend uses pygame-ce (Community Edition) for enhanced pygame support and implements secure subprocess execution with resource limits and sandboxing for safe code execution.

### Game Development Pipeline
The platform supports six distinct game types through a sophisticated compilation orchestrator that validates component selections, resolves dependencies, generates code using Jinja2 templates, and packages assets. The system includes content-addressable caching for compilation results, deterministic hashing for build reproducibility, and support for both desktop and web (WebAssembly via pygbag) game targets. Asset management handles over 2,788 CC0-licensed game assets from Kenney.nl with automated packaging and optimization.

### Data Storage Solutions
The system uses Drizzle ORM for database operations with support for multiple database backends. Configuration is managed through a unified `shared/config.json` system that loads into both TypeScript (with Zod validation) and Python environments. Session data and game projects are stored with proper cleanup mechanisms and expiration handling.

## External Dependencies

### Core Runtime Dependencies
- **React Ecosystem**: React 18, TypeScript, Vite for frontend development
- **UI Components**: Extensive Radix UI component library for accessible interface elements
- **Backend Frameworks**: Express.js for web server, Flask for Python backend with Socket.IO for real-time communication
- **Game Engine**: pygame-ce (Community Edition) with enhanced pygame functionality
- **Database**: Drizzle ORM with PostgreSQL support for data persistence

### Development and Asset Tools
- **Asset Processing**: Pillow (PIL) for image manipulation and optimization
- **Web Game Compilation**: pygbag for WebAssembly game compilation targeting web browsers
- **Code Validation**: AST-based Python code analysis with security sandboxing
- **Testing Infrastructure**: Playwright for comprehensive end-to-end testing, Vitest for unit testing

### Security and Performance
- **Authentication**: JWT token-based authentication system
- **Rate Limiting**: Flask-Limiter for API rate limiting and abuse prevention
- **Sandboxing**: Subprocess-based secure execution environment with resource limits
- **Caching**: Content-addressable caching system with LRU management for compilation artifacts

### Asset and Content Management
- **Game Assets**: 2,788+ CC0-licensed assets from Kenney.nl for sprites, sounds, and game elements
- **Font Systems**: Multiple pixel art and vector fonts for game UI and text rendering
- **Audio Processing**: Support for various audio formats (WAV, OGG, MP3) with pygame mixer integration
- **Template Engine**: Jinja2 for dynamic code generation from game component selections