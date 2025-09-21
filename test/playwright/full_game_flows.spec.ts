import { test, expect, Page, Locator } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Comprehensive Playwright tests for validating complete game creation flows
 * Tests each game type from start to finish with visual regression and API integration
 */

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_BASE_URL = `${BASE_URL}/api`;
const SCREENSHOT_DIR = 'test-results/screenshots';
const TEST_TIMEOUT = 60000; // 60 seconds per test

// Helper class for game flow testing
class GameFlowHelper {
  constructor(private page: Page) {}

  async waitForPixel(): Promise<void> {
    await this.page.waitForSelector('[data-testid="pixel-character"]', { timeout: 10000 });
  }

  async clickDialogueOption(optionText: string): Promise<void> {
    const option = this.page.locator(`[data-testid="dialogue-option"]`).filter({ hasText: optionText });
    await option.waitFor({ state: 'visible' });
    await option.click();
  }

  async clickContinue(): Promise<void> {
    const continueBtn = this.page.locator('[data-testid="continue-button"]');
    await continueBtn.waitFor({ state: 'visible' });
    await continueBtn.click();
  }

  async selectGameType(gameType: string): Promise<void> {
    const gameOption = this.page.locator(`[data-testid="game-type-${gameType}"]`);
    await gameOption.waitFor({ state: 'visible' });
    await gameOption.click();
  }

  async selectAsset(assetType: string, assetName: string): Promise<void> {
    const assetSelector = this.page.locator(`[data-testid="asset-${assetType}-${assetName}"]`);
    await assetSelector.waitFor({ state: 'visible' });
    await assetSelector.click();
  }

  async configureComponent(componentType: string, config: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      const input = this.page.locator(`[data-testid="${componentType}-${key}"]`);
      if (await input.isVisible()) {
        if (typeof value === 'string') {
          await input.fill(value);
        } else if (typeof value === 'boolean') {
          if (value) await input.check();
        } else if (typeof value === 'number') {
          await input.fill(value.toString());
        }
      }
    }
  }

  async waitForCompilation(): Promise<void> {
    await this.page.waitForSelector('[data-testid="compilation-status-success"]', { timeout: 30000 });
  }

  async runGame(): Promise<void> {
    const runButton = this.page.locator('[data-testid="run-game-button"]');
    await runButton.click();
    await this.page.waitForSelector('[data-testid="game-canvas"]', { timeout: 10000 });
  }

  async stopGame(): Promise<void> {
    const stopButton = this.page.locator('[data-testid="stop-game-button"]');
    if (await stopButton.isVisible()) {
      await stopButton.click();
    }
  }

  async exportGame(): Promise<string> {
    const exportButton = this.page.locator('[data-testid="export-game-button"]');
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      exportButton.click()
    ]);
    
    const path = await download.path();
    return path || '';
  }

  async saveProject(projectName: string): Promise<void> {
    const saveButton = this.page.locator('[data-testid="save-project-button"]');
    await saveButton.click();
    
    const nameInput = this.page.locator('[data-testid="project-name-input"]');
    await nameInput.fill(projectName);
    
    const confirmButton = this.page.locator('[data-testid="save-confirm-button"]');
    await confirmButton.click();
    
    await this.page.waitForSelector('[data-testid="save-success-message"]', { timeout: 5000 });
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, `${name}.png`),
      fullPage: true 
    });
  }

  async checkAPIHealth(): Promise<boolean> {
    const response = await this.page.request.get(`${API_BASE_URL}/health`);
    return response.ok();
  }

  async validateGameCode(code: string): boolean {
    // Basic validation of generated Python code
    const requiredElements = [
      'import pygame',
      'pygame.init()',
      'screen = pygame.display.set_mode',
      'clock = pygame.time.Clock()',
      'running = True',
      'while running:',
      'pygame.quit()'
    ];
    
    return requiredElements.every(element => code.includes(element));
  }
}

// Load test configurations
function loadTestConfig(gameType: string): any {
  const configPath = path.join(__dirname, '..', 'e2e', 'test_configs', `${gameType}_test_config.json`);
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return null;
}

// Test suite for each game type
test.describe('Full Game Flow Tests', () => {
  let helper: GameFlowHelper;

  test.beforeEach(async ({ page }) => {
    helper = new GameFlowHelper(page);
    
    // Navigate to the application
    await page.goto(BASE_URL);
    
    // Wait for the wizard to load
    await helper.waitForPixel();
    
    // Take initial screenshot
    await helper.takeScreenshot('initial-load');
  });

  test.afterEach(async ({ page }) => {
    // Clean up any running games
    await helper.stopGame();
  });

  test('Platformer Game - Complete Flow', async ({ page }) => {
    const config = loadTestConfig('platformer');
    expect(config).toBeTruthy();

    // Start the flow
    await helper.clickDialogueOption("Let's make something amazing!");
    
    // Select game type
    await helper.selectGameType('platformer');
    await helper.takeScreenshot('platformer-type-selected');
    
    // Configure title screen
    await helper.clickContinue();
    await helper.configureComponent('title-screen', {
      title: config.stages.title_screen.title,
      font: config.stages.title_screen.font
    });
    await helper.takeScreenshot('platformer-title-configured');
    
    // Configure player
    await helper.clickContinue();
    await helper.selectAsset('sprite', 'player_blue');
    await helper.configureComponent('player', {
      speed: config.stages.gameplay.player.speed,
      jump_height: config.stages.gameplay.player.jump_height
    });
    await helper.takeScreenshot('platformer-player-configured');
    
    // Configure platforms
    await helper.clickContinue();
    await helper.selectAsset('tiles', 'ground_grass');
    await helper.selectAsset('tiles', 'platform_wood');
    
    // Add enemies
    await helper.clickContinue();
    await helper.selectAsset('enemy', 'slime');
    await helper.selectAsset('enemy', 'bat');
    await helper.takeScreenshot('platformer-enemies-added');
    
    // Configure ending
    await helper.clickContinue();
    await helper.configureComponent('ending-screen', {
      win_message: config.stages.ending_screen.win_message,
      lose_message: config.stages.ending_screen.lose_message
    });
    
    // Compile the game
    await helper.clickDialogueOption('Compile Game');
    await helper.waitForCompilation();
    await helper.takeScreenshot('platformer-compiled');
    
    // Test the game
    await helper.runGame();
    await page.waitForTimeout(3000); // Let the game run for a bit
    await helper.takeScreenshot('platformer-running');
    await helper.stopGame();
    
    // Save the project
    await helper.saveProject('Test Platformer Game');
    await helper.takeScreenshot('platformer-saved');
    
    // Export the game
    const exportPath = await helper.exportGame();
    expect(exportPath).toBeTruthy();
  });

  test('RPG Game - Complete Flow', async ({ page }) => {
    const config = loadTestConfig('rpg');
    expect(config).toBeTruthy();

    await helper.clickDialogueOption("Let's make something amazing!");
    await helper.selectGameType('rpg');
    await helper.takeScreenshot('rpg-type-selected');
    
    // Title screen
    await helper.clickContinue();
    await helper.configureComponent('title-screen', {
      title: config.stages.title_screen.title,
      font: config.stages.title_screen.font
    });
    
    // Character setup
    await helper.clickContinue();
    await helper.selectAsset('sprite', 'hero_knight');
    await helper.configureComponent('player', {
      health: config.stages.gameplay.player.health,
      mana: config.stages.gameplay.player.mana
    });
    await helper.takeScreenshot('rpg-character-configured');
    
    // Inventory system
    await helper.clickContinue();
    await helper.configureComponent('inventory', {
      slots: config.stages.gameplay.inventory.slots
    });
    
    // Dialogue system
    await helper.clickContinue();
    await helper.clickDialogueOption('Branching Dialogue');
    
    // NPCs
    await helper.clickContinue();
    await helper.selectAsset('npc', 'elder');
    await helper.selectAsset('npc', 'merchant');
    await helper.takeScreenshot('rpg-npcs-added');
    
    // Combat system
    await helper.clickContinue();
    await helper.clickDialogueOption('Turn-Based Combat');
    
    // Compile and test
    await helper.clickDialogueOption('Compile Game');
    await helper.waitForCompilation();
    await helper.takeScreenshot('rpg-compiled');
    
    await helper.saveProject('Test RPG Game');
  });

  test('Puzzle Game - Complete Flow', async ({ page }) => {
    const config = loadTestConfig('puzzle');
    expect(config).toBeTruthy();

    await helper.clickDialogueOption("Let's make something amazing!");
    await helper.selectGameType('puzzle');
    await helper.takeScreenshot('puzzle-type-selected');
    
    // Title screen
    await helper.clickContinue();
    await helper.configureComponent('title-screen', {
      title: config.stages.title_screen.title
    });
    
    // Grid configuration
    await helper.clickContinue();
    await helper.configureComponent('grid', {
      rows: config.stages.gameplay.grid.rows,
      cols: config.stages.gameplay.grid.cols
    });
    await helper.takeScreenshot('puzzle-grid-configured');
    
    // Piece selection
    await helper.clickContinue();
    await helper.selectAsset('pieces', 'gems');
    
    // Game mechanics
    await helper.clickContinue();
    await helper.clickDialogueOption('Match 3');
    
    // Scoring system
    await helper.clickContinue();
    await helper.configureComponent('scoring', {
      base_points: config.stages.gameplay.scoring.base_points
    });
    
    // Compile
    await helper.clickDialogueOption('Compile Game');
    await helper.waitForCompilation();
    await helper.takeScreenshot('puzzle-compiled');
    
    await helper.saveProject('Test Puzzle Game');
  });

  test('Racing Game - Complete Flow', async ({ page }) => {
    const config = loadTestConfig('racing');
    expect(config).toBeTruthy();

    await helper.clickDialogueOption("Let's make something amazing!");
    await helper.selectGameType('racing');
    await helper.takeScreenshot('racing-type-selected');
    
    // Title screen
    await helper.clickContinue();
    await helper.configureComponent('title-screen', {
      title: config.stages.title_screen.title
    });
    
    // Vehicle selection
    await helper.clickContinue();
    await helper.selectAsset('vehicle', 'sports_car_red');
    await helper.configureComponent('vehicle', {
      speed: config.stages.gameplay.vehicle.speed,
      acceleration: config.stages.gameplay.vehicle.acceleration
    });
    await helper.takeScreenshot('racing-vehicle-configured');
    
    // Track configuration
    await helper.clickContinue();
    await helper.configureComponent('track', {
      laps: config.stages.gameplay.track.laps
    });
    
    // AI opponents
    await helper.clickContinue();
    await helper.selectAsset('opponent', 'sports_car_blue');
    await helper.selectAsset('opponent', 'sedan_green');
    
    // Power-ups
    await helper.clickContinue();
    await helper.selectAsset('powerup', 'nitro');
    await helper.selectAsset('powerup', 'shield');
    
    // Compile
    await helper.clickDialogueOption('Compile Game');
    await helper.waitForCompilation();
    await helper.takeScreenshot('racing-compiled');
    
    await helper.saveProject('Test Racing Game');
  });

  test('Space Shooter - Complete Flow', async ({ page }) => {
    const config = loadTestConfig('space');
    expect(config).toBeTruthy();

    await helper.clickDialogueOption("Let's make something amazing!");
    await helper.selectGameType('space');
    await helper.takeScreenshot('space-type-selected');
    
    // Title screen
    await helper.clickContinue();
    await helper.configureComponent('title-screen', {
      title: config.stages.title_screen.title
    });
    
    // Spaceship selection
    await helper.clickContinue();
    await helper.selectAsset('spaceship', 'fighter_x1');
    await helper.configureComponent('spaceship', {
      health: config.stages.gameplay.spaceship.health,
      shields: config.stages.gameplay.spaceship.shields
    });
    await helper.takeScreenshot('space-ship-configured');
    
    // Weapons
    await helper.clickContinue();
    await helper.selectAsset('weapon', 'laser');
    await helper.selectAsset('weapon', 'missiles');
    
    // Enemies
    await helper.clickContinue();
    await helper.selectAsset('enemy', 'scout');
    await helper.selectAsset('enemy', 'fighter');
    await helper.selectAsset('enemy', 'bomber');
    
    // Asteroids and power-ups
    await helper.clickContinue();
    await helper.selectAsset('powerup', 'rapid_fire');
    await helper.selectAsset('powerup', 'shield_boost');
    
    // Compile
    await helper.clickDialogueOption('Compile Game');
    await helper.waitForCompilation();
    await helper.takeScreenshot('space-compiled');
    
    await helper.saveProject('Test Space Game');
  });

  test('Dungeon Crawler - Complete Flow', async ({ page }) => {
    const config = loadTestConfig('dungeon');
    expect(config).toBeTruthy();

    await helper.clickDialogueOption("Let's make something amazing!");
    await helper.selectGameType('dungeon');
    await helper.takeScreenshot('dungeon-type-selected');
    
    // Title screen
    await helper.clickContinue();
    await helper.configureComponent('title-screen', {
      title: config.stages.title_screen.title
    });
    
    // Character class
    await helper.clickContinue();
    await helper.clickDialogueOption('Warrior');
    await helper.configureComponent('player', {
      health: config.stages.gameplay.player.health,
      attack: config.stages.gameplay.player.attack
    });
    await helper.takeScreenshot('dungeon-character-configured');
    
    // Dungeon generation
    await helper.clickContinue();
    await helper.clickDialogueOption('Procedural Generation');
    await helper.configureComponent('dungeon', {
      floors: config.stages.gameplay.dungeon_layout.floors
    });
    
    // Enemies
    await helper.clickContinue();
    await helper.selectAsset('enemy', 'skeleton');
    await helper.selectAsset('enemy', 'orc');
    
    // Loot system
    await helper.clickContinue();
    await helper.clickDialogueOption('Rarity-Based Loot');
    
    // Traps
    await helper.clickContinue();
    await helper.selectAsset('trap', 'spike_pit');
    await helper.selectAsset('trap', 'arrow_trap');
    
    // Compile
    await helper.clickDialogueOption('Compile Game');
    await helper.waitForCompilation();
    await helper.takeScreenshot('dungeon-compiled');
    
    await helper.saveProject('Test Dungeon Game');
  });
});

// Visual regression tests
test.describe('Visual Regression Tests', () => {
  test('UI Components Visual Test', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Test various UI states
    const components = [
      { selector: '[data-testid="pixel-character"]', name: 'pixel-character' },
      { selector: '[data-testid="dialogue-box"]', name: 'dialogue-box' },
      { selector: '[data-testid="option-buttons"]', name: 'option-buttons' },
      { selector: '[data-testid="asset-browser"]', name: 'asset-browser' },
      { selector: '[data-testid="code-editor"]', name: 'code-editor' },
      { selector: '[data-testid="game-preview"]', name: 'game-preview' }
    ];
    
    for (const component of components) {
      const element = page.locator(component.selector);
      if (await element.isVisible()) {
        await element.screenshot({ 
          path: path.join(SCREENSHOT_DIR, 'visual', `${component.name}.png`) 
        });
      }
    }
  });
  
  test('Responsive Design Test', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(BASE_URL);
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'responsive', `${viewport.name}.png`),
        fullPage: true 
      });
    }
  });
});

// API Integration Tests
test.describe('API Integration Tests', () => {
  let helper: GameFlowHelper;

  test.beforeEach(async ({ page }) => {
    helper = new GameFlowHelper(page);
  });

  test('Backend Health Check', async ({ page }) => {
    const isHealthy = await helper.checkAPIHealth();
    expect(isHealthy).toBeTruthy();
  });

  test('Game Compilation API', async ({ page }) => {
    const response = await page.request.post(`${API_BASE_URL}/compile`, {
      data: {
        components: [
          { type: 'title_screen', config: { title: 'Test Game' } },
          { type: 'player', config: { speed: 5 } }
        ],
        gameType: 'platformer'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.code).toBeTruthy();
    expect(helper.validateGameCode(data.code)).toBeTruthy();
  });

  test('Project Save/Load API', async ({ page }) => {
    // Save a project
    const saveResponse = await page.request.post(`${API_BASE_URL}/projects`, {
      data: {
        name: 'API Test Project',
        components: [{ type: 'test' }],
        gameType: 'platformer'
      }
    });
    
    expect(saveResponse.ok()).toBeTruthy();
    const saveData = await saveResponse.json();
    expect(saveData.success).toBeTruthy();
    const projectId = saveData.project.id;
    
    // Load the project
    const loadResponse = await page.request.get(`${API_BASE_URL}/projects/${projectId}`);
    expect(loadResponse.ok()).toBeTruthy();
    const loadData = await loadResponse.json();
    expect(loadData.success).toBeTruthy();
    expect(loadData.project.name).toBe('API Test Project');
  });

  test('Game Execution API', async ({ page }) => {
    const simpleCode = `
import pygame
pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.quit()
`;
    
    const response = await page.request.post(`${API_BASE_URL}/execute`, {
      data: { code: simpleCode }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.session_id).toBeTruthy();
    
    // Clean up the session
    if (data.session_id) {
      await page.request.post(`${API_BASE_URL}/stop/${data.session_id}`);
    }
  });
});

// Performance Tests
test.describe('Performance Tests', () => {
  test('Page Load Performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForSelector('[data-testid="pixel-character"]');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });

  test('Compilation Performance', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const startTime = Date.now();
    const response = await page.request.post(`${API_BASE_URL}/compile`, {
      data: {
        components: Array(10).fill({ type: 'test_component', config: {} }),
        gameType: 'platformer'
      }
    });
    const compilationTime = Date.now() - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(compilationTime).toBeLessThan(2000); // Should compile within 2 seconds
  });
});

// Export test utilities for use in other test files
export { GameFlowHelper, loadTestConfig };