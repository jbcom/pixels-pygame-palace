import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Settings, Play, Pause, Zap,
  Move, RotateCw, Target, MousePointer, Timer,
  Layers, ArrowRight, ArrowUp, Repeat, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity, EntityBehavior, BehaviorTrigger } from '@shared/schema';

interface BehaviorEditorProps {
  entity: Entity | null;
  onUpdateEntity: (entityId: string, updates: Partial<Entity>) => void;
  className?: string;
}

const behaviorTypes = [
  { id: 'move', name: 'Move', icon: Move, description: 'Move in a direction' },
  { id: 'patrol', name: 'Patrol', icon: Repeat, description: 'Move back and forth' },
  { id: 'follow', name: 'Follow', icon: Target, description: 'Follow another object' },
  { id: 'rotate', name: 'Rotate', icon: RotateCw, description: 'Rotate continuously' },
  { id: 'bounce', name: 'Bounce', icon: ArrowUp, description: 'Bounce up and down' },
  { id: 'jump', name: 'Jump', icon: ArrowUp, description: 'Jump on trigger' },
  { id: 'shoot', name: 'Shoot', icon: Zap, description: 'Shoot projectiles' },
  { id: 'collect', name: 'Collect', icon: Shield, description: 'Collect items' },
  { id: 'spawn', name: 'Spawn', icon: Plus, description: 'Spawn objects' },
  { id: 'destroy', name: 'Destroy', icon: Trash2, description: 'Destroy on trigger' },
];

const triggerTypes = [
  { id: 'always', name: 'Always', icon: Play, description: 'Always active' },
  { id: 'onClick', name: 'On Click', icon: MousePointer, description: 'When clicked' },
  { id: 'onCollision', name: 'On Collision', icon: Target, description: 'When colliding' },
  { id: 'onKeyPress', name: 'On Key Press', icon: Layers, description: 'When key pressed' },
  { id: 'onTimer', name: 'On Timer', icon: Timer, description: 'After time delay' },
  { id: 'onEvent', name: 'On Event', icon: Zap, description: 'On custom event' },
];

export default function BehaviorEditor({
  entity,
  onUpdateEntity,
  className
}: BehaviorEditorProps) {
  const [showAddBehavior, setShowAddBehavior] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState<EntityBehavior | null>(null);
  const [newBehavior, setNewBehavior] = useState<Partial<EntityBehavior>>({
    type: 'move',
    trigger: { type: 'always' },
    parameters: {},
    enabled: true
  });

  const handleAddBehavior = useCallback(() => {
    if (!entity || !newBehavior.type) return;

    const behavior: EntityBehavior = {
      id: `behavior-${Date.now()}`,
      type: newBehavior.type as EntityBehavior['type'],
      trigger: newBehavior.trigger || { type: 'always' },
      parameters: newBehavior.parameters || {},
      enabled: true
    };

    // Add default parameters based on behavior type
    switch (behavior.type) {
      case 'move':
        behavior.parameters = { speed: 5, direction: 'right', ...behavior.parameters };
        break;
      case 'patrol':
        behavior.parameters = { speed: 3, distance: 100, ...behavior.parameters };
        break;
      case 'rotate':
        behavior.parameters = { speed: 90, clockwise: true, ...behavior.parameters };
        break;
      case 'jump':
        behavior.parameters = { power: 10, ...behavior.parameters };
        break;
      case 'shoot':
        behavior.parameters = { speed: 10, rate: 1, projectile: 'bullet', ...behavior.parameters };
        break;
      default:
        break;
    }

    const updatedBehaviors = [...(entity.behaviors || []), behavior];
    onUpdateEntity(entity.id, { behaviors: updatedBehaviors });
    
    setShowAddBehavior(false);
    setNewBehavior({
      type: 'move',
      trigger: { type: 'always' },
      parameters: {},
      enabled: true
    });
  }, [entity, newBehavior, onUpdateEntity]);

  const handleUpdateBehavior = useCallback((behaviorId: string, updates: Partial<EntityBehavior>) => {
    if (!entity) return;

    const updatedBehaviors = entity.behaviors?.map(b => 
      b.id === behaviorId ? { ...b, ...updates } : b
    ) || [];

    onUpdateEntity(entity.id, { behaviors: updatedBehaviors });
  }, [entity, onUpdateEntity]);

  const handleDeleteBehavior = useCallback((behaviorId: string) => {
    if (!entity) return;

    const updatedBehaviors = entity.behaviors?.filter(b => b.id !== behaviorId) || [];
    onUpdateEntity(entity.id, { behaviors: updatedBehaviors });
  }, [entity, onUpdateEntity]);

  const renderBehaviorParameters = (behavior: EntityBehavior) => {
    switch (behavior.type) {
      case 'move':
        return (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Speed</Label>
              <Input
                type="number"
                value={behavior.parameters.speed || 5}
                onChange={(e) => handleUpdateBehavior(behavior.id, {
                  parameters: { ...behavior.parameters, speed: parseFloat(e.target.value) }
                })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Direction</Label>
              <Select
                value={behavior.parameters.direction || 'right'}
                onValueChange={(value) => handleUpdateBehavior(behavior.id, {
                  parameters: { ...behavior.parameters, direction: value }
                })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Up</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'patrol':
        return (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Speed</Label>
              <Input
                type="number"
                value={behavior.parameters.speed || 3}
                onChange={(e) => handleUpdateBehavior(behavior.id, {
                  parameters: { ...behavior.parameters, speed: parseFloat(e.target.value) }
                })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Distance</Label>
              <Input
                type="number"
                value={behavior.parameters.distance || 100}
                onChange={(e) => handleUpdateBehavior(behavior.id, {
                  parameters: { ...behavior.parameters, distance: parseFloat(e.target.value) }
                })}
                className="h-8"
              />
            </div>
          </div>
        );

      case 'rotate':
        return (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Speed (deg/s)</Label>
              <Input
                type="number"
                value={behavior.parameters.speed || 90}
                onChange={(e) => handleUpdateBehavior(behavior.id, {
                  parameters: { ...behavior.parameters, speed: parseFloat(e.target.value) }
                })}
                className="h-8"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Clockwise</Label>
              <Switch
                checked={behavior.parameters.clockwise !== false}
                onCheckedChange={(checked) => handleUpdateBehavior(behavior.id, {
                  parameters: { ...behavior.parameters, clockwise: checked }
                })}
              />
            </div>
          </div>
        );

      case 'jump':
        return (
          <div>
            <Label className="text-xs">Jump Power</Label>
            <Input
              type="number"
              value={behavior.parameters.power || 10}
              onChange={(e) => handleUpdateBehavior(behavior.id, {
                parameters: { ...behavior.parameters, power: parseFloat(e.target.value) }
              })}
              className="h-8"
            />
          </div>
        );

      default:
        return (
          <p className="text-xs text-muted-foreground">
            No parameters for this behavior
          </p>
        );
    }
  };

  if (!entity) {
    return (
      <div className={cn("flex flex-col h-full bg-background", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Behaviors
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No object selected</p>
            <p className="text-xs mt-1">Select an object to edit behaviors</p>
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Behaviors
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowAddBehavior(true)}
            data-testid="button-add-behavior"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {entity.name} • {entity.behaviors?.length || 0} behaviors
        </p>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-3">
          {!entity.behaviors || entity.behaviors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No behaviors yet</p>
              <p className="text-xs mt-1">Add behaviors to make objects interactive</p>
            </div>
          ) : (
            entity.behaviors.map((behavior) => {
              const behaviorType = behaviorTypes.find(t => t.id === behavior.type);
              const Icon = behaviorType?.icon || Zap;
              
              return (
                <Card key={behavior.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{behaviorType?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {behavior.trigger?.type === 'always' ? 'Always active' : 
                             `On ${behavior.trigger?.type.replace('on', '')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={behavior.enabled !== false}
                          onCheckedChange={(checked) => handleUpdateBehavior(behavior.id, { enabled: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBehavior(behavior.id)}
                          className="h-8 w-8 p-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {renderBehaviorParameters(behavior)}
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </ScrollArea>

      {/* Add Behavior Dialog */}
      <Dialog open={showAddBehavior} onOpenChange={setShowAddBehavior}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Behavior</DialogTitle>
            <DialogDescription>
              Choose a behavior to add to {entity.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Behavior Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {behaviorTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Card
                      key={type.id}
                      className={cn(
                        "cursor-pointer transition-all",
                        newBehavior.type === type.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setNewBehavior({ ...newBehavior, type: type.id as EntityBehavior['type'] })}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{type.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {type.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Trigger</Label>
              <Select
                value={newBehavior.trigger?.type || 'always'}
                onValueChange={(value) => setNewBehavior({
                  ...newBehavior,
                  trigger: { type: value as BehaviorTrigger['type'] }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerTypes.map((trigger) => (
                    <SelectItem key={trigger.id} value={trigger.id}>
                      {trigger.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBehavior(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBehavior}>
              Add Behavior
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}