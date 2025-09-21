import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  WizardNode, 
  DialogueState, 
  SessionActions 
} from './wizard-types';
import { 
  getCurrentText, 
  shouldShowOptions, 
  shouldShowContinue,
  updateSessionActionsForOption,
  loadWizardFlow
} from './wizard-utils';
import { 
  WIZARD_FLOW_PATH, 
  INITIAL_NODE_ID,
  STYLES,
  ANIMATIONS
} from './wizard-constants';

interface UseWizardDialogueProps {
  initialNodeId?: string;
  wizardFlowPath?: string;
  flowType?: 'default' | 'game-dev';
}

// Custom hook for managing wizard dialogue state
export function useWizardDialogue({ 
  initialNodeId = INITIAL_NODE_ID,
  wizardFlowPath = WIZARD_FLOW_PATH,
  flowType = 'default' 
}: UseWizardDialogueProps = {}) {
  const [wizardData, setWizardData] = useState<Record<string, WizardNode> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogueState, setDialogueState] = useState<DialogueState>({
    currentNodeId: initialNodeId,
    currentNode: null,
    dialogueStep: 0,
    carouselIndex: 0,
    showAllChoices: false,
  });
  const [sessionActions, setSessionActions] = useState<SessionActions>({
    choices: [],
    createdAssets: [],
    gameType: null,
    currentProject: null,
    completedSteps: [],
    unlockedEditor: false
  });
  
  // Track the currently loaded flow path, loading state, and failed attempts
  const [loadedFlowPath, setLoadedFlowPath] = useState<string | null>(null);
  const [isFlowLoading, setIsFlowLoading] = useState(false);
  const [failedFlowPaths, setFailedFlowPaths] = useState<Set<string>>(new Set());

  // Load wizard flow data
  useEffect(() => {
    // Determine which flow to load based on game type
    let flowPath = wizardFlowPath;
    
    // If we have a selected game type, load that specific flow
    // Check both gameType and selectedGameType for compatibility
    const gameType = sessionActions.selectedGameType || sessionActions.gameType;
    
    // Check if we should load a specialized flow
    // This happens when:
    // 1. We have a gameType set AND
    // 2. Either we're explicitly transitioning OR the current flow doesn't match the gameType
    // 3. AND we haven't already failed to load this flow
    const specializedFlowPath = gameType ? `/${gameType}-flow.json` : null;
    const shouldLoadSpecializedFlow = gameType && 
      !failedFlowPaths.has(specializedFlowPath || '') && (
        sessionActions.transitionToSpecializedFlow || 
        (loadedFlowPath !== specializedFlowPath)
      );
    
    if (shouldLoadSpecializedFlow) {
      // Load specialized flow when we have gameType
      const specializedFlowPath = `/${gameType}-flow.json`;
      flowPath = specializedFlowPath;
      console.log('Loading specialized flow for gameType:', gameType, 'Path:', specializedFlowPath);
    } else if (flowType === 'game-dev' && !gameType) {
      // Fallback to generic game flow if no specific type selected
      flowPath = '/game-wizard-flow.json';
      console.log('Loading generic game flow');
    }
    
    // Skip loading if we already have the right flow loaded or if we're currently loading
    if (loadedFlowPath === flowPath) {
      console.log('Flow already loaded, skipping:', flowPath);
      // Clear transition flag if it's set but we already have the right flow
      if (sessionActions.transitionToSpecializedFlow) {
        setSessionActions(prev => ({ ...prev, transitionToSpecializedFlow: false }));
      }
      return;
    }
    
    // Prevent concurrent flow loads
    if (isFlowLoading) {
      console.log('Flow is already loading, skipping duplicate load request');
      return;
    }
    
    console.log('Loading flow from:', flowPath, 'Previously loaded:', loadedFlowPath);
    setIsFlowLoading(true);
    
    loadWizardFlow(flowPath)
      .then(nodes => {
        console.log('Successfully loaded flow:', flowPath, 'Nodes count:', Object.keys(nodes).length);
        setWizardData(nodes);
        setLoadedFlowPath(flowPath);
        
        // When loading a specialized flow, start from the beginning
        const startNodeId = gameType && flowPath.includes(gameType) ? 'start' : initialNodeId;
        console.log('Setting start node to:', startNodeId);
        
        if (nodes[startNodeId]) {
          setDialogueState(prev => ({
            ...prev,
            currentNodeId: startNodeId,
            currentNode: nodes[startNodeId],
            dialogueStep: 0,
            carouselIndex: 0,
            showAllChoices: false
          }));
          console.log('Dialogue state updated with node:', nodes[startNodeId]?.text?.substring(0, 50) + '...');
        } else {
          console.error('Start node not found in loaded flow:', startNodeId, 'Available nodes:', Object.keys(nodes));
        }
        
        // Clear the transition flag after successful load
        // Use a timeout to ensure state updates happen after the current render cycle
        setTimeout(() => {
          setSessionActions(prev => ({ ...prev, transitionToSpecializedFlow: false }));
        }, 0);
        
        setIsLoading(false);
        setIsFlowLoading(false);
      })
      .catch(error => {
        console.error(`Failed to load wizard flow from ${flowPath}:`, error);
        
        // Mark this flow path as failed to prevent retry loops
        setFailedFlowPaths(prev => new Set(prev).add(flowPath));
        
        // Clear the transition flag since we failed to load the specialized flow
        if (sessionActions.transitionToSpecializedFlow) {
          setTimeout(() => {
            setSessionActions(prev => ({ ...prev, transitionToSpecializedFlow: false }));
          }, 0);
        }
        
        // Try fallback to default flow only if we're not already on it
        if (flowPath !== wizardFlowPath && !failedFlowPaths.has(wizardFlowPath)) {
          console.log('Attempting fallback to default flow:', wizardFlowPath);
          loadWizardFlow(wizardFlowPath)
            .then(nodes => {
              setWizardData(nodes);
              setLoadedFlowPath(wizardFlowPath);
              if (nodes[initialNodeId]) {
                setDialogueState(prev => ({
                  ...prev,
                  currentNodeId: initialNodeId,
                  currentNode: nodes[initialNodeId],
                  dialogueStep: 0,
                  carouselIndex: 0,
                  showAllChoices: false
                }));
              }
              setIsLoading(false);
              setIsFlowLoading(false);
            })
            .catch(fallbackError => {
              console.error('Failed to load fallback flow:', fallbackError);
              setFailedFlowPaths(prev => new Set(prev).add(wizardFlowPath));
              setIsLoading(false);
              setIsFlowLoading(false);
            });
        } else {
          setIsLoading(false);
          setIsFlowLoading(false);
          
          // If we can't load any flow, stay with the current flow if available
          if (!wizardData && loadedFlowPath) {
            console.log('No flow data available, staying with current flow');
          }
        }
      });
  }, [wizardFlowPath, initialNodeId, flowType, sessionActions.selectedGameType, sessionActions.gameType, sessionActions.transitionToSpecializedFlow]);

  // Update current node when ID changes
  useEffect(() => {
    if (wizardData && dialogueState.currentNodeId) {
      const node = wizardData[dialogueState.currentNodeId];
      if (node) {
        setDialogueState(prev => ({
          ...prev,
          currentNode: node,
          dialogueStep: 0,
          carouselIndex: 0,
          showAllChoices: false,
        }));
      }
    }
  }, [dialogueState.currentNodeId, wizardData]);

  // Navigation functions
  const navigateToNode = useCallback((nodeId: string) => {
    setDialogueState(prev => ({
      ...prev,
      currentNodeId: nodeId
    }));
  }, []);

  const handleOptionSelect = useCallback((option: any) => {
    console.log('Option selected:', option.text, 'Action:', option.action);
    
    // Update session actions
    if (option.text) {
      setSessionActions(prev => updateSessionActionsForOption(prev, option.text));
    }
    
    // Handle setVariable if present
    if (option.setVariable) {
      setSessionActions(prev => ({ 
        ...prev, 
        ...option.setVariable,
        // Ensure selectedGameType is also set for flow loading
        selectedGameType: option.setVariable.gameType || prev.selectedGameType
      }));
      console.log('Set variable:', option.setVariable);
    }
    
    // Handle transitionToSpecializedFlow action
    if (option.action === 'transitionToSpecializedFlow') {
      console.log('Setting transitionToSpecializedFlow flag for gameType:', option.setVariable?.gameType || sessionActions.gameType);
      setSessionActions(prev => ({ 
        ...prev, 
        transitionToSpecializedFlow: true
      }));
      
      // Don't navigate immediately - let the flow loading handle it
      // This prevents race conditions between navigation and flow loading
      if (!option.next) {
        console.log('No next node specified, will load specialized flow start node');
        // Return early to prevent navigation
        return option;
      }
    }
    
    // Navigate to next node (unless we're transitioning to specialized flow without a next)
    if (option.next) {
      console.log('Navigating to next node:', option.next);
      navigateToNode(option.next);
    } else if (option.action === 'transitionToSpecializedFlow') {
      // For transitionToSpecializedFlow without a next, trigger a state change
      // This ensures the useEffect will run to load the new flow
      console.log('Triggering flow transition without explicit navigation');
    }
    
    // Return the option for additional handling in the parent component
    return option;
  }, [navigateToNode]);

  const advance = useCallback(() => {
    const { currentNode, dialogueStep } = dialogueState;
    if (!currentNode) return;
    
    if (currentNode.multiStep && dialogueStep < currentNode.multiStep.length - 1) {
      setDialogueState(prev => ({
        ...prev,
        dialogueStep: prev.dialogueStep + 1
      }));
    }
  }, [dialogueState]);

  return {
    wizardData,
    dialogueState,
    sessionActions,
    isLoading,
    navigateToNode,
    handleOptionSelect,
    advance,
    setSessionActions,
  };
}

interface DialogueTextProps {
  text: string;
  nodeId: string;
  dialogueStep: number;
  className?: string;
}

// Dialogue text component with animation
export function DialogueText({ 
  text, 
  nodeId, 
  dialogueStep,
  className = '' 
}: DialogueTextProps) {
  if (!text) return null;

  return (
    <motion.div
      key={`${nodeId}-${dialogueStep}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-center ${className}`}
    >
      <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
        {text}
      </p>
    </motion.div>
  );
}

interface DialogueBoxProps {
  text: string;
  className?: string;
  variant?: 'default' | 'mobile';
}

// Dialogue box component for mobile layouts
export function DialogueBox({ 
  text, 
  className = '',
  variant = 'default'
}: DialogueBoxProps) {
  const baseStyles = STYLES.DIALOGUE_BG;
  const paddingStyles = variant === 'mobile' ? 'p-4' : 'p-3';
  const textSize = variant === 'mobile' ? 'text-base' : 'text-sm';

  return (
    <motion.div 
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: ANIMATIONS.FADE_IN.delay }}
    >
      <div className={`w-full ${baseStyles} ${paddingStyles}`}>
        <p className={`text-center ${textSize} text-gray-700 dark:text-gray-300 leading-relaxed`}>
          {text}
        </p>
      </div>
    </motion.div>
  );
}

// Helper functions for dialogue state
export function getDialogueHelpers(dialogueState: DialogueState, sessionActions?: SessionActions) {
  const { currentNode, dialogueStep } = dialogueState;
  
  return {
    getCurrentText: () => getCurrentText(currentNode, dialogueStep, sessionActions),
    shouldShowOptions: () => shouldShowOptions(currentNode, dialogueStep),
    shouldShowContinue: () => shouldShowContinue(currentNode, dialogueStep),
  };
}