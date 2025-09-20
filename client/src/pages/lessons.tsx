import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/header";
import type { Lesson, UserProgress } from "@shared/schema";
import { Clock, BookOpen, Sparkles, ChevronRight, Trophy, Heart } from "lucide-react";

// Import Pixel images
import pixelHappy from '@assets/pixel/Pixel_happy_excited_expression_22a41625.png';
import pixelTeaching from '@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png';
import pixelCelebrating from '@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png';
import pixelEncouraging from '@assets/pixel/Pixel_encouraging_supportive_expression_cf958090.png';
import pixelWelcoming from '@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png';

// Pixel's encouraging messages for each lesson
const pixelMessages = {
  "python-basics": "Start your Python adventure here! 🌟",
  "control-flow": "Let's make smart programs that can think! 🤔",
  "loops-iteration": "Round and round we go - it's fun! 🔄",
  "data-structures": "Organize all the things! 📦",
  "functions": "Build your own coding toolkit! 🔧",
  "object-oriented-programming": "Create your own digital world! 🏗️",
  "error-handling": "Mistakes are just learning opportunities! 💪",
  "file-operations": "Let's save and load like pros! 💾",
  "pygame-intro": "Game time is almost here! 🎮",
  "first-game": "Your first game awaits! 🚀"
};

// Warm color classes for lesson cards based on progress
const getCardColorClass = (progress?: number, completed?: boolean) => {
  if (completed) {
    return "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700";
  }
  if (progress && progress > 0) {
    return "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-300 dark:border-purple-700";
  }
  return "bg-gradient-to-br from-gray-50 to-stone-50 dark:from-gray-900/20 dark:to-stone-900/20 border-gray-200 dark:border-gray-700";
};

interface LessonsPageProps {
  embedded?: boolean;
}

export default function LessonsPage({ embedded = false }: LessonsPageProps) {
  const [, setLocation] = useLocation();
  
  const { data: lessons, isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons"],
  });
  
  const { data: progressData } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress"],
  });

  // Create a map of lesson progress
  const progressMap = new Map<string, UserProgress>();
  progressData?.forEach(p => progressMap.set(p.lessonId, p));

  const navigateToLesson = (lessonId: string) => {
    setLocation(`/lesson/${lessonId}`);
  };

  if (lessonsLoading) {
    return (
      <div className={embedded ? "" : "min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-gray-900 dark:via-purple-900/10 dark:to-pink-900/10"}>
        {!embedded && <Header />}
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-purple-600 dark:text-purple-400">Loading your learning journey...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 dark:from-gray-900 dark:via-purple-900/10 dark:to-pink-900/10"}>
      {!embedded && <Header />}
      
      {/* Page Container */}
      <div className="container mx-auto px-4 py-8">
        {/* Pixel's Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="flex items-center justify-center mb-4">
            <motion.img 
              src={pixelTeaching}
              alt="Pixel teaching"
              className="w-20 h-20 mr-4"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="text-left">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                Python Learning Journey
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Let's learn Python together! Pick any lesson to start or continue your adventure.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Progress Overview */}
        {progressData && progressData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-2xl shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                Your Progress
              </h2>
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Trophy className="w-5 h-5" />
                <span className="font-bold">
                  {progressData.filter(p => p.completed).length} / {lessons?.length || 10} Lessons Complete
                </span>
              </div>
            </div>
            <Progress 
              value={(progressData.filter(p => p.completed).length / (lessons?.length || 10)) * 100} 
              className="h-3 bg-purple-100 dark:bg-purple-900/30"
            />
          </motion.div>
        )}

        {/* Lessons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="wait">
            {lessons?.map((lesson, index) => {
              const progress = progressMap.get(lesson.id);
              const progressPercent = progress 
                ? (progress.currentStep / lesson.content.steps.length) * 100
                : 0;
              
              return (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={`cursor-pointer transition-all duration-300 hover:shadow-xl ${getCardColorClass(progressPercent, progress?.completed)}`}
                    onClick={() => navigateToLesson(lesson.id)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Lesson {lesson.order}
                          </span>
                        </div>
                        {progress?.completed && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-green-500 text-white rounded-full p-1"
                          >
                            <Trophy className="w-4 h-4" />
                          </motion.div>
                        )}
                      </div>
                      
                      <CardTitle className="text-xl mb-2 text-gray-800 dark:text-gray-100">
                        {lesson.title}
                      </CardTitle>
                      
                      <CardDescription className="text-gray-600 dark:text-gray-400">
                        {lesson.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                      {/* Progress Bar */}
                      {progressPercent > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>{Math.round(progressPercent)}%</span>
                          </div>
                          <Progress 
                            value={progressPercent} 
                            className="h-2"
                          />
                        </div>
                      )}
                      
                      {/* Lesson Details */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {lesson.estimatedTime} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-4 h-4" />
                            {lesson.difficulty}
                          </span>
                        </div>
                      </div>
                      
                      {/* Pixel's Message */}
                      <div className="flex items-center gap-2 p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded-lg">
                        <img 
                          src={progress?.completed ? pixelCelebrating : pixelEncouraging}
                          alt="Pixel"
                          className="w-8 h-8"
                        />
                        <p className="text-sm text-purple-700 dark:text-purple-300 italic">
                          {pixelMessages[lesson.id as keyof typeof pixelMessages]}
                        </p>
                      </div>
                      
                      {/* Action Button */}
                      <Button 
                        className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToLesson(lesson.id);
                        }}
                      >
                        {progress?.completed ? (
                          <>Review Lesson</>
                        ) : progressPercent > 0 ? (
                          <>Continue Learning</>
                        ) : (
                          <>Start Lesson</>
                        )}
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        
        {/* Pixel's Encouragement Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full shadow-lg">
            <img 
              src={pixelHappy}
              alt="Pixel happy"
              className="w-12 h-12"
            />
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Pro tip:</span> Start with Python Basics and work your way up, or jump to any lesson that interests you!
            </p>
            <Heart className="w-5 h-5 text-pink-500 animate-pulse" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}