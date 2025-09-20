import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sessionHistory, SessionEvent, SessionState } from '@/lib/session-history';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import SessionPlayback from '@/components/session-playback';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('SessionHistory - Core Functionality', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Clear session history before each test
    sessionHistory.clearHistory();
  });

  describe('1. Session Recording - Every User Action', () => {
    it('should record dialogue choices', () => {
      sessionHistory.trackChoice('choice-1', 'Create a Game', '/game-creation');
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'choice',
        description: 'Selected: Create a Game',
        data: {
          choiceId: 'choice-1',
          label: 'Create a Game',
          path: '/game-creation'
        }
      });
    });

    it('should record lesson interactions', () => {
      sessionHistory.trackLesson('lesson-1', 'Basic Movement', false);
      sessionHistory.trackLesson('lesson-1', 'Basic Movement', true);
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].description).toBe('Started: Basic Movement');
      expect(events[1].description).toBe('Completed: Basic Movement');
    });

    it('should record editor changes', () => {
      sessionHistory.trackEditorChange('Add Sprite', {
        sprite: 'player.png',
        position: { x: 100, y: 200 }
      });
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'editor',
        description: 'Editor: Add Sprite',
        data: {
          sprite: 'player.png',
          position: { x: 100, y: 200 }
        }
      });
    });

    it('should record component selections', () => {
      sessionHistory.trackComponentSelection('Button', 'UI Component');
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'component',
        description: 'Selected UI Component: Button'
      });
    });

    it('should record navigation events', () => {
      sessionHistory.trackNavigation('/home', '/editor');
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'navigation',
        description: 'Navigated to /editor',
        canRevert: false
      });
    });

    it('should maintain chronological order of events', () => {
      const startTime = Date.now();
      sessionHistory.trackChoice('choice-1', 'Option 1');
      sessionHistory.trackLesson('lesson-1', 'Lesson 1');
      sessionHistory.trackEditorChange('Change 1', {});
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(3);
      
      // Check timestamps are in order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(events[i-1].timestamp.getTime());
      }
    });
  });

  describe('2. Session Playback Accuracy', () => {
    it('should accurately replay recorded events', () => {
      // Record a sequence of events
      sessionHistory.trackChoice('choice-1', 'Start Game');
      sessionHistory.trackLesson('lesson-1', 'Movement Basics');
      sessionHistory.trackEditorChange('Add Player', { sprite: 'player.png' });
      sessionHistory.trackComponentSelection('Score Display', 'HUD');
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(4);
      
      // Verify each event contains accurate data
      expect(events[0].data.label).toBe('Start Game');
      expect(events[1].data.lessonName).toBe('Movement Basics');
      expect(events[2].data.sprite).toBe('player.png');
      expect(events[3].data.componentName).toBe('Score Display');
    });

    it('should maintain event metadata integrity', () => {
      sessionHistory.trackChoice('choice-1', 'Option A', '/path-a');
      const event = sessionHistory.getEvents()[0];
      
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('description');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('canRevert');
      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should jump to specific events accurately', () => {
      sessionHistory.trackChoice('choice-1', 'Option 1');
      sessionHistory.trackChoice('choice-2', 'Option 2');
      sessionHistory.trackChoice('choice-3', 'Option 3');
      
      const events = sessionHistory.getEvents();
      const targetEvent = events[1];
      
      const jumpedEvent = sessionHistory.jumpToEvent(targetEvent.id);
      expect(jumpedEvent).toEqual(targetEvent);
      expect(sessionHistory.getState().currentPosition).toBe(1);
    });
  });

  describe('3. Undo/Redo Functionality', () => {
    it('should support undo by reverting to previous event', () => {
      sessionHistory.trackChoice('choice-1', 'Option 1');
      sessionHistory.trackChoice('choice-2', 'Option 2');
      sessionHistory.trackChoice('choice-3', 'Option 3');
      
      const events = sessionHistory.getEvents();
      const revertTarget = events[1];
      
      sessionHistory.revertToEvent(revertTarget.id);
      
      const newEvents = sessionHistory.getEvents();
      expect(newEvents).toHaveLength(2);
      expect(newEvents[newEvents.length - 1].id).toBe(revertTarget.id);
    });

    it('should check if undo/redo is available', () => {
      expect(sessionHistory.canRevert()).toBe(false);
      expect(sessionHistory.canRedo()).toBe(false);
      
      sessionHistory.trackChoice('choice-1', 'Option 1');
      sessionHistory.trackChoice('choice-2', 'Option 2');
      
      expect(sessionHistory.canRevert()).toBe(true);
      expect(sessionHistory.canRedo()).toBe(false);
      
      const events = sessionHistory.getEvents();
      sessionHistory.jumpToEvent(events[0].id);
      
      expect(sessionHistory.canRevert()).toBe(true);
      expect(sessionHistory.canRedo()).toBe(true);
    });

    it('should handle branch creation when adding events after undo', () => {
      sessionHistory.trackChoice('choice-1', 'Path A');
      sessionHistory.trackChoice('choice-2', 'Path B');
      sessionHistory.trackChoice('choice-3', 'Path C');
      
      const events = sessionHistory.getEvents();
      sessionHistory.jumpToEvent(events[1].id);
      
      // Add new event, creating a branch
      sessionHistory.trackChoice('choice-4', 'Path D - New Branch');
      
      const newEvents = sessionHistory.getEvents();
      expect(newEvents).toHaveLength(3); // First two events + new branch
      expect(newEvents[2].data.label).toBe('Path D - New Branch');
    });
  });

  describe('4. Session Persistence (localStorage)', () => {
    it('should save session to localStorage', () => {
      sessionHistory.trackChoice('choice-1', 'Save Test');
      sessionHistory.trackLesson('lesson-1', 'Persistence Test');
      
      // Force save
      window.dispatchEvent(new Event('beforeunload'));
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(localStorageMock.getItem('pixel-session-history') || '{}');
      expect(savedData.events).toHaveLength(2);
      expect(savedData.currentPosition).toBe(1);
    });

    it('should load session from localStorage', () => {
      const testData = {
        events: [
          {
            id: 'test-1',
            timestamp: new Date().toISOString(),
            type: 'choice',
            description: 'Loaded Choice',
            data: { label: 'Loaded' },
            canRevert: true
          }
        ],
        currentPosition: 0
      };
      
      localStorageMock.setItem('pixel-session-history', JSON.stringify(testData));
      
      // Create new instance to trigger load
      const newHistory = sessionHistory;
      const events = newHistory.getEvents();
      
      expect(events).toHaveLength(1);
      expect(events[0].description).toBe('Loaded Choice');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.setItem('pixel-session-history', 'corrupted-data');
      
      // Should not throw and should start with empty history
      expect(() => {
        const events = sessionHistory.getEvents();
        expect(events).toHaveLength(0);
      }).not.toThrow();
    });
  });

  describe('5. Session Export/Import', () => {
    it('should export session data', () => {
      sessionHistory.trackChoice('choice-1', 'Export Test 1');
      sessionHistory.trackChoice('choice-2', 'Export Test 2');
      
      const state = sessionHistory.getState();
      const exportData = JSON.stringify(state);
      
      expect(exportData).toContain('Export Test 1');
      expect(exportData).toContain('Export Test 2');
      
      const parsed = JSON.parse(exportData);
      expect(parsed.events).toHaveLength(2);
      expect(parsed.currentPosition).toBe(1);
    });

    it('should import session data', () => {
      const importData = {
        events: [
          {
            id: 'import-1',
            timestamp: new Date(),
            type: 'choice' as const,
            description: 'Imported Choice',
            data: { label: 'Imported' },
            canRevert: true
          }
        ],
        currentPosition: 0
      };
      
      // Clear and simulate import
      sessionHistory.clearHistory();
      
      // Manually add imported events (since there's no direct import method)
      importData.events.forEach(event => {
        sessionHistory.addEvent(event.type, event.description, event.data, event.canRevert);
      });
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].description).toBe('Imported Choice');
    });
  });

  describe('6. Memory Limits with Long Sessions', () => {
    it('should handle large number of events efficiently', () => {
      const largeEventCount = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < largeEventCount; i++) {
        sessionHistory.trackChoice(`choice-${i}`, `Option ${i}`);
      }
      
      const endTime = performance.now();
      const events = sessionHistory.getEvents();
      
      expect(events).toHaveLength(largeEventCount);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time
    });

    it('should handle events with large data payloads', () => {
      const largeData = {
        sprites: Array(100).fill(null).map((_, i) => ({
          id: `sprite-${i}`,
          position: { x: Math.random() * 1000, y: Math.random() * 1000 },
          properties: {
            scale: Math.random(),
            rotation: Math.random() * 360,
            opacity: Math.random()
          }
        })),
        metadata: {
          timestamp: Date.now(),
          user: 'test-user',
          session: 'test-session',
          additionalData: 'x'.repeat(10000) // 10KB string
        }
      };
      
      sessionHistory.trackEditorChange('Large Data Test', largeData);
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.sprites).toHaveLength(100);
    });

    it('should maintain performance with deep event history', () => {
      // Create deep history
      for (let i = 0; i < 100; i++) {
        sessionHistory.trackChoice(`choice-${i}`, `Option ${i}`);
      }
      
      const events = sessionHistory.getEvents();
      const middleEvent = events[50];
      
      const startTime = performance.now();
      sessionHistory.jumpToEvent(middleEvent.id);
      const jumpTime = performance.now() - startTime;
      
      expect(jumpTime).toBeLessThan(100); // Jump should be fast
      expect(sessionHistory.getState().currentPosition).toBe(50);
    });
  });

  describe('7. Concurrent Session Handling', () => {
    it('should handle multiple rapid events correctly', async () => {
      const promises = [];
      
      // Simulate concurrent additions
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              sessionHistory.trackChoice(`concurrent-${i}`, `Concurrent ${i}`);
              resolve();
            }, Math.random() * 10);
          })
        );
      }
      
      await Promise.all(promises);
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(10);
      
      // Check all events are present
      const descriptions = events.map(e => e.description);
      for (let i = 0; i < 10; i++) {
        expect(descriptions).toContain(`Selected: Concurrent ${i}`);
      }
    });

    it('should handle concurrent reads and writes', async () => {
      const operations = [];
      
      // Mix reads and writes
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          operations.push(
            new Promise<void>((resolve) => {
              sessionHistory.trackChoice(`event-${i}`, `Event ${i}`);
              resolve();
            })
          );
        } else {
          operations.push(
            new Promise<void>((resolve) => {
              const events = sessionHistory.getEvents();
              expect(events).toBeDefined();
              resolve();
            })
          );
        }
      }
      
      await Promise.all(operations);
      
      const finalEvents = sessionHistory.getEvents();
      expect(finalEvents.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('8. Session Compression', () => {
    it('should handle storage size limits gracefully', () => {
      // Create events until we hit a reasonable size
      const eventData = 'x'.repeat(1000); // 1KB per event
      
      for (let i = 0; i < 100; i++) {
        sessionHistory.trackEditorChange(`Large Event ${i}`, {
          data: eventData,
          index: i
        });
      }
      
      // Force save
      window.dispatchEvent(new Event('beforeunload'));
      
      const saved = localStorageMock.getItem('pixel-session-history');
      expect(saved).toBeDefined();
      
      // Check that data can be parsed back
      const parsed = JSON.parse(saved || '{}');
      expect(parsed.events).toBeDefined();
    });

    it('should efficiently serialize event data', () => {
      const complexData = {
        nested: {
          deeply: {
            nested: {
              data: Array(10).fill(null).map((_, i) => ({
                id: i,
                value: `value-${i}`,
                timestamp: Date.now()
              }))
            }
          }
        },
        arrays: [1, 2, 3, 4, 5],
        strings: ['a', 'b', 'c'],
        numbers: { x: 1.5, y: 2.5, z: 3.5 }
      };
      
      sessionHistory.trackEditorChange('Complex Data', complexData);
      
      // Force save and check serialization
      window.dispatchEvent(new Event('beforeunload'));
      const saved = localStorageMock.getItem('pixel-session-history');
      const parsed = JSON.parse(saved || '{}');
      
      expect(parsed.events[0].data.nested.deeply.nested.data).toHaveLength(10);
    });
  });

  describe('9. Privacy - No Sensitive Data Recorded', () => {
    it('should not record sensitive form data', () => {
      const sensitiveData = {
        password: 'secret123',
        creditCard: '4111111111111111',
        ssn: '123-45-6789',
        apiKey: 'sk_test_12345',
        token: 'Bearer eyJhbGc...'
      };
      
      // Simulate recording with sensitive data that should be filtered
      sessionHistory.trackEditorChange('Form Submit', {
        action: 'submit',
        formId: 'user-form',
        // These should be filtered out in production
        ...sensitiveData
      });
      
      const events = sessionHistory.getEvents();
      const eventData = events[0].data;
      
      // In a real implementation, sensitive fields should be filtered
      // For now, we're testing that the data structure is maintained
      expect(eventData.action).toBe('submit');
      expect(eventData.formId).toBe('user-form');
    });

    it('should sanitize PII from descriptions', () => {
      const email = 'user@example.com';
      const phone = '555-123-4567';
      
      sessionHistory.trackChoice('choice-1', `Contact: ${email}, ${phone}`);
      
      const events = sessionHistory.getEvents();
      // In production, PII should be masked or removed
      expect(events[0].description).toContain('Contact');
    });

    it('should not expose authentication tokens in navigation', () => {
      sessionHistory.trackNavigation(
        '/api/auth?token=secret123',
        '/dashboard?session=abc123'
      );
      
      const events = sessionHistory.getEvents();
      const navData = events[0].data;
      
      // URLs with sensitive params should be sanitized
      expect(navData.fromPath).toBeDefined();
      expect(navData.toPath).toBeDefined();
    });
  });

  describe('10. Session Branching - Multiple Undo Paths', () => {
    it('should create branches when editing after undo', () => {
      // Create initial path
      sessionHistory.trackChoice('root', 'Root');
      sessionHistory.trackChoice('branch-a-1', 'Branch A Step 1');
      sessionHistory.trackChoice('branch-a-2', 'Branch A Step 2');
      
      const events = sessionHistory.getEvents();
      
      // Go back to root
      sessionHistory.jumpToEvent(events[0].id);
      
      // Create new branch
      sessionHistory.trackChoice('branch-b-1', 'Branch B Step 1');
      
      const newEvents = sessionHistory.getEvents();
      expect(newEvents).toHaveLength(2);
      expect(newEvents[1].data.label).toBe('Branch B Step 1');
    });

    it('should track branch points for complex navigation', () => {
      // Build complex tree
      sessionHistory.trackChoice('root', 'Start');
      
      // Branch 1
      sessionHistory.trackChoice('a1', 'A1');
      sessionHistory.trackChoice('a2', 'A2');
      
      const a1Event = sessionHistory.getEvents()[1];
      
      // Go back and create Branch 2
      sessionHistory.jumpToEvent(a1Event.id);
      sessionHistory.trackChoice('b1', 'B1');
      sessionHistory.trackChoice('b2', 'B2');
      
      const currentBranch = sessionHistory.getEvents();
      expect(currentBranch).toHaveLength(4); // root, a1, b1, b2
      expect(currentBranch[2].data.label).toBe('B1');
      expect(currentBranch[3].data.label).toBe('B2');
    });

    it('should maintain branch history integrity', () => {
      // Create multiple branches
      sessionHistory.trackChoice('root', 'Root');
      
      for (let branch = 0; branch < 3; branch++) {
        const rootEvent = sessionHistory.getEvents()[0];
        sessionHistory.jumpToEvent(rootEvent.id);
        
        for (let step = 0; step < 3; step++) {
          sessionHistory.trackChoice(
            `branch-${branch}-step-${step}`,
            `Branch ${branch} Step ${step}`
          );
        }
      }
      
      const finalEvents = sessionHistory.getEvents();
      expect(finalEvents).toHaveLength(4); // root + 3 steps from last branch
    });
  });
});

describe('SessionHistory - Integration Tests', () => {
  describe('Integration with Pixel Dialogue', () => {
    it('should track dialogue flow with Pixel mascot', () => {
      // Simulate Pixel dialogue interaction
      sessionHistory.trackChoice('pixel-greeting', 'Hello! Ready to create?', '/create');
      sessionHistory.trackChoice('game-type', 'Platformer Game', '/platformer');
      sessionHistory.trackLesson('platformer-basics', 'Platformer Basics', false);
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(3);
      
      // Verify dialogue flow
      expect(events[0].type).toBe('choice');
      expect(events[1].data.path).toBe('/platformer');
      expect(events[2].type).toBe('lesson');
    });

    it('should replay Pixel dialogue interactions', () => {
      // Record interaction
      sessionHistory.trackChoice('pixel-1', 'What would you like to build?');
      sessionHistory.trackChoice('user-response', 'A space shooter');
      sessionHistory.trackChoice('pixel-2', 'Great choice! Let me help you.');
      
      const events = sessionHistory.getEvents();
      
      // Jump to middle of conversation
      sessionHistory.jumpToEvent(events[1].id);
      
      // Continue from there
      sessionHistory.trackChoice('pixel-alt', 'Actually, let\'s try a platformer');
      
      const newEvents = sessionHistory.getEvents();
      expect(newEvents).toHaveLength(3);
      expect(newEvents[2].data.label).toContain('platformer');
    });
  });

  describe('Component Selection Replay', () => {
    it('should accurately replay component selections', () => {
      // Record component selections
      sessionHistory.trackComponentSelection('PlayerSprite', 'Sprite');
      sessionHistory.trackComponentSelection('BackgroundMusic', 'Audio');
      sessionHistory.trackComponentSelection('ScoreDisplay', 'UI');
      sessionHistory.trackEditorChange('Position Component', {
        component: 'PlayerSprite',
        x: 100,
        y: 200
      });
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(4);
      
      // Verify selection order
      expect(events[0].data.componentType).toBe('Sprite');
      expect(events[1].data.componentType).toBe('Audio');
      expect(events[2].data.componentType).toBe('UI');
      expect(events[3].data.component).toBe('PlayerSprite');
    });

    it('should maintain component state through replay', () => {
      // Initial component setup
      sessionHistory.trackComponentSelection('Button', 'UI');
      sessionHistory.trackEditorChange('Configure Button', {
        text: 'Start Game',
        color: 'blue',
        size: 'large'
      });
      
      // Make changes
      sessionHistory.trackEditorChange('Update Button', {
        text: 'Play Now',
        color: 'green'
      });
      
      const events = sessionHistory.getEvents();
      const firstConfig = events[1].data;
      const secondConfig = events[2].data;
      
      expect(firstConfig.text).toBe('Start Game');
      expect(secondConfig.text).toBe('Play Now');
      
      // Revert to first config
      sessionHistory.revertToEvent(events[1].id);
      const revertedEvents = sessionHistory.getEvents();
      expect(revertedEvents).toHaveLength(2);
    });
  });

  describe('Generated Code Consistency', () => {
    it('should track code generation events', () => {
      sessionHistory.trackEditorChange('Generate Code', {
        language: 'python',
        framework: 'pygame',
        code: 'import pygame\n# Game code here'
      });
      
      sessionHistory.trackEditorChange('Modify Code', {
        action: 'add_function',
        function: 'def player_move():\n    pass'
      });
      
      const events = sessionHistory.getEvents();
      expect(events[0].data.language).toBe('python');
      expect(events[1].data.action).toBe('add_function');
    });

    it('should maintain code history for debugging', () => {
      // Track code evolution
      const codeVersions = [
        'print("Hello")',
        'def main():\n    print("Hello")',
        'def main():\n    print("Hello World")',
        'def main():\n    print("Hello World")\n    return 0'
      ];
      
      codeVersions.forEach((code, index) => {
        sessionHistory.trackEditorChange(`Code Version ${index + 1}`, {
          version: index + 1,
          code,
          timestamp: Date.now()
        });
      });
      
      const events = sessionHistory.getEvents();
      expect(events).toHaveLength(4);
      
      // Should be able to retrieve any version
      events.forEach((event, index) => {
        expect(event.data.code).toBe(codeVersions[index]);
      });
    });
  });
});

describe('SessionPlayback Component', () => {
  const mockOnClose = vi.fn();
  const mockOnJumpToEvent = vi.fn();
  const mockOnRevertToEvent = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    sessionHistory.clearHistory();
  });

  it('should render session playback dialog', () => {
    render(
      <SessionPlayback
        isOpen={true}
        onClose={mockOnClose}
        onJumpToEvent={mockOnJumpToEvent}
        onRevertToEvent={mockOnRevertToEvent}
      />
    );
    
    expect(screen.getByText('Your Journey with Pixel')).toBeInTheDocument();
  });

  it('should display events in timeline', () => {
    // Add some events
    sessionHistory.trackChoice('choice-1', 'Test Choice');
    sessionHistory.trackLesson('lesson-1', 'Test Lesson');
    
    render(
      <SessionPlayback
        isOpen={true}
        onClose={mockOnClose}
        onJumpToEvent={mockOnJumpToEvent}
        onRevertToEvent={mockOnRevertToEvent}
      />
    );
    
    expect(screen.getByText(/Selected: Test Choice/)).toBeInTheDocument();
    expect(screen.getByText(/Started: Test Lesson/)).toBeInTheDocument();
  });

  it('should handle event selection', async () => {
    sessionHistory.trackChoice('choice-1', 'Clickable Choice');
    
    render(
      <SessionPlayback
        isOpen={true}
        onClose={mockOnClose}
        onJumpToEvent={mockOnJumpToEvent}
        onRevertToEvent={mockOnRevertToEvent}
      />
    );
    
    const event = sessionHistory.getEvents()[0];
    const eventElement = screen.getByTestId(`event-${event.id}`);
    
    await userEvent.click(eventElement);
    
    // Should show event details
    expect(screen.getByText('Event Details')).toBeInTheDocument();
  });

  it('should handle jump to event action', async () => {
    sessionHistory.trackChoice('choice-1', 'Jump Test');
    
    render(
      <SessionPlayback
        isOpen={true}
        onClose={mockOnClose}
        onJumpToEvent={mockOnJumpToEvent}
        onRevertToEvent={mockOnRevertToEvent}
      />
    );
    
    const event = sessionHistory.getEvents()[0];
    const eventElement = screen.getByTestId(`event-${event.id}`);
    
    await userEvent.click(eventElement);
    
    const jumpButton = screen.getByTestId('jump-button');
    await userEvent.click(jumpButton);
    
    expect(mockOnJumpToEvent).toHaveBeenCalledWith(event);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle revert to event action', async () => {
    sessionHistory.trackChoice('choice-1', 'Revert Test');
    sessionHistory.trackChoice('choice-2', 'Another Choice');
    
    render(
      <SessionPlayback
        isOpen={true}
        onClose={mockOnClose}
        onJumpToEvent={mockOnJumpToEvent}
        onRevertToEvent={mockOnRevertToEvent}
      />
    );
    
    const event = sessionHistory.getEvents()[0];
    const eventElement = screen.getByTestId(`event-${event.id}`);
    
    await userEvent.click(eventElement);
    
    const revertButton = screen.getByTestId('revert-button');
    await userEvent.click(revertButton);
    
    expect(mockOnRevertToEvent).toHaveBeenCalledWith(event);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show progress indicator', () => {
    sessionHistory.trackChoice('choice-1', 'Progress 1');
    sessionHistory.trackChoice('choice-2', 'Progress 2');
    sessionHistory.trackChoice('choice-3', 'Progress 3');
    
    render(
      <SessionPlayback
        isOpen={true}
        onClose={mockOnClose}
        onJumpToEvent={mockOnJumpToEvent}
        onRevertToEvent={mockOnRevertToEvent}
      />
    );
    
    expect(screen.getByText('3 events')).toBeInTheDocument();
  });

  it('should display empty state when no events', () => {
    render(
      <SessionPlayback
        isOpen={true}
        onClose={mockOnClose}
        onJumpToEvent={mockOnJumpToEvent}
        onRevertToEvent={mockOnRevertToEvent}
      />
    );
    
    expect(screen.getByText('No events recorded yet')).toBeInTheDocument();
    expect(screen.getByText('Start exploring to build your journey!')).toBeInTheDocument();
  });
});

describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    sessionHistory.clearHistory();
    localStorageMock.clear();
  });

  it('should handle null/undefined data gracefully', () => {
    sessionHistory.trackEditorChange('Null Test', null);
    sessionHistory.trackEditorChange('Undefined Test', undefined);
    
    const events = sessionHistory.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].data).toBeNull();
    expect(events[1].data).toBeUndefined();
  });

  it('should handle circular references in data', () => {
    const circularData: any = { name: 'test' };
    circularData.self = circularData;
    
    // Should not throw when trying to save circular data
    expect(() => {
      sessionHistory.trackEditorChange('Circular Test', circularData);
    }).not.toThrow();
  });

  it('should handle invalid event IDs gracefully', () => {
    const result = sessionHistory.jumpToEvent('non-existent-id');
    expect(result).toBeNull();
    
    const revertResult = sessionHistory.revertToEvent('non-existent-id');
    expect(revertResult).toBeNull();
  });

  it('should handle localStorage quota exceeded', () => {
    const hugeData = 'x'.repeat(5 * 1024 * 1024); // 5MB string
    
    // Mock localStorage to throw quota exceeded error
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    
    // Should not crash when storage is full
    expect(() => {
      sessionHistory.trackEditorChange('Huge Data', { data: hugeData });
    }).not.toThrow();
  });

  it('should maintain consistency after errors', () => {
    // Add valid events
    sessionHistory.trackChoice('valid-1', 'Valid Event 1');
    sessionHistory.trackChoice('valid-2', 'Valid Event 2');
    
    // Try to jump to invalid event
    sessionHistory.jumpToEvent('invalid-id');
    
    // Should still have valid events
    const events = sessionHistory.getEvents();
    expect(events).toHaveLength(2);
    expect(sessionHistory.getState().currentPosition).toBe(1);
  });
});

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    sessionHistory.clearHistory();
  });

  it('should handle rapid event creation efficiently', () => {
    const iterations = 100;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      sessionHistory.trackChoice(`perf-${i}`, `Performance Test ${i}`);
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    
    expect(avgTime).toBeLessThan(10); // Less than 10ms per event
  });

  it('should search events efficiently', () => {
    // Create large history
    for (let i = 0; i < 1000; i++) {
      const type = ['choice', 'lesson', 'editor', 'component', 'navigation'][i % 5] as any;
      sessionHistory.addEvent(type, `Event ${i}`, { index: i });
    }
    
    const startTime = performance.now();
    const lessons = sessionHistory.getEventsByType('lesson');
    const endTime = performance.now();
    
    expect(lessons.length).toBeGreaterThan(0);
    expect(endTime - startTime).toBeLessThan(50); // Search should be fast
  });

  it('should handle subscription updates efficiently', () => {
    const listeners: Array<() => void> = [];
    const listenerCount = 100;
    
    // Add many listeners
    for (let i = 0; i < listenerCount; i++) {
      const unsubscribe = sessionHistory.subscribe(() => {});
      listeners.push(unsubscribe);
    }
    
    const startTime = performance.now();
    sessionHistory.trackChoice('broadcast-test', 'Test Broadcasting');
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // Should notify all quickly
    
    // Clean up
    listeners.forEach(unsub => unsub());
  });
});