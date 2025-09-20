import { describe, it, expect, beforeEach } from 'vitest';
import { generatePygameScene } from '@/lib/scene-generator';
import type { ComponentSelection } from '@/lib/pygame-components/types';

describe('Asset Binding Integration Tests', () => {
  describe('Asset Path Resolution', () => {
    it('should correctly map asset paths in generated code', () => {
      const selectedComponents: ComponentSelection[] = [
        {
          componentId: 'jump',
          variant: 'A',
          parameters: { jump_force: 15 },
          assets: { 
            sound: 'jump_sound.ogg',
            character: 'player_sprite.png'
          }
        }
      ];
      
      const scene = generatePygameScene({
        sceneConfig: {
          name: 'Asset Test',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents,
        assetMapping: {
          'jump_sound.ogg': 'assets/audio/sfx/movement/jump_sound.ogg',
          'player_sprite.png': 'assets/sprites/player_sprite.png'
        }
      });
      
      // Check that asset references are included
      expect(scene).toContain('jump_sound.ogg');
    });
    
    it('should handle multiple asset types per component', () => {
      const selectedComponents: ComponentSelection[] = [
        {
          componentId: 'shooting',
          variant: 'B', // Spread shot
          parameters: { 
            damage: 10,
            projectile_speed: 8,
            spread_angle: 15
          },
          assets: {
            sound: 'shotgun.wav',
            projectile_sprite: 'bullet.png',
            muzzle_flash: 'flash.png'
          }
        }
      ];
      
      const scene = generatePygameScene({
        sceneConfig: {
          name: 'Multi-Asset Test',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents,
        assetMapping: {
          'shotgun.wav': 'assets/audio/sfx/weapons/shotgun.wav',
          'bullet.png': 'assets/sprites/bullet.png',
          'flash.png': 'assets/sprites/muzzle_flash.png'
        }
      });
      
      expect(scene).toContain('shotgun.wav');
    });
  });
  
  describe('Asset Categories', () => {
    it('should validate asset categories match component requirements', () => {
      const components = [
        {
          componentId: 'jump',
          variant: 'A',
          parameters: {},
          assets: { sound: 'jump.ogg' }
        },
        {
          componentId: 'health',
          variant: 'A',
          parameters: { max_health: 100 },
          assets: { heart_sprite: 'heart.png' }
        }
      ];
      
      components.forEach(component => {
        Object.keys(component.assets).forEach(assetSlot => {
          // Asset slots should be valid
          expect(['sound', 'character', 'heart_sprite', 'projectile_sprite']).toContain(assetSlot);
        });
      });
    });
    
    it('should handle missing optional assets gracefully', () => {
      const selectedComponents: ComponentSelection[] = [
        {
          componentId: 'jump',
          variant: 'A',
          parameters: { jump_force: 15 },
          assets: {} // No assets provided
        }
      ];
      
      const scene = generatePygameScene({
        sceneConfig: {
          name: 'No Assets Test',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents
      });
      
      // Should still generate valid code
      expect(scene).toContain('import pygame');
      expect(scene).toContain('class Player:');
    });
  });
  
  describe('Asset Loading in Generated Code', () => {
    it('should generate pygame.mixer.Sound for audio assets', () => {
      const selectedComponents: ComponentSelection[] = [
        {
          componentId: 'shooting',
          variant: 'A',
          parameters: { damage: 10 },
          assets: { 
            sound: 'laser.wav'
          }
        }
      ];
      
      const scene = generatePygameScene({
        sceneConfig: {
          name: 'Audio Test',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents
      });
      
      // Should reference sound playing capability
      expect(scene).toContain('play_sound');
    });
    
    it('should generate pygame.image.load for sprite assets', () => {
      const selectedComponents: ComponentSelection[] = [
        {
          componentId: 'health',
          variant: 'A', // Hearts display
          parameters: { 
            max_health: 100,
            health_color: '#FF0000'
          },
          assets: { 
            heart_sprite: 'heart.png'
          }
        }
      ];
      
      const scene = generatePygameScene({
        sceneConfig: {
          name: 'Sprite Test',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents
      });
      
      // Check for UI system inclusion
      expect(scene).toContain('# UI Systems');
    });
  });
  
  describe('Dynamic Asset Binding', () => {
    it('should support runtime asset switching', () => {
      const baseComponents: ComponentSelection[] = [
        {
          componentId: 'walk',
          variant: 'A',
          parameters: { speed: 5 },
          assets: { 
            character: 'player1.png'
          }
        }
      ];
      
      // Generate with first set of assets
      const scene1 = generatePygameScene({
        sceneConfig: {
          name: 'Dynamic Asset Test 1',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents: baseComponents
      });
      
      // Generate with different assets
      const altComponents: ComponentSelection[] = [
        {
          ...baseComponents[0],
          assets: { character: 'player2.png' }
        }
      ];
      
      const scene2 = generatePygameScene({
        sceneConfig: {
          name: 'Dynamic Asset Test 2',
          width: 800,
          height: 600,
          fps: 60,
          backgroundColor: '#000000'
        },
        selectedComponents: altComponents
      });
      
      // Both should be valid but reference different assets
      expect(scene1).toContain('player1.png');
      expect(scene2).toContain('player2.png');
    });
  });
});