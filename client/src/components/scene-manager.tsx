import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, MoreVertical, Eye, EyeOff, Copy, Trash2,
  Settings, Image, Music, Film, Layout, Map
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Scene, SceneTransition, GameConfig } from '@shared/schema';

interface SceneManagerProps {
  gameConfig: GameConfig;
  currentScene: string;
  onSceneChange: (sceneId: string) => void;
  onConfigChange: (config: GameConfig) => void;
  className?: string;
}

const sceneTemplates = [
  { id: 'blank', name: 'Blank Scene', icon: Layout, description: 'Start with an empty scene' },
  { id: 'platformer', name: 'Platformer Level', icon: Map, description: 'Platform game level template' },
  { id: 'rpg', name: 'RPG Map', icon: Map, description: 'Top-down RPG map template' },
  { id: 'menu', name: 'Menu Screen', icon: Layout, description: 'Game menu template' },
];

export default function SceneManager({
  gameConfig,
  currentScene,
  onSceneChange,
  onConfigChange,
  className
}: SceneManagerProps) {
  const [showNewSceneDialog, setShowNewSceneDialog] = useState(false);
  const [showSceneSettings, setShowSceneSettings] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  const handleCreateScene = useCallback(() => {
    if (!newSceneName.trim()) return;

    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      name: newSceneName,
      entities: [],
      backgroundColor: '#1a1a2e',
      width: 800,
      height: 600,
      gridSize: 20,
      isMainScene: gameConfig.scenes.length === 0,
      transition: { type: 'fade', duration: 500 }
    };

    // Apply template
    if (selectedTemplate === 'platformer') {
      newScene.backgroundColor = '#87CEEB';
      newScene.entities = [
        {
          id: 'ground-1',
          type: 'platform',
          name: 'Ground',
          position: { x: 0, y: 550 },
          size: { width: 800, height: 50 },
          properties: { solid: true, color: '#654321' },
          layer: 0
        }
      ];
    } else if (selectedTemplate === 'rpg') {
      newScene.backgroundColor = '#228B22';
      newScene.gridSize = 32;
    } else if (selectedTemplate === 'menu') {
      newScene.backgroundColor = '#2c3e50';
      newScene.entities = [
        {
          id: 'title-1',
          type: 'decoration',
          name: 'Game Title',
          position: { x: 400, y: 100 },
          size: { width: 300, height: 60 },
          properties: { text: 'My Awesome Game', fontSize: 48 },
          layer: 1
        }
      ];
    }

    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: [...gameConfig.scenes, newScene]
    };

    onConfigChange(updatedConfig);
    onSceneChange(newScene.id);
    setShowNewSceneDialog(false);
    setNewSceneName('');
    setSelectedTemplate('blank');
  }, [gameConfig, newSceneName, selectedTemplate, onConfigChange, onSceneChange]);

  const handleDuplicateScene = useCallback((scene: Scene) => {
    const duplicatedScene: Scene = {
      ...scene,
      id: `scene-${Date.now()}`,
      name: `${scene.name} (Copy)`,
      isMainScene: false,
      entities: scene.entities.map(entity => ({
        ...entity,
        id: `${entity.id}-copy-${Date.now()}`
      }))
    };

    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: [...gameConfig.scenes, duplicatedScene]
    };

    onConfigChange(updatedConfig);
    onSceneChange(duplicatedScene.id);
  }, [gameConfig, onConfigChange, onSceneChange]);

  const handleDeleteScene = useCallback((sceneId: string) => {
    if (gameConfig.scenes.length <= 1) return;

    const sceneIndex = gameConfig.scenes.findIndex(s => s.id === sceneId);
    const updatedScenes = gameConfig.scenes.filter(s => s.id !== sceneId);
    
    // If deleting main scene, make the first remaining scene the main one
    if (gameConfig.scenes[sceneIndex].isMainScene && updatedScenes.length > 0) {
      updatedScenes[0].isMainScene = true;
    }

    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: updatedScenes
    };

    onConfigChange(updatedConfig);
    
    // Switch to another scene if current was deleted
    if (currentScene === sceneId && updatedScenes.length > 0) {
      onSceneChange(updatedScenes[0].id);
    }
  }, [gameConfig, currentScene, onConfigChange, onSceneChange]);

  const handleUpdateScene = useCallback(() => {
    if (!editingScene) return;

    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: gameConfig.scenes.map(s => 
        s.id === editingScene.id ? editingScene : s
      )
    };

    onConfigChange(updatedConfig);
    setShowSceneSettings(false);
    setEditingScene(null);
  }, [gameConfig, editingScene, onConfigChange]);

  const handleSetMainScene = useCallback((sceneId: string) => {
    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: gameConfig.scenes.map(s => ({
        ...s,
        isMainScene: s.id === sceneId
      }))
    };

    onConfigChange(updatedConfig);
  }, [gameConfig, onConfigChange]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Scenes</CardTitle>
          <Button
            size="sm"
            onClick={() => setShowNewSceneDialog(true)}
            data-testid="button-add-scene"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-2">
          {gameConfig.scenes.map((scene) => (
            <Card
              key={scene.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                currentScene === scene.id && "ring-2 ring-primary"
              )}
              onClick={() => onSceneChange(scene.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="p-1.5 rounded bg-muted">
                      <Map className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{scene.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {scene.entities.length} objects • {scene.width}×{scene.height}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {scene.isMainScene && (
                      <Badge variant="secondary" className="text-xs">
                        Main
                      </Badge>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setEditingScene(scene);
                          setShowSceneSettings(true);
                        }}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        {!scene.isMainScene && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleSetMainScene(scene.id);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Set as Main
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateScene(scene);
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScene(scene.id);
                          }}
                          disabled={gameConfig.scenes.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </ScrollArea>

      {/* New Scene Dialog */}
      <Dialog open={showNewSceneDialog} onOpenChange={setShowNewSceneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Scene</DialogTitle>
            <DialogDescription>
              Choose a template and name for your new scene
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="scene-name">Scene Name</Label>
              <Input
                id="scene-name"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                placeholder="Enter scene name..."
                data-testid="input-new-scene-name"
              />
            </div>

            <div>
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {sceneTemplates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all",
                        selectedTemplate === template.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSceneDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateScene}
              disabled={!newSceneName.trim()}
              data-testid="button-create-scene"
            >
              Create Scene
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scene Settings Dialog */}
      <Dialog open={showSceneSettings} onOpenChange={setShowSceneSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Scene Settings</DialogTitle>
            <DialogDescription>
              Configure properties for {editingScene?.name}
            </DialogDescription>
          </DialogHeader>

          {editingScene && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scene-width">Width</Label>
                  <Input
                    id="scene-width"
                    type="number"
                    value={editingScene.width}
                    onChange={(e) => setEditingScene({
                      ...editingScene,
                      width: parseInt(e.target.value) || 800
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="scene-height">Height</Label>
                  <Input
                    id="scene-height"
                    type="number"
                    value={editingScene.height}
                    onChange={(e) => setEditingScene({
                      ...editingScene,
                      height: parseInt(e.target.value) || 600
                    })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="scene-bg">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="scene-bg"
                    type="color"
                    value={editingScene.backgroundColor || '#1a1a2e'}
                    onChange={(e) => setEditingScene({
                      ...editingScene,
                      backgroundColor: e.target.value
                    })}
                    className="w-20"
                  />
                  <Input
                    value={editingScene.backgroundColor || '#1a1a2e'}
                    onChange={(e) => setEditingScene({
                      ...editingScene,
                      backgroundColor: e.target.value
                    })}
                    placeholder="#1a1a2e"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="scene-transition">Scene Transition</Label>
                <Select
                  value={editingScene.transition?.type || 'none'}
                  onValueChange={(value) => setEditingScene({
                    ...editingScene,
                    transition: { 
                      type: value as SceneTransition['type'],
                      duration: 500 
                    }
                  })}
                >
                  <SelectTrigger id="scene-transition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="fade">Fade</SelectItem>
                    <SelectItem value="slide">Slide</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                    <SelectItem value="pixelate">Pixelate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="grid-size">Grid Size</Label>
                <Input
                  id="grid-size"
                  type="number"
                  value={editingScene.gridSize || 20}
                  onChange={(e) => setEditingScene({
                    ...editingScene,
                    gridSize: parseInt(e.target.value) || 20
                  })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSceneSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateScene}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}