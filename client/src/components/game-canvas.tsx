import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Expand, Circle } from "lucide-react";
import { simulatePygame } from "@/lib/pygame-simulation";

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

  useEffect(() => {
    if (canvasRef.current && isRunning && code.includes("pygame")) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

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
    }
  }, [code, isRunning]);

  return (
    <div className="w-1/2 flex flex-col border-l border-border">
      <div className="bg-card border-b border-border p-4 flex items-center justify-between">
        <h3 className="font-medium">Game Preview</h3>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm">
            <Circle 
              className={`h-3 w-3 ${isRunning ? 'text-success fill-success' : 'text-muted-foreground'}`} 
            />
            <span className={isRunning ? 'text-success' : 'text-muted-foreground'}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <Button variant="ghost" size="sm" data-testid="button-fullscreen">
            <Expand className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Game Canvas Area */}
      <div className="flex-1 bg-black flex items-center justify-center p-4">
        <div className="bg-white w-full h-full max-w-2xl max-h-96 relative rounded-lg overflow-hidden shadow-lg">
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
      <div className="bg-card border-t border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">Game Status</h4>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">FPS:</span>
            <Badge variant="secondary" className="font-mono">
              {gameState.fps}
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Objects:</div>
            <Badge variant="outline" className="font-mono mt-1">
              {gameState.objects.length}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground">Resolution:</div>
            <Badge variant="outline" className="font-mono mt-1">
              640x480
            </Badge>
          </div>
        </div>

        {gameState.objects.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-muted-foreground mb-2">Active Objects:</div>
            <div className="space-y-1">
              {gameState.objects.map((obj, index) => (
                <div key={index} className="text-xs font-mono bg-muted px-2 py-1 rounded">
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
