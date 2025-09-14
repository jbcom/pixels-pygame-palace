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
    <Card className="fixed bottom-8 right-8 w-96 shadow-xl border-2 border-border bg-card" data-testid="floating-feedback">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="text-secondary mt-1 h-6 w-6 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-lg font-semibold mb-1">
                {showNext ? "Great job!" : "Step Hint"}
              </h4>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-8 w-8 p-0 hover:bg-muted rounded-full"
            data-testid="button-dismiss-feedback"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {showNext ? (
            <p className="text-base text-muted-foreground leading-relaxed">
              Excellent work! You've successfully completed this step. 
              {isLastStep ? " You're ready to finish this lesson!" : " Ready for the next challenge?"}
            </p>
          ) : (
            <>
              {step.hints.length > 0 && (
                <div className="space-y-3">
                  {step.hints.map((hint, index) => (
                    <p key={index} className="text-base text-muted-foreground flex gap-2">
                      <span className="text-lg">•</span>
                      <span className="leading-relaxed">{hint}</span>
                    </p>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-3 pt-3">
            {showNext ? (
              <Button
                onClick={isLastStep ? onCompleteLesson : onNextStep}
                className="btn-primary flex items-center gap-2"
                data-testid={isLastStep ? "button-complete-lesson" : "button-next-step"}
              >
                {isLastStep ? (
                  <>
                    <Trophy className="h-5 w-5" />
                    <span className="text-base font-semibold">Complete Lesson</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-5 w-5" />
                    <span className="text-base font-semibold">Next Step</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowSolution(!showSolution)}
                className="min-h-[44px] px-5 text-base font-medium"
                data-testid="button-show-solution"
              >
                {showSolution ? "Hide Solution" : "Show Solution"}
              </Button>
            )}
          </div>

          {showSolution && (
            <div className="mt-4 p-4 bg-code-bg text-white font-mono text-base rounded-lg overflow-x-auto">
              <pre className="whitespace-pre-wrap leading-relaxed">{step.solution}</pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
