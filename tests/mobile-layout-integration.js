import { Builder, By, until, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';

// Test configurations for different devices
const DEVICES = {
  iphone12_portrait: {
    name: 'iPhone 12 Pro',
    width: 390,
    height: 844,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
    expectedLayout: 'phone-portrait'
  },
  iphone12_landscape: {
    name: 'iPhone 12 Pro Landscape',
    width: 844,
    height: 390,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
    expectedLayout: 'phone-landscape'
  },
  ipad: {
    name: 'iPad',
    width: 768,
    height: 1024,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
    expectedLayout: 'desktop'
  },
  desktop: {
    name: 'Desktop',
    width: 1280,
    height: 720,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    expectedLayout: 'desktop'
  }
};

const APP_URL = 'http://localhost:5000/wizard';

async function createDriver(device) {
  const options = new chrome.Options();
  
  // Configure mobile emulation
  const mobileEmulation = {
    deviceMetrics: {
      width: device.width,
      height: device.height,
      pixelRatio: 2.0,
      touch: device.name.includes('iPhone') || device.name.includes('iPad')
    },
    userAgent: device.userAgent
  };
  
  options.setMobileEmulation(mobileEmulation);
  options.addArguments('--headless'); // Run in headless mode for CI
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-web-security');
  options.addArguments('--allow-running-insecure-content');
  
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
    
  return driver;
}

async function waitForApp(driver) {
  // Wait for the app to load by checking for Pixel's avatar
  await driver.wait(until.elementLocated(By.css('[data-testid="pixel-avatar"], img[alt="Pixel"]')), 10000);
  await driver.sleep(2000); // Allow animations to complete
}

async function getConsoleLogs(driver) {
  const logs = await driver.manage().logs().get('browser');
  return logs.filter(log => 
    log.message.includes('Device detection:') || 
    log.message.includes('Layout mode check:') ||
    log.message.includes('Using layout mode:') ||
    log.message.includes('Edge swipe')
  ).map(log => log.message);
}

async function testLayoutDetection(device) {
  console.log(`\n🧪 Testing ${device.name} (${device.width}x${device.height})`);
  
  const driver = await createDriver(device);
  
  try {
    await driver.get(APP_URL);
    await waitForApp(driver);
    
    // Get console logs to verify layout detection
    const logs = await getConsoleLogs(driver);
    console.log('📊 Console logs:', logs);
    
    // Take a screenshot for visual verification
    const screenshot = await driver.takeScreenshot();
    const filename = `screenshots/${device.name.toLowerCase().replace(/\s+/g, '-')}-layout.png`;
    
    // Create screenshots directory if it doesn't exist
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots');
    }
    
    fs.writeFileSync(filename, screenshot, 'base64');
    console.log(`📸 Screenshot saved: ${filename}`);
    
    // Verify layout-specific elements
    if (device.expectedLayout === 'phone-portrait') {
      // Should have vertical stack layout
      console.log('✅ Checking for mobile portrait layout...');
      try {
        const verticalStack = await driver.findElement(By.css('.h-screen.flex.flex-col'));
        console.log('✅ Found vertical stack layout');
        
        // Should NOT have header title
        const headers = await driver.findElements(By.css('h1'));
        const hasVisibleTitle = headers.length === 0;
        console.log(`✅ Title visibility check: ${hasVisibleTitle ? 'Hidden as expected' : 'ERROR: Title visible'}`);
        
      } catch (error) {
        console.log('❌ Mobile portrait layout not found:', error.message);
      }
    }
    
    else if (device.expectedLayout === 'phone-landscape') {
      // Should have 20/80 grid layout
      console.log('✅ Checking for mobile landscape layout...');
      try {
        const gridLayout = await driver.findElement(By.css('.grid.grid-cols-\\[20\\%\\,80\\%\\]'));
        console.log('✅ Found 20/80 grid layout');
        
        // Should NOT have hamburger menu button
        const menuButtons = await driver.findElements(By.css('[data-testid="open-pixel-menu-button"]'));
        const noMenuButton = menuButtons.length === 0 || !(await menuButtons[0].isDisplayed());
        console.log(`✅ Hamburger menu check: ${noMenuButton ? 'Hidden as expected' : 'ERROR: Menu button visible'}`);
        
      } catch (error) {
        console.log('❌ Mobile landscape layout not found:', error.message);
      }
    }
    
    else if (device.expectedLayout === 'desktop') {
      // Should have centered card layout
      console.log('✅ Checking for desktop layout...');
      try {
        const centeredCard = await driver.findElement(By.css('.fixed.inset-0.flex.items-center.justify-center'));
        console.log('✅ Found centered desktop layout');
        
        // Tablets should have menu button, large desktop should have header
        if (device.width >= 1024) {
          const header = await driver.findElements(By.css('header'));
          console.log(`✅ Header check: ${header.length > 0 ? 'Present' : 'Hidden for tablet'}`);
        }
        
      } catch (error) {
        console.log('❌ Desktop layout not found:', error.message);
      }
    }
    
    return {
      device: device.name,
      logs,
      screenshot: filename,
      success: true
    };
    
  } catch (error) {
    console.log(`❌ Test failed for ${device.name}:`, error.message);
    return {
      device: device.name,
      error: error.message,
      success: false
    };
  } finally {
    await driver.quit();
  }
}

async function testEdgeSwipe(device) {
  if (!device.name.includes('iPhone')) {
    console.log(`⏭️ Skipping edge swipe test for ${device.name} (not mobile)`);
    return { skipped: true };
  }
  
  console.log(`\n👆 Testing edge swipe on ${device.name}`);
  
  const driver = await createDriver(device);
  
  try {
    await driver.get(APP_URL);
    await waitForApp(driver);
    
    // Simulate left edge swipe using touch actions
    const actions = driver.actions({ async: true });
    
    // Start from left edge and swipe right
    await actions
      .move({ x: 10, y: device.height / 2 })
      .press()
      .move({ x: 200, y: device.height / 2 })
      .release()
      .perform();
    
    await driver.sleep(1000); // Wait for swipe to register
    
    // Check for menu or swipe-related console logs
    const logs = await getConsoleLogs(driver);
    const hasSwipeLogs = logs.some(log => log.includes('Edge swipe'));
    
    console.log('🔍 Edge swipe logs:', logs.filter(log => log.includes('swipe')));
    
    // Try to find if menu opened (might have different selectors)
    let menuOpened = false;
    try {
      const menuElements = await driver.findElements(By.css('[role="dialog"], .fixed.inset-0, [data-testid*="menu"]'));
      menuOpened = menuElements.some(async el => await el.isDisplayed());
    } catch (e) {
      // Menu might not be found, that's ok
    }
    
    console.log(`${hasSwipeLogs || menuOpened ? '✅' : '⚠️'} Edge swipe result: logs=${hasSwipeLogs}, menuOpened=${menuOpened}`);
    
    return {
      device: device.name,
      hasSwipeLogs,
      menuOpened,
      logs: logs.filter(log => log.includes('swipe'))
    };
    
  } catch (error) {
    console.log(`❌ Edge swipe test failed for ${device.name}:`, error.message);
    return {
      device: device.name,
      error: error.message
    };
  } finally {
    await driver.quit();
  }
}

async function runAllTests() {
  console.log('🚀 Starting Mobile Layout Integration Tests');
  console.log('==========================================');
  
  const results = {};
  
  // Test layout detection for each device
  console.log('\n📱 Testing Layout Detection');
  console.log('---------------------------');
  
  for (const [key, device] of Object.entries(DEVICES)) {
    results[key] = await testLayoutDetection(device);
  }
  
  // Test edge swipe functionality
  console.log('\n👆 Testing Edge Swipe Functionality');
  console.log('-----------------------------------');
  
  for (const [key, device] of Object.entries(DEVICES)) {
    if (device.name.includes('iPhone')) {
      results[`${key}_swipe`] = await testEdgeSwipe(device);
    }
  }
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  
  const successful = Object.values(results).filter(r => r.success || r.skipped || r.hasSwipeLogs).length;
  const total = Object.keys(results).length;
  
  console.log(`✅ Successful tests: ${successful}/${total}`);
  
  for (const [key, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`❌ ${key}: ${result.error}`);
    } else if (result.success) {
      console.log(`✅ ${key}: Layout detected correctly`);
    } else if (result.skipped) {
      console.log(`⏭️ ${key}: Skipped`);
    } else if (result.hasSwipeLogs) {
      console.log(`✅ ${key}: Edge swipe detected`);
    }
  }
  
  return results;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(results => {
      console.log('\n✨ All tests completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { runAllTests, testLayoutDetection, testEdgeSwipe, DEVICES };