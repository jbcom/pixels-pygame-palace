import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/header";
import LessonSidebar from "@/components/lesson-sidebar";
import CodeEditor from "@/components/code-editor";
import GameCanvas from "@/components/game-canvas";
import FloatingFeedback from "@/components/floating-feedback";
import LessonIntroModal from "@/components/lesson-intro-modal";
import type { Lesson, UserProgress } from "@shared/schema";
import { usePyodide } from "@/hooks/use-pyodide";

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
      // Show intro modal for new lessons (no progress yet)
      setShowIntroModal(true);
    }
  }, [progress, lesson]);

  const executeCode = async (inputValues?: string, runAutoGrading = false) => {
    if (!pyodide || !code.trim()) return;

    setError("");
    setOutput("");
    setGradingResult(null);

    try {
      // Capture console output
      pyodide.runPython(`
        import sys
        import io
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
      `);

      // Set up input values for the queue system if provided
      if (inputValues && inputValues.trim()) {
        pyodide.runPython(`set_input_values_from_js("${inputValues.replace(/"/g, '\\"')}")`);
      } else {
        // Clear the input queue if no values provided
        pyodide.runPython(`set_input_values_from_js("")`);
      }

      // Execute user code synchronously - input() now works with the queue system
      pyodide.runPython(code);

      // Get output
      const stdout = pyodide.runPython("sys.stdout.getvalue()");
      const stderr = pyodide.runPython("sys.stderr.getvalue()");

      if (stderr) {
        setError(stderr);
        if (runAutoGrading) {
          setGradingResult({
            passed: false,
            feedback: "Your code has an error. Please fix it before checking.",
            actualOutput: stderr
          });
        }
      } else {
        const actualOutput = stdout || "Code executed successfully!";
        setOutput(actualOutput);
        
        // Run auto-grading if requested
        if (runAutoGrading && currentStep && currentStep.tests && currentStep.tests.length > 0) {
          // Run all tests and collect results
          const testResults: Array<{
            testIndex: number;
            passed: boolean;
            expectedOutput: string;
            actualOutput: string;
            input?: string;
          }> = [];
          
          let allTestsPassed = true;
          
          for (let i = 0; i < currentStep.tests.length; i++) {
            const test = currentStep.tests[i];
            
            try {
              // Reset IO streams for clean output capture
              pyodide.runPython(`
                import sys
                import io
                sys.stdout = io.StringIO()
                sys.stderr = io.StringIO()
              `);
              
              // Set up test inputs if provided
              if (test.input && test.input.trim()) {
                pyodide.runPython(`set_input_values_from_js("${test.input.replace(/"/g, '\\"')}")`);
              } else {
                pyodide.runPython(`set_input_values_from_js("")`);
              }
              
              // Execute code again for this test
              pyodide.runPython(code);
              
              // Get clean output
              const testStdout = pyodide.runPython("sys.stdout.getvalue()");
              const testStderr = pyodide.runPython("sys.stderr.getvalue()");
              
              if (testStderr) {
                // Code has error for this test
                testResults.push({
                  testIndex: i,
                  passed: false,
                  expectedOutput: test.expectedOutput,
                  actualOutput: testStderr,
                  input: test.input
                });
                allTestsPassed = false;
              } else {
                // Normalize outputs for comparison
                const expectedNormalized = test.expectedOutput.trim().replace(/\s+/g, ' ');
                const actualNormalized = (testStdout || "").trim().replace(/\s+/g, ' ');
                const testPassed = actualNormalized === expectedNormalized;
                
                testResults.push({
                  testIndex: i,
                  passed: testPassed,
                  expectedOutput: test.expectedOutput,
                  actualOutput: testStdout || "",
                  input: test.input
                });
                
                if (!testPassed) {
                  allTestsPassed = false;
                }
              }
            } catch (testErr) {
              testResults.push({
                testIndex: i,
                passed: false,
                expectedOutput: test.expectedOutput,
                actualOutput: `Test execution error: ${testErr}`,
                input: test.input
              });
              allTestsPassed = false;
            }
          }
          
          // Provide detailed feedback based on test results
          let feedback = "";
          if (allTestsPassed) {
            feedback = "✅ Perfect! Your code passes all tests.";
          } else {
            const failedTests = testResults.filter(t => !t.passed);
            if (failedTests.length === 1) {
              feedback = `❌ Test failed. Expected: "${failedTests[0].expectedOutput}" but got: "${failedTests[0].actualOutput}"`;
            } else {
              feedback = `❌ ${failedTests.length} out of ${testResults.length} tests failed. Check the expected output carefully.`;
            }
          }
          
          setGradingResult({
            passed: allTestsPassed,
            feedback,
            expectedOutput: currentStep.tests[0].expectedOutput, // Show first test for reference
            actualOutput: testResults[0]?.actualOutput || ""
          });
          
          // If all tests pass, advance to next step automatically
          if (allTestsPassed) {
            updateProgressMutation.mutate({ 
              code,
              currentStep: Math.max(currentStepIndex + 1, (progress?.currentStep || 0))
            });
          } else {
            // Still save the code even if tests fail
            updateProgressMutation.mutate({ code });
          }
        } else {
          // Update progress with current code (regular run without grading)
          updateProgressMutation.mutate({ code });
        }
      }
    } catch (err) {
      console.error("Python execution error:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred while executing the code.";
      
      // Handle specific input-related errors gracefully
      if (errorMessage.includes("__getInput") || errorMessage.includes("input")) {
        const message = "Input functionality is currently in demo mode. Your code will run with default values.";
        setError(message);
        setOutput("Code executed with demo input values!");
        if (runAutoGrading) {
          setGradingResult({
            passed: false,
            feedback: "Input functionality is currently in demo mode. Please check manually.",
            actualOutput: message
          });
        }
      } else {
        setError(errorMessage);
        if (runAutoGrading) {
          setGradingResult({
            passed: false,
            feedback: "Your code has an error. Please fix it before checking.",
            actualOutput: errorMessage
          });
        }
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
