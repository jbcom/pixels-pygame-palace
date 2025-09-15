import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, Play, Code2, User, Calendar, Gamepad2, 
  Copy, Download, Star, Heart, Share, Trophy,
  File, Image, Volume2, Sparkles, Eye, Zap
} from "lucide-react";
import CodeEditor from "@/components/code-editor";
import GameCanvas from "@/components/game-canvas";
import { usePyodide } from "@/hooks/use-pyodide";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";
import { motion } from "framer-motion";

export default function ProjectViewer() {
  const [match, params] = useRoute("/gallery/:id");
  const projectId = params?.id;
  const { toast } = useToast();
  const { pyodide, isLoading: pyodideLoading } = usePyodide();

  // Project state
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  const { data: project, isLoading, error: fetchError } = useQuery<Project>({
    queryKey: ["/api/gallery", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/gallery/${projectId}`);
      if (!response.ok) {
        throw new Error("Project not found");
      }
      return response.json();
    },
    enabled: !!projectId,
  });

  // Execute code (read-only preview)
  const executeCode = useCallback(async (inputValues = "") => {
    if (!pyodide || !project || project.files.length === 0) return;

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
      for (const file of project.files) {
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

      // Write project assets to filesystem
      for (const asset of project.assets) {
        try {
          const dataUrlParts = asset.dataUrl.split(',');
          if (dataUrlParts.length === 2) {
            const base64Data = dataUrlParts[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Create directory structure
            const assetPathParts = asset.path.split('/');
            const assetDir = assetPathParts.slice(0, -1).join('/');
            
            if (assetDir) {
              pyodide.runPython(`
import os
os.makedirs('${assetDir.replace(/'/g, "\\'")}', exist_ok=True)
`);
            }
            
            pyodide.FS.writeFile(asset.path, bytes);
          }
        } catch (assetError) {
          console.warn(`Failed to write asset ${asset.name}:`, assetError);
        }
      }

      // Find and execute main file
      const mainFile = project.files.find(f => f.path === 'main.py') || project.files[0];
      
      // Capture output
      let capturedOutput = "";
      let capturedError = "";

      pyodide.runPython(`
import sys
from io import StringIO

# Redirect stdout and stderr to capture output
old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

captured_output = ""
captured_error = ""

try:
    exec(open('${mainFile.path}').read())
    captured_output = sys.stdout.getvalue()
except Exception as e:
    captured_error = str(e) + "\\n" + sys.stderr.getvalue()
finally:
    # Restore original stdout/stderr
    sys.stdout = old_stdout
    sys.stderr = old_stderr
`);

      capturedOutput = pyodide.globals.get("captured_output");
      capturedError = pyodide.globals.get("captured_error");

      if (capturedError) {
        setError(capturedError);
      } else {
        setOutput(capturedOutput || "Program executed successfully!");
      }

    } catch (error) {
      console.error("Execution error:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExecuting(false);
    }
  }, [pyodide, project]);

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
    });
  };

  const getTemplateDisplayName = (template: string) => {
    const templates: Record<string, string> = {
      "pong": "Pong Game",
      "snake": "Snake Game", 
      "platformer": "Platformer",
      "shooter": "Space Shooter",
      "puzzle": "Puzzle Game",
      "rpg": "RPG Adventure",
      "blank": "Custom Project"
    };
    return templates[template] || template;
  };

  const getTemplateIcon = (template: string) => {
    switch (template) {
      case "pong": return "🏓";
      case "snake": return "🐍";
      case "platformer": return "🏃‍♂️";
      case "shooter": return "🚀";
      case "puzzle": return "🧩";
      case "rpg": return "⚔️";
      default: return "🎮";
    }
  };

  if (!match || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <motion.div 
                className="relative w-16 h-16 mx-auto mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-lg opacity-75"></div>
                <div className="relative bg-white dark:bg-gray-900 rounded-full w-16 h-16 flex items-center justify-center">
                  <Code2 className="h-8 w-8 text-primary" />
                </div>
              </motion.div>
              <p className="text-muted-foreground font-medium">Loading project...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-red-800 rounded-full flex items-center justify-center">
                <Gamepad2 className="h-12 w-12 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Project Not Found</h3>
              <p className="text-muted-foreground mb-6">
                This project might have been removed or made private.
              </p>
              <Link href="/gallery">
                <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Gallery
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-purple-950">
      {/* Header */}
      <header className="backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/gallery">
                <Button variant="ghost" size="sm" data-testid="back-to-gallery">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Gallery
                </Button>
              </Link>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-lg blur opacity-75"></div>
                  <div className="relative bg-white dark:bg-gray-900 rounded-lg p-2">
                    <div className="text-lg">{getTemplateIcon(project.template)}</div>
                  </div>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">{project.name}</h1>
                  <p className="text-sm text-muted-foreground">{getTemplateDisplayName(project.template)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" data-testid="like-project">
                <Heart className="h-4 w-4 mr-1" />
                Like
              </Button>
              <Button variant="outline" size="sm" data-testid="share-project">
                <Share className="h-4 w-4 mr-1" />
                Share
              </Button>
              <Link href="/project-builder">
                <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white" data-testid="use-as-template">
                  <Copy className="h-4 w-4 mr-1" />
                  Use as Template
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Project Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-border/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="secondary" className="bg-gradient-to-r from-primary/10 to-secondary/10">
                        <Trophy className="h-3 w-3 mr-1" />
                        Published
                      </Badge>
                      <Badge variant="outline">
                        {getTemplateIcon(project.template)} {getTemplateDisplayName(project.template)}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl mb-2">{project.name}</CardTitle>
                    <CardDescription className="text-base">
                      {project.description || "An amazing Python game creation!"}
                    </CardDescription>
                  </div>
                  
                  {project.thumbnailDataUrl && (
                    <div className="ml-6">
                      <img 
                        src={project.thumbnailDataUrl} 
                        alt={project.name}
                        className="w-32 h-20 object-cover rounded-lg border border-border/50"
                        data-testid="project-thumbnail"
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Student Creator</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    <span>{project.files.length} Files</span>
                  </div>
                  {project.assets.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      <span>{project.assets.length} Assets</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span>Community Favorite</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Code Editor Panel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="h-[600px] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center">
                      <Code2 className="h-5 w-5 mr-2" />
                      Project Code
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">Read-only</Badge>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(project.files[activeFileIndex]?.content || "")}
                        data-testid="copy-code"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0 h-[520px]">
                  <Tabs value={activeFileIndex.toString()} onValueChange={(v) => setActiveFileIndex(parseInt(v))}>
                    <div className="px-6 pb-3">
                      <TabsList className="grid w-full grid-cols-auto overflow-x-auto">
                        {project.files.map((file, index) => (
                          <TabsTrigger 
                            key={index} 
                            value={index.toString()}
                            className="flex items-center space-x-1 text-xs"
                            data-testid={`file-tab-${index}`}
                          >
                            <File className="h-3 w-3" />
                            <span>{file.path}</span>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    
                    {project.files.map((file, index) => (
                      <TabsContent key={index} value={index.toString()} className="h-[450px] px-6">
                        <div className="h-full border border-border/50 rounded-lg overflow-hidden">
                          <CodeEditor
                            value={file.content}
                            onChange={() => {}} // Read-only
                            language="python"
                            readOnly={true}
                          />
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>

            {/* Game Preview Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-4"
            >
              {/* Game Canvas */}
              <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center">
                      <Gamepad2 className="h-5 w-5 mr-2" />
                      Live Preview
                    </CardTitle>
                    <Button 
                      onClick={() => executeCode()} 
                      disabled={isExecuting || pyodideLoading}
                      className="bg-gradient-to-r from-primary to-secondary text-white"
                      data-testid="run-project"
                    >
                      {isExecuting ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                        </motion.div>
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      {isExecuting ? "Running..." : "Run Game"}
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="aspect-[4/3] bg-black rounded-lg overflow-hidden border border-border/50">
                    <GameCanvas />
                  </div>
                </CardContent>
              </Card>

              {/* Output */}
              <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <Eye className="h-4 w-4 mr-2" />
                    Output
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <div className="min-h-[120px] max-h-[180px] overflow-y-auto bg-gray-900 dark:bg-gray-950 text-green-400 p-4 rounded-lg font-mono text-sm">
                    {error ? (
                      <div className="text-red-400" data-testid="error-output">
                        <strong>Error:</strong><br />
                        {error}
                      </div>
                    ) : output ? (
                      <div data-testid="program-output">
                        {output.split('\n').map((line, i) => (
                          <div key={i}>{line || '\u00A0'}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic">
                        Click "Run Game" to see the output...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Assets Section */}
          {project.assets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-6"
            >
              <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Image className="h-5 w-5 mr-2" />
                    Project Assets ({project.assets.length})
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {project.assets.map((asset, index) => (
                      <div 
                        key={index}
                        className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-border/50 group hover:shadow-lg transition-all duration-300"
                      >
                        {asset.type === 'image' ? (
                          <img 
                            src={asset.dataUrl} 
                            alt={asset.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            data-testid={`asset-${index}`}
                          />
                        ) : asset.type === 'sound' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                            <Volume2 className="h-8 w-8 mb-2" />
                            <span className="text-xs text-center px-2">{asset.name}</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                            <File className="h-8 w-8 mb-2" />
                            <span className="text-xs text-center px-2">{asset.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 text-center"
          >
            <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
              <CardContent className="py-8">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="text-2xl mb-2">🌟</div>
                  <h3 className="text-xl font-bold">Inspired by this project?</h3>
                  <p className="text-muted-foreground">
                    Start learning Python and create your own amazing games!
                  </p>
                  <div className="flex justify-center space-x-3">
                    <Link href="/">
                      <Button variant="outline" data-testid="start-learning">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Start Learning
                      </Button>
                    </Link>
                    <Link href="/project-builder">
                      <Button className="bg-gradient-to-r from-primary to-secondary text-white" data-testid="create-project">
                        <Code2 className="h-4 w-4 mr-2" />
                        Create Your Own
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}