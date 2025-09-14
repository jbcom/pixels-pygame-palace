import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, User } from "lucide-react";
import type { Lesson } from "@shared/schema";

interface HeaderProps {
  lesson: Lesson;
  progress: number;
  onBack: () => void;
}

export default function Header({ lesson, progress, onBack }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mr-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="flex items-center space-x-2">
              <Gamepad2 className="text-primary text-2xl h-6 w-6" />
              <h1 className="text-xl font-bold text-primary">PyGame Academy</h1>
            </div>
            
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Lesson {lesson.order}:</span>
              <span className="font-medium">{lesson.title}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Progress:</span>
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300" 
                  style={{ width: `${Math.round(progress)}%` }}
                  data-testid="progress-bar"
                ></div>
              </div>
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>
            
            <Button className="bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90">
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
