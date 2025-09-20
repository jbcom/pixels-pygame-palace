import { useState, useEffect, useCallback, useMemo } from "react";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Save, FolderPlus, Plus, ArrowLeft, Download, Share,
  Gamepad2, Settings, FileCode, FolderOpen, Layout,
  PanelLeftOpen, PanelRightOpen
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import EnhancedGameCanvas from "@/components/enhanced-game-canvas";
import SceneManager from "@/components/scene-manager";
import EnhancedAssetLibrary from "@/components/enhanced-asset-library";
import PropertiesPanel from "@/components/properties-panel";
import BehaviorEditor from "@/components/behavior-editor";
import LayersPanel from "@/components/layers-panel";
import EditorToolbar from "@/components/editor-toolbar";
import ExportDialog from "@/components/export-dialog";
import PublishDialog from "@/components/publish-dialog";

// Pyodide removed - new pygame component system coming
import { useEditorHistory } from "@/hooks/use-editor-history";
import { gameTemplates } from "@/lib/game-templates";
import { generateGameTemplate, gameComponents } from "@/lib/game-building-blocks";
import type { 
  Project, ProjectAsset, ProjectFile, 
  GameConfig, Scene, ComponentChoice, Entity, EditorTool 
} from "@shared/schema";
import { motion } from "framer-motion";
import { cn } from '@/lib/utils';

// Helper to generate Python code from visual config
function generatePythonFromConfig(gameConfig: GameConfig): string {
  const componentCode = gameConfig.componentChoices
    .map(choice => {
      const component = gameComponents.find(c => c.id === choice.component);
      if (!component) return '';
      const option = choice.choice === 'A' ? component.optionA : component.optionB;
      return option.pythonCode;
    })
    .join('\n\n');

  const mainScene = gameConfig.scenes.find(s => s.isMainScene) || gameConfig.scenes[0];
  const entityCode = mainScene?.entities.map(entity => {
    return `
# Create ${entity.name}
${entity.id} = GameObject(
    x=${entity.position.x}, 
    y=${entity.position.y},
    width=${entity.size?.width || 40},
    height=${entity.size?.height || 40},
    type="${entity.type}",
    properties=${JSON.stringify(entity.properties)}
)
game_objects.append(${entity.id})`;
  }).join('\n') || '';

  return `import pygame
import sys
import json
import random

# Initialize Pygame
pygame.init()

# Game Configuration
SCREEN_WIDTH = ${mainScene?.width || 800}
SCREEN_HEIGHT = ${mainScene?.height || 600}
FPS = ${gameConfig.settings.fps || 60}
BACKGROUND_COLOR = "${mainScene?.backgroundColor || '#000000'}"

screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("${gameConfig.name}")
clock = pygame.time.Clock()

# Game Objects
class GameObject:
    def __init__(self, x, y, width, height, type, properties=None):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.type = type
        self.properties = properties or {}
        self.rect = pygame.Rect(x, y, width, height)
    
    def update(self):
        self.rect.x = self.x
        self.rect.y = self.y
    
    def draw(self, screen):
        color = self.properties.get('color', (255, 255, 255))
        pygame.draw.rect(screen, color, self.rect)

game_objects = []

# Component Systems
${componentCode}

# Entity Placement
${entityCode}

# Main Game Loop
running = True
while running:
    dt = clock.tick(FPS) / 1000.0
    
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
    
    # Update game objects
    for obj in game_objects:
        obj.update()
    
    # Draw everything
    screen.fill(pygame.Color(BACKGROUND_COLOR))
    
    for obj in game_objects:
        obj.draw(screen)
    
    pygame.display.flip()

pygame.quit()
sys.exit()`;
}

// Create default game config
function createDefaultGameConfig(projectName: string): GameConfig {
  return {
    id: `game-${Date.now()}`,
    name: projectName,
    version: 1,
    scenes: [{
      id: 'main',
      name: 'Main Scene',
      entities: [],
      backgroundColor: '#1a1a2e',
      width: 800,
      height: 600,
      gridSize: 20,
      isMainScene: true
    }],
    componentChoices: [],
    assets: [],
    settings: {
      fps: 60,
      showGrid: true,
      gridSnap: true,
      physicsEnabled: false,
      debugMode: false
    }
  };
}

export default function ProjectBuilderEnhanced() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  // Pyodide temporarily disabled
  const pyodide = null;
  const pyodideLoading = false;
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    recordAdd,
    recordDelete,
    recordModify,
    recordBatch
  } = useEditorHistory();

  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [gameConfig, setGameConfig] = useState<GameConfig>(createDefaultGameConfig('New Game'));
  const [currentScene, setCurrentScene] = useState<string>('main');
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<EditorTool>('select');

  // UI state
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showOpenProjectDialog, setShowOpenProjectDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("visual");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [gridSnap, setGridSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [activePanel, setActivePanel] = useState<'scenes' | 'assets' | 'layers'>('assets');
  const [rightPanel, setRightPanel] = useState<'properties' | 'behaviors'>('properties');
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Load user projects
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Get current scene and its entities
  const currentSceneData = useMemo(() => {
    return gameConfig.scenes.find(s => s.id === currentScene) || gameConfig.scenes[0];
  }, [gameConfig, currentScene]);

  const currentEntities = currentSceneData?.entities || [];

  // Entity management
  const handleSelectEntity = useCallback((entityId: string, multiSelect: boolean) => {
    if (!entityId) {
      setSelectedEntities([]);
    } else if (multiSelect) {
      setSelectedEntities(prev => {
        if (prev.includes(entityId)) {
          return prev.filter(id => id !== entityId);
        }
        return [...prev, entityId];
      });
    } else {
      setSelectedEntities([entityId]);
    }
  }, []);

  const handleUpdateEntity = useCallback((entityId: string, updates: Partial<Entity>) => {
    if (!currentSceneData) return;
    
    const entity = currentSceneData.entities.find(e => e.id === entityId);
    if (entity) {
      recordModify([{ ...entity, ...updates }], [entity]);
    }
    
    const updatedScene: Scene = {
      ...currentSceneData,
      entities: currentSceneData.entities.map(e => 
        e.id === entityId ? { ...e, ...updates } : e
      )
    };

    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: gameConfig.scenes.map(s => 
        s.id === currentScene ? updatedScene : s
      )
    };

    setGameConfig(updatedConfig);
    setUnsavedChanges(true);
  }, [currentSceneData, currentScene, gameConfig, recordModify]);

  const handleAddEntity = useCallback((entity: Entity) => {
    if (!currentSceneData) return;
    
    recordAdd([entity]);
    
    const updatedScene: Scene = {
      ...currentSceneData,
      entities: [...currentSceneData.entities, entity]
    };

    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: gameConfig.scenes.map(s => 
        s.id === currentScene ? updatedScene : s
      )
    };

    setGameConfig(updatedConfig);
    setUnsavedChanges(true);
  }, [currentSceneData, currentScene, gameConfig, recordAdd]);

  const handleDeleteEntity = useCallback((entityId: string) => {
    if (!currentSceneData) return;
    
    const entity = currentSceneData.entities.find(e => e.id === entityId);
    if (entity) {
      recordDelete([entity]);
    }
    
    const updatedScene: Scene = {
      ...currentSceneData,
      entities: currentSceneData.entities.filter(e => e.id !== entityId)
    };

    const updatedConfig: GameConfig = {
      ...gameConfig,
      scenes: gameConfig.scenes.map(s => 
        s.id === currentScene ? updatedScene : s
      )
    };

    setGameConfig(updatedConfig);
    setSelectedEntities(prev => prev.filter(id => id !== entityId));
    setUnsavedChanges(true);
  }, [currentSceneData, currentScene, gameConfig, recordDelete]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    const previousState = undo();
    if (previousState && currentSceneData) {
      const updatedScene: Scene = {
        ...currentSceneData,
        entities: previousState
      };

      const updatedConfig: GameConfig = {
        ...gameConfig,
        scenes: gameConfig.scenes.map(s => 
          s.id === currentScene ? updatedScene : s
        )
      };

      setGameConfig(updatedConfig);
      setUnsavedChanges(true);
    }
  }, [undo, currentSceneData, currentScene, gameConfig]);

  const handleRedo = useCallback(() => {
    const nextState = redo();
    if (nextState && currentSceneData) {
      const updatedScene: Scene = {
        ...currentSceneData,
        entities: nextState
      };

      const updatedConfig: GameConfig = {
        ...gameConfig,
        scenes: gameConfig.scenes.map(s => 
          s.id === currentScene ? updatedScene : s
        )
      };

      setGameConfig(updatedConfig);
      setUnsavedChanges(true);
    }
  }, [redo, currentSceneData, currentScene, gameConfig]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Save project
  const handleSaveProject = useCallback(async () => {
    if (!currentProject) {
      setShowNewProjectDialog(true);
      return;
    }

    const pythonCode = generatePythonFromConfig(gameConfig);
    
    try {
      const response = await apiRequest("PUT", `/api/projects/${currentProject.id}`, {
        files: [
          { path: 'main.py', content: pythonCode },
          { path: '.gameconfig.json', content: JSON.stringify(gameConfig) }
        ],
        assets: []
      });
      
      setUnsavedChanges(false);
      toast({
        title: "Project Saved",
        description: "Your game has been saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error Saving Project",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  }, [currentProject, gameConfig, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        switch(e.key.toLowerCase()) {
          case 'v': setSelectedTool('select'); break;
          case 'm': setSelectedTool('move'); break;
          case 'r': setSelectedTool('rotate'); break;
          case 's': setSelectedTool('scale'); break;
          case 'd': setSelectedTool('duplicate'); break;
        }
      }
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      
      // Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveProject();
      }
      
      // Play/Pause
      if (e.key === 'F5') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSaveProject]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen bg-background">
        {/* Main Toolbar */}
        <EditorToolbar
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          showRulers={showRulers}
          onToggleRulers={() => setShowRulers(!showRulers)}
          showGuides={showGuides}
          onToggleGuides={() => setShowGuides(!showGuides)}
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onSave={handleSaveProject}
          onExport={() => setShowExportDialog(true)}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
        />

        {/* Header */}
        <header className="border-b">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/home")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">
                  {currentProject?.name || "Visual Game Builder"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unsavedChanges && (
                <Badge variant="outline" className="text-orange-600">
                  Unsaved Changes
                </Badge>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLeftPanel(!showLeftPanel)}
                data-testid="button-toggle-left-panel"
              >
                <PanelLeftOpen className={cn("h-4 w-4", !showLeftPanel && "rotate-180")} />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRightPanel(!showRightPanel)}
                data-testid="button-toggle-right-panel"
              >
                <PanelRightOpen className={cn("h-4 w-4", !showRightPanel && "rotate-180")} />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content with Resizable Panels */}
        <PanelGroup direction="horizontal" className="flex-1">
          {/* Left Panel */}
          {showLeftPanel && (
            <>
              <Panel defaultSize={20} minSize={15} maxSize={30}>
                <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as any)} className="h-full flex flex-col">
                  <TabsList className="w-full justify-start rounded-none border-b">
                    <TabsTrigger value="scenes">Scenes</TabsTrigger>
                    <TabsTrigger value="assets">Assets</TabsTrigger>
                    <TabsTrigger value="layers">Layers</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="scenes" className="flex-1 m-0">
                    <SceneManager
                      gameConfig={gameConfig}
                      currentScene={currentScene}
                      onSceneChange={setCurrentScene}
                      onConfigChange={setGameConfig}
                    />
                  </TabsContent>
                  
                  <TabsContent value="assets" className="flex-1 m-0">
                    <EnhancedAssetLibrary />
                  </TabsContent>
                  
                  <TabsContent value="layers" className="flex-1 m-0">
                    <LayersPanel
                      entities={currentEntities}
                      selectedEntities={selectedEntities}
                      onSelectEntity={handleSelectEntity}
                      onUpdateEntity={handleUpdateEntity}
                      onDeleteEntity={handleDeleteEntity}
                    />
                  </TabsContent>
                </Tabs>
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
            </>
          )}

          {/* Canvas Area */}
          <Panel defaultSize={showLeftPanel && showRightPanel ? 55 : showLeftPanel || showRightPanel ? 70 : 100}>
            <div className="h-full flex flex-col">
              <EnhancedGameCanvas
                scene={currentSceneData}
                entities={currentEntities}
                selectedEntities={selectedEntities}
                onSelectEntity={handleSelectEntity}
                onUpdateEntity={handleUpdateEntity}
                onAddEntity={handleAddEntity}
                onDeleteEntity={handleDeleteEntity}
                selectedTool={selectedTool}
                showGrid={showGrid}
                showRulers={showRulers}
                showGuides={showGuides}
                gridSnap={gridSnap}
                zoom={zoom}
                panOffset={panOffset}
                isPlaying={isPlaying}
                className="flex-1"
              />
            </div>
          </Panel>

          {/* Right Panel */}
          {showRightPanel && (
            <>
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
              <Panel defaultSize={25} minSize={20} maxSize={35}>
                <Tabs value={rightPanel} onValueChange={(v) => setRightPanel(v as any)} className="h-full flex flex-col">
                  <TabsList className="w-full justify-start rounded-none border-b">
                    <TabsTrigger value="properties">Properties</TabsTrigger>
                    <TabsTrigger value="behaviors">Behaviors</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="properties" className="flex-1 m-0">
                    <PropertiesPanel
                      selectedEntities={currentEntities.filter(e => selectedEntities.includes(e.id))}
                      onUpdateEntity={handleUpdateEntity}
                      onDeleteEntity={handleDeleteEntity}
                    />
                  </TabsContent>
                  
                  <TabsContent value="behaviors" className="flex-1 m-0">
                    <BehaviorEditor
                      entity={selectedEntities.length === 1 ? 
                        currentEntities.find(e => e.id === selectedEntities[0]) || null : 
                        null}
                      onUpdateEntity={handleUpdateEntity}
                    />
                  </TabsContent>
                </Tabs>
              </Panel>
            </>
          )}
        </PanelGroup>

        {/* Export Dialog */}
        {showExportDialog && (
          <ExportDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            project={currentProject}
            pythonCode={generatePythonFromConfig(gameConfig)}
          />
        )}

        {/* Publish Dialog */}
        {showPublishDialog && currentProject && (
          <PublishDialog
            open={showPublishDialog}
            onOpenChange={setShowPublishDialog}
            project={currentProject}
          />
        )}
      </div>
    </DndProvider>
  );
}