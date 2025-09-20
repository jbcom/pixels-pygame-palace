import { ComponentType } from 'react';

// Main component props
export interface UniversalWizardProps {
  className?: string;
  assetMode?: 'curated' | 'full';
  editorLocked?: boolean;
}

// Core wizard node structure
export interface WizardNode {
  id: string;
  text?: string;
  multiStep?: string[];
  options?: WizardOption[];
  action?: string;
  params?: Record<string, any>;
  tags?: string[];
  conditional?: {
    condition: string;
    trueNext?: string;
    falseNext?: string;
  };
}

// Wizard option
export interface WizardOption {
  text: string;
  next: string;
}

// Session Actions for tracking user progress
export interface SessionActions {
  choices: string[];
  createdAssets: string[];
  gameType: string | null;
  currentProject: string | null;
  completedSteps: string[];
  unlockedEditor: boolean;
}

// Session action for PixelMenu
export interface SessionAction {
  id: string;
  type: 'game_created' | 'lesson_completed' | 'asset_selected' | 'code_generated' | 'settings_changed';
  title: string;
  description?: string;
  timestamp: Date;
  icon: ComponentType<any>;
}

// Layout modes
export type LayoutMode = 'desktop' | 'phone-portrait' | 'phone-landscape';

// Embedded component types
export type EmbeddedComponentType = 'none' | 'code-editor' | 'professional-editor' | 'block-builder';

// Pixel state
export type PixelState = 'center-stage' | 'minimized';

// Device state
export interface DeviceState {
  isMobile: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
}

// Dialogue state
export interface DialogueState {
  currentNodeId: string;
  currentNode: WizardNode | null;
  dialogueStep: number;
  carouselIndex: number;
  showAllChoices: boolean;
}

// UI state
export interface UIState {
  pixelMenuOpen: boolean;
  embeddedComponent: EmbeddedComponentType;
  pixelState: PixelState;
  wysiwygEditorOpen?: boolean;
  assetBrowserOpen?: boolean;
  assetBrowserType?: 'sprite' | 'sound' | 'music' | 'background' | 'all';
  selectedGameType?: string;
}

// Edge swipe handler options
export interface EdgeSwipeOptions {
  onEdgeSwipe: (edge: string) => void;
  edgeThreshold?: number;
  enabled?: boolean;
}