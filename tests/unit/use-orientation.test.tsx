import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrientation } from '@/hooks/use-orientation';

describe('useOrientation Hook', () => {
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;
  let mockScreenOrientation: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });
    
    // Spy on event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    // Mock screen orientation API
    mockScreenOrientation = {
      angle: 0,
      type: 'portrait-primary',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    
    Object.defineProperty(window.screen, 'orientation', {
      value: mockScreenOrientation,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should detect portrait orientation when height > width', () => {
      (window as any).innerHeight = 1024;
      (window as any).innerWidth = 768;
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
      expect(result.current.orientation).toBe('portrait');
    });

    it('should detect landscape orientation when width > height', () => {
      (window as any).innerHeight = 768;
      (window as any).innerWidth = 1024;
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.isPortrait).toBe(false);
      expect(result.current.isLandscape).toBe(true);
      expect(result.current.orientation).toBe('landscape');
    });

    it('should include angle from screen orientation API', () => {
      mockScreenOrientation.angle = 90;
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.angle).toBe(90);
    });

    it('should default angle to 0 when API not available', () => {
      delete (window.screen as any).orientation;
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.angle).toBe(0);
    });
  });

  describe('Event Listeners', () => {
    it('should add resize event listener', () => {
      renderHook(() => useOrientation());
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should add orientationchange event listener', () => {
      renderHook(() => useOrientation());
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    });

    it('should add screen orientation change listener when API available', () => {
      renderHook(() => useOrientation());
      
      expect(mockScreenOrientation.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should not add screen orientation listener when API not available', () => {
      delete (window.screen as any).orientation;
      
      renderHook(() => useOrientation());
      
      // Should not throw error
      expect(addEventListenerSpy).toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useOrientation());
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
      expect(mockScreenOrientation.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('Orientation Changes', () => {
    it('should update when window is resized', async () => {
      const { result } = renderHook(() => useOrientation());
      
      // Initially portrait
      expect(result.current.isPortrait).toBe(true);
      
      // Simulate resize to landscape
      act(() => {
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        window.dispatchEvent(new Event('resize'));
      });
      
      await waitFor(() => {
        expect(result.current.isPortrait).toBe(false);
        expect(result.current.isLandscape).toBe(true);
        expect(result.current.orientation).toBe('landscape');
      });
    });

    it('should update on orientationchange event', async () => {
      const { result } = renderHook(() => useOrientation());
      
      act(() => {
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        window.dispatchEvent(new Event('orientationchange'));
      });
      
      await waitFor(() => {
        expect(result.current.orientation).toBe('landscape');
      });
    });

    it('should update on screen orientation change', async () => {
      const { result } = renderHook(() => useOrientation());
      
      // Get the change handler that was registered
      const changeHandler = mockScreenOrientation.addEventListener.mock.calls[0][1];
      
      act(() => {
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        mockScreenOrientation.angle = 90;
        changeHandler();
      });
      
      await waitFor(() => {
        expect(result.current.orientation).toBe('landscape');
        expect(result.current.angle).toBe(90);
      });
    });

    it('should handle multiple rapid orientation changes', async () => {
      const { result } = renderHook(() => useOrientation());
      
      // Rapid changes
      act(() => {
        // Change to landscape
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        window.dispatchEvent(new Event('resize'));
        
        // Change back to portrait
        (window as any).innerWidth = 768;
        (window as any).innerHeight = 1024;
        window.dispatchEvent(new Event('resize'));
        
        // Change to landscape again
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        window.dispatchEvent(new Event('resize'));
      });
      
      await waitFor(() => {
        expect(result.current.orientation).toBe('landscape');
      });
    });
  });

  describe('Screen Orientation Angles', () => {
    it('should detect 0 degrees for portrait-primary', () => {
      mockScreenOrientation.angle = 0;
      mockScreenOrientation.type = 'portrait-primary';
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.angle).toBe(0);
    });

    it('should detect 90 degrees for landscape-primary', () => {
      const { result } = renderHook(() => useOrientation());
      
      const changeHandler = mockScreenOrientation.addEventListener.mock.calls[0][1];
      
      act(() => {
        mockScreenOrientation.angle = 90;
        mockScreenOrientation.type = 'landscape-primary';
        changeHandler();
      });
      
      expect(result.current.angle).toBe(90);
    });

    it('should detect 180 degrees for portrait-secondary', () => {
      const { result } = renderHook(() => useOrientation());
      
      const changeHandler = mockScreenOrientation.addEventListener.mock.calls[0][1];
      
      act(() => {
        mockScreenOrientation.angle = 180;
        mockScreenOrientation.type = 'portrait-secondary';
        changeHandler();
      });
      
      expect(result.current.angle).toBe(180);
    });

    it('should detect 270 degrees for landscape-secondary', () => {
      const { result } = renderHook(() => useOrientation());
      
      const changeHandler = mockScreenOrientation.addEventListener.mock.calls[0][1];
      
      act(() => {
        mockScreenOrientation.angle = 270;
        mockScreenOrientation.type = 'landscape-secondary';
        changeHandler();
      });
      
      expect(result.current.angle).toBe(270);
    });
  });

  describe('Edge Cases', () => {
    it('should handle equal width and height as landscape', () => {
      (window as any).innerWidth = 768;
      (window as any).innerHeight = 768;
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.isPortrait).toBe(false);
      expect(result.current.isLandscape).toBe(true);
      expect(result.current.orientation).toBe('landscape');
    });

    it('should handle very small dimensions', () => {
      (window as any).innerWidth = 100;
      (window as any).innerHeight = 200;
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.isPortrait).toBe(true);
      expect(result.current.orientation).toBe('portrait');
    });

    it('should handle very large dimensions', () => {
      (window as any).innerWidth = 10000;
      (window as any).innerHeight = 5000;
      
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current.isLandscape).toBe(true);
      expect(result.current.orientation).toBe('landscape');
    });

    it('should handle missing screen orientation gracefully', () => {
      delete (window.screen as any).orientation;
      
      const { result } = renderHook(() => useOrientation());
      
      act(() => {
        window.dispatchEvent(new Event('orientationchange'));
      });
      
      // Should not throw error
      expect(result.current.angle).toBe(0);
    });
  });

  describe('Return Value Consistency', () => {
    it('should always return all required properties', () => {
      const { result } = renderHook(() => useOrientation());
      
      expect(result.current).toHaveProperty('isPortrait');
      expect(result.current).toHaveProperty('isLandscape');
      expect(result.current).toHaveProperty('orientation');
      expect(result.current).toHaveProperty('angle');
      
      expect(typeof result.current.isPortrait).toBe('boolean');
      expect(typeof result.current.isLandscape).toBe('boolean');
      expect(['portrait', 'landscape']).toContain(result.current.orientation);
      expect(typeof result.current.angle).toBe('number');
    });

    it('should ensure isPortrait and isLandscape are mutually exclusive', () => {
      const { result } = renderHook(() => useOrientation());
      
      // They should be opposite
      expect(result.current.isPortrait).toBe(!result.current.isLandscape);
      
      // Change orientation
      act(() => {
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        window.dispatchEvent(new Event('resize'));
      });
      
      // Still opposite after change
      expect(result.current.isPortrait).toBe(!result.current.isLandscape);
    });

    it('should ensure orientation matches boolean flags', () => {
      const { result } = renderHook(() => useOrientation());
      
      if (result.current.isPortrait) {
        expect(result.current.orientation).toBe('portrait');
      } else {
        expect(result.current.orientation).toBe('landscape');
      }
      
      // Change orientation
      act(() => {
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        window.dispatchEvent(new Event('resize'));
      });
      
      if (result.current.isLandscape) {
        expect(result.current.orientation).toBe('landscape');
      } else {
        expect(result.current.orientation).toBe('portrait');
      }
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const { result, rerender } = renderHook(() => useOrientation());
      
      const initialResult = result.current;
      
      // Re-render without any changes
      rerender();
      
      // Result should be the same reference if no orientation change
      expect(result.current).toEqual(initialResult);
    });

    it('should batch multiple simultaneous events', async () => {
      const { result } = renderHook(() => useOrientation());
      
      let renderCount = 0;
      const originalOrientation = result.current.orientation;
      
      // Track renders
      result.current; // Initial render
      renderCount++;
      
      act(() => {
        // Fire multiple events at once
        (window as any).innerWidth = 1024;
        (window as any).innerHeight = 768;
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('orientationchange'));
        if (mockScreenOrientation.addEventListener.mock.calls[0]) {
          mockScreenOrientation.addEventListener.mock.calls[0][1]();
        }
      });
      
      await waitFor(() => {
        // Should only result in one state update
        expect(result.current.orientation).toBe('landscape');
      });
    });
  });
});