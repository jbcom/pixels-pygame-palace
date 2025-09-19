// Simple TypeScript types for PyGame Academy - no database dependencies!

export interface User {
  id: string;
  username: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  order: number;
  intro?: string;
  learningObjectives?: string[];
  goalDescription?: string;
  previewCode?: string;
  content: {
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
        mode?: 'output' | 'rules';
        astRules?: {
          requiredFunctions?: string[];
          requiredConstructs?: Array<{
            type: 'variable_assignment' | 'function_call' | 'import' | 'if_statement' | 'loop' | 'string_literal' | 'f_string';
            name?: string;
            minCount?: number;
            maxCount?: number;
          }>;
          forbiddenConstructs?: Array<{
            type: 'variable_assignment' | 'function_call' | 'import' | 'if_statement' | 'loop' | 'string_literal' | 'f_string';
            name?: string;
          }>;
        };
        runtimeRules?: {
          outputContains?: string[];
          outputMatches?: string;
          variableExists?: string[];
          functionCalled?: string[];
          acceptsUserInput?: boolean;
          outputIncludesInput?: boolean;
        };
      }>;
      validation?: {
        type: 'output' | 'variable' | 'function' | 'exact';
        expected?: any;
      };
    }>;
  };
  prerequisites?: string[];
  difficulty?: string;
  estimatedTime?: number;
}

export interface UserProgress {
  id: string;
  userId: string;
  lessonId: string;
  currentStep: number;
  completed: boolean;
  code?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  template: string;
  description?: string;
  published: boolean;
  createdAt: Date;
  publishedAt?: Date;
  thumbnailDataUrl?: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  assets: Array<{
    id: string;
    name: string;
    type: 'image' | 'sound' | 'other';
    path: string;
    dataUrl: string;
  }>;
}

export type ProjectAsset = Project['assets'][0];
export type ProjectFile = Project['files'][0];

// For backward compatibility, keeping these type aliases
export type InsertUser = Omit<User, 'id'>;
export type InsertLesson = Omit<Lesson, 'id'>;
export type InsertUserProgress = Omit<UserProgress, 'id'>;
export type InsertProject = Omit<Project, 'id' | 'createdAt' | 'publishedAt'>;

// Visual Game Builder Types
export interface GameConfig {
  id: string;
  name: string;
  version: number;
  scenes: Scene[];
  componentChoices: ComponentChoice[];
  assets: AssetRef[];
  settings: GameSettings;
}

export interface Scene {
  id: string;
  name: string;
  entities: Entity[];
  backgroundColor?: string;
  width: number;
  height: number;
  gridSize?: number;
  isMainScene?: boolean;
}

export interface Entity {
  id: string;
  type: 'player' | 'enemy' | 'collectible' | 'platform' | 'decoration' | 'trigger' | 'custom';
  name: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  sprite?: string;
  properties: Record<string, any>;
  behaviors?: EntityBehavior[];
  layer?: number;
}

export interface EntityBehavior {
  type: 'patrol' | 'follow' | 'rotate' | 'bounce' | 'custom';
  parameters: Record<string, any>;
}

export interface ComponentChoice {
  component: string;
  choice: 'A' | 'B';
  customParameters?: Record<string, any>;
}

export interface AssetRef {
  id: string;
  assetId: string;
  position?: { x: number; y: number };
  scale?: number;
  rotation?: number;
  layer?: number;
  properties?: Record<string, any>;
}

export interface GameSettings {
  fps?: number;
  showGrid?: boolean;
  gridSnap?: boolean;
  physicsEnabled?: boolean;
  debugMode?: boolean;
}

// Mascot-Driven Experience Types
export interface UserProfile {
  id: string;
  name: string;
  firstVisitAt: Date;
  lastVisitAt: Date;
  skillLevel: 'beginner' | 'learning' | 'confident' | 'pro';
  interests: string[];
  preferredGenres: string[];
  currentProject?: string;
  completedLessons: string[];
  mascotName: string; // They can rename Pixel if they want
  onboardingComplete: boolean;
}

export interface WizardState {
  currentStep: string;
  answers: Record<string, any>;
  suggestedTemplates: string[];
  selectedTemplate?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'pixel' | 'user' | 'system';
  content: string;
  timestamp: Date;
  quickReplies?: string[];
  actionType?: 'lesson' | 'create' | 'explore';
}