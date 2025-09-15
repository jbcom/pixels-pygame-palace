import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Expand, Circle, AlertTriangle } from "lucide-react";
import { simulatePygame, setCanvasContext, flushFrameBuffer } from "@/lib/pygame-simulation";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GameCanvasProps {
  code: string;
  pyodide: any;
  isRunning: boolean;
}

export default function GameCanvas({ code, pyodide, isRunning }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState({
    fps: 60,
    objects: [] as Array<{ type: string; x: number; y: number; color: string; size: number }>
  });
  const [renderingMode, setRenderingMode] = useState<'real' | 'simulation' | 'error'>('simulation');
  const [lastFrameTime, setLastFrameTime] = useState(Date.now());

  useEffect(() => {
    // Safety guard: Only proceed if all requirements are met
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // Safety guard: Verify canvas context is available
    if (!ctx) {
      console.error('GameCanvas: Unable to get 2D rendering context');
      setRenderingMode('error');
      return;
    }
    
    // Safety guard: Check if this is a pygame project
    const isPygameProject = code.includes("pygame") || code.includes("import pygame") || code.includes("from pygame");
    
    if (isPygameProject && isRunning) {
      console.log('GameCanvas: Setting up real pygame rendering bridge');
      
      try {
        // Connect the rendering bridge to this canvas
        setCanvasContext(ctx);
        setRenderingMode('real');
        
        // Clear canvas initially
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set up frame timing
        const frameInterval = setInterval(() => {
          const now = Date.now();
          const deltaTime = now - lastFrameTime;
          setLastFrameTime(now);
          
          // Update FPS tracking
          const fps = Math.round(1000 / Math.max(deltaTime, 1));
          setGameState(prev => ({ ...prev, fps: Math.min(fps, 60) }));
          
          // The actual rendering is handled by the pygame shim bridge
          // when Python calls pygame.display.flip() or pygame.display.update()
        }, 16); // ~60 FPS
        
        return () => {
          clearInterval(frameInterval);
          setCanvasContext(null);
        };
        
      } catch (realRenderError) {
        console.warn('GameCanvas: Real rendering failed, falling back to simulation:', realRenderError);
        setRenderingMode('simulation');
      }
    }
    
    // Fallback to simulation for non-pygame projects or when real rendering fails
    if (!isPygameProject || renderingMode === 'simulation') {
      try {
        if (isPygameProject) {
          console.log('GameCanvas: Using simulation mode for pygame project');
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Simulate pygame rendering based on code content
          const simulation = simulatePygame(code);
          setGameState(simulation);

          // Render simulated objects
          simulation.objects.forEach(obj => {
            ctx.fillStyle = obj.color;
            if (obj.type === "circle") {
              ctx.beginPath();
              ctx.arc(obj.x, obj.y, obj.size, 0, 2 * Math.PI);
              ctx.fill();
            } else if (obj.type === "rect") {
              ctx.fillRect(obj.x - obj.size/2, obj.y - obj.size/2, obj.size, obj.size);
            }
          });

          // Add subtle grid for reference
          ctx.strokeStyle = "rgba(0,0,0,0.05)";
          ctx.lineWidth = 1;
          for (let i = 0; i < canvas.width; i += 50) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
          }
          for (let i = 0; i < canvas.height; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
          }
          
        } else {
          // Non-pygame project - show placeholder
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = "#ffffff";
          ctx.font = "20px Arial";
          ctx.textAlign = "center";
          ctx.fillText("Non-Pygame Project", canvas.width / 2, canvas.height / 2 - 10);
          ctx.fillText("Output in console below", canvas.width / 2, canvas.height / 2 + 20);
        }
        
      } catch (canvasError) {
        console.error('GameCanvas: Error during rendering:', canvasError);
        setRenderingMode('error');
        // Fallback: Show error state
        try {
          ctx.fillStyle = "#ff0000";
          ctx.font = "16px Arial";
          ctx.fillText("Rendering Error", 10, 30);
          ctx.fillText("Check console for details", 10, 50);
        } catch (fallbackError) {
          console.error('GameCanvas: Critical canvas error:', fallbackError);
        }
      }
    }
    
    // Cleanup function for when component unmounts or dependencies change
    return () => {
      setCanvasContext(null);
    };
  }, [code, isRunning, pyodide, renderingMode, lastFrameTime]);

  return (
    <div className="w-1/2 flex flex-col border-l-2 border-border">
      <div className="bg-card border-b-2 border-border p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold">Game Preview</h3>
          {renderingMode === 'real' && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              🎮 Real-time Rendering
            </Badge>
          )}
          {renderingMode === 'simulation' && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              📊 Code Simulation
            </Badge>
          )}
          {renderingMode === 'error' && (
            <Badge variant="destructive">
              ⚠️ Rendering Error
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-base font-medium">
            <Circle 
              className={`h-4 w-4 ${isRunning ? 'text-success fill-success' : 'text-muted-foreground'}`} 
            />
            <span className={isRunning ? 'text-success font-semibold' : 'text-muted-foreground'}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="p-2" data-testid="button-fullscreen">
            <Expand className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Game Canvas Area */}
      <div className="flex-1 bg-gray-900 flex flex-col items-center justify-center p-6">
        {/* Rendering Mode Alert */}
        {renderingMode === 'simulation' && code.includes('pygame') && (
          <Alert className="mb-4 max-w-3xl bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Simulation Mode:</strong> This pygame project is showing code-based simulation. 
              The actual game may render differently when running in full pygame.
            </AlertDescription>
          </Alert>
        )}
        
        {renderingMode === 'error' && (
          <Alert className="mb-4 max-w-3xl" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Canvas Error:</strong> Unable to initialize rendering context. 
              Check browser console for details.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="bg-white w-full h-full max-w-3xl max-h-[500px] relative rounded-xl overflow-hidden shadow-2xl border-2 border-gray-300">
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="w-full h-full"
            data-testid="game-canvas"
          />
        </div>
      </div>
      
      {/* Game Controls and Info */}
      <div className="bg-card border-t-2 border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium">Game Status</h4>
          <div className="flex items-center gap-3">
            <span className="text-base text-muted-foreground font-medium">FPS:</span>
            <Badge variant="secondary" className="font-mono text-base px-3 py-1 font-semibold">
              {gameState.fps}
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-6 text-base">
          <div>
            <div className="text-muted-foreground font-medium mb-2">Mode:</div>
            <Badge variant="outline" className="font-mono text-base px-3 py-1 font-semibold">
              {renderingMode === 'real' ? 'Live' : renderingMode === 'simulation' ? 'Sim' : 'Error'}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground font-medium mb-2">Objects:</div>
            <Badge variant="outline" className="font-mono text-base px-3 py-1 font-semibold">
              {gameState.objects.length}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground font-medium mb-2">Resolution:</div>
            <Badge variant="outline" className="font-mono text-base px-3 py-1 font-semibold">
              640x480
            </Badge>
          </div>
        </div>

        {gameState.objects.length > 0 && (
          <div className="mt-5 p-3 bg-muted/20 rounded-lg">
            <div className="text-base font-medium text-muted-foreground mb-3">Active Objects:</div>
            <div className="space-y-2">
              {gameState.objects.map((obj, index) => (
                <div key={index} className="text-base font-mono bg-muted px-3 py-2 rounded font-medium">
                  {obj.type} at ({Math.round(obj.x)}, {Math.round(obj.y)})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
