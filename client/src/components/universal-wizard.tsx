import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
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
  ChevronRight,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Menu
} from "lucide-react";
import LessonsPage from "@/pages/lessons";
import ProjectBuilderEnhanced from "@/pages/project-builder-enhanced";
import AssetSelector from "@/components/asset-selector";
import PixelMenu from "@/components/pixel-menu";
import { useIsMobile } from "@/hooks/use-media-query";
import { useOrientation } from "@/hooks/use-orientation";
import { useDeviceType } from "@/hooks/use-device-type";
import { useEdgeSwipe } from "@/hooks/use-edge-swipe";

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

interface SessionAction {
  id: string;
  type: 'game_created' | 'lesson_completed' | 'asset_selected' | 'code_generated' | 'settings_changed';
  title: string;
  description?: string;
  timestamp: Date;
  icon: React.ComponentType<any>;
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
  const [mobileDialogueOpen, setMobileDialogueOpen] = useState(true);
  const [showAllChoices, setShowAllChoices] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const choicesContainerRef = useRef<HTMLDivElement>(null);
  const [pixelMenuOpen, setPixelMenuOpen] = useState(false);
  const [sessionActions, setSessionActions] = useState<SessionAction[]>([]);
  
  // Device and orientation detection
  const isMobile = useIsMobile();
  const { isPortrait, isLandscape, orientation } = useOrientation();
  const { deviceType, isFoldable, isTablet, isDesktop } = useDeviceType();

  // Edge swipe detection
  const edgeSwipeHandlers = useEdgeSwipe({
    onEdgeSwipe: (edge) => {
      console.log(`Edge swipe detected from ${edge}`);
      setPixelMenuOpen(true);
      // Add haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    },
    enabled: isMobile || isTablet || isFoldable,
    edgeThreshold: 30 // More sensitive for mobile
  });

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

  // Track session action
  const trackAction = useCallback((type: SessionAction['type'], title: string, description?: string) => {
    const newAction: SessionAction = {
      id: Date.now().toString(),
      type,
      title,
      description,
      timestamp: new Date(),
      icon: type === 'game_created' ? Gamepad2 : 
            type === 'lesson_completed' ? BookOpen : 
            type === 'asset_selected' ? Trophy : 
            type === 'code_generated' ? Code2 : Trophy
    };
    setSessionActions(prev => [newAction, ...prev]);
  }, []);

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
        if (isMobile) setMobileDialogueOpen(false);
        trackAction('code_generated', 'Opened Code Editor', 'Started writing game code');
        break;
      case 'openLessons':
        setEmbeddedComponent('lessons');
        setPixelState('corner-waiting');
        setPixelImage(pixelTeaching);
        if (isMobile) setMobileDialogueOpen(false);
        trackAction('lesson_completed', 'Started Lessons', 'Learning Python fundamentals');
        break;
      case 'showAssets':
        const type = params?.type || variables.gameType || 'generic';
        const scene = params?.scene || 'menu';
        setAssetConfig({ type, scene });
        setEmbeddedComponent('assets');
        setPixelState('corner-waiting');
        setPixelImage(pixelExcited);
        if (isMobile) setMobileDialogueOpen(false);
        trackAction('asset_selected', 'Browsing Assets', `Looking at ${type} assets`);
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
  }, [variables, setLocation, isMobile, trackAction]);

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
    
    // Track game creation if selecting game type
    if (option.setVariable?.gameType) {
      trackAction('game_created', `Created ${option.setVariable.gameType} Game`, option.text);
    }
    
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
          navigateToNode(option.next!);
        }, 200);
      }
    } else if (option.next) {
      // Navigate to next node
      navigateToNode(option.next!);
    }
  }, [variables, executeAction, navigateToNode, trackAction]);

  // Handle returning from embedded component
  const returnToDialogue = useCallback(() => {
    setEmbeddedComponent('none');
    // On mobile, keep Pixel in corner, open dialogue modal
    if (isMobile) {
      setPixelState('corner-waiting');
      setMobileDialogueOpen(true);
    } else {
      setPixelState('center-stage');
    }
    setPixelImage(pixelHappy);
    
    // Navigate to appropriate return node based on what was completed
    if (embeddedComponent === 'assets') {
      navigateToNode('assetSelected');
    } else {
      navigateToNode('projectComplete');
    }
  }, [embeddedComponent, navigateToNode, isMobile]);

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

  // Determine which layout to use
  const getLayoutMode = useCallback((): 'desktop' | 'mobile-portrait' | 'mobile-landscape' | 'tablet' => {
    // Desktop mode for desktop devices
    if (isDesktop && !isFoldable) {
      return 'desktop';
    }
    
    // Tablet mode for tablets and foldables in tablet mode
    if (isTablet || (isFoldable && !isMobile)) {
      // If portrait on tablet/foldable, use mobile portrait layout
      if (isPortrait) {
        return 'mobile-portrait';
      }
      return 'tablet';
    }
    
    // Mobile layouts
    if (isMobile || (isFoldable && isMobile)) {
      return isPortrait ? 'mobile-portrait' : 'mobile-landscape';
    }
    
    return 'desktop';
  }, [isDesktop, isTablet, isMobile, isFoldable, isPortrait]);

  // Swipe handlers for portrait mode (swipe down to show more choices)
  const swipeHandlersPortrait = useSwipeable({
    onSwipedUp: () => {
      if (!showAllChoices && currentNode?.options && currentNode.options.length > 2) {
        setShowAllChoices(true);
      }
    },
    onSwipedDown: () => {
      if (showAllChoices) {
        setShowAllChoices(false);
      }
    },
    trackMouse: false
  });

  // Swipe handlers for landscape mode (carousel)
  const swipeHandlersLandscape = useSwipeable({
    onSwipedLeft: () => {
      if (currentNode?.options) {
        const maxIndex = Math.floor((currentNode.options.length - 1) / 2);
        if (carouselIndex < maxIndex) {
          setCarouselIndex(carouselIndex + 1);
        }
      }
    },
    onSwipedRight: () => {
      if (carouselIndex > 0) {
        setCarouselIndex(carouselIndex - 1);
      }
    },
    trackMouse: false
  });

  // Mobile Portrait Layout Component
  const MobilePortraitLayout = () => {
    if (!currentNode) return null;
    const displayText = getCurrentText();
    const showOptions = shouldShowOptions();
    const showContinue = shouldShowContinue();
    const hasMoreChoices = currentNode.options && currentNode.options.length > 2;

    return (
      <div {...edgeSwipeHandlers.handlers} className="h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
        {/* Menu Button - Top Right Corner */}
        <Button
          onClick={() => {
            console.log('Portrait menu button clicked');
            setPixelMenuOpen(true);
          }}
          className="fixed top-4 right-4 z-40 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-lg hover:shadow-xl transition-shadow"
          variant="outline"
          size="icon"
          data-testid="open-pixel-menu-button"
          aria-label="Open Pixel Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Pixel Avatar Section - 1/3 of screen */}
        <motion.div 
          className="flex-none h-[33vh] flex items-center justify-center p-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="relative"
          >
            <img 
              src={pixelImage}
              alt="Pixel"
              className="w-40 h-40 object-cover rounded-full shadow-xl"
              style={{ imageRendering: 'crisp-edges' }}
            />
            <motion.div 
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-400 rounded-full border-4 border-white shadow-lg"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>

        {/* Dialogue Text Section - 1/4 of screen */}
        <motion.div 
          className="flex-none h-[25vh] px-6 flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="w-full bg-white/90 dark:bg-gray-900/90 rounded-xl p-4 shadow-lg backdrop-blur-sm">
            <p className="text-center text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              {displayText}
            </p>
          </div>
        </motion.div>

        {/* Choices Section - Remaining screen with scroll */}
        <motion.div 
          className="flex-1 overflow-y-auto px-6 pb-safe-or-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          {...(hasMoreChoices ? swipeHandlersPortrait : {})}
        >
          <div className="space-y-3" ref={choicesContainerRef}>
            {showOptions && currentNode.options && (
              <>
                {/* Show first 2 choices always */}
                {currentNode.options.slice(0, 2).map((option, index) => {
                  const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
                  const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
                  const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
                  
                  return (
                    <Button
                      key={index}
                      onClick={() => handleOptionSelect(option)}
                      className="w-full justify-start text-left py-6 px-6 bg-white/95 dark:bg-gray-900/95 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all transform active:scale-95"
                      variant="outline"
                      size="lg"
                      data-testid={`dialogue-option-${index}`}
                    >
                      <Icon className="mr-4 h-6 w-6 flex-shrink-0 text-purple-600" />
                      <span className="font-medium text-base">{option.text}</span>
                    </Button>
                  );
                })}
                
                {/* Show remaining choices if expanded or always for 6+ options */}
                {hasMoreChoices && (
                  <>
                    {!showAllChoices && (
                      <motion.div 
                        className="text-center py-2"
                        animate={{ y: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <p className="text-sm text-gray-500 dark:text-gray-400">Swipe up for more options</p>
                        <ChevronDown className="h-5 w-5 mx-auto text-gray-400" />
                      </motion.div>
                    )}
                    
                    <AnimatePresence>
                      {showAllChoices && currentNode.options.slice(2).map((option, index) => {
                        const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
                        const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
                        const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
                        
                        return (
                          <motion.div
                            key={index + 2}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Button
                              onClick={() => handleOptionSelect(option)}
                              className="w-full justify-start text-left py-6 px-6 bg-white/95 dark:bg-gray-900/95 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all transform active:scale-95 mb-3"
                              variant="outline"
                              size="lg"
                              data-testid={`dialogue-option-${index + 2}`}
                            >
                              <Icon className="mr-4 h-6 w-6 flex-shrink-0 text-purple-600" />
                              <span className="font-medium text-base">{option.text}</span>
                            </Button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </>
                )}
              </>
            )}
            
            {showContinue && (
              <Button
                onClick={advance}
                className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold"
                size="lg"
                data-testid="dialogue-continue"
              >
                Continue <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  // Mobile Landscape Layout Component
  const MobileLandscapeLayout = () => {
    if (!currentNode) return null;
    const displayText = getCurrentText();
    const showOptions = shouldShowOptions();
    const showContinue = shouldShowContinue();
    const hasCarousel = currentNode.options && currentNode.options.length > 2;

    return (
      <div {...edgeSwipeHandlers.handlers} className="h-screen grid grid-cols-2 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
        {/* Menu Button - Top Right Corner */}
        <Button
          onClick={() => {
            console.log('Landscape menu button clicked');
            setPixelMenuOpen(true);
          }}
          className="fixed top-4 right-4 z-40 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-lg hover:shadow-xl transition-shadow"
          variant="outline"
          size="icon"
          data-testid="open-pixel-menu-button"
          aria-label="Open Pixel Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Left Side - Pixel Portrait */}
        <motion.div 
          className="col-span-1 flex items-center justify-center p-4 border-r-2 border-purple-200/30 dark:border-purple-800/30"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="relative"
          >
            <img 
              src={pixelImage}
              alt="Pixel"
              className="w-32 h-32 lg:w-40 lg:h-40 object-cover rounded-full shadow-xl"
              style={{ imageRendering: 'crisp-edges' }}
            />
            <motion.div 
              className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-400 rounded-full border-4 border-white shadow-lg"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>

        {/* Right Side - Content */}
        <div className="col-span-1 flex flex-col">
          {/* Dialogue Text */}
          <motion.div 
            className="flex-none p-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-white/90 dark:bg-gray-900/90 rounded-xl p-4 shadow-lg backdrop-blur-sm">
              <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                {displayText}
              </p>
            </div>
          </motion.div>

          {/* Choices Grid */}
          <motion.div 
            className="flex-1 p-4 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            {...(hasCarousel ? swipeHandlersLandscape : {})}
          >
            {showOptions && currentNode.options && (
              <div className="h-full flex flex-col">
                {!hasCarousel ? (
                  /* 2 or fewer options - simple grid */
                  <div className="grid grid-cols-2 gap-3 h-full">
                    {currentNode.options.map((option, index) => {
                      const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
                      const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
                      const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
                      
                      return (
                        <Button
                          key={index}
                          onClick={() => handleOptionSelect(option)}
                          className="h-full flex flex-col items-center justify-center p-4 bg-white/95 dark:bg-gray-900/95 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all transform active:scale-95"
                          variant="outline"
                          data-testid={`dialogue-option-${index}`}
                        >
                          <Icon className="h-8 w-8 mb-2 text-purple-600" />
                          <span className="font-medium text-sm text-center">{option.text}</span>
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  /* Carousel for 3+ options */
                  <div className="relative h-full">
                    <div className="grid grid-cols-2 gap-3 h-full">
                      {currentNode.options
                        .slice(carouselIndex * 2, carouselIndex * 2 + 2)
                        .map((option, index) => {
                          const actualIndex = carouselIndex * 2 + index;
                          const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
                          const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
                          const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
                          
                          return (
                            <motion.div
                              key={actualIndex}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="h-full"
                            >
                              <Button
                                onClick={() => handleOptionSelect(option)}
                                className="w-full h-full flex flex-col items-center justify-center p-4 bg-white/95 dark:bg-gray-900/95 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all transform active:scale-95"
                                variant="outline"
                                data-testid={`dialogue-option-${actualIndex}`}
                              >
                                <Icon className="h-8 w-8 mb-2 text-purple-600" />
                                <span className="font-medium text-sm text-center">{option.text}</span>
                              </Button>
                            </motion.div>
                          );
                        })}
                    </div>
                    
                    {/* Carousel Indicators */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-center space-x-2 pb-2">
                      {Array.from({ length: Math.ceil(currentNode.options.length / 2) }).map((_, index) => (
                        <div
                          key={index}
                          className={`h-2 w-2 rounded-full transition-colors ${
                            index === carouselIndex
                              ? 'bg-purple-600'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    
                    {/* Navigation hint */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-1 right-1 flex justify-between pointer-events-none">
                      {carouselIndex > 0 && (
                        <motion.div 
                          animate={{ x: [-5, 0, -5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-purple-600/50"
                        >
                          <ChevronLeft className="h-8 w-8" />
                        </motion.div>
                      )}
                      {carouselIndex < Math.floor((currentNode.options.length - 1) / 2) && (
                        <motion.div 
                          animate={{ x: [5, 0, 5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-purple-600/50 ml-auto"
                        >
                          <ChevronRight className="h-8 w-8" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {showContinue && (
              <Button
                onClick={advance}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold"
                size="lg"
                data-testid="dialogue-continue"
              >
                Continue <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    );
  };

  // Render dialogue content (desktop/tablet)
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
              isMobile
                ? currentNode.options.length > 4
                  ? 'flex flex-col gap-2'
                  : 'flex flex-col gap-3'
                : currentNode.options.length > 4 
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
                    isMobile
                      ? 'w-full justify-start text-left py-4 px-4'
                      : currentNode.options!.length > 4
                        ? 'p-4 h-auto flex flex-col items-center justify-center text-center'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6'
                  }`}
                  variant={isMobile ? 'outline' : currentNode.options!.length > 4 ? 'outline' : 'default'}
                  size={isMobile ? 'lg' : 'default'}
                  data-testid={`dialogue-option-${index}`}
                >
                  {isMobile ? (
                    <>
                      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span className="font-medium">{option.text}</span>
                    </>
                  ) : (
                    <>
                      {currentNode.options!.length > 4 && (
                        <Icon className="w-8 h-8 mb-2 text-purple-600" />
                      )}
                      {!gameType && currentNode.options!.length <= 4 && (
                        <Icon className="mr-2 h-5 w-5" />
                      )}
                      <span className={currentNode.options!.length > 4 ? 'text-sm font-semibold' : ''}>
                        {option.text}
                      </span>
                    </>
                  )}
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
            className={isMobile ? "w-full" : "flex justify-center"}
          >
            <Button
              onClick={advance}
              className={`${
                isMobile 
                  ? 'w-full py-4'
                  : 'py-3 px-8'
              } bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold`}
              size={isMobile ? 'lg' : 'default'}
              data-testid="dialogue-continue"
            >
              Continue <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </div>
    );
  };

  // Pixel Menu handlers
  const handlePixelMenuAction = useCallback((action: string) => {
    setPixelMenuOpen(false);
    
    switch (action) {
      case 'changeGame':
        navigateToNode('gamePath');
        break;
      case 'switchLesson':
        navigateToNode('learnPath');
        break;
      case 'exportGame':
        // TODO: Implement export functionality
        console.log('Export game');
        break;
      case 'viewProgress':
        // TODO: Implement progress view
        console.log('View progress');
        break;
      case 'returnCurrent':
        // Just close the menu
        break;
    }
  }, [navigateToNode]);

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

  // Determine which layout to use
  const layoutMode = getLayoutMode();

  // Render mobile layouts if on mobile device
  if (layoutMode === 'mobile-portrait') {
    return (
      <>
        <PixelMenu
          isOpen={pixelMenuOpen}
          onClose={() => setPixelMenuOpen(false)}
          onChangeGame={() => handlePixelMenuAction('changeGame')}
          onSwitchLesson={() => handlePixelMenuAction('switchLesson')}
          onExportGame={() => handlePixelMenuAction('exportGame')}
          onViewProgress={() => handlePixelMenuAction('viewProgress')}
          onReturnCurrent={() => handlePixelMenuAction('returnCurrent')}
          sessionActions={sessionActions}
        />
        <MobilePortraitLayout />
      </>
    );
  }

  if (layoutMode === 'mobile-landscape') {
    return (
      <>
        <PixelMenu
          isOpen={pixelMenuOpen}
          onClose={() => setPixelMenuOpen(false)}
          onChangeGame={() => handlePixelMenuAction('changeGame')}
          onSwitchLesson={() => handlePixelMenuAction('switchLesson')}
          onExportGame={() => handlePixelMenuAction('exportGame')}
          onViewProgress={() => handlePixelMenuAction('viewProgress')}
          onReturnCurrent={() => handlePixelMenuAction('returnCurrent')}
          sessionActions={sessionActions}
        />
        <MobileLandscapeLayout />
      </>
    );
  }

  // Desktop and tablet layout
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
        {/* Desktop: Center Stage Dialogue - Mobile: Modal Dialogue */}
        {!isMobile && pixelState === 'center-stage' && embeddedComponent === 'none' && (
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

        {/* Mobile Dialogue Modal */}
        {isMobile && mobileDialogueOpen && embeddedComponent === 'none' && currentNode && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-40 p-4 pb-safe"
          >
            <Card className="relative w-full p-6 bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl shadow-2xl border-2 border-purple-500/20 rounded-t-2xl">
              {/* Close button for mobile modal */}
              <button
                onClick={() => setMobileDialogueOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                data-testid="mobile-dialogue-close"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Mobile Dialogue Content */}
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {renderDialogue()}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Corner Pixel - Always shown on mobile, conditional on desktop */}
        {(isMobile || pixelState === 'corner-waiting') && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="fixed top-20 md:top-24 left-4 md:left-6 z-50"
          >
            <motion.button
              className="relative group cursor-pointer"
              onClick={() => {
                if (isMobile) {
                  setMobileDialogueOpen(!mobileDialogueOpen);
                } else {
                  returnToDialogue();
                }
              }}
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