import { useState, useEffect } from "react";
import { registerPygameShim } from "@/lib/pygame-simulation";
import { createEnhancedErrorCapture, type FormattedError, type ErrorContext } from "@/lib/python-error-handler";

declare global {
  interface Window {
    loadPyodide: any;
    pyodideInstance: any;
    __getInput: (prompt: string) => Promise<string | null>;
  }
}

export interface PyodideEnhanced {
  pyodide: any;
  executeWithEnhancedErrors: (code: string, context?: ErrorContext) => Promise<{
    output: string;
    error: FormattedError | null;
    hasError: boolean;
  }>;
  setupErrorCapture: () => void;
}

export function usePyodide() {
  const [pyodide, setPyodide] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enhancedCapture, setEnhancedCapture] = useState<any>(null);

  useEffect(() => {
    const loadPyodideInstance = async () => {
      try {
        // Check if Pyodide instance already exists
        if (window.pyodideInstance) {
          setPyodide(window.pyodideInstance);
          setIsLoading(false);
          return;
        }

        // Function to initialize Pyodide and set up pygame mock
        const initializePyodide = async () => {
          const pyodideInstance = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
          });
          
          // Install basic packages that might be useful for pygame simulation
          await pyodideInstance.loadPackage(['numpy', 'matplotlib']);
          
          // Register the enhanced pygame shim
          registerPygameShim(pyodideInstance);

          // CRITICAL: Store instance globally BEFORE setting up enhanced error capture
          // The error capture system needs window.pyodideInstance to be available during setup
          window.pyodideInstance = pyodideInstance;
          setPyodide(pyodideInstance);

          // Set up enhanced error capture with proper verification
          const errorCapture = createEnhancedErrorCapture();
          const setupSuccess = errorCapture.setupErrorCapture();
          
          if (setupSuccess) {
            console.log('Enhanced error capture successfully initialized and verified');
            setEnhancedCapture(errorCapture);
          } else {
            console.warn('Enhanced error capture setup failed, falling back to basic error handling');
            setEnhancedCapture(null);
          }

          // Create a synchronous queue-based input system
          pyodideInstance.runPython(`
            import builtins
            import js
            
            # Global input queue that will be managed by JS
            __input_queue = []
            __input_index = 0
            
            def __input__(prompt=""):
                global __input_queue, __input_index
                # Don't print debug messages - they pollute stdout and break grading
                
                # Return the next value from the queue if available
                if __input_index < len(__input_queue):
                    value = __input_queue[__input_index]
                    __input_index += 1
                    return str(value)
                else:
                    # If queue is empty, return a reasonable default
                    return "default_input"
            
            # Synchronous function to set input values from JS
            def __set_input_values__(values_list):
                global __input_queue, __input_index
                __input_queue = values_list
                __input_index = 0
                # Don't print debug messages - they pollute stdout and break grading
            
            # Replace built-in input function with synchronous version
            builtins.input = __input__
            
            # Don't print initialization message - keep stdout clean
          `);
          
          // Add function to set input values from JavaScript
          pyodideInstance.runPython(`
            # Expose the function to JavaScript
            from js import console
            def set_input_values_from_js(values_str):
                if values_str and values_str.strip():
                    # Split by newline to match test data format, strip whitespace
                    values = [v.strip() for v in values_str.split('\\n') if v.strip()]
                    __set_input_values__(values)
                else:
                    __set_input_values__([])
            
            # Make it available to JS
            import sys
            sys.modules['__main__'].set_input_values_from_js = set_input_values_from_js
          `);
          
          // Note: pyodideInstance is already stored globally and setPyodide called above
        };

        // Check if loadPyodide exists but instance hasn't been created
        if (window.loadPyodide) {
          try {
            await initializePyodide();
          } catch (err) {
            console.error('Failed to initialize Pyodide:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize Python runtime');
          } finally {
            setIsLoading(false);
          }
        } else {
          // Load script from CDN
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
          script.onload = async () => {
            try {
              await initializePyodide();
            } catch (err) {
              console.error('Failed to initialize Pyodide:', err);
              setError(err instanceof Error ? err.message : 'Failed to initialize Python runtime');
            } finally {
              setIsLoading(false);
            }
          };
          script.onerror = () => {
            setError('Failed to load Pyodide script');
            setIsLoading(false);
          };
          document.head.appendChild(script);
        }
      } catch (err) {
        console.error('Error setting up Pyodide:', err);
        setError(err instanceof Error ? err.message : 'Failed to setup Python runtime');
        setIsLoading(false);
      }
    };

    loadPyodideInstance();
  }, []);

  return { 
    pyodide, 
    isLoading, 
    error,
    executeWithEnhancedErrors: enhancedCapture ? 
      (code: string, context?: ErrorContext) => enhancedCapture.executeWithErrorCapture(code, context) : 
      async () => ({ output: '', error: null, hasError: false }),
    setupErrorCapture: enhancedCapture ? 
      () => enhancedCapture.setupErrorCapture() : 
      () => {},
    isEnhancedReady: !!enhancedCapture && !!pyodide && enhancedCapture.isReadyForCapture?.() === true
  };
}