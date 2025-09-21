# Pixel's PyGame Palace

## Overview

Pixel's PyGame Palace is a conversational, mascot-driven React application that teaches kids Python game development through reusable guided components. The platform features "Pixel," a cyberpunk mascot who guides users through organic conversational experiences with natural A/B choices for initial decisions, offering both a guided wizard flow for beginners and a professional WYSIWYG editor unlocked through conversation. The guided mode provides continuous linear progression where Pixel leads users through pre-built game components for Title Screen → Gameplay → End Credits, with stage-specific conditional content that adapts to the selected game type (platformer, RPG, dungeon, racing, puzzle, adventure).

## User Preferences

- **Communication Style**: Simple, everyday language without technical jargon
- **Visual Design**: Warm, soft colors (no harsh black/white contrast)
- **Educational Philosophy**: Teach concepts, not memorization
- **Accessibility**: All lessons available immediately (no artificial gating)
- **Layout**: Efficient use of space with minimal negative areas

## System Architecture

The application is a full-stack web platform combining a React frontend with a Flask backend that executes real pygame code on the server.

### Frontend Architecture
The frontend is built as a React single-page application using TypeScript and modern web technologies:

- **React Router**: Uses `wouter` for lightweight client-side routing between home page and individual lesson pages
- **State Management**: Leverages React Query (`@tanstack/react-query`) for server state management and caching, with local React state for UI interactions
- **UI Framework**: Built with shadcn/ui components library providing a comprehensive set of accessible, customizable components based on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming support
- **Code Editor**: Integrates Monaco Editor for syntax highlighting and Python code editing
- **Build System**: Vite for fast development and optimized production builds
- **Game Streaming**: Receives real-time game frames from backend via Server-Sent Events (SSE) and renders on HTML5 canvas

### Backend Architecture
The server provides real pygame execution and game streaming capabilities:

- **Framework**: Flask with Python, running on port 5001
- **CORS Support**: Configured to allow cross-origin requests from the React frontend
- **Real Pygame Execution**: Runs actual pygame code in subprocess with SDL2 backend
- **Virtual Display**: Uses Xvfb for headless pygame execution when no physical display is available
- **Frame Capture**: Captures pygame frames and converts to base64-encoded PNG images
- **Streaming**: Server-Sent Events (SSE) for real-time game frame streaming to frontend
- **API Endpoints**:
  - `/api/compile`: Compiles visual components into executable pygame code
  - `/api/execute`: Executes pygame code and returns session ID for streaming
  - `/api/game-stream/<session_id>`: SSE endpoint for streaming game frames
  - `/api/projects`: CRUD operations for game project management
- **Game Engine**: Custom GameExecutor class manages pygame subprocess, frame capture, and streaming
- **WebSocket Support**: Flask-SocketIO for bidirectional communication (game input, control commands)
- **Data Storage**: In-memory storage for projects (easily replaceable with database)

### Code Execution System
The application executes real pygame code on the server with streaming to the frontend:

- **Server-Side Pygame**: Real pygame with SDL2 backend runs on the Flask server
- **Virtual Display**: Xvfb provides a virtual framebuffer for headless pygame execution
- **Process Isolation**: Each game runs in its own subprocess with temporary directory
- **Frame Streaming**: Game frames are captured, encoded as PNG, and streamed via SSE
- **Input Handling**: User input is sent from frontend to backend via WebSocket
- **Session Management**: Each game execution gets a unique session ID for tracking
- **Safety**: Process isolation and automatic cleanup ensure security

### Database Schema
The data model includes three main entities:

- **Users**: Basic user authentication with username/password
- **Lessons**: Structured content with steps, code examples, and solutions
- **UserProgress**: Tracks completion status, current step, and user's code for each lesson

### Flask Backend Setup
The Flask backend (`backend/app.py`) provides the game execution infrastructure:

- **Port Configuration**: Runs on port 5001 to avoid conflicts with frontend development server
- **Dependencies**: Flask, Flask-CORS, Flask-SocketIO, Pygame, Pillow for image processing
- **Environment Setup**: Requires SDL2, Xvfb for virtual display, and Python 3.8+
- **Running the Backend**:
  ```bash
  cd backend
  python app.py  # Starts Flask server on port 5001
  ```

### Real Pygame Execution
The backend executes actual pygame code with full SDL2 support:

- **SDL2 Backend**: Real pygame runs with proper SDL2 video and dummy audio drivers
- **Display Management**: Automatically detects and uses physical display or creates virtual display with Xvfb
- **Frame Capture**: Modified pygame code captures frames using `pygame.image.tostring()` and PIL
- **Performance**: Streams at ~30 FPS with frame throttling and queue management
- **Resource Cleanup**: Automatic cleanup of Xvfb processes, temporary files, and display locks

### API Communication Flow
1. **Game Compilation**: Frontend sends component data to `/api/compile`, receives pygame code
2. **Game Execution**: Frontend posts code to `/api/execute`, receives session ID
3. **Frame Streaming**: Frontend connects to `/api/game-stream/<session_id>` SSE endpoint
4. **Input Handling**: Frontend sends input via WebSocket `game_input` events
5. **Project Management**: CRUD operations via `/api/projects` endpoints

### Component Architecture
The frontend is organized into reusable components:

- **Layout Components**: Header, sidebar navigation, and responsive layouts
- **Interactive Components**: Code editor, game canvas, floating feedback system
- **UI Components**: Comprehensive shadcn/ui component library for consistent design
- **Custom Components**: Specialized components for lesson content, progress tracking, and code execution

## External Dependencies

### Core Framework Dependencies
- **React 18**: Frontend framework with modern hooks and concurrent features
- **Express.js**: Backend web framework for Node.js
- **TypeScript**: Type system for enhanced development experience and code reliability

### Database and ORM
- **Drizzle ORM**: Type-safe SQL query builder and ORM
- **Neon Database**: PostgreSQL-compatible serverless database (configured but using in-memory storage currently)
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **shadcn/ui**: Pre-built component library with accessibility features
- **Radix UI**: Headless UI primitives for complex interactive components
- **Lucide React**: Icon library with consistent design language

### Development and Tooling
- **Vite**: Build tool and development server with hot module replacement
- **Replit Integration**: Special plugins for Replit development environment
- **Monaco Editor**: Web-based code editor (loaded via CDN)
- **Flask Development Server**: Backend development with auto-reload
- **Xvfb**: X Virtual Framebuffer for headless pygame execution

### Code Execution and Game Rendering
- **Pygame**: Real pygame library runs on server with full SDL2 support
- **Virtual Display**: Xvfb provides framebuffer for headless environments
- **Frame Capture**: Server captures pygame frames and encodes as PNG
- **SSE Streaming**: Server-Sent Events deliver frames to frontend in real-time
- **Canvas Rendering**: Frontend displays streamed frames on HTML5 canvas
- **WebSocket**: Bidirectional communication for game input and control

### State Management and Data Fetching
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema parsing

The application is designed as a full-stack platform easily deployable on Replit:

- **Frontend Server**: Vite dev server with Express.js serves the React app on port 5000
- **Backend Server**: Flask server runs pygame execution engine on port 5001
- **Communication**: Frontend communicates with backend via REST API, SSE, and WebSocket
- **Development Setup**: Both servers support hot reloading for rapid development
- **Production Ready**: Can be deployed with proper process management and scaling