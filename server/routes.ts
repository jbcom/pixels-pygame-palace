import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLessonSchema, insertUserProgressSchema, insertProjectSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const projectData = insertProjectSchema.parse({
        ...req.body,
        userId,
      });
      
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

  const httpServer = createServer(app);
  return httpServer;
}
