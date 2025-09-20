# TypeScript-Python Pygame Builder - Testing Infrastructure Guide

## Overview
A comprehensive three-layer testing strategy has been implemented for the TypeScript-Python pygame builder, covering unit tests, integration tests, and end-to-end tests.

## Testing Stack
- **Unit Testing**: Vitest + @testing-library/react  
- **Integration Testing**: Vitest + Pyodide fixtures
- **E2E Testing**: Playwright
- **Coverage**: c8
- **Mocking**: MSW (Mock Service Worker)

## Directory Structure
```
tests/
├── setup.ts                      # Global test setup (mocks, environment)
├── fixtures/                     
│   └── fake-pygame.py           # Mock pygame module for Python testing
├── unit/                        
│   ├── dialogue-engine.test.ts  # Tests dialogue system & Yarn integration
│   ├── pygame-components.test.ts # Tests component structure & variants
│   └── scene-generator.test.ts  # Tests Python code generation
├── integration/                 
│   ├── pyodide-fixture.ts      # Pyodide test helpers
│   ├── component-execution.test.ts # Tests Python execution in browser
│   └── asset-binding.test.ts   # Tests asset path resolution
└── e2e/                        
    ├── wizard-flow.test.ts      # Tests conversational wizard UX
    ├── editor-flow.test.ts      # Tests visual editor functionality
    └── game-execution.test.ts   # Tests actual game runtime

```

## Running Tests

### Using the test runner scripts:
```bash
# Run unit tests
./run-tests.sh unit
# or
node run-tests.js unit

# Open test UI
./run-tests.sh ui
# or
node run-tests.js ui

# Run with coverage
./run-tests.sh coverage
# or
node run-tests.js coverage

# Run E2E tests
./run-tests.sh e2e
# or
node run-tests.js e2e

# Run all tests
./run-tests.sh all
# or
node run-tests.js all
```

### Using npx directly:
```bash
# Unit tests
npx vitest run

# Test UI
npx vitest --ui

# Coverage
npx vitest run --coverage

# E2E tests  
npx playwright test

# Specific test file
npx vitest run tests/unit/pygame-components.test.ts
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