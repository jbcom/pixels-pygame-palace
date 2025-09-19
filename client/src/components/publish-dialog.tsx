<<<<<<< Updated upstream
version https://git-lfs.github.com/spec/v1
oid sha256:3cdc81129d79dee4d6679a1c0cdc3dfa1a503b01bc03b5019dfbd96a0ff39759
size 17385
=======
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, Image, Eye, Globe, Users, Trophy, 
  Camera, Sparkles, CheckCircle, XCircle, 
  Gamepad2, Code2, Share
} from "lucide-react";
import type { Project } from "@shared/schema";
import { motion } from "framer-motion";

interface PublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function PublishDialog({ isOpen, onClose, project }: PublishDialogProps) {
  const { toast } = useToast();
  
  // Form state
  const [description, setDescription] = useState("");
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [isCapturingThumbnail, setIsCapturingThumbnail] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen && project) {
      setDescription(project.description || "");
      setThumbnailDataUrl(project.thumbnailDataUrl || null);
    } else {
      setDescription("");
      setThumbnailDataUrl(null);
    }
  }, [isOpen, project]);

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

  // Capture thumbnail from canvas
  const captureThumbnail = () => {
    setIsCapturingThumbnail(true);
    
    try {
      // Find the game canvas element
      const canvases = document.querySelectorAll('canvas');
      let gameCanvas = null;
      
      // Look for pygame canvas or any visible canvas
      for (const canvas of Array.from(canvases)) {
        if (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
          gameCanvas = canvas;
          break;
        }
      }
      
      if (gameCanvas) {
        // Create a temporary canvas to resize the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Set thumbnail size (16:10 aspect ratio for gallery cards)
        tempCanvas.width = 320;
        tempCanvas.height = 200;
        
        if (tempCtx) {
          // Draw the game canvas onto the temp canvas (scaled)
          tempCtx.drawImage(gameCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
          
          // Convert to data URL
          const dataUrl = tempCanvas.toDataURL('image/png', 0.8);
          setThumbnailDataUrl(dataUrl);
          
          toast({
            title: "Thumbnail Captured!",
            description: "Your game screenshot has been captured successfully.",
          });
        } else {
          throw new Error("Could not create thumbnail context");
        }
      } else {
        throw new Error("No game canvas found. Please run your game first!");
      }
    } catch (error) {
      console.error("Thumbnail capture failed:", error);
      toast({
        title: "Capture Failed",
        description: error instanceof Error ? error.message : "Could not capture thumbnail. Try running your game first.",
        variant: "destructive",
      });
    } finally {
      setIsCapturingThumbnail(false);
    }
  };

  // Publish project mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project to publish");
      
      // First update the project with description and thumbnail
      await apiRequest("PUT", `/api/projects/${project.id}`, {
        description: description.trim(),
        thumbnailDataUrl: thumbnailDataUrl
      });
      
      // Then publish it
      const response = await apiRequest("POST", `/api/projects/${project.id}/publish`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      
      toast({
        title: "🎉 Project Published!",
        description: "Your project is now live in the gallery for everyone to see!",
      });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Publishing Failed",
        description: error instanceof Error ? error.message : "Could not publish project",
        variant: "destructive",
      });
    }
  });

  // Unpublish project mutation
  const unpublishMutation = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("No project to unpublish");
      
      const response = await apiRequest("POST", `/api/projects/${project.id}/unpublish`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      
      toast({
        title: "Project Unpublished",
        description: "Your project has been removed from the gallery",
      });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Unpublishing Failed",
        description: error instanceof Error ? error.message : "Could not unpublish project",
        variant: "destructive",
      });
    }
  });

  const handlePublish = () => {
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please add a description for your project",
        variant: "destructive",
      });
      return;
    }
    
    publishMutation.mutate();
  };

  const handleUnpublish = () => {
    unpublishMutation.mutate();
  };

  if (!project) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {project.published ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Manage Published Project</span>
              </>
            ) : (
              <>
                <Globe className="h-5 w-5 text-primary" />
                <span>Publish to Gallery</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {project.published 
              ? "Your project is currently published in the gallery. You can update details or unpublish it."
              : "Share your amazing creation with the Pixel's PyGame Palace community!"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Status */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{getTemplateIcon(project.template)}</div>
              <div>
                <h3 className="font-semibold">{project.name}</h3>
                <p className="text-sm text-muted-foreground">{getTemplateDisplayName(project.template)}</p>
              </div>
            </div>
            
            <Badge variant={project.published ? "default" : "secondary"}>
              {project.published ? (
                <>
                  <Trophy className="h-3 w-3 mr-1" />
                  Published
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Private
                </>
              )}
            </Badge>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Project Description*</Label>
            <Textarea
              id="description"
              placeholder="Describe your awesome game! What makes it special? What did you learn while building it?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="project-description"
            />
            <p className="text-xs text-muted-foreground">
              Tell other students about your game and inspire them!
            </p>
          </div>

          {/* Thumbnail Section */}
          <div className="space-y-3">
            <Label>Project Thumbnail</Label>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={captureThumbnail}
                  disabled={isCapturingThumbnail}
                  className="w-full"
                  data-testid="capture-thumbnail"
                >
                  {isCapturingThumbnail ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                    </motion.div>
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  {isCapturingThumbnail ? "Capturing..." : "Capture Screenshot"}
                </Button>
                
                <Alert>
                  <Image className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Run your game first, then click "Capture Screenshot" to create a thumbnail.
                  </AlertDescription>
                </Alert>
              </div>
              
              <div className="aspect-[16/10] bg-muted rounded-lg overflow-hidden border-2 border-dashed border-border">
                {thumbnailDataUrl ? (
                  <img 
                    src={thumbnailDataUrl} 
                    alt="Project thumbnail"
                    className="w-full h-full object-cover"
                    data-testid="project-thumbnail-preview"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Image className="h-8 w-8 mb-2" />
                    <p className="text-sm">No thumbnail</p>
                    <p className="text-xs">Capture a screenshot</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gallery Preview */}
          <div className="space-y-3">
            <Label>Gallery Preview</Label>
            
            <Card className="bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  <span>How your project will appear in the gallery:</span>
                </div>
              </CardHeader>
              
              <CardContent>
                <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                  {/* Preview thumbnail */}
                  <div className="relative overflow-hidden h-32 bg-gradient-to-br from-primary/10 to-secondary/10">
                    {thumbnailDataUrl ? (
                      <img 
                        src={thumbnailDataUrl} 
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <div className="text-3xl">{getTemplateIcon(project.template)}</div>
                          <div className="text-xs font-medium text-muted-foreground">
                            {getTemplateDisplayName(project.template)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">
                        {getTemplateIcon(project.template)} {getTemplateDisplayName(project.template)}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{project.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {description.trim() || "An amazing Python game creation!"}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center space-x-3 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span>Student</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Code2 className="h-3 w-3" />
                        <span>{project.files.length} files</span>
                      </div>
                    </div>
                    
                    <Button size="sm" className="w-full text-xs">
                      <Eye className="h-3 w-3 mr-1" />
                      View & Play
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          
          {project.published ? (
            <div className="flex space-x-2">
              <Button 
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                variant="outline"
                data-testid="update-project"
              >
                {publishMutation.isPending ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                  </motion.div>
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Update Details
              </Button>
              
              <Button 
                onClick={handleUnpublish}
                disabled={unpublishMutation.isPending}
                variant="destructive"
                data-testid="unpublish-project"
              >
                {unpublishMutation.isPending ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                  </motion.div>
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Unpublish
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handlePublish}
              disabled={publishMutation.isPending || !description.trim()}
              className="bg-gradient-to-r from-primary to-secondary text-white"
              data-testid="publish-project"
            >
              {publishMutation.isPending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                </motion.div>
              ) : (
                <Share className="h-4 w-4 mr-2" />
              )}
              {publishMutation.isPending ? "Publishing..." : "Publish to Gallery"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
>>>>>>> Stashed changes
