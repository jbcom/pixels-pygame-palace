import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DialogueEngine } from '@/lib/dialogue-engine';
import * as userProfileModule from '@/lib/user-profile';

// Mock the user profile module
vi.mock('@/lib/user-profile', () => ({
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  createNewProfile: vi.fn()
}));

describe('DialogueEngine', () => {
  let dialogueEngine: DialogueEngine;
  
  beforeEach(() => {
    dialogueEngine = new DialogueEngine();
    
    // Mock fetch to return sample dialogue
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `title: Start
---
Pixel: Hello! Welcome to the game builder!
-> Let's get started!
    <<jump GetStarted>>
-> Tell me more
    <<jump TellMore>>
===

title: GetStarted
---
Pixel: Great! Let's build something awesome!
===

title: TellMore
---
Pixel: I can help you create amazing games!
===`
    });
  });
  
  describe('loadDialogue', () => {
    it('should load dialogue from a file', async () => {
      const result = await dialogueEngine.loadDialogue('welcome');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/dialogue/pixel/welcome.yarn');
    });
    
    it('should cache loaded dialogues', async () => {
      await dialogueEngine.loadDialogue('welcome');
      await dialogueEngine.loadDialogue('welcome');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    
    it('should track current flow', async () => {
      await dialogueEngine.loadDialogue('welcome');
      expect(dialogueEngine.getCurrentFlow()).toBe('welcome');
    });
  });
  
  describe('startDialogue', () => {
    it('should start dialogue at specified node', async () => {
      await dialogueEngine.loadDialogue('welcome');
      const message = await dialogueEngine.startDialogue('Start');
      
      expect(message).toBeDefined();
      expect(message?.content).toContain('Welcome to the game builder');
      expect(message?.role).toBe('pixel');
    });
    
    it('should track visited nodes', async () => {
      await dialogueEngine.loadDialogue('welcome');
      await dialogueEngine.startDialogue('Start');
      
      expect(dialogueEngine.hasVisited('Start')).toBe(true);
      expect(dialogueEngine.hasVisited('UnvisitedNode')).toBe(false);
    });
  });
  
  describe('selectOption', () => {
    it('should handle option selection', async () => {
      await dialogueEngine.loadDialogue('welcome');
      await dialogueEngine.startDialogue('Start');
      
      const message = dialogueEngine.selectOption(0);
      expect(message).toBeDefined();
      expect(message?.content).toContain('build something awesome');
    });
    
    it('should add user message to history', async () => {
      await dialogueEngine.loadDialogue('welcome');
      await dialogueEngine.startDialogue('Start');
      dialogueEngine.selectOption(0);
      
      const history = dialogueEngine.getHistory();
      expect(history.some(msg => msg.role === 'user')).toBe(true);
    });
  });
  
  describe('context management', () => {
    it('should update context', () => {
      dialogueEngine.updateContext({ playerName: 'TestPlayer' });
      const context = dialogueEngine.getContext();
      expect(context.playerName).toBe('TestPlayer');
    });
    
    it('should sync with user profile when updating certain fields', () => {
      const mockUpdateProfile = vi.mocked(userProfileModule.updateUserProfile);
      dialogueEngine.updateContext({ playerName: 'TestPlayer' });
      
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestPlayer' })
      );
    });
  });
  
  describe('getContextualSuggestions', () => {
    it('should provide onboarding suggestions for new users', () => {
      vi.mocked(userProfileModule.getUserProfile).mockReturnValue(null);
      
      const suggestions = dialogueEngine.getContextualSuggestions();
      expect(suggestions).toContain('Tell me about game development');
      expect(suggestions).toContain('What can I create here?');
    });
    
    it('should provide project suggestions for users with projects', () => {
      vi.mocked(userProfileModule.getUserProfile).mockReturnValue({
        id: '1',
        name: 'TestUser',
        skillLevel: 'intermediate',
        preferredGenres: ['platformer'],
        currentProject: 'MyGame',
        onboardingComplete: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      dialogueEngine.updateContext({ currentProject: 'MyGame' });
      const suggestions = dialogueEngine.getContextualSuggestions();
      
      expect(suggestions).toContain('Test my game');
      expect(suggestions).toContain('Add a feature');
    });
  });
  
  describe('state management', () => {
    it('should save and load state from localStorage', () => {
      dialogueEngine.setVariable('testVar', 'testValue');
      
      // Create new engine to test loading
      const newEngine = new DialogueEngine();
      expect(localStorage.setItem).toHaveBeenCalled();
    });
    
    it('should clear history', () => {
      dialogueEngine.processInput('Test message');
      expect(dialogueEngine.getHistory().length).toBeGreaterThan(0);
      
      dialogueEngine.clearHistory();
      expect(dialogueEngine.getHistory().length).toBe(0);
    });
    
    it('should reset entire state', () => {
      dialogueEngine.setVariable('testVar', 'value');
      dialogueEngine.processInput('Test');
      
      dialogueEngine.reset();
      
      expect(dialogueEngine.getVariable('testVar')).toBeNull();
      expect(dialogueEngine.getHistory().length).toBe(0);
    });
  });
});