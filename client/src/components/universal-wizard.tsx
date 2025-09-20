import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Gamepad2, 
  Sparkles,
  BookOpen,
  Code2,
  Swords,
  Trophy,
  Car,
  Map,
  Puzzle,
  ChevronRight
} from "lucide-react";
import LessonsPage from "@/pages/lessons";
import ProjectBuilderEnhanced from "@/pages/project-builder-enhanced";
import AssetSelector from "@/components/asset-selector";

// Import Pixel images
import pixelWelcoming from '@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png';
import pixelGaming from '@assets/pixel/Pixel_gaming_focused_expression_6f3fdfab.png';
import pixelTeaching from '@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png';
import pixelExcited from '@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png';
import pixelThinking from '@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png';
import pixelCoding from '@assets/pixel/Pixel_coding_programming_expression_56de8ca0.png';
import pixelHappy from '@assets/pixel/Pixel_happy_excited_expression_22a41625.png';

type PixelState = 'center-stage' | 'corner-waiting' | 'expanded';
type EmbeddedComponent = 'none' | 'editor' | 'lessons' | 'assets' | 'help';

interface DialogueOption {
  text: string;
  next?: string;
  action?: string;
  actionParams?: any;
  setVariable?: Record<string, any>;
}

interface DialogueNode {
  id: string;
  speaker: string;
  text?: string;
  followUp?: string;
  conditionalText?: Record<string, Record<string, string>>;
  conditionalFollowUp?: Record<string, Record<string, string>>;
  conditionalAction?: Record<string, Record<string, any>>;
  options?: DialogueOption[];
  action?: string;
  next?: string;
}

interface WizardFlow {
  nodes: Record<string, DialogueNode>;
  startNode: string;
}

interface UniversalWizardProps {
  dialoguePath?: string;
  startNode?: string;
}

export default function UniversalWizard({ 
  dialoguePath = '/wizard-flow.json',
  startNode = 'start' 
}: UniversalWizardProps) {
  const [, setLocation] = useLocation();
  const [wizardFlow, setWizardFlow] = useState<WizardFlow | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>(startNode);
  const [currentNode, setCurrentNode] = useState<DialogueNode | null>(null);
  const [pixelState, setPixelState] = useState<PixelState>('center-stage');
  const [pixelImage, setPixelImage] = useState(pixelWelcoming);
  const [embeddedComponent, setEmbeddedComponent] = useState<EmbeddedComponent>('none');
  const [assetConfig, setAssetConfig] = useState<{ type: string; scene: string } | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dialogueStep, setDialogueStep] = useState<'text' | 'followUp'>('text');

  // Icon mapping for game types
  const gameTypeIcons: Record<string, React.ComponentType<any>> = {
    'rpg': Swords,
    'platformer': Gamepad2,
    'dungeon': Map,
    'racing': Car,
    'puzzle': Puzzle,
    'adventure': Trophy
  };

  // Load JSON dialogue flow
  useEffect(() => {
    const loadDialogue = async () => {
      try {
        const response = await fetch(dialoguePath);
        if (!response.ok) {
          throw new Error(`Failed to load dialogue: ${response.status}`);
        }
        const flow: WizardFlow = await response.json();
        
        console.log('Loaded wizard flow with', Object.keys(flow.nodes).length, 'nodes');
        setWizardFlow(flow);
        
        // Set initial node
        const initialNode = flow.nodes[flow.startNode];
        if (initialNode) {
          setCurrentNode(initialNode);
          setCurrentNodeId(flow.startNode);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load dialogue:', error);
        setIsLoading(false);
        // Fallback to a basic start
        const fallbackNode: DialogueNode = {
          id: 'start',
          speaker: 'Pixel',
          text: 'Hey there! Welcome to Pixel\'s PyGame Palace! I\'m Pixel, your game-making buddy! 🎮',
          options: [
            { text: 'Build a game!', next: 'gamePath' },
            { text: 'Learn Python first', next: 'learnPath' }
          ]
        };
        setCurrentNode(fallbackNode);
      }
    };

    loadDialogue();
  }, [dialoguePath]);

  // Update Pixel image based on context
  const updatePixelImage = useCallback((text: string) => {
    if (text.includes('Welcome') || text.includes('Hey there')) {
      setPixelImage(pixelWelcoming);
    } else if (text.includes('Great') || text.includes('Awesome')) {
      setPixelImage(pixelExcited);
    } else if (text.includes('think') || text.includes('how')) {
      setPixelImage(pixelThinking);
    } else if (text.includes('Learn')) {
      setPixelImage(pixelTeaching);
    } else if (text.includes('game') || text.includes('Game')) {
      setPixelImage(pixelGaming);
    } else {
      setPixelImage(pixelHappy);
    }
  }, []);

  // Get text based on conditions
  const getConditionalText = useCallback((node: DialogueNode): string => {
    // Check for conditional text based on variables
    if (node.conditionalText) {
      for (const [varName, conditions] of Object.entries(node.conditionalText)) {
        const varValue = variables[varName];
        if (varValue && conditions[varValue]) {
          return conditions[varValue];
        }
        // Check for default fallback
        if (!varValue && conditions.default) {
          return conditions.default;
        }
      }
    }
    return node.text || '';
  }, [variables]);

  // Get follow-up text based on conditions
  const getConditionalFollowUp = useCallback((node: DialogueNode): string | undefined => {
    if (node.conditionalFollowUp) {
      for (const [varName, conditions] of Object.entries(node.conditionalFollowUp)) {
        const varValue = variables[varName];
        if (varValue && conditions[varValue]) {
          return conditions[varValue];
        }
      }
    }
    return node.followUp;
  }, [variables]);

  // Execute an action
  const executeAction = useCallback((action: string, params?: any) => {
    console.log('Executing action:', action, params);
    
    switch (action) {
      case 'openEditor':
        setEmbeddedComponent('editor');
        setPixelState('corner-waiting');
        setPixelImage(pixelCoding);
        break;
      case 'openLessons':
        setEmbeddedComponent('lessons');
        setPixelState('corner-waiting');
        setPixelImage(pixelTeaching);
        break;
      case 'showAssets':
        const type = params?.type || variables.gameType || 'generic';
        const scene = params?.scene || 'menu';
        setAssetConfig({ type, scene });
        setEmbeddedComponent('assets');
        setPixelState('corner-waiting');
        setPixelImage(pixelExcited);
        break;
      case 'startLesson':
        const lessonId = params?.id || 'python-basics';
        setLocation(`/lesson/${lessonId}`);
        break;
      case 'openHelp':
        setEmbeddedComponent('help');
        setPixelState('corner-waiting');
        break;
      case 'setupControls':
        const controlType = params?.type || 'default';
        console.log('Setting up controls for:', controlType);
        // This would integrate with the project builder
        break;
      case 'buildWorld':
        const worldType = variables.gameType || 'default';
        console.log('Building world for:', worldType);
        // This would integrate with the project builder
        break;
      case 'setRules':
        const complexity = params?.complexity || 'simple';
        console.log('Setting game rules:', complexity);
        // This would integrate with the project builder
        break;
    }
  }, [variables, setLocation]);

  // Execute conditional action
  const executeConditionalAction = useCallback((node: DialogueNode) => {
    if (node.conditionalAction) {
      for (const [varName, conditions] of Object.entries(node.conditionalAction)) {
        const varValue = variables[varName];
        let actionConfig = null;
        
        if (varValue && conditions[varValue]) {
          actionConfig = conditions[varValue];
        } else if (!varValue && conditions.default) {
          actionConfig = conditions.default;
        }
        
        if (actionConfig) {
          executeAction(actionConfig.action, actionConfig.params);
          return;
        }
      }
    }
    
    // Execute direct action if no conditional action
    if (node.action) {
      executeAction(node.action);
    }
  }, [variables, executeAction]);

  // Navigate to a new node
  const navigateToNode = useCallback((nodeId: string) => {
    if (!wizardFlow) return;
    
    const newNode = wizardFlow.nodes[nodeId];
    if (newNode) {
      console.log('Navigating to node:', nodeId);
      setCurrentNode(newNode);
      setCurrentNodeId(nodeId);
      setDialogueStep('text');
      
      // Update Pixel image based on text
      const text = getConditionalText(newNode) || newNode.text || '';
      if (text) {
        updatePixelImage(text);
      }
      
      // Execute any immediate actions for this node
      if (newNode.action || newNode.conditionalAction) {
        // Small delay to let the UI update first
        setTimeout(() => {
          executeConditionalAction(newNode);
        }, 100);
      }
    } else {
      console.error('Node not found:', nodeId);
    }
  }, [wizardFlow, updatePixelImage, getConditionalText, executeConditionalAction]);

  // Handle dialogue advancement (for continue button)
  const advance = useCallback(() => {
    if (!currentNode) return;

    // If we're showing the main text and there's a follow-up, show the follow-up
    if (dialogueStep === 'text' && (currentNode.followUp || getConditionalFollowUp(currentNode))) {
      setDialogueStep('followUp');
      return;
    }

    // If there's a next node defined, navigate to it
    if (currentNode.next) {
      navigateToNode(currentNode.next);
    }
  }, [currentNode, dialogueStep, navigateToNode, getConditionalFollowUp]);

  // Handle option selection
  const handleOptionSelect = useCallback((option: DialogueOption) => {
    console.log('Selected option:', option.text);
    
    // Set any variables
    if (option.setVariable) {
      const newVars = { ...variables, ...option.setVariable };
      setVariables(newVars);
      console.log('Updated variables:', newVars);
    }
    
    // Execute action if specified
    if (option.action) {
      executeAction(option.action, option.actionParams);
      
      // If there's also a next node, navigate after a delay
      if (option.next) {
        setTimeout(() => {
          navigateToNode(option.next);
        }, 200);
      }
    } else if (option.next) {
      // Navigate to next node
      navigateToNode(option.next);
    }
  }, [variables, executeAction, navigateToNode]);

  // Handle returning from embedded component
  const returnToDialogue = useCallback(() => {
    setEmbeddedComponent('none');
    setPixelState('center-stage');
    setPixelImage(pixelHappy);
    
    // Navigate to appropriate return node based on what was completed
    if (embeddedComponent === 'assets') {
      navigateToNode('assetSelected');
    } else {
      navigateToNode('projectComplete');
    }
  }, [embeddedComponent, navigateToNode]);

  // Get current display text
  const getCurrentText = useCallback((): string => {
    if (!currentNode) return '';
    
    // If we're showing follow-up text
    if (dialogueStep === 'followUp') {
      return getConditionalFollowUp(currentNode) || currentNode.followUp || '';
    }
    
    // Otherwise show main text (conditional or regular)
    return getConditionalText(currentNode) || currentNode.text || '';
  }, [currentNode, dialogueStep, getConditionalText, getConditionalFollowUp]);

  // Check if we should show options
  const shouldShowOptions = useCallback((): boolean => {
    if (!currentNode || !currentNode.options) return false;
    
    // Show options if:
    // 1. There are no follow-ups, or
    // 2. We're already showing the follow-up
    const hasFollowUp = currentNode.followUp || getConditionalFollowUp(currentNode);
    return !hasFollowUp || dialogueStep === 'followUp';
  }, [currentNode, dialogueStep, getConditionalFollowUp]);

  // Check if we should show continue button
  const shouldShowContinue = useCallback((): boolean => {
    if (!currentNode) return false;
    
    // Show continue if:
    // 1. We're showing main text and there's a follow-up
    // 2. There's a next node and no options
    if (dialogueStep === 'text' && (currentNode.followUp || getConditionalFollowUp(currentNode))) {
      return true;
    }
    
    return !currentNode.options && !!currentNode.next && dialogueStep === 'followUp';
  }, [currentNode, dialogueStep, getConditionalFollowUp]);

  // Render dialogue content
  const renderDialogue = () => {
    if (!currentNode) return null;

    const displayText = getCurrentText();
    const showOptions = shouldShowOptions();
    const showContinue = shouldShowContinue();

    return (
      <div className="space-y-4">
        {/* Dialogue text */}
        {displayText && (
          <motion.div
            key={`${currentNodeId}-${dialogueStep}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              {displayText}
            </p>
          </motion.div>
        )}

        {/* Options */}
        {showOptions && currentNode.options && currentNode.options.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${
              currentNode.options.length > 4 
                ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
                : 'flex flex-col sm:flex-row gap-3 justify-center'
            }`}
          >
            {currentNode.options.map((option, index) => {
              // Extract game type from option text if it exists
              const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
              const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
              const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
              
              return (
                <Button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  className={`${
                    currentNode.options!.length > 4
                      ? 'p-4 h-auto flex flex-col items-center justify-center text-center'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6'
                  }`}
                  variant={currentNode.options!.length > 4 ? 'outline' : 'default'}
                  data-testid={`dialogue-option-${index}`}
                >
                  {currentNode.options!.length > 4 && (
                    <Icon className="w-8 h-8 mb-2 text-purple-600" />
                  )}
                  {!gameType && currentNode.options!.length <= 4 && (
                    <Icon className="mr-2 h-5 w-5" />
                  )}
                  <span className={currentNode.options!.length > 4 ? 'text-sm font-semibold' : ''}>
                    {option.text}
                  </span>
                </Button>
              );
            })}
          </motion.div>
        )}

        {/* Continue button */}
        {showContinue && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center"
          >
            <Button
              onClick={advance}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8"
              data-testid="dialogue-continue"
            >
              Continue <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-700 dark:text-gray-300">Loading adventure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-lg opacity-75 animate-pulse"></div>
                <div className="relative bg-white dark:bg-gray-900 rounded-xl p-2">
                  <Gamepad2 className="text-purple-600 h-8 w-8" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Pixel's PyGame Palace
                </h1>
                <p className="text-xs text-muted-foreground">Your Game Building Adventure</p>
              </div>
            </motion.div>
            
            <div className="flex items-center space-x-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-5 w-5 text-purple-600" />
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* Center Stage Dialogue */}
        {pixelState === 'center-stage' && embeddedComponent === 'none' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none px-4"
          >
            <Card className="relative max-w-2xl w-full p-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl border-2 border-purple-500/20 pointer-events-auto">
              {/* Pixel Avatar */}
              <motion.div 
                className="flex justify-center mb-6"
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                <div className="relative w-32 h-32">
                  <img 
                    src={pixelImage}
                    alt="Pixel"
                    className="w-full h-full object-cover rounded-full"
                    style={{ imageRendering: 'crisp-edges' }}
                  />
                  <motion.div 
                    className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-400 rounded-full border-4 border-white shadow-lg"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </motion.div>

              {/* Dialogue Content */}
              {renderDialogue()}
            </Card>
          </motion.div>
        )}

        {/* Corner Waiting Pixel */}
        {pixelState === 'corner-waiting' && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="fixed top-24 left-6 z-50"
          >
            <motion.button
              className="relative group cursor-pointer"
              onClick={returnToDialogue}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-testid="pixel-corner"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/50 shadow-lg bg-white">
                <img 
                  src={pixelImage} 
                  alt="Pixel" 
                  className="w-full h-full object-cover"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
              <motion.div
                className="absolute inset-0 rounded-full bg-purple-500/20"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="absolute left-20 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Return to conversation
              </div>
            </motion.button>
          </motion.div>
        )}

        {/* Embedded Components */}
        {embeddedComponent !== 'none' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pt-20 px-4 pb-8"
          >
            {embeddedComponent === 'editor' && (
              <div className="max-w-7xl mx-auto">
                <ProjectBuilderEnhanced embedded={true} />
              </div>
            )}
            
            {embeddedComponent === 'lessons' && (
              <div className="max-w-6xl mx-auto">
                <LessonsPage embedded={true} />
              </div>
            )}
            
            {embeddedComponent === 'assets' && assetConfig && (
              <div className="max-w-6xl mx-auto">
                <Card className="p-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
                  <h2 className="text-2xl font-bold mb-4 text-center">
                    Choose Your Assets
                  </h2>
                  <AssetSelector 
                    gameType={assetConfig.type} 
                    scene={assetConfig.scene}
                    onSelect={(asset: any) => {
                      console.log('Asset selected:', asset);
                      returnToDialogue();
                    }}
                    onClose={() => returnToDialogue()}
                  />
                </Card>
              </div>
            )}
            
            {embeddedComponent === 'help' && (
              <div className="max-w-4xl mx-auto">
                <Card className="p-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
                  <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    Here are some resources to help you on your game development journey:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <BookOpen className="w-5 h-5 mr-2 text-purple-600" />
                      <span>Python Basics Tutorial</span>
                    </li>
                    <li className="flex items-center">
                      <Gamepad2 className="w-5 h-5 mr-2 text-purple-600" />
                      <span>PyGame Documentation</span>
                    </li>
                    <li className="flex items-center">
                      <Code2 className="w-5 h-5 mr-2 text-purple-600" />
                      <span>Example Projects</span>
                    </li>
                  </ul>
                  <Button 
                    onClick={returnToDialogue}
                    className="mt-6 bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    Back to Adventure
                  </Button>
                </Card>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{
              x: Math.random() * 1000,
              y: 1000
            }}
            animate={{
              y: -100,
              x: Math.random() * 1000
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              delay: i * 2,
              ease: "linear"
            }}
          >
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-xl"></div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}