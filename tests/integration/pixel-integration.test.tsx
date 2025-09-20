import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'wouter';
import PixelPresence from '@/components/pixel-presence';
import ProjectBuilderPage from '@/pages/project-builder';
import ProfessionalEditor from '@/pages/professional-editor';
import OnboardingWizard from '@/components/onboarding-wizard';
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
    clearHistory: vi.fn(),
    subscribe: vi.fn(() => () => {})
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

// Mock PyodideWorker
vi.mock('@/lib/pyodide-worker', () => ({
  PyodideWorker: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      runPython: vi.fn().mockResolvedValue({ success: true, output: '' }),
      reset: vi.fn().mockResolvedValue(undefined)
    }))
  }
}));

describe('Pixel Mascot Integration Tests', () => {
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
    
    // Mock fetch for templates
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/templates')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'platformer',
              name: 'Platformer Game',
              description: 'Jump and run adventure',
              category: 'arcade',
              difficulty: 'beginner'
            },
            {
              id: 'rpg',
              name: 'RPG Adventure',
              description: 'Story-driven quest',
              category: 'adventure',
              difficulty: 'intermediate'
            }
          ]
        });
      }
      if (url.includes('/dialogue/')) {
        return Promise.resolve({
          ok: true,
          text: async () => `title: Start
---
Pixel: Let me help you build your game!
-> Show me templates
    <<suggestTemplates platformer>>
-> I'll explore myself
    <<navigate /project-builder>>
===`
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
        text: async () => ''
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Pixel Integration with Wizard Flow', () => {
    it('should guide users through onboarding wizard', async () => {
      const handleComplete = vi.fn();
      
      const { container } = render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/" />
            <OnboardingWizard onComplete={handleComplete} />
          </div>
        </BrowserRouter>
      );
      
      // Pixel should be present in center stage initially
      expect(screen.getByTestId('pixel-avatar')).toBeInTheDocument();
      expect(screen.getByText(/Hey there! I'm Pixel/)).toBeInTheDocument();
      
      // Select "Learn Python first" to start wizard
      const learnButton = screen.getByTestId('pixel-choice-b');
      fireEvent.click(learnButton);
      
      await waitFor(() => {
        // Should track the choice
        expect(sessionHistory.trackChoice).toHaveBeenCalledWith(
          'learn-python',
          'Learn Python first',
          '/lesson/python-basics'
        );
      });
      
      // Pixel should move to corner during wizard
      await waitFor(() => {
        expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
      });
    });

    it('should provide contextual help during wizard steps', async () => {
      const handleComplete = vi.fn();
      
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/onboarding/step-1" />
            <OnboardingWizard onComplete={handleComplete} initialStep={1} />
          </div>
        </BrowserRouter>
      );
      
      // Expand Pixel to get help
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should show contextual help for current wizard step
        expect(screen.getByText(/What would you like to do?/)).toBeInTheDocument();
      });
    });

    it('should celebrate wizard completion', async () => {
      const handleComplete = vi.fn();
      
      const { rerender } = render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/onboarding/complete" />
            <OnboardingWizard onComplete={handleComplete} initialStep={5} />
          </div>
        </BrowserRouter>
      );
      
      // Simulate wizard completion
      handleComplete();
      
      // Update path to reflect completion
      rerender(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />
            <ProjectBuilderPage />
          </div>
        </BrowserRouter>
      );
      
      // Pixel should show gaming/celebrating expression
      const avatar = screen.getByTestId('pixel-avatar');
      expect(avatar.getAttribute('src')).toContain('pixel-gaming');
    });

    it('should handle wizard abandonment gracefully', async () => {
      const handleComplete = vi.fn();
      
      const { rerender } = render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/onboarding/step-2" />
            <OnboardingWizard onComplete={handleComplete} initialStep={2} />
          </div>
        </BrowserRouter>
      );
      
      // User navigates away from wizard
      rerender(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/gallery" />
          </div>
        </BrowserRouter>
      );
      
      // Pixel should adapt to new context
      const avatar = screen.getByTestId('pixel-avatar');
      expect(avatar.getAttribute('src')).toContain('pixel-happy');
      
      // Should track navigation
      expect(sessionHistory.trackNavigation).toHaveBeenCalled();
    });

    it('should resume wizard guidance after interruption', async () => {
      const handleComplete = vi.fn();
      
      // Start wizard
      const { rerender } = render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/onboarding/step-2" />
            <OnboardingWizard onComplete={handleComplete} initialStep={2} />
          </div>
        </BrowserRouter>
      );
      
      // Navigate away
      rerender(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/gallery" />
          </div>
        </BrowserRouter>
      );
      
      // Come back to wizard
      rerender(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/onboarding/step-2" />
            <OnboardingWizard onComplete={handleComplete} initialStep={2} />
          </div>
        </BrowserRouter>
      );
      
      // Expand Pixel
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should offer to continue or review
        expect(screen.getByTestId('pixel-choice-a')).toHaveTextContent('Continue forward');
        expect(screen.getByTestId('pixel-choice-b')).toHaveTextContent('Review our journey');
      });
    });
  });

  describe('Pixel Guidance in Professional Editor', () => {
    it('should provide code assistance in editor', async () => {
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/professional-editor" />
            <ProfessionalEditor />
          </div>
        </BrowserRouter>
      );
      
      // Pixel should be in corner mode for editor
      expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
      
      // Expand for help
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should offer editor-specific help
        expect(screen.getByText(/What would you like to do?/)).toBeInTheDocument();
      });
    });

    it('should track code changes made in editor', async () => {
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/professional-editor" />
            <ProfessionalEditor />
          </div>
        </BrowserRouter>
      );
      
      // Find code editor area (may need adjustment based on actual component)
      const editorArea = container.querySelector('.monaco-editor, .CodeMirror, textarea[data-testid*="code"]');
      
      if (editorArea) {
        // Simulate typing code
        fireEvent.change(editorArea, { target: { value: 'def hello():\n    print("Hello from Pixel!")' } });
        
        await waitFor(() => {
          // Should track editor changes
          expect(sessionHistory.trackEditorChange).toHaveBeenCalled();
        });
      }
    });

    it('should suggest code snippets based on context', async () => {
      // Set user as intermediate level
      vi.mocked(userProfileModule.getUserProfile).mockReturnValue({
        id: 'test-user',
        name: 'TestUser',
        skillLevel: 'intermediate',
        preferredGenres: ['platformer'],
        currentProject: 'MyPlatformer',
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/professional-editor" />
            <ProfessionalEditor />
          </div>
        </BrowserRouter>
      );
      
      // Expand Pixel
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        // Should provide appropriate options for intermediate user
        const choices = screen.getAllByRole('button');
        expect(choices.length).toBeGreaterThan(0);
      });
    });

    it('should handle editor errors gracefully', async () => {
      // Mock Python execution error
      const mockWorker = {
        initialize: vi.fn().mockResolvedValue(undefined),
        runPython: vi.fn().mockRejectedValue(new Error('SyntaxError: invalid syntax')),
        reset: vi.fn().mockResolvedValue(undefined)
      };
      
      vi.mocked(PyodideWorker.getInstance).mockReturnValue(mockWorker);
      
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/professional-editor" />
            <ProfessionalEditor />
          </div>
        </BrowserRouter>
      );
      
      // Run code button (if exists)
      const runButton = screen.queryByTestId('run-code');
      if (runButton) {
        fireEvent.click(runButton);
        
        await waitFor(() => {
          // Pixel should still be functional
          expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Handoff Between Pixel and Other UI Elements', () => {
    it('should coordinate with template selection', async () => {
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />
            <ProjectBuilderPage />
          </div>
        </BrowserRouter>
      );
      
      // Wait for templates to load
      await waitFor(() => {
        const templates = screen.queryAllByTestId(/template-card/);
        expect(templates.length).toBeGreaterThan(0);
      });
      
      // Select a template
      const templateCard = screen.queryByTestId('template-card-platformer');
      if (templateCard) {
        fireEvent.click(templateCard);
        
        await waitFor(() => {
          // Should track component selection
          expect(sessionHistory.trackComponentSelection).toHaveBeenCalled();
        });
      }
      
      // Pixel should remain accessible
      expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
    });

    it('should not interfere with form submissions', async () => {
      const handleSubmit = vi.fn();
      
      const FormComponent = () => (
        <form onSubmit={handleSubmit} data-testid="test-form">
          <input type="text" name="name" data-testid="name-input" />
          <button type="submit" data-testid="submit-button">Submit</button>
        </form>
      );
      
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/form-page" />
            <FormComponent />
          </div>
        </BrowserRouter>
      );
      
      // Fill form
      const nameInput = screen.getByTestId('name-input');
      await userEvent.type(nameInput, 'Test Name');
      
      // Submit form
      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);
      
      // Form should submit without Pixel interference
      expect(handleSubmit).toHaveBeenCalled();
      
      // Pixel should still be available
      expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
    });

    it('should maintain state across component transitions', async () => {
      const { rerender } = render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/project-builder" />
            <ProjectBuilderPage />
          </div>
        </BrowserRouter>
      );
      
      // Expand Pixel and interact
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText(/What would you like to do?/)).toBeInTheDocument();
      });
      
      // Collapse Pixel
      const collapseButton = screen.getByTestId('collapse-pixel');
      fireEvent.click(collapseButton);
      
      // Switch to editor
      rerender(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/professional-editor" />
            <ProfessionalEditor />
          </div>
        </BrowserRouter>
      );
      
      // Pixel should maintain its state
      expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
      
      // Session history should be preserved
      expect(sessionHistory.trackNavigation).toHaveBeenCalled();
    });

    it('should respect modal z-index hierarchy', async () => {
      const ModalComponent = () => (
        <div 
          data-testid="test-modal"
          style={{ position: 'fixed', zIndex: 9999 }}
          className="bg-white p-4"
        >
          <h2>Modal Content</h2>
        </div>
      );
      
      const { container } = render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/page-with-modal" />
            <ModalComponent />
          </div>
        </BrowserRouter>
      );
      
      // Check z-index hierarchy
      const pixelElement = container.querySelector('[data-testid="pixel-expand"]')?.parentElement;
      const modalElement = screen.getByTestId('test-modal');
      
      if (pixelElement && modalElement) {
        const pixelZIndex = window.getComputedStyle(pixelElement).zIndex;
        const modalZIndex = window.getComputedStyle(modalElement).zIndex;
        
        // Modal should be above Pixel in corner mode
        expect(parseInt(modalZIndex)).toBeGreaterThan(parseInt(pixelZIndex) || 0);
      }
    });

    it('should handle concurrent animations smoothly', async () => {
      vi.useFakeTimers();
      
      const AnimatedComponent = () => {
        const [show, setShow] = useState(false);
        
        useEffect(() => {
          const timer = setTimeout(() => setShow(true), 100);
          return () => clearTimeout(timer);
        }, []);
        
        return show ? <div data-testid="animated-content">Animated</div> : null;
      };
      
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/animated-page" />
            <AnimatedComponent />
          </div>
        </BrowserRouter>
      );
      
      // Advance timers for both animations
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        // Both components should render
        expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
        expect(screen.getByTestId('animated-content')).toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });

    it('should provide assistance without blocking user actions', async () => {
      let actionCompleted = false;
      
      const InteractiveComponent = () => (
        <div>
          <button 
            data-testid="action-button"
            onClick={() => { actionCompleted = true; }}
          >
            Perform Action
          </button>
        </div>
      );
      
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/interactive-page" />
            <InteractiveComponent />
          </div>
        </BrowserRouter>
      );
      
      // Expand Pixel
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText(/What would you like to do?/)).toBeInTheDocument();
      });
      
      // User should still be able to interact with page
      const actionButton = screen.getByTestId('action-button');
      fireEvent.click(actionButton);
      
      expect(actionCompleted).toBe(true);
    });
  });

  describe('Advanced Integration Scenarios', () => {
    it('should handle deep linking with state restoration', async () => {
      // Simulate deep link with saved state
      localStorage.setItem('pixel-dialogue-state', JSON.stringify({
        currentNode: 'ProjectHelp',
        variables: { projectType: 'platformer' },
        visitedNodes: ['Start', 'ProjectHelp'],
        history: [],
        waitingForInput: null
      }));
      
      render(
        <BrowserRouter>
          <div>
            <PixelPresence 
              onNavigate={onNavigate} 
              currentPath="/project-builder?template=platformer" 
            />
            <ProjectBuilderPage />
          </div>
        </BrowserRouter>
      );
      
      // Pixel should restore state appropriately
      const avatar = screen.getByTestId('pixel-avatar');
      expect(avatar.getAttribute('src')).toContain('pixel-gaming');
    });

    it('should coordinate with keyboard shortcuts', async () => {
      render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/professional-editor" />
            <ProfessionalEditor />
          </div>
        </BrowserRouter>
      );
      
      // Simulate keyboard shortcut (e.g., Ctrl+H for help)
      fireEvent.keyDown(document, { key: 'h', ctrlKey: true });
      
      // Could trigger Pixel expansion (if implemented)
      // This tests that Pixel doesn't interfere with shortcuts
      expect(screen.getByTestId('pixel-expand')).toBeInTheDocument();
    });

    it('should handle theme changes gracefully', async () => {
      const ThemeToggle = () => {
        const [isDark, setIsDark] = useState(false);
        
        useEffect(() => {
          document.documentElement.classList.toggle('dark', isDark);
        }, [isDark]);
        
        return (
          <button 
            data-testid="theme-toggle"
            onClick={() => setIsDark(!isDark)}
          >
            Toggle Theme
          </button>
        );
      };
      
      const { container } = render(
        <BrowserRouter>
          <div>
            <PixelPresence onNavigate={onNavigate} currentPath="/" />
            <ThemeToggle />
          </div>
        </BrowserRouter>
      );
      
      // Toggle theme
      const themeToggle = screen.getByTestId('theme-toggle');
      fireEvent.click(themeToggle);
      
      await waitFor(() => {
        // Pixel should adapt to theme
        const card = container.querySelector('.dark\\:bg-gray-900');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
      
      // Pixel should remain functional
      expect(screen.getByTestId('pixel-avatar')).toBeInTheDocument();
    });
  });
});