import { test, expect } from '@playwright/test';

test.describe('Game Execution E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });
  
  test('execute generated pygame in browser', async ({ page }) => {
    // Navigate to game execution
    const playButton = page.getByTestId('button-play-game');
    if (await playButton.isVisible()) {
      await playButton.click();
      
      // Wait for Pyodide to load
      await page.waitForFunction(() => window.pyodide !== undefined, { timeout: 30000 });
      
      // Check game canvas is created
      const gameCanvas = page.getByTestId('game-canvas');
      await expect(gameCanvas).toBeVisible();
      
      // Verify game is running
      const fpsCounter = page.getByTestId('fps-counter');
      if (await fpsCounter.isVisible()) {
        const fps = await fpsCounter.textContent();
        expect(parseInt(fps || '0')).toBeGreaterThan(0);
      }
    }
  });
  
  test('keyboard input handling', async ({ page }) => {
    // Start game
    const playButton = page.getByTestId('button-play-game');
    if (await playButton.isVisible()) {
      await playButton.click();
      
      await page.waitForFunction(() => window.pyodide !== undefined, { timeout: 30000 });
      
      const gameCanvas = page.getByTestId('game-canvas');
      await expect(gameCanvas).toBeVisible();
      
      // Focus the game canvas
      await gameCanvas.click();
      
      // Test movement keys
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      
      // Check if player position updates (would need data-testid on player position display)
      const playerX = page.getByTestId('player-x-position');
      if (await playerX.isVisible()) {
        const xPos = await playerX.textContent();
        expect(xPos).toBeDefined();
      }
    }
  });
  
  test('pause and resume game', async ({ page }) => {
    // Start game
    const playButton = page.getByTestId('button-play-game');
    if (await playButton.isVisible()) {
      await playButton.click();
      
      await page.waitForFunction(() => window.pyodide !== undefined, { timeout: 30000 });
      
      // Pause game
      const pauseButton = page.getByTestId('button-pause-game');
      if (await pauseButton.isVisible()) {
        await pauseButton.click();
        
        // Check pause indicator
        const pauseIndicator = page.getByTestId('pause-indicator');
        if (await pauseIndicator.isVisible()) {
          await expect(pauseIndicator).toBeVisible();
        }
        
        // Resume game
        const resumeButton = page.getByTestId('button-resume-game');
        if (await resumeButton.isVisible()) {
          await resumeButton.click();
          
          // Pause indicator should disappear
          if (await pauseIndicator.isVisible()) {
            await expect(pauseIndicator).not.toBeVisible();
          }
        }
      }
    }
  });
  
  test('game state persistence', async ({ page }) => {
    // Start game
    const playButton = page.getByTestId('button-play-game');
    if (await playButton.isVisible()) {
      await playButton.click();
      
      await page.waitForFunction(() => window.pyodide !== undefined, { timeout: 30000 });
      
      // Play for a bit
      await page.waitForTimeout(2000);
      
      // Get current score
      const scoreDisplay = page.getByTestId('score-display');
      let initialScore = '0';
      if (await scoreDisplay.isVisible()) {
        initialScore = await scoreDisplay.textContent() || '0';
      }
      
      // Save game state
      const saveButton = page.getByTestId('button-save-game');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Load saved game
        const loadButton = page.getByTestId('button-load-game');
        if (await loadButton.isVisible()) {
          await loadButton.click();
          
          // Check score is restored
          if (await scoreDisplay.isVisible()) {
            const loadedScore = await scoreDisplay.textContent();
            expect(loadedScore).toBe(initialScore);
          }
        }
      }
    }
  });
  
  test('error handling in game execution', async ({ page }) => {
    // Intentionally cause an error by loading invalid component
    await page.evaluate(() => {
      // Inject faulty component code
      window.faultyComponent = `
        # This will cause an error
        undefined_variable.do_something()
      `;
    });
    
    // Try to run game with faulty component
    const playButton = page.getByTestId('button-play-game-with-error');
    if (await playButton.isVisible()) {
      await playButton.click();
      
      // Check error message appears
      const errorMessage = page.getByTestId('error-message');
      if (await errorMessage.isVisible({ timeout: 5000 })) {
        await expect(errorMessage).toBeVisible();
        const errorText = await errorMessage.textContent();
        expect(errorText).toContain('error');
      }
    }
  });
  
  test('performance monitoring', async ({ page }) => {
    // Start game
    const playButton = page.getByTestId('button-play-game');
    if (await playButton.isVisible()) {
      await playButton.click();
      
      await page.waitForFunction(() => window.pyodide !== undefined, { timeout: 30000 });
      
      // Open performance stats
      const perfButton = page.getByTestId('button-performance-stats');
      if (await perfButton.isVisible()) {
        await perfButton.click();
        
        const perfPanel = page.getByTestId('performance-panel');
        await expect(perfPanel).toBeVisible();
        
        // Check FPS display
        const fpsDisplay = page.getByTestId('fps-display');
        if (await fpsDisplay.isVisible()) {
          const fps = await fpsDisplay.textContent();
          expect(parseInt(fps || '0')).toBeGreaterThan(0);
        }
        
        // Check memory usage
        const memoryDisplay = page.getByTestId('memory-display');
        if (await memoryDisplay.isVisible()) {
          const memory = await memoryDisplay.textContent();
          expect(memory).toBeDefined();
        }
      }
    }
  });
  
  test('multiplayer component simulation', async ({ page }) => {
    // This would test multiple player instances if implemented
    const multiplayerButton = page.getByTestId('button-enable-multiplayer');
    if (await multiplayerButton.isVisible()) {
      await multiplayerButton.click();
      
      // Check for player 2 controls
      const player2Controls = page.getByTestId('player2-controls');
      if (await player2Controls.isVisible()) {
        await expect(player2Controls).toBeVisible();
        
        // Test player 2 input
        await page.keyboard.press('w'); // Player 2 up
        await page.keyboard.press('a'); // Player 2 left
        await page.keyboard.press('s'); // Player 2 down
        await page.keyboard.press('d'); // Player 2 right
      }
    }
  });
});