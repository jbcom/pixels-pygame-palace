# Comprehensive Playwright Testing Guide

## 🚨 Critical Error Prevention Suite

This testing suite implements comprehensive end-to-end testing across multiple resolutions to catch runtime errors before they reach users. The suite was designed in response to critical runtime errors that weren't caught by existing tests.

## Testing Stack
- **E2E Testing**: Playwright with multi-resolution viewport testing
- **Error Detection**: Comprehensive runtime error monitoring
- **Visual Testing**: Screenshot-based verification across resolutions
- **Performance Monitoring**: Animation and load time testing
- **Unit Testing**: Vitest + @testing-library/react (legacy)
- **Integration Testing**: Vitest + Pyodide fixtures (legacy)
- **Coverage**: c8 (legacy)
- **Mocking**: MSW (legacy)

## Directory Structure
```
tests/
├── e2e/                                    # Comprehensive E2E test suite
│   ├── global-setup.ts                   # Global test initialization
│   ├── utils/
│   │   ├── error-detection.ts            # Runtime error monitoring
│   │   └── wizard-actions.ts             # Wizard navigation utilities
│   ├── smoke-tests.spec.ts               # Basic page loads & error detection
│   ├── wizard-flow-tests.spec.ts         # Complete wizard interactions
│   ├── wysiwyg-editor-tests.spec.ts      # Drag-drop & editor functionality
│   ├── asset-browser-tests.spec.ts       # Asset loading & browsing
│   ├── pixel-animation-tests.spec.ts     # Mascot animations & minimize/restore
│   └── run-comprehensive-tests.ts        # Test suite runner
├── setup.ts                              # Global test setup (legacy)
├── fixtures/                             # Legacy fixtures
├── unit/                                 # Legacy unit tests
├── integration/                          # Legacy integration tests
└── responsive-wizard.test.tsx            # Legacy responsive tests

```

## 🎯 Critical Error Detection
- **Vite error overlays** - Catches build and compilation errors
- **JavaScript runtime errors** - Uncaught exceptions and type errors  
- **Import/export failures** - Missing modules and broken dependencies
- **Network failures** - Failed API calls and asset loading
- **Component render errors** - React component failures and crashes

## 📱 Multi-Resolution Testing
- **Desktop** (1920x1080) - Full desktop experience
- **Tablet Portrait** (768x1024) - iPad-style layout
- **Tablet Landscape** (1024x768) - Landscape tablet usage
- **Mobile Portrait** (375x667) - iPhone 8 dimensions
- **Mobile Landscape** (667x375) - Phone landscape mode
- **Modern Mobile** (iPhone 12) - Current mobile standards

## Running Comprehensive Tests

### Quick Start Commands
```bash
# Run all critical tests (fastest - ~5 minutes)
npx tsx tests/e2e/run-comprehensive-tests.ts --critical

# Run all tests with UI visible (development)
npx tsx tests/e2e/run-comprehensive-tests.ts --headed

# Run specific test suite
npx playwright test smoke-tests.spec.ts
npx playwright test wizard-flow-tests.spec.ts
npx playwright test wysiwyg-editor-tests.spec.ts
```

### Comprehensive Test Runner
```bash
# Use the comprehensive test runner
npx tsx tests/e2e/run-comprehensive-tests.ts

# Options:
--critical      # Only critical tests (~5 minutes)
--high         # Critical + high priority tests (~10 minutes)  
--headed       # Show browser UI during tests
--suite <name> # Run specific suite
--project <browser> # Run on specific browser
```

### Browser-Specific Testing
```bash
# Test specific browsers/devices
npx playwright test --project=desktop-chromium
npx playwright test --project=mobile-portrait
npx playwright test --project=tablet-landscape
```

### Legacy Test Commands
```bash
# Legacy unit tests
npx vitest run

# Legacy test UI
npx vitest --ui

# Legacy coverage
npx vitest run --coverage
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)
Test individual components in isolation:
- **dialogue-engine.test.ts**: Yarn dialogue loading, context management, user profile sync
- **pygame-components.test.ts**: Component structure, variants, parameter validation
- **scene-generator.test.ts**: Python code generation, template replacement

### 2. Integration Tests (`tests/integration/`)
Test component interactions and Pyodide execution:
- **component-execution.test.ts**: Python code execution in browser environment
- **asset-binding.test.ts**: Asset path resolution and mapping
- **pyodide-fixture.ts**: Helpers for testing Python/JavaScript interop

### 3. E2E Tests (`tests/e2e/`)
Test complete user workflows:
- **wizard-flow.test.ts**: Conversational UI, component selection, game generation
- **editor-flow.test.ts**: Visual editor, drag-and-drop, property editing
- **game-execution.test.ts**: Runtime behavior, input handling, game state

## Key Features

### Test IDs
All interactive elements should have `data-testid` attributes:
```tsx
// Pattern: {action}-{target}
<button data-testid="button-select-jump">Jump</button>
<input data-testid="input-jump-force" />

// Dynamic elements: {type}-{description}-{id}
<div data-testid={`component-${component.id}-instance`}>
```

### Fake Pygame Module
`tests/fixtures/fake-pygame.py` provides a mock pygame implementation for testing Python components without requiring actual pygame installation.

### Pyodide Test Fixture
`tests/integration/pyodide-fixture.ts` provides utilities for testing Python execution:
```typescript
const pyodideContext = await createPyodideTestContext();
const result = await testComponentExecution(pyodide, componentCode, setupCode);
```

## Coverage Reports
After running coverage tests, reports are available in:
- Terminal output (text)
- `coverage/index.html` (HTML report)
- `coverage/coverage.json` (JSON data)

## Best Practices

1. **Use parallel test execution** when tests are independent
2. **Mock external dependencies** (fetch, localStorage, etc.)
3. **Use descriptive test names** that explain the expected behavior
4. **Keep tests focused** - one concept per test
5. **Use data-testid** consistently for E2E test reliability
6. **Clean up after tests** - reset state, clear mocks

## Troubleshooting

### Common Issues

1. **"Cannot find dependency 'jsdom'"**
   - Solution: Run `npm install jsdom`

2. **Pyodide tests failing**
   - Ensure Pyodide is properly loaded in the test environment
   - Check that fake-pygame module is correctly injected

3. **E2E tests timing out**
   - Increase timeout in playwright.config.ts
   - Ensure the app is running on port 5000

4. **Coverage not generating**
   - Verify c8 is installed
   - Check coverage exclusion patterns in vitest.config.ts

## CI/CD Integration

To integrate with CI/CD pipelines:
```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm ci
  
- name: Run unit tests
  run: npx vitest run --coverage
  
- name: Run E2E tests
  run: npx playwright test
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Future Enhancements

- [ ] Add visual regression testing with Playwright screenshots
- [ ] Implement performance benchmarks for Python execution
- [ ] Add accessibility testing with @testing-library
- [ ] Create smoke test suite for critical paths
- [ ] Add mutation testing for better coverage quality

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass before committing
3. Add appropriate data-testid attributes for E2E testing
4. Update this guide if adding new test categories or tools