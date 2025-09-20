// PyGame Runner Component - Executes compiled Python games using Pyodide
import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RefreshCw, Download, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { compilePythonGame } from '@/lib/pygame-game-compiler';

interface PygameRunnerProps {
  selectedComponents?: Record<string, string>;
  selectedAssets?: any[];
  previewMode?: string;
  className?: string;
  onError?: (error: string) => void;
}

// Declare Pyodide types
declare global {
  interface Window {
    loadPyodide: any;
    pyodide: any;
  }
}

export default function PygameRunner({
  selectedComponents = {},
  selectedAssets = [],
  previewMode = 'full',
  className = '',
  onError
}: PygameRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pyodideRef = useRef<any>(null);
  const animationFrameRef = useRef<number>();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Pyodide
  const initPyodide = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load Pyodide if not already loaded
      if (!window.pyodide) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        script.async = true;
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
        
        // Wait for Pyodide to be available
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (window.loadPyodide) {
              clearInterval(checkInterval);
              resolve(true);
            }
          }, 100);
        });
        
        // Initialize Pyodide
        window.pyodide = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
        });
        
        // Install pygame (simplified pygame-ce for browser)
        await window.pyodide.loadPackage('micropip');
        const micropip = window.pyodide.pyimport('micropip');
        await micropip.install('pygame-ce');
      }
      
      pyodideRef.current = window.pyodide;
      
      // Setup canvas bridge for pygame
      await setupCanvasBridge();
      
      setIsLoading(false);
    } catch (err) {
      const errorMsg = `Failed to initialize Pyodide: ${err}`;
      setError(errorMsg);
      setIsLoading(false);
      if (onError) onError(errorMsg);
    }
  }, [onError]);

  // Setup bridge between Pyodide and canvas
  const setupCanvasBridge = async () => {
    if (!pyodideRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Inject canvas functions into Python environment
    pyodideRef.current.runPython(`
import sys
import js
from pyodide.ffi import to_js

class BrowserCanvas:
    def __init__(self):
        self.canvas = js.document.getElementById('pygame-canvas')
        self.ctx = self.canvas.getContext('2d')
        self.width = 800
        self.height = 600
        
    def clear(self, color=(0, 0, 0)):
        self.ctx.fillStyle = f'rgb({color[0]}, {color[1]}, {color[2]})'
        self.ctx.fillRect(0, 0, self.width, self.height)
        
    def draw_circle(self, color, pos, radius):
        self.ctx.fillStyle = f'rgb({color[0]}, {color[1]}, {color[2]})'
        self.ctx.beginPath()
        self.ctx.arc(pos[0], pos[1], radius, 0, 2 * 3.14159)
        self.ctx.fill()
        
    def draw_rect(self, color, rect):
        self.ctx.fillStyle = f'rgb({color[0]}, {color[1]}, {color[2]})'
        self.ctx.fillRect(rect[0], rect[1], rect[2], rect[3])
        
    def draw_line(self, color, start, end, width=1):
        self.ctx.strokeStyle = f'rgb({color[0]}, {color[1]}, {color[2]})'
        self.ctx.lineWidth = width
        self.ctx.beginPath()
        self.ctx.moveTo(start[0], start[1])
        self.ctx.lineTo(end[0], end[1])
        self.ctx.stroke()
        
    def draw_text(self, text, pos, color=(255, 255, 255), size=16):
        self.ctx.fillStyle = f'rgb({color[0]}, {color[1]}, {color[2]})'
        self.ctx.font = f'{size}px monospace'
        self.ctx.fillText(text, pos[0], pos[1])

# Global canvas instance
browser_canvas = BrowserCanvas()

# Mock pygame module
class MockPygame:
    class display:
        @staticmethod
        def set_mode(size):
            return browser_canvas
            
        @staticmethod
        def flip():
            pass
            
        @staticmethod
        def set_caption(title):
            pass
    
    class draw:
        @staticmethod
        def circle(surface, color, pos, radius):
            browser_canvas.draw_circle(color, pos, radius)
            
        @staticmethod
        def rect(surface, color, rect):
            browser_canvas.draw_rect(color, rect)
            
        @staticmethod
        def line(surface, color, start, end, width=1):
            browser_canvas.draw_line(color, start, end, width)
    
    class font:
        @staticmethod
        def Font(name, size):
            class TextRenderer:
                def render(self, text, antialias, color):
                    class TextSurface:
                        def get_rect(self, **kwargs):
                            class Rect:
                                def __init__(self):
                                    self.center = kwargs.get('center', (0, 0))
                                    self.x = self.center[0] - len(text) * 4
                                    self.y = self.center[1] - 8
                            return Rect()
                    return TextSurface()
            return TextRenderer()
    
    class event:
        @staticmethod
        def get():
            return []
    
    class key:
        @staticmethod
        def get_pressed():
            return {65: False, 68: False, 32: False}  # A, D, Space keys
    
    class time:
        class Clock:
            def tick(self, fps):
                return 16
    
    @staticmethod
    def init():
        pass
    
    @staticmethod
    def quit():
        pass
    
    QUIT = 12
    K_SPACE = 32
    K_LEFT = 276
    K_RIGHT = 275
    K_a = 97
    K_d = 100
    K_r = 114
    K_x = 120

# Replace pygame with mock
sys.modules['pygame'] = MockPygame()
pygame = MockPygame()
    `);
  };

  // Run the compiled game
  const runGame = useCallback(async () => {
    if (!pyodideRef.current) {
      await initPyodide();
    }
    
    if (!pyodideRef.current) {
      setError('Pyodide not initialized');
      return;
    }
    
    setIsRunning(true);
    setError(null);
    
    try {
      // Compile the game
      const pythonCode = compilePythonGame(selectedComponents, selectedAssets);
      
      // Simplify the game for browser execution
      const simplifiedCode = pythonCode
        .replace(/pygame\.mixer\..*\n/g, '')  // Remove sound for now
        .replace(/pygame\.image\.load.*\n/g, '')  // Remove image loading for now
        .replace(/self\.assets\[.*?\]/g, 'None')  // Replace asset references
        .replace(/if __name__ == "__main__":/g, 'if True:');  // Always run
      
      // Run the game
      await pyodideRef.current.runPythonAsync(simplifiedCode);
      
    } catch (err) {
      const errorMsg = `Game execution error: ${err}`;
      setError(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setIsRunning(false);
    }
  }, [selectedComponents, selectedAssets, onError, initPyodide]);

  // Stop the game
  const stopGame = useCallback(() => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    stopGame();
    setError(null);
    runGame();
  }, [stopGame, runGame]);

  // Download game as Python file
  const downloadGame = useCallback(() => {
    const pythonCode = compilePythonGame(selectedComponents, selectedAssets);
    const blob = new Blob([pythonCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_pygame_${Date.now()}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedComponents, selectedAssets]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Initialize on mount
  useEffect(() => {
    initPyodide();
    return () => {
      stopGame();
    };
  }, []);

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-0 z-50' : 'relative'}`}>
      <div className="flex flex-col h-full">
        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button
              onClick={isRunning ? stopGame : runGame}
              disabled={isLoading}
              variant={isRunning ? 'destructive' : 'default'}
              size="sm"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Game
                </>
              )}
            </Button>
            
            <Button
              onClick={resetGame}
              disabled={isLoading || !isRunning}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={downloadGame}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            
            <Button
              onClick={toggleFullscreen}
              variant="outline"
              size="sm"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Game Canvas */}
        <div className="flex-1 flex items-center justify-center bg-black p-4">
          {isLoading ? (
            <div className="text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading Pyodide...</p>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center max-w-md">
              <p className="font-bold mb-2">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <canvas
              id="pygame-canvas"
              ref={canvasRef}
              width={800}
              height={600}
              className="border border-gray-700 max-w-full h-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>
        
        {/* Status */}
        {previewMode && (
          <div className="p-2 bg-gray-100 dark:bg-gray-900 text-center text-sm">
            Preview Mode: {previewMode}
          </div>
        )}
      </div>
    </Card>
  );
}