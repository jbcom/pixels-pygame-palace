import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UniversalWizard from '@/components/universal-wizard';

// Mock Yarn Bound library
vi.mock('yarn-bound', () => {
  return {
    default: vi.fn().mockImplementation((config) => {
      const mockYarn = {
        dialogue: config.dialogue,
        variables: config.variableStorage || {},
        functions: config.functions || {},
        currentNodeData: null,
        
        jump: vi.fn((nodeName) => {
          // Simulate jumping to a node
          if (nodeName === 'Start') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Hey there! Welcome to Pixel\'s PyGame Palace! I\'m Pixel, your game-making buddy! 🎮',
              options: [
                { text: 'You want me to throw together a basic framework for your game so you can get started right away?' },
                { text: 'Would you like to take the opportunity to learn some Python together first?' }
              ]
            };
          } else if (nodeName === 'GamePath') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Great, we\'ve got ourselves a game cooking here! But it needs a direction. What are you thinking? I can do a few!',
              options: [
                { text: 'RPG - Epic quests and adventures!' },
                { text: 'Platformer - Jump and run fun!' },
                { text: 'Dungeon Crawler - Explore dark depths!' },
                { text: 'Racing - Speed and thrills!' },
                { text: 'Puzzle - Brain-teasing challenges!' },
                { text: 'Adventure - Story-driven exploration!' }
              ]
            };
          } else if (nodeName === 'LearnPath') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Perfect! Learning Python is the best way to really understand game development. Let me show you our lessons!',
              options: []
            };
          } else if (nodeName === 'WorkStyle') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Awesome! Love it! Hey I\'m just here to help, how do you like to work?',
              options: [
                { text: 'Full editor - I got this!' },
                { text: 'Walk me through it!' }
              ]
            };
          } else if (nodeName === 'AssetSelected') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Great choice! Now let\'s add some interactivity. What should happen when the player starts?',
              options: [
                { text: 'Add player controls' },
                { text: 'Set up the game world' },
                { text: 'Configure game rules' }
              ]
            };
          } else if (nodeName === 'ProjectComplete') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Awesome work! Your game framework is ready! 🎉',
              options: [
                { text: 'Open in editor to continue' },
                { text: 'Start over with a different game' },
                { text: 'Learn more Python first' }
              ]
            };
          }
        }),
        
        currentNode: vi.fn(() => mockYarn.currentNodeData),
        
        advance: vi.fn(() => {
          // Simulate dialogue advancement
          if (mockYarn.currentNodeData?.options?.length === 0) {
            mockYarn.currentNodeData = null;
          }
        }),
        
        selectOption: vi.fn((index) => {
          // Simulate option selection
          if (mockYarn.currentNodeData?.options?.[index]) {
            const option = mockYarn.currentNodeData.options[index];
            if (option.text.includes('basic framework')) {
              mockYarn.jump('GamePath');
            } else if (option.text.includes('learn some Python')) {
              mockYarn.jump('LearnPath');
            } else if (option.text.includes('RPG')) {
              mockYarn.variables.gameType = 'rpg';
              mockYarn.jump('WorkStyle');
            } else if (option.text.includes('Platformer')) {
              mockYarn.variables.gameType = 'platformer';
              mockYarn.jump('WorkStyle');
            } else if (option.text.includes('Full editor')) {
              if (mockYarn.functions.openEditor) {
                mockYarn.functions.openEditor();
              }
            } else if (option.text.includes('Walk me through')) {
              mockYarn.jump('WizardMode');
            }
          }
        })
      };
      
      return mockYarn;
    })
  };
});

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/wizard', vi.fn()],
  useParams: () => ({})
}));

// Mock child components
vi.mock('@/pages/lessons', () => ({
  default: () => <div data-testid="lessons-page">Lessons Page</div>
}));

vi.mock('@/pages/project-builder-enhanced', () => ({
  default: () => <div data-testid="project-builder">Project Builder</div>
}));

vi.mock('@/components/asset-selector', () => ({
  default: ({ type, scene, onSelect }: any) => (
    <div data-testid="asset-selector">
      Asset Selector - Type: {type}, Scene: {scene}
      <button onClick={() => onSelect({ id: 'test-asset', path: '/assets/test.png' })}>
        Select Asset
      </button>
    </div>
  )
}));

// Mock images
vi.mock('@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png', () => ({ 
  default: '/mock/Pixel_welcoming_waving_expression_279ffdd2.png' 
}));
vi.mock('@assets/pixel/Pixel_gaming_focused_expression_6f3fdfab.png', () => ({ 
  default: '/mock/Pixel_gaming_focused_expression_6f3fdfab.png' 
}));
vi.mock('@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png', () => ({ 
  default: '/mock/Pixel_teaching_explaining_expression_27e09763.png' 
}));
vi.mock('@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png', () => ({ 
  default: '/mock/Pixel_celebrating_victory_expression_24b7a377.png' 
}));
vi.mock('@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png', () => ({ 
  default: '/mock/Pixel_thinking_pondering_expression_0ffffedb.png' 
}));
vi.mock('@assets/pixel/Pixel_coding_programming_expression_56de8ca0.png', () => ({ 
  default: '/mock/Pixel_coding_programming_expression_56de8ca0.png' 
}));
vi.mock('@assets/pixel/Pixel_happy_excited_expression_22a41625.png', () => ({ 
  default: '/mock/Pixel_happy_excited_expression_22a41625.png' 
}));

describe('UniversalWizard Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for Yarn dialogue file
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `title: Start
---
Pixel: Hey there! Welcome to Pixel's PyGame Palace!
-> You want me to throw together a basic framework for your game so you can get started right away?
    <<jump GamePath>>
-> Would you like to take the opportunity to learn some Python together first?
    <<jump LearnPath>>
===

title: GamePath
---
Pixel: Great choice! What type of game?
-> RPG - Epic quests!
    <<set $gameType to "rpg">>
    <<jump WorkStyle>>
-> Platformer - Jump and run!
    <<set $gameType to "platformer">>
    <<jump WorkStyle>>
===`
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dialogue Loading and Initialization', () => {
    it('should load Yarn dialogue file on mount', async () => {
      render(<UniversalWizard />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/dialogue/pixel/wizard-flow.yarn');
      });
    });

    it('should display initial dialogue from Start node', async () => {
      render(<UniversalWizard />);

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Pixel's PyGame Palace/)).toBeInTheDocument();
      });
    });

    it('should handle custom dialogue path prop', async () => {
      render(<UniversalWizard dialoguePath="/dialogue/custom/flow.yarn" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/dialogue/custom/flow.yarn');
      });
    });

    it('should handle custom start node prop', async () => {
      render(<UniversalWizard startNode="CustomStart" />);

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });
    });

    it('should handle dialogue loading errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<UniversalWizard />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load dialogue:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Choice Selection and Navigation', () => {
    it('should display dialogue choices as buttons', async () => {
      render(<UniversalWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('dialogue-option-0')).toBeInTheDocument();
        expect(screen.getByTestId('dialogue-option-1')).toBeInTheDocument();
      });
    });

    it('should handle choice selection and advance dialogue', async () => {
      render(<UniversalWizard />);

      await waitFor(() => {
        const makeGameOption = screen.getByTestId('dialogue-option-0');
        expect(makeGameOption).toBeInTheDocument();
      });

      const makeGameOption = screen.getByTestId('dialogue-option-0');
      fireEvent.click(makeGameOption);

      await waitFor(() => {
        expect(screen.getByText(/Great, we've got ourselves a game cooking/)).toBeInTheDocument();
      });
    });

    it('should display game type choices with icons', async () => {
      render(<UniversalWizard />);

      // Navigate to game selection
      await waitFor(() => {
        const makeGameOption = screen.getByTestId('dialogue-option-0');
        fireEvent.click(makeGameOption);
      });

      await waitFor(() => {
        // Check for multiple game type options
        expect(screen.getByText(/RPG - Epic quests/)).toBeInTheDocument();
        expect(screen.getByText(/Platformer - Jump and run/)).toBeInTheDocument();
      });
    });
  });

  describe('Pixel State Management', () => {
    it('should start with pixel in center-stage state', async () => {
      render(<UniversalWizard />);

      await waitFor(() => {
        const pixelContainer = screen.getByTestId('pixel-container-center');
        expect(pixelContainer).toBeInTheDocument();
      });
    });

    it('should transition to corner-waiting when embedded component opens', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      const mockInstance = YarnBound.mock.results[0]?.value;
      
      render(<UniversalWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      // Trigger openEditor command
      if (mockInstance?.functions?.openEditor) {
        mockInstance.functions.openEditor();
      }

      await waitFor(() => {
        const pixelContainer = screen.getByTestId('pixel-container-corner');
        expect(pixelContainer).toBeInTheDocument();
      });
    });

    it('should update Pixel image based on context', async () => {
      render(<UniversalWizard />);

      await waitFor(() => {
        const pixelImage = screen.getByTestId('pixel-image');
        expect(pixelImage.getAttribute('src')).toContain('welcoming');
      });
    });
  });

  describe('Custom Command Execution', () => {
    it('should execute openEditor command', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(<UniversalWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      const mockInstance = YarnBound.mock.results[0]?.value;
      if (mockInstance?.functions?.openEditor) {
        mockInstance.functions.openEditor();
      }

      await waitFor(() => {
        expect(screen.getByTestId('project-builder')).toBeInTheDocument();
      });
    });

    it('should execute openLessons command', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(<UniversalWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      const mockInstance = YarnBound.mock.results[0]?.value;
      if (mockInstance?.functions?.openLessons) {
        mockInstance.functions.openLessons();
      }

      await waitFor(() => {
        expect(screen.getByTestId('lessons-page')).toBeInTheDocument();
      });
    });

    it('should execute showAssets command with parameters', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(<UniversalWizard />);

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      const mockInstance = YarnBound.mock.results[0]?.value;
      if (mockInstance?.functions?.showAssets) {
        mockInstance.functions.showAssets(['type="platformer"', 'scene="title"']);
      }

      await waitFor(() => {
        const assetSelector = screen.getByTestId('asset-selector');
        expect(assetSelector).toBeInTheDocument();
        expect(assetSelector).toHaveTextContent('Type: platformer');
        expect(assetSelector).toHaveTextContent('Scene: title');
      });
    });
  });
});