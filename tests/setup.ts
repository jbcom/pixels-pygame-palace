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

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});