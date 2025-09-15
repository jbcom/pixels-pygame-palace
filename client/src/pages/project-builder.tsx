import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Save, FolderPlus, FileText, Plus, Trash2, ArrowLeft, Settings,
  Gamepad2, Code2, Image, Volume2, Upload, Download, Copy, Palette
} from "lucide-react";
import CodeEditor from "@/components/code-editor";
import GameCanvas from "@/components/game-canvas";
import AssetManager from "@/components/asset-manager";
import ExportDialog from "@/components/export-dialog";
import { usePyodide } from "@/hooks/use-pyodide";
import { gameTemplates, getTemplateOptions } from "@/lib/game-templates";
import type { Project, ProjectAsset, ProjectFile } from "@shared/schema";
import { motion } from "framer-motion";

export default function ProjectBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { pyodide, isLoading: pyodideLoading } = usePyodide();

  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);

  // UI state
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showOpenProjectDialog, setShowOpenProjectDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  
  // Code execution state
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Load user projects
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; template: string }) => {
      const template = gameTemplates.find(t => t.id === data.template);
      if (!template) throw new Error("Template not found");

      const response = await apiRequest("POST", "/api/projects", {
        name: data.name,
        template: data.template,
        files: template.files,
        assets: []
      });
      return await response.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setCurrentProject(project);
      setFiles(project.files);
      setAssets(project.assets);
      setActiveFileIndex(0);
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
      
      const response = await apiRequest("PUT", `/api/projects/${currentProject.id}`, {
        files,
        assets
      });
      return await response.json();
    },
    onSuccess: () => {
      setUnsavedChanges(false);
      toast({
        title: "Project Saved",
        description: "Your changes have been saved successfully",
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

  // Execute code
  const executeCode = useCallback(async (inputValues = "", runAutoGrading = false) => {
    if (!pyodide || files.length === 0) return;

    setIsExecuting(true);
    setError("");
    setOutput("");

    try {
      // Set up input values if provided
      if (inputValues && inputValues.trim()) {
        pyodide.globals.get('set_input_values_from_js')(inputValues);
      } else {
        pyodide.globals.get('set_input_values_from_js')('');
      }

      // Clear previous output
      pyodide.runPython("import sys; sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__");

      // Write all files to Pyodide filesystem
      pyodide.runPython(`
import os
import sys

# Create project directory structure
project_dir = '/project'
assets_dir = '/project/assets'
if os.path.exists(project_dir):
    import shutil
    shutil.rmtree(project_dir)
os.makedirs(project_dir, exist_ok=True)
os.makedirs(assets_dir, exist_ok=True)

# Change to project directory
os.chdir(project_dir)

# Add project directory to Python path
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)
`);

      // Write each file to the filesystem
      for (const file of files) {
        // Escape the content properly for Python string literal
        const escapedContent = file.content
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        
        pyodide.runPython(`
with open('${file.path}', 'w', encoding='utf-8') as f:
    f.write('${escapedContent}')
`);
      }

      // Write all project assets to Pyodide filesystem
      const assetWritingResults = [];
      if (assets.length > 0) {
        console.log(`Writing ${assets.length} assets to Pyodide filesystem...`);
        
        for (const asset of assets) {
          try {
            // Validate asset data
            if (!asset.dataUrl || typeof asset.dataUrl !== 'string') {
              const error = `Asset ${asset.name} has invalid dataUrl`;
              console.error(error);
              assetWritingResults.push({ asset: asset.name, success: false, error });
              continue;
            }
            
            // Decode base64 dataUrl to binary data
            const dataUrlParts = asset.dataUrl.split(',');
            if (dataUrlParts.length !== 2) {
              const error = `Invalid dataUrl format for asset ${asset.name} (expected "data:type;base64,data")`;
              console.error(error);
              assetWritingResults.push({ asset: asset.name, success: false, error });
              continue;
            }
            
            const mimeType = dataUrlParts[0].split(';')[0].split(':')[1];
            const base64Data = dataUrlParts[1];
            
            // Validate base64 data
            if (!base64Data) {
              const error = `Empty base64 data for asset ${asset.name}`;
              console.error(error);
              assetWritingResults.push({ asset: asset.name, success: false, error });
              continue;
            }
            
            // Decode base64 to binary
            let binaryString;
            try {
              binaryString = atob(base64Data);
            } catch (decodeError) {
              const error = `Failed to decode base64 data for asset ${asset.name}: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`;
              console.error(error);
              assetWritingResults.push({ asset: asset.name, success: false, error });
              continue;
            }
            
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Create directory structure for the asset path
            const assetPathParts = asset.path.split('/');
            const assetDir = assetPathParts.slice(0, -1).join('/');
            
            if (assetDir) {
              try {
                pyodide.runPython(`
import os
asset_dir = '${assetDir.replace(/'/g, "\\'")}' 
if asset_dir:
    os.makedirs(asset_dir, exist_ok=True)
    print(f"Created directory: {asset_dir}")
`);
              } catch (dirError) {
                const error = `Failed to create directory ${assetDir} for asset ${asset.name}: ${dirError instanceof Error ? dirError.message : String(dirError)}`;
                console.error(error);
                assetWritingResults.push({ asset: asset.name, success: false, error });
                continue;
              }
            }
            
            // Write binary data to Pyodide filesystem
            try {
              pyodide.FS.writeFile(asset.path, bytes);
              
              // Verify file was written
              const fileStats = pyodide.FS.stat(asset.path);
              const fileSizeKB = Math.round(fileStats.size / 1024 * 100) / 100;
              
              console.log(`✓ Successfully wrote asset: ${asset.name} (${asset.path}, ${fileSizeKB}KB)`);
              assetWritingResults.push({ 
                asset: asset.name, 
                success: true, 
                path: asset.path,
                size: fileSizeKB,
                type: mimeType 
              });
              
            } catch (writeError) {
              const error = `Failed to write file ${asset.path}: ${writeError instanceof Error ? writeError.message : String(writeError)}`;
              console.error(error);
              assetWritingResults.push({ asset: asset.name, success: false, error });
            }
            
          } catch (error) {
            const errorMsg = `Unexpected error processing asset ${asset.name}: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMsg);
            assetWritingResults.push({ asset: asset.name, success: false, error: errorMsg });
          }
        }
        
        // Log summary
        const successCount = assetWritingResults.filter(r => r.success).length;
        const failureCount = assetWritingResults.length - successCount;
        
        if (successCount > 0) {
          console.log(`✓ Asset writing completed: ${successCount} successful, ${failureCount} failed`);
        }
        if (failureCount > 0) {
          console.warn(`⚠ ${failureCount} assets failed to write - check console for details`);
        }
        
        // Add asset paths to Python for debugging
        const successfulAssets = assetWritingResults
          .filter(r => r.success)
          .map(r => r.path);
          
        if (successfulAssets.length > 0) {
          pyodide.runPython(`
# Debug info: Available assets for pygame
__available_assets__ = ${JSON.stringify(successfulAssets)}
print(f"Assets available for pygame.image.load(): {__available_assets__}")
`);
        }
      }

      // Determine main file to execute (current active file)
      const mainFile = files[activeFileIndex];
      if (!mainFile) {
        throw new Error("No active file selected");
      }

      let capturedOutput = "";
      let capturedError = "";

      // Execute the main file with proper output capture
      pyodide.runPython(`
import sys
import io
import runpy
from contextlib import redirect_stdout, redirect_stderr

class ProjectOutputCapture:
    def __init__(self):
        self.output = ""
        self.error = ""
    
    def capture_execution(self, main_file_path):
        output_buffer = io.StringIO()
        error_buffer = io.StringIO()
        
        try:
            with redirect_stdout(output_buffer), redirect_stderr(error_buffer):
                # Use runpy to execute the main file properly
                runpy.run_path(main_file_path, run_name='__main__')
        except SystemExit:
            # Handle normal program exits gracefully
            pass
        except Exception as e:
            error_buffer.write(str(e))
        
        self.output = output_buffer.getvalue()
        self.error = error_buffer.getvalue()
        return self.output, self.error

project_capture = ProjectOutputCapture()
project_output, project_error = project_capture.capture_execution('${mainFile.path}')
`);

      capturedOutput = pyodide.globals.get('project_output') || "";
      capturedError = pyodide.globals.get('project_error') || "";

      setOutput(capturedOutput);
      setError(capturedError);

      // Check for pygame content to enable game simulation
      const hasGameCode = files.some(file => 
        file.content.includes("pygame") || 
        file.content.includes("import pygame") ||
        file.content.includes("from pygame")
      );

      if (hasGameCode) {
        setIsRunning(true);
        // Auto-stop after 5 seconds for demo purposes
        setTimeout(() => setIsRunning(false), 5000);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [pyodide, files, activeFileIndex]);

  // Handle file changes
  const updateFileContent = (content: string) => {
    if (activeFileIndex >= 0 && activeFileIndex < files.length) {
      const updatedFiles = [...files];
      updatedFiles[activeFileIndex] = { ...updatedFiles[activeFileIndex], content };
      setFiles(updatedFiles);
      setUnsavedChanges(true);
    }
  };

  // Add new file
  const addNewFile = () => {
    const fileName = `new_file_${files.length + 1}.py`;
    const newFile: ProjectFile = {
      path: fileName,
      content: "# New Python file\n\n"
    };
    setFiles([...files, newFile]);
    setActiveFileIndex(files.length);
    setUnsavedChanges(true);
  };

  // Remove file
  const removeFile = (index: number) => {
    if (files.length <= 1) {
      toast({
        title: "Cannot Remove File",
        description: "Projects must have at least one file",
        variant: "destructive",
      });
      return;
    }

    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    
    if (activeFileIndex >= updatedFiles.length) {
      setActiveFileIndex(Math.max(0, updatedFiles.length - 1));
    }
    setUnsavedChanges(true);
  };

  // Load project
  const loadProject = (project: Project) => {
    setCurrentProject(project);
    setFiles(project.files);
    setAssets(project.assets);
    setActiveFileIndex(0);
    setUnsavedChanges(false);
    setShowOpenProjectDialog(false);
    toast({
      title: "Project Loaded",
      description: `Opened ${project.name}`,
    });
  };

  // Handle template selection for new project
  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      toast({
        title: "Project Name Required",
        description: "Please enter a name for your project",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate({
      name: newProjectName.trim(),
      template: selectedTemplate
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-back-home"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">
                  {currentProject ? currentProject.name : "Project Builder"}
                </h1>
                {unsavedChanges && (
                  <Badge variant="secondary" className="text-xs">
                    Unsaved
                  </Badge>
                )}
              </div>
            </motion.div>

            <motion.div 
              className="flex items-center space-x-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-new-project">
                    <FolderPlus className="h-4 w-4 mr-1" />
                    New
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-new-project">
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Choose a template to get started with your game project.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Project Name</label>
                      <Input
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="My Awesome Game"
                        data-testid="input-project-name"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Game Template</label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger data-testid="select-template">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getTemplateOptions().map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              <div>
                                <div className="font-medium">{template.name}</div>
                                <div className="text-xs text-muted-foreground">{template.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button
                      onClick={handleCreateProject}
                      disabled={createProjectMutation.isPending}
                      data-testid="button-create-project"
                    >
                      {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showOpenProjectDialog} onOpenChange={setShowOpenProjectDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-open-project">
                    <FileText className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl" data-testid="dialog-open-project">
                  <DialogHeader>
                    <DialogTitle>Open Project</DialogTitle>
                    <DialogDescription>
                      Select a project to continue working on.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <ScrollArea className="max-h-96">
                    {projectsLoading ? (
                      <div className="text-center py-8">Loading projects...</div>
                    ) : projects && projects.length > 0 ? (
                      <div className="space-y-2">
                        {projects.map((project) => (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => loadProject(project)}
                            data-testid={`project-card-${project.id}`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{project.name}</CardTitle>
                                <Badge variant="outline" className="text-xs">
                                  {project.template}
                                </Badge>
                              </div>
                              <CardDescription>
                                {project.files.length} files • Template: {project.template}
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No projects found. Create your first project!
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              {currentProject && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveProjectMutation.mutate()}
                    disabled={!unsavedChanges || saveProjectMutation.isPending}
                    data-testid="button-save-project"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saveProjectMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={() => setShowExportDialog(true)}
                    disabled={files.length === 0}
                    data-testid="button-export-game"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export Game
                  </Button>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Files & Assets */}
        <div className="w-80 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-r border-border flex flex-col">
          <Tabs defaultValue="files" className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-2 m-4 mb-0">
              <TabsTrigger value="files" data-testid="tab-files">
                <Code2 className="h-4 w-4 mr-1" />
                Files
              </TabsTrigger>
              <TabsTrigger value="assets" data-testid="tab-assets">
                <Image className="h-4 w-4 mr-1" />
                Assets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="flex-1 m-4 mt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Project Files</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addNewFile}
                  disabled={!currentProject}
                  data-testid="button-add-file"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                {files.length > 0 ? (
                  <div className="space-y-1">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          index === activeFileIndex 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setActiveFileIndex(index)}
                        data-testid={`file-item-${index}`}
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate">{file.path}</span>
                        </div>
                        {files.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                            data-testid={`button-remove-file-${index}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Create a new project to start coding
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="assets" className="flex-1 mt-2">
              <AssetManager
                assets={assets}
                onAssetsChange={(newAssets) => {
                  setAssets(newAssets);
                  setUnsavedChanges(true);
                }}
                disabled={!currentProject}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Center Panel - Code Editor */}
        <div className="flex-1 flex flex-col">
          {currentProject && files.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* File tabs */}
              <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-border p-2">
                <div className="flex items-center space-x-1">
                  {files.map((file, index) => (
                    <button
                      key={index}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        index === activeFileIndex
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setActiveFileIndex(index)}
                      data-testid={`tab-file-${index}`}
                    >
                      {file.path}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Editor */}
              <div className="flex-1">
                <CodeEditor
                  code={files[activeFileIndex]?.content || ""}
                  onChange={updateFileContent}
                  onExecute={executeCode}
                  output={output}
                  error={error}
                  isExecuting={isExecuting}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="text-center">
                <Gamepad2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">Welcome to Project Builder</h2>
                <p className="text-muted-foreground mb-6">
                  Create a new project or open an existing one to start building your game!
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => setShowNewProjectDialog(true)} data-testid="welcome-new-project">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowOpenProjectDialog(true)}
                    data-testid="welcome-open-project"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Open Project
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Game Preview */}
        <div className="w-96">
          {currentProject && files.length > 0 ? (
            <GameCanvas
              code={files[activeFileIndex]?.content || ""}
              pyodide={pyodide}
              isRunning={isRunning}
            />
          ) : (
            <div className="h-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-l border-border flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Game preview will appear here</p>
                <p className="text-xs mt-1">Create a project and run your code to see the magic!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog */}
      {currentProject && (
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          projectName={currentProject.name}
          files={files}
          assets={assets}
          template={currentProject.template}
        />
      )}
    </div>
  );
}