import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useSwipeable } from "react-swipeable";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Gamepad2, 
  Trophy, 
  BookOpen, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Puzzle,
  Car,
  Mountain,
  Swords,
  Globe,
  Zap,
  Shield,
  Backpack,
  Users,
  Map,
  Palette,
  Play,
  CheckCircle,
  Clock,
  Star,
  ArrowRight,
  Code2,
  Rocket,
  Music,
  Blocks
} from "lucide-react";
import type { Lesson, UserProgress } from "@shared/schema";

// Import generated game images
import platformerImage from "@assets/generated_images/Platformer_game_illustration_16ef54bb.png";
import racingImage from "@assets/generated_images/Racing_game_illustration_87b520a2.png";
import puzzleImage from "@assets/generated_images/Puzzle_game_illustration_0c89723b.png";
import adventureImage from "@assets/generated_images/Adventure_game_illustration_0255e101.png";
import musicImage from "@assets/generated_images/Music_game_illustration_9a39961e.png";
import sandboxImage from "@assets/generated_images/Creative_sandbox_illustration_a88bd612.png";

interface GameType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  image: string;
  color: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

interface BuildingBlock {
  id: string;
  title: string;
  icon: React.ReactNode;
  optionA: {
    title: string;
    description: string;
  };
  optionB: {
    title: string;
    description: string;
  };
}

const gameTypes: GameType[] = [
  {
    id: "platformer",
    title: "Platformer",
    description: "Jump and run through exciting levels!",
    icon: <Mountain className="h-12 w-12" />,
    image: platformerImage,
    color: "from-green-400 to-green-600",
    difficulty: "Beginner"
  },
  {
    id: "racing",
    title: "Racing Game",
    description: "Speed through tracks and beat the clock!",
    icon: <Car className="h-12 w-12" />,
    image: racingImage,
    color: "from-red-400 to-red-600",
    difficulty: "Intermediate"
  },
  {
    id: "puzzle",
    title: "Puzzle Game",
    description: "Solve challenging brain teasers!",
    icon: <Puzzle className="h-12 w-12" />,
    image: puzzleImage,
    color: "from-purple-400 to-purple-600",
    difficulty: "Beginner"
  },
  {
    id: "adventure",
    title: "Adventure",
    description: "Explore vast worlds and discover secrets!",
    icon: <Globe className="h-12 w-12" />,
    image: adventureImage,
    color: "from-blue-400 to-blue-600",
    difficulty: "Advanced"
  },
  {
    id: "music",
    title: "Music Game",
    description: "Create amazing beats and melodies!",
    icon: <Music className="h-12 w-12" />,
    image: musicImage,
    color: "from-pink-400 to-pink-600",
    difficulty: "Intermediate"
  },
  {
    id: "sandbox",
    title: "Creative Sandbox",
    description: "Build anything you can imagine!",
    icon: <Blocks className="h-12 w-12" />,
    image: sandboxImage,
    color: "from-indigo-400 to-purple-600",
    difficulty: "Beginner"
  }
];

const buildingBlocks: BuildingBlock[] = [
  {
    id: "combat",
    title: "Combat System",
    icon: <Swords className="h-8 w-8" />,
    optionA: {
      title: "Real-time Combat",
      description: "Fast-paced action with instant reactions"
    },
    optionB: {
      title: "Turn-based Combat",
      description: "Strategic battles with planned moves"
    }
  },
  {
    id: "inventory",
    title: "Inventory System",
    icon: <Backpack className="h-8 w-8" />,
    optionA: {
      title: "Grid-based",
      description: "Tetris-style item management"
    },
    optionB: {
      title: "List-based",
      description: "Simple scrollable item list"
    }
  },
  {
    id: "player",
    title: "Player Classes",
    icon: <Users className="h-8 w-8" />,
    optionA: {
      title: "Predefined Classes",
      description: "Choose from warrior, mage, archer"
    },
    optionB: {
      title: "Custom Creation",
      description: "Build your own unique character"
    }
  },
  {
    id: "map",
    title: "Map Generation",
    icon: <Map className="h-8 w-8" />,
    optionA: {
      title: "Procedural",
      description: "Random worlds every playthrough"
    },
    optionB: {
      title: "Designed",
      description: "Hand-crafted levels with secrets"
    }
  },
  {
    id: "art",
    title: "Character Art",
    icon: <Palette className="h-8 w-8" />,
    optionA: {
      title: "Pixel Art",
      description: "Classic retro style graphics"
    },
    optionB: {
      title: "Vector Art",
      description: "Smooth modern graphics"
    }
  }
];

export default function Home() {
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [gamePageIndex, setGamePageIndex] = useState(0);
  const [blockPageIndex, setBlockPageIndex] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<{[key: string]: 'A' | 'B'}>({});
  const [expandedAccordions, setExpandedAccordions] = useState<string[]>(["games"]);
  const lastClickTime = useRef<{[key: string]: number}>({});

  const { data: lessons, isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons"],
  });

  const { data: progress } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress"],
  });

  const { data: gallery } = useQuery<any[]>({
    queryKey: ["/api/gallery"],
  });

  const itemsPerPage = 5;
  const totalGamePages = Math.ceil(gameTypes.length / itemsPerPage);
  const totalBlockPages = Math.ceil(buildingBlocks.length / itemsPerPage);

  const gameSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (gamePageIndex < totalGamePages - 1) {
        setGamePageIndex(gamePageIndex + 1);
      }
    },
    onSwipedRight: () => {
      if (gamePageIndex > 0) {
        setGamePageIndex(gamePageIndex - 1);
      }
    },
    trackMouse: false
  });

  const blockSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (blockPageIndex < totalBlockPages - 1) {
        setBlockPageIndex(blockPageIndex + 1);
      }
    },
    onSwipedRight: () => {
      if (blockPageIndex > 0) {
        setBlockPageIndex(blockPageIndex - 1);
      }
    },
    trackMouse: false
  });

  const handleLessonClick = (lessonId: string) => {
    const now = Date.now();
    const lastClick = lastClickTime.current[lessonId] || 0;
    
    if (now - lastClick < 500) {
      // Double click detected - navigate
      window.location.href = `/lesson/${lessonId}`;
    } else {
      // Single click - highlight
      setSelectedLesson(lessonId);
    }
    
    lastClickTime.current[lessonId] = now;
  };

  const getProgressForLesson = (lessonId: string) => {
    return progress?.find(p => p.lessonId === lessonId);
  };

  const visibleGames = gameTypes.slice(
    gamePageIndex * itemsPerPage,
    (gamePageIndex + 1) * itemsPerPage
  );

  const visibleBlocks = buildingBlocks.slice(
    blockPageIndex * itemsPerPage,
    (blockPageIndex + 1) * itemsPerPage
  );

  if (lessonsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
        <div className="flex items-center justify-center h-screen">
          <motion.div 
            className="text-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Gamepad2 className="h-16 w-16 text-primary mx-auto mb-4" />
            <p className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Loading Amazing Games...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-950 dark:to-blue-950">
      {/* Simplified Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-border sticky top-0 z-50 shadow-sm">
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
              <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Game Creator Hub
              </h1>
            </motion.div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="hidden md:flex items-center space-x-2 px-3 py-1">
                <Sparkles className="h-3 w-3" />
                <span>Build Games!</span>
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Accordions */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Accordion 
          type="multiple" 
          value={expandedAccordions}
          onValueChange={setExpandedAccordions}
          className="space-y-4"
        >
          {/* Create Your Game Section (Default Open) */}
          <AccordionItem value="games" className="border rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-800">
            <AccordionTrigger 
              className="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:no-underline"
              data-testid="accordion-create-game"
            >
              <div className="flex items-center space-x-3">
                <Gamepad2 className="h-6 w-6" />
                <span className="text-xl font-bold">Create Your Game!</span>
                <Badge variant="secondary" className="ml-2">
                  {gameTypes.length} Game Types
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-6">
              <div {...gameSwipeHandlers}>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={gamePageIndex}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3 }}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    {visibleGames.map((game) => (
                      <Link key={game.id} href="/project-builder">
                        <motion.div
                          whileHover={{ scale: 1.05, rotate: 1 }}
                          whileTap={{ scale: 0.95 }}
                          className="cursor-pointer"
                          data-testid={`game-card-${game.id}`}
                        >
                          <Card className={`h-full border-2 border-transparent hover:border-primary overflow-hidden group transition-all duration-300`}>
                            <div className="relative h-48 overflow-hidden">
                              <img 
                                src={game.image} 
                                alt={game.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-20 mix-blend-overlay`}></div>
                              <Badge 
                                className="absolute top-2 right-2 bg-white/95 text-gray-800 shadow-lg"
                                variant="secondary"
                              >
                                {game.difficulty}
                              </Badge>
                              <div className="absolute bottom-2 left-2 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                {game.icon}
                              </div>
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-bold text-lg mb-2">{game.title}</h3>
                              <p className="text-sm text-muted-foreground">{game.description}</p>
                              <Button 
                                className="mt-3 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-md hover:shadow-lg"
                                size="sm"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Start Building
                              </Button>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </Link>
                    ))}
                  </motion.div>
                </AnimatePresence>
                
                {/* Pagination Controls */}
                {totalGamePages > 1 && (
                  <div className="flex items-center justify-center space-x-4 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGamePageIndex(Math.max(0, gamePageIndex - 1))}
                      disabled={gamePageIndex === 0}
                      data-testid="game-prev-button"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex space-x-2">
                      {Array.from({ length: totalGamePages }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full transition-all ${
                            i === gamePageIndex ? 'bg-primary w-8' : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGamePageIndex(Math.min(totalGamePages - 1, gamePageIndex + 1))}
                      disabled={gamePageIndex === totalGamePages - 1}
                      data-testid="game-next-button"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Game Building Blocks Section */}
          <AccordionItem value="blocks" className="border rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-800">
            <AccordionTrigger 
              className="px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:no-underline"
              data-testid="accordion-building-blocks"
            >
              <div className="flex items-center space-x-3">
                <Puzzle className="h-6 w-6" />
                <span className="text-xl font-bold">Game Building Blocks</span>
                <Badge variant="secondary" className="ml-2">
                  Modular Components
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-6">
              <div {...blockSwipeHandlers}>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={blockPageIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {visibleBlocks.map((block) => (
                      <motion.div
                        key={block.id}
                        whileHover={{ x: 5 }}
                        className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border-2 border-border"
                        data-testid={`block-${block.id}`}
                      >
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg text-white">
                            {block.icon}
                          </div>
                          <h3 className="text-lg font-bold">{block.title}</h3>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <button
                            onClick={() => setSelectedBlock({...selectedBlock, [block.id]: 'A'})}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              selectedBlock[block.id] === 'A'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                            data-testid={`block-${block.id}-optionA`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">{block.optionA.title}</span>
                              {selectedBlock[block.id] === 'A' && (
                                <CheckCircle className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {block.optionA.description}
                            </p>
                          </button>
                          <button
                            onClick={() => setSelectedBlock({...selectedBlock, [block.id]: 'B'})}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              selectedBlock[block.id] === 'B'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                            data-testid={`block-${block.id}-optionB`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">{block.optionB.title}</span>
                              {selectedBlock[block.id] === 'B' && (
                                <CheckCircle className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {block.optionB.description}
                            </p>
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
                
                {/* Pagination Controls */}
                {totalBlockPages > 1 && (
                  <div className="flex items-center justify-center space-x-4 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBlockPageIndex(Math.max(0, blockPageIndex - 1))}
                      disabled={blockPageIndex === 0}
                      data-testid="block-prev-button"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex space-x-2">
                      {Array.from({ length: totalBlockPages }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full transition-all ${
                            i === blockPageIndex ? 'bg-primary w-8' : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBlockPageIndex(Math.min(totalBlockPages - 1, blockPageIndex + 1))}
                      disabled={blockPageIndex === totalBlockPages - 1}
                      data-testid="block-next-button"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Need to Learn Python First? Section */}
          <AccordionItem value="python" className="border rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-800">
            <AccordionTrigger 
              className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:no-underline"
              data-testid="accordion-learn-python"
            >
              <div className="flex items-center space-x-3">
                <BookOpen className="h-6 w-6" />
                <span className="text-xl font-bold">Need to Learn Python First?</span>
                <Badge variant="secondary" className="ml-2">
                  {lessons?.length || 0} Lessons
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-6">
              <p className="text-muted-foreground mb-4">
                Master the basics of Python before diving into game creation. Click to highlight, double-click to start!
              </p>
              <div className="space-y-2">
                {lessons?.map((lesson, index) => {
                  const lessonProgress = getProgressForLesson(lesson.id);
                  const isCompleted = lessonProgress?.completed || false;
                  const currentStep = lessonProgress?.currentStep || 0;
                  const totalSteps = lesson.content.steps.length;
                  
                  return (
                    <motion.div
                      key={lesson.id}
                      whileHover={{ x: 5 }}
                      onClick={() => handleLessonClick(lesson.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedLesson === lesson.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      } ${isCompleted ? 'bg-green-50 dark:bg-green-950' : ''}`}
                      data-testid={`lesson-${lesson.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            isCompleted 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <span className="text-sm font-bold">{index + 1}</span>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold">{lesson.title}</h4>
                            <p className="text-sm text-muted-foreground">{lesson.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!isCompleted && currentStep > 0 && (
                            <Badge variant="outline">
                              {currentStep}/{totalSteps} steps
                            </Badge>
                          )}
                          <Badge variant={lesson.difficulty === "beginner" ? "secondary" : lesson.difficulty === "intermediate" ? "default" : "destructive"}>
                            {lesson.difficulty}
                          </Badge>
                          <div className="flex items-center space-x-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">{lesson.estimatedTime}m</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Community Creations Section */}
          <AccordionItem value="community" className="border rounded-xl overflow-hidden shadow-lg bg-white dark:bg-gray-800">
            <AccordionTrigger 
              className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:no-underline"
              data-testid="accordion-community"
            >
              <div className="flex items-center space-x-3">
                <Trophy className="h-6 w-6" />
                <span className="text-xl font-bold">Community Creations</span>
                <Badge variant="secondary" className="ml-2">
                  {gallery?.length || 0} Games
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-6">
              {gallery && gallery.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gallery.slice(0, 6).map((item, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.05 }}
                      className="cursor-pointer"
                    >
                      <Card className="overflow-hidden">
                        <div className="h-32 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                          <Trophy className="h-12 w-12 text-white" />
                        </div>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-1">{item.title || `Game #${index + 1}`}</h4>
                          <p className="text-sm text-muted-foreground mb-2">{item.description || "Amazing community creation!"}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm">4.8</span>
                            </div>
                            <Button size="sm" variant="outline">
                              <Play className="h-3 w-3 mr-1" />
                              Play
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Creations Yet!</h3>
                  <p className="text-muted-foreground mb-4">
                    Be the first to share your amazing game with the community!
                  </p>
                  <Link href="/project-builder">
                    <Button className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                      <Gamepad2 className="h-4 w-4 mr-2" />
                      Create Your First Game
                    </Button>
                  </Link>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Floating Action Button for Mobile */}
        <motion.div
          className="fixed bottom-6 right-6 md:hidden"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
        >
          <Link href="/project-builder">
            <Button
              size="lg"
              className="rounded-full h-14 w-14 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
              data-testid="mobile-create-button"
            >
              <Gamepad2 className="h-6 w-6" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}