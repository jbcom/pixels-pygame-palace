const { Builder, By, until, Capabilities } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';
const TIMEOUT = 30000; // 30 seconds
const ANIMATION_WAIT = 2000; // Wait for animations

// Resolution configurations
const RESOLUTIONS = {
  mobile: { width: 375, height: 667, name: 'Mobile' },
  tablet: { width: 768, height: 1024, name: 'Tablet' },
  desktop: { width: 1920, height: 1080, name: 'Desktop' }
};

// Helper functions
async function takeScreenshot(driver, filename) {
  const screenshotDir = path.join(__dirname, '../e2e/test-results/screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const screenshot = await driver.takeScreenshot();
  fs.writeFileSync(path.join(screenshotDir, filename), screenshot, 'base64');
}

async function waitForWizardLoad(driver) {
  // Wait for Pixel avatar to be visible
  await driver.wait(
    until.elementLocated(By.css('[data-testid="pixel-avatar"], img[alt*="Pixel"]')),
    TIMEOUT
  );
  // Wait for dialogue text
  await driver.wait(
    until.elementLocated(By.css('[data-testid="dialogue-text"], .dialogue-text')),
    TIMEOUT
  );
  // Wait for at least one option
  await driver.wait(
    until.elementLocated(By.css('[data-testid^="option-"], .wizard-option')),
    TIMEOUT
  );
  // Wait for animations to complete
  await driver.sleep(ANIMATION_WAIT);
}

async function getWizardState(driver) {
  try {
    // Get current dialogue text
    const dialogueElement = await driver.findElement(
      By.css('[data-testid="dialogue-text"], .dialogue-text')
    );
    const currentDialogue = await dialogueElement.getText();

    // Get available options
    const optionElements = await driver.findElements(
      By.css('[data-testid^="option-"], .wizard-option')
    );
    const availableOptions = [];
    for (const element of optionElements) {
      const text = await element.getText();
      availableOptions.push(text);
    }

    // Check if Pixel is minimized
    const minimizedElements = await driver.findElements(
      By.css('[data-testid="pixel-minimized"]')
    );
    const isMinimized = minimizedElements.length > 0;

    return {
      currentDialogue,
      availableOptions,
      pixelState: isMinimized ? 'minimized' : 'center-stage'
    };
  } catch (error) {
    console.error('Error getting wizard state:', error);
    return {};
  }
}

async function selectOption(driver, optionIndex) {
  const selector = `[data-testid="option-${optionIndex}"]`;
  const optionElement = await driver.wait(
    until.elementLocated(By.css(selector)),
    TIMEOUT
  );
  await driver.wait(until.elementIsVisible(optionElement), TIMEOUT);
  await driver.wait(until.elementIsEnabled(optionElement), TIMEOUT);
  await optionElement.click();
  await driver.sleep(1000); // Wait for transition
}

async function selectOptionByText(driver, text) {
  const optionElements = await driver.findElements(
    By.css('[data-testid^="option-"], .wizard-option')
  );
  
  for (const element of optionElements) {
    const elementText = await element.getText();
    if (elementText.toLowerCase().includes(text.toLowerCase())) {
      await element.click();
      await driver.sleep(1000);
      return true;
    }
  }
  return false;
}

// Test Suite
describe('Multi-Resolution Wizard Tests', function() {
  this.timeout(60000); // 60 seconds for each test
  
  let driver;
  
  afterEach(async function() {
    if (driver) {
      await driver.quit();
    }
  });

  describe('Resolution-specific layout tests', function() {
    
    Object.keys(RESOLUTIONS).forEach((resolutionKey) => {
      const resolution = RESOLUTIONS[resolutionKey];
      
      it(`Should display wizard correctly at ${resolution.name} resolution (${resolution.width}x${resolution.height})`, async function() {
        // Setup Chrome options
        const chromeOptions = new chrome.Options();
        chromeOptions.addArguments('--disable-gpu');
        chromeOptions.addArguments('--no-sandbox');
        chromeOptions.addArguments('--disable-dev-shm-usage');
        chromeOptions.windowSize(resolution);
        
        // Create driver
        driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(chromeOptions)
          .build();
        
        // Set window size explicitly
        await driver.manage().window().setRect({
          width: resolution.width,
          height: resolution.height,
          x: 0,
          y: 0
        });
        
        // Navigate to wizard
        await driver.get(`${BASE_URL}/wizard`);
        await waitForWizardLoad(driver);
        
        // Take screenshot
        await takeScreenshot(driver, `${resolutionKey}-initial.png`);
        
        // Check layout based on resolution
        if (resolutionKey === 'mobile') {
          // Mobile portrait: vertical stack
          const verticalContainer = await driver.findElements(
            By.css('.h-screen.flex.flex-col')
          );
          assert(verticalContainer.length > 0, 'Mobile should have vertical layout');
          
          // Check hamburger menu visibility
          const hamburgerMenu = await driver.findElements(
            By.css('[data-testid="open-pixel-menu-button"]')
          );
          
          // Options should be scrollable
          const optionsContainer = await driver.findElement(
            By.css('[data-testid="options-container"], .wizard-options, .dialogue-options')
          );
          const isScrollable = await driver.executeScript(
            'return arguments[0].scrollHeight > arguments[0].clientHeight',
            optionsContainer
          );
          console.log(`Mobile options scrollable: ${isScrollable}`);
          
        } else if (resolutionKey === 'tablet') {
          // Tablet: should have grid layout
          const gridContainer = await driver.findElements(By.css('.grid'));
          assert(gridContainer.length > 0, 'Tablet should have grid layout');
          
        } else if (resolutionKey === 'desktop') {
          // Desktop: centered card layout
          const centeredLayout = await driver.findElements(
            By.css('.fixed.inset-0.flex.items-center.justify-center, .flex.items-center.justify-center')
          );
          assert(centeredLayout.length > 0, 'Desktop should have centered layout');
          
          // No hamburger menu on desktop
          const hamburgerMenu = await driver.findElements(
            By.css('[data-testid="open-pixel-menu-button"]')
          );
          assert.strictEqual(hamburgerMenu.length, 0, 'Desktop should not have hamburger menu');
        }
        
        // Verify dialogue options are accessible
        const state = await getWizardState(driver);
        assert(state.availableOptions.length > 0, 'Options should be available');
        assert(state.currentDialogue, 'Dialogue should be present');
        
        // Verify Pixel animation is working
        const pixelAvatar = await driver.findElement(
          By.css('[data-testid="pixel-avatar"], img[alt*="Pixel"]')
        );
        const isVisible = await pixelAvatar.isDisplayed();
        assert(isVisible, 'Pixel avatar should be visible');
        
        // Test interaction
        await selectOption(driver, 0);
        await driver.sleep(1000);
        
        const newState = await getWizardState(driver);
        assert.notStrictEqual(
          newState.currentDialogue,
          state.currentDialogue,
          'Dialogue should change after selection'
        );
        
        // Take screenshot after interaction
        await takeScreenshot(driver, `${resolutionKey}-after-interaction.png`);
      });
    });
  });

  describe('Responsive behavior during navigation', function() {
    
    it('Should maintain wizard state when changing resolutions', async function() {
      // Start with desktop resolution
      const chromeOptions = new chrome.Options();
      chromeOptions.addArguments('--disable-gpu');
      chromeOptions.addArguments('--no-sandbox');
      chromeOptions.windowSize(RESOLUTIONS.desktop);
      
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();
      
      // Navigate to wizard
      await driver.get(`${BASE_URL}/wizard`);
      await waitForWizardLoad(driver);
      
      // Make progress in wizard
      await selectOption(driver, 0);
      await driver.sleep(1000);
      
      const desktopState = await getWizardState(driver);
      
      // Change to mobile resolution
      await driver.manage().window().setRect({
        width: RESOLUTIONS.mobile.width,
        height: RESOLUTIONS.mobile.height,
        x: 0,
        y: 0
      });
      await driver.sleep(1000);
      
      // Verify state is maintained
      const mobileState = await getWizardState(driver);
      assert.strictEqual(
        mobileState.currentDialogue,
        desktopState.currentDialogue,
        'State should persist across resolution changes'
      );
      
      // Change to tablet resolution
      await driver.manage().window().setRect({
        width: RESOLUTIONS.tablet.width,
        height: RESOLUTIONS.tablet.height,
        x: 0,
        y: 0
      });
      await driver.sleep(1000);
      
      // Continue navigation on tablet
      if (mobileState.availableOptions.length > 0) {
        await selectOption(driver, 0);
        await driver.sleep(1000);
      }
      
      const tabletState = await getWizardState(driver);
      assert(tabletState.currentDialogue, 'Should maintain dialogue on tablet');
      
      // Take screenshots of all resolutions
      await takeScreenshot(driver, 'resolution-change-final.png');
    });
  });

  describe('Forest theme persistence bug test', function() {
    
    it('Should maintain position after selecting Forest theme and refreshing', async function() {
      const chromeOptions = new chrome.Options();
      chromeOptions.addArguments('--disable-gpu');
      chromeOptions.addArguments('--no-sandbox');
      chromeOptions.windowSize(RESOLUTIONS.desktop);
      
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();
      
      // Navigate to wizard
      await driver.get(`${BASE_URL}/wizard`);
      await waitForWizardLoad(driver);
      
      // Navigate to theme selection
      await selectOptionByText(driver, 'jump straight into making a game');
      await driver.sleep(1000);
      await selectOptionByText(driver, 'platform');
      await driver.sleep(1000);
      
      // Select Forest theme if available
      const forestSelected = await selectOptionByText(driver, 'Forest');
      if (forestSelected) {
        await driver.sleep(1000);
        
        // Continue to title presentation
        const state = await getWizardState(driver);
        if (state.availableOptions.length > 0) {
          await selectOption(driver, 0);
          await driver.sleep(1000);
        }
        
        // Get state at title presentation
        const titlePresentationState = await getWizardState(driver);
        const titleDialogue = titlePresentationState.currentDialogue;
        
        // Refresh page
        await driver.navigate().refresh();
        await waitForWizardLoad(driver);
        
        // Verify we're still at title presentation, not back at theme selection
        const stateAfterRefresh = await getWizardState(driver);
        assert.strictEqual(
          stateAfterRefresh.currentDialogue,
          titleDialogue,
          'Should stay at title presentation after refresh, not go back to theme selection'
        );
        
        // Verify we're not at theme selection
        assert(
          !stateAfterRefresh.currentDialogue.includes('Forest'),
          'Should not be at Forest theme selection'
        );
        assert(
          !stateAfterRefresh.currentDialogue.toLowerCase().includes('theme'),
          'Should not be at theme selection'
        );
        
        await takeScreenshot(driver, 'forest-theme-persistence.png');
      } else {
        console.log('Forest theme option not found - test skipped');
      }
    });
    
    // Test at different resolutions
    ['mobile', 'tablet', 'desktop'].forEach((resolutionKey) => {
      const resolution = RESOLUTIONS[resolutionKey];
      
      it(`Should handle persistence correctly at ${resolution.name} resolution`, async function() {
        const chromeOptions = new chrome.Options();
        chromeOptions.addArguments('--disable-gpu');
        chromeOptions.addArguments('--no-sandbox');
        chromeOptions.windowSize(resolution);
        
        driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(chromeOptions)
          .build();
        
        // Clear localStorage
        await driver.get(`${BASE_URL}`);
        await driver.executeScript('localStorage.clear()');
        
        // Navigate to wizard
        await driver.get(`${BASE_URL}/wizard`);
        await waitForWizardLoad(driver);
        
        // Make some progress
        await selectOption(driver, 0);
        await driver.sleep(1000);
        
        const stateBeforeRefresh = await getWizardState(driver);
        
        // Refresh page
        await driver.navigate().refresh();
        await waitForWizardLoad(driver);
        
        // Verify state persisted
        const stateAfterRefresh = await getWizardState(driver);
        assert.strictEqual(
          stateAfterRefresh.currentDialogue,
          stateBeforeRefresh.currentDialogue,
          `State should persist after refresh at ${resolution.name} resolution`
        );
        
        // Clear progress and verify reset
        await driver.executeScript('localStorage.clear()');
        await driver.navigate().refresh();
        await waitForWizardLoad(driver);
        
        const resetState = await getWizardState(driver);
        assert(
          resetState.currentDialogue.includes('Pixel'),
          'Should reset to initial state after clearing localStorage'
        );
        
        await takeScreenshot(driver, `${resolutionKey}-persistence-test.png`);
      });
    });
  });

  describe('Touch and interaction tests', function() {
    
    it('Should handle touch interactions on mobile', async function() {
      const chromeOptions = new chrome.Options();
      chromeOptions.addArguments('--disable-gpu');
      chromeOptions.addArguments('--no-sandbox');
      chromeOptions.windowSize(RESOLUTIONS.mobile);
      // Enable mobile emulation
      chromeOptions.setMobileEmulation({
        deviceName: 'iPhone X'
      });
      
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();
      
      // Navigate to wizard
      await driver.get(`${BASE_URL}/wizard`);
      await waitForWizardLoad(driver);
      
      // Test touch scrolling on options
      const optionsContainer = await driver.findElement(
        By.css('[data-testid="options-container"], .wizard-options, .dialogue-options')
      );
      
      // Simulate touch scroll
      await driver.executeScript(`
        const element = arguments[0];
        const touch = new Touch({
          identifier: Date.now(),
          target: element,
          clientX: 100,
          clientY: 300,
        });
        
        const touchStart = new TouchEvent('touchstart', {
          touches: [touch],
          targetTouches: [touch],
          changedTouches: [touch],
        });
        element.dispatchEvent(touchStart);
        
        const touchMove = new TouchEvent('touchmove', {
          touches: [touch],
          targetTouches: [touch],
          changedTouches: [touch],
        });
        element.dispatchEvent(touchMove);
        
        const touchEnd = new TouchEvent('touchend', {
          touches: [],
          targetTouches: [],
          changedTouches: [touch],
        });
        element.dispatchEvent(touchEnd);
      `, optionsContainer);
      
      // Test tap on option
      const options = await driver.findElements(
        By.css('[data-testid^="option-"], .wizard-option')
      );
      if (options.length > 0) {
        // Use Actions API for touch
        const actions = driver.actions({ async: true });
        await actions
          .move({ origin: options[0] })
          .press()
          .pause(100)
          .release()
          .perform();
        
        await driver.sleep(1000);
        
        const state = await getWizardState(driver);
        assert(state.currentDialogue, 'Should progress after touch interaction');
      }
      
      await takeScreenshot(driver, 'mobile-touch-interaction.png');
    });
  });
});

// Run tests
if (require.main === module) {
  console.log('Running Selenium multi-resolution tests...');
  console.log(`Testing against: ${BASE_URL}`);
  
  // Check if server is running
  const http = require('http');
  const url = new URL(BASE_URL);
  
  const checkServer = () => {
    return new Promise((resolve) => {
      http.get(BASE_URL, (res) => {
        resolve(res.statusCode === 200);
      }).on('error', () => {
        resolve(false);
      });
    });
  };
  
  checkServer().then((isRunning) => {
    if (!isRunning) {
      console.error(`Server not running at ${BASE_URL}`);
      console.error('Please start the server with: npm run dev');
      process.exit(1);
    }
    
    console.log('Server is running, starting tests...');
    
    // Run mocha programmatically
    const Mocha = require('mocha');
    const mocha = new Mocha({
      reporter: 'spec',
      timeout: 60000
    });
    
    mocha.addFile(__filename);
    mocha.run((failures) => {
      process.exit(failures ? 1 : 0);
    });
  });
}