import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  getComponentById, 
  allComponents,
  getComponentsByCategory 
} from '@/lib/pygame-components';
import { generatePygameScene } from '@/lib/scene-generator';
import type { GeneratorOptions, ComponentSelection, PygameComponent } from '@/lib/pygame-components/types';

// Import specific components for detailed testing
import { jumpComponent } from '@/lib/pygame-components/movement/jump';
import { walkComponent } from '@/lib/pygame-components/movement/walk';
import { gravityComponent } from '@/lib/pygame-components/world/gravity';
import { collisionComponent } from '@/lib/pygame-components/world/collision';
import { shootingComponent } from '@/lib/pygame-components/combat/shooting';
import { meleeComponent } from '@/lib/pygame-components/combat/melee';
import { healthComponent } from '@/lib/pygame-components/ui/health';
import { scoreComponent } from '@/lib/pygame-components/ui/score';

describe('Component Interactions', () => {
  const baseSceneConfig = {
    name: 'Interaction Test Scene',
    width: 800,
    height: 600,
    fps: 60,
    backgroundColor: '#1a1a2e'
  };

  // Test 1: Movement + Gravity Components Interaction
  describe('Movement and Gravity Integration', () => {
    it('should handle jump and gravity conflicts without duplicating physics', () => {
      // Both jump and gravity components apply gravity - potential for double gravity
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: { gravity: 30, jump_power: 15 },
            assets: {}
          },
          {
            componentId: 'gravity',
            variant: 'A',
            parameters: { gravity_force: 800 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for potential double gravity application
      const gravityApplications = (code.match(/velocity_y \+=/g) || []).length;
      const gravityInJump = code.includes('self.gravity * dt');
      const gravityInSystem = code.includes('self.gravity_force * dt');
      
      // This test exposes the issue: both systems apply gravity
      expect(gravityApplications).toBeLessThanOrEqual(2); // Should fail if both apply
      
      // Check if there's a mechanism to disable gravity in jump when gravity system is active
      expect(code).toContain('GravitySystem');
      expect(code).toContain('JumpSystem');
      
      // This should fail - there's no coordination between systems
      const hasGravityCoordination = code.includes('disable_gravity') || 
                                     code.includes('use_external_gravity');
      expect(hasGravityCoordination).toBe(true);
    });
    
    it('should handle walk and collision velocity conflicts', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'walk',
            variant: 'A',
            parameters: { speed: 5, max_speed: 200 },
            assets: {}
          },
          {
            componentId: 'collision',
            variant: 'B', // Physics collision that modifies velocity
            parameters: { friction: 0.5 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for velocity modification conflicts
      const velocityModifications = (code.match(/velocity_x [+\-*\/]?=/g) || []).length;
      
      // Both systems modify velocity - potential for conflicts
      expect(velocityModifications).toBeGreaterThan(1);
      
      // Check if there's proper ordering of velocity updates
      const walkIndex = code.indexOf('walk_system.update');
      const collisionIndex = code.indexOf('collision_system.update');
      
      // Collision should happen after movement to avoid overriding
      expect(collisionIndex).toBeGreaterThan(walkIndex);
    });
    
    it('should handle multiple movement components without conflicts', () => {
      // Test with both jump and walk active simultaneously
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'B', // Realistic jump
            parameters: { jump_power: 15, coyote_time: 0.1 },
            assets: {}
          },
          {
            componentId: 'walk',
            variant: 'B', // Advanced walk with acceleration
            parameters: { acceleration: 10, max_speed: 300 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for shared state conflicts
      const onGroundChecks = (code.match(/on_ground/g) || []).length;
      const velocityXMods = (code.match(/velocity_x/g) || []).length;
      const velocityYMods = (code.match(/velocity_y/g) || []).length;
      
      // Multiple systems checking/setting on_ground could cause issues
      expect(onGroundChecks).toBeGreaterThan(2);
      
      // Check if facing_right is handled consistently
      const facingRightUsages = (code.match(/facing_right/g) || []).length;
      if (facingRightUsages > 0) {
        // Should be set in one place and read in others
        const facingRightSets = (code.match(/facing_right =/g) || []).length;
        expect(facingRightSets).toBeLessThanOrEqual(1);
      }
    });
  });

  // Test 2: Collision Detection with Multiple Entities
  describe('Multi-Entity Collision Handling', () => {
    it('should handle collisions between multiple entity types', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'collision',
            variant: 'A', // Box collision with groups
            parameters: {},
            assets: {}
          },
          {
            componentId: 'shooting',
            variant: 'A',
            parameters: { damage: 10 },
            assets: {}
          },
          {
            componentId: 'melee',
            variant: 'A',
            parameters: { damage: 20, range: 50 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for collision group management
      expect(code).toContain('collision_groups');
      
      // Check if projectiles and melee attacks are registered with collision system
      const hasProjectileCollision = code.includes('add_solid') && code.includes('projectile');
      const hasMeleeCollision = code.includes('collision') && code.includes('melee');
      
      // This might fail if systems don't integrate
      expect(hasProjectileCollision || hasMeleeCollision).toBe(true);
      
      // Check for collision callbacks
      expect(code).toContain('collision_callback');
    });
    
    it('should handle collision priority and resolution order', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'collision',
            variant: 'B', // Physics collision
            parameters: { bounciness: 0.8, friction: 0.2 },
            assets: {}
          },
          {
            componentId: 'gravity',
            variant: 'A',
            parameters: {},
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check update order - gravity should be before collision
      const gravityUpdate = code.indexOf('gravity_system.update');
      const collisionUpdate = code.indexOf('collision_system.update');
      
      // This might fail if order is wrong
      expect(gravityUpdate).toBeLessThan(collisionUpdate);
      
      // Check for duplicate collision checks
      const colliderectCalls = (code.match(/colliderect/g) || []).length;
      expect(colliderectCalls).toBeGreaterThan(0);
      
      // Check if platforms are shared between systems
      const platformReferences = (code.match(/platforms/g) || []).length;
      expect(platformReferences).toBeGreaterThan(2); // Should be used by multiple systems
    });
    
    it('should handle collision system memory with many entities', () => {
      // Test with maximum entities
      const manyProjectiles: ComponentSelection[] = [];
      
      // Simulate many combat components that create entities
      ['shooting', 'melee'].forEach(compId => {
        for (let i = 0; i < 3; i++) {
          manyProjectiles.push({
            componentId: compId,
            variant: 'A',
            parameters: { 
              damage: 10 + i,
              projectile_speed: 500 + i * 100 
            },
            assets: {}
          });
        }
      });
      
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'collision',
            variant: 'A',
            parameters: {},
            assets: {}
          },
          ...manyProjectiles
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for entity cleanup code
      const hasCleanup = code.includes('remove_entity') || 
                         code.includes('cleanup') ||
                         code.includes('destroy');
      
      // This might fail - no cleanup mechanisms
      expect(hasCleanup).toBe(true);
      
      // Check for entity limits
      const hasEntityLimit = code.includes('max_entities') || 
                            code.includes('MAX_PROJECTILES');
      expect(hasEntityLimit).toBe(true);
    });
  });

  // Test 3: UI Components Updating Based on Game State
  describe('UI and Game State Synchronization', () => {
    it('should properly sync health UI with player health changes', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'health',
            variant: 'A', // Hearts display
            parameters: { max_health: 100, health_color: '#ff0000' },
            assets: {}
          },
          {
            componentId: 'shooting',
            variant: 'A',
            parameters: { damage: 10 },
            assets: {}
          },
          {
            componentId: 'melee',
            variant: 'A', 
            parameters: { damage: 25 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check if health system reads from player
      expect(code).toContain('player.health');
      expect(code).toContain('player.max_health');
      
      // Check if damage systems update player health
      const damageApplications = code.includes('take_damage') || 
                                code.includes('health -=');
      expect(damageApplications).toBe(true);
      
      // Check if UI updates when health changes
      const healthUpdate = code.includes('health_system.update');
      const healthDraw = code.includes('health_system.draw');
      
      expect(healthUpdate).toBe(true);
      expect(healthDraw).toBe(true);
      
      // Check for health bounds checking
      const healthBounds = code.includes('max(0') || 
                          code.includes('min(max_health');
      expect(healthBounds).toBe(true);
    });
    
    it('should handle score updates from multiple sources', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'score',
            variant: 'A',
            parameters: { font_size: 24 },
            assets: {}
          },
          {
            componentId: 'shooting',
            variant: 'A',
            parameters: { damage: 10, points_per_hit: 10 },
            assets: {}
          },
          {
            componentId: 'melee',
            variant: 'A',
            parameters: { damage: 20, points_per_hit: 5 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check if score system exists
      expect(code).toContain('ScoreSystem');
      
      // Check for score updates from combat
      const scoreUpdates = (code.match(/score \+=/g) || []).length +
                          (code.match(/add_score/g) || []).length +
                          (code.match(/points/g) || []).length;
      
      // Should have multiple score update points
      expect(scoreUpdates).toBeGreaterThan(0);
      
      // Check for score persistence
      const hasScorePersistence = code.includes('high_score') ||
                                  code.includes('save_score');
      // This might fail - no persistence
      expect(hasScorePersistence).toBe(true);
    });
    
    it('should handle UI state transitions and animations', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'health',
            variant: 'B', // Bar display
            parameters: { max_health: 100 },
            assets: {}
          },
          {
            componentId: 'health',
            variant: 'C', // Number display - duplicate component!
            parameters: { max_health: 100 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for duplicate health systems - this should cause issues
      const healthSystemCount = (code.match(/HealthSystem/g) || []).length;
      
      // This might expose duplicate component issues
      expect(healthSystemCount).toBeLessThanOrEqual(1);
      
      // Check for animation/transition code
      const hasAnimations = code.includes('lerp') ||
                          code.includes('animation') ||
                          code.includes('transition');
      
      // UI should have smooth transitions
      expect(hasAnimations).toBe(true);
    });
  });

  // Test 4 & 5: Component Parameter and Asset Conflicts
  describe('Parameter and Asset Slot Conflicts', () => {
    it('should handle conflicting parameter values between components', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: { 
              gravity: 30, // Jump has its own gravity
              max_fall_speed: 20 
            },
            assets: {}
          },
          {
            componentId: 'gravity',
            variant: 'A',
            parameters: { 
              gravity_force: 800, // Different gravity value!
              terminal_velocity: 600 // Different from max_fall_speed!
            },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for conflicting gravity values
      expect(code).toContain('30'); // Jump gravity
      expect(code).toContain('800'); // System gravity
      
      // Check for conflicting terminal velocity
      expect(code).toContain('20'); // max_fall_speed
      expect(code).toContain('600'); // terminal_velocity
      
      // This reveals the conflict - both values are used independently
      const gravityValues = code.match(/gravity[^=]*=\s*\d+/g) || [];
      expect(gravityValues.length).toBeLessThanOrEqual(1); // Should fail with conflicts
    });
    
    it('should handle overlapping asset slots', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: {},
            assets: { 
              sound: 'jump.ogg' // Jump sound
            }
          },
          {
            componentId: 'collision',
            variant: 'A',
            parameters: {},
            assets: { 
              sound: 'collision.ogg' // Collision sound - same slot name!
            }
          },
          {
            componentId: 'shooting',
            variant: 'A', 
            parameters: {},
            assets: { 
              sound: 'shoot.ogg' // Shooting sound - another conflict!
            }
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // All three sounds should be in the code
      expect(code).toContain('jump.ogg');
      expect(code).toContain('collision.ogg');
      expect(code).toContain('shoot.ogg');
      
      // Check if sounds are properly scoped to their systems
      const soundReferences = (code.match(/play_sound|Sound|\.ogg/g) || []).length;
      expect(soundReferences).toBeGreaterThanOrEqual(3);
      
      // Check for sound conflict resolution
      const hasSoundNamespacing = code.includes('jump_sound') &&
                                  code.includes('collision_sound') &&
                                  code.includes('shoot_sound');
      // This might fail - no namespacing
      expect(hasSoundNamespacing).toBe(true);
    });
    
    it('should handle missing required parameters', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: {}, // Missing required parameters!
            assets: {}
          },
          {
            componentId: 'health',
            variant: 'A',
            parameters: {}, // Missing max_health!
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check if default values are used
      const hasDefaults = code.includes('{{jump_power}}') === false &&
                         code.includes('{{max_health}}') === false;
      
      // Templates should be replaced with defaults
      expect(hasDefaults).toBe(true);
      
      // Check for parameter validation
      const hasValidation = code.includes('assert') ||
                          code.includes('if not') ||
                          code.includes('raise');
      
      // This might fail - no validation
      expect(hasValidation).toBe(true);
    });
  });

  // Test 6 & 7: Initialization Order and Cleanup
  describe('Component Lifecycle Management', () => {
    it('should initialize components in correct dependency order', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'collision',
            variant: 'A',
            parameters: {},
            assets: {}
          },
          {
            componentId: 'gravity',
            variant: 'A',
            parameters: {},
            assets: {}
          },
          {
            componentId: 'jump',
            variant: 'A',
            parameters: {},
            assets: {}
          },
          {
            componentId: 'health',
            variant: 'A',
            parameters: {},
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Find initialization order
      const collisionInit = code.indexOf('CollisionSystem()');
      const gravityInit = code.indexOf('GravitySystem()');
      const jumpInit = code.indexOf('JumpSystem(player)');
      const healthInit = code.indexOf('HealthSystem(player)');
      
      // Player must exist before components that use it
      const playerInit = code.indexOf('Player(');
      expect(playerInit).toBeLessThan(jumpInit);
      expect(playerInit).toBeLessThan(healthInit);
      
      // World systems should init before movement systems
      if (collisionInit > -1 && jumpInit > -1) {
        // This might fail if order is wrong
        expect(collisionInit).toBeLessThan(jumpInit);
      }
      
      // Check for circular dependencies
      const hasCircularCheck = code.includes('initialized') ||
                              code.includes('_ready');
      expect(hasCircularCheck).toBe(true);
    });
    
    it('should properly cleanup resources and prevent memory leaks', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'shooting',
            variant: 'B', // Spread shot with multiple projectiles
            parameters: { 
              damage: 10,
              projectile_count: 5,
              spread_angle: 30
            },
            assets: {}
          },
          {
            componentId: 'collision',
            variant: 'B', // Physics with dynamic objects
            parameters: {},
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for cleanup methods
      const hasCleanup = code.includes('def cleanup') ||
                        code.includes('def destroy') ||
                        code.includes('def dispose');
      
      // This might fail - no cleanup
      expect(hasCleanup).toBe(true);
      
      // Check for projectile cleanup
      const hasProjectileCleanup = code.includes('remove_projectile') ||
                                   code.includes('projectiles.remove') ||
                                   code.includes('del projectile');
      expect(hasProjectileCleanup).toBe(true);
      
      // Check for event listener cleanup
      const hasEventCleanup = code.includes('remove_listener') ||
                             code.includes('unregister') ||
                             code.includes('pygame.quit');
      expect(hasEventCleanup).toBe(true);
      
      // Check for proper game exit
      expect(code).toContain('pygame.quit()');
      expect(code).toContain('sys.exit()');
    });
    
    it('should handle component hot-reload without state loss', () => {
      // Test component system's ability to handle runtime changes
      const initialComponents: ComponentSelection[] = [
        {
          componentId: 'walk',
          variant: 'A',
          parameters: { speed: 5 },
          assets: {}
        }
      ];
      
      const updatedComponents: ComponentSelection[] = [
        {
          componentId: 'walk',
          variant: 'B', // Changed variant!
          parameters: { speed: 10, acceleration: 5 }, // Changed params!
          assets: {}
        },
        {
          componentId: 'jump', // Added new component!
          variant: 'A',
          parameters: {},
          assets: {}
        }
      ];
      
      const initialCode = generatePygameScene({
        sceneConfig: baseSceneConfig,
        selectedComponents: initialComponents
      });
      
      const updatedCode = generatePygameScene({
        sceneConfig: baseSceneConfig,
        selectedComponents: updatedComponents
      });
      
      // Check for state preservation code
      const hasStateSave = initialCode.includes('save_state') ||
                          initialCode.includes('serialize') ||
                          initialCode.includes('checkpoint');
      
      // This will likely fail - no state management
      expect(hasStateSave).toBe(true);
      
      // Check if updated code can handle existing state
      const hasStateRestore = updatedCode.includes('load_state') ||
                            updatedCode.includes('deserialize') ||
                            updatedCode.includes('restore');
      expect(hasStateRestore).toBe(true);
    });
  });

  // Test 8: Invalid Configurations
  describe('Invalid Component Configurations', () => {
    it('should handle incompatible component combinations', () => {
      // Try to use two different collision systems
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'collision',
            variant: 'A', // Box collision
            parameters: {},
            assets: {}
          },
          {
            componentId: 'collision',
            variant: 'B', // Physics collision - duplicate component type!
            parameters: {},
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // This should cause issues - two collision systems
      const collisionSystemCount = (code.match(/CollisionSystem/g) || []).length;
      
      // Should not allow duplicate system types
      expect(collisionSystemCount).toBeLessThanOrEqual(1);
      
      // Check for conflict detection
      const hasConflictCheck = code.includes('conflict') ||
                              code.includes('incompatible') ||
                              code.includes('already exists');
      expect(hasConflictCheck).toBe(true);
    });
    
    it('should handle invalid parameter types and ranges', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: {
              jump_power: -10, // Negative jump power!
              gravity: 0, // Zero gravity!
              max_jumps: 999, // Excessive jumps!
              max_hold_time: -1 // Negative time!
            },
            assets: {}
          },
          {
            componentId: 'health',
            variant: 'A',
            parameters: {
              max_health: 0, // Zero health!
              health_color: 'invalid_color' // Invalid color format!
            },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for parameter validation
      const hasValidation = code.includes('assert') ||
                          code.includes('ValueError') ||
                          code.includes('if ') && code.includes('raise');
      
      // This might fail - no validation
      expect(hasValidation).toBe(true);
      
      // Check for bounds checking
      const hasBoundsCheck = code.includes('max(') ||
                           code.includes('min(') ||
                           code.includes('clamp');
      expect(hasBoundsCheck).toBe(true);
    });
    
    it('should handle missing dependencies gracefully', () => {
      // Use components that depend on others without including dependencies
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: {},
            assets: {}
            // Jump expects gravity but we don't include gravity component
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Jump component includes its own gravity
      expect(code).toContain('gravity');
      
      // Check for dependency checks
      const hasDependencyCheck = code.includes('require') ||
                                code.includes('depend') ||
                                code.includes('if not hasattr');
      
      // This might fail - no dependency management
      expect(hasDependencyCheck).toBe(true);
    });
  });

  // Test 9: Python Code Generation Edge Cases
  describe('Python Code Generation Edge Cases', () => {
    it('should handle template parameter replacement edge cases', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: {
              jump_power: 0.5, // Float value
              gravity: 100.123, // High precision float
              max_jumps: 1.5, // Float where int expected
              max_hold_time: '0.3', // String where number expected
              invalid_param: 'test' // Unknown parameter
            } as any,
            assets: {
              sound: '', // Empty string
              invalid_asset: 'test.ogg' // Unknown asset slot
            }
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check if template replacements work
      expect(code).not.toContain('{{'); // No unreplaced templates
      expect(code).not.toContain('}}');
      
      // Check for type conversions
      const hasTypeConversion = code.includes('int(') ||
                              code.includes('float(') ||
                              code.includes('str(');
      expect(hasTypeConversion).toBe(true);
      
      // Check for empty asset handling
      expect(code).not.toContain("''"); // No empty strings in conditionals
    });
    
    it('should generate valid Python with special characters in parameters', () => {
      const options: GeneratorOptions = {
        sceneConfig: {
          ...baseSceneConfig,
          name: 'Test "Game" with \'Quotes\'', // Special characters in name
          backgroundColor: 'rgb(255, 0, 0)' // Non-hex color
        },
        selectedComponents: [
          {
            componentId: 'health',
            variant: 'A',
            parameters: {
              health_color: '#FF00FF', // Hex color
              font_name: 'Arial "Bold"' // Quotes in string
            } as any,
            assets: {
              sound: 'path/with spaces/sound.ogg' // Spaces in path
            }
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for proper string escaping
      expect(code).not.toContain('"""'); // No triple quotes inside strings
      
      // Check for valid Python strings
      const stringPattern = /["'][^"']*["']/g;
      const strings = code.match(stringPattern) || [];
      
      strings.forEach(str => {
        // Each string should be properly closed
        expect(str[0]).toBe(str[str.length - 1]);
      });
      
      // Check color conversion
      expect(code).toContain('pygame.Color');
    });
    
    it('should handle mixed component variants correctly', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A', // Floaty jump
            parameters: {},
            assets: {}
          },
          {
            componentId: 'jump',
            variant: 'B', // Realistic jump - same component, different variant!
            parameters: {},
            assets: {}
          },
          {
            componentId: 'collision',
            variant: 'A',
            parameters: {},
            assets: {}
          },
          {
            componentId: 'collision',
            variant: 'B', // Another duplicate with different variant
            parameters: {},
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check how duplicates are handled
      const jumpSystemCount = (code.match(/JumpSystem/g) || []).length;
      const collisionSystemCount = (code.match(/CollisionSystem/g) || []).length;
      
      // Should not create duplicate systems
      expect(jumpSystemCount).toBeLessThanOrEqual(2);
      expect(collisionSystemCount).toBeLessThanOrEqual(2);
      
      // Check for variant conflict resolution
      const hasVariantCheck = code.includes('variant') ||
                            code.includes('version') ||
                            code.includes('mode');
      expect(hasVariantCheck).toBe(true);
    });
  });

  // Test 10: Runtime Component Hot-swapping
  describe('Component Hot-swapping During Runtime', () => {
    it('should support runtime component parameter changes', () => {
      const code = generateTestScene();
      
      // Check for runtime configuration
      const hasRuntimeConfig = code.includes('reload_config') ||
                             code.includes('update_parameters') ||
                             code.includes('hot_reload');
      
      // This will likely fail - no hot reload support
      expect(hasRuntimeConfig).toBe(true);
      
      // Check for parameter watchers
      const hasWatchers = code.includes('on_change') ||
                        code.includes('watch') ||
                        code.includes('observe');
      expect(hasWatchers).toBe(true);
    });
    
    it('should handle component addition and removal at runtime', () => {
      const code = generateTestScene();
      
      // Check for dynamic component management
      const hasDynamicAdd = code.includes('add_component') ||
                          code.includes('register_component') ||
                          code.includes('attach_component');
      
      // This will fail - static component setup only
      expect(hasDynamicAdd).toBe(true);
      
      const hasDynamicRemove = code.includes('remove_component') ||
                              code.includes('unregister_component') ||
                              code.includes('detach_component');
      expect(hasDynamicRemove).toBe(true);
      
      // Check for component lifecycle hooks
      const hasLifecycleHooks = code.includes('on_attach') ||
                               code.includes('on_detach') ||
                               code.includes('on_enable');
      expect(hasLifecycleHooks).toBe(true);
    });
    
    it('should maintain game state during component swaps', () => {
      // Generate two versions of the same scene
      const scene1 = generatePygameScene({
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'walk',
            variant: 'A',
            parameters: { speed: 5 },
            assets: {}
          }
        ]
      });
      
      const scene2 = generatePygameScene({
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'walk',
            variant: 'B', // Different variant
            parameters: { speed: 10 },
            assets: {}
          }
        ]
      });
      
      // Check for state transfer mechanism
      const hasStateTransfer = scene1.includes('export_state') ||
                             scene1.includes('get_state') ||
                             scene1.includes('save_state');
      
      // This will fail - no state management
      expect(hasStateTransfer).toBe(true);
      
      // Check if scene2 can import state
      const hasStateImport = scene2.includes('import_state') ||
                           scene2.includes('set_state') ||
                           scene2.includes('load_state');
      expect(hasStateImport).toBe(true);
    });
  });

  // Additional Edge Case Tests
  describe('Complex Integration Scenarios', () => {
    it('should handle maximum component complexity', () => {
      // Test with all components active
      const allComponentSelections: ComponentSelection[] = allComponents.map(comp => ({
        componentId: comp.id,
        variant: 'A',
        parameters: {},
        assets: {}
      }));
      
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: allComponentSelections
      };
      
      const code = generatePygameScene(options);
      
      // Should generate without errors
      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(1000);
      
      // Check for system overload handling
      const hasPerformanceCheck = code.includes('fps') ||
                                 code.includes('performance') ||
                                 code.includes('profile');
      expect(hasPerformanceCheck).toBe(true);
    });
    
    it('should handle empty component selections', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: []
      };
      
      const code = generatePygameScene(options);
      
      // Should still generate valid base game
      expect(code).toContain('import pygame');
      expect(code).toContain('class Player');
      expect(code).toContain('while running');
    });
    
    it('should detect and prevent infinite loops in component interactions', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'gravity',
            variant: 'B', // Low gravity with zones
            parameters: { gravity_force: -100 }, // Negative gravity!
            assets: {}
          },
          {
            componentId: 'jump',
            variant: 'A',
            parameters: { jump_power: 100, gravity: -50 }, // Also negative!
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for infinite loop prevention
      const hasLoopPrevention = code.includes('max_iterations') ||
                               code.includes('timeout') ||
                               code.includes('break');
      
      // This might fail - no loop prevention
      expect(hasLoopPrevention).toBe(true);
    });
    
    it('should handle variant-specific asset requirements', () => {
      // Some variants might require specific assets
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'health',
            variant: 'A', // Hearts display - needs heart sprite
            parameters: {},
            assets: {} // Missing heart sprite!
          },
          {
            componentId: 'shooting',
            variant: 'C', // Laser variant - needs special effects
            parameters: {},
            assets: {} // Missing laser sprite!
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for asset validation
      const hasAssetValidation = code.includes('assert') && code.includes('asset') ||
                                code.includes('missing') && code.includes('sprite') ||
                                code.includes('default_sprite');
      
      // This might fail - no asset validation
      expect(hasAssetValidation).toBe(true);
    });
  });

  // Performance and Memory Tests
  describe('Performance and Memory Management', () => {
    it('should optimize collision checks for many entities', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'collision',
            variant: 'B', // Physics collision
            parameters: {},
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for spatial partitioning or optimization
      const hasOptimization = code.includes('quadtree') ||
                            code.includes('spatial') ||
                            code.includes('grid') ||
                            code.includes('broad_phase');
      
      // This will likely fail - no optimization
      expect(hasOptimization).toBe(true);
    });
    
    it('should handle resource pooling for frequently created objects', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'shooting',
            variant: 'B', // Spread shot - creates many projectiles
            parameters: {},
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Check for object pooling
      const hasPooling = code.includes('pool') ||
                       code.includes('recycle') ||
                       code.includes('reuse');
      
      // This will fail - no pooling
      expect(hasPooling).toBe(true);
    });
  });
});

// Test helper to generate test scene
function generateTestScene(): string {
  const testConfig: GeneratorOptions = {
    sceneConfig: {
      name: 'Test Scene',
      width: 800,
      height: 600,
      fps: 60,
      backgroundColor: '#000000'
    },
    selectedComponents: [
      {
        componentId: 'walk',
        variant: 'A',
        parameters: { speed: 5 },
        assets: {}
      },
      {
        componentId: 'jump',
        variant: 'A',
        parameters: { jump_power: 15 },
        assets: {}
      }
    ]
  };
  
  return generatePygameScene(testConfig);
}