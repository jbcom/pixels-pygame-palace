import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'wouter';
import UniversalWizard from '@/components/universal-wizard';
import AssetSelector from '@/components/asset-selector';
import { sessionHistory } from '@/lib/session-history';
import * as userProfileModule from '@/lib/user-profile';

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
          // Simulate jumping to different nodes based on name
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
              text: 'Pixel: Great, we\'ve got ourselves a game cooking here! But it needs a direction.',
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
              text: 'Pixel: Perfect! Learning Python is the best way to really understand game development.',
              options: []
            };
            // Trigger openLessons command
            if (config.functions.openLessons) {
              config.functions.openLessons();
            }
          } else if (nodeName === 'WorkStyle') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Awesome! Love it! Hey I\'m just here to help, how do you like to work?',
              options: [
                { text: 'Full editor - I got this!' },
                { text: 'Walk me through it!' }
              ]
            };
          } else if (nodeName === 'WizardMode') {
            mockYarn.currentNodeData = {
              text: mockYarn.variables.gameType === 'platformer' 
                ? 'Pixel: Alright, great! What do you think for a title screen?'
                : 'Pixel: Let\'s design your game!',
              options: []
            };
            // Trigger showAssets command
            if (config.functions.showAssets) {
              config.functions.showAssets([
                `type="${mockYarn.variables.gameType || 'generic'}"`,
                `scene="${mockYarn.variables.gameType === 'platformer' ? 'title' : 'menu'}"`
              ]);
            }
          } else if (nodeName === 'AssetSelected') {
            mockYarn.currentNodeData = {
              text: 'Pixel: Great choice! Now let\'s add some interactivity.',
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
          if (mockYarn.currentNodeData?.options?.length === 0) {
            mockYarn.currentNodeData = null;
          }
        }),
        
        selectOption: vi.fn((index) => {
          if (mockYarn.currentNodeData?.options?.[index]) {
            const option = mockYarn.currentNodeData.options[index];
            
            // Handle different option selections
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
            } else if (option.text.includes('Dungeon')) {
              mockYarn.variables.gameType = 'dungeon';
              mockYarn.jump('WorkStyle');
            } else if (option.text.includes('Racing')) {
              mockYarn.variables.gameType = 'racing';
              mockYarn.jump('WorkStyle');
            } else if (option.text.includes('Puzzle')) {
              mockYarn.variables.gameType = 'puzzle';
              mockYarn.jump('WorkStyle');
            } else if (option.text.includes('Adventure')) {
              mockYarn.variables.gameType = 'adventure';
              mockYarn.jump('WorkStyle');
            } else if (option.text.includes('Full editor')) {
              if (config.functions.openEditor) {
                config.functions.openEditor();
              }
            } else if (option.text.includes('Walk me through')) {
              mockYarn.jump('WizardMode');
            } else if (option.text.includes('player controls')) {
              mockYarn.jump('PlayerControls');
            } else if (option.text.includes('game world')) {
              mockYarn.jump('WorldSetup');
            } else if (option.text.includes('game rules')) {
              mockYarn.jump('GameRules');
            }
          }
        })
      };
      
      return mockYarn;
    })
  };
});

// Mock child components
vi.mock('@/pages/lessons', () => ({
  default: () => <div data-testid="lessons-page">Lessons Page</div>
}));

vi.mock('@/pages/project-builder-enhanced', () => ({
  default: () => <div data-testid="project-builder">Project Builder Enhanced</div>
}));

// Mock session history
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

// Mock user profile
vi.mock('@/lib/user-profile', () => ({
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  createNewProfile: vi.fn()
}));

// Mock curated assets
vi.mock('@/lib/curated-assets', () => ({
  getCuratedAssets: vi.fn(() => ({
    platformer: {
      title: {
        backgrounds: [
          { id: 'bg-1', path: '/assets/platformer/bg1.png', name: 'Forest' }
        ],
        sprites: [
          { id: 'sprite-1', path: '/assets/platformer/player.png', name: 'Player' }
        ]
      }
    },
    rpg: {
      character: {
        sprites: [
          { id: 'char-1', path: '/assets/rpg/warrior.png', name: 'Warrior' }
        ]
      }
    },
    generic: {
      menu: {
        backgrounds: [
          { id: 'menu-bg-1', path: '/assets/generic/menu-bg.png', name: 'Menu Background' }
        ]
      }
    }
  }))
}));

// Mock Pixel images
const mockImages = [
  '@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png',
  '@assets/pixel/Pixel_gaming_focused_expression_6f3fdfab.png',
  '@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png',
  '@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png',
  '@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png',
  '@assets/pixel/Pixel_coding_programming_expression_56de8ca0.png',
  '@assets/pixel/Pixel_happy_excited_expression_22a41625.png'
];

mockImages.forEach(image => {
  vi.mock(image, () => ({ default: `/mock/${image.split('/').pop()}` }));
});

describe('Universal Wizard Integration Tests', () => {
  beforeEach(() => {
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
    
    // Mock fetch for Yarn dialogue
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `title: Start
---
Pixel: Hey there! Welcome to Pixel's PyGame Palace!
-> Make a game!
    <<jump GamePath>>
-> Learn Python first
    <<jump LearnPath>>
===`
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Wizard Flow Integration', () => {
    it('should guide through complete game creation flow', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      // Wait for wizard to load
      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      // Start with welcome message
      expect(screen.getByText(/Welcome to Pixel's PyGame Palace/)).toBeInTheDocument();

      // Choose to make a game
      fireEvent.click(screen.getByTestId('dialogue-option-0'));

      await waitFor(() => {
        expect(screen.getByText(/game cooking here/)).toBeInTheDocument();
      });

      // Select Platformer
      const platformerOption = screen.getByText('Platformer - Jump and run fun!');
      fireEvent.click(platformerOption);

      await waitFor(() => {
        expect(screen.getByText(/how do you like to work/)).toBeInTheDocument();
      });

      // Choose wizard mode
      const wizardOption = screen.getByText('Walk me through it!');
      fireEvent.click(wizardOption);

      await waitFor(() => {
        // Asset selector should appear
        expect(screen.getByTestId('asset-selector')).toBeInTheDocument();
      });

      // Select an asset
      const assetItem = screen.getByTestId(/asset-item-/).first();
      fireEvent.click(assetItem);

      // Return to dialogue
      const returnButton = screen.getByTestId('return-to-dialogue');
      fireEvent.click(returnButton);

      await waitFor(() => {
        // Should be at AssetSelected node
        expect(screen.getByText(/Great choice/)).toBeInTheDocument();
      });

      // Continue with player controls
      const controlsOption = screen.getByText('Add player controls');
      fireEvent.click(controlsOption);

      // Verify session tracking
      expect(sessionHistory.trackComponentSelection).toHaveBeenCalled();
    });

    it('should handle Python lessons path integration', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      // Choose to learn Python
      fireEvent.click(screen.getByTestId('dialogue-option-1'));

      await waitFor(() => {
        // Lessons component should be embedded
        expect(screen.getByTestId('lessons-page')).toBeInTheDocument();
        
        // Pixel should be in corner state
        expect(screen.getByTestId('pixel-container-corner')).toBeInTheDocument();
      });

      // Track lesson navigation
      expect(sessionHistory.trackLesson).toHaveBeenCalled();
    });

    it('should handle editor embedding through Yarn commands', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      // Navigate to editor path
      fireEvent.click(screen.getByTestId('dialogue-option-0')); // Make game

      await waitFor(() => {
        const rpgOption = screen.getByText('RPG - Epic quests and adventures!');
        fireEvent.click(rpgOption);
      });

      await waitFor(() => {
        const editorOption = screen.getByText('Full editor - I got this!');
        fireEvent.click(editorOption);
      });

      await waitFor(() => {
        // Editor should be embedded
        expect(screen.getByTestId('project-builder')).toBeInTheDocument();
        
        // Pixel should be in corner state
        expect(screen.getByTestId('pixel-container-corner')).toBeInTheDocument();
      });
    });

    it('should test asset selection flow integration', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      // Navigate to asset selection
      fireEvent.click(screen.getByTestId('dialogue-option-0'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Platformer - Jump and run fun!'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Walk me through it!'));
      });

      await waitFor(() => {
        const assetSelector = screen.getByTestId('asset-selector');
        expect(assetSelector).toBeInTheDocument();
        
        // Should show platformer assets
        expect(assetSelector).toHaveTextContent('platformer');
        expect(assetSelector).toHaveTextContent('title');
      });

      // Test asset search
      const searchInput = screen.getByTestId('asset-search');
      await userEvent.type(searchInput, 'player');

      // Test category switching
      const spritesTab = screen.getByTestId('tab-sprites');
      fireEvent.click(spritesTab);

      await waitFor(() => {
        expect(screen.getByText('Player')).toBeInTheDocument();
      });

      // Select and return
      const playerAsset = screen.getByText('Player').closest('[data-testid^="asset-item-"]');
      if (playerAsset) fireEvent.click(playerAsset);

      fireEvent.click(screen.getByTestId('return-to-dialogue'));

      await waitFor(() => {
        expect(screen.getByTestId('dialogue-card')).toBeInTheDocument();
      });
    });
  });

  describe('State Management Through Dialogue Flow', () => {
    it('should track variables through dialogue progression', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
      });

      const mockInstance = YarnBound.mock.results[0]?.value;

      // Progress through dialogue
      fireEvent.click(screen.getByTestId('dialogue-option-0'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Racing - Speed and thrills!'));
      });

      // Check variable was set
      expect(mockInstance.variables.gameType).toBe('racing');
    });

    it('should handle conditional dialogue based on game type', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      // Test RPG path
      fireEvent.click(screen.getByTestId('dialogue-option-0'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('RPG - Epic quests and adventures!'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Walk me through it!'));
      });

      await waitFor(() => {
        const assetSelector = screen.getByTestId('asset-selector');
        // RPG should show character selection assets
        expect(assetSelector).toHaveTextContent('rpg');
      });
    });

    it('should maintain state across component embeddings', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      const mockInstance = YarnBound.mock.results[0]?.value;

      // Set some state
      mockInstance.variables.playerName = 'TestPlayer';
      mockInstance.variables.gameType = 'platformer';

      // Open editor
      if (mockInstance.functions.openEditor) {
        mockInstance.functions.openEditor();
      }

      await waitFor(() => {
        expect(screen.getByTestId('project-builder')).toBeInTheDocument();
      });

      // Variables should persist
      expect(mockInstance.variables.playerName).toBe('TestPlayer');
      expect(mockInstance.variables.gameType).toBe('platformer');
    });
  });

  describe('Pixel State Transitions', () => {
    it('should transition Pixel states correctly during flow', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      // Initially center-stage
      await waitFor(() => {
        expect(screen.getByTestId('pixel-container-center')).toBeInTheDocument();
      });

      // Navigate to trigger component embedding
      fireEvent.click(screen.getByTestId('dialogue-option-0'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Platformer - Jump and run fun!'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Full editor - I got this!'));
      });

      await waitFor(() => {
        // Should transition to corner-waiting
        expect(screen.getByTestId('pixel-container-corner')).toBeInTheDocument();
      });

      // Expand Pixel
      const expandButton = screen.getByTestId('pixel-expand');
      fireEvent.click(expandButton);

      await waitFor(() => {
        // Should show expanded state
        expect(screen.getByTestId('pixel-expanded')).toBeInTheDocument();
      });

      // Collapse back
      const collapseButton = screen.getByTestId('collapse-pixel');
      fireEvent.click(collapseButton);

      await waitFor(() => {
        expect(screen.getByTestId('pixel-container-corner')).toBeInTheDocument();
      });
    });

    it('should update Pixel image based on context', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      // Initially welcoming
      const pixelImage = screen.getByTestId('pixel-image');
      expect(pixelImage.getAttribute('src')).toContain('welcoming');

      // Navigate to lessons - should show teaching
      fireEvent.click(screen.getByTestId('dialogue-option-1'));

      await waitFor(() => {
        const updatedImage = screen.getByTestId('pixel-image');
        expect(updatedImage.getAttribute('src')).toContain('teaching');
      });
    });
  });

  describe('Custom Command Execution', () => {
    it('should execute openEditor command correctly', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      const mockInstance = YarnBound.mock.results[0]?.value;
      
      // Execute openEditor command
      mockInstance.functions.openEditor();

      await waitFor(() => {
        expect(screen.getByTestId('project-builder')).toBeInTheDocument();
        expect(screen.getByTestId('pixel-container-corner')).toBeInTheDocument();
      });
    });

    it('should execute showAssets with correct parameters', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      const mockInstance = YarnBound.mock.results[0]?.value;
      
      // Execute showAssets command
      mockInstance.functions.showAssets(['type="dungeon"', 'scene="entrance"']);

      await waitFor(() => {
        const assetSelector = screen.getByTestId('asset-selector');
        expect(assetSelector).toBeInTheDocument();
        expect(assetSelector).toHaveTextContent('dungeon');
        expect(assetSelector).toHaveTextContent('entrance');
      });
    });

    it('should execute setupControls command', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      const mockInstance = YarnBound.mock.results[0]?.value;
      const setupControlsSpy = vi.spyOn(console, 'log');
      
      // Execute setupControls command
      mockInstance.functions.setupControls(['type="platformer"']);

      expect(setupControlsSpy).toHaveBeenCalledWith('Setting up controls for:', 'platformer');
      setupControlsSpy.mockRestore();
    });

    it('should execute buildWorld command', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      const mockInstance = YarnBound.mock.results[0]?.value;
      const buildWorldSpy = vi.spyOn(console, 'log');
      
      mockInstance.variables.gameType = 'rpg';
      mockInstance.functions.buildWorld();

      expect(buildWorldSpy).toHaveBeenCalledWith('Building world for:', 'rpg');
      buildWorldSpy.mockRestore();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle dialogue loading errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load dialogue:', expect.any(Error));
      });

      // Should still render the wizard component
      expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing dialogue nodes', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      const mockInstance = YarnBound.mock.results[0]?.value;
      
      // Jump to non-existent node
      mockInstance.jump('NonExistentNode');
      mockInstance.currentNodeData = null;

      // Should not crash
      expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();
    });

    it('should recover from component embedding errors', async () => {
      // Mock a component that throws an error
      vi.mock('@/pages/lessons', () => ({
        default: () => {
          throw new Error('Component error');
        }
      }));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      // Try to open lessons
      fireEvent.click(screen.getByTestId('dialogue-option-1'));

      // Should handle error gracefully
      expect(screen.getByTestId('universal-wizard')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Session History Integration', () => {
    it('should track all user choices', async () => {
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      // Make several choices
      fireEvent.click(screen.getByTestId('dialogue-option-0'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Puzzle - Brain-teasing challenges!'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Full editor - I got this!'));
      });

      // Check session history was tracked
      expect(sessionHistory.trackChoice).toHaveBeenCalledTimes(3);
    });

    it('should track navigation between embedded components', async () => {
      const YarnBound = (await import('yarn-bound')).default as any;
      
      render(
        <BrowserRouter>
          <UniversalWizard />
        </BrowserRouter>
      );

      const mockInstance = YarnBound.mock.results[0]?.value;

      // Open editor
      mockInstance.functions.openEditor();
      expect(sessionHistory.trackNavigation).toHaveBeenCalled();

      // Open lessons
      mockInstance.functions.openLessons();
      expect(sessionHistory.trackNavigation).toHaveBeenCalledTimes(2);
    });
  });
});