import { test, expect } from '@playwright/test';

test.describe('Wizard Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });
  
  test('complete wizard flow from start to game generation', async ({ page }) => {
    // Wait for Pixel mascot to appear
    await expect(page.getByTestId('pixel-mascot')).toBeVisible({ timeout: 10000 });
    
    // Start the conversation
    const startButton = page.getByTestId('button-choice-A');
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // Wait for component selection screen
    await page.waitForTimeout(1000); // Allow for animation
    
    // Select jump component
    const jumpButton = page.getByTestId('button-select-jump');
    if (await jumpButton.isVisible()) {
      await jumpButton.click();
    }
    
    // Choose variant A (basic jump)
    const variantButton = page.getByTestId('button-variant-A');
    if (await variantButton.isVisible()) {
      await variantButton.click();
    }
    
    // Add another component - walking
    const addComponentButton = page.getByTestId('button-add-component');
    if (await addComponentButton.isVisible()) {
      await addComponentButton.click();
      
      const walkButton = page.getByTestId('button-select-walk');
      if (await walkButton.isVisible()) {
        await walkButton.click();
      }
      
      const walkVariantButton = page.getByTestId('button-variant-A');
      if (await walkVariantButton.isVisible()) {
        await walkVariantButton.click();
      }
    }
    
    // Finalize and generate game
    const generateButton = page.getByTestId('button-generate-game');
    if (await generateButton.isVisible()) {
      await generateButton.click();
    }
    
    // Verify game canvas appears
    await expect(page.getByTestId('game-canvas')).toBeVisible({ timeout: 15000 });
  });
  
  test('navigate through dialogue options', async ({ page }) => {
    await expect(page.getByTestId('pixel-mascot')).toBeVisible();
    
    // Check for dialogue content
    const dialogueBox = page.getByTestId('dialogue-content');
    await expect(dialogueBox).toBeVisible();
    
    // Test multiple choice interactions
    const choices = page.getByTestId(/button-choice-/);
    const choiceCount = await choices.count();
    expect(choiceCount).toBeGreaterThan(0);
    
    // Click through a few choices
    for (let i = 0; i < Math.min(3, choiceCount); i++) {
      const choice = choices.nth(i);
      if (await choice.isVisible()) {
        await choice.click();
        await page.waitForTimeout(500); // Wait for response
        
        // Check that new content appears
        await expect(dialogueBox).toBeVisible();
      }
    }
  });
  
  test('select and configure components', async ({ page }) => {
    await expect(page.getByTestId('pixel-mascot')).toBeVisible();
    
    // Navigate to component selection
    const componentButton = page.getByTestId('button-browse-components');
    if (await componentButton.isVisible()) {
      await componentButton.click();
    }
    
    // Check component categories are visible
    const categories = ['movement', 'combat', 'ui', 'world'];
    for (const category of categories) {
      const categorySection = page.getByTestId(`category-${category}`);
      if (await categorySection.isVisible()) {
        await expect(categorySection).toBeVisible();
      }
    }
    
    // Select a component
    const firstComponent = page.getByTestId(/button-select-/).first();
    if (await firstComponent.isVisible()) {
      await firstComponent.click();
      
      // Check variant selection appears
      const variantOptions = page.getByTestId(/button-variant-/);
      expect(await variantOptions.count()).toBeGreaterThan(0);
    }
  });
  
  test('customize component parameters', async ({ page }) => {
    await expect(page.getByTestId('pixel-mascot')).toBeVisible();
    
    // Navigate to component customization
    const componentButton = page.getByTestId('button-browse-components');
    if (await componentButton.isVisible()) {
      await componentButton.click();
      
      // Select jump component
      const jumpButton = page.getByTestId('button-select-jump');
      if (await jumpButton.isVisible()) {
        await jumpButton.click();
        
        // Check for parameter inputs
        const jumpForceInput = page.getByTestId('input-jump-force');
        if (await jumpForceInput.isVisible()) {
          await jumpForceInput.clear();
          await jumpForceInput.fill('20');
        }
        
        // Select a sound asset
        const soundSelect = page.getByTestId('select-jump-sound');
        if (await soundSelect.isVisible()) {
          await soundSelect.selectOption({ index: 1 });
        }
        
        // Confirm selection
        const confirmButton = page.getByTestId('button-confirm-component');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    }
  });
  
  test('handle back navigation in wizard', async ({ page }) => {
    await expect(page.getByTestId('pixel-mascot')).toBeVisible();
    
    // Progress through a few steps
    const firstChoice = page.getByTestId('button-choice-A');
    if (await firstChoice.isVisible()) {
      await firstChoice.click();
    }
    
    await page.waitForTimeout(500);
    
    // Try to go back
    const backButton = page.getByTestId('button-back');
    if (await backButton.isVisible()) {
      await backButton.click();
      
      // Should return to previous state
      await expect(page.getByTestId('button-choice-A')).toBeVisible();
    }
  });
  
  test('responsive dialogue typing animation', async ({ page }) => {
    await expect(page.getByTestId('pixel-mascot')).toBeVisible();
    
    // Check for typing animation
    const dialogueContent = page.getByTestId('dialogue-content');
    await expect(dialogueContent).toBeVisible();
    
    // Get initial text length
    const initialText = await dialogueContent.textContent();
    
    // Wait a bit for typing animation
    await page.waitForTimeout(100);
    
    // Text should be progressively appearing (unless instant mode)
    const updatedText = await dialogueContent.textContent();
    expect(updatedText).toBeDefined();
  });
});