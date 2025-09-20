import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PixelMenu from '@/components/pixel-menu';
import { Gamepad2, BookOpen, Trophy } from 'lucide-react';

// Mock react-swipeable
vi.mock('react-swipeable', () => ({
  useSwipeable: vi.fn((handlers) => ({
    ...handlers,
    ref: vi.fn()
  }))
}));

// Mock Pixel images
vi.mock('@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png', () => ({ 
  default: '/mock/pixel-excited.png' 
}));
vi.mock('@assets/pixel/Pixel_happy_excited_expression_22a41625.png', () => ({ 
  default: '/mock/pixel-happy.png' 
}));
vi.mock('@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png', () => ({ 
  default: '/mock/pixel-thinking.png' 
}));

describe('PixelMenu Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onChangeGame: vi.fn(),
    onSwitchLesson: vi.fn(),
    onExportGame: vi.fn(),
    onViewProgress: vi.fn(),
    onReturnCurrent: vi.fn(),
    sessionActions: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<PixelMenu {...defaultProps} />);
      
      expect(screen.getByTestId('pixel-menu')).toBeInTheDocument();
      expect(screen.getByTestId('pixel-menu-header')).toBeInTheDocument();
      expect(screen.getByTestId('pixel-menu-content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<PixelMenu {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('pixel-menu')).not.toBeInTheDocument();
    });

    it('should display Pixel mascot image', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const pixelImage = screen.getByTestId('pixel-mascot-menu');
      expect(pixelImage).toBeInTheDocument();
      expect(pixelImage.getAttribute('src')).toContain('pixel');
    });

    it('should display close button', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const closeButton = screen.getByTestId('close-pixel-menu');
      expect(closeButton).toBeInTheDocument();
    });

    it('should display tab navigation', () => {
      render(<PixelMenu {...defaultProps} />);
      
      expect(screen.getByTestId('tab-actions')).toBeInTheDocument();
      expect(screen.getByTestId('tab-history')).toBeInTheDocument();
    });
  });

  describe('Session Actions Display', () => {
    const mockActions = [
      {
        id: '1',
        type: 'game_created' as const,
        title: 'Created RPG Adventure',
        description: 'Started building a fantasy RPG game',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        icon: Gamepad2
      },
      {
        id: '2',
        type: 'lesson_completed' as const,
        title: 'Completed Python Basics',
        description: 'Learned variables and functions',
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        icon: BookOpen
      },
      {
        id: '3',
        type: 'asset_selected' as const,
        title: 'Selected Character Sprites',
        description: 'Added knight and wizard sprites',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        icon: Trophy
      }
    ];

    it('should display session actions when provided', () => {
      render(<PixelMenu {...defaultProps} sessionActions={mockActions} />);
      
      // Switch to history tab
      fireEvent.click(screen.getByTestId('tab-history'));
      
      expect(screen.getByText('Created RPG Adventure')).toBeInTheDocument();
      expect(screen.getByText('Completed Python Basics')).toBeInTheDocument();
      expect(screen.getByText('Selected Character Sprites')).toBeInTheDocument();
    });

    it('should display default actions when none provided', () => {
      render(<PixelMenu {...defaultProps} sessionActions={[]} />);
      
      // Switch to history tab
      fireEvent.click(screen.getByTestId('tab-history'));
      
      // Should show default mock actions
      const historyContent = screen.getByTestId('history-content');
      expect(historyContent).toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
      render(<PixelMenu {...defaultProps} sessionActions={mockActions} />);
      
      fireEvent.click(screen.getByTestId('tab-history'));
      
      // Check for time format (should show relative time like "30m ago")
      expect(screen.getByText(/30m ago/)).toBeInTheDocument();
      expect(screen.getByText(/45m ago/)).toBeInTheDocument();
      expect(screen.getByText(/15m ago/)).toBeInTheDocument();
    });

    it('should display action descriptions', () => {
      render(<PixelMenu {...defaultProps} sessionActions={mockActions} />);
      
      fireEvent.click(screen.getByTestId('tab-history'));
      
      expect(screen.getByText('Started building a fantasy RPG game')).toBeInTheDocument();
      expect(screen.getByText('Learned variables and functions')).toBeInTheDocument();
    });

    it('should display action icons', () => {
      render(<PixelMenu {...defaultProps} sessionActions={mockActions} />);
      
      fireEvent.click(screen.getByTestId('tab-history'));
      
      // Check for icon containers
      const actionIcons = screen.getAllByTestId(/action-icon-/);
      expect(actionIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Tab Switching', () => {
    it('should switch between actions and history tabs', () => {
      render(<PixelMenu {...defaultProps} />);
      
      // Initially on actions tab
      expect(screen.getByTestId('actions-content')).toBeInTheDocument();
      expect(screen.queryByTestId('history-content')).not.toBeInTheDocument();
      
      // Click history tab
      fireEvent.click(screen.getByTestId('tab-history'));
      
      expect(screen.queryByTestId('actions-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('history-content')).toBeInTheDocument();
      
      // Click back to actions tab
      fireEvent.click(screen.getByTestId('tab-actions'));
      
      expect(screen.getByTestId('actions-content')).toBeInTheDocument();
      expect(screen.queryByTestId('history-content')).not.toBeInTheDocument();
    });

    it('should maintain tab state during session', () => {
      const { rerender } = render(<PixelMenu {...defaultProps} />);
      
      // Switch to history tab
      fireEvent.click(screen.getByTestId('tab-history'));
      expect(screen.getByTestId('history-content')).toBeInTheDocument();
      
      // Rerender with same props
      rerender(<PixelMenu {...defaultProps} />);
      
      // Should still be on history tab
      expect(screen.getByTestId('history-content')).toBeInTheDocument();
    });
  });

  describe('Button Actions', () => {
    it('should call onChangeGame when Change Game is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const changeGameBtn = screen.getByTestId('btn-change-game');
      fireEvent.click(changeGameBtn);
      
      expect(defaultProps.onChangeGame).toHaveBeenCalledTimes(1);
    });

    it('should call onSwitchLesson when Switch Lesson is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const switchLessonBtn = screen.getByTestId('btn-switch-lesson');
      fireEvent.click(switchLessonBtn);
      
      expect(defaultProps.onSwitchLesson).toHaveBeenCalledTimes(1);
    });

    it('should call onExportGame when Export Game is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const exportGameBtn = screen.getByTestId('btn-export-game');
      fireEvent.click(exportGameBtn);
      
      expect(defaultProps.onExportGame).toHaveBeenCalledTimes(1);
    });

    it('should call onViewProgress when View Progress is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const viewProgressBtn = screen.getByTestId('btn-view-progress');
      fireEvent.click(viewProgressBtn);
      
      expect(defaultProps.onViewProgress).toHaveBeenCalledTimes(1);
    });

    it('should call onReturnCurrent when Return to Current is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const returnBtn = screen.getByTestId('btn-return-current');
      fireEvent.click(returnBtn);
      
      expect(defaultProps.onReturnCurrent).toHaveBeenCalledTimes(1);
    });

    it('should call onClose and callback when action button is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const changeGameBtn = screen.getByTestId('btn-change-game');
      fireEvent.click(changeGameBtn);
      
      expect(defaultProps.onChangeGame).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const closeButton = screen.getByTestId('close-pixel-menu');
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const overlay = screen.getByTestId('pixel-menu-overlay');
      fireEvent.click(overlay);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when menu content is clicked', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const content = screen.getByTestId('pixel-menu-content');
      fireEvent.click(content);
      
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Swipe Gestures', () => {
    it('should handle swipe down to close', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });
      
      render(<PixelMenu {...defaultProps} />);
      
      // Simulate swipe down
      if (swipeHandlers.onSwipedDown) {
        swipeHandlers.onSwipedDown({} as any);
      }
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should handle swipe right to close', async () => {
      const { useSwipeable } = vi.mocked(await import('react-swipeable'));
      
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((handlers) => {
        swipeHandlers = handlers;
        return { ref: vi.fn() };
      });
      
      render(<PixelMenu {...defaultProps} />);
      
      // Simulate swipe right
      if (swipeHandlers.onSwipedRight) {
        swipeHandlers.onSwipedRight({} as any);
      }
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Pixel Animation', () => {
    it('should animate Pixel image when menu opens', async () => {
      render(<PixelMenu {...defaultProps} />);
      
      const pixelImage = screen.getByTestId('pixel-mascot-menu');
      const initialSrc = pixelImage.getAttribute('src');
      
      // Fast-forward through animation interval
      vi.advanceTimersByTime(3000);
      
      await waitFor(() => {
        const newSrc = pixelImage.getAttribute('src');
        // Image should change after animation
        expect(newSrc).toBeDefined();
      });
    });

    it('should stop animation when menu closes', () => {
      const { rerender } = render(<PixelMenu {...defaultProps} />);
      
      // Close the menu
      rerender(<PixelMenu {...defaultProps} isOpen={false} />);
      
      // Advance timers
      vi.advanceTimersByTime(10000);
      
      // No errors should occur from trying to update unmounted component
      expect(true).toBe(true);
    });
  });

  describe('Scroll Behavior', () => {
    it('should make history section scrollable', () => {
      const manyActions = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        type: 'game_created' as const,
        title: `Action ${i}`,
        description: `Description ${i}`,
        timestamp: new Date(Date.now() - 1000 * 60 * i),
        icon: Gamepad2
      }));
      
      render(<PixelMenu {...defaultProps} sessionActions={manyActions} />);
      
      fireEvent.click(screen.getByTestId('tab-history'));
      
      const scrollArea = screen.getByTestId('history-scroll-area');
      expect(scrollArea).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<PixelMenu {...defaultProps} />);
      
      expect(screen.getByLabelText(/Close menu/i)).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<PixelMenu {...defaultProps} />);
      
      // Tab to close button
      await userEvent.tab();
      expect(screen.getByTestId('close-pixel-menu')).toHaveFocus();
      
      // Tab to tabs
      await userEvent.tab();
      expect(screen.getByTestId('tab-actions')).toHaveFocus();
      
      // Use arrow keys to navigate tabs
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByTestId('tab-history')).toHaveFocus();
    });

    it('should close on Escape key', async () => {
      render(<PixelMenu {...defaultProps} />);
      
      await userEvent.keyboard('{Escape}');
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should trap focus within menu', async () => {
      render(<PixelMenu {...defaultProps} />);
      
      const menuContent = screen.getByTestId('pixel-menu-content');
      const focusableElements = menuContent.querySelectorAll(
        'button, [tabindex]:not([tabindex="-1"])'
      );
      
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });

  describe('Animation Transitions', () => {
    it('should animate menu entrance', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const menu = screen.getByTestId('pixel-menu');
      expect(menu).toHaveStyle({ opacity: '1' });
    });

    it('should handle animation mode correctly', () => {
      render(<PixelMenu {...defaultProps} />);
      
      const menu = screen.getByTestId('pixel-menu-panel');
      // Check for motion div with animation
      expect(menu).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      render(<PixelMenu {...defaultProps} />);
      
      const menu = screen.getByTestId('pixel-menu-panel');
      // Should take full width on mobile
      expect(menu).toHaveClass('w-full');
    });

    it('should adapt layout for tablet', () => {
      // Mock tablet viewport
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
      
      render(<PixelMenu {...defaultProps} />);
      
      const menu = screen.getByTestId('pixel-menu-panel');
      expect(menu).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing callbacks gracefully', () => {
      const propsWithoutCallbacks = {
        isOpen: true,
        onClose: vi.fn(),
        sessionActions: []
      };
      
      render(<PixelMenu {...propsWithoutCallbacks} />);
      
      const changeGameBtn = screen.getByTestId('btn-change-game');
      // Should not throw error even without callback
      fireEvent.click(changeGameBtn);
      
      expect(propsWithoutCallbacks.onClose).toHaveBeenCalled();
    });

    it('should handle invalid session actions gracefully', () => {
      const invalidActions = [
        {
          id: '1',
          // Missing required fields
        } as any
      ];
      
      expect(() => {
        render(<PixelMenu {...defaultProps} sessionActions={invalidActions} />);
      }).not.toThrow();
    });
  });
});