import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Settings, Move, Maximize2, RotateCw, Eye, Lock,
  Layers, Box, Zap, Image, Type, Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity, CollisionShape, PhysicsProperties } from '@shared/schema';

interface PropertiesPanelProps {
  selectedEntities: Entity[];
  onUpdateEntity: (entityId: string, updates: Partial<Entity>) => void;
  onDeleteEntity: (entityId: string) => void;
  className?: string;
}

export default function PropertiesPanel({
  selectedEntities,
  onUpdateEntity,
  onDeleteEntity,
  className
}: PropertiesPanelProps) {
  const [localValues, setLocalValues] = useState<Partial<Entity>>({});
  
  // Get the primary selected entity (first one)
  const entity = selectedEntities[0];
  const hasMultipleSelection = selectedEntities.length > 1;

  useEffect(() => {
    if (entity) {
      setLocalValues({
        name: entity.name,
        position: entity.position,
        size: entity.size,
        rotation: entity.rotation || 0,
        scale: entity.scale || { x: 1, y: 1 },
        visible: entity.visible !== false,
        locked: entity.locked || false,
        layer: entity.layer || 0,
      });
    }
  }, [entity]);

  const handleUpdateValue = (field: keyof Entity, value: any) => {
    setLocalValues(prev => ({ ...prev, [field]: value }));
    
    // Update all selected entities
    selectedEntities.forEach(e => {
      onUpdateEntity(e.id, { [field]: value });
    });
  };

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    const newPosition = { ...localValues.position!, [axis]: value };
    handleUpdateValue('position', newPosition);
  };

  const handleSizeChange = (dimension: 'width' | 'height', value: number) => {
    const newSize = { ...localValues.size!, [dimension]: value };
    handleUpdateValue('size', newSize);
  };

  const handleScaleChange = (axis: 'x' | 'y', value: number) => {
    const newScale = { ...localValues.scale!, [axis]: value };
    handleUpdateValue('scale', newScale);
  };

  const handlePhysicsChange = (property: keyof PhysicsProperties, value: any) => {
    const currentPhysics = entity?.physics || { enabled: false };
    const newPhysics = { ...currentPhysics, [property]: value };
    handleUpdateValue('physics', newPhysics);
  };

  if (selectedEntities.length === 0) {
    return (
      <div className={cn("flex flex-col h-full bg-background", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Properties
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Box className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No object selected</p>
            <p className="text-xs mt-1">Click an object to view its properties</p>
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Properties
          </div>
          {hasMultipleSelection && (
            <span className="text-xs text-muted-foreground">
              {selectedEntities.length} selected
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-4">
          {/* Basic Properties */}
          <div>
            <Label htmlFor="entity-name">Name</Label>
            <Input
              id="entity-name"
              value={localValues.name || ''}
              onChange={(e) => handleUpdateValue('name', e.target.value)}
              placeholder="Object name"
              data-testid="input-entity-name"
            />
          </div>

          <div>
            <Label>Type</Label>
            <Select
              value={entity?.type}
              onValueChange={(value) => handleUpdateValue('type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Player</SelectItem>
                <SelectItem value="enemy">Enemy</SelectItem>
                <SelectItem value="collectible">Collectible</SelectItem>
                <SelectItem value="platform">Platform</SelectItem>
                <SelectItem value="decoration">Decoration</SelectItem>
                <SelectItem value="trigger">Trigger</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Transform Properties */}
          <Accordion type="single" collapsible defaultValue="transform">
            <AccordionItem value="transform">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Move className="h-4 w-4" />
                  Transform
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {/* Position */}
                <div>
                  <Label className="text-xs">Position</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">X:</span>
                        <Input
                          type="number"
                          value={localValues.position?.x || 0}
                          onChange={(e) => handlePositionChange('x', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Y:</span>
                        <Input
                          type="number"
                          value={localValues.position?.y || 0}
                          onChange={(e) => handlePositionChange('y', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Size */}
                <div>
                  <Label className="text-xs">Size</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">W:</span>
                        <Input
                          type="number"
                          value={localValues.size?.width || 0}
                          onChange={(e) => handleSizeChange('width', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">H:</span>
                        <Input
                          type="number"
                          value={localValues.size?.height || 0}
                          onChange={(e) => handleSizeChange('height', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rotation */}
                <div>
                  <Label className="text-xs">Rotation (degrees)</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[localValues.rotation || 0]}
                      onValueChange={([value]) => handleUpdateValue('rotation', value)}
                      min={0}
                      max={360}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={localValues.rotation || 0}
                      onChange={(e) => handleUpdateValue('rotation', parseFloat(e.target.value) || 0)}
                      className="w-16 h-8"
                    />
                  </div>
                </div>

                {/* Scale */}
                <div>
                  <Label className="text-xs">Scale</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">X:</span>
                        <Input
                          type="number"
                          value={localValues.scale?.x || 1}
                          onChange={(e) => handleScaleChange('x', parseFloat(e.target.value) || 1)}
                          step="0.1"
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Y:</span>
                        <Input
                          type="number"
                          value={localValues.scale?.y || 1}
                          onChange={(e) => handleScaleChange('y', parseFloat(e.target.value) || 1)}
                          step="0.1"
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Appearance */}
            <AccordionItem value="appearance">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Appearance
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="visible" className="text-sm">Visible</Label>
                  <Switch
                    id="visible"
                    checked={localValues.visible !== false}
                    onCheckedChange={(checked) => handleUpdateValue('visible', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="locked" className="text-sm">Locked</Label>
                  <Switch
                    id="locked"
                    checked={localValues.locked || false}
                    onCheckedChange={(checked) => handleUpdateValue('locked', checked)}
                  />
                </div>

                <div>
                  <Label className="text-xs">Layer</Label>
                  <Input
                    type="number"
                    value={localValues.layer || 0}
                    onChange={(e) => handleUpdateValue('layer', parseInt(e.target.value) || 0)}
                    min="0"
                    max="10"
                    className="h-8"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Physics */}
            <AccordionItem value="physics">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Physics
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="physics-enabled" className="text-sm">Enable Physics</Label>
                  <Switch
                    id="physics-enabled"
                    checked={entity?.physics?.enabled || false}
                    onCheckedChange={(checked) => handlePhysicsChange('enabled', checked)}
                  />
                </div>

                {entity?.physics?.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="physics-static" className="text-sm">Static Body</Label>
                      <Switch
                        id="physics-static"
                        checked={entity?.physics?.static || false}
                        onCheckedChange={(checked) => handlePhysicsChange('static', checked)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Mass</Label>
                      <Slider
                        value={[entity?.physics?.mass || 1]}
                        onValueChange={([value]) => handlePhysicsChange('mass', value)}
                        min={0.1}
                        max={10}
                        step={0.1}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Friction</Label>
                      <Slider
                        value={[entity?.physics?.friction || 0.5]}
                        onValueChange={([value]) => handlePhysicsChange('friction', value)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Bounce</Label>
                      <Slider
                        value={[entity?.physics?.bounce || 0]}
                        onValueChange={([value]) => handlePhysicsChange('bounce', value)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Collision */}
            <AccordionItem value="collision">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Collision
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <Label className="text-xs">Shape</Label>
                  <Select
                    value={entity?.collisionShape?.type || 'auto'}
                    onValueChange={(value) => handleUpdateValue('collisionShape', { 
                      type: value as CollisionShape['type'] 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="rect">Rectangle</SelectItem>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="polygon">Polygon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                selectedEntities.forEach(e => onDeleteEntity(e.id));
              }}
              data-testid="button-delete-entity"
            >
              Delete {hasMultipleSelection ? 'Selected Objects' : 'Object'}
            </Button>
          </div>
        </CardContent>
      </ScrollArea>
    </div>
  );
}