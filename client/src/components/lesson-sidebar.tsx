import { CheckCircle, Play, Circle, BookOpen, Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lesson, UserProgress } from "@shared/schema";
import { motion } from "framer-motion";

interface LessonSidebarProps {
  lesson: Lesson;
  currentStepIndex: number;
  progress: UserProgress | null;
  onStepClick: (stepIndex: number) => void;
}

export default function LessonSidebar({ lesson, currentStepIndex, progress, onStepClick }: LessonSidebarProps) {
  const completedSteps = progress?.currentStep || 0;
  const totalSteps = lesson.content.steps.length;
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <motion.aside 
      className="w-72 lesson-sidebar flex flex-col"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="p-4 border-b border-border bg-gradient-to-br from-primary/5 to-secondary/5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Lesson Content
            </h2>
            {progressPercentage === 100 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500 }}
              >
                <Trophy className="h-5 w-5 text-secondary" />
              </motion.div>
            )}
          </div>
          
          <div className="space-y-2">
            <motion.div 
              className="lesson-tab active relative overflow-hidden"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10 animate-shimmer"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded blur opacity-50"></div>
                  <div className="relative bg-white dark:bg-gray-800 rounded p-1">
                    <Play className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Lesson {lesson.order}</div>
                  <div className="text-sm">{lesson.title}</div>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <motion.h3 
          className="text-base font-semibold mb-3 text-primary/80 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Sparkles className="h-4 w-4" />
          Lesson Steps
        </motion.h3>
        
        <div className="space-y-1">
          {lesson.content.steps.map((step, index) => {
            const isCompleted = (progress?.currentStep || 0) > index;
            const isActive = currentStepIndex === index;
            const isAccessible = true;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={!isActive ? { x: 4 } : {}}
              >
                <div
                  className={cn(
                    "sidebar-step flex items-center gap-2 cursor-pointer transition-all duration-300 group",
                    isActive && "sidebar-step active shadow-lg",
                    isCompleted && !isActive && "sidebar-step completed",
                    !isActive && !isCompleted && "hover:bg-accent"
                  )}
                  onClick={() => onStepClick(index)}
                  data-testid={`step-${index}`}
                >
                  <motion.div
                    initial={false}
                    animate={{ 
                      scale: isActive ? 1.1 : 1,
                      rotate: isCompleted ? 360 : 0 
                    }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="flex-shrink-0"
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : isActive ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      >
                        <Play className="h-4 w-4 text-primary" />
                      </motion.div>
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </motion.div>
                  
                  <span className={cn(
                    "text-sm font-medium leading-tight transition-colors",
                    isActive && "text-white",
                    isCompleted && !isActive && "text-success",
                    !isActive && !isCompleted && "group-hover:text-primary"
                  )}>
                    {step.title}
                  </span>
                  
                  {isActive && (
                    <motion.div
                      className="ml-auto"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        
        {lesson.content.introduction && (
          <motion.div 
            className="mt-4 p-3 bg-gradient-to-br from-secondary/10 to-primary/5 rounded-lg border border-secondary/20 hover:border-secondary/40 transition-colors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
          >
            <h4 className="text-sm font-semibold mb-2 text-primary/90 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" />
              About this Lesson
            </h4>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {lesson.content.introduction}
            </p>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
}