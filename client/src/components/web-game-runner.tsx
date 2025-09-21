import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RefreshCw, Globe, Server, X, ArrowLeft, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { compilePythonGame } from '@/lib/pygame-game-compiler';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WebGameRunnerProps {
  selectedComponents?: Record<string, string>;
  selectedAssets?: any[];
  previewMode?: string;
  className?: string;
  onError?: (error: string) => void;
  onClose?: () => void;
  gameProject?: any;
}

type ExecutionMode = 'server' | 'web';
type CompilationStatus = 'idle' | 'compiling' | 'completed' | 'failed';

interface CompilationStatusData {
  status: 'starting' | 'compiling' | 'completed' | 'failed';
  result?: {
    success: boolean;
    error?: string;
    web_url?: string;
    output_path?: string;
  };
  start_time?: number;
  end_time?: number;
}

export default function WebGameRunner({
  selectedComponents = {},
  selectedAssets = [],
  previewMode = 'full',
  className = '',
  onError,
  onClose,
  gameProject
}: WebGameRunnerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('web');
  const [compilationStatus, setCompilationStatus] = useState<CompilationStatus>('idle');
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [compilationId, setCompilationId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Get game data similar to pygame-runner
  const getGameData = useCallback(() => {
    if (gameProject) {
      return {
        components: gameProject.components || selectedComponents,
        assets: gameProject.assets || selectedAssets,
        gameType: gameProject.gameType || 'platformer'
      };
    }
    
    const savedProject = localStorage.getItem('currentGameProject');
    if (savedProject) {
      const parsed = JSON.parse(savedProject);
      return {
        components: parsed.components || selectedComponents,
        assets: parsed.assets || selectedAssets,
        gameType: parsed.gameType || 'platformer'
      };
    }
    
    return {
      components: selectedComponents,
      assets: selectedAssets,
      gameType: 'platformer'
    };
  }, [gameProject, selectedComponents, selectedAssets]);

  // Compile game to WebAssembly
  const compileWebGame = useCallback(async () => {
    setError(null);
    setCompilationStatus('compiling');
    setProgress(10);
    
    try {
      const gameData = getGameData();
      const pythonCode = compilePythonGame(gameData.components, gameData.assets);
      
      setProgress(30);
      
      // Send compilation request to backend
      const response = await fetch('/api/compile-web-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('gameToken') || 'anonymous'}`
        },
        body: JSON.stringify({
          code: pythonCode,
          game_id: `game_${Date.now()}`,
          assets: gameData.assets
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Compilation failed');
      }

      if (result.success && result.compilation_id) {
        setCompilationId(result.compilation_id);
        setProgress(50);
        
        // Start polling for compilation status
        startStatusPolling(result.compilation_id);
        
        toast({
          title: "Compilation Started",
          description: "Your game is being compiled to WebAssembly...",
        });
      } else {
        throw new Error('Failed to start compilation');
      }
      
    } catch (err) {
      console.error('Web game compilation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setCompilationStatus('failed');
      setProgress(0);
      
      toast({
        title: "Compilation Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [getGameData, onError, toast]);

  // Poll compilation status
  const startStatusPolling = useCallback((compId: string) => {
    if (isPolling) return;
    
    setIsPolling(true);
    
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/compilation-status/${compId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('gameToken') || 'anonymous'}`
          }
        });

        const result = await response.json();
        
        if (result.success && result.status) {
          const statusData: CompilationStatusData = result.status;
          
          switch (statusData.status) {
            case 'compiling':
              setProgress(Math.min(progress + 10, 80));
              // Continue polling
              setTimeout(pollStatus, 2000);
              break;
              
            case 'completed':
              setProgress(100);
              setCompilationStatus('completed');
              setIsPolling(false);
              
              if (statusData.result?.success && statusData.result.web_url) {
                setGameUrl(statusData.result.web_url);
                toast({
                  title: "Compilation Complete!",
                  description: "Your web game is ready to play.",
                });
              } else {
                throw new Error(statusData.result?.error || 'Compilation completed but no game URL provided');
              }
              break;
              
            case 'failed':
              setCompilationStatus('failed');
              setIsPolling(false);
              setProgress(0);
              throw new Error(statusData.result?.error || 'Compilation failed');
              
            default:
              // Continue polling for other statuses
              setTimeout(pollStatus, 2000);
          }
        } else {
          throw new Error('Failed to get compilation status');
        }
        
      } catch (err) {
        console.error('Status polling error:', err);
        setIsPolling(false);
        setCompilationStatus('failed');
        setProgress(0);
        const errorMessage = err instanceof Error ? err.message : 'Status check failed';
        setError(errorMessage);
        
        toast({
          title: "Compilation Failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
    };

    // Start polling
    setTimeout(pollStatus, 1000);
  }, [isPolling, progress, toast]);

  // Run the game (either web or server mode)
  const runGame = useCallback(() => {
    if (executionMode === 'web') {
      compileWebGame();
    } else {
      // Fall back to server-side execution (existing functionality)
      // This would integrate with the existing pygame-runner logic
      toast({
        title: "Server Mode",
        description: "Server-side execution coming soon!",
      });
    }
  }, [executionMode, compileWebGame, toast]);

  // Reset game state
  const resetGame = useCallback(() => {
    setCompilationStatus('idle');
    setGameUrl(null);
    setCompilationId(null);
    setProgress(0);
    setError(null);
    setIsPolling(false);
    
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
  }, []);

  // Open game in new tab
  const openInNewTab = useCallback(() => {
    if (gameUrl) {
      window.open(gameUrl, '_blank');
    }
  }, [gameUrl]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    // Game loaded successfully
    console.log('Web game loaded in iframe');
  }, []);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    setError('Failed to load web game');
    toast({
      title: "Load Error",
      description: "Failed to load the web game. Please try again.",
      variant: "destructive"
    });
  }, [toast]);

  return (
    <Card className={cn("w-full max-w-4xl mx-auto", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold">
          Game Runner
        </CardTitle>
        
        <div className="flex items-center space-x-4">
          {/* Execution Mode Switch */}
          <div className="flex items-center space-x-2">
            <Label htmlFor="execution-mode" className="text-sm font-medium">
              Mode:
            </Label>
            <div className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <Switch
                id="execution-mode"
                checked={executionMode === 'web'}
                onCheckedChange={(checked) => setExecutionMode(checked ? 'web' : 'server')}
                data-testid="switch-execution-mode"
              />
              <Globe className="h-4 w-4" />
            </div>
            <Badge variant={executionMode === 'web' ? 'default' : 'secondary'}>
              {executionMode === 'web' ? 'Web' : 'Server'}
            </Badge>
          </div>

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              onClick={runGame}
              disabled={compilationStatus === 'compiling' || isPolling}
              data-testid="button-run-game"
            >
              {compilationStatus === 'compiling' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Compiling...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Game
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={resetGame}
              disabled={compilationStatus === 'compiling' || isPolling}
              data-testid="button-reset-game"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>

            {gameUrl && (
              <Button
                variant="outline"
                onClick={openInNewTab}
                data-testid="button-open-new-tab"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="outline" data-testid="status-badge">
              {compilationStatus === 'idle' && 'Ready'}
              {compilationStatus === 'compiling' && 'Compiling'}
              {compilationStatus === 'completed' && 'Ready to Play'}
              {compilationStatus === 'failed' && 'Failed'}
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        {(compilationStatus === 'compiling' || isPolling) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Compiling to WebAssembly...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" data-testid="progress-compilation" />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start space-x-2">
                <X className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Error</h4>
                  <p className="text-sm text-red-600 mt-1" data-testid="text-error">
                    {error}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game Display */}
        <div className="relative">
          {gameUrl && compilationStatus === 'completed' ? (
            <div className="relative border rounded-lg overflow-hidden bg-black" style={{ height: '600px' }}>
              <iframe
                ref={iframeRef}
                src={gameUrl}
                className="w-full h-full"
                title="Web Game"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                data-testid="iframe-web-game"
                allow="cross-origin-isolated"
                sandbox="allow-scripts allow-same-origin allow-downloads"
              />
            </div>
          ) : (
            <div 
              className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center"
              style={{ height: '600px' }}
              data-testid="placeholder-game-area"
            >
              <div className="text-center">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {executionMode === 'web' ? 'Web Game Runner' : 'Server Game Runner'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {compilationStatus === 'idle' && 'Click "Run Game" to start'}
                  {compilationStatus === 'compiling' && 'Compiling your game...'}
                  {compilationStatus === 'failed' && 'Compilation failed. Check the error above.'}
                </p>
                {executionMode === 'web' && (
                  <Badge variant="outline">
                    Powered by pygbag + WebAssembly
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        {executionMode === 'web' && (
          <div className="text-xs text-gray-500 text-center">
            Web mode compiles your pygame code to WebAssembly for browser execution.
            This may take a few moments for the first compilation.
          </div>
        )}
      </CardContent>
    </Card>
  );
}