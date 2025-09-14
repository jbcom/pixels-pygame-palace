import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLessonSchema, insertUserProgressSchema } from "@shared/schema";
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

  const httpServer = createServer(app);
  return httpServer;
}
