import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Play, Lock, Gamepad2 } from "lucide-react";
import type { Lesson, UserProgress } from "@shared/schema";

export default function Home() {
  const { data: lessons, isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons"],
  });

  const { data: progress } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress"],
  });

  if (lessonsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading lessons...</p>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Gamepad2 className="text-primary text-2xl h-8 w-8" />
                <h1 className="text-xl font-bold text-primary">PyGame Academy</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Overall Progress:</span>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-300" 
                    style={{ width: `${overallProgress}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{overallProgress}%</span>
              </div>
              
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Profile
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Welcome to PyGame Academy</h2>
            <p className="text-lg text-muted-foreground">
              Learn Python programming through interactive game development. Start with the basics and build your way up to creating complete games!
            </p>
          </div>

          <div className="grid gap-6">
            {lessons?.map((lesson) => {
              const lessonProgress = getProgressForLesson(lesson.id);
              const isCompleted = lessonProgress?.completed || false;
              const isUnlocked = lesson.order === 1 || progress?.some(p => p.completed && lessons.find(l => l.id === p.lessonId)?.order === lesson.order - 1);
              const currentStep = lessonProgress?.currentStep || 0;
              const totalSteps = lesson.content.steps.length;
              const stepProgress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

              return (
                <Card key={lesson.id} className="relative overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {isCompleted ? (
                            <CheckCircle className="h-6 w-6 text-success" data-testid={`icon-completed-${lesson.id}`} />
                          ) : isUnlocked ? (
                            <Play className="h-6 w-6 text-primary" data-testid={`icon-available-${lesson.id}`} />
                          ) : (
                            <Lock className="h-6 w-6 text-muted-foreground" data-testid={`icon-locked-${lesson.id}`} />
                          )}
                          <div>
                            <CardTitle className="text-lg">{lesson.title}</CardTitle>
                            <CardDescription>{lesson.description}</CardDescription>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {isCompleted && (
                          <Badge variant="secondary" className="bg-success text-success-foreground">
                            Completed
                          </Badge>
                        )}
                        {lessonProgress && !isCompleted && (
                          <Badge variant="outline">
                            Step {currentStep}/{totalSteps}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {lesson.content.introduction}
                      </p>
                      
                      {lessonProgress && !isCompleted && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{stepProgress}%</span>
                          </div>
                          <Progress value={stepProgress} className="w-full" />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {totalSteps} {totalSteps === 1 ? 'step' : 'steps'}
                        </div>
                        
                        <Link href={`/lesson/${lesson.id}`}>
                          <Button 
                            disabled={!isUnlocked}
                            className={isCompleted ? "bg-success hover:bg-success/90" : ""}
                            data-testid={`button-start-${lesson.id}`}
                          >
                            {isCompleted ? "Review" : lessonProgress ? "Continue" : "Start"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
