import { useState, useEffect } from "react";

declare global {
  interface Window {
    loadPyodide: any;
    pyodideInstance: any;
    __getInput: (prompt: string) => Promise<string | null>;
  }
}

export function usePyodide() {
  const [pyodide, setPyodide] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          
          // Set up a basic pygame mock for educational purposes
          pyodideInstance.runPython(`
            import sys
            import math
            import random
            from js import console

            # Mock pygame module for educational purposes
            class MockPygame:
                def __init__(self):
                    self.QUIT = 'QUIT'
                    self.KEYDOWN = 'KEYDOWN'
                    self.K_LEFT = 'K_LEFT'
                    self.K_RIGHT = 'K_RIGHT'
                    self.K_UP = 'K_UP'
                    self.K_DOWN = 'K_DOWN'
                    self.display = self.Display()
                    self.event = self.Event()
                    self.draw = self.Draw()
                    self.time = self.Time()
                    self.key = self.Key()
                    
                def init(self):
                    console.log("Pygame initialized (mock)")
                    return True
                    
                def quit(self):
                    console.log("Pygame quit (mock)")
                    
                class Display:
                    def set_mode(self, size):
                        console.log(f"Display mode set to {size} (mock)")
                        return MockSurface()
                        
                    def set_caption(self, caption):
                        console.log(f"Window caption: {caption}")
                        
                    def flip(self):
                        console.log("Display flipped (mock)")
                        
                class Event:
                    def get(self):
                        return []
                        
                class Draw:
                    def circle(self, surface, color, pos, radius):
                        console.log(f"Drawing circle at {pos} with radius {radius}")
                        
                    def rect(self, surface, color, rect):
                        console.log(f"Drawing rectangle: {rect}")
                        
                class Time:
                    def Clock(self):
                        return MockClock()
                        
                class Key:
                    def get_pressed(self):
                        return {}

            class MockSurface:
                def fill(self, color):
                    console.log(f"Filling surface with color {color}")
                    
                def blit(self, source, dest):
                    console.log(f"Blitting surface to {dest}")

            class MockClock:
                def tick(self, fps=60):
                    console.log(f"Clock tick: {fps} FPS")

            # Install pygame mock
            pygame = MockPygame()
            sys.modules['pygame'] = pygame
            
            # Don't print initialization message - keep stdout clean for grading
          `);

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
          
          // Store instance globally for reuse
          window.pyodideInstance = pyodideInstance;
          setPyodide(pyodideInstance);
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

  return { pyodide, isLoading, error };
}