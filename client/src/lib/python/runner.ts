// Define PyodideInterface locally to avoid import issues
export interface PyodideInterface {
  runPython: (code: string) => any;
  globals: {
    get: (name: string) => any;
  };
}

export interface ExecutionContext {
  code: string;
  fileName: string;
  isEducational: boolean;
  files?: { [path: string]: string };
}

export interface ExecutionResult {
  output: string;
  hasError: boolean;
  error?: {
    title: string;
    message: string;
    details: string;
    traceback: string;
    suggestions: string[];
  };
}

export class PythonRunner {
  constructor(private pyodide: PyodideInterface) {}

  setInputValues(inputValues: string) {
    try {
      if (inputValues && inputValues.trim()) {
        this.pyodide.runPython(`set_input_values_from_js("${inputValues.replace(/"/g, '\\"')}")`);
      } else {
        this.pyodide.runPython(`set_input_values_from_js("")`);
      }
    } catch (error) {
      console.warn('Failed to set input values:', error);
    }
  }

  async executeCode(code: string): Promise<{ output: string; error: string }> {
    try {
      // Clear previous output and reset streams
      this.pyodide.runPython("import sys; sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__");
      
      // Execute the code
      this.pyodide.runPython(code);
      
      // Get output (basic execution)
      const output = this.pyodide.runPython("''") || "Code executed successfully!";
      return { output, error: "" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { output: "", error: errorMessage };
    }
  }

  restoreStreams() {
    try {
      this.pyodide.runPython("import sys; sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__");
    } catch (error) {
      console.warn('Failed to restore streams:', error);
    }
  }
}

export function createPythonRunner(pyodide: PyodideInterface): PythonRunner {
  return new PythonRunner(pyodide);
}