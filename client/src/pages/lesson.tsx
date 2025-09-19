import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/header";
import LessonSidebar from "@/components/lesson-sidebar";
import CodeEditor from "@/components/code-editor";
import GameCanvas from "@/components/game-canvas";
import FloatingFeedback from "@/components/floating-feedback";
import LessonIntroModal from "@/components/lesson-intro-modal";
import type { Lesson, UserProgress } from "@shared/schema";
import { usePyodide } from "@/hooks/use-pyodide";
import { createPythonRunner, type PythonRunner } from "@/lib/python/runner";
import { gradeCode, type GradingContext } from "@/lib/grading";

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [, setLocation] = useLocation();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [gradingResult, setGradingResult] = useState<{
    passed: boolean;
    feedback: string;
    expectedOutput?: string;
    actualOutput?: string;
  } | null>(null);

  const { pyodide, isLoading: pyodideLoading, error: pyodideError, executeWithEnhancedErrors, isEnhancedReady } = usePyodide();
  
  // Create PythonRunner instance when pyodide is ready
  const pythonRunner = useMemo(() => {
    if (!pyodide) return null;
    return createPythonRunner(pyodide, {
      executeWithEnhancedErrors,
      isEnhancedReady
    });
  }, [pyodide, executeWithEnhancedErrors, isEnhancedReady]);




  const { data: lesson, isLoading: lessonLoading } = useQuery<Lesson>({
    queryKey: ["/api/lessons", lessonId],
    enabled: !!lessonId,
  });

  const { data: progress } = useQuery<UserProgress | null>({
    queryKey: ["/api/progress", lessonId],
    enabled: !!lessonId,
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { currentStep?: number; completed?: boolean; code?: string }) => {
      return apiRequest("PUT", `/api/progress/${lessonId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress", lessonId] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
    }
  });


  useEffect(() => {
    if (progress && lesson) {
      setCurrentStepIndex(progress.currentStep);
      if (progress.code) {
        setCode(progress.code);
      } else if (lesson.content.steps[progress.currentStep]?.initialCode) {
        setCode(lesson.content.steps[progress.currentStep].initialCode);
      }
    } else if (lesson && lesson.content.steps[0]) {
      setCode(lesson.content.steps[0].initialCode);
      // Show intro modal for new lessons (no progress yet)
      setShowIntroModal(true);
    }
  }, [progress, lesson]);


  const executeCode = async (inputValues?: string, runAutoGrading = false) => {
    if (!pythonRunner || !code.trim()) return;

    setError("");
    setOutput("");
    setGradingResult(null);

    try {
      // Use PythonRunner for execution
      const result = await pythonRunner.runSnippet({ 
        code, 
        input: inputValues 
      });

      if (result.error) {
        setError(result.error);
        if (runAutoGrading) {
          setGradingResult({
            passed: false,
            feedback: "Your code has an error. Please fix it before checking.",
            actualOutput: result.error
          });
        }
        return;
      }

      // Success case - code executed without errors
      setOutput(result.output);
        
      // Run auto-grading if requested and step has tests
      if (runAutoGrading && currentStep && currentStep.tests && currentStep.tests.length > 0) {
        try {
          const gradingContext: GradingContext = {
            code,
            step: currentStep,
            input: inputValues,
            runner: pythonRunner,
            pyodide
          };

          // Pass pre-execution result to avoid double execution
          const gradeResult = await gradeCode(gradingContext, result);
          setGradingResult({
            passed: gradeResult.passed,
            feedback: gradeResult.feedback,
            expectedOutput: gradeResult.expectedOutput,
            actualOutput: gradeResult.actualOutput
          });

          // If all tests pass, advance to next step automatically
          if (gradeResult.passed) {
            updateProgressMutation.mutate({ 
              code,
              currentStep: Math.max(currentStepIndex + 1, (progress?.currentStep || 0))
            });
          } else {
            // Still save the code even if tests fail
            updateProgressMutation.mutate({ code });
          }
        } catch (gradingError) {
          console.error("Grading error:", gradingError);
          setGradingResult({
            passed: false,
            feedback: `Grading failed: ${gradingError instanceof Error ? gradingError.message : String(gradingError)}`,
            actualOutput: result.output
          });
          updateProgressMutation.mutate({ code });
        }
      } else {
        // Update progress with current code (regular run without grading)
        updateProgressMutation.mutate({ code });
      }
    } catch (err) {
      console.error("Python execution error:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred while executing the code.";
      setError(errorMessage);
      if (runAutoGrading) {
        setGradingResult({
          passed: false,
          feedback: "Your code has an error. Please fix it before checking.",
          actualOutput: errorMessage
        });
      }
    }
  };


  const nextStep = () => {
    if (!lesson || currentStepIndex >= lesson.content.steps.length - 1) return;
    
    const newStepIndex = currentStepIndex + 1;
    setCurrentStepIndex(newStepIndex);
    setCode(lesson.content.steps[newStepIndex].initialCode);
    setOutput("");
    setError("");
    setGradingResult(null);
    
    updateProgressMutation.mutate({ 
      currentStep: newStepIndex,
      code: lesson.content.steps[newStepIndex].initialCode 
    });
  };

  const completeLesson = () => {
    updateProgressMutation.mutate({ 
      completed: true,
      currentStep: lesson?.content.steps.length || 0
    });
    setLocation("/");
  };

  if (lessonLoading || pyodideLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {pyodideLoading ? "Loading Python runtime..." : "Loading lesson..."}
          </p>
        </div>
      </div>
    );
  }

  if (pyodideError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-destructive">
          <p>Failed to load Python runtime</p>
          <p className="text-sm mt-2">{pyodideError}</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Lesson not found</p>
      </div>
    );
  }

  const currentStep = lesson.content.steps[currentStepIndex];
  const isLastStep = currentStepIndex >= lesson.content.steps.length - 1;
  const stepProgress = ((currentStepIndex + 1) / lesson.content.steps.length) * 100;

  return (
    <div className="lesson-container">
      <Header 
        lesson={lesson} 
        progress={stepProgress}
        onBack={() => setLocation("/")}
      />
      
      <div className="flex h-screen">
        <LessonSidebar
          lesson={lesson}
          currentStepIndex={currentStepIndex}
          progress={progress}
          onStepClick={(stepIndex) => {
            if (stepIndex <= (progress?.currentStep ?? 0)) {
              setCurrentStepIndex(stepIndex);
              setCode(lesson.content.steps[stepIndex].initialCode);
              setOutput("");
              setError("");
              setGradingResult(null);
            }
          }}
        />
        
        <main className="flex-1 flex">
          <CodeEditor
            code={code}
            onChange={setCode}
            onExecute={executeCode}
            output={output}
            error={error}
            isExecuting={updateProgressMutation.isPending}
            gradingResult={gradingResult}
            currentStep={currentStep}
          />
          
          <GameCanvas
            code={code}
            pyodide={pyodide}
            isRunning={!!output && !error}
          />
        </main>
      </div>

      {currentStep && (
        <FloatingFeedback
          step={currentStep}
          onNextStep={nextStep}
          onCompleteLesson={completeLesson}
          onApplySolution={(solution) => {
            setCode(solution);
            setOutput("");
            setError("");
            setGradingResult(null);
          }}
          showNext={gradingResult?.passed || false}
          isLastStep={isLastStep}
          gradingResult={gradingResult}
        />
      )}

      {lesson && (
        <LessonIntroModal
          lesson={lesson}
          isOpen={showIntroModal}
          onClose={() => setShowIntroModal(false)}
        />
      )}
    </div>
  );
}
