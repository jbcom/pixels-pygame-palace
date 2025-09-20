#!/bin/bash

# Comprehensive Playwright Test Runner Script
# This script provides easy access to the comprehensive test suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if server is running
check_server() {
    print_status "Checking if server is running on port 5000..."
    if curl -f http://localhost:5000 > /dev/null 2>&1; then
        print_success "Server is running"
        return 0
    else
        print_warning "Server not responding"
        return 1
    fi
}

# Function to show help
show_help() {
    echo "Comprehensive Playwright Test Runner"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  critical    Run only critical priority tests (~5 minutes)"
    echo "  high        Run critical + high priority tests (~10 minutes)"  
    echo "  all         Run all tests (~15 minutes)"
    echo "  smoke       Run smoke tests only"
    echo "  wizard      Run wizard flow tests"
    echo "  editor      Run WYSIWYG editor tests"
    echo "  assets      Run asset browser tests"
    echo "  animations  Run pixel animation tests"
    echo "  desktop     Run tests on desktop viewport only"
    echo "  mobile      Run tests on mobile viewport only"
    echo "  tablet      Run tests on tablet viewport only"
    echo ""
    echo "Options:"
    echo "  --headed    Show browser UI during tests"
    echo "  --debug     Run in debug mode"
    echo "  --report    Open test report after completion"
    echo "  --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 critical              # Quick critical test run"
    echo "  $0 smoke --headed        # Run smoke tests with UI"
    echo "  $0 all --report          # Full test run with report"
    echo "  $0 desktop               # Test desktop resolution only"
}

# Default values
COMMAND="critical"
HEADED_FLAG=""
DEBUG_FLAG=""
SHOW_REPORT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        critical|high|all|smoke|wizard|editor|assets|animations|desktop|mobile|tablet)
            COMMAND="$1"
            shift
            ;;
        --headed)
            HEADED_FLAG="--headed"
            shift
            ;;
        --debug)
            DEBUG_FLAG="--debug"
            shift
            ;;
        --report)
            SHOW_REPORT=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

print_status "Starting Playwright comprehensive test suite"
print_status "Command: $COMMAND"

# Check if server is running
if ! check_server; then
    print_status "Attempting to start development server..."
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 10
    
    if ! check_server; then
        print_error "Failed to start server. Please start it manually with 'npm run dev'"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    
    # Store PID to kill later
    echo $SERVER_PID > .server.pid
fi

# Execute tests based on command
case $COMMAND in
    critical)
        print_status "Running critical tests only (~5 minutes)"
        npx tsx tests/e2e/run-comprehensive-tests.ts --critical $HEADED_FLAG $DEBUG_FLAG
        ;;
    high)
        print_status "Running critical + high priority tests (~10 minutes)"
        npx tsx tests/e2e/run-comprehensive-tests.ts --high $HEADED_FLAG $DEBUG_FLAG
        ;;
    all)
        print_status "Running all tests (~15 minutes)"
        npx tsx tests/e2e/run-comprehensive-tests.ts $HEADED_FLAG $DEBUG_FLAG
        ;;
    smoke)
        print_status "Running smoke tests"
        npx playwright test smoke-tests.spec.ts $HEADED_FLAG $DEBUG_FLAG
        ;;
    wizard)
        print_status "Running wizard flow tests"
        npx playwright test wizard-flow-tests.spec.ts $HEADED_FLAG $DEBUG_FLAG
        ;;
    editor)
        print_status "Running WYSIWYG editor tests"
        npx playwright test wysiwyg-editor-tests.spec.ts $HEADED_FLAG $DEBUG_FLAG
        ;;
    assets)
        print_status "Running asset browser tests"
        npx playwright test asset-browser-tests.spec.ts $HEADED_FLAG $DEBUG_FLAG
        ;;
    animations)
        print_status "Running pixel animation tests"
        npx playwright test pixel-animation-tests.spec.ts $HEADED_FLAG $DEBUG_FLAG
        ;;
    desktop)
        print_status "Running tests on desktop viewport only"
        npx playwright test --project=desktop-chromium $HEADED_FLAG $DEBUG_FLAG
        ;;
    mobile)
        print_status "Running tests on mobile viewport only"
        npx playwright test --project=mobile-portrait $HEADED_FLAG $DEBUG_FLAG
        ;;
    tablet)
        print_status "Running tests on tablet viewport only"
        npx playwright test --project=tablet-portrait $HEADED_FLAG $DEBUG_FLAG
        ;;
esac

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill server if we started it
if [ -f .server.pid ]; then
    SERVER_PID=$(cat .server.pid)
    print_status "Stopping development server (PID: $SERVER_PID)"
    kill $SERVER_PID 2>/dev/null || true
    rm .server.pid
fi

# Show report if requested
if [ "$SHOW_REPORT" = true ]; then
    print_status "Opening test report"
    npx playwright show-report
fi

# Final status
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "All tests completed successfully!"
    echo ""
    print_status "Screenshots and videos saved to: test-results/"
    print_status "View HTML report with: npx playwright show-report"
else
    print_error "Some tests failed (exit code: $TEST_EXIT_CODE)"
    echo ""
    print_status "Check test-results/ directory for failure details"
    print_status "Run with --debug flag for interactive debugging"
fi

exit $TEST_EXIT_CODE