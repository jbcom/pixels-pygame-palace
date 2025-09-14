import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/header";
import LessonSidebar from "@/components/lesson-sidebar";
import CodeEditor from "@/components/code-editor";
import GameCanvas from "@/components/game-canvas";
import FloatingFeedback from "@/components/floating-feedback";
import type { Lesson, UserProgress } from "@shared/schema";
import { usePyodide } from "@/hooks/use-pyodide";

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [, setLocation] = useLocation();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const { pyodide, isLoading: pyodideLoading, error: pyodideError } = usePyodide();

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
    }
  }, [progress, lesson]);

  const executeCode = async () => {
    if (!pyodide || !code.trim()) return;

    setError("");
    setOutput("");

    try {
      // Capture console output
      pyodide.runPython(`
        import sys
        import io
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
      `);

      // Check if code contains input() calls - if so, transform it for async execution
      const hasInputCall = code.includes('input(');
      
      if (hasInputCall) {
        // Transform code to work with async input system
        const transformedCode = `
import asyncio
from js import __getInput as js_get_input

async def __async_input__(prompt=""):
    try:
        # Call the React modal system
        result = await js_get_input(str(prompt))
        return str(result) if result is not None else ""
    except Exception as e:
        print(f"Input error: {e}")
        return "input_error"

# Replace input function temporarily
original_input = input
import builtins
builtins.input = lambda prompt="": asyncio.create_task(__async_input__(prompt))

async def main():
    # User code goes here
${code.split('\n').map(line => `    ${line}`).join('\n')}

# Run the async main function
await main()
`;

        // Execute with async support using runPythonAsync
        if (pyodide.runPythonAsync) {
          await pyodide.runPythonAsync(transformedCode);
        } else {
          // Fallback to regular execution with simple input
          pyodide.runPython(code);
        }
      } else {
        // No input calls, use regular synchronous execution
        pyodide.runPython(code);
      }

      // Get output
      const stdout = pyodide.runPython("sys.stdout.getvalue()");
      const stderr = pyodide.runPython("sys.stderr.getvalue()");

      if (stderr) {
        setError(stderr);
      } else {
        setOutput(stdout || "Code executed successfully!");
        
        // Update progress with current code
        updateProgressMutation.mutate({ code });
      }
    } catch (err) {
      console.error("Python execution error:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred while executing the code.";
      
      // Handle specific input-related errors gracefully
      if (errorMessage.includes("__getInput") || errorMessage.includes("input")) {
        setError("Input functionality is currently in demo mode. Your code will run with default values.");
        setOutput("Code executed with demo input values!");
      } else {
        setError(errorMessage);
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
    <div className="min-h-screen bg-background">
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
          }}
          showNext={!!output && !error}
          isLastStep={isLastStep}
        />
      )}
    </div>
  );
}
