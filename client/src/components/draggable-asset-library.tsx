import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Search, Image, Volume2, Music, Box, Type,
  Sparkles, User, Bug, Gem, Flag, Heart, 
  Zap, Shield, Sword, Star, Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DraggableAsset {
  id: string;
  name: string;
  type: 'sprite' | 'sound' | 'music' | 'font' | 'effect' | 'entity';
  category: string;
  icon?: any;
  thumbnail?: string;
  defaultProperties?: Record<string, any>;
}

// Predefined entity assets that can be dragged onto the canvas
const entityAssets: DraggableAsset[] = [
  { 
    id: 'player', 
    name: 'Player', 
    type: 'entity', 
    category: 'character',
    icon: User,
    defaultProperties: {
      health: 100,
      speed: 5,
      jumpPower: 10
    }
  },
  { 
    id: 'enemy', 
    name: 'Enemy', 
    type: 'entity', 
    category: 'character',
    icon: Bug,
    defaultProperties: {
      health: 50,
      damage: 10,
      speed: 3
    }
  },
  { 
    id: 'collectible', 
    name: 'Collectible', 
    type: 'entity', 
    category: 'item',
    icon: Gem,
    defaultProperties: {
      points: 10,
      respawns: false
    }
  },
  { 
    id: 'checkpoint', 
    name: 'Checkpoint', 
    type: 'entity', 
    category: 'item',
    icon: Flag,
    defaultProperties: {
      saveProgress: true,
      activated: false
    }
  },
  { 
    id: 'powerup', 
    name: 'Power-up', 
    type: 'entity', 
    category: 'item',
    icon: Zap,
    defaultProperties: {
      effect: 'speed_boost',
      duration: 5
    }
  },
  { 
    id: 'health_pack', 
    name: 'Health Pack', 
    type: 'entity', 
    category: 'item',
    icon: Heart,
    defaultProperties: {
      healAmount: 25
    }
  },
  { 
    id: 'platform', 
    name: 'Platform', 
    type: 'entity', 
    category: 'terrain',
    icon: Package,
    defaultProperties: {
      solid: true,
      width: 100,
      height: 20
    }
  },
  { 
    id: 'weapon', 
    name: 'Weapon', 
    type: 'entity', 
    category: 'item',
    icon: Sword,
    defaultProperties: {
      damage: 25,
      fireRate: 2
    }
  },
  { 
    id: 'shield', 
    name: 'Shield', 
    type: 'entity', 
    category: 'item',
    icon: Shield,
    defaultProperties: {
      defense: 50,
      durability: 100
    }
  },
  { 
    id: 'decoration', 
    name: 'Decoration', 
    type: 'entity', 
    category: 'decoration',
    icon: Star,
    defaultProperties: {
      animated: false,
      layer: 'background'
    }
  }
];

// Media assets from the asset library
const mediaAssets: DraggableAsset[] = [
  { id: 'sprite-1', name: 'Character Sprite', type: 'sprite', category: 'graphics', icon: Image },
  { id: 'sound-1', name: 'Jump Sound', type: 'sound', category: 'audio', icon: Volume2 },
  { id: 'music-1', name: 'Background Music', type: 'music', category: 'audio', icon: Music },
  { id: 'effect-1', name: 'Particle Effect', type: 'effect', category: 'graphics', icon: Sparkles },
];

interface DraggableAssetCardProps {
  asset: DraggableAsset;
  onSelect?: (asset: DraggableAsset) => void;
}

function DraggableAssetCard({ asset, onSelect }: DraggableAssetCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'asset',
    item: asset,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const IconComponent = asset.icon || Box;

  return (
    <div
      ref={drag}
      className={cn(
        "cursor-move transition-all",
        isDragging && "opacity-50"
      )}
      data-testid={`draggable-asset-${asset.id}`}
    >
      <Card 
        className={cn(
          "hover:shadow-md transition-all hover:scale-105",
          isDragging && "ring-2 ring-primary"
        )}
        onClick={() => onSelect?.(asset)}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-md",
              asset.type === 'entity' ? "bg-primary/10" : "bg-muted"
            )}>
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{asset.name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {asset.category}
              </p>
            </div>
            {asset.type === 'entity' && (
              <Badge variant="secondary" className="text-xs">
                Entity
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DraggableAssetLibraryProps {
  onAssetSelect?: (asset: DraggableAsset) => void;
  className?: string;
}

export default function DraggableAssetLibrary({ 
  onAssetSelect,
  className 
}: DraggableAssetLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const allAssets = [...entityAssets, ...mediaAssets];

  const filteredAssets = allAssets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'entities' && asset.type === 'entity') ||
                           (selectedCategory === 'media' && asset.type !== 'entity') ||
                           asset.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold mb-2">Asset Library</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Drag assets onto the canvas
        </p>
        
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            data-testid="input-search-draggable-assets"
          />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
        <TabsList className="mx-4 grid grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="character">Characters</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4">
          <div className="grid grid-cols-2 gap-3 py-4">
            {filteredAssets.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                No assets found
              </div>
            ) : (
              filteredAssets.map(asset => (
                <DraggableAssetCard
                  key={asset.id}
                  asset={asset}
                  onSelect={onAssetSelect}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </Tabs>

      {/* Drop zone hint */}
      <div className="p-4 border-t bg-muted/50">
        <p className="text-xs text-muted-foreground text-center">
          <Package className="h-3 w-3 inline mr-1" />
          Drag assets to the canvas or double-click to add
        </p>
      </div>
    </div>
  );
}

export type { DraggableAssetLibraryProps };