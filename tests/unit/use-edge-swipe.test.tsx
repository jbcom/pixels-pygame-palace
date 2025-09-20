import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEdgeSwipe } from '@/hooks/use-edge-swipe';
import type { SwipeEventData } from 'react-swipeable';

// Mock react-swipeable
vi.mock('react-swipeable', () => ({
  useSwipeable: vi.fn((handlers) => ({
    ...handlers,
    ref: vi.fn()
  }))
}));

describe('useEdgeSwipe Hook', () => {
  const mockOnEdgeSwipe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should return swipe handlers', () => {
      const { result } = renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe
      }));

      expect(result.current).toBeDefined();
      expect(result.current).toHaveProperty('ref');
    });

    it('should not trigger when disabled', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        enabled: false
      }));

      // Simulate swipe from top edge
      const eventData: SwipeEventData = {
        initial: [512, 10],
        first: true,
        dir: 'Down',
        deltaX: 0,
        deltaY: 100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, 1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown(eventData);
        }
      });

      expect(mockOnEdgeSwipe).not.toHaveBeenCalled();
    });
  });

  describe('Edge Detection - Top', () => {
    it('should detect swipe from top edge', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 50
      }));

      const eventData: SwipeEventData = {
        initial: [512, 30], // Within 50px of top
        first: true,
        dir: 'Down',
        deltaX: 0,
        deltaY: 100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, 1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown(eventData);
        }
      });

      expect(mockOnEdgeSwipe).toHaveBeenCalledWith('top');
    });

    it('should not detect swipe when not from edge', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 50
      }));

      const eventData: SwipeEventData = {
        initial: [512, 100], // Beyond threshold
        first: true,
        dir: 'Down',
        deltaX: 0,
        deltaY: 100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, 1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown(eventData);
        }
      });

      expect(mockOnEdgeSwipe).not.toHaveBeenCalled();
    });
  });

  describe('Edge Detection - Bottom', () => {
    it('should detect swipe from bottom edge', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 50
      }));

      const eventData: SwipeEventData = {
        initial: [512, 730], // Within 50px of bottom (768 - 50)
        first: true,
        dir: 'Up',
        deltaX: 0,
        deltaY: -100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, -1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedUp) {
          swipeHandlers.onSwipedUp(eventData);
        }
      });

      expect(mockOnEdgeSwipe).toHaveBeenCalledWith('bottom');
    });
  });

  describe('Edge Detection - Left', () => {
    it('should detect swipe from left edge', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 50
      }));

      const eventData: SwipeEventData = {
        initial: [30, 384], // Within 50px of left
        first: true,
        dir: 'Right',
        deltaX: 100,
        deltaY: 0,
        absX: 100,
        absY: 0,
        velocity: 1,
        vxvy: [1, 0],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedRight) {
          swipeHandlers.onSwipedRight(eventData);
        }
      });

      expect(mockOnEdgeSwipe).toHaveBeenCalledWith('left');
    });
  });

  describe('Edge Detection - Right', () => {
    it('should detect swipe from right edge', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 50
      }));

      const eventData: SwipeEventData = {
        initial: [990, 384], // Within 50px of right (1024 - 50)
        first: true,
        dir: 'Left',
        deltaX: -100,
        deltaY: 0,
        absX: 100,
        absY: 0,
        velocity: 1,
        vxvy: [-1, 0],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedLeft) {
          swipeHandlers.onSwipedLeft(eventData);
        }
      });

      expect(mockOnEdgeSwipe).toHaveBeenCalledWith('right');
    });
  });

  describe('Edge Threshold', () => {
    it('should use custom edge threshold', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 100
      }));

      const eventData: SwipeEventData = {
        initial: [512, 80], // Within 100px of top
        first: true,
        dir: 'Down',
        deltaX: 0,
        deltaY: 100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, 1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown(eventData);
        }
      });

      expect(mockOnEdgeSwipe).toHaveBeenCalledWith('top');
    });

    it('should use default threshold of 50px', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe
      }));

      const eventData: SwipeEventData = {
        initial: [512, 60], // Beyond default 50px
        first: true,
        dir: 'Down',
        deltaX: 0,
        deltaY: 100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, 1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown(eventData);
        }
      });

      expect(mockOnEdgeSwipe).not.toHaveBeenCalled();
    });
  });

  describe('Window Resize', () => {
    it('should update edge detection after window resize', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 50
      }));

      // Resize window
      act(() => {
        (window as any).innerWidth = 800;
        (window as any).innerHeight = 600;
        window.dispatchEvent(new Event('resize'));
      });

      const eventData: SwipeEventData = {
        initial: [400, 570], // Within 50px of new bottom (600 - 50)
        first: true,
        dir: 'Up',
        deltaX: 0,
        deltaY: -100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, -1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedUp) {
          swipeHandlers.onSwipedUp(eventData);
        }
      });

      expect(mockOnEdgeSwipe).toHaveBeenCalledWith('bottom');
    });
  });

  describe('Multiple Swipe Handling', () => {
    it('should handle multiple swipes in sequence', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe,
        edgeThreshold: 50
      }));

      // First swipe from top
      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown({
            initial: [512, 30],
            first: true,
            dir: 'Down',
            deltaX: 0,
            deltaY: 100,
            absX: 0,
            absY: 100,
            velocity: 1,
            vxvy: [0, 1],
            event: new TouchEvent('touchend')
          } as SwipeEventData);
        }
      });

      // Second swipe from left
      act(() => {
        if (swipeHandlers.onSwipedRight) {
          swipeHandlers.onSwipedRight({
            initial: [30, 384],
            first: true,
            dir: 'Right',
            deltaX: 100,
            deltaY: 0,
            absX: 100,
            absY: 0,
            velocity: 1,
            vxvy: [1, 0],
            event: new TouchEvent('touchend')
          } as SwipeEventData);
        }
      });

      expect(mockOnEdgeSwipe).toHaveBeenCalledTimes(2);
      expect(mockOnEdgeSwipe).toHaveBeenNthCalledWith(1, 'top');
      expect(mockOnEdgeSwipe).toHaveBeenNthCalledWith(2, 'left');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing event data gracefully', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe
      }));

      // Call with undefined event data
      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown(undefined as any);
        }
      });

      expect(mockOnEdgeSwipe).not.toHaveBeenCalled();
    });

    it('should handle missing initial coordinates', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        onEdgeSwipe: mockOnEdgeSwipe
      }));

      const eventData: SwipeEventData = {
        initial: undefined as any,
        first: true,
        dir: 'Down',
        deltaX: 0,
        deltaY: 100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, 1],
        event: new TouchEvent('touchend')
      };

      act(() => {
        if (swipeHandlers.onSwipedDown) {
          swipeHandlers.onSwipedDown(eventData);
        }
      });

      expect(mockOnEdgeSwipe).not.toHaveBeenCalled();
    });

    it('should work without onEdgeSwipe callback', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });

      renderHook(() => useEdgeSwipe({
        edgeThreshold: 50
      }));

      const eventData: SwipeEventData = {
        initial: [512, 30],
        first: true,
        dir: 'Down',
        deltaX: 0,
        deltaY: 100,
        absX: 0,
        absY: 100,
        velocity: 1,
        vxvy: [0, 1],
        event: new TouchEvent('touchend')
      };

      // Should not throw error
      expect(() => {
        act(() => {
          if (swipeHandlers.onSwipedDown) {
            swipeHandlers.onSwipedDown(eventData);
          }
        });
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should maintain swipe state across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ threshold }) => useEdgeSwipe({
          onEdgeSwipe: mockOnEdgeSwipe,
          edgeThreshold: threshold
        }),
        { initialProps: { threshold: 50 } }
      );

      const initialResult = result.current;
      
      // Re-render with same props
      rerender({ threshold: 50 });
      
      expect(result.current).toBe(initialResult);
    });

    it('should update when threshold changes', () => {
      const { result, rerender } = renderHook(
        ({ threshold }) => useEdgeSwipe({
          onEdgeSwipe: mockOnEdgeSwipe,
          edgeThreshold: threshold
        }),
        { initialProps: { threshold: 50 } }
      );

      const initialResult = result.current;
      
      // Re-render with different threshold
      rerender({ threshold: 100 });
      
      expect(result.current).not.toBe(initialResult);
    });
  });
});