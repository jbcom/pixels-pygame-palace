# PyGame Academy

## Overview

PyGame Academy is an interactive Python programming learning platform focused on teaching PyGame development through hands-on coding exercises. The application features a step-by-step lesson system where users can learn Python and PyGame concepts by writing code in an integrated editor, seeing their results in a simulated game canvas, and receiving real-time feedback on their progress.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built as a React single-page application using TypeScript and modern web technologies:

- **React Router**: Uses `wouter` for lightweight client-side routing between home page and individual lesson pages
- **State Management**: Leverages React Query (`@tanstack/react-query`) for server state management and caching, with local React state for UI interactions
- **UI Framework**: Built with shadcn/ui components library providing a comprehensive set of accessible, customizable components based on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming support
- **Code Editor**: Integrates Monaco Editor for syntax highlighting and Python code editing
- **Build System**: Vite for fast development and optimized production builds

### Backend Architecture
The server follows a REST API pattern with Express.js:

- **Framework**: Express.js with TypeScript for type safety
- **Data Storage**: In-memory storage implementation with interface abstraction for easy database migration
- **API Design**: RESTful endpoints for lessons and user progress tracking
- **Development Tools**: Custom middleware for request logging and error handling

### Code Execution System
The application implements a unique approach to Python code execution in the browser:

- **Pyodide Integration**: Uses Pyodide to run Python code directly in the browser without server-side execution
- **PyGame Simulation**: Custom simulation layer that interprets PyGame drawing commands and renders them on HTML5 canvas
- **Safety**: Client-side execution eliminates security concerns while providing real-time feedback

### Database Schema
The data model includes three main entities:

- **Users**: Basic user authentication with username/password
- **Lessons**: Structured content with steps, code examples, and solutions
- **UserProgress**: Tracks completion status, current step, and user's code for each lesson

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
- **Pyodide**: Python runtime for WebAssembly enabling browser-based Python execution

### Code Execution and Simulation
- **Pyodide**: Enables Python code execution in the browser
- **Custom PyGame Simulator**: Interprets PyGame commands and renders to HTML5 canvas
- **Canvas API**: For rendering simulated game graphics

### State Management and Data Fetching
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema parsing

The application is designed to be easily deployable on Replit with minimal configuration, using environment variables for database connections and featuring a development-friendly setup with hot reloading and error overlays.