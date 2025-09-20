import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import YarnBound from "yarn-bound";
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

interface UniversalWizardProps {
  dialoguePath?: string;
  startNode?: string;
}

export default function UniversalWizard({ 
  dialoguePath = '/dialogue/pixel/wizard-flow.yarn',
  startNode = 'Start' 
}: UniversalWizardProps) {
  const [, setLocation] = useLocation();
  const [yarnBound, setYarnBound] = useState<any | null>(null);
  const [currentNode, setCurrentNode] = useState<any | null>(null);
  const [pixelState, setPixelState] = useState<PixelState>('center-stage');
  const [pixelImage, setPixelImage] = useState(pixelWelcoming);
  const [embeddedComponent, setEmbeddedComponent] = useState<EmbeddedComponent>('none');
  const [assetConfig, setAssetConfig] = useState<{ type: string; scene: string } | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Icon mapping for game types
  const gameTypeIcons: Record<string, React.ComponentType<any>> = {
    'rpg': Swords,
    'platformer': Gamepad2,
    'dungeon': Map,
    'racing': Car,
    'puzzle': Puzzle,
    'adventure': Trophy
  };

  // Initialize Yarn dialogue
  useEffect(() => {
    const loadDialogue = async () => {
      try {
        const response = await fetch(dialoguePath);
        const text = await response.text();
        
        const yarn = new (YarnBound as any)({
          dialogue: text,
          variableStorage: variables,
          functions: {
            // Custom commands
            openEditor: () => {
              setEmbeddedComponent('editor');
              setPixelState('corner-waiting');
              setPixelImage(pixelCoding);
            },
            openLessons: () => {
              setEmbeddedComponent('lessons');
              setPixelState('corner-waiting');
              setPixelImage(pixelTeaching);
            },
            showAssets: (args: string[]) => {
              const type = args[0]?.replace('type="', '').replace('"', '') || 'generic';
              const scene = args[1]?.replace('scene="', '').replace('"', '') || 'menu';
              setAssetConfig({ type, scene });
              setEmbeddedComponent('assets');
              setPixelState('corner-waiting');
              setPixelImage(pixelExcited);
            },
            startLesson: (args: string[]) => {
              const lessonId = args[0]?.replace('id="', '').replace('"', '') || 'python-basics';
              setLocation(`/lesson/${lessonId}`);
            },
            openHelp: () => {
              setEmbeddedComponent('help');
              setPixelState('corner-waiting');
            },
            setupControls: (args: string[]) => {
              const type = args[0]?.replace('type="', '').replace('"', '') || 'default';
              console.log('Setting up controls for:', type);
              // This would integrate with the project builder
            },
            buildWorld: (args: string[]) => {
              const type = variables.gameType || 'default';
              console.log('Building world for:', type);
              // This would integrate with the project builder
            },
            setRules: (args: string[]) => {
              const complexity = args[0]?.replace('complexity="', '').replace('"', '') || 'simple';
              console.log('Setting game rules:', complexity);
              // This would integrate with the project builder
            }
          }
        });

        setYarnBound(yarn);
        yarn.jump(startNode);
        const node = yarn.currentNode();
        setCurrentNode(node);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load dialogue:', error);
        setIsLoading(false);
      }
    };

    loadDialogue();
  }, [dialoguePath, startNode]);

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

  // Handle dialogue advancement
  const advance = useCallback(() => {
    if (!yarnBound) return;

    yarnBound.advance();
    const node = yarnBound.currentNode();
    setCurrentNode(node);
    
    // Update variables
    const updatedVars = yarnBound.variables;
    setVariables(updatedVars);
    
    // Update Pixel image based on text
    if (node && node.text) {
      updatePixelImage(node.text);
    }
  }, [yarnBound, updatePixelImage]);

  // Handle option selection
  const selectOption = useCallback((index: number) => {
    if (!yarnBound || !currentNode) return;

    yarnBound.selectOption(index);
    advance();
  }, [yarnBound, currentNode, advance]);

  // Handle returning from embedded component
  const returnToDialogue = useCallback(() => {
    setEmbeddedComponent('none');
    setPixelState('center-stage');
    setPixelImage(pixelHappy);
    
    // Jump to a return node based on what was completed
    if (yarnBound) {
      if (embeddedComponent === 'assets') {
        yarnBound.jump('AssetSelected');
      } else {
        yarnBound.jump('ProjectComplete');
      }
      const node = yarnBound.currentNode();
      setCurrentNode(node);
    }
  }, [yarnBound, embeddedComponent]);

  // Render dialogue content
  const renderDialogue = () => {
    if (!currentNode) return null;

    // Check if this is a character line
    const isCharacterLine = currentNode.text?.includes(':');
    const [speaker, ...messageParts] = currentNode.text?.split(':') || ['', ''];
    const message = messageParts.join(':').trim();

    return (
      <div className="space-y-4">
        {/* Dialogue text */}
        {currentNode.text && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {isCharacterLine && speaker === 'Pixel' ? (
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {message}
              </p>
            ) : (
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {currentNode.text}
              </p>
            )}
          </motion.div>
        )}

        {/* Options */}
        {currentNode.options && currentNode.options.length > 0 && (
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
            {currentNode.options.map((option: any, index: number) => {
              // Extract game type from option text if it exists
              const gameTypeMatch = option.text.match(/^(\w+)\s*-/);
              const gameType = gameTypeMatch ? gameTypeMatch[1].toLowerCase() : null;
              const Icon = gameType && gameTypeIcons[gameType] ? gameTypeIcons[gameType] : ChevronRight;
              
              return (
                <Button
                  key={index}
                  onClick={() => selectOption(index)}
                  className={`${
                    currentNode.options.length > 4
                      ? 'p-4 h-auto flex flex-col items-center justify-center text-center'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6'
                  }`}
                  variant={currentNode.options.length > 4 ? 'outline' : 'default'}
                  data-testid={`dialogue-option-${index}`}
                >
                  {currentNode.options.length > 4 && (
                    <Icon className="w-8 h-8 mb-2 text-purple-600" />
                  )}
                  {!gameType && currentNode.options.length <= 4 && (
                    <Icon className="mr-2 h-5 w-5" />
                  )}
                  <span className={currentNode.options.length > 4 ? 'text-sm font-semibold' : ''}>
                    {option.text}
                  </span>
                </Button>
              );
            })}
          </motion.div>
        )}

        {/* Continue button for non-option nodes */}
        {(!currentNode.options || currentNode.options.length === 0) && currentNode.text && (
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