import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, ArrowRight, Trophy, X } from "lucide-react";
import { useState } from "react";

interface FloatingFeedbackProps {
  step: {
    id: string;
    title: string;
    hints: string[];
    solution: string;
  };
  onNextStep: () => void;
  onCompleteLesson: () => void;
  showNext: boolean;
  isLastStep: boolean;
}

export default function FloatingFeedback({ step, onNextStep, onCompleteLesson, showNext, isLastStep }: FloatingFeedbackProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showSolution, setShowSolution] = useState(false);

  if (!isVisible) return null;

  return (
    <Card className="fixed bottom-6 right-6 w-80 shadow-lg border-border" data-testid="floating-feedback">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3">
            <Lightbulb className="text-secondary mt-1 h-5 w-5" />
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">
                {showNext ? "Great job!" : "Step Hint"}
              </h4>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
            data-testid="button-dismiss-feedback"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {showNext ? (
            <p className="text-sm text-muted-foreground">
              Excellent work! You've successfully completed this step. 
              {isLastStep ? " You're ready to finish this lesson!" : " Ready for the next challenge?"}
            </p>
          ) : (
            <>
              {step.hints.length > 0 && (
                <div className="space-y-2">
                  {step.hints.map((hint, index) => (
                    <p key={index} className="text-sm text-muted-foreground">
                      • {hint}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex items-center space-x-2 pt-2">
            {showNext ? (
              <Button
                onClick={isLastStep ? onCompleteLesson : onNextStep}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center space-x-2"
                data-testid={isLastStep ? "button-complete-lesson" : "button-next-step"}
              >
                {isLastStep ? (
                  <>
                    <Trophy className="h-4 w-4" />
                    <span>Complete Lesson</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Next Step</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowSolution(!showSolution)}
                className="text-xs"
                data-testid="button-show-solution"
              >
                {showSolution ? "Hide Solution" : "Show Solution"}
              </Button>
            )}
          </div>

          {showSolution && (
            <div className="mt-3 p-3 bg-code-bg text-white font-mono text-xs rounded overflow-x-auto">
              <pre className="whitespace-pre-wrap">{step.solution}</pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
