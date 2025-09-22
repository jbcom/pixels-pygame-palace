import { z } from 'zod';
import baseConfig from './config.json';

// Define the schema for type safety and validation
const configSchema = z.object({
  services: z.object({
    express: z.object({
      port: z.number(),
    }),
    flask: z.object({
      port: z.number(),
      url: z.string(),
    }),
  }),
  rateLimits: z.object({
    general: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
    strict: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
    gameExecution: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
    compilation: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
  }),
  rate_limits: z.object({
    general: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
    strict: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
    game_execution: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
    compilation: z.object({
      windowMs: z.number(),
      window_ms: z.number(),
      max: z.number(),
    }),
  }),
  game: z.object({
    maxConcurrentSessions: z.number(),
    maxSessionTime: z.number(),
    maxCodeSize: z.number(),
    screenWidth: z.number(),
    screenHeight: z.number(),
    fps: z.number(),
    streamFps: z.number(),
  }),
  cors: z.object({
    allowedOrigins: z.array(z.string()),
    methods: z.array(z.string()),
    allowedHeaders: z.array(z.string()),
    credentials: z.boolean(),
  }),
  security: z.object({
    jwtExpiry: z.string(),
    jwtSecret: z.string().nullable(),
    sessionTimeout: z.number(),
  }),
});

export type Config = z.infer<typeof configSchema>;

// Parse and validate the base config
const validatedConfig = configSchema.parse(baseConfig);

// Apply environment overrides
export const ServiceConfig: Config & {
  security: Config['security'] & { jwtSecret: string };
} = {
  ...validatedConfig,
  services: {
    express: {
      port: parseInt(process.env.PORT || String(validatedConfig.services.express.port), 10),
    },
    flask: {
      port: parseInt(process.env.FLASK_PORT || String(validatedConfig.services.flask.port), 10),
      url: process.env.FLASK_URL || validatedConfig.services.flask.url,
    },
  },
  security: {
    ...validatedConfig.security,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  },
};

// Helper function to get CORS config for Express
export function getCorsConfig() {
  return {
    origin: (origin: string | undefined, callback: Function) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);

      // Check if origin matches any pattern
      const isAllowed = ServiceConfig.cors.allowedOrigins.some((pattern) => {
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
    credentials: ServiceConfig.cors.credentials,
    methods: ServiceConfig.cors.methods,
    allowedHeaders: ServiceConfig.cors.allowedHeaders,
  };
}

// For backward compatibility
export const RATE_LIMITS = ServiceConfig.rateLimits;
export const GAME = ServiceConfig.game;
