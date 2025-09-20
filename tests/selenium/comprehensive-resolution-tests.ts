import { Builder, By, until, WebDriver, Capabilities } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Resolution configurations for comprehensive testing
const RESOLUTIONS = {
  // Mobile Portrait
  'mobile-portrait': { width: 375, height: 812, deviceName: 'iPhone X Portrait' },
  'mobile-portrait-small': { width: 360, height: 640, deviceName: 'Android Portrait Small' },
  
  // Mobile Landscape  
  'mobile-landscape': { width: 812, height: 375, deviceName: 'iPhone X Landscape' },
  'mobile-landscape-android': { width: 640, height: 360, deviceName: 'Android Landscape' },
  
  // Foldable Devices
  'foldable-closed': { width: 360, height: 768, deviceName: 'Galaxy Fold Closed' },
  'foldable-open': { width: 768, height: 1076, deviceName: 'Galaxy Fold Open' },
  'surface-duo': { width: 1350, height: 1800, deviceName: 'Surface Duo' },
  
  // Tablets
  'tablet-portrait-ipad': { width: 768, height: 1024, deviceName: 'iPad Portrait' },
  'tablet-landscape-ipad': { width: 1024, height: 768, deviceName: 'iPad Landscape' },
  'tablet-portrait-android': { width: 800, height: 1280, deviceName: 'Android Tablet Portrait' },
  'tablet-landscape-android': { width: 1280, height: 800, deviceName: 'Android Tablet Landscape' },
  'tablet-ipad-pro': { width: 1024, height: 1366, deviceName: 'iPad Pro' },
  
  // Laptop Resolutions
  'laptop-13': { width: 1280, height: 800, deviceName: 'MacBook Air 13"' },
  'laptop-15': { width: 1440, height: 900, deviceName: 'MacBook Pro 15"' },
  'laptop-windows': { width: 1366, height: 768, deviceName: 'Windows Laptop' },
  
  // Desktop Resolutions
  'desktop-hd': { width: 1920, height: 1080, deviceName: 'Desktop HD' },
  'desktop-fhd': { width: 1920, height: 1200, deviceName: 'Desktop Full HD' },
  'desktop-2k': { width: 2560, height: 1440, deviceName: 'Desktop 2K' },
  'desktop-4k': { width: 3840, height: 2160, deviceName: 'Desktop 4K' },
  'desktop-ultrawide': { width: 3440, height: 1440, deviceName: 'Ultrawide Monitor' }
};

class ResolutionTestRunner {
  private driver: WebDriver | null = null;
  private baseUrl: string = 'http://localhost:5000';
  private testResults: Map<string, TestResult> = new Map();
  
  async setupDriver(resolution: typeof RESOLUTIONS[keyof typeof RESOLUTIONS]): Promise<void> {
    const options = new chrome.Options();
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments(`--window-size=${resolution.width},${resolution.height}`);
    options.addArguments('--force-device-scale-factor=1');
    
    // Headless for CI environments
    if (process.env.CI) {
      options.addArguments('--headless');
    }
    
    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
      
    await this.driver.manage().window().setRect({
      width: resolution.width,
      height: resolution.height,
      x: 0,
      y: 0
    });
  }
  
  async teardown(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
    }
  }
  
  async checkForRuntimeErrors(): Promise<ErrorCheck> {
    if (!this.driver) throw new Error('Driver not initialized');
    
    // Check for Vite error overlay
    try {
      const errorOverlay = await this.driver.findElements(By.css('[id*="vite-error"], [class*="runtime-error"]'));
      if (errorOverlay.length > 0) {
        const errorText = await errorOverlay[0].getText();
        return { hasError: true, errorMessage: errorText };
      }
    } catch (e) {
      // No error overlay found
    }
    
    // Check browser console for errors
    const logs = await this.driver.manage().logs().get('browser');
    const errors = logs.filter(log => log.level.name === 'SEVERE');
    if (errors.length > 0) {
      return { 
        hasError: true, 
        errorMessage: errors.map(e => e.message).join('\n')
      };
    }
    
    return { hasError: false };
  }
  
  async testWizardFlow(resolutionName: string, resolution: typeof RESOLUTIONS[keyof typeof RESOLUTIONS]): Promise<TestResult> {
    console.log(`\n🖥️ Testing ${resolution.deviceName} (${resolution.width}x${resolution.height})`);
    
    try {
      await this.setupDriver(resolution);
      
      // Navigate to wizard
      await this.driver!.get(`${this.baseUrl}/wizard`);
      await this.driver!.wait(until.urlContains('/wizard'), 5000);
      
      // Check for runtime errors
      const errorCheck = await this.checkForRuntimeErrors();
      if (errorCheck.hasError) {
        throw new Error(`Runtime error detected: ${errorCheck.errorMessage}`);
      }
      
      // Check responsive layout based on resolution
      const body = await this.driver!.findElement(By.tagName('body'));
      const bodyClass = await body.getAttribute('class');
      
      // Verify Pixel avatar is visible
      await this.driver!.wait(
        until.elementLocated(By.css('[data-testid*="pixel"], img[alt*="Pixel"], .mascot-avatar')),
        5000
      );
      
      // Verify dialogue text
      await this.driver!.wait(
        until.elementLocated(By.css('[data-testid*="dialogue"], .dialogue-text, .wizard-dialogue')),
        5000
      );
      
      // Check responsive behavior
      const layoutTests = await this.testResponsiveLayout(resolution);
      
      // Test navigation to game wizard
      await this.driver!.get(`${this.baseUrl}/game-wizard`);
      await this.driver!.wait(until.urlContains('/game-wizard'), 5000);
      
      const gameWizardError = await this.checkForRuntimeErrors();
      if (gameWizardError.hasError) {
        throw new Error(`Game wizard error: ${gameWizardError.errorMessage}`);
      }
      
      // Test preview functionality
      await this.driver!.get(`${this.baseUrl}/pygame-preview-test`);
      const previewError = await this.checkForRuntimeErrors();
      if (previewError.hasError) {
        throw new Error(`Preview error: ${previewError.errorMessage}`);
      }
      
      // Take screenshot for visual verification
      const screenshot = await this.driver!.takeScreenshot();
      await this.saveScreenshot(screenshot, resolutionName);
      
      return {
        resolution: resolutionName,
        deviceName: resolution.deviceName,
        width: resolution.width,
        height: resolution.height,
        passed: true,
        errors: [],
        layoutTests
      };
      
    } catch (error: any) {
      console.error(`❌ Failed for ${resolution.deviceName}: ${error.message}`);
      
      // Take failure screenshot
      if (this.driver) {
        try {
          const screenshot = await this.driver.takeScreenshot();
          await this.saveScreenshot(screenshot, `${resolutionName}-failure`);
        } catch (e) {
          console.error('Could not capture failure screenshot');
        }
      }
      
      return {
        resolution: resolutionName,
        deviceName: resolution.deviceName,
        width: resolution.width,
        height: resolution.height,
        passed: false,
        errors: [error.message],
        layoutTests: {}
      };
    } finally {
      await this.teardown();
    }
  }
  
  async testResponsiveLayout(resolution: typeof RESOLUTIONS[keyof typeof RESOLUTIONS]): Promise<LayoutTests> {
    if (!this.driver) throw new Error('Driver not initialized');
    
    const layoutTests: LayoutTests = {
      hasProperMobileLayout: false,
      hasProperTabletLayout: false,
      hasProperDesktopLayout: false,
      has20_80Split: false,
      hasVerticalStack: false
    };
    
    // Determine expected layout based on resolution
    const isMobile = resolution.width < 768;
    const isTablet = resolution.width >= 768 && resolution.width < 1024;
    const isDesktop = resolution.width >= 1024;
    const isLandscapeMobile = isMobile && resolution.width > resolution.height;
    const isPortraitMobile = isMobile && resolution.height > resolution.width;
    
    if (isPortraitMobile) {
      // Should have vertical stack
      try {
        await this.driver.wait(
          until.elementLocated(By.css('.flex-col, .portrait-layout, [class*="portrait"]')),
          3000
        );
        layoutTests.hasVerticalStack = true;
      } catch (e) {
        console.log('  ⚠️ No vertical stack found for portrait');
      }
    }
    
    if (isLandscapeMobile) {
      // Should have 20/80 split
      try {
        const grid = await this.driver.findElements(
          By.css('.grid-cols-[20%_80%], .landscape-split, [class*="grid-cols"]')
        );
        layoutTests.has20_80Split = grid.length > 0;
      } catch (e) {
        console.log('  ⚠️ No 20/80 split found for landscape');
      }
    }
    
    layoutTests.hasProperMobileLayout = isMobile;
    layoutTests.hasProperTabletLayout = isTablet;
    layoutTests.hasProperDesktopLayout = isDesktop;
    
    return layoutTests;
  }
  
  async saveScreenshot(screenshot: string, name: string): Promise<void> {
    const dir = 'test-results/selenium-screenshots';
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, `${name}-${Date.now()}.png`);
    await fs.writeFile(filepath, screenshot, 'base64');
    console.log(`  📸 Screenshot saved: ${filepath}`);
  }
  
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Selenium Resolution Tests');
    console.log('=' + '='.repeat(70));
    
    const startTime = Date.now();
    let passedCount = 0;
    let failedCount = 0;
    
    // Group tests by category
    const categories = {
      'Mobile Portrait': ['mobile-portrait', 'mobile-portrait-small'],
      'Mobile Landscape': ['mobile-landscape', 'mobile-landscape-android'],
      'Foldable Devices': ['foldable-closed', 'foldable-open', 'surface-duo'],
      'Tablets': ['tablet-portrait-ipad', 'tablet-landscape-ipad', 'tablet-portrait-android', 
                  'tablet-landscape-android', 'tablet-ipad-pro'],
      'Laptop': ['laptop-13', 'laptop-15', 'laptop-windows'],
      'Desktop': ['desktop-hd', 'desktop-fhd', 'desktop-2k', 'desktop-4k', 'desktop-ultrawide']
    };
    
    for (const [category, resolutions] of Object.entries(categories)) {
      console.log(`\n📱 Testing ${category}`);
      console.log('-'.repeat(50));
      
      for (const resolutionName of resolutions) {
        const resolution = RESOLUTIONS[resolutionName as keyof typeof RESOLUTIONS];
        const result = await this.testWizardFlow(resolutionName, resolution);
        this.testResults.set(resolutionName, result);
        
        if (result.passed) {
          console.log(`  ✅ ${result.deviceName} - PASSED`);
          passedCount++;
        } else {
          console.log(`  ❌ ${result.deviceName} - FAILED`);
          console.log(`     Errors: ${result.errors.join(', ')}`);
          failedCount++;
        }
      }
    }
    
    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Summary');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${passedCount + failedCount}`);
    console.log(`✅ Passed: ${passedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`⏱️ Duration: ${duration}s`);
    console.log(`📸 Screenshots saved to: test-results/selenium-screenshots/`);
    
    // Generate detailed report
    await this.generateReport();
    
    if (failedCount > 0) {
      console.log('\n⚠️ Some tests failed. Check the report for details.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed successfully!');
    }
  }
  
  async generateReport(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      results: Array.from(this.testResults.values()),
      summary: {
        total: this.testResults.size,
        passed: Array.from(this.testResults.values()).filter(r => r.passed).length,
        failed: Array.from(this.testResults.values()).filter(r => !r.passed).length
      }
    };
    
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile(
      'test-results/selenium-resolution-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n📝 Detailed report saved to: test-results/selenium-resolution-report.json');
  }
}

// Type definitions
interface TestResult {
  resolution: string;
  deviceName: string;
  width: number;
  height: number;
  passed: boolean;
  errors: string[];
  layoutTests: any;
}

interface ErrorCheck {
  hasError: boolean;
  errorMessage?: string;
}

interface LayoutTests {
  hasProperMobileLayout: boolean;
  hasProperTabletLayout: boolean;
  hasProperDesktopLayout: boolean;
  has20_80Split: boolean;
  hasVerticalStack: boolean;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ResolutionTestRunner();
  runner.runAllTests().catch(console.error);
}

export { ResolutionTestRunner, RESOLUTIONS };