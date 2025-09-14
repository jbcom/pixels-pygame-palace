import { CheckCircle, Play, Lock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lesson, UserProgress } from "@shared/schema";

interface LessonSidebarProps {
  lesson: Lesson;
  currentStepIndex: number;
  progress: UserProgress | null;
  onStepClick: (stepIndex: number) => void;
}

export default function LessonSidebar({ lesson, currentStepIndex, progress, onStepClick }: LessonSidebarProps) {
  return (
    <aside className="w-80 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg mb-3">Lesson Content</h2>
        <div className="space-y-2">
          <div className="p-3 rounded-md bg-primary text-primary-foreground">
            <div className="flex items-center space-x-3">
              <Play className="h-5 w-5" />
              <div>
                <div className="font-medium">Lesson {lesson.order}</div>
                <div className="text-sm opacity-90">{lesson.title}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 flex-1">
        <h3 className="font-medium mb-3">Lesson Steps</h3>
        <div className="space-y-2">
          {lesson.content.steps.map((step, index) => {
            const isCompleted = (progress?.currentStep || 0) > index;
            const isActive = currentStepIndex === index;
            const isAccessible = index <= (progress?.currentStep || 0);
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors",
                  isActive && "bg-primary/10 text-primary border border-primary/20",
                  isCompleted && !isActive && "bg-success/10 text-success",
                  !isAccessible && !isCompleted && "text-muted-foreground cursor-not-allowed",
                  isAccessible && !isActive && !isCompleted && "hover:bg-accent"
                )}
                onClick={() => isAccessible && onStepClick(index)}
                data-testid={`step-${index}`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : isActive ? (
                  <Play className="h-4 w-4" />
                ) : isAccessible ? (
                  <Circle className="h-3 w-3" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">{step.title}</span>
              </div>
            );
          })}
        </div>
        
        {lesson.content.introduction && (
          <div className="mt-6">
            <h4 className="font-medium mb-2">About this Lesson</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lesson.content.introduction}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
