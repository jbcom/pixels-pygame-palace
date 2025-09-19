import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  Download, ExternalLink, Search, Music, Volume2, 
  Type, Image, Box, Folder, Star, Info
} from 'lucide-react';
import { assetLibrary, assetCategories, generateAssetLoaderCode } from '@/lib/asset-library';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function AssetBrowser({ onAssetSelect }: { onAssetSelect?: (assetCode: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState('');
  const { toast } = useToast();

  // Filter assets based on search and category
  const filteredAssets = assetLibrary.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || asset.type === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleGenerateCode = (assetType: string) => {
    const code = generateAssetLoaderCode(assetType);
    if (onAssetSelect) {
      onAssetSelect(code);
      toast({
        title: "Asset Code Generated",
        description: `${assetType} loading code has been added to your project`,
      });
    }
    setSelectedAssetType(assetType);
    setShowCodeDialog(true);
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied to Clipboard",
      description: "Asset loading code copied successfully",
    });
  };

  const getAssetIcon = (type: string) => {
    switch(type) {
      case 'font': return <Type className="h-4 w-4" />;
      case 'sound': return <Volume2 className="h-4 w-4" />;
      case 'music': return <Music className="h-4 w-4" />;
      case 'sprite': 
      case 'tileset': return <Image className="h-4 w-4" />;
      case '3d-model': return <Box className="h-4 w-4" />;
      default: return <Folder className="h-4 w-4" />;
    }
  };

  const getLicenseBadgeColor = (license: string) => {
    if (license === 'CC0') return 'bg-green-500';
    if (license.includes('CC')) return 'bg-blue-500';
    if (license === 'OFL') return 'bg-purple-500';
    return 'bg-gray-500';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          CC0 Asset Library
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Free, legal assets you can use in your games
        </p>
        
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            data-testid="input-search-assets"
          />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-7 mx-4">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="font" data-testid="tab-fonts">Fonts</TabsTrigger>
          <TabsTrigger value="sound" data-testid="tab-sounds">Sounds</TabsTrigger>
          <TabsTrigger value="music" data-testid="tab-music">Music</TabsTrigger>
          <TabsTrigger value="sprite" data-testid="tab-sprites">Sprites</TabsTrigger>
          <TabsTrigger value="tileset" data-testid="tab-tilesets">Tiles</TabsTrigger>
          <TabsTrigger value="3d-model" data-testid="tab-3d">3D</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4">
          <div className="grid gap-3 py-4">
            {filteredAssets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No assets found matching your search
              </div>
            ) : (
              filteredAssets.map(asset => (
                <Card key={asset.id} className="hover:shadow-lg transition-all hover:scale-[1.02]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getAssetIcon(asset.type)}
                        <CardTitle className="text-base">{asset.name}</CardTitle>
                      </div>
                      <Badge className={`${getLicenseBadgeColor(asset.license)} text-white`}>
                        {asset.license}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      {asset.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {asset.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleGenerateCode(asset.type)}
                        data-testid={`button-use-${asset.id}`}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Use in Project
                      </Button>
                      {asset.url !== 'placeholder' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => window.open(asset.url, '_blank')}
                          data-testid={`button-view-${asset.id}`}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Source
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Source: {asset.source}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Quick action buttons */}
        <div className="p-4 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateCode('font')}
              data-testid="button-quick-fonts"
            >
              <Type className="h-4 w-4 mr-1" />
              Add Font Loader
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateCode('sound')}
              data-testid="button-quick-sounds"
            >
              <Volume2 className="h-4 w-4 mr-1" />
              Add Sound System
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateCode('sprite')}
              data-testid="button-quick-sprites"
            >
              <Image className="h-4 w-4 mr-1" />
              Add Sprite Loader
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleGenerateCode('3d')}
              data-testid="button-quick-3d"
            >
              <Box className="h-4 w-4 mr-1" />
              Add 3D Support
            </Button>
          </div>
        </div>
      </Tabs>

      {/* Code dialog */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Asset Loading Code</DialogTitle>
            <DialogDescription>
              Copy this code to use {selectedAssetType} assets in your game
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] rounded border p-4 bg-slate-950">
            <pre className="text-xs text-slate-200 font-mono">
              {generateAssetLoaderCode(selectedAssetType)}
            </pre>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button 
              onClick={() => copyToClipboard(generateAssetLoaderCode(selectedAssetType))}
              data-testid="button-copy-code"
            >
              Copy Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}