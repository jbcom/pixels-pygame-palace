// Simple TypeScript types for Pixel's PyGame Palace - no database dependencies!
// This is the single source of truth for all data structures

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

// Game Execution Types (shared between Express and Flask)
export interface GameExecutionRequest {
  code?: string;
  components?: any[];
  gameType?: string;
  assets?: any[];
}

export interface GameExecutionResponse {
  success: boolean;
  session_id?: string;
  code?: string;
  message?: string;
  error?: string;
  user?: string;
}

export interface GameSession {
  session_id: string;
  user_id: string;
  running_time: number;
  is_running: boolean;
  max_time: number;
}

export interface GameStreamEvent {
  type: 'frame' | 'end' | 'error';
  data?: string;
  message?: string;
  error?: string;
}

export interface ServiceHealthCheck {
  status: 'healthy' | 'unhealthy';
  service: string;
  port?: number;
  version?: string;
  reachable?: boolean;
  flask_url?: string;
  error?: string;
  hint?: string;
}

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
  backgroundImage?: string;
  width: number;
  height: number;
  gridSize?: number;
  isMainScene?: boolean;
  music?: string;
  transition?: SceneTransition;
  camera?: CameraSettings;
}

export interface Entity {
  id: string;
  type: 'player' | 'enemy' | 'collectible' | 'platform' | 'decoration' | 'trigger' | 'custom';
  name: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  rotation?: number;
  scale?: { x: number; y: number };
  sprite?: string;
  assetPath?: string;
  properties: Record<string, any>;
  behaviors?: EntityBehavior[];
  layer?: number;
  locked?: boolean;
  visible?: boolean;
  collisionShape?: CollisionShape;
  physics?: PhysicsProperties;
}

export interface EntityBehavior {
  id: string;
  type: 'move' | 'patrol' | 'follow' | 'rotate' | 'bounce' | 'jump' | 'shoot' | 'collect' | 'spawn' | 'destroy' | 'custom';
  parameters: Record<string, any>;
  trigger?: BehaviorTrigger;
  enabled?: boolean;
}

export interface BehaviorTrigger {
  type: 'always' | 'onClick' | 'onCollision' | 'onKeyPress' | 'onTimer' | 'onEvent';
  params?: Record<string, any>;
}

export interface CollisionShape {
  type: 'rect' | 'circle' | 'polygon' | 'auto';
  data?: any;
}

export interface PhysicsProperties {
  enabled: boolean;
  mass?: number;
  friction?: number;
  bounce?: number;
  gravity?: boolean;
  static?: boolean;
}

export interface SceneTransition {
  type: 'none' | 'fade' | 'slide' | 'zoom' | 'pixelate';
  duration?: number;
  easing?: string;
}

export interface CameraSettings {
  followEntity?: string;
  zoom?: number;
  bounds?: { x: number; y: number; width: number; height: number };
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
  gridSize?: number;
  showRulers?: boolean;
  showGuides?: boolean;
  physicsEnabled?: boolean;
  debugMode?: boolean;
  autoSave?: boolean;
  theme?: 'light' | 'dark';
}

export interface EditorState {
  selectedEntities: string[];
  selectedTool: EditorTool;
  clipboard?: Entity[];
  history: HistoryEntry[];
  historyIndex: number;
  zoom: number;
  panOffset: { x: number; y: number };
  showLayers?: boolean;
  lockedLayers?: number[];
}

export type EditorTool = 'select' | 'move' | 'rotate' | 'scale' | 'duplicate' | 'delete' | 'pan' | 'zoom';

export interface HistoryEntry {
  type: 'add' | 'delete' | 'modify' | 'batch';
  entities: Entity[];
  previousState?: Entity[];
  timestamp: number;
}

export interface AssetMetadata {
  id: string;
  name: string;
  path: string;
  type: 'sprite' | 'model' | 'sound' | 'music' | 'font';
  category: string;
  tags: string[];
  thumbnail?: string;
  dimensions?: { width: number; height: number };
  format?: string;
  size?: number;
  favorite?: boolean;
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

// Component System Types
export interface ComponentManifest {
  id: string;
  name: string;
  category: 'movement' | 'combat' | 'ui' | 'world';
  description: string;
  slots: SlotSpec[];
  params: ParamSpec[];
  variants: VariantSpec[];
}

export interface SlotSpec {
  id: string;
  type: 'sprite' | 'sound' | 'tileset';
  accepts: string[]; // asset tags
  default?: string;
}

export interface ParamSpec {
  id: string;
  type: 'number' | 'boolean' | 'select';
  default: any;
  min?: number;
  max?: number;
  options?: string[];
}

export interface VariantSpec {
  id: string;
  label: string;
  module: string; // filename without .py
  description: string;
}

export interface ComponentConfig {
  category: string;
  id: string;
  variant: string;
  assets: Record<string, string>;
  params: Record<string, any>;
}

export interface ComponentInstance {
  update: (dt: number, events: string[]) => void;
  draw: (surface: any, x: number, y: number) => void;
  [key: string]: any; // Allow additional methods
}

// =============================================
// REGISTRY SYSTEM TYPES
// =============================================

// Registry Component Types (enhanced from JSON schema)
export interface RegistryComponent {
  id: string;
  type: 'player' | 'enemy' | 'collectible' | 'platform' | 'background' | 'sound' | 'ui' | 'particle' | 'trigger' | 'decoration';
  name: string;
  description: string;
  version: string;
  paramsSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  dependencies: ComponentDependency[];
  assetReferences: AssetReference[];
  events: ComponentEvent[];
  category: 'core' | 'gameplay' | 'visual' | 'audio' | 'ui' | 'physics' | 'ai' | 'custom';
  tags: string[];
  icon?: string;
  preview?: string;
  documentation?: ComponentDocumentation;
  buildTargets: BuildTargetType[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentDependency {
  componentId: string;
  version?: string;
  optional?: boolean;
}

export interface AssetReference {
  slotId: string;
  assetType: 'sprite' | 'sound' | 'music' | 'tileset' | 'font';
  required: boolean;
  multiple: boolean;
  tags: string[];
  defaultAsset?: string;
}

export interface ComponentEvent {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface ComponentDocumentation {
  usage?: string;
  examples?: Array<{
    title: string;
    description: string;
    config: Record<string, any>;
  }>;
}

// Registry Mechanic Types
export interface RegistryMechanic {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'movement' | 'combat' | 'physics' | 'ai' | 'audio' | 'visual' | 'ui' | 'gameplay' | 'custom';
  systems: MechanicSystem[];
  configuration: MechanicConfiguration;
  requiredComponents: string[];
  compatibleComponents: string[];
  conflictsWith: string[];
  events: ComponentEvent[];
  tags: string[];
  buildTargets: BuildTargetType[];
  documentation?: MechanicDocumentation;
  createdAt: Date;
  updatedAt: Date;
}

export interface MechanicSystem {
  id: string;
  name: string;
  description: string;
  priority: number;
  updateOrder: 'pre_update' | 'update' | 'post_update' | 'render' | 'gui';
  requiredComponents: string[];
  configuration?: Record<string, any>;
}

export interface MechanicConfiguration {
  globalSettings?: Record<string, any>;
  componentDefaults?: Record<string, any>;
  systemSettings?: Record<string, any>;
}

export interface MechanicDocumentation {
  usage?: string;
  examples?: Array<{
    title: string;
    description: string;
    configuration: Record<string, any>;
  }>;
}

// Registry Asset Types
export interface RegistryAsset {
  id: string;
  name: string;
  description: string;
  path: string;
  kind: 'sprite' | 'sound' | 'music' | 'tileset' | 'font' | 'data' | 'model';
  category: 'character' | 'environment' | 'ui' | 'effect' | 'audio' | 'data' | 'font' | 'custom';
  variants: AssetVariant[];
  license: AssetLicense;
  metadata: AssetMetadataRegistry;
  properties: Record<string, any>;
  tags: string[];
  buildTargets: BuildTargetType[];
  thumbnail?: string;
  preview?: string;
  source?: AssetSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetVariant {
  id: string;
  name: string;
  path: string;
  properties?: Record<string, any>;
  tags?: string[];
}

export interface AssetLicense {
  type: 'CC0' | 'CC-BY' | 'CC-BY-SA' | 'CC-BY-NC' | 'CC-BY-NC-SA' | 'MIT' | 'GPL' | 'proprietary' | 'custom';
  attribution?: string;
  url?: string;
  commercial?: boolean;
}

export interface AssetMetadataRegistry {
  fileSize?: number;
  dimensions?: { width: number; height: number };
  duration?: number;
  format?: string;
  frameCount?: number;
  frameRate?: number;
}

export interface AssetSource {
  author?: string;
  url?: string;
  collection?: string;
}

// Registry Template Types
export interface RegistryTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'platformer' | 'shooter' | 'puzzle' | 'racing' | 'rpg' | 'strategy' | 'arcade' | 'adventure' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  slots: TemplateSlot[];
  requiredSystems: string[];
  requiredMechanics: string[];
  sceneGraph: TemplateSceneGraph;
  defaultConfiguration: Record<string, any>;
  gameSettings: TemplateGameSettings;
  buildTargets: BuildTargetType[];
  tags: string[];
  preview?: TemplatePreview;
  documentation?: TemplateDocumentation;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateSlot {
  id: string;
  name: string;
  description: string;
  type: 'component' | 'asset' | 'mechanic' | 'scene' | 'system';
  required: boolean;
  multiple: boolean;
  acceptedTypes: string[];
  defaultValue?: any;
  constraints?: Record<string, any>;
}

export interface TemplateSceneGraph {
  root: TemplateSceneNode;
  scenes: TemplateScene[];
}

export interface TemplateSceneNode {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
  children?: TemplateSceneNode[];
}

export interface TemplateScene {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;
  entities: TemplateEntity[];
}

export interface TemplateEntity {
  componentId: string;
  position: { x: number; y: number };
  configuration?: Record<string, any>;
}

export interface TemplateGameSettings {
  screenWidth: number;
  screenHeight: number;
  targetFPS: number;
  physics?: {
    enabled: boolean;
    gravity: number;
  };
  audio?: {
    enabled: boolean;
    volume: number;
  };
}

export interface TemplatePreview {
  image?: string;
  video?: string;
  playable?: string;
}

export interface TemplateDocumentation {
  tutorial?: string;
  examples?: Array<{
    title: string;
    description: string;
    configuration: Record<string, any>;
  }>;
}

// Registry Build Target Types
export type BuildTargetType = 'desktop' | 'web' | 'mobile';

export interface RegistryBuildTarget {
  id: BuildTargetType;
  name: string;
  description: string;
  platform: BuildTargetPlatform;
  capabilities: BuildTargetCapabilities;
  constraints: BuildTargetConstraints;
  buildSettings: BuildTargetBuildSettings;
  runtime: BuildTargetRuntime;
  deployment: BuildTargetDeployment;
}

export interface BuildTargetPlatform {
  os: ('windows' | 'macos' | 'linux' | 'browser' | 'ios' | 'android')[];
  architecture: ('x86' | 'x64' | 'arm' | 'arm64' | 'wasm')[];
  minVersion?: string;
}

export interface BuildTargetCapabilities {
  graphics: {
    hardware2D: boolean;
    hardware3D: boolean;
    shaders: boolean;
    maxTextureSize: number;
    multipleWindows: boolean;
  };
  audio: {
    stereo: boolean;
    surround: boolean;
    streaming: boolean;
    synthesis: boolean;
    formats: string[];
  };
  input: {
    keyboard: boolean;
    mouse: boolean;
    touch: boolean;
    gamepad: boolean;
    accelerometer: boolean;
    gyroscope: boolean;
  };
  storage: {
    localStorage: boolean;
    fileSystem: boolean;
    maxLocalStorage?: number;
    persistent: boolean;
  };
  network: {
    http: boolean;
    websockets: boolean;
    udp: boolean;
    p2p: boolean;
  };
  performance: {
    multithreading: boolean;
    webWorkers: boolean;
    simd: boolean;
    jit: boolean;
  };
}

export interface BuildTargetConstraints {
  maxMemoryMB?: number;
  maxFileSizeMB?: number;
  sandboxed?: boolean;
  requiresPermissions?: string[];
  blockedAPIs?: string[];
}

export interface BuildTargetBuildSettings {
  compiler?: string;
  outputFormat?: string;
  optimization: 'none' | 'size' | 'speed' | 'balanced';
  compression: boolean;
}

export interface BuildTargetRuntime {
  engine?: string;
  version?: string;
  dependencies?: string[];
}

export interface BuildTargetDeployment {
  distribution: ('direct' | 'store' | 'web' | 'package_manager')[];
  signing?: boolean;
  autoUpdate?: boolean;
}

// Registry API Types
export interface ComponentRegistryResponse {
  components: RegistryComponent[];
  total: number;
  page?: number;
  limit?: number;
}

export interface MechanicRegistryResponse {
  mechanics: RegistryMechanic[];
  total: number;
  page?: number;
  limit?: number;
}

export interface AssetRegistryResponse {
  assets: RegistryAsset[];
  total: number;
  page?: number;
  limit?: number;
}

export interface TemplateRegistryResponse {
  templates: RegistryTemplate[];
  total: number;
  page?: number;
  limit?: number;
}

// Insert types for the registry system
export type InsertRegistryComponent = Omit<RegistryComponent, 'createdAt' | 'updatedAt'>;
export type InsertRegistryMechanic = Omit<RegistryMechanic, 'createdAt' | 'updatedAt'>;
export type InsertRegistryAsset = Omit<RegistryAsset, 'createdAt' | 'updatedAt'>;
export type InsertRegistryTemplate = Omit<RegistryTemplate, 'createdAt' | 'updatedAt'>;