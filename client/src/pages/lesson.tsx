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

  const { pyodide, isLoading: pyodideLoading, error: pyodideError, executeWithEnhancedErrors, isEnhancedReady } = usePyodide();

  // Rule-based grading engine
  const runRuleBasedGrading = async (test: any, actualOutput: string): Promise<{
    passed: boolean;
    feedback: string;
    errors: string[];
  }> => {
    console.log("🔍 Running rule-based grading with:", { 
      hasAstRules: !!test.astRules, 
      hasRuntimeRules: !!test.runtimeRules,
      astRules: test.astRules,
      runtimeRules: test.runtimeRules 
    });
    
    const errors: string[] = [];
    let allPassed = true;

    try {
      // Phase A: Parse Python AST for syntax validation
      if (test.astRules) {
        console.log("📋 Running AST validation...");
        const astResult = await parseAndValidateAST(code, test.astRules);
        console.log("📋 AST validation result:", astResult);
        
        if (!astResult.passed) {
          return {
            passed: false,
            feedback: astResult.feedback,
            errors: astResult.errors
          };
        }
      } else {
        console.log("⚠️ No AST rules provided for rule-based test");
      }

      // Phase C: Runtime behavior validation
      if (test.runtimeRules) {
        console.log("🏃 Running runtime validation...");
        const runtimeResult = await validateRuntimeBehavior(actualOutput, test.runtimeRules, test.input);
        console.log("🏃 Runtime validation result:", runtimeResult);
        
        if (!runtimeResult.passed) {
          allPassed = false;
          errors.push(...runtimeResult.errors);
        }
      } else {
        console.log("ℹ️ No runtime rules provided for rule-based test");
      }

      if (allPassed) {
        console.log("✅ All rule-based validations passed!");
        return {
          passed: true,
          feedback: "✅ Excellent! Your code demonstrates the programming concepts correctly.",
          errors: []
        };
      } else {
        console.log("❌ Some rule-based validations failed:", errors);
        return {
          passed: false,
          feedback: "❌ Your code runs but doesn't meet all the requirements. " + (Array.isArray(errors) ? errors.join(" ") : "Unknown validation errors"),
          errors: Array.isArray(errors) ? errors : []
        };
      }
    } catch (error) {
      console.error("💥 Error during rule validation:", error);
      return {
        passed: false,
        feedback: "Error during rule validation: " + error,
        errors: [String(error)]
      };
    }
  };

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

  // Phase C: Validate runtime behavior
  const validateRuntimeBehavior = async (actualOutput: string, runtimeRules?: any, testInput?: string): Promise<{
    passed: boolean;
    errors: string[];
  }> => {
    if (!runtimeRules) {
      return { passed: true, errors: [] };
    }

    const errors: string[] = [];

    // Check if output contains required strings
    if (runtimeRules.outputContains) {
      for (const required of runtimeRules.outputContains) {
        if (!actualOutput.includes(required)) {
          errors.push(`Output should contain "${required}"`);
        }
      }
    }

    // Check if output matches pattern
    if (runtimeRules.outputMatches) {
      const regex = new RegExp(runtimeRules.outputMatches);
      if (!regex.test(actualOutput)) {
        errors.push(`Output should match pattern: ${runtimeRules.outputMatches}`);
      }
    }

    // Check if output includes user input (for interactive programs)
    if (runtimeRules.outputIncludesInput && testInput) {
      const inputLines = testInput.split('\n');
      let allInputsIncluded = true;
      for (const inputLine of inputLines) {
        if (inputLine.trim() && !actualOutput.includes(inputLine.trim())) {
          allInputsIncluded = false;
          break;
        }
      }
      if (!allInputsIncluded) {
        errors.push("Output should include the user's input");
      }
    }

    return {
      passed: errors.length === 0,
      errors
    };
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

  // Fallback basic execution for when enhanced system isn't ready
  const executeCodeBasic = async (inputValues?: string, runAutoGrading = false) => {
    if (!pyodide || !code.trim()) return;

    try {
      // Basic execution with simple error capture and proper restoration
      pyodide.runPython(`
        import sys
        import io
        # Capture original streams
        original_stdout = sys.stdout
        original_stderr = sys.stderr
        # Redirect to StringIO for capture
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
      `);

      let stdout = '';
      let stderr = '';
      
      try {
        if (inputValues && inputValues.trim()) {
          pyodide.runPython(`set_input_values_from_js("${inputValues.replace(/"/g, '\\"')}")`);
        } else {
          pyodide.runPython(`set_input_values_from_js("")`);
        }

        pyodide.runPython(code);

        stdout = pyodide.runPython("sys.stdout.getvalue()");
        stderr = pyodide.runPython("sys.stderr.getvalue()");
        
      } finally {
        // CRITICAL: Always restore original streams to prevent pollution
        pyodide.runPython(`
          sys.stdout = original_stdout
          sys.stderr = original_stderr
        `);
      }

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
        setOutput(stdout || "Code executed successfully!");
        if (runAutoGrading && currentStep && currentStep.tests && currentStep.tests.length > 0) {
          // Continue with auto-grading logic...
          console.log("Basic auto-grading would continue here");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    }
  };

  const executeCode = async (inputValues?: string, runAutoGrading = false) => {
    if (!pyodide || !code.trim()) return;

    setError("");
    setOutput("");
    setGradingResult(null);

    // Check if enhanced error reporting is available
    if (!isEnhancedReady || !executeWithEnhancedErrors) {
      console.warn("Enhanced error reporting not ready, falling back to basic execution");
      // Fall back to basic execution if enhanced system isn't ready
      return executeCodeBasic(inputValues, runAutoGrading);
    }

    try {
      // Set up input values for the queue system if provided
      if (inputValues && inputValues.trim()) {
        pyodide.runPython(`set_input_values_from_js("${inputValues.replace(/"/g, '\\"')}")`);
      } else {
        pyodide.runPython(`set_input_values_from_js("")`);
      }

      // Use enhanced error capture for better educational feedback
      const context = {
        code: code,
        fileName: currentStep?.id ? `step_${currentStep.id}.py` : 'lesson.py',
        isEducational: true
      };

      const result = await executeWithEnhancedErrors(code, context);

      if (result.hasError && result.error) {
        // Enhanced error reporting with educational context and FULL traceback for learning
        let enhancedErrorText = `${result.error.title}\n\n${result.error.message}\n\n${result.error.details}`;
        
        // CRITICAL: Explicitly append full Python traceback for educational purposes
        if (result.error.traceback && result.error.traceback.trim()) {
          // Only add traceback if it's not already included in details
          if (!result.error.details.includes(result.error.traceback)) {
            enhancedErrorText += `\n\n🔍 Full Python Traceback (for learning):\n${result.error.traceback}`;
          }
        }
        
        setError(enhancedErrorText);
        
        if (runAutoGrading) {
          setGradingResult({
            passed: false,
            feedback: `🐛 ${result.error.title}\n\n${result.error.message}\n\n💡 Tips to fix this:\n${result.error.suggestions.map((s: any) => `• ${s}`).join('\n')}`,
            actualOutput: result.error.traceback || enhancedErrorText
          });
        }
        return;
      }

      // Success case - code executed without errors
      const actualOutput = result.output || "Code executed successfully!";
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
              // Reset IO streams for clean output capture with proper restoration
              pyodide.runPython(`
                import sys
                import io
                # Capture original streams for restoration
                original_stdout = sys.stdout
                original_stderr = sys.stderr
                # Redirect to StringIO for capture
                sys.stdout = io.StringIO()
                sys.stderr = io.StringIO()
              `);
              
              let testStdout = '';
              let testStderr = '';
              
              try {
                // Set up test inputs if provided
                if (test.input && test.input.trim()) {
                  pyodide.runPython(`set_input_values_from_js("${test.input.replace(/"/g, '\\"')}")`);
                } else {
                  pyodide.runPython(`set_input_values_from_js("")`);
                }
                
                // Execute code again for this test
                pyodide.runPython(code);
                
                // Get clean output
                testStdout = pyodide.runPython("sys.stdout.getvalue()");
                testStderr = pyodide.runPython("sys.stderr.getvalue()");
                
              } finally {
                // CRITICAL: Always restore original streams to prevent pollution
                pyodide.runPython(`
                  sys.stdout = original_stdout
                  sys.stderr = original_stderr
                `);
              }
              
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
                let testPassed = false;
                let feedback = "";
                
                // Check if this test uses rule-based grading or traditional output matching
                if (test.mode === 'rules' && (test.astRules || test.runtimeRules)) {
                  // Use new rule-based grading system
                  const ruleResult = await runRuleBasedGrading(test, testStdout || "");
                  testPassed = ruleResult.passed;
                  feedback = ruleResult.feedback;
                } else {
                  // Use traditional exact output matching for backward compatibility
                  const expectedNormalized = test.expectedOutput.trim().replace(/\s+/g, ' ');
                  const actualNormalized = (testStdout || "").trim().replace(/\s+/g, ' ');
                  testPassed = actualNormalized === expectedNormalized;
                  feedback = testPassed ? "Perfect match!" : `Expected: "${test.expectedOutput}" but got: "${testStdout || ""}"`;
                }
                
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
      } // end if (runAutoGrading && ...)
    } catch (err) {
      console.error("Enhanced Python execution error:", err);
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

  const executeCodeBackup = async (inputValues?: string, runAutoGrading = false) => {
    return executeCodeBasic(inputValues, runAutoGrading);
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
