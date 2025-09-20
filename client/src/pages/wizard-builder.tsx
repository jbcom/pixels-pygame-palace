import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRoute, useLocation } from "wouter";
import { 
  Gamepad2, 
  Sparkles,
  Code2,
  Grid3x3,
  List,
  Image,
  Settings,
  ChevronRight,
  ChevronLeft,
  Palette
} from "lucide-react";

// Import Pixel images
import pixelHappy from '@assets/pixel/Pixel_happy_excited_expression_22a41625.png';
import pixelThinking from '@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png';
import pixelTeaching from '@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png';
import pixelExcited from '@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png';
import pixelCoding from '@assets/pixel/Pixel_coding_programming_expression_56de8ca0.png';

type WizardScene = 'title-screen' | 'inventory' | 'character' | 'world' | 'gameplay' | 'complete';

interface SceneStep {
  id: WizardScene;
  title: string;
  pixelDialogue: string;
  choices?: {
    label: string;
    value: string;
    icon?: React.ComponentType<any>;
  }[];
}

export default function WizardBuilder() {
  const [match, params] = useRoute("/wizard/:gameType");
  const [, setLocation] = useLocation();
  const gameType = params?.gameType;

  const [currentScene, setCurrentScene] = useState<WizardScene>('title-screen');
  const [pixelImage, setPixelImage] = useState(pixelTeaching);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [pixelExpanded, setPixelExpanded] = useState(false);

  // Scene configurations based on game type
  const getSceneSteps = (type: string): SceneStep[] => {
    const baseSteps: SceneStep[] = [
      {
        id: 'title-screen',
        title: 'Title Screen',
        pixelDialogue: `Alright, great! What do you think for a title screen? Got these great assets that work perfect in a ${type}!`,
        choices: [
          { label: 'Minimal & Clean', value: 'minimal', icon: Grid3x3 },
          { label: 'Epic & Dramatic', value: 'epic', icon: Sparkles },
          { label: 'Retro Style', value: 'retro', icon: Gamepad2 }
        ]
      }
    ];

    // Add game-specific scenes
    if (type === 'rpg') {
      baseSteps.push({
        id: 'inventory',
        title: 'Inventory System',
        pixelDialogue: "Awesome! Okay hey, in an RPG you know what you need? Inventory! Typically either a grid or a list! Why don't you try one and the other and see which one you like more!",
        choices: [
          { label: 'Grid Inventory', value: 'grid', icon: Grid3x3 },
          { label: 'List Inventory', value: 'list', icon: List }
        ]
      });
      baseSteps.push({
        id: 'character',
        title: 'Character Design',
        pixelDialogue: "Now for the fun part! Let's design your character! I've got some amazing sprites that would look great!",
        choices: [
          { label: 'Knight', value: 'knight' },
          { label: 'Mage', value: 'mage' },
          { label: 'Rogue', value: 'rogue' }
        ]
      });
    } else if (type === 'platformer') {
      baseSteps.push({
        id: 'character',
        title: 'Player Character',
        pixelDialogue: "Let's pick your player character! I've got some great platformer sprites ready to go!",
        choices: [
          { label: 'Blue Player', value: 'blue' },
          { label: 'Red Player', value: 'red' },
          { label: 'Green Player', value: 'green' }
        ]
      });
      baseSteps.push({
        id: 'world',
        title: 'World Theme',
        pixelDialogue: "What kind of world should we build? Each has its own unique tiles and backgrounds!",
        choices: [
          { label: 'Forest', value: 'forest', icon: Image },
          { label: 'Desert', value: 'desert', icon: Image },
          { label: 'Space', value: 'space', icon: Image }
        ]
      });
    } else if (type === 'puzzle') {
      baseSteps.push({
        id: 'gameplay',
        title: 'Puzzle Type',
        pixelDialogue: "What kind of puzzle mechanics do you want? Each one's super fun to play!",
        choices: [
          { label: 'Match-3', value: 'match3' },
          { label: 'Block Sliding', value: 'sliding' },
          { label: 'Pattern Matching', value: 'pattern' }
        ]
      });
    }

    baseSteps.push({
      id: 'complete',
      title: 'Ready to Build!',
      pixelDialogue: "Perfect! I've got everything set up! Ready to start building your game?",
      choices: [
        { label: "Let's build it!", value: 'build', icon: Sparkles }
      ]
    });

    return baseSteps;
  };

  const sceneSteps = gameType ? getSceneSteps(gameType) : [];
  const currentStep = sceneSteps.find(step => step.id === currentScene);
  const currentStepIndex = sceneSteps.findIndex(step => step.id === currentScene);

  const handleChoice = (choiceValue: string) => {
    setSelections(prev => ({ ...prev, [currentScene]: choiceValue }));
    
    // Move to next scene
    if (currentStepIndex < sceneSteps.length - 1) {
      const nextScene = sceneSteps[currentStepIndex + 1];
      setCurrentScene(nextScene.id);
      setPixelImage(pixelExcited);
      
      // Change Pixel's expression based on scene
      if (nextScene.id === 'inventory') {
        setPixelImage(pixelThinking);
      } else if (nextScene.id === 'complete') {
        setPixelImage(pixelExcited);
      }
    } else if (currentScene === 'complete') {
      // Navigate to project builder with wizard settings
      setLocation('/project-builder');
    }
  };

  const goToPreviousScene = () => {
    if (currentStepIndex > 0) {
      const prevScene = sceneSteps[currentStepIndex - 1];
      setCurrentScene(prevScene.id);
      setPixelImage(pixelThinking);
    }
  };

  if (!match || !gameType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <h2 className="text-xl font-bold mb-4">Invalid game type</h2>
          <Button onClick={() => setLocation('/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-lg opacity-75 animate-pulse"></div>
                <div className="relative bg-white dark:bg-gray-900 rounded-xl p-2">
                  <Gamepad2 className="text-purple-600 h-8 w-8" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Wizard Mode - {gameType.charAt(0).toUpperCase() + gameType.slice(1)}
                </h1>
                <p className="text-xs text-muted-foreground">Building scene by scene with Pixel</p>
              </div>
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center space-x-2">
              {sceneSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index <= currentStepIndex ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          {currentStep && (
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              {/* Pixel Helper */}
              <Card className="mb-6 p-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-2 border-purple-500/20">
                <div className="flex items-start space-x-4">
                  <motion.div
                    className="flex-shrink-0"
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
                    <div className="relative w-20 h-20">
                      <img 
                        src={pixelImage}
                        alt="Pixel"
                        className="w-full h-full object-cover rounded-full"
                        style={{ imageRendering: 'crisp-edges' }}
                      />
                      <motion.div 
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-lg"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </motion.div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">
                      {currentStep.title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      {currentStep.pixelDialogue}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Choice Grid */}
              {currentStep.choices && currentStep.choices.length > 0 && (
                <div className={`grid ${currentStep.choices.length > 2 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} gap-4 mb-6`}>
                  {currentStep.choices.map((choice) => (
                    <motion.button
                      key={choice.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleChoice(choice.value)}
                      className="p-6 rounded-lg border-2 border-purple-500/20 bg-white/80 dark:bg-gray-800/80 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                      data-testid={`wizard-choice-${choice.value}`}
                    >
                      {choice.icon && (
                        <choice.icon className="w-12 h-12 mx-auto mb-3 text-purple-600" />
                      )}
                      <span className="text-lg font-semibold">{choice.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center">
                {currentStepIndex > 0 && (
                  <Button
                    variant="outline"
                    onClick={goToPreviousScene}
                    data-testid="wizard-back"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                )}
                
                <div className="ml-auto">
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/project-builder')}
                    data-testid="wizard-switch-editor"
                  >
                    <Code2 className="mr-2 h-4 w-4" />
                    Switch to Full Editor
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Area */}
        <Card className="mt-8 p-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur-lg border-2 border-gray-200/20">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <Palette className="mr-2 h-5 w-5 text-purple-600" />
            Your Selections
          </h3>
          <div className="space-y-2">
            {Object.entries(selections).map(([scene, value]) => {
              const step = sceneSteps.find(s => s.id === scene);
              return (
                <div key={scene} className="flex justify-between items-center p-2 rounded bg-white/50 dark:bg-gray-800/50">
                  <span className="text-sm font-medium">{step?.title}:</span>
                  <span className="text-sm text-purple-600">{value}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Pixel Corner Presence */}
      <motion.div
        className="fixed bottom-4 right-4 z-30"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          className="relative group cursor-pointer"
          onClick={() => setPixelExpanded(!pixelExpanded)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/50 shadow-lg bg-white">
            <img 
              src={pixelCoding}
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
          <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Need help?
          </div>
        </motion.button>
      </motion.div>
    </div>
  );
}