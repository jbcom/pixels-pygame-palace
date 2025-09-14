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
            
            print("Python environment ready with pygame mock!")
          `);

          // Create a working input system for Pyodide v0.24.1
          pyodideInstance.runPython(`
            import builtins
            import js
            
            # Global input bridge function that will be set by JS
            __pending_inputs = []
            
            def __input__(prompt=""):
                # Simple fallback - just return a default for now
                # This prevents crashes while we implement proper async handling
                print(f"Input prompt: {prompt}")
                return "demo_input"  # Simple fallback value
            
            # Replace built-in input function
            builtins.input = __input__
            
            print("Input system initialized with simple fallback!")
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