import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createPyodideTestContext, 
  injectFakePygame,
  testComponentExecution 
} from './pyodide-fixture';
import { jumpComponent } from '@/lib/pygame-components/movement/jump';
import { shootingComponent } from '@/lib/pygame-components/combat/shooting';
import { generatePygameScene } from '@/lib/scene-generator';

describe('Component Execution Integration Tests', () => {
  let pyodideContext: any;
  let pyodide: any;
  
  beforeEach(async () => {
    pyodideContext = await createPyodideTestContext();
    pyodide = await pyodideContext.loadPyodide();
  });
  
  describe('Movement Components', () => {
    it('should execute jump component code', async () => {
      const jumpCode = jumpComponent.variants.A.pythonCode;
      
      // Setup player and environment
      const setupCode = `
player = type('Player', (), {
    'x': 100,
    'y': 200,
    'velocity_y': 0,
    'on_ground': True,
    'jump_force': 15
})()
`;
      
      const result = await testComponentExecution(pyodide, jumpCode, setupCode);
      expect(result.success).toBe(true);
      expect(result.player).toBeDefined();
    });
    
    it('should handle double jump variant', async () => {
      const doubleJumpCode = jumpComponent.variants.B.pythonCode;
      
      const setupCode = `
player = type('Player', (), {
    'x': 100,
    'y': 200,
    'velocity_y': 0,
    'on_ground': False,
    'jump_force': 15,
    'jump_count': 1,
    'max_jumps': 2
})()
`;
      
      const result = await testComponentExecution(pyodide, doubleJumpCode, setupCode);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Combat Components', () => {
    it('should execute shooting component code', async () => {
      const shootCode = shootingComponent.variants.A.pythonCode;
      
      const setupCode = `
import math

class Projectile:
    def __init__(self, x, y, vx, vy):
        self.x = x
        self.y = y
        self.velocity_x = vx
        self.velocity_y = vy

player = type('Player', (), {
    'x': 100,
    'y': 200,
    'facing_right': True,
    'projectile_speed': 10
})()

projectiles = []
`;
      
      const result = await testComponentExecution(pyodide, shootCode, setupCode);
      expect(result.success).toBe(true);
    });
    
    it('should create projectiles when shooting', async () => {
      const shootCode = `
# Simplified shooting logic for testing
new_projectile = Projectile(player.x, player.y, 10, 0)
projectiles.append(new_projectile)
`;
      
      const setupCode = `
class Projectile:
    def __init__(self, x, y, vx, vy):
        self.x = x
        self.y = y
        self.velocity_x = vx
        self.velocity_y = vy

player = type('Player', (), {'x': 100, 'y': 200})()
projectiles = []
`;
      
      const result = await testComponentExecution(pyodide, shootCode, setupCode);
      expect(result.projectiles).toBeDefined();
      expect(result.projectiles.length).toBeGreaterThan(0);
    });
  });
  
  describe('Full Scene Generation', () => {
    it('should generate executable pygame scene', () => {
      const scene = generatePygameScene({
        sceneConfig: {
          name: 'Test Scene',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: { jump_force: 15 },
            assets: { sound: 'jump.ogg' }
          },
          {
            componentId: 'walk',
            variant: 'A',
            parameters: { speed: 5 },
            assets: {}
          }
        ]
      });
      
      expect(scene).toContain('import pygame');
      expect(scene).toContain('class Player:');
      expect(scene).toContain('pygame.K_SPACE');
      expect(scene).toContain('pygame.K_LEFT');
    });
    
    it('should include all component systems in correct order', () => {
      const scene = generatePygameScene({
        sceneConfig: {
          name: 'Complex Scene',
          width: 1024,
          height: 768,
          fps: 30,
          backgroundColor: '#222222'
        },
        selectedComponents: [
          {
            componentId: 'gravity',
            variant: 'A',
            parameters: { gravity_strength: 0.5 },
            assets: {}
          },
          {
            componentId: 'collision',
            variant: 'A',
            parameters: {},
            assets: {}
          },
          {
            componentId: 'health',
            variant: 'B',
            parameters: { max_health: 100 },
            assets: { heart_sprite: 'heart.png' }
          }
        ]
      });
      
      // Check that systems are organized by category
      const worldIndex = scene.indexOf('# World Systems');
      const uiIndex = scene.indexOf('# UI Systems');
      
      expect(worldIndex).toBeGreaterThan(-1);
      expect(uiIndex).toBeGreaterThan(-1);
      expect(uiIndex).toBeGreaterThan(worldIndex); // UI comes after World
    });
  });
});