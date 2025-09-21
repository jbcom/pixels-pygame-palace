import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Globe, 
  Server, 
  Zap, 
  Clock, 
  Download,
  Play,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type GameFormat = 'server' | 'web';

interface GameFormatSelectorProps {
  selectedFormat: GameFormat;
  onFormatChange: (format: GameFormat) => void;
  onRunGame: () => void;
  className?: string;
  disabled?: boolean;
}

interface FormatOption {
  id: GameFormat;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  pros: string[];
  cons: string[];
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
}

const formatOptions: FormatOption[] = [
  {
    id: 'server',
    title: 'Server Execution',
    description: 'Run your game on our servers and stream the output to your browser',
    icon: Server,
    pros: [
      'Instant execution',
      'Full pygame compatibility',
      'No compilation time',
      'Live streaming'
    ],
    cons: [
      'Requires internet connection',
      'Limited session time',
      'Server resource dependent'
    ],
    badge: 'Classic',
    badgeVariant: 'secondary'
  },
  {
    id: 'web',
    title: 'Web/Browser Execution',
    description: 'Compile your game to WebAssembly and run directly in the browser',
    icon: Globe,
    pros: [
      'Runs offline after compilation',
      'Native browser performance',
      'Shareable web link',
      'Full game interactivity'
    ],
    cons: [
      'Initial compilation time',
      'Some pygame features limited',
      'Larger file size'
    ],
    badge: 'New',
    badgeVariant: 'default'
  }
];

export default function GameFormatSelector({
  selectedFormat,
  onFormatChange,
  onRunGame,
  className,
  disabled = false
}: GameFormatSelectorProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Choose Game Format</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            data-testid="button-toggle-details"
          >
            <Info className="h-4 w-4 mr-2" />
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Toggle */}
        <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-gray-600" />
            <Label htmlFor="format-toggle" className="text-sm font-medium">
              Server
            </Label>
          </div>
          
          <Switch
            id="format-toggle"
            checked={selectedFormat === 'web'}
            onCheckedChange={(checked) => onFormatChange(checked ? 'web' : 'server')}
            disabled={disabled}
            data-testid="switch-game-format"
          />
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="format-toggle" className="text-sm font-medium">
              Web
            </Label>
            <Globe className="h-4 w-4 text-blue-600" />
          </div>
        </div>

        {/* Detailed Options */}
        {showDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formatOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFormat === option.id;
              
              return (
                <Card
                  key={option.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:shadow-md",
                    isSelected 
                      ? "ring-2 ring-blue-500 bg-blue-50" 
                      : "hover:bg-gray-50",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => !disabled && onFormatChange(option.id)}
                  data-testid={`card-format-${option.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className={cn(
                          "h-5 w-5",
                          isSelected ? "text-blue-600" : "text-gray-600"
                        )} />
                        <CardTitle className="text-lg">{option.title}</CardTitle>
                      </div>
                      <Badge variant={option.badgeVariant}>
                        {option.badge}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      {/* Pros */}
                      <div>
                        <h4 className="text-sm font-medium text-green-700 mb-2">Pros:</h4>
                        <ul className="text-xs space-y-1">
                          {option.pros.map((pro, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <div className="w-1 h-1 rounded-full bg-green-500" />
                              <span className="text-green-600">{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Cons */}
                      <div>
                        <h4 className="text-sm font-medium text-amber-700 mb-2">Considerations:</h4>
                        <ul className="text-xs space-y-1">
                          {option.cons.map((con, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <div className="w-1 h-1 rounded-full bg-amber-500" />
                              <span className="text-amber-600">{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Current Selection Summary */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            {selectedFormat === 'web' ? (
              <Globe className="h-5 w-5 text-blue-600" />
            ) : (
              <Server className="h-5 w-5 text-blue-600" />
            )}
            <div>
              <h4 className="font-medium text-blue-900">
                {selectedFormat === 'web' ? 'Web/Browser Execution' : 'Server Execution'}
              </h4>
              <p className="text-sm text-blue-700">
                {selectedFormat === 'web' 
                  ? 'Game will be compiled to WebAssembly'
                  : 'Game will run on server with streaming output'
                }
              </p>
            </div>
          </div>
          
          <Button 
            onClick={onRunGame}
            disabled={disabled}
            data-testid="button-run-selected-format"
          >
            <Play className="h-4 w-4 mr-2" />
            Run Game
          </Button>
        </div>

        {/* Format-specific tips */}
        <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
          {selectedFormat === 'web' ? (
            <div className="space-y-1">
              <p className="font-medium">💡 Web Format Tips:</p>
              <p>• First compilation may take 30-60 seconds</p>
              <p>• Once compiled, your game runs at native browser speed</p>
              <p>• Share the generated link with others to play your game</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">💡 Server Format Tips:</p>
              <p>• Games start immediately with no compilation time</p>
              <p>• Perfect for rapid prototyping and testing</p>
              <p>• Session limited to 5 minutes for resource management</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}