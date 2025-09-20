import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GameCanvas from '@/components/game-canvas';
import { simulatePygame, setCanvasContext, flushFrameBuffer } from '@/lib/pygame-simulation';

// Mock pygame-simulation module
vi.mock('@/lib/pygame-simulation', () => ({
  simulatePygame: vi.fn(() => ({
    fps: 60,
    objects: [
      { type: 'circle', x: 100, y: 100, color: '#FF0000', size: 20 },
      { type: 'rect', x: 200, y: 200, color: '#00FF00', size: 40 }
    ]
  })),
  setCanvasContext: vi.fn(),
  flushFrameBuffer: vi.fn()
}));

describe('GameCanvas Component', () => {
  const mockPyodide = {
    runPython: vi.fn(),
    runPythonAsync: vi.fn(),
    loadPackage: vi.fn(),
    globals: {
      get: vi.fn(),
      set: vi.fn()
    }
  };

  const defaultProps = {
    code: 'import pygame\npygame.init()',
    pyodide: mockPyodide,
    isRunning: true
  };

  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock canvas context
    mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      font: '',
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline,
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 800,
        height: 600
      })),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn()
    };
    
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render canvas element', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const canvas = screen.getByTestId('game-canvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas.tagName).toBe('CANVAS');
    });

    it('should set default canvas dimensions', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const canvas = screen.getByTestId('game-canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('should display FPS counter', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const fpsCounter = screen.getByTestId('fps-counter');
      expect(fpsCounter).toBeInTheDocument();
      expect(fpsCounter).toHaveTextContent(/FPS:/);
    });

    it('should display object count', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const objectCount = screen.getByTestId('object-count');
      expect(objectCount).toBeInTheDocument();
      expect(objectCount).toHaveTextContent(/Objects:/);
    });

    it('should show rendering mode badge', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const renderingMode = screen.getByTestId('rendering-mode');
      expect(renderingMode).toBeInTheDocument();
    });
  });

  describe('Pygame Detection', () => {
    it('should detect pygame code and initialize real rendering', async () => {
      render(<GameCanvas {...defaultProps} />);
      
      await waitFor(() => {
        expect(setCanvasContext).toHaveBeenCalledWith(mockContext);
      });
    });

    it('should not initialize pygame for non-pygame code', () => {
      render(<GameCanvas {...defaultProps} code="print('Hello')" />);
      
      expect(setCanvasContext).not.toHaveBeenCalled();
    });

    it('should handle "import pygame" syntax', async () => {
      render(<GameCanvas {...defaultProps} code="import pygame" />);
      
      await waitFor(() => {
        expect(setCanvasContext).toHaveBeenCalledWith(mockContext);
      });
    });

    it('should handle "from pygame import" syntax', async () => {
      render(<GameCanvas {...defaultProps} code="from pygame import display" />);
      
      await waitFor(() => {
        expect(setCanvasContext).toHaveBeenCalledWith(mockContext);
      });
    });
  });

  describe('Canvas Rendering', () => {
    it('should clear canvas on initialization', async () => {
      render(<GameCanvas {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      });
    });

    it('should set white background', async () => {
      render(<GameCanvas {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockContext.fillStyle).toBe('white');
        expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
      });
    });

    it('should render simulated objects when not running', () => {
      render(<GameCanvas {...defaultProps} isRunning={false} />);
      
      // Should call simulatePygame for non-running state
      expect(simulatePygame).toHaveBeenCalledWith(defaultProps.code);
    });

    it('should draw circles from simulation', async () => {
      render(<GameCanvas {...defaultProps} isRunning={false} />);
      
      await waitFor(() => {
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.arc).toHaveBeenCalledWith(100, 100, 20, 0, 2 * Math.PI);
        expect(mockContext.fill).toHaveBeenCalled();
      });
    });

    it('should draw rectangles from simulation', async () => {
      render(<GameCanvas {...defaultProps} isRunning={false} />);
      
      await waitFor(() => {
        expect(mockContext.fillRect).toHaveBeenCalledWith(200, 200, 40, 40);
      });
    });
  });

  describe('Running State', () => {
    it('should enable real rendering when isRunning is true', async () => {
      render(<GameCanvas {...defaultProps} isRunning={true} />);
      
      await waitFor(() => {
        expect(setCanvasContext).toHaveBeenCalledWith(mockContext);
        expect(screen.getByTestId('rendering-mode')).toHaveTextContent('Real');
      });
    });

    it('should use simulation when isRunning is false', () => {
      render(<GameCanvas {...defaultProps} isRunning={false} />);
      
      expect(screen.getByTestId('rendering-mode')).toHaveTextContent('Simulation');
      expect(simulatePygame).toHaveBeenCalled();
    });

    it('should cleanup canvas context on unmount', () => {
      const { unmount } = render(<GameCanvas {...defaultProps} />);
      
      unmount();
      
      expect(setCanvasContext).toHaveBeenCalledWith(null);
    });
  });

  describe('FPS Tracking', () => {
    it('should update FPS display', async () => {
      vi.useFakeTimers();
      render(<GameCanvas {...defaultProps} />);
      
      const fpsCounter = screen.getByTestId('fps-counter');
      
      // Advance timers to trigger FPS update
      vi.advanceTimersByTime(16);
      
      await waitFor(() => {
        expect(fpsCounter.textContent).toMatch(/FPS: \d+/);
      });
      
      vi.useRealTimers();
    });

    it('should cap FPS at 60', async () => {
      render(<GameCanvas {...defaultProps} />);
      
      const fpsCounter = screen.getByTestId('fps-counter');
      
      await waitFor(() => {
        const fpsText = fpsCounter.textContent || '';
        const fps = parseInt(fpsText.match(/\d+/)?.[0] || '0');
        expect(fps).toBeLessThanOrEqual(60);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing canvas context gracefully', () => {
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
      
      render(<GameCanvas {...defaultProps} />);
      
      const renderingMode = screen.getByTestId('rendering-mode');
      expect(renderingMode).toHaveTextContent('Error');
    });

    it('should handle simulation errors', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      vi.mocked(simulatePygame).mockImplementation(() => {
        throw new Error('Simulation error');
      });
      
      expect(() => {
        render(<GameCanvas {...defaultProps} isRunning={false} />);
      }).not.toThrow();
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle real rendering errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      vi.mocked(setCanvasContext).mockImplementation(() => {
        throw new Error('Rendering error');
      });
      
      render(<GameCanvas {...defaultProps} />);
      
      expect(screen.getByTestId('rendering-mode')).toHaveTextContent('Simulation');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Code Changes', () => {
    it('should update simulation when code changes', () => {
      const { rerender } = render(<GameCanvas {...defaultProps} isRunning={false} />);
      
      const newCode = 'import pygame\nscreen = pygame.display.set_mode((640, 480))';
      rerender(<GameCanvas {...defaultProps} code={newCode} isRunning={false} />);
      
      expect(simulatePygame).toHaveBeenCalledWith(newCode);
    });

    it('should reinitialize canvas when switching to pygame code', () => {
      const { rerender } = render(<GameCanvas {...defaultProps} code="print('test')" />);
      
      expect(setCanvasContext).not.toHaveBeenCalled();
      
      rerender(<GameCanvas {...defaultProps} code="import pygame" />);
      
      expect(setCanvasContext).toHaveBeenCalledWith(mockContext);
    });
  });

  describe('UI Controls', () => {
    it('should display expand button', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const expandButton = screen.getByTestId('expand-canvas');
      expect(expandButton).toBeInTheDocument();
    });

    it('should display clear button', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const clearButton = screen.getByTestId('clear-canvas');
      expect(clearButton).toBeInTheDocument();
    });

    it('should clear canvas when clear button is clicked', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const clearButton = screen.getByTestId('clear-canvas');
      fireEvent.click(clearButton);
      
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('Alert Display', () => {
    it('should show alert when canvas context is unavailable', () => {
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
      
      render(<GameCanvas {...defaultProps} />);
      
      const alert = screen.getByTestId('canvas-error-alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Unable to get 2D rendering context/);
    });
  });

  describe('Performance', () => {
    it('should cleanup intervals on unmount', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<GameCanvas {...defaultProps} />);
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should throttle frame updates to 60 FPS', () => {
      vi.useFakeTimers();
      
      render(<GameCanvas {...defaultProps} />);
      
      // Advance by less than 16ms (60 FPS = ~16.67ms per frame)
      vi.advanceTimersByTime(10);
      
      // Should not trigger multiple renders in rapid succession
      expect(mockContext.clearRect).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const canvas = screen.getByTestId('game-canvas');
      expect(canvas).toHaveAttribute('aria-label', 'Game rendering canvas');
    });

    it('should indicate running state for screen readers', () => {
      render(<GameCanvas {...defaultProps} />);
      
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });
  });
});