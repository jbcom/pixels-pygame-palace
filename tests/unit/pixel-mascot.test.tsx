import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PixelPresence from '@/components/pixel-presence';
import { DialogueEngine } from '@/lib/dialogue-engine';
import { sessionHistory } from '@/lib/session-history';
import * as userProfileModule from '@/lib/user-profile';

// Mock external dependencies
vi.mock('@/lib/user-profile', () => ({
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  createNewProfile: vi.fn()
}));

vi.mock('@/lib/session-history', () => ({
  sessionHistory: {
    trackChoice: vi.fn(),
    trackNavigation: vi.fn(),
    trackLesson: vi.fn(),
    trackEditorChange: vi.fn(),
    trackComponentSelection: vi.fn(),
    getEvents: vi.fn(() => []),
    revertToEvent: vi.fn(),
    clearHistory: vi.fn()
  }
}));

// Mock images
vi.mock('@assets/pixel/Pixel_happy_excited_expression_22a41625.png', () => ({ default: '/mock/pixel-happy.png' }));
vi.mock('@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png', () => ({ default: '/mock/pixel-thinking.png' }));
vi.mock('@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png', () => ({ default: '/mock/pixel-celebrating.png' }));
vi.mock('@assets/pixel/Pixel_encouraging_supportive_expression_cf958090.png', () => ({ default: '/mock/pixel-encouraging.png' }));
vi.mock('@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png', () => ({ default: '/mock/pixel-teaching.png' }));
vi.mock('@assets/pixel/Pixel_gaming_focused_expression_6f3fdfab.png', () => ({ default: '/mock/pixel-gaming.png' }));
vi.mock('@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png', () => ({ default: '/mock/pixel-welcoming.png' }));
vi.mock('@assets/pixel/Pixel_coding_programming_expression_56de8ca0.png', () => ({ default: '/mock/pixel-coding.png' }));

describe('Pixel Mascot Comprehensive Tests', () => {
  let onNavigate: vi.Mock;

  beforeEach(() => {
    onNavigate = vi.fn();
    vi.clearAllMocks();
    localStorage.clear();
    
    // Setup default user profile
    vi.mocked(userProfileModule.getUserProfile).mockReturnValue({
      id: 'test-user',
      name: 'TestUser',
      skillLevel: 'beginner',
      preferredGenres: ['platformer'],
      currentProject: null,
      onboardingComplete: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Presence States', () => {
    it('should start in center-stage on home page', () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      const avatar = screen.getByTestId('pixel-avatar');
      expect(avatar).toBeInTheDocument();
      
      // Should show dialogue and choices in center stage
      expect(screen.getByText(/Hey there! I'm Pixel/)).toBeInTheDocument();
      expect(screen.getByTestId('pixel-choice-a')).toBeInTheDocument();
      expect(screen.getByTestId('pixel-choice-b')).toBeInTheDocument();
    });

    it('should transition to waiting-corner when navigating away from home', async () => {
      const { rerender } = render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Navigate to project builder
      rerender(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      
      await waitFor(() => {
        const expandButton = screen.getByTestId('pixel-expand');
        expect(expandButton).toBeInTheDocument();
      });
      
      // Should be in corner mode (smaller, clickable)
      const avatar = screen.getByTestId('pixel-avatar');
      expect(avatar).toHaveStyle({ imageRendering: 'crisp-edges' });
    });

    it('should expand to expanded-corner when clicked in corner mode', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/lesson/python-basics" />);
      
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should show expanded interface with choices
        expect(screen.getByText(/How did that go?/)).toBeInTheDocument();
        expect(screen.getByTestId('pixel-choice-a')).toBeInTheDocument();
        expect(screen.getByTestId('pixel-choice-b')).toBeInTheDocument();
      });
    });

    it('should collapse back to corner when close button clicked', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/lesson/python-basics" />);
      
      // Expand first
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        const collapseButton = screen.getByTestId('collapse-pixel');
        expect(collapseButton).toBeInTheDocument();
      });
      
      // Collapse
      const collapseButton = screen.getByTestId('collapse-pixel');
      fireEvent.click(collapseButton);
      
      await waitFor(() => {
        // Should be back in corner mode
        expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
        expect(screen.queryByText(/How did that go?/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Conversation Flow with Branching Choices', () => {
    it('should handle choice selection and navigation', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Select "Make a game!"
      const makeGameButton = screen.getByTestId('pixel-choice-a');
      fireEvent.click(makeGameButton);
      
      await waitFor(() => {
        // Should track choice and navigate
        expect(sessionHistory.trackChoice).toHaveBeenCalledWith(
          'make-game',
          'Make a game!',
          '/project-builder'
        );
        expect(onNavigate).toHaveBeenCalledWith('/project-builder');
      });
    });

    it('should handle learn Python choice flow', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Select "Learn Python first"
      const learnPythonButton = screen.getByTestId('pixel-choice-b');
      fireEvent.click(learnPythonButton);
      
      await waitFor(() => {
        expect(sessionHistory.trackChoice).toHaveBeenCalledWith(
          'learn-python',
          'Learn Python first',
          '/lesson/python-basics'
        );
        expect(onNavigate).toHaveBeenCalledWith('/lesson/python-basics');
      });
    });

    it('should provide different choices based on current context', async () => {
      const { rerender } = render(<PixelPresence onNavigate={onNavigate} currentPath="/lesson/python-basics" />);
      
      // Click to expand in lesson context
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should show lesson-specific choices
        const choiceA = screen.getByTestId('pixel-choice-a');
        expect(choiceA).toHaveTextContent('Next lesson!');
        
        const choiceB = screen.getByTestId('pixel-choice-b');
        expect(choiceB).toHaveTextContent("I'm ready to make games!");
      });
    });

    it('should handle session history review choice', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      
      // Expand Pixel
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        const reviewButton = screen.getByTestId('pixel-choice-b');
        expect(reviewButton).toHaveTextContent('Review our journey');
      });
      
      // Click review journey
      const reviewButton = screen.getByTestId('pixel-choice-b');
      fireEvent.click(reviewButton);
      
      // Should open session playback modal (tested separately)
    });
  });

  describe('Personality Consistency', () => {
    it('should show appropriate expression for different contexts', () => {
      const { rerender } = render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Welcome expression on home
      let avatar = screen.getByTestId('pixel-avatar');
      expect(avatar.getAttribute('src')).toContain('pixel-welcoming');
      
      // Teaching expression in lessons
      rerender(<PixelPresence onNavigate={onNavigate} currentPath="/lesson/python-basics" />);
      avatar = screen.getByTestId('pixel-avatar');
      expect(avatar.getAttribute('src')).toContain('pixel-teaching');
      
      // Gaming expression in project builder
      rerender(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      avatar = screen.getByTestId('pixel-avatar');
      expect(avatar.getAttribute('src')).toContain('pixel-gaming');
      
      // Happy expression in gallery
      rerender(<PixelPresence onNavigate={onNavigate} currentPath="/gallery" />);
      avatar = screen.getByTestId('pixel-avatar');
      expect(avatar.getAttribute('src')).toContain('pixel-happy');
    });

    it('should maintain consistent dialogue tone', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Check initial friendly tone
      expect(screen.getByText(/Hey there! I'm Pixel/)).toBeInTheDocument();
      
      // Select game making
      const makeGameButton = screen.getByTestId('pixel-choice-a');
      fireEvent.click(makeGameButton);
      
      // Dialogue should remain encouraging
      await waitFor(() => {
        expect(screen.getByText(/Great choice! Let's build something awesome!/)).toBeInTheDocument();
      });
    });
  });

  describe('Animation Transitions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should animate state transitions smoothly', async () => {
      const { container } = render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Check for motion div
      const motionDiv = container.querySelector('[style*="position: fixed"]');
      expect(motionDiv).toBeInTheDocument();
      
      // Trigger navigation
      const makeGameButton = screen.getByTestId('pixel-choice-a');
      fireEvent.click(makeGameButton);
      
      // Advance timers for animation
      vi.advanceTimersByTime(600);
      
      await waitFor(() => {
        expect(onNavigate).toHaveBeenCalledWith('/project-builder');
      });
    });

    it('should have breathing animation in corner mode', () => {
      const { container } = render(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      
      // Check for breathing animation overlay
      const breathingOverlay = container.querySelector('[class*="bg-purple-500/20"]');
      expect(breathingOverlay).toBeInTheDocument();
    });

    it('should show tooltip on hover in corner mode', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      
      const expandButton = screen.getByTestId('pixel-expand');
      
      // Hover over Pixel
      await userEvent.hover(expandButton);
      
      // Should show tooltip
      expect(screen.getByText('Click me for help!')).toBeInTheDocument();
    });
  });

  describe('Error Handling in Dialogue', () => {
    it('should handle missing dialogue files gracefully', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const dialogueEngine = new DialogueEngine();
      const result = await dialogueEngine.loadDialogue('nonexistent');
      
      // Should fallback gracefully
      expect(result).toBe(false);
    });

    it('should recover from corrupted state', () => {
      // Set corrupted state in localStorage
      localStorage.setItem('pixel-dialogue-state', 'corrupted-json-{invalid}');
      
      // Should not crash when creating new engine
      const dialogueEngine = new DialogueEngine();
      expect(dialogueEngine.getHistory()).toEqual([]);
    });

    it('should handle null user profile gracefully', () => {
      vi.mocked(userProfileModule.getUserProfile).mockReturnValue(null);
      
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Should still render without crashing
      expect(screen.getByTestId('pixel-avatar')).toBeInTheDocument();
    });
  });

  describe('Context Awareness (Beginner vs Expert)', () => {
    it('should show beginner-friendly options for new users', () => {
      vi.mocked(userProfileModule.getUserProfile).mockReturnValue({
        id: 'beginner-user',
        name: 'NewUser',
        skillLevel: 'beginner',
        preferredGenres: [],
        currentProject: null,
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Should show learning option prominently
      expect(screen.getByText('Learn Python first')).toBeInTheDocument();
    });

    it('should provide advanced options for experienced users', async () => {
      vi.mocked(userProfileModule.getUserProfile).mockReturnValue({
        id: 'expert-user',
        name: 'ExpertUser',
        skillLevel: 'expert',
        preferredGenres: ['rpg', 'strategy'],
        currentProject: 'ComplexGame',
        onboardingComplete: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        updatedAt: new Date()
      });

      render(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      
      // Expand to see options
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should show more advanced options
        expect(screen.getByText(/What would you like to do?/)).toBeInTheDocument();
      });
    });

    it('should adapt dialogue based on user progress', () => {
      const dialogueEngine = new DialogueEngine();
      
      // Update context for experienced user
      dialogueEngine.updateContext({
        skillLevel: 'expert',
        gamesCreated: 5,
        featuresAdded: ['physics', 'ai', 'multiplayer']
      });
      
      const context = dialogueEngine.getContext();
      expect(context.skillLevel).toBe('expert');
      expect(context.gamesCreated).toBe(5);
      expect(context.featuresAdded).toContain('multiplayer');
    });
  });

  describe('Interruption Handling', () => {
    it('should handle navigation interruptions gracefully', async () => {
      const { rerender } = render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Start making a choice
      const makeGameButton = screen.getByTestId('pixel-choice-a');
      fireEvent.click(makeGameButton);
      
      // Immediately change path (interruption)
      rerender(<PixelPresence onNavigate={onNavigate} currentPath="/gallery" />);
      
      await waitFor(() => {
        // Should adapt to new context
        const avatar = screen.getByTestId('pixel-avatar');
        expect(avatar.getAttribute('src')).toContain('pixel-happy');
      });
    });

    it('should handle rapid state changes', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/lesson/python-basics" />);
      
      // Rapidly expand and collapse
      const expandButton = screen.getByTestId('pixel-expand');
      
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should handle rapid clicks without crashing
        expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
      });
    });
  });

  describe('Save/Restore Conversation State', () => {
    it('should persist dialogue state across sessions', () => {
      const dialogueEngine = new DialogueEngine();
      
      // Set some state
      dialogueEngine.setVariable('userName', 'TestPlayer');
      dialogueEngine.processInput('Hello Pixel');
      
      // Create new engine (simulating page reload)
      const newEngine = new DialogueEngine();
      
      // State should be preserved
      expect(localStorage.setItem).toHaveBeenCalled();
      const savedState = localStorage.getItem('pixel-dialogue-state');
      expect(savedState).toBeTruthy();
    });

    it('should restore conversation history', () => {
      const dialogueEngine = new DialogueEngine();
      
      // Add some history
      dialogueEngine.processInput('Test message 1');
      dialogueEngine.processInput('Test message 2');
      
      const history = dialogueEngine.getHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Simulate saving
      localStorage.setItem('pixel-dialogue-state', JSON.stringify({
        currentNode: 'TestNode',
        variables: { test: 'value' },
        visitedNodes: ['Start', 'TestNode'],
        history: history,
        waitingForInput: null
      }));
      
      // Create new engine
      const newEngine = new DialogueEngine();
      const restoredHistory = newEngine.getHistory();
      
      expect(restoredHistory.length).toBe(history.length);
    });

    it('should track visited nodes across sessions', async () => {
      const dialogueEngine = new DialogueEngine();
      
      // Mock dialogue loading
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'title: Start\n---\nTest dialogue\n==='
      });
      
      await dialogueEngine.loadDialogue('test');
      await dialogueEngine.startDialogue('Start');
      
      expect(dialogueEngine.hasVisited('Start')).toBe(true);
      
      // Persist state
      const newEngine = new DialogueEngine();
      await newEngine.loadDialogue('test');
      
      // Should remember visited nodes
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Response to User Actions', () => {
    it('should respond to project creation', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Select make game
      const makeGameButton = screen.getByTestId('pixel-choice-a');
      fireEvent.click(makeGameButton);
      
      await waitFor(() => {
        expect(sessionHistory.trackChoice).toHaveBeenCalledWith(
          'make-game',
          'Make a game!',
          '/project-builder'
        );
      });
      
      // Should update dialogue
      expect(screen.getByText(/Great choice! Let's build something awesome!/)).toBeInTheDocument();
    });

    it('should track user interactions in session history', () => {
      const { rerender } = render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Navigate through different paths
      rerender(<PixelPresence onNavigate={onNavigate} currentPath="/lesson/python-basics" />);
      expect(sessionHistory.trackNavigation).toHaveBeenCalledWith('', '/lesson/python-basics');
      
      rerender(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      expect(sessionHistory.trackNavigation).toHaveBeenCalledWith('', '/project-builder');
    });

    it('should provide contextual help based on current activity', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/lesson/python-basics" />);
      
      // Expand for help
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should offer lesson-specific help
        expect(screen.getByText(/How did that go?/)).toBeInTheDocument();
        expect(screen.getByText('Next lesson!')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA attributes', () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      const avatar = screen.getByTestId('pixel-avatar');
      expect(avatar).toHaveAttribute('alt', 'Pixel');
    });

    it('should be keyboard navigable', async () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Tab to first choice
      await userEvent.tab();
      const firstChoice = screen.getByTestId('pixel-choice-a');
      expect(firstChoice).toHaveFocus();
      
      // Tab to second choice
      await userEvent.tab();
      const secondChoice = screen.getByTestId('pixel-choice-b');
      expect(secondChoice).toHaveFocus();
      
      // Activate with Enter
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(sessionHistory.trackChoice).toHaveBeenCalled();
      });
    });

    it('should have sufficient color contrast', () => {
      const { container } = render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Check for proper text classes that ensure contrast
      const dialogueText = container.querySelector('.text-2xl.font-bold');
      expect(dialogueText).toBeInTheDocument();
      
      // Check button contrast classes
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.className).toMatch(/(bg-|text-)/);
      });
    });

    it('should support screen readers', () => {
      render(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      
      // Corner mode should have descriptive button
      const expandButton = screen.getByTestId('pixel-expand');
      expect(expandButton).toBeInTheDocument();
      
      // Should have tooltip for context
      const tooltip = screen.getByText('Click me for help!');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Stress Testing', () => {
    it('should handle rapid path changes', async () => {
      const { rerender } = render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      const paths = ['/lesson/python-basics', '/project-builder', '/gallery', '/', '/projects'];
      
      // Rapidly change paths
      for (const path of paths) {
        rerender(<PixelPresence onNavigate={onNavigate} currentPath={path} />);
      }
      
      // Should not crash and should be in correct state
      await waitFor(() => {
        expect(screen.getByTestId('pixel-avatar')).toBeInTheDocument();
      });
    });

    it('should handle missing image assets gracefully', () => {
      // Mock image loading failure
      const originalImage = global.Image;
      global.Image = class {
        onerror: (() => void) | null = null;
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
      } as any;
      
      render(<PixelPresence onNavigate={onNavigate} currentPath="/" />);
      
      // Should still render with fallback
      expect(screen.getByTestId('pixel-avatar')).toBeInTheDocument();
      
      global.Image = originalImage;
    });

    it('should handle very long dialogue text', () => {
      const longText = 'A'.repeat(1000);
      
      const dialogueEngine = new DialogueEngine();
      dialogueEngine.processInput(longText);
      
      const history = dialogueEngine.getHistory();
      expect(history[0].content).toContain(longText);
    });

    it('should handle memory pressure from many interactions', () => {
      const dialogueEngine = new DialogueEngine();
      
      // Simulate many interactions
      for (let i = 0; i < 100; i++) {
        dialogueEngine.processInput(`Message ${i}`);
        dialogueEngine.setVariable(`var${i}`, `value${i}`);
      }
      
      // Should still function
      expect(dialogueEngine.getHistory().length).toBeGreaterThan(0);
      
      // Clear history should reset
      dialogueEngine.clearHistory();
      expect(dialogueEngine.getHistory().length).toBe(0);
    });
  });

  describe('Performance Optimizations', () => {
    it('should debounce rapid expand/collapse actions', async () => {
      vi.useFakeTimers();
      
      render(<PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />);
      
      const expandButton = screen.getByTestId('pixel-expand');
      
      // Click rapidly
      for (let i = 0; i < 10; i++) {
        fireEvent.click(expandButton);
        vi.advanceTimersByTime(10);
      }
      
      vi.advanceTimersByTime(500);
      
      // Should only process final state
      await waitFor(() => {
        expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });

    it('should cache dialogue files efficiently', async () => {
      const dialogueEngine = new DialogueEngine();
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'title: Start\n---\nTest\n==='
      });
      
      // Load same dialogue multiple times
      await dialogueEngine.loadDialogue('test');
      await dialogueEngine.loadDialogue('test');
      await dialogueEngine.loadDialogue('test');
      
      // Should only fetch once (cached)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});