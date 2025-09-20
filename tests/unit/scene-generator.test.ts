import { describe, it, expect } from 'vitest';
import { generatePygameScene, generateTestScene } from '@/lib/scene-generator';
import type { GeneratorOptions } from '@/lib/scene-generator';

describe('Scene Generator', () => {
  const baseSceneConfig = {
    name: 'Test Game',
    width: 800,
    height: 600,
    fps: 60,
    backgroundColor: '#000000'
  };
  
  describe('generatePygameScene', () => {
    it('should generate basic pygame boilerplate', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: []
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('import pygame');
      expect(code).toContain('pygame.init()');
      expect(code).toContain('SCREEN_WIDTH = 800');
      expect(code).toContain('SCREEN_HEIGHT = 600');
      expect(code).toContain('FPS = 60');
    });
    
    it('should include Player class', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: []
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('class Player:');
      expect(code).toContain('def __init__(self, x, y):');
      expect(code).toContain('def update(self):');
      expect(code).toContain('def draw(self, screen):');
    });
    
    it('should include Enemy class', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: []
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('class Enemy:');
      expect(code).toContain('def take_damage(self, amount):');
    });
    
    it('should include Platform class', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: []
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('class Platform:');
    });
    
    it('should integrate selected components', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
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
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('# Movement Systems');
      expect(code).toContain('pygame.K_SPACE'); // From jump component
      expect(code).toContain('pygame.K_LEFT'); // From walk component
      expect(code).toContain('pygame.K_RIGHT'); // From walk component
    });
    
    it('should group components by category', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'A',
            parameters: {},
            assets: {}
          },
          {
            componentId: 'health',
            variant: 'A',
            parameters: { max_health: 100 },
            assets: {}
          },
          {
            componentId: 'shooting',
            variant: 'A',
            parameters: { damage: 10 },
            assets: {}
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('# Movement Systems');
      expect(code).toContain('# Combat Systems');
      expect(code).toContain('# UI Systems');
    });
    
    it('should include game loop structure', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: []
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('running = True');
      expect(code).toContain('while running:');
      expect(code).toContain('for event in pygame.event.get():');
      expect(code).toContain('if event.type == pygame.QUIT:');
      expect(code).toContain('clock.tick(FPS)');
    });
    
    it('should handle asset mapping', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'shooting',
            variant: 'A',
            parameters: { damage: 10 },
            assets: {
              sound: 'laser.wav',
              projectile_sprite: 'projectile.png'
            }
          }
        ],
        assetMapping: {
          'laser.wav': 'assets/sounds/laser.wav',
          'projectile.png': 'assets/sprites/projectile.png'
        }
      };
      
      const code = generatePygameScene(options);
      
      // Component should reference the assets
      expect(code).toContain('laser.wav');
    });
  });
  
  describe('generateTestScene', () => {
    it('should generate a complete test scene', () => {
      const code = generateTestScene();
      
      expect(code).toBeDefined();
      expect(code).toContain('import pygame');
      expect(code).toContain('Test Scene');
      
      // Should include default components
      expect(code).toContain('# Movement Systems');
      expect(code).toContain('# UI Systems');
    });
  });
  
  describe('Parameter replacement', () => {
    it('should replace template parameters correctly', () => {
      const options: GeneratorOptions = {
        sceneConfig: baseSceneConfig,
        selectedComponents: [
          {
            componentId: 'jump',
            variant: 'B', // Double jump variant
            parameters: {
              jump_force: 20,
              double_jump_enabled: true
            },
            assets: {
              sound: 'double_jump.ogg'
            }
          }
        ]
      };
      
      const code = generatePygameScene(options);
      
      // Should have replaced the parameters in the code
      expect(code).toContain('20'); // jump_force value
      expect(code).toContain('double_jump.ogg');
    });
  });
  
  describe('Scene configuration', () => {
    it('should apply custom scene configuration', () => {
      const customConfig = {
        name: 'My Custom Game',
        width: 1024,
        height: 768,
        fps: 30,
        backgroundColor: '#FF0000'
      };
      
      const options: GeneratorOptions = {
        sceneConfig: customConfig,
        selectedComponents: []
      };
      
      const code = generatePygameScene(options);
      
      expect(code).toContain('My Custom Game');
      expect(code).toContain('SCREEN_WIDTH = 1024');
      expect(code).toContain('SCREEN_HEIGHT = 768');
      expect(code).toContain('FPS = 30');
      expect(code).toContain('#FF0000');
    });
  });
});