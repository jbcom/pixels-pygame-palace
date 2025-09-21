import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { InsertProject } from "@shared/schema";

export function registerRoutes(app: Express): void {
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
        return res.status(400).json({ message: "Invalid progress data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Execute Python code endpoint (for validation/testing)
  app.post("/api/execute", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: "Code is required" });
      }
      
      // In a real implementation, you might want to validate Python syntax server-side
      // For now, we'll just return a success response
      res.json({
        success: true,
        output: "Code received successfully. Execution handled client-side.",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to process code" });
    }
  });

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
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
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
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
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

  // Compile game from components
  app.post("/api/compile", async (req, res) => {
    try {
      const { components, gameType, assets } = req.body;
      
      if (!gameType) {
        return res.status(400).json({ message: "Game type is required" });
      }
      
      // Generate Python code based on game type
      const code = generateGameCode(gameType, components || [], assets || []);
      
      res.json({
        success: true,
        code,
        message: "Game compiled successfully"
      });
    } catch (error) {
      console.error("Compilation error:", error);
      res.status(400).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Compilation failed"
      });
    }
  });
}

// Helper function to generate game code
function generateGameCode(gameType: string, components: any[], assets: any[]): string {
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
