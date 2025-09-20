// Pyodide Test Fixture
// Provides utilities for testing Python code execution in the browser

export interface PyodideTestContext {
  loadPyodide: () => Promise<any>;
  executePython: (code: string) => Promise<any>;
  installPackages: (packages: string[]) => Promise<void>;
}

// Mock Pyodide loader for testing
export async function createPyodideTestContext(): Promise<PyodideTestContext> {
  // In a real test environment, this would load actual Pyodide
  // For unit tests, we'll mock the behavior
  
  const mockPyodide = {
    runPython: (code: string) => {
      // Simple mock execution
      if (code.includes('import pygame')) {
        return { success: true };
      }
      if (code.includes('player =')) {
        return { x: 0, y: 0, health: 100 };
      }
      return {};
    },
    loadPackage: async (pkg: string) => {
      console.log(`Loading package: ${pkg}`);
    },
    globals: {
      get: (key: string) => {
        return null;
      },
      set: (key: string, value: any) => {
        console.log(`Setting global: ${key}`);
      }
    }
  };
  
  return {
    loadPyodide: async () => mockPyodide,
    executePython: async (code: string) => {
      return mockPyodide.runPython(code);
    },
    installPackages: async (packages: string[]) => {
      for (const pkg of packages) {
        await mockPyodide.loadPackage(pkg);
      }
    }
  };
}

// Helper to inject fake pygame module
export function injectFakePygame(pyodide: any): void {
  const fakePygameCode = `
import sys
from types import ModuleType

# Create fake pygame module
pygame = ModuleType('pygame')
pygame.init = lambda: None
pygame.quit = lambda: None
pygame.QUIT = 12
pygame.KEYDOWN = 2
pygame.KEYUP = 3

# Add key constants
class Key:
    K_SPACE = 32
    K_LEFT = 276
    K_RIGHT = 277
    K_UP = 273
    K_DOWN = 274
    K_a = 97
    K_d = 100
    K_w = 119
    K_s = 115

pygame.key = Key()

# Add to sys.modules
sys.modules['pygame'] = pygame
`;
  
  pyodide.runPython(fakePygameCode);
}

// Helper to test component code execution
export async function testComponentExecution(
  pyodide: any,
  componentCode: string,
  setupCode: string = ''
): Promise<any> {
  // Run setup code first
  if (setupCode) {
    pyodide.runPython(setupCode);
  }
  
  // Wrap component code in a testable function
  const testCode = `
${componentCode}

# Return test results
result = {
    'success': True,
    'player': player if 'player' in locals() else None,
    'enemies': enemies if 'enemies' in locals() else [],
    'projectiles': projectiles if 'projectiles' in locals() else []
}
result
`;
  
  return pyodide.runPython(testCode);
}