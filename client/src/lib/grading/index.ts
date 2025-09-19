export interface TestResult {
  testIndex: number;
  passed: boolean;
  expectedOutput: string;
  actualOutput: string;
  input?: string;
}

export interface GradingResult {
  passed: boolean;
  feedback: string;
  expectedOutput?: string;
  actualOutput?: string;
}

export interface TestSpec {
  expectedOutput: string;
  input?: string;
  mode?: 'rules' | 'output';
  astRules?: any[];
  runtimeRules?: any[];
}

export function gradeTests(testResults: TestResult[]): GradingResult {
  const allTestsPassed = testResults.every(t => t.passed);
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

  return {
    passed: allTestsPassed,
    feedback,
    expectedOutput: testResults[0]?.expectedOutput || "",
    actualOutput: testResults[0]?.actualOutput || ""
  };
}

export async function runRuleBasedGrading(test: TestSpec, output: string): Promise<{ passed: boolean; feedback: string }> {
  // Placeholder for rule-based grading - can be expanded later
  const expectedNormalized = test.expectedOutput.trim().replace(/\s+/g, ' ');
  const actualNormalized = output.trim().replace(/\s+/g, ' ');
  const passed = actualNormalized === expectedNormalized;
  const feedback = passed ? "Perfect match!" : `Expected: "${test.expectedOutput}" but got: "${output}"`;
  
  return { passed, feedback };
}