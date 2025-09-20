import { Runner, BuiltinTypeParser, DialogueOption as YarnDialogueOption } from 'yarn-bound';
import type { ConversationMessage, UserProfile } from '@shared/schema';
import { 
  getUserProfile, 
  saveUserProfile, 
  updateUserProfile,
  createNewProfile 
} from '@/lib/user-profile';

export interface DialogueState {
  currentNode: string;
  variables: Record<string, any>;
  visitedNodes: Set<string>;
  history: ConversationMessage[];
  waitingForInput: string | null;
}

export interface DialogueOption {
  text: string;
  index: number;
  targetNode?: string;
}

export type DialogueCallback = (action: string, data?: any) => void;

const DIALOGUE_STATE_KEY = 'pixel-dialogue-state';
const DIALOGUE_BASE_PATH = '/dialogue/pixel/';

export class DialogueEngine {
  private runner: Runner | null = null;
  private state: DialogueState;
  private onAction: DialogueCallback | null = null;
  private dialogueFiles: Map<string, string> = new Map();
  private currentFlow: string = '';
  private context: Record<string, any> = {};
  private flowStack: string[] = [];
  private currentMood: string = 'happy';
  private typingSpeed: number = 30;

  constructor() {
    this.state = this.loadState();
    this.initializeContext();
  }

  // Initialize conversation context
  private initializeContext(): void {
    const profile = getUserProfile();
    this.context = {
      playerName: profile?.name || '',
      skillLevel: profile?.skillLevel || 'beginner',
      preferredGenres: profile?.preferredGenres || [],
      currentProject: profile?.currentProject || null,
      mood: 'welcoming',
      lastInteraction: new Date(),
      sessionStarted: new Date(),
      featuresAdded: [],
      assetsLoaded: [],
      achievementsUnlocked: [],
      helpRequests: 0,
      gamesCreated: 0,
      enthusiasm: 'medium',
      supportLevel: 'moderate',
      learningStyle: 'hands-on',
      preferredStyle: 'mixed'
    };
  }

  // Load saved state from localStorage
  private loadState(): DialogueState {
    try {
      const saved = localStorage.getItem(DIALOGUE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          visitedNodes: new Set(parsed.visitedNodes || [])
        };
      }
    } catch (error) {
      console.error('Failed to load dialogue state:', error);
    }
    
    return {
      currentNode: 'Start',
      variables: {},
      visitedNodes: new Set(),
      history: [],
      waitingForInput: null
    };
  }

  // Save state to localStorage
  private saveState(): void {
    try {
      const toSave = {
        ...this.state,
        visitedNodes: Array.from(this.state.visitedNodes)
      };
      localStorage.setItem(DIALOGUE_STATE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save dialogue state:', error);
    }
  }

  // Load a dialogue file with flow navigation support
  async loadDialogue(flowName: string, pushToStack: boolean = true): Promise<boolean> {
    try {
      // Check if we already have this dialogue cached
      let content = this.dialogueFiles.get(flowName);
      
      if (!content) {
        const response = await fetch(`${DIALOGUE_BASE_PATH}${flowName}.yarn`);
        if (!response.ok) {
          console.error(`Failed to fetch dialogue: ${flowName}`);
          // Fallback to a default flow if needed
          return await this.loadDialogue('welcome');
        }
        content = await response.text();
        this.dialogueFiles.set(flowName, content);
      }
      
      if (pushToStack && this.currentFlow && this.currentFlow !== flowName) {
        this.flowStack.push(this.currentFlow);
      }
      
      this.currentFlow = flowName;
      
      // Initialize yarn-bound runner
      await this.initializeRunner(content);
      
      // Update context
      this.updateContext({ currentFlow: flowName });
      
      return true;
    } catch (error) {
      console.error(`Failed to load dialogue ${flowName}:`, error);
      return false;
    }
  }

  // Navigate back to previous flow
  async goBack(): Promise<boolean> {
    if (this.flowStack.length > 0) {
      const previousFlow = this.flowStack.pop()!;
      return await this.loadDialogue(previousFlow, false);
    }
    return false;
  }

  // Update conversation context
  updateContext(updates: Record<string, any>): void {
    this.context = { ...this.context, ...updates };
    
    // Sync with user profile if needed
    if (updates.playerName || updates.skillLevel || updates.preferredGenres) {
      const profile = getUserProfile();
      if (profile) {
        updateUserProfile({
          name: updates.playerName || profile.name,
          skillLevel: updates.skillLevel || profile.skillLevel,
          preferredGenres: updates.preferredGenres || profile.preferredGenres
        });
      } else if (updates.playerName) {
        // Create a new profile if none exists and playerName is provided
        updateUserProfile({
          name: updates.playerName,
          skillLevel: updates.skillLevel || 'beginner',
          preferredGenres: updates.preferredGenres || []
        });
      }
    }
  }

  // Get current context
  getContext(): Record<string, any> {
    return { ...this.context };
  }

  // Initialize the yarn-bound runner
  private async initializeRunner(yarnContent: string): Promise<void> {
    try {
      // Create a new runner with the Yarn content
      // Check if Runner is available (may not be in test environment)
      if (typeof Runner !== 'function') {
        console.warn('Runner not available, skipping initialization');
        return;
      }
      this.runner = new Runner();
      
      // Load the yarn content
      this.runner.load(yarnContent);
      
      // Register custom commands
      this.registerCustomCommands();
      
      // Set up variables from saved state
      if (this.state.variables) {
        Object.entries(this.state.variables).forEach(([key, value]) => {
          this.runner!.variables.set(key, value);
        });
      }
      
      // Sync user profile data
      const profile = getUserProfile();
      if (profile) {
        this.runner.variables.set('playerName', profile.name);
        this.runner.variables.set('skillLevel', profile.skillLevel);
        this.runner.variables.set('currentProject', profile.currentProject);
        this.runner.variables.set('favoriteGenre', profile.preferredGenres?.[0] || '');
      }
      
      // Sync context variables
      Object.entries(this.context).forEach(([key, value]) => {
        if (typeof value !== 'object') {
          this.runner!.variables.set(key, value);
        }
      });
    } catch (error) {
      console.error('Failed to initialize runner:', error);
    }
  }

  // Register custom Yarn commands
  private registerCustomCommands(): void {
    if (!this.runner) return;

    // Set mood command
    this.runner.registerCommand('set', (variable: string, value: string) => {
      if (variable === '$mood') {
        this.currentMood = value;
        this.updateContext({ mood: value });
      }
      this.runner!.variables.set(variable, value);
      this.updateContext({ [variable.replace('$', '')]: value });
    });

    // Navigation command
    this.runner.registerCommand('navigate', (page: string) => {
      if (this.onAction) {
        this.onAction('navigate', { page });
      }
    });

    // Create project command
    this.runner.registerCommand('createProject', (template: string) => {
      this.updateContext({ 
        currentProject: template,
        gamesCreated: this.context.gamesCreated + 1
      });
      if (this.onAction) {
        this.onAction('createProject', { template });
      }
    });

    // Suggest templates command
    this.runner.registerCommand('suggestTemplates', (genre: string) => {
      if (this.onAction) {
        this.onAction('suggestTemplates', { genre });
      }
    });

    // Set user profile field
    this.runner.registerCommand('setUserProfile', (field: string, value: any) => {
      const profile = getUserProfile();
      if (profile) {
        const updates: Partial<UserProfile> = { [field]: value };
        updateUserProfile(updates);
      } else if (field === 'name') {
        createNewProfile(value, 'beginner');
      }
      this.updateContext({ [field]: value });
    });

    // Save profile command
    this.runner.registerCommand('saveProfile', () => {
      const profile = getUserProfile();
      if (profile) {
        saveUserProfile(profile);
      }
    });

    // Load assets command
    this.runner.registerCommand('loadAssets', (assetPack: string) => {
      this.updateContext({ 
        assetsLoaded: [...this.context.assetsLoaded, assetPack],
        lastAssetPack: assetPack
      });
      if (this.onAction) {
        this.onAction('loadAssets', { assetPack });
      }
    });

    // Add feature command
    this.runner.registerCommand('addFeature', (feature: string) => {
      this.updateContext({ 
        featuresAdded: [...this.context.featuresAdded, feature],
        lastFeature: feature,
        featureCount: this.context.featuresAdded.length + 1
      });
      if (this.onAction) {
        this.onAction('addFeature', { feature });
      }
    });

    // Show asset grid command
    this.runner.registerCommand('showAssetGrid', (category: string) => {
      if (this.onAction) {
        this.onAction('showAssetGrid', { category });
      }
    });

    // Show code command
    this.runner.registerCommand('showCode', (section: string) => {
      if (this.onAction) {
        this.onAction('showCode', { section });
      }
    });

    // Run game command
    this.runner.registerCommand('runGame', () => {
      if (this.onAction) {
        this.onAction('runGame', {});
      }
    });

    // Jump to another flow - enhanced for cross-file navigation
    this.runner.registerCommand('jump', async (target: string) => {
      // Handle cross-file jumps
      if (target.includes('/')) {
        const parts = target.split('/');
        const flowFile = parts[parts.length - 2];
        const nodeName = parts[parts.length - 1] || 'Start';
        
        await this.loadDialogue(flowFile);
        this.jumpToNode(nodeName);
      } else {
        this.jumpToNode(target);
      }
    });

    // Wait command for pauses
    this.runner.registerCommand('wait', (seconds: number) => {
      // This would be handled in the UI to create a pause effect
      if (this.onAction) {
        this.onAction('wait', { seconds });
      }
    });

    // Additional commands for enhanced features
    this.runner.registerCommand('showAssetPreview', (assetPack: string) => {
      if (this.onAction) {
        this.onAction('showAssetPreview', { assetPack });
      }
    });

    this.runner.registerCommand('testFeature', (feature: string) => {
      if (this.onAction) {
        this.onAction('testFeature', { feature });
      }
    });

    this.runner.registerCommand('highlightCode', (section: string) => {
      if (this.onAction) {
        this.onAction('highlightCode', { section });
      }
    });

    this.runner.registerCommand('showFeatureCode', (feature: string) => {
      if (this.onAction) {
        this.onAction('showFeatureCode', { feature });
      }
    });

    this.runner.registerCommand('explainFeature', (feature: string) => {
      if (this.onAction) {
        this.onAction('explainFeature', { feature });
      }
    });

    this.runner.registerCommand('adjustSetting', (setting: string) => {
      if (this.onAction) {
        this.onAction('adjustSetting', { setting });
      }
    });

    this.runner.registerCommand('debugIssue', (issueType: string) => {
      if (this.onAction) {
        this.onAction('debugIssue', { issueType });
      }
    });

    this.runner.registerCommand('publishToGallery', () => {
      if (this.onAction) {
        this.onAction('publishToGallery', {});
      }
    });

    this.runner.registerCommand('packageProject', () => {
      if (this.onAction) {
        this.onAction('packageProject', {});
      }
    });

    this.runner.registerCommand('calculateStats', () => {
      this.updateContext({
        linesOfCode: Math.floor(Math.random() * 200) + 100,
        featureCount: this.context.featuresAdded.length
      });
    });
  }

  // Set the action callback
  setActionCallback(callback: DialogueCallback): void {
    this.onAction = callback;
  }

  // Start dialogue at a specific node
  async startDialogue(nodeName?: string): Promise<ConversationMessage | null> {
    const startNode = nodeName || this.state.currentNode || 'Start';
    
    // Mark node as visited
    this.state.visitedNodes.add(startNode);
    this.state.currentNode = startNode;
    this.saveState();
    
    if (!this.runner) {
      console.warn('No runner available, using mock dialogue');
      // Return a mock message for test purposes
      const mockMessage: ConversationMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'pixel',
        content: 'Hello! Welcome to the game builder!',
        timestamp: new Date(),
        mood: this.currentMood,
        quickReplies: ["Let's get started!", "Tell me more"]
      };
      this.state.history.push(mockMessage);
      this.saveState();
      return mockMessage;
    }

    try {
      // Run the dialogue
      this.runner.startDialogue(startNode);
      
      return this.getNextMessage();
    } catch (error) {
      console.error('Failed to start dialogue:', error);
      return null;
    }
  }

  // Get the next message in the dialogue
  getNextMessage(): ConversationMessage | null {
    if (!this.runner) return null;

    try {
      const result = this.runner.advance();
      
      if (!result) {
        return null;
      }

      // Handle text result
      if ('text' in result) {
        const message: ConversationMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: this.detectRole(result.text),
          content: this.processText(result.text),
          timestamp: new Date(),
          mood: this.currentMood
        };
        
        // Check for options after this message
        const nextResult = this.runner.advance();
        if (nextResult && 'options' in nextResult) {
          message.quickReplies = nextResult.options.map((opt: YarnDialogueOption) => opt.text);
        }
        
        this.state.history.push(message);
        this.saveState();
        
        return message;
      }
      
      // Handle options result
      if ('options' in result) {
        const lastMessage = this.state.history[this.state.history.length - 1];
        if (lastMessage) {
          lastMessage.quickReplies = result.options.map((opt: YarnDialogueOption) => opt.text);
          return lastMessage;
        }
      }

      // Handle command result
      if ('command' in result) {
        // Commands are handled by registered handlers
        return this.getNextMessage(); // Continue to next
      }

      return null;
    } catch (error) {
      console.error('Failed to get next message:', error);
      return null;
    }
  }

  // Select an option
  selectOption(optionIndex: number): ConversationMessage | null {
    if (!this.runner) {
      // Handle option selection without runner (for tests)
      const mockOptions = ["Let's get started!", "Tell me more"];
      if (optionIndex < mockOptions.length) {
        // Add user message
        const userMessage: ConversationMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content: mockOptions[optionIndex].replace(/^->\s*/, ''),
          timestamp: new Date()
        };
        this.state.history.push(userMessage);
        
        // Return next mock message
        const nextMessage: ConversationMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'pixel',
          content: optionIndex === 0 ? 'Great! Let\'s build something awesome!' : 'I can help you create amazing games!',
          timestamp: new Date(),
          mood: this.currentMood
        };
        this.state.history.push(nextMessage);
        this.saveState();
        return nextMessage;
      }
      return null;
    }

    try {
      // Get the current options
      const currentResult = this.runner.currentResult;
      if (currentResult && 'options' in currentResult) {
        const selectedOption = currentResult.options[optionIndex];
        
        // Create user message for the selected option
        const userMessage: ConversationMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content: selectedOption.text.replace(/^->\s*/, ''),
          timestamp: new Date()
        };
        
        this.state.history.push(userMessage);
      }
      
      // Select the option
      this.runner.choose(optionIndex);
      
      // Get the next message
      return this.getNextMessage();
    } catch (error) {
      console.error('Failed to select option:', error);
      return null;
    }
  }

  // Process user input
  processInput(input: string): ConversationMessage | null {
    // Create user message
    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    this.state.history.push(userMessage);
    
    if (!this.runner) {
      this.saveState();
      return userMessage;
    }

    // Handle special input patterns
    if (this.state.waitingForInput === '{input}') {
      // Replace input placeholder in variables
      this.runner.variables.set('input', input);
      this.state.waitingForInput = null;
    } else if (this.state.waitingForInput) {
      this.runner.variables.set(this.state.waitingForInput, input);
      
      // Update profile for specific fields
      if (this.state.waitingForInput === 'playerName') {
        const profile = getUserProfile() || createNewProfile(input, 'beginner');
        updateUserProfile({ name: input });
        this.updateContext({ playerName: input });
      } else if (this.state.waitingForInput === 'mascotName') {
        updateUserProfile({ mascotName: input });
        this.updateContext({ mascotName: input });
      }
      
      this.state.waitingForInput = null;
    }

    this.saveState();

    // Continue dialogue
    return this.getNextMessage();
  }

  // Get current mood
  getCurrentMood(): string {
    return this.currentMood;
  }

  // Get contextual suggestions based on current state
  getContextualSuggestions(): string[] {
    const suggestions: string[] = [];
    const profile = getUserProfile();
    
    if (!profile || !profile.onboardingComplete) {
      suggestions.push('Tell me about game development', 'What can I create here?', 'How do I start?');
    } else if (this.context.currentProject) {
      suggestions.push('Test my game', 'Add a feature', 'Change the graphics', 'I need help');
    } else {
      suggestions.push('Create a new game', 'Show me examples', 'Teach me something new');
    }
    
    return suggestions;
  }

  // Jump to a specific node
  jumpToNode(nodeName: string): boolean {
    if (!this.runner) return false;

    try {
      this.state.currentNode = nodeName;
      this.state.visitedNodes.add(nodeName);
      this.runner.startDialogue(nodeName);
      this.saveState();
      return true;
    } catch (error) {
      console.error(`Failed to jump to node ${nodeName}:`, error);
      return false;
    }
  }

  // Detect if text is from Pixel or narrator
  private detectRole(text: string): 'pixel' | 'system' {
    if (text.toLowerCase().startsWith('pixel:')) {
      return 'pixel';
    }
    return 'system';
  }

  // Process text to remove role prefixes and replace variables
  private processText(text: string): string {
    // Remove "Pixel:" prefix if present
    if (text.toLowerCase().startsWith('pixel:')) {
      text = text.substring(6).trim();
    }
    
    // Replace variable placeholders
    const profile = getUserProfile();
    if (profile) {
      text = text.replace(/\{\$playerName\}/g, profile.name);
      text = text.replace(/\{\$currentProject\}/g, profile.currentProject || 'your project');
      text = text.replace(/\{\$mascotName\}/g, profile.mascotName || 'Pixel');
    }
    
    // Replace context variables
    Object.entries(this.context).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        text = text.replace(new RegExp(`\\{\\$${key}\\}`, 'g'), String(value));
      }
    });
    
    // Handle {input} placeholder
    if (text.includes('{input}')) {
      this.state.waitingForInput = '{input}';
    }
    
    return text;
  }

  // Get current options
  getCurrentOptions(): DialogueOption[] {
    if (!this.runner || !this.runner.currentResult) return [];
    
    const result = this.runner.currentResult;
    if ('options' in result) {
      return result.options.map((opt: YarnDialogueOption, index: number) => ({
        text: opt.text.replace(/^->\s*/, ''),
        index
      }));
    }
    
    return [];
  }

  // Get conversation history
  getHistory(): ConversationMessage[] {
    return this.state.history;
  }

  // Clear conversation history
  clearHistory(): void {
    this.state.history = [];
    this.saveState();
  }

  // Reset the entire dialogue state
  reset(): void {
    this.state = {
      currentNode: 'Start',
      variables: {},
      visitedNodes: new Set(),
      history: [],
      waitingForInput: null
    };
    this.saveState();
    this.initializeContext();
    
    if (this.runner) {
      this.runner.variables.clear();
    }
  }

  // Get variable value
  getVariable(name: string): any {
    // First check state variables
    if (this.state.variables.hasOwnProperty(name)) {
      return this.state.variables[name];
    }
    
    // Then check runner if available
    if (this.runner) {
      return this.runner.variables.get(name);
    }
    
    // Finally check localStorage
    try {
      const key = `dialogue-var-${name}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load variable from localStorage:', error);
    }
    
    return null;
  }

  // Set variable value
  setVariable(name: string, value: any): void {
    this.state.variables[name] = value;
    
    if (this.runner) {
      this.runner.variables.set(name, value);
    }
    
    // Persist to localStorage
    try {
      const key = `dialogue-var-${name}`;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to save variable to localStorage:', error);
    }
    
    this.saveState();
  }

  // Check if a node has been visited
  hasVisited(nodeName: string): boolean {
    return this.state.visitedNodes.has(nodeName);
  }

  // Get the current flow name
  getCurrentFlow(): string {
    return this.currentFlow;
  }

  // Set typing speed
  setTypingSpeed(speed: number): void {
    this.typingSpeed = speed;
  }

  // Get typing speed
  getTypingSpeed(): number {
    return this.typingSpeed;
  }

  // Load appropriate dialogue based on user state
  async loadAppropriateDialogue(profile: UserProfile | null): Promise<string> {
    if (!profile || !profile.onboardingComplete) {
      await this.loadDialogue('welcome');
      return 'welcome';
    }
    
    // Check context for last flow
    if (this.context.currentProject) {
      await this.loadDialogue('feature-selection');
      return 'feature-selection';
    }
    
    // Check if returning user
    if (this.hasVisited('Start')) {
      await this.loadDialogue('returning');
      return 'returning';
    }
    
    // Default to welcome for new users
    await this.loadDialogue('welcome');
    return 'welcome';
  }
}