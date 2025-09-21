// Shared configuration for both Express and Flask services
export const ServiceConfig = {
  // Service ports
  EXPRESS_PORT: parseInt(process.env.PORT || '5000', 10),
  FLASK_PORT: 5001,
  
  // Service URLs
  FLASK_URL: process.env.FLASK_URL || 'http://localhost:5001',
  
  // Rate limiting configuration
  RATE_LIMITS: {
    GENERAL: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
    STRICT: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // limit each IP to 20 requests per windowMs
    },
    GAME_EXECUTION: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // limit each IP to 10 game executions per windowMs
    }
  },
  
  // Game execution settings
  GAME: {
    MAX_CONCURRENT_SESSIONS: 10,
    MAX_SESSION_TIME: 300, // 5 minutes in seconds
    MAX_CODE_SIZE: 100000, // 100KB max code size
    SCREEN_WIDTH: 800,
    SCREEN_HEIGHT: 600,
    FPS: 60,
    STREAM_FPS: 30,
  },
  
  // CORS origins
  ALLOWED_ORIGINS: [
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:5000',
    'https://*.replit.dev',
    'https://*.repl.co'
  ],
  
  // Security settings
  SECURITY: {
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    JWT_EXPIRY: '1h',
    SESSION_TIMEOUT: 3600, // 1 hour in seconds
  }
};

// Helper function to get CORS config for Express
export function getCorsConfig() {
  return {
    origin: (origin: string | undefined, callback: Function) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      
      // Check if origin matches any pattern
      const isAllowed = ServiceConfig.ALLOWED_ORIGINS.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          return regex.test(origin);
        }
        return pattern === origin;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

// Export Python-compatible config for Flask
export function getPythonConfig() {
  return `# Auto-generated from shared/config.ts - DO NOT EDIT MANUALLY
import os

SERVICE_CONFIG = {
    'EXPRESS_PORT': ${ServiceConfig.EXPRESS_PORT},
    'FLASK_PORT': ${ServiceConfig.FLASK_PORT},
    'FLASK_URL': '${ServiceConfig.FLASK_URL}',
    'RATE_LIMITS': {
        'GENERAL': {
            'WINDOW_MS': ${ServiceConfig.RATE_LIMITS.GENERAL.windowMs},
            'MAX': ${ServiceConfig.RATE_LIMITS.GENERAL.max}
        },
        'STRICT': {
            'WINDOW_MS': ${ServiceConfig.RATE_LIMITS.STRICT.windowMs},
            'MAX': ${ServiceConfig.RATE_LIMITS.STRICT.max}
        },
        'GAME_EXECUTION': {
            'WINDOW_MS': ${ServiceConfig.RATE_LIMITS.GAME_EXECUTION.windowMs},
            'MAX': ${ServiceConfig.RATE_LIMITS.GAME_EXECUTION.max}
        }
    },
    'GAME': {
        'MAX_CONCURRENT_SESSIONS': ${ServiceConfig.GAME.MAX_CONCURRENT_SESSIONS},
        'MAX_SESSION_TIME': ${ServiceConfig.GAME.MAX_SESSION_TIME},
        'MAX_CODE_SIZE': ${ServiceConfig.GAME.MAX_CODE_SIZE},
        'SCREEN_WIDTH': ${ServiceConfig.GAME.SCREEN_WIDTH},
        'SCREEN_HEIGHT': ${ServiceConfig.GAME.SCREEN_HEIGHT},
        'FPS': ${ServiceConfig.GAME.FPS},
        'STREAM_FPS': ${ServiceConfig.GAME.STREAM_FPS}
    },
    'ALLOWED_ORIGINS': ${JSON.stringify(ServiceConfig.ALLOWED_ORIGINS)},
    'SECURITY': {
        'JWT_SECRET': os.environ.get('JWT_SECRET', 'dev-secret-change-in-production'),
        'JWT_EXPIRY': '${ServiceConfig.SECURITY.JWT_EXPIRY}',
        'SESSION_TIMEOUT': ${ServiceConfig.SECURITY.SESSION_TIMEOUT}
    }
}
`;
}