import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MousePointer, Move, RotateCw, Maximize2, Copy, Trash2,
  Undo, Redo, Grid3x3, Ruler, Eye, Layers, Play, Pause,
  Save, Download, Upload, Settings, Hand, ZoomIn, ZoomOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorTool, EditorState } from '@shared/schema';

interface EditorToolbarProps {
  selectedTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onSettings?: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  className?: string;
}

const tools: Array<{ id: EditorTool; icon: any; label: string; shortcut?: string }> = [
  { id: 'select', icon: MousePointer, label: 'Select', shortcut: 'V' },
  { id: 'move', icon: Move, label: 'Move', shortcut: 'M' },
  { id: 'rotate', icon: RotateCw, label: 'Rotate', shortcut: 'R' },
  { id: 'scale', icon: Maximize2, label: 'Scale', shortcut: 'S' },
  { id: 'duplicate', icon: Copy, label: 'Duplicate', shortcut: 'D' },
  { id: 'delete', icon: Trash2, label: 'Delete', shortcut: 'Del' },
  { id: 'pan', icon: Hand, label: 'Pan', shortcut: 'Space' },
];

export default function EditorToolbar({
  selectedTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showGrid,
  onToggleGrid,
  showRulers,
  onToggleRulers,
  showGuides,
  onToggleGuides,
  isPlaying,
  onPlayPause,
  onSave,
  onExport,
  onImport,
  onSettings,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  className
}: EditorToolbarProps) {
  return (
    <TooltipProvider>
      <div className={cn(
        "flex items-center gap-1 p-2 bg-background border-b",
        className
      )}>
        {/* Tool Selection */}
        <div className="flex items-center gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedTool === tool.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onToolChange(tool.id)}
                    className="h-8 w-8 p-0"
                    data-testid={`tool-${tool.id}`}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tool.label}</p>
                  {tool.shortcut && (
                    <p className="text-xs text-muted-foreground">
                      Shortcut: {tool.shortcut}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Separator orientation="vertical" className="mx-2 h-6" />

        {/* History Controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-8 w-8 p-0"
                data-testid="button-undo"
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo</p>
              <p className="text-xs text-muted-foreground">Ctrl+Z</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-8 w-8 p-0"
                data-testid="button-redo"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Redo</p>
              <p className="text-xs text-muted-foreground">Ctrl+Y</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-2 h-6" />

        {/* View Options */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showGrid}
                onPressedChange={onToggleGrid}
                size="sm"
                className="h-8 w-8 p-0"
                data-testid="toggle-grid"
              >
                <Grid3x3 className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Grid</p>
              <p className="text-xs text-muted-foreground">G</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showRulers}
                onPressedChange={onToggleRulers}
                size="sm"
                className="h-8 w-8 p-0"
                data-testid="toggle-rulers"
              >
                <Ruler className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Rulers</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showGuides}
                onPressedChange={onToggleGuides}
                size="sm"
                className="h-8 w-8 p-0"
                data-testid="toggle-guides"
              >
                <Eye className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Guides</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-2 h-6" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onZoomOut}
                className="h-8 w-8 p-0"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom Out</p>
              <p className="text-xs text-muted-foreground">-</p>
            </TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            onClick={onZoomReset}
            className="h-8 px-2 text-xs"
            data-testid="button-zoom-reset"
          >
            {Math.round(zoom * 100)}%
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onZoomIn}
                className="h-8 w-8 p-0"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom In</p>
              <p className="text-xs text-muted-foreground">+</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        {/* Play/Pause */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isPlaying ? "destructive" : "default"}
              size="sm"
              onClick={onPlayPause}
              className="h-8 px-3"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPlaying ? 'Stop Game' : 'Test Game'}</p>
            <p className="text-xs text-muted-foreground">F5</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-2 h-6" />

        {/* File Operations */}
        <div className="flex items-center gap-1">
          {onSave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSave}
                  className="h-8 w-8 p-0"
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save Project</p>
                <p className="text-xs text-muted-foreground">Ctrl+S</p>
              </TooltipContent>
            </Tooltip>
          )}

          {onExport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExport}
                  className="h-8 w-8 p-0"
                  data-testid="button-export"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export Project</p>
              </TooltipContent>
            </Tooltip>
          )}

          {onImport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onImport}
                  className="h-8 w-8 p-0"
                  data-testid="button-import"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import Project</p>
              </TooltipContent>
            </Tooltip>
          )}

          {onSettings && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSettings}
                  className="h-8 w-8 p-0"
                  data-testid="button-settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Editor Settings</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}