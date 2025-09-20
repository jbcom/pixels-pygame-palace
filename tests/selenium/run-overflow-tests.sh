#!/bin/bash

echo "🔍 Running Responsive Overflow Tests..."
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Check if server is running
if ! curl -s http://localhost:5000 > /dev/null; then
    echo -e "${RED}❌ Server is not running on localhost:5000${NC}"
    echo "Please start the development server first"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"

# Compile TypeScript
echo "📦 Compiling TypeScript tests..."
npx tsc test-responsive-overflow.ts --module commonjs --target es2020 --esModuleInterop --skipLibCheck

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    exit 1
fi

# Run the overflow tests
echo -e "${YELLOW}🚀 Starting overflow detection tests...${NC}"
node test-responsive-overflow.js

TEST_RESULT=$?

# Clean up
rm -f test-responsive-overflow.js

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✨ All responsive overflow tests passed!${NC}"
else
    echo -e "${RED}💥 Some tests failed - overflow issues detected${NC}"
    echo "Check the screenshots in /tmp for visual debugging"
fi

exit $TEST_RESULT