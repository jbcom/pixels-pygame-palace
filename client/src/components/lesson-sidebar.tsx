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
    <aside className="w-96 lesson-sidebar flex flex-col">
      <div className="p-8 border-b-2 border-border bg-gradient-to-br from-primary/5 to-secondary/5">
        <h2 className="text-3xl font-bold mb-6 text-primary">Lesson Content</h2>
        <div className="space-y-3">
          <div className="lesson-tab active">
            <div className="flex items-center gap-4">
              <Play className="h-6 w-6 flex-shrink-0" />
              <div>
                <div className="text-xl font-bold">Lesson {lesson.order}</div>
                <div className="text-lg">{lesson.title}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-8 flex-1 overflow-y-auto">
        <h3 className="text-2xl font-bold mb-6 text-primary/80">Lesson Steps</h3>
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
                <span className="text-lg font-semibold leading-tight">{step.title}</span>
              </div>
            );
          })}
        </div>
        
        {lesson.content.introduction && (
          <div className="mt-10 p-6 bg-gradient-to-br from-secondary/10 to-primary/5 rounded-xl border-2 border-secondary/20">
            <h4 className="text-xl font-bold mb-4 text-primary/90">About this Lesson</h4>
            <p className="text-lg text-foreground/80 leading-relaxed">
              {lesson.content.introduction}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
