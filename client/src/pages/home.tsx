import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Play, Gamepad2, Trophy, Sparkles, ArrowRight, BookOpen, Code2, Zap, Star, Users, Clock } from "lucide-react";
import type { Lesson, UserProgress } from "@shared/schema";
import heroIllustration from "@assets/generated_images/Python_education_hero_illustration_f78e9d61.png";
import { motion } from "framer-motion";

export default function Home() {
  const { data: lessons, isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons"],
  });

  const { data: progress } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress"],
  });

  if (lessonsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <motion.div 
                className="relative w-16 h-16 mx-auto mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-lg opacity-75"></div>
                <div className="relative bg-white dark:bg-gray-900 rounded-full w-16 h-16 flex items-center justify-center">
                  <Gamepad2 className="h-8 w-8 text-primary" />
                </div>
              </motion.div>
              <p className="text-muted-foreground font-medium">Loading your learning journey...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getProgressForLesson = (lessonId: string) => {
    return progress?.find(p => p.lessonId === lessonId);
  };

  const calculateOverallProgress = () => {
    if (!lessons || !progress) return 0;
    const completedLessons = progress.filter(p => p.completed).length;
    return Math.round((completedLessons / lessons.length) * 100);
  };

  const overallProgress = calculateOverallProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
      {/* Header */}
      <header className="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-lg blur opacity-75"></div>
                  <div className="relative bg-white dark:bg-gray-900 rounded-lg p-1.5">
                    <Gamepad2 className="text-primary h-6 w-6" />
                  </div>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">PyGame Academy</h1>
              </div>
            </motion.div>
            
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="hidden md:flex items-center space-x-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full px-4 py-2">
                <Trophy className="h-4 w-4 text-secondary" />
                <span className="text-sm text-muted-foreground">Progress</span>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" 
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                </div>
                <span className="text-sm font-semibold">{overallProgress}%</span>
              </div>
              
              <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg transition-all duration-300 hover:scale-105">
                <Sparkles className="h-4 w-4 mr-1" />
                Profile
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background opacity-90"></div>
        
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div 
              className="space-y-6 z-10 relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm rounded-full px-4 py-2">
                <Zap className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Interactive Python Learning
                </span>
              </div>
              
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                  <span className="bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent">
                    Master Python
                  </span>
                  <br />
                  <span className="text-foreground">
                    Through Games
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Build real games while learning Python fundamentals. From variables to PyGame, 
                  embark on an exciting coding adventure designed for beginners.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <motion.div 
                  className="flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-primary to-secondary text-white hover:shadow-xl transition-all duration-300 group"
                    onClick={() => document.getElementById('lessons-section')?.scrollIntoView({ behavior: 'smooth' })}
                    data-testid="button-start-learning"
                  >
                    <BookOpen className="h-5 w-5 mr-2" />
                    Start Learning
                    <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
                
                <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    <span>{lessons?.length || 0} Lessons</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-4 w-4 text-secondary" />
                    <span>Interactive</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-center mb-1">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">10K+</div>
                  <div className="text-xs text-muted-foreground">Active Learners</div>
                </motion.div>
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center justify-center mb-1">
                    <Star className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">4.9</div>
                  <div className="text-xs text-muted-foreground">Rating</div>
                </motion.div>
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center justify-center mb-1">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">5h</div>
                  <div className="text-xs text-muted-foreground">To Complete</div>
                </motion.div>
              </div>
            </motion.div>
            
            <motion.div 
              className="relative"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-3xl"></div>
              <img 
                src={heroIllustration} 
                alt="Python Education" 
                className="relative z-10 w-full h-auto rounded-2xl shadow-2xl hover:shadow-3xl transition-shadow duration-500"
                data-testid="hero-illustration"
              />
              
              {/* Floating badges */}
              <motion.div 
                className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium">Live Coding</span>
                </div>
              </motion.div>
              
              <motion.div 
                className="absolute bottom-4 left-4 bg-gradient-to-r from-primary to-secondary text-white rounded-lg px-3 py-2 shadow-lg"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="flex items-center space-x-2">
                  <Gamepad2 className="h-4 w-4" />
                  <span className="text-xs font-medium">Game-Based Learning</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Lessons Section */}
      <div id="lessons-section" className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="mb-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Your Learning Path
            </h2>
            <p className="text-muted-foreground">
              Progress through carefully crafted lessons, each building on the last
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {lessons?.map((lesson, index) => {
              const lessonProgress = getProgressForLesson(lesson.id);
              const isCompleted = lessonProgress?.completed || false;
              const currentStep = lessonProgress?.currentStep || 0;
              const totalSteps = lesson.content.steps.length;
              const stepProgress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

              return (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="group"
                >
                  <Card className="relative overflow-hidden hover:shadow-xl transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-border/50 hover:border-primary/30">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                    
                    <CardHeader className="pb-3 pt-4 px-5 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                            <div className="relative bg-white dark:bg-gray-800 rounded-xl p-2.5">
                              {isCompleted ? (
                                <CheckCircle className="h-5 w-5 text-success" data-testid={`icon-completed-${lesson.id}`} />
                              ) : (
                                <Play className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" data-testid={`icon-available-${lesson.id}`} />
                              )}
                            </div>
                          </div>
                          <div>
                            <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">{lesson.title}</CardTitle>
                            <CardDescription className="text-sm mt-0.5">{lesson.description}</CardDescription>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {isCompleted && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs py-0.5 px-2.5 font-semibold">
                                <Trophy className="h-3 w-3 mr-1" />
                                Complete
                              </Badge>
                            </motion.div>
                          )}
                          {lessonProgress && !isCompleted && (
                            <Badge variant="outline" className="text-xs py-0.5 px-2.5 border-primary/30 text-primary font-medium">
                              {currentStep}/{totalSteps} steps
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0 pb-4 px-5">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {lesson.content.introduction}
                        </p>
                        
                        {lessonProgress && !isCompleted && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span className="font-medium">{stepProgress}%</span>
                            </div>
                            <div className="relative">
                              <Progress value={stepProgress} className="w-full h-2 bg-muted/50" />
                              <motion.div 
                                className="absolute top-0 left-0 h-2 bg-gradient-to-r from-primary to-secondary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${stepProgress}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <BookOpen className="h-3.5 w-3.5" />
                              <span>{totalSteps} {totalSteps === 1 ? 'step' : 'steps'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Zap className="h-3.5 w-3.5 text-secondary" />
                              <span>Interactive</span>
                            </div>
                          </div>
                          
                          <Link href={`/lesson/${lesson.id}`}>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button 
                                size="sm"
                                className={`
                                  ${isCompleted 
                                    ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600" 
                                    : "bg-gradient-to-r from-primary to-secondary hover:shadow-lg"
                                  } 
                                  text-white transition-all duration-300 group
                                `}
                                data-testid={`button-start-${lesson.id}`}
                              >
                                {isCompleted ? "Review" : lessonProgress ? "Continue" : "Start"}
                                <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            </motion.div>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}