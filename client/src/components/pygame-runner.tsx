// PyGame Runner Component - Executes compiled Python games using backend API
import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RefreshCw, Download, Maximize, Minimize, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { compilePythonGame } from '@/lib/pygame-game-compiler';
import { gameApi } from '@/lib/gameApi';
import { useLocation } from 'wouter';

interface PygameRunnerProps {
  selectedComponents?: Record<string, string>;
  selectedAssets?: any[];
  previewMode?: string;
  className?: string;
  onError?: (error: string) => void;
  onClose?: () => void;
  gameProject?: any;
}

export default function PygameRunner({
  selectedComponents = {},
  selectedAssets = [],
  previewMode = 'full',
  className = '',
  onError,
  onClose,
  gameProject
}: PygameRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [, setLocation] = useLocation();
  
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Get game project from props or localStorage
  const getGameData = useCallback(() => {
    if (gameProject) {
      return {
        components: gameProject.components || selectedComponents,
        assets: gameProject.assets || selectedAssets,
        gameType: gameProject.gameType || 'platformer'
      };
    }
    
    // Try to get from localStorage if no prop provided
    const savedProject = localStorage.getItem('currentGameProject');
    if (savedProject) {
      const parsed = JSON.parse(savedProject);
      return {
        components: parsed.components || selectedComponents,
        assets: parsed.assets || selectedAssets,
        gameType: parsed.gameType || 'platformer'
      };
    }
    
    // Fall back to passed props
    return {
      components: selectedComponents,
      assets: selectedAssets,
      gameType: 'platformer'
    };
  }, [gameProject, selectedComponents, selectedAssets]);

  // Setup Server-Sent Events stream for game frames
  const setupGameStream = useCallback((sessionId: string) => {
    // Close existing stream if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // Create new EventSource for streaming
    const eventSource = gameApi.streamGameOutput(
      sessionId,
      (frameData) => {
        // Display frame on canvas
        displayFrame(frameData);
      },
      () => {
        // Game ended
        setIsRunning(false);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    );
    
    eventSourceRef.current = eventSource;
  }, []);

  // Display a base64 encoded frame on the canvas
  const displayFrame = useCallback((base64Frame: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      // Clear canvas and draw new frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = `data:image/png;base64,${base64Frame}`;
  }, []);

  // Run the compiled game
  const runGame = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadingMessage('Compiling game...');
    
    try {
      // Get game data
      const gameData = getGameData();
      
      // Compile the game locally using existing compiler
      const pythonCode = compilePythonGame(gameData.components, gameData.assets);
      
      // Check backend health first
      setLoadingMessage('Connecting to game server...');
      const isHealthy = await gameApi.checkHealth();
      if (!isHealthy) {
        throw new Error('Game server is not available. Please ensure the backend is running on port 5001.');
      }
      
      // Send compiled code to backend for execution
      setLoadingMessage('Starting game engine...');
      const executeResponse = await gameApi.executeGame(pythonCode);
      
      if (!executeResponse.success || !executeResponse.session_id) {
        throw new Error(executeResponse.error || 'Failed to start game execution');
      }
      
      // Store session ID for later use
      sessionIdRef.current = executeResponse.session_id;
      
      // Setup SSE to receive game frames
      setLoadingMessage('Establishing game stream...');
      setupGameStream(executeResponse.session_id);
      
      setIsRunning(true);
      setIsLoading(false);
      setLoadingMessage('');
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start game';
      setError(errorMsg);
      setIsLoading(false);
      setLoadingMessage('');
      if (onError) onError(errorMsg);
    }
  }, [getGameData, setupGameStream, onError]);

  // Stop the game
  const stopGame = useCallback(async () => {
    setIsRunning(false);
    
    // Close SSE stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Stop game on backend if session exists
    if (sessionIdRef.current) {
      try {
        await gameApi.stopGame(sessionIdRef.current);
      } catch (err) {
        console.error('Failed to stop game on backend:', err);
      }
      sessionIdRef.current = null;
    }
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Show "Press Start" message
        ctx.fillStyle = 'white';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Press "Start your engines!" to play', canvas.width / 2, canvas.height / 2);
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
    const gameData = getGameData();
    const pythonCode = compilePythonGame(gameData.components, gameData.assets);
    const blob = new Blob([pythonCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_pygame_${Date.now()}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getGameData]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Navigate back to wizard
  const navigateBack = useCallback(() => {
    stopGame();
    setLocation('/game-wizard');
  }, [stopGame, setLocation]);

  // Handle keyboard input
  useEffect(() => {
    if (!isRunning || !sessionIdRef.current) return;
    
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Send key press to backend
      if (sessionIdRef.current) {
        await gameApi.sendGameInput(sessionIdRef.current, {
          type: 'keydown',
          key: e.key,
          keyCode: e.keyCode
        });
      }
    };
    
    const handleKeyUp = async (e: KeyboardEvent) => {
      // Send key release to backend
      if (sessionIdRef.current) {
        await gameApi.sendGameInput(sessionIdRef.current, {
          type: 'keyup',
          key: e.key,
          keyCode: e.keyCode
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRunning]);

  // Handle mouse input on canvas
  const handleCanvasClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isRunning || !sessionIdRef.current || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale coordinates to game resolution
    const scaleX = 800 / rect.width;
    const scaleY = 600 / rect.height;
    
    await gameApi.sendGameInput(sessionIdRef.current, {
      type: 'click',
      x: Math.floor(x * scaleX),
      y: Math.floor(y * scaleY)
    });
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGame();
    };
  }, []);

  // Initialize canvas with placeholder
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && !isRunning && !isLoading) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Press "Start your engines!" to play', canvas.width / 2, canvas.height / 2);
      }
    }
  }, [isRunning, isLoading]);

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-0 z-50' : 'relative'}`}>
      <div className="flex flex-col h-full">
        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Button
              onClick={navigateBack}
              variant="outline"
              size="sm"
              data-testid="button-back-to-wizard"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Wizard
            </Button>
            
            <Button
              onClick={isRunning ? stopGame : runGame}
              disabled={isLoading}
              variant={isRunning ? 'destructive' : 'default'}
              size="sm"
              data-testid="button-run-game"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start your engines!
                </>
              )}
            </Button>
            
            <Button
              onClick={resetGame}
              disabled={isLoading || !isRunning}
              variant="outline"
              size="sm"
              data-testid="button-reset"
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
              data-testid="button-export"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            
            <Button
              onClick={toggleFullscreen}
              variant="outline"
              size="sm"
              data-testid="button-fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </Button>
            
            {onClose && (
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                data-testid="button-close"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Game Canvas */}
        <div className="flex-1 flex items-center justify-center bg-black p-4">
          {isLoading ? (
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg mb-2">{loadingMessage || 'Loading game...'}</p>
              <p className="text-sm text-gray-400">Please wait while we prepare your game</p>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center max-w-md">
              <p className="font-bold mb-2">Error</p>
              <p className="text-sm mb-4">{error}</p>
              <Button
                onClick={() => setError(null)}
                variant="outline"
                size="sm"
                className="text-white border-white hover:bg-white/10"
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <canvas
              id="pygame-canvas"
              ref={canvasRef}
              width={800}
              height={600}
              className="border border-gray-700 max-w-full h-auto cursor-pointer"
              style={{ imageRendering: 'pixelated' }}
              onClick={handleCanvasClick}
              data-testid="canvas-game"
            />
          )}
        </div>
        
        {/* Status */}
        {previewMode && previewMode !== 'full' && (
          <div className="p-2 bg-gray-100 dark:bg-gray-900 text-center text-sm">
            Preview Mode: {previewMode}
          </div>
        )}
      </div>
    </Card>
  );
}