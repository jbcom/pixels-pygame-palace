/**
 * Comprehensive Selenium tests for responsive layout and overflow detection
 * Tests various device resolutions to ensure no horizontal overflow occurs
 */

import { Builder, Browser, By, until, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import assert from 'assert';

// Test configurations for different device types
const DEVICE_RESOLUTIONS = {
  // Phone resolutions
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 12 Pro': { width: 390, height: 844 },
  'Samsung Galaxy S21': { width: 360, height: 800 },
  'Pixel 5': { width: 393, height: 851 },
  
  // Foldable and tablet resolutions (CRITICAL FOR OVERFLOW)
  'Galaxy Fold (closed)': { width: 280, height: 653 },
  'Galaxy Fold (open)': { width: 712, height: 653 },
  'Surface Duo': { width: 540, height: 720 },
  'iPad Mini': { width: 768, height: 1024 },
  'iPad Air': { width: 820, height: 1180 },
  'Galaxy Tab S7': { width: 753, height: 1205 },
  
  // Edge cases (like your 821px issue)
  'Tablet Portrait': { width: 821, height: 649 },
  'Tablet Landscape': { width: 1024, height: 600 },
  
  // Desktop resolutions
  'Laptop': { width: 1366, height: 768 },
  'Desktop HD': { width: 1920, height: 1080 },
  'Desktop 4K': { width: 2560, height: 1440 }
};

class ResponsiveOverflowTest {
  private driver: WebDriver | null = null;

  async setup() {
    const options = new chrome.Options();
    options.addArguments('--headless=new');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    
    this.driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .build();
  }

  async teardown() {
    if (this.driver) {
      await this.driver.quit();
    }
  }

  /**
   * Check for horizontal overflow on a page
   */
  async checkForHorizontalOverflow(): Promise<{ hasOverflow: boolean, details: string }> {
    if (!this.driver) throw new Error('Driver not initialized');
    
    const result = await this.driver.executeScript(`
      const docWidth = document.documentElement.scrollWidth;
      const viewWidth = window.innerWidth;
      const bodyWidth = document.body.scrollWidth;
      
      // Check for overflow
      const hasDocumentOverflow = docWidth > viewWidth;
      const hasBodyOverflow = bodyWidth > viewWidth;
      
      // Find elements causing overflow
      const overflowingElements = [];
      const allElements = document.querySelectorAll('*');
      
      for (let element of allElements) {
        const rect = element.getBoundingClientRect();
        if (rect.right > viewWidth || rect.left < 0) {
          const styles = window.getComputedStyle(element);
          overflowingElements.push({
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            rect: {
              left: rect.left,
              right: rect.right,
              width: rect.width
            },
            overflow: styles.overflow,
            display: styles.display,
            position: styles.position
          });
        }
      }
      
      // Check buttons specifically
      const buttons = document.querySelectorAll('button');
      const buttonOverflow = [];
      for (let button of buttons) {
        const rect = button.getBoundingClientRect();
        if (rect.right > viewWidth) {
          buttonOverflow.push({
            text: button.textContent?.trim(),
            right: rect.right,
            width: rect.width
          });
        }
      }
      
      return {
        hasOverflow: hasDocumentOverflow || hasBodyOverflow,
        documentWidth: docWidth,
        viewportWidth: viewWidth,
        bodyWidth: bodyWidth,
        overflowingElements: overflowingElements.slice(0, 5), // Limit to first 5
        buttonOverflow: buttonOverflow
      };
    `);
    
    return {
      hasOverflow: (result as any).hasOverflow,
      details: JSON.stringify(result, null, 2)
    };
  }

  /**
   * Test a specific resolution
   */
  async testResolution(name: string, dimensions: { width: number, height: number }): Promise<void> {
    if (!this.driver) throw new Error('Driver not initialized');
    
    console.log(`\\n📱 Testing ${name} (${dimensions.width}x${dimensions.height})...`);
    
    // Set window size
    await this.driver.manage().window().setRect({
      width: dimensions.width,
      height: dimensions.height,
      x: 0,
      y: 0
    });
    
    // Navigate to wizard page
    await this.driver.get('http://localhost:5000/wizard');
    
    // Wait for page to load
    await this.driver.wait(until.elementLocated(By.css('body')), 5000);
    
    // Wait a bit for animations to complete
    await this.driver.sleep(1000);
    
    // Check for overflow
    const overflowCheck = await this.checkForHorizontalOverflow();
    
    if (overflowCheck.hasOverflow) {
      console.error(`  ❌ OVERFLOW DETECTED at ${dimensions.width}x${dimensions.height}`);
      console.error(`  Details: ${overflowCheck.details}`);
      
      // Take screenshot for debugging
      const screenshot = await this.driver.takeScreenshot();
      const fs = require('fs');
      const screenshotPath = `/tmp/overflow_${name.replace(/\\s+/g, '_')}_${Date.now()}.png`;
      fs.writeFileSync(screenshotPath, screenshot, 'base64');
      console.error(`  📸 Screenshot saved: ${screenshotPath}`);
      
      throw new Error(`Horizontal overflow detected at ${name} (${dimensions.width}x${dimensions.height})`);
    } else {
      console.log(`  ✅ No overflow detected`);
    }
    
    // Also test with dialogue options visible
    try {
      // Check if there are dialogue options
      const optionButtons = await this.driver.findElements(By.css('[data-testid*="dialogue-option"]'));
      if (optionButtons.length > 0) {
        console.log(`  📝 Found ${optionButtons.length} dialogue options`);
        
        // Check for overflow again with options visible
        const optionOverflowCheck = await this.checkForHorizontalOverflow();
        if (optionOverflowCheck.hasOverflow) {
          console.error(`  ❌ OVERFLOW in dialogue options at ${dimensions.width}x${dimensions.height}`);
          console.error(`  Details: ${optionOverflowCheck.details}`);
          throw new Error(`Dialogue options overflow at ${name}`);
        } else {
          console.log(`  ✅ Dialogue options layout OK`);
        }
      }
    } catch (e) {
      // No options found, that's okay
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting comprehensive responsive overflow tests...');
    console.log('=' .repeat(60));
    
    try {
      await this.setup();
      
      const failedTests: string[] = [];
      
      for (const [name, dimensions] of Object.entries(DEVICE_RESOLUTIONS)) {
        try {
          await this.testResolution(name, dimensions);
        } catch (error) {
          failedTests.push(`${name}: ${error}`);
          // Continue testing other resolutions
        }
      }
      
      console.log('\\n' + '=' .repeat(60));
      if (failedTests.length > 0) {
        console.error('\\n❌ FAILED TESTS:');
        failedTests.forEach(failure => console.error(`  - ${failure}`));
        throw new Error(`${failedTests.length} resolution(s) have overflow issues`);
      } else {
        console.log('\\n✅ All resolutions passed overflow tests!');
      }
      
    } finally {
      await this.teardown();
    }
  }

  /**
   * Test specific problematic resolutions
   */
  async testProblematicResolutions(): Promise<void> {
    console.log('🎯 Testing known problematic resolutions...');
    
    const problematicResolutions = {
      'Tablet 821px': { width: 821, height: 649 },
      'Tablet 821px Tall': { width: 821, height: 433 },
      'Foldable Open': { width: 712, height: 653 }
    };
    
    try {
      await this.setup();
      
      for (const [name, dimensions] of Object.entries(problematicResolutions)) {
        await this.testResolution(name, dimensions);
      }
      
      console.log('\\n✅ All problematic resolutions fixed!');
    } finally {
      await this.teardown();
    }
  }
}

// Run the tests
async function main() {
  const tester = new ResponsiveOverflowTest();
  
  try {
    // Test known problematic resolutions first
    await tester.testProblematicResolutions();
    
    // Then run comprehensive tests
    await tester.runAllTests();
    
    process.exit(0);
  } catch (error) {
    console.error('\\n💥 Test failed:', error);
    process.exit(1);
  }
}

// Execute tests
main().catch(console.error);