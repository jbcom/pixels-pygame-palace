import { describe, it, expect } from 'vitest';
import { 
  getComponentById, 
  getComponentsByCategory, 
  getCategories,
  allComponents 
} from '@/lib/pygame-components';
import { jumpComponent } from '@/lib/pygame-components/movement/jump';
import { walkComponent } from '@/lib/pygame-components/movement/walk';
import { shootingComponent } from '@/lib/pygame-components/combat/shooting';
import { healthComponent } from '@/lib/pygame-components/ui/health';

describe('Pygame Components', () => {
  describe('Component structure', () => {
    it('should have all required properties', () => {
      allComponents.forEach(component => {
        expect(component).toHaveProperty('id');
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('category');
        expect(component).toHaveProperty('description');
        expect(component).toHaveProperty('variants');
        expect(component).toHaveProperty('parameters');
        expect(component).toHaveProperty('assetSlots');
      });
    });
    
    it('should have valid categories', () => {
      const validCategories = ['movement', 'combat', 'ui', 'world'];
      allComponents.forEach(component => {
        expect(validCategories).toContain(component.category);
      });
    });
    
    it('should have at least one variant per component', () => {
      allComponents.forEach(component => {
        expect(Object.keys(component.variants).length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('Jump component', () => {
    it('should have correct basic properties', () => {
      expect(jumpComponent.id).toBe('jump');
      expect(jumpComponent.name).toBe('Jump');
      expect(jumpComponent.category).toBe('movement');
    });
    
    it('should have multiple variants', () => {
      expect(jumpComponent.variants).toHaveProperty('A');
      expect(jumpComponent.variants).toHaveProperty('B');
      expect(jumpComponent.variants).toHaveProperty('C');
    });
    
    it('should generate Python code with pygame key handling', () => {
      const variant = jumpComponent.variants.A;
      expect(variant.pythonCode).toContain('pygame.K_SPACE');
      expect(variant.pythonCode).toContain('jump_force');
      expect(variant.pythonCode).toContain('velocity_y');
    });
    
    it('should have asset slots for sounds', () => {
      expect(jumpComponent.assetSlots).toHaveProperty('sound');
      expect(jumpComponent.assetSlots.sound).toBe('audio/sfx/movement');
    });
  });
  
  describe('Walk component', () => {
    it('should handle horizontal movement', () => {
      const variant = walkComponent.variants.A;
      expect(variant.pythonCode).toContain('pygame.K_LEFT');
      expect(variant.pythonCode).toContain('pygame.K_RIGHT');
      expect(variant.pythonCode).toContain('velocity_x');
    });
    
    it('should have speed parameter', () => {
      expect(walkComponent.parameters).toHaveProperty('speed');
      expect(walkComponent.parameters.speed.type).toBe('number');
    });
  });
  
  describe('Shooting component', () => {
    it('should have projectile variants', () => {
      expect(shootingComponent.variants).toHaveProperty('A'); // Basic projectile
      expect(shootingComponent.variants).toHaveProperty('B'); // Spread shot
      expect(shootingComponent.variants).toHaveProperty('C'); // Laser
    });
    
    it('should include damage parameters', () => {
      expect(shootingComponent.parameters).toHaveProperty('damage');
      expect(shootingComponent.parameters).toHaveProperty('projectile_speed');
    });
    
    it('should have sound and sprite asset slots', () => {
      expect(shootingComponent.assetSlots).toHaveProperty('sound');
      expect(shootingComponent.assetSlots).toHaveProperty('projectile_sprite');
    });
  });
  
  describe('Health component', () => {
    it('should handle health display', () => {
      expect(healthComponent.category).toBe('ui');
      expect(healthComponent.parameters).toHaveProperty('max_health');
      expect(healthComponent.parameters).toHaveProperty('health_color');
    });
    
    it('should have different display variants', () => {
      // Heart display
      expect(healthComponent.variants.A.name).toContain('Hearts');
      // Bar display  
      expect(healthComponent.variants.B.name).toContain('Bar');
      // Numeric display
      expect(healthComponent.variants.C.name).toContain('Number');
    });
  });
  
  describe('Helper functions', () => {
    describe('getComponentById', () => {
      it('should return correct component', () => {
        const component = getComponentById('jump');
        expect(component).toBe(jumpComponent);
      });
      
      it('should return undefined for invalid ID', () => {
        const component = getComponentById('invalid-id');
        expect(component).toBeUndefined();
      });
    });
    
    describe('getComponentsByCategory', () => {
      it('should return all movement components', () => {
        const movementComponents = getComponentsByCategory('movement');
        expect(movementComponents).toContain(jumpComponent);
        expect(movementComponents).toContain(walkComponent);
        expect(movementComponents.every(c => c.category === 'movement')).toBe(true);
      });
      
      it('should return empty array for invalid category', () => {
        const components = getComponentsByCategory('invalid' as any);
        expect(components).toEqual([]);
      });
    });
    
    describe('getCategories', () => {
      it('should return all categories', () => {
        const categories = getCategories();
        expect(categories).toContain('movement');
        expect(categories).toContain('combat');
        expect(categories).toContain('ui');
        expect(categories).toContain('world');
      });
    });
  });
});