import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { InsertProject } from "@shared/schema";
import { ServiceConfig } from "@shared/config";
import axios from "axios";
import jwt from "jsonwebtoken";

// Middleware to generate JWT token for Flask service calls
function generateFlaskAuthToken(userId: string = "mock-user-id"): string {
  const payload = {
    user: userId,
    session_id: Math.random().toString(36).substring(7),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, ServiceConfig.security.jwtSecret, {
    algorithm: 'HS256'
  });
}

// Proxy middleware for Flask game execution service
async function proxyToFlask(
  endpoint: string,
  req: Request,
  res: Response,
  method: 'GET' | 'POST' = 'POST'
): Promise<void> {
  try {
    const userId = "mock-user-id"; // In a real app, this would come from authentication
    const token = generateFlaskAuthToken(userId);
    
    const config = {
      method,
      url: `${ServiceConfig.services.flask.url}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: method === 'POST' ? req.body : undefined,
      params: method === 'GET' ? req.query : undefined,
      timeout: 30000 // 30 second timeout
    };
    
    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else if (error.request) {
        res.status(503).json({ 
          message: "Game execution service is unavailable",
          error: "Service connection failed",
          details: "Flask backend is not running on port 5001. Please start it with: cd backend && python app.py"
        });
      } else {
        res.status(500).json({ 
          message: "Failed to process request",
          error: error.message
        });
      }
    } else {
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
}

// SSE Proxy for game streaming
async function proxySSEToFlask(
  endpoint: string,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = "mock-user-id";
    const token = generateFlaskAuthToken(userId);
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const response = await axios({
      method: 'GET',
      url: `${ServiceConfig.services.flask.url}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream'
      },
      responseType: 'stream'
    });
    
    // Pipe the Flask SSE response to the client
    response.data.pipe(res);
    
    // Clean up on client disconnect
    req.on('close', () => {
      response.data.destroy();
    });
  } catch (error) {
    res.status(503).json({ 
      message: "Game streaming service unavailable",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export function registerRoutes(app: Express): void {
  // === SYSTEM HEALTH CHECKS ===
  
  // Express service health check with comprehensive diagnostics
  app.get("/api/health", async (req, res) => {
    const healthCheck = {
      status: 'healthy' as 'healthy' | 'unhealthy',
      service: 'express-backend',
      port: ServiceConfig.services.express.port,
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dependencies: {
        database: 'unknown',
        flask: 'unknown'
      },
      checks: {
        database: false,
        flask: false
      }
    };

    try {
      // Check database connection
      try {
        await storage.getLessons(); // Simple query to test DB
        healthCheck.dependencies.database = 'healthy';
        healthCheck.checks.database = true;
      } catch (error) {
        healthCheck.dependencies.database = 'unhealthy';
        healthCheck.status = 'unhealthy';
      }

      // Check Flask service
      try {
        const flaskResponse = await axios.get(`${ServiceConfig.services.flask.url}/api/health`, {
          timeout: 3000
        });
        healthCheck.dependencies.flask = flaskResponse.data.status || 'healthy';
        healthCheck.checks.flask = true;
      } catch (error) {
        healthCheck.dependencies.flask = 'unhealthy';
        // Don't mark overall status as unhealthy for Flask, as it's a dependency
      }


    } catch (error) {
      healthCheck.status = 'unhealthy';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  });
  
  // Flask service health check
  app.get("/api/flask-health", async (req, res) => {
    try {
      const response = await axios.get(`${ServiceConfig.services.flask.url}/api/health`, {
        timeout: 5000
      });
      res.json({
        ...response.data,
        reachable: true
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'pygame-execution-backend',
        reachable: false,
        error: error instanceof Error ? error.message : "Service unreachable",
        hint: "Start Flask backend with: cd backend && python app.py"
      });
    }
  });
  // Get all lessons
  app.get("/api/lessons", async (req, res) => {
    try {
      const lessons = await storage.getLessons();
      res.json(lessons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  // Get specific lesson
  app.get("/api/lessons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const lesson = await storage.getLesson(id);
      
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      
      res.json(lesson);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lesson" });
    }
  });

  // Get user progress for all lessons (mock user ID for now)
  app.get("/api/progress", async (req, res) => {
    try {
      const userId = "mock-user-id"; // In a real app, this would come from authentication
      const progress = await storage.getUserProgress(userId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Get user progress for specific lesson
  app.get("/api/progress/:lessonId", async (req, res) => {
    try {
      const { lessonId } = req.params;
      const userId = "mock-user-id"; // In a real app, this would come from authentication
      
      const progress = await storage.getUserProgressForLesson(userId, lessonId);
      res.json(progress || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lesson progress" });
    }
  });

  // Update user progress
  app.put("/api/progress/:lessonId", async (req, res) => {
    try {
      const { lessonId } = req.params;
      const userId = "mock-user-id"; // In a real app, this would come from authentication
      
      const updateSchema = z.object({
        currentStep: z.number().optional(),
        completed: z.boolean().optional(),
        code: z.string().optional(),
      });
      
      const updateData = updateSchema.parse(req.body);
      const progress = await storage.updateUserProgress(userId, lessonId, updateData);
      
      res.json(progress);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid progress data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // === GAME EXECUTION ENDPOINTS - PROXIED TO FLASK ===
  
  // Compile game from components (proxied to Flask)
  app.post("/api/compile", async (req, res) => {
    await proxyToFlask("/api/compile", req, res);
  });
  
  // Execute Python game code (proxied to Flask)
  app.post("/api/execute", async (req, res) => {
    await proxyToFlask("/api/execute", req, res);
  });
  
  // Stream game output (proxied to Flask with SSE)
  app.get("/api/game-stream/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    await proxySSEToFlask(`/api/game-stream/${sessionId}`, req, res);
  });
  
  // Stop a running game session (proxied to Flask)
  app.post("/api/stop-game/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    await proxyToFlask(`/api/stop-game/${sessionId}`, req, res);
  });
  
  // Send input to a running game (proxied to Flask)
  app.post("/api/game-input/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    await proxyToFlask(`/api/game-input/${sessionId}`, req, res);
  });
  
  // Get active game sessions (proxied to Flask)
  app.get("/api/sessions", async (req, res) => {
    await proxyToFlask("/api/sessions", req, res, 'GET');
  });
  
  // === EXPRESS BACKEND ENDPOINTS (Database, Projects, Lessons, etc.) ===

  // Get user's projects
  app.get("/api/projects", async (req, res) => {
    try {
      const userId = "mock-user-id"; // In a real app, this would come from authentication
      const projects = await storage.listProjects(userId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Create new project
  app.post("/api/projects", async (req, res) => {
    try {
      const userId = "mock-user-id"; // In a real app, this would come from authentication
      const projectData: InsertProject = {
        ...req.body,
        userId,
      };
      
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Get specific project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Update project
  app.put("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const updateSchema = z.object({
        name: z.string().optional(),
        template: z.string().optional(),
        description: z.string().optional(),
        published: z.boolean().optional(),
        thumbnailDataUrl: z.string().optional(),
        files: z.array(z.object({
          path: z.string(),
          content: z.string(),
        })).optional(),
        assets: z.array(z.object({
          id: z.string(),
          name: z.string(),
          type: z.enum(['image', 'sound', 'other']),
          path: z.string(),
          dataUrl: z.string(),
        })).optional(),
      });
      
      const updateData = updateSchema.parse(req.body);
      const project = await storage.updateProject(id, updateData);
      
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.issues });
      }
      if (error instanceof Error && error.message === "Project not found") {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Gallery endpoints
  
  // Get all published projects for gallery
  app.get("/api/gallery", async (req, res) => {
    try {
      const publishedProjects = await storage.listPublishedProjects();
      res.json(publishedProjects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gallery projects" });
    }
  });

  // Get a specific published project by ID
  app.get("/api/gallery/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const publishedProjects = await storage.listPublishedProjects();
      const project = publishedProjects.find(p => p.id === id);
      
      if (!project) {
        return res.status(404).json({ message: "Published project not found" });
      }
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gallery project" });
    }
  });

  // Publish a project
  app.post("/api/projects/:id/publish", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.publishProject(id);
      res.json(project);
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(500).json({ message: "Failed to publish project" });
    }
  });

  // Unpublish a project
  app.post("/api/projects/:id/unpublish", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.unpublishProject(id);
      res.json(project);
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(500).json({ message: "Failed to unpublish project" });
    }
  });

}

// Note: Game code generation has been moved to Flask backend
// The generateGameCode function below is kept for reference but not used
function generateGameCodeLegacy(gameType: string, components: any[], assets: any[]): string {
  // Import the racing game template
  const racingTemplate = `import pygame
import sys
import random
import math

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
GRAY = (128, 128, 128)
DARK_GRAY = (64, 64, 64)
ORANGE = (255, 165, 0)
CYAN = (0, 255, 255)

# Set up the display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Racing Game - Championship Mode")

# Clock for controlling frame rate
clock = pygame.time.Clock()

# Fonts
font_small = pygame.font.Font(None, 24)
font_medium = pygame.font.Font(None, 36)
font_large = pygame.font.Font(None, 48)

# Simple Vehicle Class for Racing Game
class Vehicle:
    def __init__(self, x=400, y=500):
        self.x = x
        self.y = y
        self.angle = 0
        self.speed = 0
        self.max_speed = 12
        self.acceleration = 0.5
        self.braking = 0.8
        self.handling = 7
        self.width = 30
        self.height = 50
        self.color = RED
        self.nitro = 100
        self.max_nitro = 100
        self.nitro_active = False
        self.lap = 1
        self.checkpoint = 0
        
    def update(self, keys):
        # Handle input
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            self.speed = min(self.speed + self.acceleration, self.max_speed)
        elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
            self.speed = max(self.speed - self.braking, -self.max_speed / 2)
        else:
            if self.speed > 0:
                self.speed = max(0, self.speed - 0.2)
            elif self.speed < 0:
                self.speed = min(0, self.speed + 0.2)
        
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            if abs(self.speed) > 0.5:
                self.angle -= self.handling
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            if abs(self.speed) > 0.5:
                self.angle += self.handling
        
        # Nitro boost
        if keys[pygame.K_SPACE] and self.nitro > 0:
            self.nitro_active = True
            self.nitro -= 2
            self.speed = min(self.speed * 1.5, self.max_speed * 1.5)
        else:
            self.nitro_active = False
            self.nitro = min(self.nitro + 0.1, self.max_nitro)
        
        # Update position
        rad = math.radians(self.angle)
        self.x += math.sin(rad) * self.speed
        self.y += -math.cos(rad) * self.speed
        
        # Keep on screen
        self.x = max(50, min(self.x, SCREEN_WIDTH - 50))
        self.y = max(50, min(self.y, SCREEN_HEIGHT - 50))
    
    def draw(self, screen):
        # Draw car as a rotated rectangle
        cos_a = math.cos(math.radians(self.angle))
        sin_a = math.sin(math.radians(self.angle))
        
        # Calculate corners of the vehicle
        corners = []
        for dx, dy in [(-self.width/2, -self.height/2), 
                       (self.width/2, -self.height/2),
                       (self.width/2, self.height/2),
                       (-self.width/2, self.height/2)]:
            rx = dx * cos_a - dy * sin_a
            ry = dx * sin_a + dy * cos_a
            corners.append((self.x + rx, self.y + ry))
        
        pygame.draw.polygon(screen, self.color, corners)
        
        # Draw nitro effect
        if self.nitro_active:
            flame_base = ((corners[2][0] + corners[3][0])/2, 
                         (corners[2][1] + corners[3][1])/2)
            flame_tip = (flame_base[0] - sin_a * 30, 
                        flame_base[1] + cos_a * 30)
            pygame.draw.line(screen, YELLOW, flame_base, flame_tip, 5)

# Simple AI Opponent
class AIOpponent(Vehicle):
    def __init__(self, x, y):
        super().__init__(x, y)
        self.color = BLUE
        self.target_y = 100
        
    def update_ai(self):
        # Simple AI movement
        if self.y > self.target_y:
            self.speed = self.max_speed * 0.8
        else:
            self.speed = 0
            
        # Slight wandering
        self.angle = math.sin(pygame.time.get_ticks() * 0.001) * 10
        
        # Update position
        rad = math.radians(self.angle)
        self.x += math.sin(rad) * self.speed
        self.y += -math.cos(rad) * self.speed
        
        # Keep on screen
        self.x = max(50, min(self.x, SCREEN_WIDTH - 50))
        self.y = max(50, min(self.y, SCREEN_HEIGHT - 50))
        
        # Reset position when reaching top
        if self.y <= self.target_y:
            self.y = SCREEN_HEIGHT - 50
            self.x = random.randint(200, 600)

# Track Drawing
def draw_track(screen):
    # Draw track boundaries
    pygame.draw.rect(screen, GRAY, (100, 50, 600, 500), 40)
    # Draw track surface
    pygame.draw.rect(screen, DARK_GRAY, (140, 90, 520, 420))
    # Draw center line
    for y in range(50, 550, 40):
        pygame.draw.rect(screen, WHITE, (SCREEN_WIDTH // 2 - 2, y, 4, 20))
    # Draw start/finish line
    checker_size = 10
    for i in range(10):
        for j in range(2):
            if (i + j) % 2 == 0:
                color = WHITE
            else:
                color = BLACK
            pygame.draw.rect(screen, color,
                           (SCREEN_WIDTH // 2 - 50 + i * checker_size,
                            SCREEN_HEIGHT - 100 + j * checker_size,
                            checker_size, checker_size))

# HUD Drawing
def draw_hud(screen, vehicle):
    # Speed meter
    speed_text = font_medium.render(f"{int(abs(vehicle.speed) * 20)} km/h", True, WHITE)
    screen.blit(speed_text, (SCREEN_WIDTH - 150, SCREEN_HEIGHT - 80))
    
    # Nitro gauge
    nitro_percent = vehicle.nitro / vehicle.max_nitro
    pygame.draw.rect(screen, DARK_GRAY, (20, SCREEN_HEIGHT - 50, 100, 15))
    pygame.draw.rect(screen, CYAN, (20, SCREEN_HEIGHT - 50, int(100 * nitro_percent), 15))
    nitro_text = font_small.render("NITRO", True, WHITE)
    screen.blit(nitro_text, (20, SCREEN_HEIGHT - 70))
    
    # Lap counter
    lap_text = font_medium.render(f"Lap {vehicle.lap}/3", True, WHITE)
    screen.blit(lap_text, (20, 20))
    
    # Instructions
    inst_text = font_small.render("Arrow Keys/WASD: Drive | Space: Nitro | ESC: Quit", True, WHITE)
    screen.blit(inst_text, (SCREEN_WIDTH // 2 - 200, 10))

# Initialize game objects
player = Vehicle()
ai_opponents = [
    AIOpponent(300, 400),
    AIOpponent(400, 350),
    AIOpponent(500, 400)
]

# Game state
game_running = True
race_started = False
countdown = 3
countdown_timer = 0

# Main game loop
running = True
while running:
    dt = clock.tick(FPS) / 1000.0  # Delta time in seconds
    
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
            elif event.key == pygame.K_RETURN and not race_started:
                race_started = True
                countdown_timer = pygame.time.get_ticks()
    
    # Update game logic
    keys = pygame.key.get_pressed()
    
    if race_started:
        # Update countdown
        if countdown > 0:
            elapsed = (pygame.time.get_ticks() - countdown_timer) / 1000
            if elapsed > 1:
                countdown -= 1
                countdown_timer = pygame.time.get_ticks()
        else:
            # Race is on!
            player.update(keys)
            
            # Update AI
            for ai in ai_opponents:
                ai.update_ai()
    
    # Draw everything
    screen.fill(BLACK)
    
    # Draw track
    draw_track(screen)
    
    # Draw vehicles
    player.draw(screen)
    for ai in ai_opponents:
        ai.draw(screen)
    
    # Draw HUD
    draw_hud(screen, player)
    
    # Draw countdown or start prompt
    if not race_started:
        start_text = font_large.render("Press ENTER to Start", True, YELLOW)
        screen.blit(start_text, (SCREEN_WIDTH // 2 - 180, SCREEN_HEIGHT // 2))
    elif countdown > 0:
        if countdown == 3:
            count_text = font_large.render("3", True, RED)
        elif countdown == 2:
            count_text = font_large.render("2", True, YELLOW)
        elif countdown == 1:
            count_text = font_large.render("1", True, YELLOW)
        else:
            count_text = font_large.render("GO!", True, GREEN)
        screen.blit(count_text, (SCREEN_WIDTH // 2 - 20, SCREEN_HEIGHT // 2))
    
    # Update display
    pygame.display.flip()

# Quit
pygame.quit()
sys.exit()`;

  // For now, return the racing template for racing games
  // In a full implementation, you'd have different templates for different game types
  if (gameType === 'racing') {
    return racingTemplate;
  }
  
  // Default template for other game types
  return `import pygame
import sys
import random

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)

# Set up the display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Game")

# Clock for controlling frame rate
clock = pygame.time.Clock()

# Main game loop
running = True
while running:
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
    
    # Update
    keys = pygame.key.get_pressed()
    
    # Draw
    screen.fill(BLACK)
    
    # Draw game title
    font = pygame.font.Font(None, 48)
    title = font.render("${gameType.toUpperCase()} GAME", True, WHITE)
    screen.blit(title, (SCREEN_WIDTH // 2 - 100, SCREEN_HEIGHT // 2 - 24))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

# Quit
pygame.quit()
sys.exit()`;
}

  // === REGISTRY API ENDPOINTS ===
  
  // Components
  app.get("/api/registry/components", async (req, res) => {
    try {
      const components = await storage.getRegistryComponents();
      res.json({
        components,
        total: components.length
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch components",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/registry/components/:id", async (req, res) => {
    try {
      const component = await storage.getRegistryComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ message: "Component not found" });
      }
      res.json(component);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch component",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Mechanics
  app.get("/api/registry/mechanics", async (req, res) => {
    try {
      const mechanics = await storage.getRegistryMechanics();
      res.json({
        mechanics,
        total: mechanics.length
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch mechanics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/registry/mechanics/:id", async (req, res) => {
    try {
      const mechanic = await storage.getRegistryMechanic(req.params.id);
      if (!mechanic) {
        return res.status(404).json({ message: "Mechanic not found" });
      }
      res.json(mechanic);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch mechanic",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Templates
  app.get("/api/registry/templates", async (req, res) => {
    try {
      const templates = await storage.getRegistryTemplates();
      res.json({
        templates,
        total: templates.length
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch templates",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/registry/templates/:id", async (req, res) => {
    try {
      const template = await storage.getRegistryTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch template",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Assets (placeholder - no seed data created yet)
  app.get("/api/registry/assets", async (req, res) => {
    try {
      const assets = await storage.getRegistryAssets();
      res.json({
        assets,
        total: assets.length
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch assets",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/registry/assets/:id", async (req, res) => {
    try {
      const asset = await storage.getRegistryAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      res.json(asset);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch asset",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Build Targets
  app.get("/api/registry/build-targets", async (req, res) => {
    try {
      const buildTargets = await storage.getRegistryBuildTargets();
      res.json({
        buildTargets,
        total: buildTargets.length
      });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch build targets",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/registry/build-targets/:id", async (req, res) => {
    try {
      const buildTarget = await storage.getRegistryBuildTarget(req.params.id);
      if (!buildTarget) {
        return res.status(404).json({ message: "Build target not found" });
      }
      res.json(buildTarget);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch build target",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
