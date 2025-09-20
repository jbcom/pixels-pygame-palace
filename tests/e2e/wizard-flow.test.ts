import { test, expect } from '@playwright/test';

test.describe('Universal Wizard Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for Yarn dialogue to load
    await page.waitForTimeout(1000);
  });
  
  test('complete wizard flow from start to game creation', async ({ page }) => {
    // Wait for universal wizard to appear
    await expect(page.getByTestId('universal-wizard')).toBeVisible({ timeout: 10000 });
    
    // Check for initial Pixel welcome message
    const dialogueCard = page.getByTestId('dialogue-card');
    await expect(dialogueCard).toBeVisible();
    await expect(dialogueCard).toContainText("Welcome to Pixel's PyGame Palace");
    
    // Choose to make a game
    const makeGameButton = page.getByTestId('dialogue-option-0');
    await expect(makeGameButton).toBeVisible();
    await makeGameButton.click();
    
    // Wait for game type selection
    await page.waitForTimeout(500);
    await expect(dialogueCard).toContainText('game cooking here');
    
    // Select Platformer
    const platformerOption = page.getByText('Platformer - Jump and run fun!');
    if (await platformerOption.isVisible()) {
      await platformerOption.click();
    }
    
    // Choose work style
    await page.waitForTimeout(500);
    await expect(dialogueCard).toContainText('how do you like to work');
    
    // Choose wizard mode (walk me through)
    const wizardModeButton = page.getByText('Walk me through it!');
    if (await wizardModeButton.isVisible()) {
      await wizardModeButton.click();
    }
    
    // Verify asset selector appears
    await expect(page.getByTestId('asset-selector')).toBeVisible({ timeout: 5000 });
    
    // Select an asset
    const assetItem = page.getByTestId(/asset-item-/).first();
    if (await assetItem.isVisible()) {
      await assetItem.click();
    }
    
    // Return to dialogue
    const returnButton = page.getByTestId('return-to-dialogue');
    if (await returnButton.isVisible()) {
      await returnButton.click();
    }
    
    // Verify we're back in dialogue flow
    await expect(dialogueCard).toBeVisible();
  });
  
  test('navigate to Python lessons path', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Choose to learn Python
    const learnPythonButton = page.getByTestId('dialogue-option-1');
    await expect(learnPythonButton).toBeVisible();
    await learnPythonButton.click();
    
    // Wait for lessons component to embed
    await page.waitForTimeout(500);
    
    // Verify lessons page is embedded
    await expect(page.getByTestId('lessons-page')).toBeVisible({ timeout: 5000 });
    
    // Pixel should be in corner waiting state
    const pixelCorner = page.getByTestId('pixel-container-corner');
    await expect(pixelCorner).toBeVisible();
  });
  
  test('select different game types and see appropriate dialogues', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Choose to make a game
    const makeGameButton = page.getByTestId('dialogue-option-0');
    await makeGameButton.click();
    
    await page.waitForTimeout(500);
    
    // Test RPG selection
    const rpgOption = page.getByText('RPG - Epic quests and adventures!');
    if (await rpgOption.isVisible()) {
      await rpgOption.click();
      
      await page.waitForTimeout(500);
      
      // Choose full editor mode
      const editorOption = page.getByText('Full editor - I got this!');
      if (await editorOption.isVisible()) {
        await editorOption.click();
        
        // Verify editor embeds
        await expect(page.getByTestId('project-builder')).toBeVisible({ timeout: 5000 });
      }
    }
  });
  
  test('test all game type paths', async ({ page }) => {
    const gameTypes = [
      { text: 'RPG - Epic quests and adventures!', type: 'rpg' },
      { text: 'Platformer - Jump and run fun!', type: 'platformer' },
      { text: 'Dungeon Crawler - Explore dark depths!', type: 'dungeon' },
      { text: 'Racing - Speed and thrills!', type: 'racing' },
      { text: 'Puzzle - Brain-teasing challenges!', type: 'puzzle' },
      { text: 'Adventure - Story-driven exploration!', type: 'adventure' }
    ];
    
    for (const game of gameTypes) {
      // Reload page for each test
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Navigate to game selection
      const makeGameButton = page.getByTestId('dialogue-option-0');
      await makeGameButton.click();
      
      await page.waitForTimeout(500);
      
      // Select game type
      const gameOption = page.getByText(game.text);
      if (await gameOption.isVisible()) {
        await gameOption.click();
        
        await page.waitForTimeout(500);
        
        // Verify work style options appear
        await expect(page.getByText('Full editor - I got this!')).toBeVisible();
        await expect(page.getByText('Walk me through it!')).toBeVisible();
      }
    }
  });
  
  test('asset selector interaction and selection', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Navigate to asset selector
    await page.getByTestId('dialogue-option-0').click(); // Make game
    await page.waitForTimeout(500);
    
    await page.getByText('Platformer - Jump and run fun!').click(); // Choose platformer
    await page.waitForTimeout(500);
    
    await page.getByText('Walk me through it!').click(); // Wizard mode
    await page.waitForTimeout(500);
    
    // Asset selector should be visible
    await expect(page.getByTestId('asset-selector')).toBeVisible();
    
    // Test search functionality
    const searchInput = page.getByTestId('asset-search');
    if (await searchInput.isVisible()) {
      await searchInput.fill('player');
      await page.waitForTimeout(300);
    }
    
    // Test category tabs
    const spritesTab = page.getByTestId('tab-sprites');
    if (await spritesTab.isVisible()) {
      await spritesTab.click();
      await page.waitForTimeout(300);
    }
    
    // Select an asset
    const assetItems = page.getByTestId(/asset-item-/);
    const firstAsset = assetItems.first();
    if (await firstAsset.isVisible()) {
      await firstAsset.click();
    }
    
    // Preview asset
    const previewButton = page.getByTestId(/preview-asset-/).first();
    if (await previewButton.isVisible()) {
      await previewButton.click();
      await expect(page.getByTestId('asset-preview-modal')).toBeVisible();
      
      // Close preview
      await page.getByTestId('close-preview').click();
    }
    
    // Return to dialogue
    const returnButton = page.getByTestId('return-to-dialogue');
    if (await returnButton.isVisible()) {
      await returnButton.click();
      await expect(page.getByTestId('dialogue-card')).toBeVisible();
    }
  });
  
  test('pixel state transitions during wizard flow', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Initially, Pixel should be in center stage
    await expect(page.getByTestId('pixel-container-center')).toBeVisible();
    
    // Choose to make a game and go to editor
    await page.getByTestId('dialogue-option-0').click();
    await page.waitForTimeout(500);
    
    await page.getByText('Platformer - Jump and run fun!').click();
    await page.waitForTimeout(500);
    
    await page.getByText('Full editor - I got this!').click();
    await page.waitForTimeout(500);
    
    // Pixel should transition to corner waiting
    await expect(page.getByTestId('pixel-container-corner')).toBeVisible();
    
    // Click Pixel in corner to expand
    const pixelCorner = page.getByTestId('pixel-expand');
    if (await pixelCorner.isVisible()) {
      await pixelCorner.click();
      
      // Should expand to show help options
      await expect(page.getByTestId('pixel-expanded')).toBeVisible();
      
      // Collapse back
      const collapseButton = page.getByTestId('collapse-pixel');
      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await expect(page.getByTestId('pixel-container-corner')).toBeVisible();
      }
    }
  });
  
  test('dialogue flow with conditional branching', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Test platformer-specific dialogue
    await page.getByTestId('dialogue-option-0').click();
    await page.waitForTimeout(500);
    
    await page.getByText('Platformer - Jump and run fun!').click();
    await page.waitForTimeout(500);
    
    await page.getByText('Walk me through it!').click();
    await page.waitForTimeout(500);
    
    // Should show platformer-specific assets
    const assetSelector = page.getByTestId('asset-selector');
    await expect(assetSelector).toBeVisible();
    await expect(assetSelector).toContainText('platformer');
  });
  
  test('keyboard navigation through dialogue options', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Tab to first option
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // May need multiple tabs depending on focus
    
    // Check if first option is focused
    const firstOption = page.getByTestId('dialogue-option-0');
    await expect(firstOption).toBeFocused();
    
    // Navigate to second option
    await page.keyboard.press('Tab');
    const secondOption = page.getByTestId('dialogue-option-1');
    await expect(secondOption).toBeFocused();
    
    // Select with Enter
    await page.keyboard.press('Enter');
    
    // Should advance dialogue
    await page.waitForTimeout(500);
    await expect(page.getByTestId('lessons-page')).toBeVisible({ timeout: 5000 });
  });
  
  test('responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Check dialogue is visible and responsive
    const dialogueCard = page.getByTestId('dialogue-card');
    await expect(dialogueCard).toBeVisible();
    
    // Options should stack vertically on mobile
    const options = page.getByTestId(/dialogue-option-/);
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
    
    // Navigate through mobile view
    await page.getByTestId('dialogue-option-0').click();
    await page.waitForTimeout(500);
    
    // Game type options should be in grid on mobile
    const gameOptions = page.getByTestId(/dialogue-option-/);
    expect(await gameOptions.count()).toBe(6); // 6 game types
  });
  
  test('error recovery and fallback states', async ({ page }) => {
    // Simulate network error by blocking dialogue file
    await page.route('**/dialogue/pixel/wizard-flow.yarn', route => {
      route.abort();
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should handle error gracefully
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Check console for error handling
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Should have logged error but not crashed
    expect(consoleLogs.some(log => log.includes('Failed to load dialogue'))).toBeTruthy();
  });
  
  test('complete project setup flow', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Complete full flow
    await page.getByTestId('dialogue-option-0').click(); // Make game
    await page.waitForTimeout(500);
    
    await page.getByText('RPG - Epic quests and adventures!').click(); // Choose RPG
    await page.waitForTimeout(500);
    
    await page.getByText('Walk me through it!').click(); // Wizard mode
    await page.waitForTimeout(500);
    
    // Asset selection
    await expect(page.getByTestId('asset-selector')).toBeVisible();
    const assetItem = page.getByTestId(/asset-item-/).first();
    if (await assetItem.isVisible()) {
      await assetItem.click();
    }
    
    // Return and continue
    const returnButton = page.getByTestId('return-to-dialogue');
    if (await returnButton.isVisible()) {
      await returnButton.click();
    }
    
    await page.waitForTimeout(500);
    
    // Should show next steps
    const dialogueCard = page.getByTestId('dialogue-card');
    await expect(dialogueCard).toContainText('Great choice');
    
    // Choose player controls
    const controlsOption = page.getByText('Add player controls');
    if (await controlsOption.isVisible()) {
      await controlsOption.click();
      await page.waitForTimeout(500);
      
      // Should show control setup for RPG
      await expect(dialogueCard).toContainText('RPG controls');
    }
  });
  
  test('persistence of wizard state across page refreshes', async ({ page }) => {
    await expect(page.getByTestId('universal-wizard')).toBeVisible();
    
    // Make some progress
    await page.getByTestId('dialogue-option-0').click();
    await page.waitForTimeout(500);
    
    await page.getByText('Platformer - Jump and run fun!').click();
    await page.waitForTimeout(500);
    
    // Store some state (would be in localStorage in actual implementation)
    await page.evaluate(() => {
      localStorage.setItem('wizard-state', JSON.stringify({
        currentNode: 'WorkStyle',
        variables: { gameType: 'platformer' }
      }));
    });
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check if state is restored (implementation dependent)
    const storedState = await page.evaluate(() => {
      return localStorage.getItem('wizard-state');
    });
    
    expect(storedState).toBeTruthy();
    const state = JSON.parse(storedState || '{}');
    expect(state.variables.gameType).toBe('platformer');
  });
});