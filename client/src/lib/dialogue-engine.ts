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

  constructor() {
    this.state = this.loadState();
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

  // Load a dialogue file
  async loadDialogue(flowName: string): Promise<boolean> {
    try {
      const response = await fetch(`${DIALOGUE_BASE_PATH}${flowName}.yarn`);
      if (!response.ok) {
        throw new Error(`Failed to load dialogue: ${flowName}`);
      }
      
      const content = await response.text();
      this.dialogueFiles.set(flowName, content);
      this.currentFlow = flowName;
      
      // Initialize yarn-bound runner
      await this.initializeRunner(content);
      
      return true;
    } catch (error) {
      console.error(`Failed to load dialogue ${flowName}:`, error);
      return false;
    }
  }

  // Initialize the yarn-bound runner
  private async initializeRunner(yarnContent: string): Promise<void> {
    try {
      // Create a new runner with the Yarn content
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
    } catch (error) {
      console.error('Failed to initialize runner:', error);
    }
  }

  // Register custom Yarn commands
  private registerCustomCommands(): void {
    if (!this.runner) return;

    // Navigation command
    this.runner.registerCommand('navigate', (page: string) => {
      if (this.onAction) {
        this.onAction('navigate', { page });
      }
    });

    // Create project command
    this.runner.registerCommand('createProject', (template: string) => {
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
    });

    // Start lesson command
    this.runner.registerCommand('startLesson', (lessonId: string) => {
      if (this.onAction) {
        this.onAction('startLesson', { lessonId });
      }
    });

    // Show code example
    this.runner.registerCommand('showCodeExample', (concept: string) => {
      if (this.onAction) {
        this.onAction('showCodeExample', { concept });
      }
    });

    // Highlight code section
    this.runner.registerCommand('highlightCode', (section: string) => {
      if (this.onAction) {
        this.onAction('highlightCode', { section });
      }
    });

    // Set controls
    this.runner.registerCommand('setControls', (controlType: string) => {
      if (this.onAction) {
        this.onAction('setControls', { controlType });
      }
    });

    // Show error fix
    this.runner.registerCommand('showErrorFix', (errorType: string) => {
      if (this.onAction) {
        this.onAction('showErrorFix', { errorType });
      }
    });

    // Generate practice
    this.runner.registerCommand('generatePractice', (difficulty: string) => {
      if (this.onAction) {
        this.onAction('generatePractice', { difficulty });
      }
    });

    // Navigate to next lesson
    this.runner.registerCommand('navigateNextLesson', () => {
      if (this.onAction) {
        this.onAction('navigateNextLesson', {});
      }
    });

    // Check for errors
    this.runner.registerCommand('checkForErrors', () => {
      if (this.onAction) {
        this.onAction('checkForErrors', {});
      }
    });

    // Auto fix errors
    this.runner.registerCommand('autoFix', () => {
      if (this.onAction) {
        this.onAction('autoFix', {});
      }
    });

    // Refresh project
    this.runner.registerCommand('refreshProject', () => {
      if (this.onAction) {
        this.onAction('refreshProject', {});
      }
    });

    // Show feature code
    this.runner.registerCommand('showFeatureCode', (feature: string) => {
      if (this.onAction) {
        this.onAction('showFeatureCode', { feature });
      }
    });

    // Suggest difficulty values
    this.runner.registerCommand('suggestDifficultyValues', () => {
      if (this.onAction) {
        this.onAction('suggestDifficultyValues', {});
      }
    });
  }

  // Set the action callback
  setActionCallback(callback: DialogueCallback): void {
    this.onAction = callback;
  }

  // Start dialogue at a specific node
  async startDialogue(nodeName?: string): Promise<ConversationMessage | null> {
    if (!this.runner) {
      console.error('No dialogue loaded');
      return null;
    }

    try {
      const startNode = nodeName || this.state.currentNode || 'Start';
      
      // Mark node as visited
      this.state.visitedNodes.add(startNode);
      
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
          timestamp: new Date()
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

      // Handle command result (already processed by registered commands)
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
    if (!this.runner) return null;

    try {
      // Select the option
      this.runner.choose(optionIndex);
      
      // Get the next message
      return this.getNextMessage();
    } catch (error) {
      console.error('Failed to select option:', error);
      return null;
    }
  }

  // Handle user input (for free text responses)
  handleUserInput(input: string): ConversationMessage | null {
    if (!this.runner) return null;

    // Store input as a variable if waiting for input
    if (this.state.waitingForInput) {
      this.runner.variables.set(this.state.waitingForInput, input);
      
      // Also update user profile if it's the player name
      if (this.state.waitingForInput === 'playerName') {
        const profile = getUserProfile() || createNewProfile(input, 'beginner');
        saveUserProfile(profile);
      }
      
      this.state.waitingForInput = null;
    }

    // Create user message
    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    this.state.history.push(userMessage);
    this.saveState();

    // Continue dialogue
    return this.getNextMessage();
  }

  // Detect if text is from Pixel or narrator
  private detectRole(text: string): 'pixel' | 'system' {
    if (text.toLowerCase().startsWith('pixel:')) {
      return 'pixel';
    }
    return 'system';
  }

  // Process text to remove role prefixes
  private processText(text: string): string {
    // Remove "Pixel:" prefix if present
    if (text.toLowerCase().startsWith('pixel:')) {
      return text.substring(6).trim();
    }
    
    // Replace variable placeholders
    const profile = getUserProfile();
    if (profile) {
      text = text.replace(/\{\$playerName\}/g, profile.name);
      text = text.replace(/\{\$currentProject\}/g, profile.currentProject || 'your project');
      text = text.replace(/\{\$mascotName\}/g, profile.mascotName || 'Pixel');
    }
    
    return text;
  }

  // Get current options
  getCurrentOptions(): DialogueOption[] {
    const lastMessage = this.state.history[this.state.history.length - 1];
    if (lastMessage?.quickReplies) {
      return lastMessage.quickReplies.map((text, index) => ({
        text,
        index
      }));
    }
    return [];
  }

  // Jump to a specific node
  jumpToNode(nodeName: string): ConversationMessage | null {
    if (!this.runner) return null;

    try {
      this.state.currentNode = nodeName;
      this.runner.startDialogue(nodeName);
      return this.getNextMessage();
    } catch (error) {
      console.error(`Failed to jump to node ${nodeName}:`, error);
      return null;
    }
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
    
    if (this.runner) {
      this.runner.variables.clear();
    }
  }

  // Get variable value
  getVariable(name: string): any {
    if (!this.runner) return null;
    return this.runner.variables.get(name);
  }

  // Set variable value
  setVariable(name: string, value: any): void {
    if (!this.runner) return;
    this.runner.variables.set(name, value);
    this.state.variables[name] = value;
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

  // Load appropriate dialogue based on user state
  async loadAppropriateDialogue(profile: UserProfile | null): Promise<string> {
    if (!profile || !profile.onboardingComplete) {
      await this.loadDialogue('onboarding');
      return 'onboarding';
    }
    
    // Check if returning user
    if (this.hasVisited('Start')) {
      await this.loadDialogue('returning');
      return 'returning';
    }
    
    // Default to onboarding for new users
    await this.loadDialogue('onboarding');
    return 'onboarding';
  }
}