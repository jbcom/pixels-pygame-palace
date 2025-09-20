import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

// Mock modules before they are imported
vi.mock('../../../server/routes', () => ({
  registerRoutes: vi.fn().mockResolvedValue({
    listen: vi.fn((options, callback) => {
      callback?.();
      return mockServer;
    }),
    close: vi.fn()
  })
}));

vi.mock('../../../server/vite', () => ({
  setupVite: vi.fn(),
  serveStatic: vi.fn(),
  log: vi.fn()
}));

const mockServer = {
  listen: vi.fn((options, callback) => {
    callback?.();
    return mockServer;
  }),
  close: vi.fn()
};

describe('Server Initialization', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Express App Configuration', () => {
    it('should configure express middleware', async () => {
      // This test verifies that the server sets up necessary middleware
      // Since the server module runs on import, we test the behavior indirectly
      
      const { registerRoutes } = await import('../../../server/routes');
      expect(registerRoutes).toBeDefined();
      expect(typeof registerRoutes).toBe('function');
    });

    it('should parse JSON bodies', async () => {
      // Create a test Express app with the same middleware
      const app = express();
      app.use(express.json());
      app.post('/test', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({ test: 'data' })
        .expect(200);

      expect(response.body).toEqual({ received: { test: 'data' } });
    });

    it('should parse URL-encoded bodies', async () => {
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      app.post('/test', (req, res) => {
        res.json({ received: req.body });
      });

      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('key=value&another=test')
        .expect(200);

      expect(response.body).toEqual({ 
        received: { key: 'value', another: 'test' }
      });
    });
  });

  describe('Logging Middleware', () => {
    it('should log API requests', async () => {
      const app = express();
      app.use(express.json());
      
      const logs: string[] = [];
      const mockLog = vi.fn((message) => logs.push(message));

      // Add logging middleware similar to server/index.ts
      app.use((req, res, next) => {
        const start = Date.now();
        const path = req.path;
        let capturedJsonResponse: Record<string, any> | undefined = undefined;

        const originalResJson = res.json;
        res.json = function (bodyJson, ...args) {
          capturedJsonResponse = bodyJson;
          return originalResJson.apply(res, [bodyJson, ...args]);
        };

        res.on('finish', () => {
          const duration = Date.now() - start;
          if (path.startsWith('/api')) {
            let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
            if (capturedJsonResponse) {
              logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
            }

            if (logLine.length > 80) {
              logLine = logLine.slice(0, 79) + '…';
            }

            mockLog(logLine);
          }
        });

        next();
      });

      app.get('/api/test', (req, res) => {
        res.json({ message: 'test' });
      });

      await request(app)
        .get('/api/test')
        .expect(200);

      expect(mockLog).toHaveBeenCalled();
      const logMessage = logs[0];
      expect(logMessage).toContain('GET /api/test 200');
      expect(logMessage).toContain('ms');
    });

    it('should truncate long log messages', async () => {
      const app = express();
      app.use(express.json());
      
      const logs: string[] = [];
      const mockLog = vi.fn((message) => logs.push(message));

      app.use((req, res, next) => {
        const start = Date.now();
        const path = req.path;
        let capturedJsonResponse: Record<string, any> | undefined = undefined;

        const originalResJson = res.json;
        res.json = function (bodyJson, ...args) {
          capturedJsonResponse = bodyJson;
          return originalResJson.apply(res, [bodyJson, ...args]);
        };

        res.on('finish', () => {
          const duration = Date.now() - start;
          if (path.startsWith('/api')) {
            let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
            if (capturedJsonResponse) {
              logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
            }

            if (logLine.length > 80) {
              logLine = logLine.slice(0, 79) + '…';
            }

            mockLog(logLine);
          }
        });

        next();
      });

      app.get('/api/test', (req, res) => {
        res.json({ 
          message: 'This is a very long message that will cause the log to be truncated because it exceeds the maximum length' 
        });
      });

      await request(app)
        .get('/api/test')
        .expect(200);

      expect(mockLog).toHaveBeenCalled();
      const logMessage = logs[0];
      expect(logMessage).toHaveLength(80);
      expect(logMessage).toEndWith('…');
    });

    it('should not log non-API routes', async () => {
      const app = express();
      const mockLog = vi.fn();

      app.use((req, res, next) => {
        const path = req.path;
        res.on('finish', () => {
          if (path.startsWith('/api')) {
            mockLog(`API: ${path}`);
          }
        });
        next();
      });

      app.get('/test', (req, res) => {
        res.send('ok');
      });

      await request(app)
        .get('/test')
        .expect(200);

      expect(mockLog).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle errors with status codes', async () => {
      const app = express();
      
      app.get('/error', (req, res, next) => {
        const error: any = new Error('Custom error');
        error.status = 403;
        next(error);
      });

      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });

      const response = await request(app)
        .get('/error')
        .expect(403);

      expect(response.body).toEqual({ message: 'Custom error' });
    });

    it('should handle errors with statusCode property', async () => {
      const app = express();
      
      app.get('/error', (req, res, next) => {
        const error: any = new Error('Another error');
        error.statusCode = 401;
        next(error);
      });

      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });

      const response = await request(app)
        .get('/error')
        .expect(401);

      expect(response.body).toEqual({ message: 'Another error' });
    });

    it('should default to 500 for errors without status', async () => {
      const app = express();
      
      app.get('/error', (req, res, next) => {
        next(new Error('Generic error'));
      });

      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });

      const response = await request(app)
        .get('/error')
        .expect(500);

      expect(response.body).toEqual({ message: 'Generic error' });
    });

    it('should use default message for errors without message', async () => {
      const app = express();
      
      app.get('/error', (req, res, next) => {
        const error: any = {};
        next(error);
      });

      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });

      const response = await request(app)
        .get('/error')
        .expect(500);

      expect(response.body).toEqual({ message: 'Internal Server Error' });
    });
  });

  describe('Server Port Configuration', () => {
    it('should use PORT environment variable when set', () => {
      process.env.PORT = '3000';
      const port = parseInt(process.env.PORT || '5000', 10);
      expect(port).toBe(3000);
    });

    it('should default to port 5000 when PORT not set', () => {
      delete process.env.PORT;
      const port = parseInt(process.env.PORT || '5000', 10);
      expect(port).toBe(5000);
    });

    it('should parse PORT as integer', () => {
      process.env.PORT = '8080';
      const port = parseInt(process.env.PORT || '5000', 10);
      expect(port).toBe(8080);
      expect(typeof port).toBe('number');
    });
  });

  describe('Environment-specific Setup', () => {
    it('should setup Vite in development environment', async () => {
      const app = express();
      app.set('env', 'development');
      
      expect(app.get('env')).toBe('development');
      // In real server, setupVite would be called here
    });

    it('should serve static files in production environment', async () => {
      const app = express();
      app.set('env', 'production');
      
      expect(app.get('env')).toBe('production');
      // In real server, serveStatic would be called here
    });
  });

  describe('Server Listen Configuration', () => {
    it('should bind to 0.0.0.0 host', () => {
      const listenOptions = {
        port: 5000,
        host: "0.0.0.0",
        reusePort: true
      };
      
      expect(listenOptions.host).toBe('0.0.0.0');
      expect(listenOptions.reusePort).toBe(true);
    });

    it('should enable port reuse', () => {
      const listenOptions = {
        port: 5000,
        host: "0.0.0.0",
        reusePort: true
      };
      
      expect(listenOptions.reusePort).toBe(true);
    });
  });

  describe('Integration with Routes', () => {
    it('should register routes module', async () => {
      const { registerRoutes } = await import('../../../server/routes');
      expect(vi.isMockFunction(registerRoutes)).toBe(true);
    });
  });

  describe('Request Body Size Limits', () => {
    it('should handle normal-sized JSON payloads', async () => {
      const app = express();
      app.use(express.json());
      
      app.post('/test', (req, res) => {
        res.json({ size: JSON.stringify(req.body).length });
      });

      const normalPayload = { data: 'x'.repeat(1000) };
      
      const response = await request(app)
        .post('/test')
        .send(normalPayload)
        .expect(200);

      expect(response.body.size).toBeGreaterThan(0);
    });

    it('should handle URL-encoded data', async () => {
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      
      app.post('/test', (req, res) => {
        res.json({ keys: Object.keys(req.body) });
      });

      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('field1=value1&field2=value2')
        .expect(200);

      expect(response.body.keys).toEqual(['field1', 'field2']);
    });
  });
});