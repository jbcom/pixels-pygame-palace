import { z } from 'zod';
import type { BuildTargetType } from './schema';

// =============================================
// ZOD SCHEMAS FOR REGISTRY RUNTIME VALIDATION
// =============================================

// Base schema for components and their dependencies
const ComponentDependencySchema = z.object({
  componentId: z.string(),
  version: z.string().optional(),
  optional: z.boolean().default(false)
});

const AssetReferenceSchema = z.object({
  slotId: z.string(),
  assetType: z.enum(['sprite', 'sound', 'music', 'tileset', 'font']),
  required: z.boolean().default(true),
  multiple: z.boolean().default(false),
  tags: z.array(z.string()),
  defaultAsset: z.string().optional()
});

const ComponentEventSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()).optional()
});

const ComponentDocumentationSchema = z.object({
  usage: z.string().optional(),
  examples: z.array(z.object({
    title: z.string(),
    description: z.string(),
    config: z.record(z.any())
  })).optional()
});

const CompatibilityMetadataSchema = z.object({
  orchestratorVersion: z.string().default('1.0.0'),
  gameEngineVersions: z.array(z.string()).default(() => ['2.0']),
  compatibilityLevel: z.enum(['full', 'partial', 'experimental']).default('full'),
  requiredFeatures: z.array(z.string()).default(() => []),
  optionalFeatures: z.array(z.string()).default(() => []),
  limitations: z.array(z.string()).default(() => []),
  performanceImpact: z.enum(['low', 'medium', 'high']).default('low'),
  memoryUsage: z.enum(['low', 'medium', 'high']).default('low')
});

const BuildTargetTypeSchema = z.enum(['desktop', 'web', 'mobile']);

// Registry Component Schema
export const RegistryComponentSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  type: z.enum(['player', 'enemy', 'collectible', 'platform', 'background', 'sound', 'ui', 'particle', 'trigger', 'decoration']),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  paramsSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional()
  }),
  dependencies: z.array(ComponentDependencySchema).default(() => []),
  assetReferences: z.array(AssetReferenceSchema).default(() => []),
  events: z.array(ComponentEventSchema).default(() => []),
  category: z.enum(['core', 'gameplay', 'visual', 'audio', 'ui', 'physics', 'ai', 'custom']),
  tags: z.array(z.string()).default(() => []),
  icon: z.string().optional(),
  preview: z.string().optional(),
  documentation: ComponentDocumentationSchema.optional(),
  buildTargets: z.array(BuildTargetTypeSchema).default(() => ['desktop' as const, 'web' as const]),
  compatibility: CompatibilityMetadataSchema.default(() => ({
    orchestratorVersion: '1.0.0',
    gameEngineVersions: ['2.0'],
    compatibilityLevel: 'full' as const,
    requiredFeatures: [],
    optionalFeatures: [],
    limitations: [],
    performanceImpact: 'low' as const,
    memoryUsage: 'low' as const
  })),
  createdAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val),
  updatedAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val)
});

// Registry Mechanic Schema
const MechanicSystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  priority: z.number().int().min(0),
  updateOrder: z.enum(['pre_update', 'update', 'post_update', 'render', 'gui']),
  requiredComponents: z.array(z.string()).default(() => []),
  configuration: z.record(z.any()).optional()
});

const MechanicConfigurationSchema = z.object({
  globalSettings: z.record(z.any()).optional(),
  componentDefaults: z.record(z.any()).optional(),
  systemSettings: z.record(z.any()).optional()
});

const MechanicDocumentationSchema = z.object({
  usage: z.string().optional(),
  examples: z.array(z.object({
    title: z.string(),
    description: z.string(),
    configuration: z.record(z.any())
  })).optional()
});

export const RegistryMechanicSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum(['movement', 'combat', 'physics', 'ai', 'audio', 'visual', 'ui', 'gameplay', 'custom']),
  systems: z.array(MechanicSystemSchema).default(() => []),
  configuration: MechanicConfigurationSchema.default(() => ({})),
  requiredComponents: z.array(z.string()).default(() => []),
  compatibleComponents: z.array(z.string()).default(() => []),
  conflictsWith: z.array(z.string()).default(() => []),
  events: z.array(ComponentEventSchema).default(() => []),
  tags: z.array(z.string()).default(() => []),
  buildTargets: z.array(BuildTargetTypeSchema).default(() => ['desktop' as const, 'web' as const]),
  documentation: MechanicDocumentationSchema.optional(),
  compatibility: CompatibilityMetadataSchema.default(() => ({
    orchestratorVersion: '1.0.0',
    gameEngineVersions: ['2.0'],
    compatibilityLevel: 'full' as const,
    requiredFeatures: [],
    optionalFeatures: [],
    limitations: [],
    performanceImpact: 'low' as const,
    memoryUsage: 'low' as const
  })),
  createdAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val),
  updatedAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val)
});

// Registry Asset Schema
const AssetVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  properties: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional()
});

const AssetLicenseSchema = z.object({
  type: z.enum(['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'CC-BY-NC-SA', 'MIT', 'GPL', 'proprietary', 'custom']),
  attribution: z.string().optional(),
  url: z.string().optional(),
  commercial: z.boolean().default(true)
});

const AssetMetadataRegistrySchema = z.object({
  fileSize: z.number().optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
  duration: z.number().optional(),
  format: z.string().optional(),
  frameCount: z.number().optional(),
  frameRate: z.number().optional()
});

const AssetSourceSchema = z.object({
  author: z.string().optional(),
  url: z.string().optional(),
  collection: z.string().optional()
});

export const RegistryAssetSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  path: z.string().min(1),
  kind: z.enum(['sprite', 'sound', 'music', 'tileset', 'font', 'data', 'model']),
  category: z.enum(['character', 'environment', 'ui', 'effect', 'audio', 'data', 'font', 'custom']),
  variants: z.array(AssetVariantSchema).default(() => []),
  license: AssetLicenseSchema,
  metadata: AssetMetadataRegistrySchema.default(() => ({})),
  properties: z.record(z.any()).default(() => ({})),
  tags: z.array(z.string()).default(() => []),
  buildTargets: z.array(BuildTargetTypeSchema).default(() => ['desktop' as const, 'web' as const]),
  thumbnail: z.string().optional(),
  preview: z.string().optional(),
  source: AssetSourceSchema.optional(),
  compatibility: CompatibilityMetadataSchema.default(() => ({
    orchestratorVersion: '1.0.0',
    gameEngineVersions: ['2.0'],
    compatibilityLevel: 'full' as const,
    requiredFeatures: [],
    optionalFeatures: [],
    limitations: [],
    performanceImpact: 'low' as const,
    memoryUsage: 'low' as const
  })),
  createdAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val),
  updatedAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val)
});

// Registry Template Schema
const TemplateSlotSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['component', 'asset', 'mechanic', 'scene', 'system']),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
  acceptedTypes: z.array(z.string()).default([]),
  defaultValue: z.any().optional(),
  constraints: z.record(z.any()).optional()
});

const TemplateSceneNodeSchema: z.ZodType<{
  id: string;
  name: string; 
  type: string;
  properties?: Record<string, any>;
  children?: any[];
}> = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  properties: z.record(z.any()).optional(),
  children: z.array(z.lazy(() => TemplateSceneNodeSchema)).optional()
});

const TemplateEntitySchema = z.object({
  componentId: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  configuration: z.record(z.any()).optional()
});

const TemplateSceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  backgroundColor: z.string().optional(),
  entities: z.array(TemplateEntitySchema).default(() => [])
});

const TemplateSceneGraphSchema = z.object({
  root: TemplateSceneNodeSchema,
  scenes: z.array(TemplateSceneSchema).default([])
});

const TemplateGameSettingsSchema = z.object({
  screenWidth: z.number().positive(),
  screenHeight: z.number().positive(),
  targetFPS: z.number().positive().default(60),
  physics: z.object({
    enabled: z.boolean(),
    gravity: z.number()
  }).optional(),
  audio: z.object({
    enabled: z.boolean(),
    volume: z.number().min(0).max(1)
  }).optional()
});

const TemplatePreviewSchema = z.object({
  image: z.string().optional(),
  video: z.string().optional(),
  playable: z.string().optional()
});

const TemplateDocumentationSchema = z.object({
  tutorial: z.string().optional(),
  examples: z.array(z.object({
    title: z.string(),
    description: z.string(),
    configuration: z.record(z.any())
  })).optional()
});

export const RegistryTemplateSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum(['platformer', 'shooter', 'puzzle', 'racing', 'rpg', 'strategy', 'arcade', 'adventure', 'custom']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  slots: z.array(TemplateSlotSchema).default(() => []),
  requiredSystems: z.array(z.string()).default(() => []),
  requiredMechanics: z.array(z.string()).default(() => []),
  sceneGraph: TemplateSceneGraphSchema,
  defaultConfiguration: z.record(z.any()).default(() => ({})),
  gameSettings: TemplateGameSettingsSchema,
  buildTargets: z.array(BuildTargetTypeSchema).default(() => ['desktop' as const, 'web' as const]),
  tags: z.array(z.string()).default(() => []),
  preview: TemplatePreviewSchema.optional(),
  documentation: TemplateDocumentationSchema.optional(),
  compatibility: CompatibilityMetadataSchema.default(() => ({
    orchestratorVersion: '1.0.0',
    gameEngineVersions: ['2.0'],
    compatibilityLevel: 'full' as const,
    requiredFeatures: [],
    optionalFeatures: [],
    limitations: [],
    performanceImpact: 'low' as const,
    memoryUsage: 'low' as const
  })),
  createdAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val),
  updatedAt: z.union([z.string(), z.date()]).transform(val => typeof val === 'string' ? new Date(val) : val)
});

// Registry Build Target Schema
const BuildTargetPlatformSchema = z.object({
  os: z.array(z.enum(['windows', 'macos', 'linux', 'browser', 'ios', 'android'])),
  architecture: z.array(z.enum(['x86', 'x64', 'arm', 'arm64', 'wasm'])),
  minVersion: z.string().optional()
});

const BuildTargetCapabilitiesSchema = z.object({
  graphics: z.object({
    hardware2D: z.boolean(),
    hardware3D: z.boolean(),
    shaders: z.boolean(),
    maxTextureSize: z.number(),
    multipleWindows: z.boolean()
  }),
  audio: z.object({
    stereo: z.boolean(),
    surround: z.boolean(),
    streaming: z.boolean(),
    synthesis: z.boolean(),
    formats: z.array(z.string())
  }),
  input: z.object({
    keyboard: z.boolean(),
    mouse: z.boolean(),
    touch: z.boolean(),
    gamepad: z.boolean(),
    accelerometer: z.boolean(),
    gyroscope: z.boolean()
  }),
  storage: z.object({
    localStorage: z.boolean(),
    fileSystem: z.boolean(),
    maxLocalStorage: z.number().optional(),
    persistent: z.boolean()
  }),
  network: z.object({
    http: z.boolean(),
    websockets: z.boolean(),
    udp: z.boolean(),
    p2p: z.boolean()
  }),
  performance: z.object({
    multithreading: z.boolean(),
    webWorkers: z.boolean(),
    simd: z.boolean(),
    jit: z.boolean()
  })
});

const BuildTargetConstraintsSchema = z.object({
  maxMemoryMB: z.number().optional(),
  maxFileSizeMB: z.number().optional(),
  sandboxed: z.boolean().optional(),
  requiresPermissions: z.array(z.string()).optional(),
  blockedAPIs: z.array(z.string()).optional()
});

const BuildTargetBuildSettingsSchema = z.object({
  compiler: z.string().optional(),
  outputFormat: z.string().optional(),
  optimization: z.enum(['none', 'size', 'speed', 'balanced']),
  compression: z.boolean()
});

const BuildTargetRuntimeSchema = z.object({
  engine: z.string().optional(),
  version: z.string().optional(),
  dependencies: z.array(z.string()).optional()
});

const BuildTargetDeploymentSchema = z.object({
  distribution: z.array(z.enum(['direct', 'store', 'web', 'package_manager'])),
  signing: z.boolean().optional(),
  autoUpdate: z.boolean().optional()
});

export const RegistryBuildTargetSchema = z.object({
  id: BuildTargetTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  platform: BuildTargetPlatformSchema,
  capabilities: BuildTargetCapabilitiesSchema,
  constraints: BuildTargetConstraintsSchema.default({}),
  buildSettings: BuildTargetBuildSettingsSchema,
  runtime: BuildTargetRuntimeSchema.default({}),
  deployment: BuildTargetDeploymentSchema
});

// Export array schemas for validating JSON seed data
export const RegistryComponentArraySchema = z.array(RegistryComponentSchema);
export const RegistryMechanicArraySchema = z.array(RegistryMechanicSchema);
export const RegistryAssetArraySchema = z.array(RegistryAssetSchema);
export const RegistryTemplateArraySchema = z.array(RegistryTemplateSchema);
export const RegistryBuildTargetArraySchema = z.array(RegistryBuildTargetSchema);

// Export individual inferred types
export type ValidatedRegistryComponent = z.infer<typeof RegistryComponentSchema>;
export type ValidatedRegistryMechanic = z.infer<typeof RegistryMechanicSchema>;
export type ValidatedRegistryAsset = z.infer<typeof RegistryAssetSchema>;
export type ValidatedRegistryTemplate = z.infer<typeof RegistryTemplateSchema>;
export type ValidatedRegistryBuildTarget = z.infer<typeof RegistryBuildTargetSchema>;