import { useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Search, Image, Volume2, Music, Box, Star, Filter,
  Grid3x3, List, Heart, Package, User, Bug, Shield,
  Trees, Building, Car, Gem, Flag, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetMetadata } from '@shared/schema';

// Mock asset catalogs for demonstration
const catalog2D = {
  tiles: [
    { id: "tile_grass", name: "Grass Tile", path: "placeholder.png", category: "terrain", type: "2d-sprite" },
    { id: "tile_dirt", name: "Dirt Tile", path: "placeholder.png", category: "terrain", type: "2d-sprite" },
    { id: "tile_stone", name: "Stone Tile", path: "placeholder.png", category: "terrain", type: "2d-sprite" },
    { id: "tile_water", name: "Water Tile", path: "placeholder.png", category: "terrain", type: "2d-sprite" },
  ],
  characters: [
    { id: "char_player", name: "Player", path: "placeholder.png", category: "characters", type: "2d-sprite" },
    { id: "char_enemy", name: "Enemy", path: "placeholder.png", category: "enemies", type: "2d-sprite" },
    { id: "char_npc", name: "NPC", path: "placeholder.png", category: "characters", type: "2d-sprite" },
  ],
  objects: [
    { id: "obj_coin", name: "Coin", path: "placeholder.png", category: "items", type: "2d-sprite" },
    { id: "obj_heart", name: "Heart", path: "placeholder.png", category: "items", type: "2d-sprite" },
    { id: "obj_star", name: "Star", path: "placeholder.png", category: "items", type: "2d-sprite" },
    { id: "obj_key", name: "Key", path: "placeholder.png", category: "items", type: "2d-sprite" },
  ],
};

const catalog3D = {
  models: [
    { id: "model_cube", name: "Cube", path: "placeholder.glb", category: "primitives", type: "3d-model" },
    { id: "model_sphere", name: "Sphere", path: "placeholder.glb", category: "primitives", type: "3d-model" },
    { id: "model_car", name: "Car", path: "placeholder.glb", category: "vehicles", type: "3d-model" },
    { id: "model_tree", name: "Tree", path: "placeholder.glb", category: "nature", type: "3d-model" },
  ],
};

const catalogUI = {
  buttons: [
    { id: "ui_button_play", name: "Play Button", path: "placeholder.png", category: "ui", type: "ui-element" },
    { id: "ui_button_pause", name: "Pause Button", path: "placeholder.png", category: "ui", type: "ui-element" },
  ],
  panels: [
    { id: "ui_panel", name: "Panel", path: "placeholder.png", category: "ui", type: "ui-element" },
    { id: "ui_dialog", name: "Dialog Box", path: "placeholder.png", category: "ui", type: "ui-element" },
  ],
};

interface EnhancedAssetLibraryProps {
  onAssetDrop?: (asset: AssetMetadata, position: { x: number; y: number }) => void;
  className?: string;
}

const categoryIcons: Record<string, any> = {
  platformer: User,
  rpg: Shield,
  racing: Car,
  puzzle: Grid3x3,
  space: Star,
  nature: Trees,
  buildings: Building,
  vehicles: Car,
  characters: User,
  enemies: Bug,
  items: Gem,
  tiles: Grid3x3,
  ui: Package,
};

function AssetCard({ asset, viewMode }: { asset: AssetMetadata; viewMode: 'grid' | 'list' }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'asset',
    item: asset,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const IconComponent = categoryIcons[asset.category] || Box;

  if (viewMode === 'list') {
    return (
      <div
        ref={drag}
        className={cn(
          "flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-move transition-all",
          isDragging && "opacity-50"
        )}
        data-testid={`asset-${asset.id}`}
      >
        {asset.thumbnail ? (
          <img 
            src={asset.thumbnail} 
            alt={asset.name}
            className="w-10 h-10 object-contain rounded"
          />
        ) : (
          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
            <IconComponent className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{asset.name}</p>
          <p className="text-xs text-muted-foreground">
            {asset.type} • {asset.category}
          </p>
        </div>
        {asset.favorite && (
          <Heart className="h-4 w-4 text-red-500 fill-red-500" />
        )}
      </div>
    );
  }

  return (
    <div
      ref={drag}
      className={cn(
        "cursor-move transition-all",
        isDragging && "opacity-50"
      )}
      data-testid={`asset-${asset.id}`}
    >
      <Card className={cn(
        "hover:shadow-lg transition-all hover:scale-105",
        isDragging && "ring-2 ring-primary"
      )}>
        <CardContent className="p-3">
          {asset.thumbnail ? (
            <img 
              src={asset.thumbnail} 
              alt={asset.name}
              className="w-full h-24 object-contain mb-2"
            />
          ) : (
            <div className="w-full h-24 bg-muted rounded mb-2 flex items-center justify-center">
              <IconComponent className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <p className="text-xs font-medium truncate">{asset.name}</p>
          <div className="flex items-center justify-between mt-1">
            <Badge variant="secondary" className="text-xs px-1">
              {asset.type}
            </Badge>
            {asset.favorite && (
              <Heart className="h-3 w-3 text-red-500 fill-red-500" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EnhancedAssetLibrary({ 
  onAssetDrop,
  className 
}: EnhancedAssetLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('2d');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFavorites, setShowFavorites] = useState(false);
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load and process assets from catalogs
  useEffect(() => {
    const loadAssets = () => {
      const loadedAssets: AssetMetadata[] = [];
      
      // Load 2D assets
      if (catalog2D && typeof catalog2D === 'object') {
        const catalog = catalog2D as any;
        if (catalog.categories) {
          Object.entries(catalog.categories).forEach(([category, catData]: [string, any]) => {
            if (catData.subcategories) {
              Object.entries(catData.subcategories).forEach(([subcat, items]: [string, any]) => {
                if (Array.isArray(items)) {
                  items.forEach((item: any) => {
                    loadedAssets.push({
                      id: `2d-${category}-${item.filename}`,
                      name: item.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                      path: item.path,
                      type: 'sprite',
                      category: category,
                      tags: [category, subcat, item.suggested_usage].filter(Boolean),
                      thumbnail: item.path,
                      dimensions: item.dimensions,
                      format: 'png',
                      favorite: false
                    });
                  });
                }
              });
            }
          });
        }
      }

      // Load 3D assets
      if (catalog3D && typeof catalog3D === 'object') {
        const catalog = catalog3D as any;
        if (catalog.models && Array.isArray(catalog.models)) {
          catalog.models.forEach((model: any) => {
            loadedAssets.push({
              id: `3d-${model.filename}`,
              name: model.name,
              path: model.file_path,
              type: 'model',
              category: model.category,
              tags: model.tags || [],
              thumbnail: undefined, // 3D models might not have thumbnails
              format: model.format,
              size: model.size_kb,
              favorite: false
            });
          });
        }
      }

      // Load UI assets
      if (catalogUI && typeof catalogUI === 'object') {
        const catalog = catalogUI as any;
        if (catalog.ui_assets) {
          Object.entries(catalog.ui_assets).forEach(([category, catData]: [string, any]) => {
            if (catData.categories && Array.isArray(catData.categories)) {
              catData.categories.forEach((cat: any) => {
                if (cat.files && Array.isArray(cat.files)) {
                  cat.files.forEach((file: string) => {
                    loadedAssets.push({
                      id: `ui-${file}`,
                      name: file.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                      path: `/assets/ui/${file}`,
                      type: 'sprite',
                      category: 'ui',
                      tags: [category, cat.name],
                      thumbnail: `/assets/ui/${file}`,
                      format: 'png',
                      favorite: false
                    });
                  });
                }
              });
            }
          });
        }
      }

      setAssets(loadedAssets);
    };

    loadAssets();
  }, []);

  const toggleFavorite = (assetId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(assetId)) {
        newFavorites.delete(assetId);
      } else {
        newFavorites.add(assetId);
      }
      return newFavorites;
    });
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory;
    const matchesType = selectedType === 'all' || 
                       (selectedType === '2d' && asset.type === 'sprite') ||
                       (selectedType === '3d' && asset.type === 'model') ||
                       (selectedType === 'audio' && (asset.type === 'sound' || asset.type === 'music'));
    const matchesFavorites = !showFavorites || favorites.has(asset.id);
    
    return matchesSearch && matchesCategory && matchesType && matchesFavorites;
  });

  // Get unique categories from assets
  const categories = Array.from(new Set(assets.map(a => a.category))).sort();

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Asset Library</h3>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={showFavorites ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowFavorites(!showFavorites)}
              className="h-8 w-8 p-0"
            >
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
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

        <div className="flex gap-2">
          <select
            className="flex-1 h-8 px-2 text-sm border rounded-md bg-background"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="2d">2D Sprites</option>
            <option value="3d">3D Models</option>
            <option value="audio">Audio</option>
          </select>
          
          <select
            className="flex-1 h-8 px-2 text-sm border rounded-md bg-background"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredAssets.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No assets found</p>
                <p className="text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filteredAssets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={{ ...asset, favorite: favorites.has(asset.id) }}
                  viewMode={viewMode}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAssets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No assets found</p>
                <p className="text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filteredAssets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={{ ...asset, favorite: favorites.has(asset.id) }}
                  viewMode={viewMode}
                />
              ))
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t bg-muted/50">
        <p className="text-xs text-center text-muted-foreground">
          {filteredAssets.length} assets • Drag to canvas to add
        </p>
      </div>
    </div>
  );
}