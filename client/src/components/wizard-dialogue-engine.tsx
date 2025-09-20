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

  // Load wizard flow data
  useEffect(() => {
    // Determine which flow to load
    let flowPath = wizardFlowPath;
    if (flowType === 'game-dev') {
      flowPath = '/game-wizard-flow.json';
    }
    
    loadWizardFlow(flowPath)
      .then(nodes => {
        setWizardData(nodes);
        if (nodes[initialNodeId]) {
          setDialogueState(prev => ({
            ...prev,
            currentNode: nodes[initialNodeId]
          }));
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load wizard flow:', error);
        setIsLoading(false);
      });
  }, [wizardFlowPath, initialNodeId, flowType]);

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
    // Update session actions
    if (option.text) {
      setSessionActions(prev => updateSessionActionsForOption(prev, option.text));
    }
    
    // Handle setVariable if present
    if (option.setVariable) {
      setSessionActions(prev => ({ ...prev, ...option.setVariable }));
    }
    
    // Navigate to next node
    if (option.next) {
      navigateToNode(option.next);
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