import { useState, useEffect, useCallback } from "react";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Save, FolderPlus, Plus, ArrowLeft, Download, Share,
  Gamepad2, Settings, FileCode, FolderOpen
} from "lucide-react";
import InteractiveGameCanvas from "@/components/interactive-game-canvas";
import ComponentSwitcher from "@/components/component-switcher";
import DraggableAssetLibrary from "@/components/draggable-asset-library";
import ExportDialog from "@/components/export-dialog";
import PublishDialog from "@/components/publish-dialog";
import { usePyodide } from "@/hooks/use-pyodide";
import { gameTemplates } from "@/lib/game-templates";
import { generateGameTemplate, gameComponents } from "@/lib/game-building-blocks";
import type { 
  Project, ProjectAsset, ProjectFile, 
  GameConfig, Scene, ComponentChoice 
} from "@shared/schema";
import { motion } from "framer-motion";

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

  // Generate entity placement code
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

export default function ProjectBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { pyodide, isLoading: pyodideLoading } = usePyodide();

  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [gameConfig, setGameConfig] = useState<GameConfig>(createDefaultGameConfig('New Game'));
  
  // UI state
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showOpenProjectDialog, setShowOpenProjectDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("visual");

  // Load user projects
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Load game config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('visual-game-config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setGameConfig(config);
      } catch (e) {
        console.error('Failed to load saved config:', e);
      }
    }
  }, []);

  // Save game config to localStorage
  useEffect(() => {
    if (gameConfig) {
      localStorage.setItem('visual-game-config', JSON.stringify(gameConfig));
      setUnsavedChanges(true);
    }
  }, [gameConfig]);

  // Handle component choice changes
  const handleComponentChoiceChange = (componentId: string, choice: 'A' | 'B') => {
    const newChoices = [...gameConfig.componentChoices];
    const existingIndex = newChoices.findIndex(c => c.component === componentId);
    
    if (existingIndex >= 0) {
      newChoices[existingIndex] = { component: componentId, choice };
    } else {
      newChoices.push({ component: componentId, choice });
    }
    
    setGameConfig({
      ...gameConfig,
      componentChoices: newChoices
    });
  };

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; template: string }) => {
      const pythonCode = generatePythonFromConfig(gameConfig);
      
      const response = await apiRequest("POST", "/api/projects", {
        name: data.name,
        template: 'visual',
        files: [{ path: 'main.py', content: pythonCode }],
        assets: []
      });
      return await response.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setCurrentProject(project);
      setGameConfig({ ...gameConfig, name: project.name });
      setUnsavedChanges(false);
      setShowNewProjectDialog(false);
      toast({
        title: "Project Created",
        description: `Successfully created ${project.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error Creating Project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Save project mutation  
  const saveProjectMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject) throw new Error("No project to save");
      
      const pythonCode = generatePythonFromConfig(gameConfig);
      
      const response = await apiRequest("PUT", `/api/projects/${currentProject.id}`, {
        files: [{ path: 'main.py', content: pythonCode }],
        assets: []
      });
      return await response.json();
    },
    onSuccess: () => {
      setUnsavedChanges(false);
      toast({
        title: "Project Saved",
        description: "Your visual game configuration has been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Error Saving Project",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Export project as Python file
  const handleExport = () => {
    const pythonCode = generatePythonFromConfig(gameConfig);
    const blob = new Blob([pythonCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameConfig.name.replace(/\s+/g, '_')}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open existing project
  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    // Try to load visual config from project metadata or create new
    const configFromProject = project.files.find(f => f.path === '.gameconfig.json');
    if (configFromProject) {
      try {
        const config = JSON.parse(configFromProject.content);
        setGameConfig(config);
      } catch (e) {
        console.error('Failed to load project config:', e);
        setGameConfig(createDefaultGameConfig(project.name));
      }
    } else {
      setGameConfig(createDefaultGameConfig(project.name));
    }
    setShowOpenProjectDialog(false);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Visual Game Builder</span>
              {currentProject && (
                <>
                  <Separator orientation="vertical" className="h-6 mx-2" />
                  <Badge variant="outline">{currentProject.name}</Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unsavedChanges && (
              <Badge variant="secondary">Unsaved Changes</Badge>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowNewProjectDialog(true)}
              data-testid="button-new-project"
            >
              <FolderPlus className="h-4 w-4 mr-1" />
              New
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowOpenProjectDialog(true)}
              disabled={projectsLoading}
              data-testid="button-open-project"
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Open
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => currentProject ? saveProjectMutation.mutate() : setShowNewProjectDialog(true)}
              disabled={saveProjectMutation.isPending}
              data-testid="button-save"
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              data-testid="button-export"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowPublishDialog(true)}
              disabled={!currentProject}
              data-testid="button-publish"
            >
              <Share className="h-4 w-4 mr-1" />
              Publish
            </Button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center: Interactive Game Canvas */}
          <div className="flex-1 flex flex-col">
            <InteractiveGameCanvas
              gameConfig={gameConfig}
              onConfigChange={setGameConfig}
              className="flex-1"
              currentScene="main"
            />
          </div>

          {/* Right Side: Component Switcher */}
          <div className="w-80 border-l">
            <ComponentSwitcher
              selectedChoices={gameConfig.componentChoices}
              onChoiceChange={handleComponentChoiceChange}
              gameType={selectedTemplate}
            />
          </div>
        </div>

        {/* Bottom: Asset Library */}
        <div className="h-64 border-t">
          <DraggableAssetLibrary
            onAssetSelect={(asset) => {
              console.log('Asset selected:', asset);
            }}
            className="h-full"
          />
        </div>

        {/* New Project Dialog */}
        <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Visual Game</DialogTitle>
              <DialogDescription>
                Start building your game visually by dragging and dropping components
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="project-name" className="text-sm font-medium">
                  Project Name
                </label>
                <Input
                  id="project-name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Awesome Game"
                  data-testid="input-project-name"
                />
              </div>
              
              <div>
                <label htmlFor="game-type" className="text-sm font-medium">
                  Game Type
                </label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger id="game-type" data-testid="select-game-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visual">Visual Builder</SelectItem>
                    <SelectItem value="platformer">Platformer</SelectItem>
                    <SelectItem value="shooter">Shooter</SelectItem>
                    <SelectItem value="puzzle">Puzzle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setGameConfig(createDefaultGameConfig(newProjectName));
                  createProjectMutation.mutate({
                    name: newProjectName,
                    template: selectedTemplate
                  });
                }}
                disabled={!newProjectName || createProjectMutation.isPending}
                data-testid="button-create-project"
              >
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Open Project Dialog */}
        <Dialog open={showOpenProjectDialog} onOpenChange={setShowOpenProjectDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Open Project</DialogTitle>
              <DialogDescription>
                Select a project to open in the visual builder
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4 py-4">
              {projects?.map(project => (
                <Card 
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => handleOpenProject(project)}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Created: {new Date(project.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
              
              {(!projects || projects.length === 0) && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  No projects found
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        {showExportDialog && currentProject && (
          <ExportDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            projectName={currentProject.name}
            files={[{ 
              path: 'main.py', 
              content: generatePythonFromConfig(gameConfig) 
            }]}
            assets={currentProject.assets}
            template={currentProject.template}
          />
        )}

        {/* Publish Dialog */}
        {showPublishDialog && currentProject && (
          <PublishDialog
            isOpen={showPublishDialog}
            onClose={() => setShowPublishDialog(false)}
            project={currentProject}
          />
        )}
      </div>
    </DndProvider>
  );
}