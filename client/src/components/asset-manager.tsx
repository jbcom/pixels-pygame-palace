import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Image, Volume2, File, Trash2, Edit2, Copy, 
  X, CheckCircle, AlertCircle, FileImage, Music, Folder
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProjectAsset } from "@shared/schema";

interface AssetManagerProps {
  assets: ProjectAsset[];
  onAssetsChange: (assets: ProjectAsset[]) => void;
  disabled?: boolean;
}

// Extended asset interface with metadata
interface AssetWithMetadata extends ProjectAsset {
  originalExtension: string;
}

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const ACCEPTED_AUDIO_TYPES = ['audio/wav', 'audio/ogg', 'audio/mp3', 'audio/mpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function AssetManager({ assets, onAssetsChange, disabled = false }: AssetManagerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<string | null>(null);
  const [importSnippetAsset, setImportSnippetAsset] = useState<ProjectAsset | null>(null);

  // Group assets by type
  const imageAssets = assets.filter(asset => asset.type === 'image');
  const soundAssets = assets.filter(asset => asset.type === 'sound');
  const otherAssets = assets.filter(asset => asset.type === 'other');

  // Sanitize filename
  const sanitizeFilename = (filename: string): string => {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is 5MB.`;
    }

    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isAudio = ACCEPTED_AUDIO_TYPES.includes(file.type);

    if (!isImage && !isAudio) {
      return `File "${file.name}" is not a supported format. Please use PNG, JPG, GIF, WAV, OGG, or MP3 files.`;
    }

    return null;
  };

  // Get asset type from file
  const getAssetType = (file: File): 'image' | 'sound' | 'other' => {
    if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'image';
    if (ACCEPTED_AUDIO_TYPES.includes(file.type)) return 'sound';
    return 'other';
  };

  // Extract file extension from filename
  const getFileExtension = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  };

  // Get filename stem (without extension)
  const getFilenameStem = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
  };

  // Generate asset path from name, type, and extension
  const generateAssetPath = (name: string, type: 'image' | 'sound' | 'other', extension: string): string => {
    const sanitizedName = sanitizeFilename(name);
    
    switch (type) {
      case 'image':
        return `assets/sprites/${sanitizedName}${extension}`;
      case 'sound':
        return `assets/sounds/${sanitizedName}${extension}`;
      default:
        return `assets/${sanitizedName}${extension}`;
    }
  };

  // Generate asset path from file (for initial upload)
  const generateAssetPathFromFile = (file: File): string => {
    const type = getAssetType(file);
    const stem = getFilenameStem(file.name);
    const extension = getFileExtension(file.name);
    return generateAssetPath(stem, type, extension);
  };

  // Generate unique name by checking against existing assets
  const generateUniqueName = (baseName: string, existingAssets: ProjectAsset[], excludeId?: string): string => {
    let finalName = baseName;
    let counter = 1;
    
    while (existingAssets.some(asset => 
      asset.name === finalName && asset.id !== excludeId
    )) {
      finalName = `${baseName}_${counter}`;
      counter++;
    }
    
    return finalName;
  };

  // Convert file to data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate all files first
    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    // Show validation errors
    if (errors.length > 0) {
      toast({
        title: "Upload Error",
        description: errors.join('\n'),
        variant: "destructive",
      });
      return;
    }

    if (validFiles.length === 0) return;

    // Set uploading state
    const fileIds = validFiles.map(file => file.name);
    setUploadingFiles(prev => [...prev, ...fileIds]);

    try {
      const newAssets: ProjectAsset[] = [];

      for (const file of validFiles) {
        try {
          const dataUrl = await fileToDataUrl(file);
          const assetType = getAssetType(file);
          
          // Extract name and extension properly
          const filenameStem = getFilenameStem(file.name);
          const extension = getFileExtension(file.name);
          const sanitizedStem = sanitizeFilename(filenameStem);
          
          // Generate unique name
          const allExistingAssets = [...assets, ...newAssets];
          const uniqueName = generateUniqueName(sanitizedStem, allExistingAssets);
          
          // Generate path with the unique name
          const assetPath = generateAssetPath(uniqueName, assetType, extension);

          const newAsset: ProjectAsset = {
            id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: uniqueName,
            type: assetType,
            path: assetPath,
            dataUrl,
          };

          newAssets.push(newAsset);
        } catch (error) {
          toast({
            title: "Upload Error",
            description: `Failed to process file "${file.name}"`,
            variant: "destructive",
          });
        }
      }

      if (newAssets.length > 0) {
        onAssetsChange([...assets, ...newAssets]);
        toast({
          title: "Upload Successful",
          description: `Successfully uploaded ${newAssets.length} file${newAssets.length === 1 ? '' : 's'}`,
        });
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(prev => prev.filter(id => !fileIds.includes(id)));
    }
  }, [assets, onAssetsChange, disabled, toast]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [disabled, handleFileUpload]);

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    // Reset input to allow re-uploading same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete asset
  const handleDeleteAsset = (assetId: string) => {
    const updatedAssets = assets.filter(asset => asset.id !== assetId);
    onAssetsChange(updatedAssets);
    setDeleteConfirmAsset(null);
    toast({
      title: "Asset Deleted",
      description: "Asset has been removed from your project",
    });
  };

  // Start editing asset name
  const startEditing = (asset: ProjectAsset) => {
    setEditingAsset(asset.id);
    setEditName(asset.name);
  };

  // Save edited name
  const saveEditedName = () => {
    if (!editingAsset || !editName.trim()) return;

    const sanitizedName = sanitizeFilename(editName.trim());
    
    // Generate unique name to avoid conflicts
    const uniqueName = generateUniqueName(sanitizedName, assets, editingAsset);
    
    // If the name had to be changed for uniqueness, notify the user
    if (uniqueName !== sanitizedName) {
      toast({
        title: "Name Modified",
        description: `Name changed to "${uniqueName}" to avoid conflicts`,
      });
    }

    const updatedAssets = assets.map(asset => {
      if (asset.id === editingAsset) {
        // Extract extension from current path
        const extension = getFileExtension(asset.path);
        // Generate new path with updated name
        const newPath = generateAssetPath(uniqueName, asset.type, extension);
        
        return { 
          ...asset, 
          name: uniqueName,
          path: newPath
        };
      }
      return asset;
    });
    
    onAssetsChange(updatedAssets);
    setEditingAsset(null);
    setEditName("");
    
    toast({
      title: "Asset Renamed",
      description: "Asset name and path have been updated",
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingAsset(null);
    setEditName("");
  };

  // Generate import snippet
  const generateImportSnippet = (asset: ProjectAsset): string => {
    const varName = asset.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    switch (asset.type) {
      case 'image':
        return `${varName} = pygame.image.load('${asset.path}')`;
      case 'sound':
        return `${varName} = pygame.mixer.Sound('${asset.path}')`;
      default:
        return `# Load ${asset.name}\n# ${asset.path}`;
    }
  };

  // Copy import snippet to clipboard
  const copyImportSnippet = async (asset: ProjectAsset) => {
    const snippet = generateImportSnippet(asset);
    try {
      await navigator.clipboard.writeText(snippet);
      toast({
        title: "Code Copied",
        description: "Import snippet copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Render asset card
  const renderAssetCard = (asset: ProjectAsset) => {
    const isUploading = uploadingFiles.includes(asset.name);
    const isEditing = editingAsset === asset.id;

    return (
      <motion.div
        key={asset.id}
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="relative"
        data-testid={`asset-card-${asset.id}`}
      >
        <Card className="group hover:shadow-md transition-all duration-200 overflow-hidden">
          <CardContent className="p-3">
            {/* Asset preview */}
            <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
              {asset.type === 'image' ? (
                <img 
                  src={asset.dataUrl} 
                  alt={asset.name}
                  className="w-full h-full object-cover"
                  data-testid={`asset-image-${asset.id}`}
                />
              ) : asset.type === 'sound' ? (
                <Volume2 className="h-8 w-8 text-muted-foreground" data-testid={`asset-sound-${asset.id}`} />
              ) : (
                <File className="h-8 w-8 text-muted-foreground" data-testid={`asset-file-${asset.id}`} />
              )}
              
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Asset name */}
            <div className="mb-2">
              {isEditing ? (
                <div className="flex items-center space-x-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEditedName();
                      if (e.key === 'Escape') cancelEditing();
                    }}
                    className="h-6 text-xs"
                    autoFocus
                    data-testid={`input-edit-name-${asset.id}`}
                  />
                  <Button
                    size="sm"
                    onClick={saveEditedName}
                    className="h-6 w-6 p-0"
                    data-testid={`button-save-name-${asset.id}`}
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEditing}
                    className="h-6 w-6 p-0"
                    data-testid={`button-cancel-edit-${asset.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p 
                  className="text-sm font-medium truncate cursor-pointer hover:text-primary"
                  onClick={() => startEditing(asset)}
                  data-testid={`text-asset-name-${asset.id}`}
                >
                  {asset.name}
                </p>
              )}
            </div>

            {/* Asset type badge */}
            <div className="flex items-center justify-between mb-3">
              <Badge 
                variant="secondary" 
                className="text-xs"
                data-testid={`badge-type-${asset.id}`}
              >
                {asset.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {(asset.dataUrl.length * 0.75 / 1024).toFixed(1)}KB
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => startEditing(asset)}
                className="h-7 flex-1"
                disabled={disabled || isUploading}
                data-testid={`button-edit-${asset.id}`}
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Rename
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportSnippetAsset(asset)}
                className="h-7 flex-1"
                disabled={disabled || isUploading}
                data-testid={`button-copy-${asset.id}`}
              >
                <Copy className="h-3 w-3 mr-1" />
                Code
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteConfirmAsset(asset.id)}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                disabled={disabled || isUploading}
                data-testid={`button-delete-${asset.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // Render asset section
  const renderAssetSection = (title: string, assets: ProjectAsset[], icon: React.ReactNode) => {
    if (assets.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          {icon}
          <h4 className="font-medium text-sm">{title}</h4>
          <Badge variant="outline" className="text-xs">
            {assets.length}
          </Badge>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {assets.map(renderAssetCard)}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Upload Area */}
      <div className="p-4 border-b border-border">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
            isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          data-testid="upload-area"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_AUDIO_TYPES].join(',')}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
            data-testid="file-input"
          />
          
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium mb-1">
            {isDragOver ? 'Drop files here' : 'Upload Assets'}
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Drag & drop files or click to browse
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span>PNG, JPG, GIF</span>
            <span>•</span>
            <span>WAV, OGG, MP3</span>
            <span>•</span>
            <span>Max 5MB</span>
          </div>
        </div>
      </div>

      {/* Assets Display */}
      <ScrollArea className="flex-1 p-4">
        {assets.length === 0 ? (
          <div className="text-center py-12">
            <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-2">No Assets Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload images and sounds to use in your game
            </p>
            <Button 
              onClick={() => !disabled && fileInputRef.current?.click()}
              disabled={disabled}
              data-testid="button-upload-first"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Asset
            </Button>
          </div>
        ) : (
          <div>
            {renderAssetSection("Images", imageAssets, <FileImage className="h-4 w-4 text-blue-500" />)}
            {renderAssetSection("Sounds", soundAssets, <Music className="h-4 w-4 text-green-500" />)}
            {renderAssetSection("Other Files", otherAssets, <Folder className="h-4 w-4 text-gray-500" />)}
          </div>
        )}
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmAsset} onOpenChange={() => setDeleteConfirmAsset(null)}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmAsset(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmAsset && handleDeleteAsset(deleteConfirmAsset)}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Snippet Dialog */}
      <Dialog open={!!importSnippetAsset} onOpenChange={() => setImportSnippetAsset(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-import-snippet">
          <DialogHeader>
            <DialogTitle>Import Code</DialogTitle>
            <DialogDescription>
              Copy this code to use the asset in your game:
            </DialogDescription>
          </DialogHeader>
          
          {importSnippetAsset && (
            <div className="space-y-4">
              <Textarea
                value={generateImportSnippet(importSnippetAsset)}
                readOnly
                className="font-mono text-sm"
                rows={3}
                data-testid="textarea-import-snippet"
              />
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Add this code at the top of your Python file to load the asset.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportSnippetAsset(null)}
              data-testid="button-close-snippet"
            >
              Close
            </Button>
            <Button
              onClick={() => importSnippetAsset && copyImportSnippet(importSnippetAsset)}
              data-testid="button-copy-snippet"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}