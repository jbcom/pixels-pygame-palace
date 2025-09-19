import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Eye, EyeOff, Lock, Unlock, Layers, ChevronUp, ChevronDown,
  Plus, Trash2, Edit2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@shared/schema';

interface LayersPanelProps {
  entities: Entity[];
  selectedEntities: string[];
  onSelectEntity: (entityId: string, multiSelect: boolean) => void;
  onUpdateEntity: (entityId: string, updates: Partial<Entity>) => void;
  onDeleteEntity: (entityId: string) => void;
  className?: string;
}

interface LayerGroup {
  layer: number;
  entities: Entity[];
  visible: boolean;
  locked: boolean;
}

export default function LayersPanel({
  entities,
  selectedEntities,
  onSelectEntity,
  onUpdateEntity,
  onDeleteEntity,
  className
}: LayersPanelProps) {
  const [collapsedLayers, setCollapsedLayers] = useState<Set<number>>(new Set());
  const [hiddenLayers, setHiddenLayers] = useState<Set<number>>(new Set());
  const [lockedLayers, setLockedLayers] = useState<Set<number>>(new Set());

  // Group entities by layer
  const layerGroups = entities.reduce<Record<number, LayerGroup>>((groups, entity) => {
    const layer = entity.layer || 0;
    if (!groups[layer]) {
      groups[layer] = {
        layer,
        entities: [],
        visible: !hiddenLayers.has(layer),
        locked: lockedLayers.has(layer)
      };
    }
    groups[layer].entities.push(entity);
    return groups;
  }, {});

  // Sort layers (higher numbers on top)
  const sortedLayers = Object.values(layerGroups).sort((a, b) => b.layer - a.layer);

  const toggleLayerCollapse = useCallback((layer: number) => {
    setCollapsedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layer)) {
        newSet.delete(layer);
      } else {
        newSet.add(layer);
      }
      return newSet;
    });
  }, []);

  const toggleLayerVisibility = useCallback((layer: number) => {
    const isHidden = hiddenLayers.has(layer);
    
    setHiddenLayers(prev => {
      const newSet = new Set(prev);
      if (isHidden) {
        newSet.delete(layer);
      } else {
        newSet.add(layer);
      }
      return newSet;
    });

    // Update visibility for all entities in this layer
    entities.forEach(entity => {
      if ((entity.layer || 0) === layer) {
        onUpdateEntity(entity.id, { visible: isHidden });
      }
    });
  }, [entities, hiddenLayers, onUpdateEntity]);

  const toggleLayerLock = useCallback((layer: number) => {
    const isLocked = lockedLayers.has(layer);
    
    setLockedLayers(prev => {
      const newSet = new Set(prev);
      if (isLocked) {
        newSet.delete(layer);
      } else {
        newSet.add(layer);
      }
      return newSet;
    });

    // Update lock status for all entities in this layer
    entities.forEach(entity => {
      if ((entity.layer || 0) === layer) {
        onUpdateEntity(entity.id, { locked: !isLocked });
      }
    });
  }, [entities, lockedLayers, onUpdateEntity]);

  const moveEntityLayer = useCallback((entityId: string, direction: 'up' | 'down') => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;

    const currentLayer = entity.layer || 0;
    const newLayer = direction === 'up' ? currentLayer + 1 : Math.max(0, currentLayer - 1);
    
    onUpdateEntity(entityId, { layer: newLayer });
  }, [entities, onUpdateEntity]);

  const moveToLayer = useCallback((entityId: string, targetLayer: number) => {
    onUpdateEntity(entityId, { layer: targetLayer });
  }, [onUpdateEntity]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Layers
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // Add new layer (find the highest layer and add 1)
              const maxLayer = Math.max(...entities.map(e => e.layer || 0), 0);
              // This would typically open a dialog to create a new layer
            }}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-2">
          {sortedLayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No objects yet</p>
              <p className="text-xs mt-1">Add objects to see layers</p>
            </div>
          ) : (
            sortedLayers.map((layerGroup) => (
              <div key={layerGroup.layer} className="space-y-1">
                {/* Layer Header */}
                <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLayerCollapse(layerGroup.layer)}
                    className="h-6 w-6 p-0"
                  >
                    {collapsedLayers.has(layerGroup.layer) ? 
                      <ChevronDown className="h-3 w-3" /> : 
                      <ChevronUp className="h-3 w-3" />
                    }
                  </Button>
                  
                  <span className="flex-1 text-xs font-medium">
                    Layer {layerGroup.layer}
                  </span>
                  
                  <Badge variant="secondary" className="text-xs px-1">
                    {layerGroup.entities.length}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLayerVisibility(layerGroup.layer)}
                    className={cn(
                      "h-6 w-6 p-0",
                      hiddenLayers.has(layerGroup.layer) && "text-muted-foreground"
                    )}
                  >
                    {hiddenLayers.has(layerGroup.layer) ? 
                      <EyeOff className="h-3 w-3" /> : 
                      <Eye className="h-3 w-3" />
                    }
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLayerLock(layerGroup.layer)}
                    className={cn(
                      "h-6 w-6 p-0",
                      lockedLayers.has(layerGroup.layer) && "text-muted-foreground"
                    )}
                  >
                    {lockedLayers.has(layerGroup.layer) ? 
                      <Lock className="h-3 w-3" /> : 
                      <Unlock className="h-3 w-3" />
                    }
                  </Button>
                </div>

                {/* Layer Entities */}
                {!collapsedLayers.has(layerGroup.layer) && (
                  <div className="pl-4 space-y-1">
                    {layerGroup.entities.map((entity) => (
                      <div
                        key={entity.id}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors",
                          selectedEntities.includes(entity.id) ? 
                            "bg-primary/20" : "hover:bg-muted"
                        )}
                        onClick={(e) => onSelectEntity(entity.id, e.ctrlKey || e.metaKey)}
                      >
                        <span className="flex-1 text-xs truncate">
                          {entity.name}
                        </span>
                        
                        <span className="text-xs text-muted-foreground">
                          {entity.type}
                        </span>
                        
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateEntity(entity.id, { 
                                visible: entity.visible === false 
                              });
                            }}
                            className="h-5 w-5 p-0"
                          >
                            {entity.visible === false ? 
                              <EyeOff className="h-3 w-3" /> : 
                              <Eye className="h-3 w-3" />
                            }
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateEntity(entity.id, { 
                                locked: !entity.locked 
                              });
                            }}
                            className="h-5 w-5 p-0"
                          >
                            {entity.locked ? 
                              <Lock className="h-3 w-3" /> : 
                              <Unlock className="h-3 w-3" />
                            }
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </ScrollArea>

      {/* Layer Actions */}
      {selectedEntities.length > 0 && (
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                selectedEntities.forEach(id => moveEntityLayer(id, 'up'));
              }}
              className="flex-1"
            >
              <ChevronUp className="h-3 w-3 mr-1" />
              Move Up
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                selectedEntities.forEach(id => moveEntityLayer(id, 'down'));
              }}
              className="flex-1"
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Move Down
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            {selectedEntities.length} object{selectedEntities.length > 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}