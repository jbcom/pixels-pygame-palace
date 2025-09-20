#!/bin/bash

echo "🚀 Starting Selenium Resolution Testing Suite"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "Checking if development server is running..."
curl -s http://localhost:5000 > /dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Development server is not running!${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Create results directory
mkdir -p test-results/selenium-screenshots

# Parse command line arguments
MODE="${1:-all}"

case $MODE in
    "mobile")
        echo "📱 Running Mobile Tests Only"
        npx tsx tests/selenium/mobile-tests.ts
        ;;
    "tablet")
        echo "📱 Running Tablet Tests Only"
        npx tsx tests/selenium/tablet-tests.ts
        ;;
    "desktop")
        echo "🖥️ Running Desktop Tests Only"
        npx tsx tests/selenium/desktop-tests.ts
        ;;
    "foldable")
        echo "📱 Running Foldable Device Tests Only"
        npx tsx tests/selenium/foldable-tests.ts
        ;;
    "quick")
        echo "⚡ Running Quick Test (subset of resolutions)"
        npx tsx tests/selenium/quick-test.ts
        ;;
    "all")
        echo "🔍 Running ALL Resolution Tests"
        npx tsx tests/selenium/comprehensive-resolution-tests.ts
        ;;
    *)
        echo "Usage: $0 [mobile|tablet|desktop|foldable|quick|all]"
        echo ""
        echo "Options:"
        echo "  mobile   - Test mobile portrait and landscape"
        echo "  tablet   - Test tablet resolutions"
        echo "  desktop  - Test desktop and laptop resolutions"
        echo "  foldable - Test foldable device resolutions"
        echo "  quick    - Quick test with subset of resolutions"
        echo "  all      - Test all resolutions (default)"
        exit 1
        ;;
esac

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Tests completed successfully!${NC}"
    echo "📸 Screenshots saved to: test-results/selenium-screenshots/"
    echo "📊 Report saved to: test-results/selenium-resolution-report.json"
else
    echo ""
    echo -e "${RED}❌ Tests failed!${NC}"
    echo "Check test-results/ for details and screenshots"
    exit 1
fi