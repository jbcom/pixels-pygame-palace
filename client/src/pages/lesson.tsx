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


  // Phase A: Parse and validate Python AST
  const parseAndValidateAST = async (code: string, astRules?: any): Promise<{
    passed: boolean;
    feedback: string;
    errors: string[];
  }> => {
    if (!pyodide || !astRules) {
      console.log("🔍 AST validation skipped: no pyodide or astRules");
      return { passed: true, feedback: "", errors: [] };
    }

    console.log("🔍 Starting AST validation with:", { 
      code: code.substring(0, 100) + (code.length > 100 ? "..." : ""), 
      astRules 
    });

    try {
      // More robust data conversion - create Python dict directly
      console.log("🔍 Preparing Python execution with safer data conversion...");
      
      // Convert JavaScript astRules to Python safely
      pyodide.globals.set("js_ast_rules", astRules);
      pyodide.globals.set("js_code", code);
      
      // Use Python's ast module to parse the code with better error handling
      const parseResult = pyodide.runPython(`
import ast
import sys
import json
from js import js_ast_rules, js_code

def validate_ast(code_str, rules):
    print(f"🐍 Python AST validator starting...")
    print(f"🐍 Code to validate: {repr(code_str)}")
    print(f"🐍 Rules type: {type(rules)}")
    
    # Convert JS proxy to Python dict if needed
    if hasattr(rules, 'to_py'):
        rules = rules.to_py()
    print(f"🐍 Converted rules: {rules}")
    
    try:
        # Parse the code into an AST
        tree = ast.parse(code_str)
        print(f"🐍 AST parsed successfully")
        
        errors = []
        
        # Check required functions
        if 'requiredFunctions' in rules and rules['requiredFunctions']:
            print(f"🐍 Checking required functions: {rules['requiredFunctions']}")
            for func_name in rules['requiredFunctions']:
                found = False
                for node in ast.walk(tree):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == func_name:
                        found = True
                        print(f"🐍 Found required function: {func_name}")
                        break
                if not found:
                    error_msg = f"Required function '{func_name}()' not found"
                    print(f"🐍 ERROR: {error_msg}")
                    errors.append(error_msg)
        
        # Check required constructs
        if 'requiredConstructs' in rules and rules['requiredConstructs']:
            constructs = rules['requiredConstructs']
            print(f"🐍 Checking required constructs: {constructs}")
            
            # Handle both list and JS proxy
            if hasattr(constructs, 'to_py'):
                constructs = constructs.to_py()
            
            for i, construct in enumerate(constructs):
                print(f"🐍 Processing construct {i}: {construct}")
                
                # Convert JS proxy to Python dict if needed
                if hasattr(construct, 'to_py'):
                    construct = construct.to_py()
                
                construct_type = construct.get('type', 'unknown')
                name = construct.get('name', None)
                min_count = construct.get('minCount', 1)
                
                print(f"🐍 Checking construct: {construct_type}, name: {name}, min_count: {min_count}")
                
                count = 0
                for node in ast.walk(tree):
                    if construct_type == 'variable_assignment' and isinstance(node, ast.Assign):
                        if name is None or (len(node.targets) > 0 and isinstance(node.targets[0], ast.Name) and node.targets[0].id == name):
                            count += 1
                            print(f"🐍 Found variable assignment: {count}")
                    elif construct_type == 'function_call' and isinstance(node, ast.Call):
                        if isinstance(node.func, ast.Name):
                            if name is None or node.func.id == name:
                                count += 1
                                print(f"🐍 Found function call '{node.func.id}': {count}")
                    elif construct_type == 'string_literal':
                        # Handle both old ast.Str (Python < 3.8) and new ast.Constant (Python >= 3.8)
                        if hasattr(ast, 'Str') and isinstance(node, ast.Str):
                            count += 1
                            print(f"🐍 Found string literal (Str): {count}")
                        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
                            count += 1
                            print(f"🐍 Found string literal (Constant): {count}")
                    elif construct_type == 'f_string' and isinstance(node, ast.JoinedStr):
                        count += 1
                        print(f"🐍 Found f-string: {count}")
                    elif construct_type == 'number_literal':
                        # Handle numeric constants
                        if hasattr(ast, 'Num') and isinstance(node, ast.Num):
                            count += 1
                            print(f"🐍 Found number literal (Num): {count}")
                        elif isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                            count += 1
                            print(f"🐍 Found number literal (Constant): {count}")
                    elif construct_type == 'boolean_literal':
                        # Handle boolean constants
                        if hasattr(ast, 'NameConstant') and isinstance(node, ast.NameConstant) and node.value in (True, False):
                            count += 1
                            print(f"🐍 Found boolean literal (NameConstant): {count}")
                        elif isinstance(node, ast.Constant) and isinstance(node.value, bool):
                            count += 1
                            print(f"🐍 Found boolean literal (Constant): {count}")
                
                print(f"🐍 Final count for {construct_type}: {count}, required: {min_count}")
                
                if count < min_count:
                    if name:
                        error_msg = f"Try using {construct_type.replace('_', ' ')} '{name}' at least {min_count} time(s)"
                    else:
                        error_msg = f"Try using {construct_type.replace('_', ' ')} at least {min_count} time(s)"
                    print(f"🐍 ERROR: {error_msg}")
                    errors.append(error_msg)
        
        # Check forbidden constructs
        if 'forbiddenConstructs' in rules and rules['forbiddenConstructs']:
            forbidden = rules['forbiddenConstructs']
            print(f"🐍 Checking forbidden constructs: {forbidden}")
            
            # Handle JS proxy
            if hasattr(forbidden, 'to_py'):
                forbidden = forbidden.to_py()
            
            for construct in forbidden:
                if hasattr(construct, 'to_py'):
                    construct = construct.to_py()
                    
                construct_type = construct.get('type', 'unknown')
                name = construct.get('name', None)
                
                for node in ast.walk(tree):
                    if construct_type == 'function_call' and isinstance(node, ast.Call):
                        if isinstance(node.func, ast.Name) and (name is None or node.func.id == name):
                            if name:
                                error_msg = f"Please don't use the '{name}()' function for this exercise"
                            else:
                                error_msg = f"Please avoid using that function call for this exercise"
                            print(f"🐍 ERROR: {error_msg}")
                            errors.append(error_msg)
        
        result = {'passed': len(errors) == 0, 'errors': errors}
        print(f"🐍 Validation complete: {result}")
        return result
    
    except SyntaxError as e:
        error_result = {'passed': False, 'errors': [f"Syntax error: {str(e)}"]}
        print(f"🐍 Syntax error: {error_result}")
        return error_result
    except Exception as e:
        error_result = {'passed': False, 'errors': [f"Code analysis error: {str(e)}"]}
        print(f"🐍 Exception error: {error_result}")
        return error_result

# Use the safer data passing approach
print(f"🐍 Running validation with JS data objects...")
result = validate_ast(js_code, js_ast_rules)
print(f"🐍 Final result: {result}")
result
      `);

      console.log("🔍 Raw parseResult:", parseResult);
      
      const result = parseResult.toJs();
      console.log("🔍 Converted result:", result);
      console.log("🔍 Result type:", typeof result);
      console.log("🔍 Result properties:", Object.keys(result || {}));
      
      if (!result || typeof result !== 'object') {
        console.error("🔍 Invalid result format:", result);
        return {
          passed: false,
          feedback: "AST validation returned invalid format",
          errors: ["Invalid validation result format"]
        };
      }
      
      if (!result.passed) {
        const errors = Array.isArray(result.errors) ? result.errors : ["Unknown AST validation error"];
        console.log("🔍 AST validation failed with errors:", errors);
        return {
          passed: false,
          feedback: "Code structure issues: " + errors.join(", "),
          errors: errors
        };
      }

      console.log("🔍 AST validation passed!");
      return { passed: true, feedback: "", errors: [] };
    } catch (error) {
      console.error("🔍 Exception in AST validation:", error);
      return {
        passed: false,
        feedback: "Failed to analyze code structure: " + error,
        errors: [String(error)]
      };
    }
  };


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

  // Debug function to test AST validation directly
  const debugASTValidation = async () => {
    if (!pyodide) {
      console.log("🔍 DEBUG: Pyodide not loaded");
      return;
    }

    console.log("🔍 DEBUG: Testing AST validation with comprehensive test cases");
    
    // Test Case 1: Should FAIL - only 1 print statement when 2 required
    const failingCode = "print('Hello!')";
    const testRules = {
      requiredFunctions: ["print"],
      requiredConstructs: [
        { type: "function_call", name: "print", minCount: 2 },
        { type: "string_literal", minCount: 2 }
      ]
    };

    console.log("🔍 DEBUG TEST 1 - Should FAIL:");
    console.log("🔍 Code:", failingCode);
    console.log("🔍 Rules:", testRules);

    const result1 = await parseAndValidateAST(failingCode, testRules);
    console.log("🔍 Result 1 (should fail):", result1);

    // Test Case 2: Should PASS - 2 print statements as required
    const passingCode = "print('Hello!')\nprint('Welcome!')";
    
    console.log("\n🔍 DEBUG TEST 2 - Should PASS:");
    console.log("🔍 Code:", passingCode);
    console.log("🔍 Rules:", testRules);

    const result2 = await parseAndValidateAST(passingCode, testRules);
    console.log("🔍 Result 2 (should pass):", result2);

    // Summary
    console.log("\n🔍 VERIFICATION SUMMARY:");
    console.log("Test 1 (1 print) passed:", result1.passed, "- Expected: false");
    console.log("Test 1 feedback:", result1.feedback);
    console.log("Test 2 (2 prints) passed:", result2.passed, "- Expected: true");
    console.log("Test 2 feedback:", result2.feedback);
    
    if (!result1.passed && result2.passed) {
      console.log("✅ AST validation is working correctly!");
    } else {
      console.log("❌ AST validation needs more fixes");
    }
  };

  // Add debug function to window for manual testing and auto-trigger for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugASTValidation = debugASTValidation;
      console.log("🔍 DEBUG: Added debugASTValidation to window. Call window.debugASTValidation() to test.");
      
      // Auto-trigger debug when pyodide is ready
      if (pyodide) {
        console.log("🔍 DEBUG: Auto-triggering AST validation test...");
        setTimeout(() => {
          debugASTValidation().catch(err => console.error("🔍 DEBUG: Auto-test failed:", err));
        }, 1000);
      }
    }
  }, [pyodide]);

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
