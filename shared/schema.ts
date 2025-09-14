import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const lessons = pgTable("lessons", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  intro: text("intro"),
  learningObjectives: json("learningObjectives").$type<string[]>(),
  goalDescription: text("goalDescription"),
  previewCode: text("previewCode"),
  content: json("content").notNull().$type<{
    introduction: string;
    steps: Array<{
      id: string;
      title: string;
      description: string;
      initialCode: string;
      solution: string;
      hints: string[];
      tests?: Array<{
        input?: string;
        expectedOutput: string;
        description?: string;
      }>;
      validation?: {
        type: 'output' | 'variable' | 'function' | 'exact';
        expected?: any;
      };
    }>;
  }>(),
  prerequisites: json("prerequisites").$type<string[]>(),
  difficulty: text("difficulty"),
  estimatedTime: integer("estimated_time"),
});

export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  lessonId: varchar("lesson_id").notNull().references(() => lessons.id),
  currentStep: integer("current_step").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  code: text("code"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
