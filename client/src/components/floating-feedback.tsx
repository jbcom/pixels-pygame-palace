import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, ArrowRight, Trophy, X, Copy, Code } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface FloatingFeedbackProps {
  step: {
    id: string;
    title: string;
    hints: string[];
    solution: string;
  };
  onNextStep: () => void;
  onCompleteLesson: () => void;
  onApplySolution: (solution: string) => void;
  showNext: boolean;
  isLastStep: boolean;
  gradingResult?: {
    passed: boolean;
    feedback: string;
    expectedOutput?: string;
    actualOutput?: string;
  } | null;
}

export default function FloatingFeedback({ step, onNextStep, onCompleteLesson, onApplySolution, showNext, isLastStep, gradingResult }: FloatingFeedbackProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const { toast } = useToast();

  const handleCopySolution = async () => {
    try {
      await navigator.clipboard.writeText(step.solution);
      toast({
        title: "Solution copied!",
        description: "The solution has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try selecting and copying the text manually.",
        variant: "destructive",
      });
    }
  };

  const handleApplySolution = () => {
    onApplySolution(step.solution);
    toast({
      title: "Solution applied!",
      description: "The solution has been added to the code editor.",
    });
  };

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
            {showNext && (
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
            )}
            <Button
              variant="outline"
              onClick={() => setShowSolution(!showSolution)}
              className="min-h-[44px] px-5 text-base font-medium"
              data-testid="button-show-solution"
            >
              {showSolution ? "Hide Solution" : "Show Solution"}
            </Button>
          </div>

          {showSolution && (
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-gray-900 text-gray-100 font-mono text-base rounded-lg overflow-x-auto border border-gray-700" data-testid="solution-display">
                <pre className="whitespace-pre-wrap leading-relaxed">{step.solution}</pre>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopySolution}
                  className="flex items-center gap-2"
                  data-testid="button-copy-solution"
                >
                  <Copy className="h-4 w-4" />
                  Copy Solution
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleApplySolution}
                  className="flex items-center gap-2"
                  data-testid="button-apply-solution"
                >
                  <Code className="h-4 w-4" />
                  Apply to Editor
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
