import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gamepad2, 
  Sparkles,
  BookOpen,
  Code2,
  Puzzle,
  Swords,
  Trophy,
  Car,
  Map
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

// Import Pixel images
import pixelWelcoming from '@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png';
import pixelGaming from '@assets/pixel/Pixel_gaming_focused_expression_6f3fdfab.png';
import pixelTeaching from '@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png';
import pixelExcited from '@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png';
import pixelThinking from '@assets/pixel/Pixel_thinking_pondering_expression_0ffffedb.png';

type WizardStep = 'welcome' | 'initial-choice' | 'game-type' | 'work-style' | 'building';

export default function Home() {
  const [, setLocation] = useLocation();
  const [wizardStep, setWizardStep] = useState<WizardStep>('welcome');
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null);
  const [pixelImage, setPixelImage] = useState(pixelWelcoming);
  const [showWelcome, setShowWelcome] = useState(true);

  const handleInitialChoice = (choice: 'game' | 'learn') => {
    if (choice === 'game') {
      setPixelImage(pixelGaming);
      setWizardStep('game-type');
    } else {
      setPixelImage(pixelTeaching);
      setTimeout(() => setLocation('/lesson/python-basics'), 500);
    }
  };

  const handleGameTypeSelect = (gameType: string) => {
    setSelectedGameType(gameType);
    setPixelImage(pixelExcited);
    setWizardStep('work-style');
  };

  const handleWorkStyleChoice = (style: 'editor' | 'wizard') => {
    if (style === 'editor') {
      // Navigate to professional editor
      setLocation('/project-builder');
    } else {
      // Start wizard mode
      setWizardStep('building');
      setPixelImage(pixelThinking);
      // Start scene-by-scene building
      setTimeout(() => setLocation(`/wizard/${selectedGameType}`), 500);
    }
  };

  const gameTypes = [
    { id: 'rpg', label: 'RPG', icon: Swords },
    { id: 'platformer', label: 'Platformer', icon: Gamepad2 },
    { id: 'dungeon', label: 'Dungeon Crawler', icon: Map },
    { id: 'racing', label: 'Racing', icon: Car },
    { id: 'puzzle', label: 'Puzzle', icon: Puzzle },
    { id: 'adventure', label: 'Adventure', icon: Trophy }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
      {/* Header with Pixel's PyGame Palace branding */}
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

      {/* Center Stage Pixel Welcome */}
      <AnimatePresence mode="wait">
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <Card className="relative max-w-2xl mx-4 p-8 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl border-2 border-purple-500/20 pointer-events-auto">
              {/* Pixel Avatar - PROMINENT and animated */}
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

              {wizardStep === 'welcome' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center space-y-6"
                >
                  <div>
                    <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Hey there! I'm Pixel!
                    </h2>
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                      Your friendly game-building buddy!
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => setWizardStep('initial-choice')}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8 text-lg"
                    data-testid="button-get-started"
                  >
                    Let's get started! <Sparkles className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              )}

              {wizardStep === 'initial-choice' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <p className="text-lg text-center text-gray-700 dark:text-gray-300 leading-relaxed">
                    Hey, before we get started, I want to make sure I'm not telling you anything you already know... 
                    You want me to throw together a basic framework for your game so you can get started right away 
                    or would you like to take the opportunity to learn some Python together?
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      onClick={() => handleInitialChoice('game')}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6"
                      data-testid="button-make-game"
                    >
                      <Gamepad2 className="mr-2 h-5 w-5" />
                      Jump into game making!
                    </Button>
                    <Button
                      onClick={() => handleInitialChoice('learn')}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 px-6"
                      data-testid="button-learn-python"
                    >
                      <BookOpen className="mr-2 h-5 w-5" />
                      Let's learn Python first!
                    </Button>
                  </div>
                </motion.div>
              )}

              {wizardStep === 'game-type' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <p className="text-lg text-center text-gray-700 dark:text-gray-300">
                    Great, we've got ourselves a game cooking here! But it needs a direction. 
                    What are you thinking? I can do a few!
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {gameTypes.map(({ id, label, icon: Icon }) => (
                      <motion.button
                        key={id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleGameTypeSelect(id)}
                        className="p-4 rounded-lg border-2 border-purple-500/20 bg-white/50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                        data-testid={`button-game-type-${id}`}
                      >
                        <Icon className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                        <span className="text-sm font-semibold">{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {wizardStep === 'work-style' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <p className="text-lg text-center text-gray-700 dark:text-gray-300">
                    Awesome! Love it! Hey I'm just here to help, how do you like to work? 
                    I can give you a full editor and chill in the corner until you need me 
                    or be with you the whole way walking you through. What's your speed?
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      onClick={() => handleWorkStyleChoice('editor')}
                      className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-3 px-6"
                      data-testid="button-full-editor"
                    >
                      <Code2 className="mr-2 h-5 w-5" />
                      Full editor - I got this!
                    </Button>
                    <Button
                      onClick={() => handleWorkStyleChoice('wizard')}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6"
                      data-testid="button-wizard-mode"
                    >
                      <Sparkles className="mr-2 h-5 w-5" />
                      Walk me through it!
                    </Button>
                  </div>
                </motion.div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fun animated background elements */}
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