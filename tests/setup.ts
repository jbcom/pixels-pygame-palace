import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

global.localStorage = localStorageMock;

// Mock fetch for dialogue files
global.fetch = vi.fn();

// Setup canvas mocking for Pyodide tests
HTMLCanvasElement.prototype.getContext = vi.fn();

// Mock global Pyodide
(global as any).loadPyodide = vi.fn().mockResolvedValue({
  runPython: vi.fn((code: string) => {
    // Return basic mock results for common operations
    if (code.includes('import pygame')) {
      return { success: true };
    }
    if (code.includes('2 + 2')) {
      return 4;
    }
    return {};
  }),
  runPythonAsync: vi.fn(async (code: string) => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return {};
  }),
  loadPackage: vi.fn(),
  globals: {
    get: vi.fn(),
    set: vi.fn()
  }
});

// Mock PythonRunner from @/lib/python/runner
vi.mock('@/lib/python/runner', () => ({
  PythonRunner: vi.fn().mockImplementation(() => ({
    runSnippet: vi.fn().mockResolvedValue({ output: 'Success', error: '' }),
    runProject: vi.fn().mockResolvedValue({ output: 'Success', error: '' }),
    setInputValues: vi.fn()
  })),
  createPythonRunner: vi.fn().mockResolvedValue({
    runSnippet: vi.fn().mockResolvedValue({ output: 'Success', error: '' }),
    runProject: vi.fn().mockResolvedValue({ output: 'Success', error: '' }),
    setInputValues: vi.fn()
  })
}));

// Mock PythonExecutor (if exists in the codebase)
vi.mock('@/lib/python-executor', () => ({
  PythonExecutor: vi.fn().mockImplementation(() => ({
    execute: vi.fn((code: string) => {
      // Return mock results based on code patterns
      if (code.includes('2 + 2')) {
        return { result: 4 };
      }
      if (code.includes('import pygame')) {
        return { success: true };
      }
      return { result: null };
    }),
    executeAsync: vi.fn(async (code: string) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { result: null };
    })
  }))
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: () => []
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 0);
  return 0;
});

global.cancelAnimationFrame = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// Add afterEach for cleanup
afterEach(() => {
  vi.restoreAllMocks();
});