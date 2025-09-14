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
    <div className="w-1/2 flex flex-col border-l-2 border-border">
      <div className="bg-card border-b-2 border-border p-5 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Game Preview</h3>
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
      <div className="flex-1 bg-gray-900 flex items-center justify-center p-6">
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
        
        <div className="grid grid-cols-2 gap-6 text-base">
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
