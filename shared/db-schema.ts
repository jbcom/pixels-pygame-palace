import { pgTable, text, timestamp, boolean, integer, json, serial, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey().default('gen_random_uuid()'),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().default('gen_random_uuid()'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));

export const insertSessionSchema = createInsertSchema(sessions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Game Projects table (main focus of this implementation)
export const gameProjects = pgTable('game_projects', {
  id: text('id').primaryKey().default('gen_random_uuid()'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  gameType: text('game_type').notNull(), // 'wizard', 'platformer', 'racing', 'puzzle', etc.
  components: json('components').notNull().default('{}'), // Store component configuration as JSON
  description: text('description'),
  published: boolean('published').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
  thumbnailDataUrl: text('thumbnail_data_url'),
  files: json('files').notNull().default('[]'), // Store project files as JSON array
  assets: json('assets').notNull().default('[]'), // Store project assets as JSON array
}, (table) => ({
  userIdIdx: index('game_projects_user_id_idx').on(table.userId),
  publishedIdx: index('game_projects_published_idx').on(table.published),
}));

export const insertGameProjectSchema = createInsertSchema(gameProjects).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
  publishedAt: true
});
export type InsertGameProject = z.infer<typeof insertGameProjectSchema>;
export type GameProject = typeof gameProjects.$inferSelect;

// Lessons table
export const lessons = pgTable('lessons', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  order: integer('order').notNull(),
  intro: text('intro'),
  learningObjectives: json('learning_objectives').default('[]'),
  goalDescription: text('goal_description'),
  previewCode: text('preview_code'),
  content: json('content').notNull(),
  prerequisites: json('prerequisites').default('[]'),
  difficulty: text('difficulty'),
  estimatedTime: integer('estimated_time'),
});

export const insertLessonSchema = createInsertSchema(lessons);
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

// User Progress table
export const userProgress = pgTable('user_progress', {
  id: text('id').primaryKey().default('gen_random_uuid()'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  currentStep: integer('current_step').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  code: text('code'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdLessonIdIdx: index('user_progress_user_lesson_idx').on(table.userId, table.lessonId),
}));

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ 
  id: true,
  updatedAt: true
});
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgress.$inferSelect;