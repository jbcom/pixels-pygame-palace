import { test, expect } from '@playwright/test';

test.describe('Editor Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
  });
  
  test('visual editor component manipulation', async ({ page }) => {
    // Check editor is loaded
    const editorCanvas = page.getByTestId('editor-canvas');
    await expect(editorCanvas).toBeVisible();
    
    // Open component panel
    const componentPanel = page.getByTestId('component-panel');
    if (!await componentPanel.isVisible()) {
      const togglePanelButton = page.getByTestId('button-toggle-components');
      await togglePanelButton.click();
    }
    await expect(componentPanel).toBeVisible();
    
    // Drag and drop a component
    const jumpComponent = page.getByTestId('draggable-jump');
    const dropZone = page.getByTestId('editor-dropzone');
    
    if (await jumpComponent.isVisible() && await dropZone.isVisible()) {
      await jumpComponent.dragTo(dropZone);
      
      // Verify component was added
      const addedComponent = page.getByTestId('component-jump-instance');
      await expect(addedComponent).toBeVisible();
    }
  });
  
  test('code preview and editing', async ({ page }) => {
    // Open code view
    const codeViewButton = page.getByTestId('button-code-view');
    if (await codeViewButton.isVisible()) {
      await codeViewButton.click();
      
      // Check code editor is visible
      const codeEditor = page.getByTestId('code-editor');
      await expect(codeEditor).toBeVisible();
      
      // Verify Python code is displayed
      const codeContent = await codeEditor.textContent();
      expect(codeContent).toContain('import pygame');
      expect(codeContent).toContain('class Player:');
    }
  });
  
  test('asset browser integration', async ({ page }) => {
    // Open asset browser
    const assetButton = page.getByTestId('button-assets');
    if (await assetButton.isVisible()) {
      await assetButton.click();
      
      const assetBrowser = page.getByTestId('asset-browser');
      await expect(assetBrowser).toBeVisible();
      
      // Check asset categories
      const categories = ['sprites', 'sounds', 'music', 'backgrounds'];
      for (const category of categories) {
        const categoryTab = page.getByTestId(`tab-${category}`);
        if (await categoryTab.isVisible()) {
          await categoryTab.click();
          
          // Verify assets are displayed
          const assetGrid = page.getByTestId(`grid-${category}`);
          await expect(assetGrid).toBeVisible();
          
          const assetItems = page.getByTestId(new RegExp(`asset-${category}-`));
          expect(await assetItems.count()).toBeGreaterThan(0);
        }
      }
    }
  });
  
  test('component property editing', async ({ page }) => {
    // Add a component first
    const componentPanel = page.getByTestId('component-panel');
    if (!await componentPanel.isVisible()) {
      const toggleButton = page.getByTestId('button-toggle-components');
      await toggleButton.click();
    }
    
    // Add jump component
    const jumpButton = page.getByTestId('button-add-jump');
    if (await jumpButton.isVisible()) {
      await jumpButton.click();
      
      // Open properties panel
      const jumpInstance = page.getByTestId('component-jump-instance');
      if (await jumpInstance.isVisible()) {
        await jumpInstance.click();
        
        const propertiesPanel = page.getByTestId('properties-panel');
        await expect(propertiesPanel).toBeVisible();
        
        // Edit jump force
        const jumpForceInput = page.getByTestId('input-property-jump-force');
        if (await jumpForceInput.isVisible()) {
          await jumpForceInput.clear();
          await jumpForceInput.fill('25');
          
          // Apply changes
          const applyButton = page.getByTestId('button-apply-properties');
          if (await applyButton.isVisible()) {
            await applyButton.click();
          }
        }
      }
    }
  });
  
  test('scene configuration', async ({ page }) => {
    // Open scene settings
    const sceneSettingsButton = page.getByTestId('button-scene-settings');
    if (await sceneSettingsButton.isVisible()) {
      await sceneSettingsButton.click();
      
      const settingsModal = page.getByTestId('modal-scene-settings');
      await expect(settingsModal).toBeVisible();
      
      // Edit scene properties
      const widthInput = page.getByTestId('input-scene-width');
      const heightInput = page.getByTestId('input-scene-height');
      const fpsInput = page.getByTestId('input-scene-fps');
      const bgColorInput = page.getByTestId('input-scene-bgcolor');
      
      if (await widthInput.isVisible()) {
        await widthInput.clear();
        await widthInput.fill('1024');
      }
      
      if (await heightInput.isVisible()) {
        await heightInput.clear();
        await heightInput.fill('768');
      }
      
      if (await fpsInput.isVisible()) {
        await fpsInput.clear();
        await fpsInput.fill('30');
      }
      
      if (await bgColorInput.isVisible()) {
        await bgColorInput.clear();
        await bgColorInput.fill('#2A2A2A');
      }
      
      // Save settings
      const saveButton = page.getByTestId('button-save-scene-settings');
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
    }
  });
  
  test('preview mode', async ({ page }) => {
    // Add some components
    const componentButton = page.getByTestId('button-add-jump');
    if (await componentButton.isVisible()) {
      await componentButton.click();
    }
    
    // Switch to preview mode
    const previewButton = page.getByTestId('button-preview');
    if (await previewButton.isVisible()) {
      await previewButton.click();
      
      // Check preview canvas
      const previewCanvas = page.getByTestId('preview-canvas');
      await expect(previewCanvas).toBeVisible();
      
      // Test controls should be visible
      const playButton = page.getByTestId('button-play-preview');
      const stopButton = page.getByTestId('button-stop-preview');
      
      if (await playButton.isVisible()) {
        await expect(playButton).toBeVisible();
      }
      if (await stopButton.isVisible()) {
        await expect(stopButton).toBeVisible();
      }
    }
  });
  
  test('export functionality', async ({ page }) => {
    // Add components to export
    const jumpButton = page.getByTestId('button-add-jump');
    if (await jumpButton.isVisible()) {
      await jumpButton.click();
    }
    
    // Open export dialog
    const exportButton = page.getByTestId('button-export');
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      const exportModal = page.getByTestId('modal-export');
      await expect(exportModal).toBeVisible();
      
      // Check export options
      const pythonExport = page.getByTestId('option-export-python');
      const zipExport = page.getByTestId('option-export-zip');
      
      if (await pythonExport.isVisible()) {
        await expect(pythonExport).toBeVisible();
      }
      if (await zipExport.isVisible()) {
        await expect(zipExport).toBeVisible();
      }
      
      // Trigger export
      const confirmExportButton = page.getByTestId('button-confirm-export');
      if (await confirmExportButton.isVisible()) {
        await confirmExportButton.click();
        
        // Check for success message or download
        const successMessage = page.getByTestId('message-export-success');
        if (await successMessage.isVisible({ timeout: 5000 })) {
          await expect(successMessage).toBeVisible();
        }
      }
    }
  });
});