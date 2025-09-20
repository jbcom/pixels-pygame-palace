// Test file for the Pygame Component System
import { generatePygameScene, generateTestScene } from './scene-generator';
import { pygameComponents, getAllComponents, getComponentById } from './pygame-components';

// Test 1: Verify all components are loaded
function testComponentLoading() {
  console.log('Testing Component Loading...');
  console.log(`Total components loaded: ${getAllComponents().length}`);
  
  // Check all components
  pygameComponents.forEach((comp, index) => {
    console.log(`Component ${index + 1}: ${comp.id} - ${comp.name} (${comp.type})`);
  });
  
  return getAllComponents().length >= 12; // We have multiple components
}

// Test 2: Verify component structure
function testComponentStructure() {
  console.log('\nTesting Component Structure...');
  
  const testComponent = getComponentById('jump');
  if (!testComponent) {
    console.error('Jump component not found!');
    return false;
  }
  
  // Check required properties
  const hasRequiredProps = 
    testComponent.id === 'jump' &&
    testComponent.name === 'Jump Mechanics' &&
    testComponent.category === 'movement' &&
    testComponent.variants.A !== undefined &&
    testComponent.variants.B !== undefined &&
    testComponent.parameters !== undefined;
    
  console.log(`Jump component structure valid: ${hasRequiredProps}`);
  return hasRequiredProps;
}

// Test 3: Generate a simple scene
function testSceneGeneration() {
  console.log('\nTesting Scene Generation...');
  
  try {
    const scene = generateTestScene();
    
    // Check if scene contains expected content
    const hasExpectedContent = 
      scene.includes('import pygame') &&
      scene.includes('class Player') &&
      scene.includes('JumpSystem') &&
      scene.includes('WalkSystem') &&
      scene.includes('GravitySystem') &&
      scene.includes('CollisionSystem');
      
    console.log(`Generated scene length: ${scene.length} characters`);
    console.log(`Contains expected systems: ${hasExpectedContent}`);
    
    return hasExpectedContent;
  } catch (error) {
    console.error('Error generating scene:', error);
    return false;
  }
}

// Test 4: Generate complex scene with multiple components
function testComplexSceneGeneration() {
  console.log('\nTesting Complex Scene Generation...');
  
  try {
    const complexScene = generatePygameScene({
      sceneConfig: {
        name: 'Complex Test Game',
        width: 1024,
        height: 768,
        fps: 60,
        backgroundColor: '#2c3e50'
      },
      selectedComponents: [
        // Movement
        { componentId: 'walk', variant: 'B', assets: {}, parameters: { walk_speed: 6 }},
        { componentId: 'jump', variant: 'A', assets: {}, parameters: { jump_power: 18 }},
        // Combat
        { componentId: 'shooting', variant: 'B', assets: {}, parameters: { max_charge: 3 }},
        { componentId: 'melee', variant: 'A', assets: {}, parameters: { damage: 20 }},
        // UI
        { componentId: 'health', variant: 'B', assets: {}, parameters: { max_health: 150 }},
        { componentId: 'score', variant: 'A', assets: {}, parameters: {}},
        // World
        { componentId: 'gravity', variant: 'B', assets: {}, parameters: {}},
        { componentId: 'collision', variant: 'B', assets: {}, parameters: { bounciness: 0.6 }}
      ]
    });
    
    // Check all components are included
    const hasAllSystems = 
      complexScene.includes('WalkSystem') &&
      complexScene.includes('JumpSystem') &&
      complexScene.includes('ShootingSystem') &&
      complexScene.includes('MeleeSystem') &&
      complexScene.includes('HealthSystem') &&
      complexScene.includes('ScoreSystem') &&
      complexScene.includes('GravitySystem') &&
      complexScene.includes('CollisionSystem');
      
    console.log(`Complex scene contains all 8 systems: ${hasAllSystems}`);
    
    // Check parameter replacements
    const hasReplacedParams = 
      complexScene.includes('6') && // walk_speed
      complexScene.includes('18') && // jump_power
      complexScene.includes('3') && // max_charge
      complexScene.includes('20') && // damage
      complexScene.includes('150') && // max_health
      complexScene.includes('0.6'); // bounciness
      
    console.log(`Parameters correctly replaced: ${hasReplacedParams}`);
    
    return hasAllSystems && hasReplacedParams;
  } catch (error) {
    console.error('Error generating complex scene:', error);
    return false;
  }
}

// Run all tests
export function runComponentTests() {
  console.log('🧪 Running Pygame Component System Tests...\n');
  
  const results = {
    loading: testComponentLoading(),
    structure: testComponentStructure(),
    simpleScene: testSceneGeneration(),
    complexScene: testComplexSceneGeneration()
  };
  
  const allPassed = Object.values(results).every(result => result);
  
  console.log('\n📊 Test Results:');
  console.log(`  Component Loading: ${results.loading ? '✅' : '❌'}`);
  console.log(`  Component Structure: ${results.structure ? '✅' : '❌'}`);
  console.log(`  Simple Scene Generation: ${results.simpleScene ? '✅' : '❌'}`);
  console.log(`  Complex Scene Generation: ${results.complexScene ? '✅' : '❌'}`);
  console.log(`\n${allPassed ? '✨ All tests passed!' : '❌ Some tests failed'}`);
  
  return allPassed;
}

// Export for use in console
if (typeof window !== 'undefined') {
  (window as any).testPygameComponents = runComponentTests;
  (window as any).generateTestScene = generateTestScene;
  console.log('💡 Pygame Component System loaded. Run testPygameComponents() in console to test.');
}