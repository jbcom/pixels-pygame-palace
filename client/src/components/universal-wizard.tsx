import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, ChevronDown, ChevronUp, Code2, Menu,
  Sparkles, Gamepad2, User, X, Sword, TreePine, ChevronLeft, 
  Car, Trophy, Zap, Brain, Castle
} from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import useEdgeSwipe from '@/hooks/use-edge-swipe';
import { PixelMenu } from './pixel-menu';
import { WizardCodeEditor } from './wizard-code-editor';
import { ProfessionalEditor } from './professional-editor';
import { CodeBlockBuilder } from './code-block-builder';
import pixelImage from '@assets/pixel-avatar.jpg';

interface UniversalWizardProps {
  className?: string;
  assetMode?: 'curated' | 'full';
  editorLocked?: boolean;
}

interface WizardNode {
  id: string;
  text?: string;
  multiStep?: string[];
  options?: { text: string; next: string }[];
  action?: string;
  params?: Record<string, any>;
  tags?: string[];
  conditional?: {
    condition: string;
    trueNext?: string;
    falseNext?: string;
  };
}

// Game type icons mapping
const gameTypeIcons: Record<string, any> = {
  rpg: Sword,
  platformer: TreePine,
  racing: Car,
  dungeon: Castle,
  puzzle: Brain,
  adventure: Trophy,
  space: Zap
};

// Session Actions for tracking user progress
interface SessionActions {
  choices: string[];
  createdAssets: string[];
  gameType: string | null;
  currentProject: string | null;
  completedSteps: string[];
  unlockedEditor: boolean;
}

export function UniversalWizard({ 
  className = '', 
  assetMode = 'curated',
  editorLocked = true 
}: UniversalWizardProps) {
  // Core states
  const [wizardData, setWizardData] = useState<Record<string, WizardNode> | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>('start');
  const [currentNode, setCurrentNode] = useState<WizardNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogueStep, setDialogueStep] = useState(0);
  const [sessionActions, setSessionActions] = useState<SessionActions>({
    choices: [],
    createdAssets: [],
    gameType: null,
    currentProject: null,
    completedSteps: [],
    unlockedEditor: false
  });

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);

  // UI states
  const [pixelMenuOpen, setPixelMenuOpen] = useState(false);
  const [embeddedComponent, setEmbeddedComponent] = useState<'none' | 'code-editor' | 'professional-editor' | 'block-builder'>('none');
  const [pixelState, setPixelState] = useState<'center-stage' | 'minimized'>('center-stage');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showAllChoices, setShowAllChoices] = useState(false);
  
  // Refs
  const choicesContainerRef = useRef<HTMLDivElement>(null);

  // Load wizard flow data
  useEffect(() => {
    fetch('/wizard-flow.json')
      .then(res => res.json())
      .then(data => {
        setWizardData(data);
        if (data.start) {
          setCurrentNode(data.start);
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load wizard flow:', error);
        setIsLoading(false);
      });
  }, []);

  // Update current node when ID changes
  useEffect(() => {
    if (wizardData && currentNodeId) {
      const node = wizardData[currentNodeId];
      if (node) {
        setCurrentNode(node);
        setDialogueStep(0);
        setCarouselIndex(0);
        setShowAllChoices(false);
      }
    }
  }, [currentNodeId, wizardData]);

  // Responsive detection
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mobile = width < 768;
      const landscape = width > height;
      
      setScreenWidth(width);
      setScreenHeight(height);
      setIsMobile(mobile);
      setIsLandscape(landscape);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);
    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  // Navigation functions
  const navigateToNode = useCallback((nodeId: string) => {
    setCurrentNodeId(nodeId);
  }, []);

  const handleOptionSelect = useCallback((option: { text: string; next: string }) => {
    // Track the choice
    setSessionActions(prev => ({
      ...prev,
      choices: [...prev.choices, option.text]
    }));

    // Handle special actions embedded in option
    if (option.text.includes('RPG')) {
      setSessionActions(prev => ({ ...prev, gameType: 'rpg' }));
    } else if (option.text.includes('Platformer')) {
      setSessionActions(prev => ({ ...prev, gameType: 'platformer' }));
    } else if (option.text.includes('Racing')) {
      setSessionActions(prev => ({ ...prev, gameType: 'racing' }));
    }

    // Navigate to next node
    if (option.next) {
      navigateToNode(option.next);
    }
  }, [navigateToNode]);

  const advance = useCallback(() => {
    if (!currentNode) return;
    
    if (currentNode.multiStep && dialogueStep < currentNode.multiStep.length - 1) {
      setDialogueStep(prev => prev + 1);
    } else if (currentNode.options) {
      // Already showing options, don't advance
    }
  }, [currentNode, dialogueStep]);

  // Get current text to display
  const getCurrentText = () => {
    if (!currentNode) return '';
    
    if (currentNode.multiStep) {
      return currentNode.multiStep[dialogueStep];
    }
    
    return currentNode.text || '';
  };

  // Determine what to show
  const shouldShowOptions = () => {
    if (!currentNode) return false;
    
    if (currentNode.multiStep) {
      return dialogueStep >= currentNode.multiStep.length - 1 && currentNode.options;
    }
    
    return !!currentNode.options;
  };

  const shouldShowContinue = () => {
    if (!currentNode) return false;
    
    if (currentNode.multiStep) {
      return dialogueStep < currentNode.multiStep.length - 1;
    }
    
    return false;
  };

  // Determine layout mode
  const getLayoutMode = () => {
    if (!isMobile) return 'desktop';
    if (isLandscape) return 'mobile-landscape';
    return 'mobile-portrait';
  };

  // Edge swipe handlers
  const edgeSwipeHandlers = useEdgeSwipe({
    onSwipe: () => {
      console.log('Edge swipe detected');
      setPixelMenuOpen(true);
    },
    threshold: 30,
    edgeWidth: 20
  });

  // Mobile Portrait Layout Component
  const MobilePortraitLayout = () => {
    if (!currentNode) return null;
    const displayText = getCurrentText();
    const showOptions = shouldShowOptions();
    const showContinue = shouldShowContinue();

    return (
      <div {...edgeSwipeHandlers.handlers} className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
        {/* Pixel Avatar Section */}
        <motion.div 
          className="flex-shrink-0 flex items-center justify-center py-6"
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
              className="w-32 h-32 object-cover rounded-full shadow-xl"
              style={{ imageRendering: 'crisp-edges' }}
            />
            <motion.div 
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-400 rounded-full border-4 border-white shadow-lg"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>

        {/* Dialogue Text Section */}
        <motion.div 
          className="flex-shrink-0 px-4 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="w-full bg-white/90 dark:bg-gray-900/90 rounded-xl p-4 shadow-lg backdrop-blur-sm">
            <p className="text-center text-base text-gray-700 dark:text-gray-300 leading-relaxed">
              {displayText}
            </p>
          </div>
        </motion.div>

        {/* Choices Section - All options preloaded and scrollable */}
        <motion.div 
          className="flex-1 min-h-0 overflow-y-auto px-4 pb-safe-or-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="space-y-3">
            {showOptions && currentNode.options && (
              <>
                {/* Render all options - scrollable */}
                {currentNode.options.map((option, index) => {
                  const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
                  const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
                  const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Button
                        onClick={() => handleOptionSelect(option)}
                        className="w-full justify-start text-left py-5 px-5 bg-white/95 dark:bg-gray-900/95 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all transform active:scale-95"
                        variant="outline"
                        size="lg"
                        data-testid={`dialogue-option-${index}`}
                      >
                        <Icon className="mr-3 h-5 w-5 flex-shrink-0 text-purple-600" />
                        <span className="font-medium text-base">{option.text}</span>
                      </Button>
                    </motion.div>
                  );
                })}
              </>
            )}
            
            {showContinue && (
              <Button
                onClick={advance}
                className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-base"
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

    return (
      <div {...edgeSwipeHandlers.handlers} className="h-screen grid grid-cols-[20%,80%] bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
        {/* Left Side - Pixel Portrait Only */}
        <motion.div 
          className="flex items-center justify-center p-2"
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
              className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full shadow-xl"
              style={{ imageRendering: 'crisp-edges' }}
            />
            <motion.div 
              className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white shadow-lg"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
        </motion.div>

        {/* Right Side - Dialogue and Buttons */}
        <div className="flex flex-col p-3 overflow-hidden">
          {/* Dialogue Text */}
          <motion.div 
            className="flex-shrink-0 mb-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-white/90 dark:bg-gray-900/90 rounded-xl p-3 shadow-lg backdrop-blur-sm">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {displayText}
              </p>
            </div>
          </motion.div>

          {/* Choices - Scrollable */}
          <motion.div 
            className="flex-1 min-h-0 overflow-y-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {showOptions && currentNode.options && (
              <div className="space-y-2">
                {currentNode.options.map((option, index) => {
                  const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
                  const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
                  const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Button
                        onClick={() => handleOptionSelect(option)}
                        className="w-full justify-start text-left py-3 px-4 bg-white/95 dark:bg-gray-900/95 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all transform active:scale-95"
                        variant="outline"
                        size="default"
                        data-testid={`dialogue-option-${index}`}
                      >
                        <Icon className="mr-2 h-4 w-4 flex-shrink-0 text-purple-600" />
                        <span className="font-medium text-xs">{option.text}</span>
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {showContinue && (
              <Button
                onClick={advance}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-sm"
                size="default"
                data-testid="dialogue-continue"
              >
                Continue <ChevronRight className="ml-2 h-4 w-4" />
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
      {/* Header - Only show on large screens */}
      <header className="hidden lg:block bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-border sticky top-0 z-40 shadow-sm">
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

      {/* Menu button for tablets (no header) */}
      <Button
        onClick={() => setPixelMenuOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-40 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-lg hover:shadow-xl transition-shadow"
        variant="outline"
        size="icon"
        data-testid="open-pixel-menu-button"
        aria-label="Open Pixel Menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

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
                    className="w-full h-full object-cover rounded-full shadow-xl"
                    style={{ imageRendering: 'crisp-edges' }}
                  />
                  <motion.div 
                    className="absolute bottom-0 right-0 w-6 h-6 bg-green-400 rounded-full border-4 border-white"
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

        {/* Embedded Components */}
        {embeddedComponent === 'code-editor' && (
          <WizardCodeEditor
            onClose={() => {
              setEmbeddedComponent('none');
              setPixelState('center-stage');
            }}
            projectType={sessionActions.gameType || 'rpg'}
            assetMode={assetMode}
          />
        )}

        {embeddedComponent === 'professional-editor' && !editorLocked && (
          <ProfessionalEditor
            onClose={() => {
              setEmbeddedComponent('none');
              setPixelState('center-stage');
            }}
            projectType={sessionActions.gameType || 'rpg'}
          />
        )}

        {embeddedComponent === 'block-builder' && (
          <CodeBlockBuilder
            onClose={() => {
              setEmbeddedComponent('none');
              setPixelState('center-stage');
            }}
            projectType={sessionActions.gameType || 'rpg'}
            assetMode={assetMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}