<<<<<<< Updated upstream
version https://git-lfs.github.com/spec/v1
oid sha256:9e7c5fd57a631e19c761a27226c790a65cfd72ac87a06e892672d566e1ed1ed8
size 16109
=======
import { useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Package, CheckCircle, AlertCircle } from "lucide-react";
import type { ProjectFile, ProjectAsset } from "@shared/schema";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  files: ProjectFile[];
  assets: ProjectAsset[];
  template: string;
}

interface ExportProgress {
  phase: 'preparing' | 'files' | 'assets' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export default function ExportDialog({
  open,
  onOpenChange,
  projectName,
  files,
  assets,
  template
}: ExportDialogProps) {
  const { toast } = useToast();
  
  // Export configuration state
  const [exportName, setExportName] = useState(projectName);
  const [description, setDescription] = useState("");
  const [mainFile, setMainFile] = useState(files.find(f => f.path === "main.py")?.path || files[0]?.path || "");
  
  // Export progress state
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    phase: 'preparing',
    progress: 0,
    message: 'Ready to export'
  });
  const [isExporting, setIsExporting] = useState(false);

  // Generate README.md content
  const generateReadme = () => {
    const gameTitle = exportName || projectName;
    const gameDescription = description || "A Python game created with Pixel's PyGame Palace.";
    
    // Template-specific controls
    const controlsSection = getControlsForTemplate(template);
    
    return `# ${gameTitle}

${gameDescription}

## Setup Instructions

1. **Install Python 3.8 or higher**
   - Download from: https://www.python.org/downloads/
   - Make sure to check "Add Python to PATH" during installation

2. **Install pygame**
   \`\`\`bash
   pip install pygame
   \`\`\`

3. **Run the game**
   \`\`\`bash
   python ${mainFile}
   \`\`\`

${controlsSection}

## Project Structure

- \`${mainFile}\` - Main game file (run this to start the game)
- \`assets/\` - Game assets (images, sounds, etc.)
- \`requirements.txt\` - Python dependencies

## Troubleshooting

- **Error: "No module named 'pygame'"** → Install pygame with \`pip install pygame\`
- **Error: "python is not recognized"** → Make sure Python is installed and added to PATH
- **Game window doesn't appear** → Check that your display settings allow the game window size

## About

This game was created using Pixel's PyGame Palace - a platform for learning Python game development!

---
Created with 💜 using Pixel's PyGame Palace
`;
  };

  // Get template-specific controls
  const getControlsForTemplate = (template: string): string => {
    switch (template) {
      case 'platformer':
        return `## Controls

- **Arrow Keys** / **WASD** - Move character
- **Space** - Jump
- **ESC** - Pause/Quit game`;
      
      case 'snake':
        return `## Controls

- **Arrow Keys** / **WASD** - Change snake direction
- **ESC** - Pause/Quit game
- **R** - Restart game (when game over)`;
      
      case 'pong':
        return `## Controls

- **W/S** - Left paddle up/down
- **Up/Down Arrow Keys** - Right paddle up/down
- **Space** - Start/Pause game
- **ESC** - Quit game`;
      
      case 'flappy':
        return `## Controls

- **Space** / **Click** - Flap wings
- **ESC** - Quit game
- **R** - Restart game (when game over)`;
      
      default:
        return `## Controls

Use the mouse and keyboard to interact with the game. Check the game code for specific controls.`;
    }
  };

  // Convert dataUrl to binary data for ZIP
  const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      throw new Error('Invalid dataUrl format');
    }
    
    const base64Data = parts[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  };

  // Main export function
  const handleExport = async () => {
    if (!exportName.trim()) {
      toast({
        title: "Export Name Required",
        description: "Please enter a name for your exported project.",
        variant: "destructive",
      });
      return;
    }

    if (!mainFile) {
      toast({
        title: "Main File Required",
        description: "Please select the main file to run the game.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Phase 1: Preparing
      setExportProgress({
        phase: 'preparing',
        progress: 10,
        message: 'Preparing project for export...'
      });

      const zip = new JSZip();
      const cleanName = exportName.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
      
      // Phase 2: Adding files
      setExportProgress({
        phase: 'files',
        progress: 25,
        message: `Adding ${files.length} Python files...`
      });

      // Add all Python files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        zip.file(file.path, file.content);
        
        setExportProgress({
          phase: 'files',
          progress: 25 + (i / files.length) * 25,
          message: `Adding file: ${file.path}`
        });
      }

      // Phase 3: Adding assets
      if (assets.length > 0) {
        setExportProgress({
          phase: 'assets',
          progress: 50,
          message: `Adding ${assets.length} game assets...`
        });

        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          
          try {
            // Convert dataUrl to binary data
            const binaryData = dataUrlToBytes(asset.dataUrl);
            
            // Use the asset's path directly (it should include assets/ prefix)
            zip.file(asset.path, binaryData);
            
            setExportProgress({
              phase: 'assets',
              progress: 50 + (i / assets.length) * 25,
              message: `Adding asset: ${asset.name}`
            });
          } catch (error) {
            console.error(`Failed to add asset ${asset.name}:`, error);
            // Continue with other assets instead of failing completely
          }
        }
      }

      // Phase 4: Adding metadata files
      setExportProgress({
        phase: 'generating',
        progress: 80,
        message: 'Generating README and requirements...'
      });

      // Add requirements.txt
      const requirements = `# Python requirements for ${cleanName}
# Install with: pip install -r requirements.txt

pygame>=2.0.0

# Optional: For better performance and additional features
# numpy>=1.20.0
# Pillow>=8.0.0
`;
      zip.file("requirements.txt", requirements);

      // Add README.md
      const readme = generateReadme();
      zip.file("README.md", readme);

      // Add a simple run script for convenience
      const runScript = `#!/usr/bin/env python3
"""
${cleanName} - Quick Launch Script
This script ensures the game runs from the correct directory.
"""

import os
import sys

# Change to the script's directory
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Add the current directory to Python path
sys.path.insert(0, script_dir)

try:
    # Import and run the main game
    import runpy
    runpy.run_path("${mainFile}", run_name="__main__")
except ImportError as e:
    print(f"Error: Missing required module: {e}")
    print("\\nPlease install pygame with: pip install pygame")
    print("Or install all requirements with: pip install -r requirements.txt")
    input("Press Enter to exit...")
except Exception as e:
    print(f"Error running game: {e}")
    input("Press Enter to exit...")
`;
      zip.file("run_game.py", runScript);

      // Phase 5: Generating ZIP
      setExportProgress({
        phase: 'generating',
        progress: 90,
        message: 'Generating ZIP file...'
      });

      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      // Phase 6: Download
      setExportProgress({
        phase: 'complete',
        progress: 100,
        message: 'Download starting...'
      });

      // Create download link and trigger download
      const downloadUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${cleanName}.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);

      // Success
      toast({
        title: "Export Successful!",
        description: `${cleanName}.zip has been downloaded. Extract and run "${mainFile}" to play your game!`,
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
        setIsExporting(false);
        setExportProgress({
          phase: 'preparing',
          progress: 0,
          message: 'Ready to export'
        });
      }, 2000);

    } catch (error) {
      console.error('Export failed:', error);
      
      setExportProgress({
        phase: 'error',
        progress: 0,
        message: 'Export failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred during export.",
        variant: "destructive",
      });

      setIsExporting(false);
    }
  };

  // Reset state when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open && !isExporting) {
      setExportProgress({
        phase: 'preparing',
        progress: 0,
        message: 'Ready to export'
      });
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-export-project">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-primary" />
            <span>Export Game Project</span>
          </DialogTitle>
          <DialogDescription>
            Download your game as a complete Python project that can run on any computer.
          </DialogDescription>
        </DialogHeader>

        {!isExporting ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-name">Project Name</Label>
              <Input
                id="export-name"
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                placeholder="My Awesome Game"
                data-testid="input-export-name"
              />
            </div>

            <div>
              <Label htmlFor="main-file">Main File</Label>
              <Select value={mainFile} onValueChange={setMainFile}>
                <SelectTrigger data-testid="select-main-file">
                  <SelectValue placeholder="Select main file" />
                </SelectTrigger>
                <SelectContent>
                  {files.map((file) => (
                    <SelectItem key={file.path} value={file.path}>
                      {file.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                This file will be run to start your game
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A fun game created with Python and pygame..."
                rows={3}
                data-testid="textarea-description"
              />
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Your exported project will include setup instructions, all game files, 
                and assets needed to run on any computer with Python and pygame.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                {exportProgress.phase === 'complete' ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : exportProgress.phase === 'error' ? (
                  <AlertCircle className="h-8 w-8 text-red-500" />
                ) : (
                  <Package className="h-8 w-8 text-primary animate-pulse" />
                )}
                <div>
                  <h3 className="font-medium">
                    {exportProgress.phase === 'complete' 
                      ? 'Export Complete!' 
                      : exportProgress.phase === 'error'
                      ? 'Export Failed'
                      : 'Exporting Your Game...'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {exportProgress.message}
                  </p>
                </div>
              </div>

              {exportProgress.phase !== 'error' && (
                <Progress 
                  value={exportProgress.progress} 
                  className="w-full" 
                  data-testid="progress-export"
                />
              )}

              {exportProgress.phase === 'error' && exportProgress.error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{exportProgress.error}</AlertDescription>
                </Alert>
              )}

              {exportProgress.phase === 'complete' && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your game has been downloaded! Extract the ZIP file and run "{mainFile}" to play.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!isExporting ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-export"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleExport}
                disabled={!exportName.trim() || !mainFile}
                data-testid="button-start-export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Game
              </Button>
            </>
          ) : (
            exportProgress.phase === 'error' && (
              <Button 
                variant="outline" 
                onClick={() => setIsExporting(false)}
                data-testid="button-close-error"
              >
                Close
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
>>>>>>> Stashed changes
