import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Server, Settings, Play, Pause, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import PygameRunner from './pygame-runner';
import WebGameRunner from './web-game-runner';
import GameFormatSelector, { type GameFormat } from './game-format-selector';

interface UnifiedGameRunnerProps {
  selectedComponents?: Record<string, string>;
  selectedAssets?: any[];
  previewMode?: string;
  className?: string;
  onError?: (error: string) => void;
  onClose?: () => void;
  gameProject?: any;
  showFormatSelector?: boolean;
  defaultFormat?: GameFormat;
}

interface AssetProcessingStatus {
  total: number;
  processed: number;
  current?: string;
  errors: string[];
}

export default function UnifiedGameRunner({
  selectedComponents = {},
  selectedAssets = [],
  previewMode = 'full',
  className = '',
  onError,
  onClose,
  gameProject,
  showFormatSelector = true,
  defaultFormat = 'web'
}: UnifiedGameRunnerProps) {
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState<GameFormat>(defaultFormat);
  const [assetProcessing, setAssetProcessing] = useState<AssetProcessingStatus | null>(null);
  const [activeTab, setActiveTab] = useState<string>('play');

  // Process and validate assets for web compilation
  const processAssetsForWeb = useCallback(async (assets: any[]): Promise<any[]> => {
    if (!assets || assets.length === 0) {
      return [];
    }

    setAssetProcessing({
      total: assets.length,
      processed: 0,
      current: '',
      errors: []
    });

    const processedAssets: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      
      setAssetProcessing(prev => prev ? {
        ...prev,
        processed: i,
        current: asset.name || `Asset ${i + 1}`
      } : null);

      try {
        // Process different asset types
        let processedAsset = { ...asset };

        switch (asset.type) {
          case 'image':
          case 'sprite':
            processedAsset = await processImageAsset(asset);
            break;
          case 'sound':
          case 'audio':
            processedAsset = await processSoundAsset(asset);
            break;
          case 'font':
            processedAsset = await processFontAsset(asset);
            break;
          default:
            // Keep as-is for unknown types
            console.warn(`Unknown asset type: ${asset.type}`);
        }

        processedAssets.push(processedAsset);
      } catch (error) {
        const errorMsg = `Failed to process asset ${asset.name}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    setAssetProcessing(prev => prev ? {
      ...prev,
      processed: assets.length,
      current: 'Complete',
      errors
    } : null);

    // Show completion notification
    if (errors.length > 0) {
      toast({
        title: "Asset Processing Complete",
        description: `Processed ${processedAssets.length}/${assets.length} assets. ${errors.length} errors.`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Assets Ready",
        description: `Successfully processed ${processedAssets.length} assets for web compilation.`,
      });
    }

    // Clear processing state after a delay
    setTimeout(() => setAssetProcessing(null), 3000);

    return processedAssets;
  }, [toast]);

  // Process image assets for web compatibility
  const processImageAsset = useCallback(async (asset: any): Promise<any> => {
    // Ensure image is in web-compatible format
    const supportedFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const format = asset.path?.split('.').pop()?.toLowerCase();
    
    if (!format || !supportedFormats.includes(format)) {
      throw new Error(`Unsupported image format: ${format}`);
    }

    // Validate image size for web games
    if (asset.dataUrl) {
      const img = new Image();
      img.src = asset.dataUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Warn about large images
      if (img.width > 2048 || img.height > 2048) {
        console.warn(`Large image detected: ${asset.name} (${img.width}x${img.height}). Consider resizing for better web performance.`);
      }
    }

    return {
      ...asset,
      webCompatible: true,
      originalFormat: format,
      processedAt: Date.now()
    };
  }, []);

  // Process sound assets for web compatibility
  const processSoundAsset = useCallback(async (asset: any): Promise<any> => {
    // Ensure audio is in web-compatible format
    const supportedFormats = ['mp3', 'wav', 'ogg', 'webm'];
    const format = asset.path?.split('.').pop()?.toLowerCase();
    
    if (!format || !supportedFormats.includes(format)) {
      throw new Error(`Unsupported audio format: ${format}`);
    }

    return {
      ...asset,
      webCompatible: true,
      originalFormat: format,
      processedAt: Date.now()
    };
  }, []);

  // Process font assets for web compatibility
  const processFontAsset = useCallback(async (asset: any): Promise<any> => {
    // Ensure font is in web-compatible format
    const supportedFormats = ['ttf', 'otf', 'woff', 'woff2'];
    const format = asset.path?.split('.').pop()?.toLowerCase();
    
    if (!format || !supportedFormats.includes(format)) {
      throw new Error(`Unsupported font format: ${format}`);
    }

    return {
      ...asset,
      webCompatible: true,
      originalFormat: format,
      processedAt: Date.now()
    };
  }, []);

  // Handle format change
  const handleFormatChange = useCallback((format: GameFormat) => {
    setSelectedFormat(format);
    
    toast({
      title: "Format Changed",
      description: `Switched to ${format === 'web' ? 'Web/Browser' : 'Server'} execution mode.`,
    });
  }, [toast]);

  // Handle game run with asset processing
  const handleRunGame = useCallback(async () => {
    if (selectedFormat === 'web' && selectedAssets.length > 0) {
      try {
        const processedAssets = await processAssetsForWeb(selectedAssets);
        // Assets are now processed and ready for web compilation
        console.log('Assets processed for web compilation:', processedAssets);
      } catch (error) {
        console.error('Asset processing failed:', error);
        if (onError) {
          onError(`Asset processing failed: ${error}`);
        }
        return;
      }
    }
    
    // The actual game running will be handled by the specific runner component
  }, [selectedFormat, selectedAssets, processAssetsForWeb, onError]);

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Format Selector */}
      {showFormatSelector && (
        <GameFormatSelector
          selectedFormat={selectedFormat}
          onFormatChange={handleFormatChange}
          onRunGame={handleRunGame}
          disabled={!!assetProcessing}
          data-testid="format-selector"
        />
      )}

      {/* Asset Processing Status */}
      {assetProcessing && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900">Processing Assets for Web</h4>
                <p className="text-sm text-blue-700">
                  {assetProcessing.processed}/{assetProcessing.total} - {assetProcessing.current}
                </p>
                {assetProcessing.errors.length > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {assetProcessing.errors.length} errors occurred
                  </p>
                )}
              </div>
              <Badge variant="outline">
                {Math.round((assetProcessing.processed / assetProcessing.total) * 100)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game Runner Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="play" className="flex items-center space-x-2">
            <Play className="h-4 w-4" />
            <span>Play Game</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="play" className="mt-4">
          {/* Render appropriate runner based on selected format */}
          {selectedFormat === 'web' ? (
            <WebGameRunner
              selectedComponents={selectedComponents}
              selectedAssets={selectedAssets}
              previewMode={previewMode}
              onError={onError}
              onClose={onClose}
              gameProject={gameProject}
              data-testid="web-game-runner"
            />
          ) : (
            <PygameRunner
              selectedComponents={selectedComponents}
              selectedAssets={selectedAssets}
              previewMode={previewMode}
              onError={onError}
              onClose={onClose}
              gameProject={gameProject}
              data-testid="pygame-runner"
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Game Runner Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Execution Format</h4>
                  <Badge variant={selectedFormat === 'web' ? 'default' : 'secondary'}>
                    {selectedFormat === 'web' ? (
                      <><Globe className="h-3 w-3 mr-1" /> Web/Browser</>
                    ) : (
                      <><Server className="h-3 w-3 mr-1" /> Server</>
                    )}
                  </Badge>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Assets</h4>
                  <p className="text-sm text-gray-600">
                    {selectedAssets.length} asset(s) loaded
                  </p>
                </div>
              </div>

              {/* Asset Details */}
              {selectedAssets.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Asset Details</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedAssets.map((asset, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{asset.name || `Asset ${index + 1}`}</span>
                        <Badge variant="outline" className="text-xs">
                          {asset.type || 'unknown'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Format-specific Settings */}
              {selectedFormat === 'web' && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Web Format Settings</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Assets will be processed for web compatibility</li>
                    <li>• Large images may be optimized automatically</li>
                    <li>• Compilation may take 30-60 seconds</li>
                    <li>• Generated games work offline after compilation</li>
                  </ul>
                </div>
              )}
              
              {selectedFormat === 'server' && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Server Format Settings</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Games start immediately</li>
                    <li>• Full pygame compatibility</li>
                    <li>• Session limited to 5 minutes</li>
                    <li>• Requires internet connection</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}