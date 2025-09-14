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
    <aside className="w-96 bg-card border-r-2 border-border flex flex-col">
      <div className="p-6 border-b-2 border-border bg-muted/10">
        <h2 className="text-2xl font-semibold mb-4">Lesson Content</h2>
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-primary text-primary-foreground shadow-md">
            <div className="flex items-center gap-4">
              <Play className="h-6 w-6 flex-shrink-0" />
              <div>
                <div className="text-lg font-semibold">Lesson {lesson.order}</div>
                <div className="text-base opacity-95">{lesson.title}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 flex-1 overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">Lesson Steps</h3>
        <div className="space-y-3">
          {lesson.content.steps.map((step, index) => {
            const isCompleted = (progress?.currentStep || 0) > index;
            const isActive = currentStepIndex === index;
            const isAccessible = index <= (progress?.currentStep || 0);
            
            return (
              <div
                key={step.id}
                className={cn(
                  "sidebar-step flex items-center gap-3 cursor-pointer transition-all duration-200",
                  isActive && "sidebar-step active",
                  isCompleted && !isActive && "sidebar-step completed",
                  !isAccessible && !isCompleted && "opacity-50 cursor-not-allowed",
                  isAccessible && !isActive && !isCompleted && "hover:bg-accent hover:translate-x-1"
                )}
                onClick={() => isAccessible && onStepClick(index)}
                data-testid={`step-${index}`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0" />
                ) : isActive ? (
                  <Play className="h-5 w-5 flex-shrink-0" />
                ) : isAccessible ? (
                  <Circle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <Lock className="h-5 w-5 flex-shrink-0" />
                )}
                <span className="text-base font-medium leading-tight">{step.title}</span>
              </div>
            );
          })}
        </div>
        
        {lesson.content.introduction && (
          <div className="mt-8 p-4 bg-muted/20 rounded-lg">
            <h4 className="text-lg font-medium mb-3">About this Lesson</h4>
            <p className="text-base text-muted-foreground leading-relaxed">
              {lesson.content.introduction}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
