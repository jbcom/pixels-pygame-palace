import { 
  WizardNode, 
  DeviceState, 
  LayoutMode,
  SessionActions
} from './wizard-types';
import { BREAKPOINTS, GAME_TYPE_ICONS } from './wizard-constants';

// Device detection utilities
export const detectDevice = (): DeviceState => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < BREAKPOINTS.MOBILE_MAX_WIDTH;
  const isLandscape = width > height;

  return {
    isMobile,
    isLandscape,
    screenWidth: width,
    screenHeight: height,
  };
};

// Determine layout mode based on device state
export const getLayoutMode = (deviceState: DeviceState): LayoutMode => {
  // Only phones get special mobile layouts, tablets use desktop
  if (!deviceState.isMobile) return 'desktop';
  if (deviceState.isLandscape) return 'phone-landscape';
  return 'phone-portrait';
};

// Extract game type from option text
export const extractGameType = (optionText: string): string | null => {
  const gameTypeMatch = optionText.match(/^(\w+)\s*-/);
  return gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
};

// Get icon for game type
export const getGameTypeIcon = (optionText: string): any => {
  const gameType = extractGameType(optionText);
  if (gameType && GAME_TYPE_ICONS[gameType]) {
    return GAME_TYPE_ICONS[gameType];
  }
  // Return default icon if no game type found
  return null;
};

// Check if should show options
export const shouldShowOptions = (
  currentNode: WizardNode | null, 
  dialogueStep: number
): boolean => {
  if (!currentNode) return false;
  
  if (currentNode.multiStep) {
    return dialogueStep >= currentNode.multiStep.length - 1 && !!currentNode.options;
  }
  
  return !!currentNode.options;
};

// Check if should show continue button
export const shouldShowContinue = (
  currentNode: WizardNode | null,
  dialogueStep: number
): boolean => {
  if (!currentNode) return false;
  
  if (currentNode.multiStep) {
    return dialogueStep < currentNode.multiStep.length - 1;
  }
  
  return false;
};

// Get current dialogue text
export const getCurrentText = (
  currentNode: WizardNode | null,
  dialogueStep: number
): string => {
  if (!currentNode) return '';
  
  if (currentNode.multiStep) {
    return currentNode.multiStep[dialogueStep];
  }
  
  return currentNode.text || '';
};

// Update session actions based on option selection
export const updateSessionActionsForOption = (
  sessionActions: SessionActions,
  optionText: string
): SessionActions => {
  const updatedActions = {
    ...sessionActions,
    choices: [...sessionActions.choices, optionText]
  };

  // Handle special game type actions
  if (optionText.includes('RPG')) {
    updatedActions.gameType = 'rpg';
  } else if (optionText.includes('Platformer')) {
    updatedActions.gameType = 'platformer';
  } else if (optionText.includes('Racing')) {
    updatedActions.gameType = 'racing';
  }

  return updatedActions;
};

// Load wizard flow data
export const loadWizardFlow = async (path: string): Promise<Record<string, WizardNode>> => {
  try {
    const response = await fetch(path);
    const data = await response.json();
    // Support both nested and flat structure
    return data.nodes || data;
  } catch (error) {
    console.error('Failed to load wizard flow:', error);
    throw error;
  }
};

// Determine if option grid should be used
export const shouldUseOptionGrid = (optionCount: number, isMobile: boolean): boolean => {
  return !isMobile && optionCount > 4;
};

// Get button variant based on context
export const getButtonVariant = (
  isMobile: boolean,
  optionCount: number
): 'outline' | 'default' => {
  if (isMobile) return 'outline';
  if (optionCount > 4) return 'outline';
  return 'default';
};

// Get button size based on device
export const getButtonSize = (isMobile: boolean): 'lg' | 'default' => {
  return isMobile ? 'lg' : 'default';
};

// Format test id
export const formatTestId = (prefix: string, index: number): string => {
  return `${prefix}-${index}`;
};