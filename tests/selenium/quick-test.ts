import { ResolutionTestRunner, RESOLUTIONS } from './comprehensive-resolution-tests';

// Quick subset for rapid testing
const QUICK_TEST_RESOLUTIONS = [
  'mobile-portrait',
  'mobile-landscape', 
  'tablet-portrait-ipad',
  'laptop-15',
  'desktop-hd'
];

async function runQuickTests() {
  console.log('⚡ Running Quick Selenium Tests (Subset)');
  console.log('Testing 5 key resolutions for rapid feedback');
  console.log('=' + '='.repeat(50));
  
  const runner = new ResolutionTestRunner();
  const results: any[] = [];
  
  for (const resolutionName of QUICK_TEST_RESOLUTIONS) {
    const resolution = RESOLUTIONS[resolutionName as keyof typeof RESOLUTIONS];
    const result = await runner.testWizardFlow(resolutionName, resolution);
    results.push(result);
  }
  
  // Print quick summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('\n📊 Quick Test Summary:');
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\nFailed resolutions:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.deviceName}: ${r.errors.join(', ')}`);
    });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runQuickTests().catch(console.error);
}