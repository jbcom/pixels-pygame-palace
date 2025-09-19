import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import type { Entity, Scene, GameConfig, AssetMetadata } from '@shared/schema';

interface EnhancedGameCanvasProps {
  scene: Scene | null;
  entities: Entity[];
  selectedEntities: string[];
  onSelectEntity: (entityId: string, multiSelect: boolean) => void;
  onUpdateEntity: (entityId: string, updates: Partial<Entity>) => void;
  onAddEntity: (entity: Entity) => void;
  onDeleteEntity: (entityId: string) => void;
  selectedTool: 'select' | 'move' | 'rotate' | 'scale' | 'duplicate' | 'delete' | 'pan' | 'zoom';
  showGrid?: boolean;
  showRulers?: boolean;
  showGuides?: boolean;
  gridSnap?: boolean;
  zoom?: number;
  panOffset?: { x: number; y: number };
  isPlaying?: boolean;
  className?: string;
}

interface TransformHandle {
  type: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
  cursor: string;
  position: { x: number; y: number };
}

export default function EnhancedGameCanvas({
  scene,
  entities,
  selectedEntities,
  onSelectEntity,
  onUpdateEntity,
  onAddEntity,
  onDeleteEntity,
  selectedTool,
  showGrid = true,
  showRulers = false,
  showGuides = false,
  gridSnap = true,
  zoom = 1,
  panOffset = { x: 0, y: 0 },
  isPlaying = false,
  className
}: EnhancedGameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [activeHandle, setActiveHandle] = useState<TransformHandle | null>(null);

  const gridSize = scene?.gridSize || 20;

  // Calculate selection bounds for multi-select
  const selectionBounds = useMemo(() => {
    if (selectedEntities.length === 0) return null;
    
    const selectedEnts = entities.filter(e => selectedEntities.includes(e.id));
    if (selectedEnts.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    selectedEnts.forEach(entity => {
      minX = Math.min(minX, entity.position.x);
      minY = Math.min(minY, entity.position.y);
      maxX = Math.max(maxX, entity.position.x + (entity.size?.width || 0));
      maxY = Math.max(maxY, entity.position.y + (entity.size?.height || 0));
    });

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [selectedEntities, entities]);

  // Transform handles for selected objects
  const transformHandles = useMemo((): TransformHandle[] => {
    if (!selectionBounds || selectedEntities.length === 0) return [];
    
    const { x, y, width, height } = selectionBounds;
    const handleSize = 8;
    
    return [
      { type: 'nw', cursor: 'nw-resize', position: { x: x - handleSize/2, y: y - handleSize/2 } },
      { type: 'n', cursor: 'n-resize', position: { x: x + width/2 - handleSize/2, y: y - handleSize/2 } },
      { type: 'ne', cursor: 'ne-resize', position: { x: x + width - handleSize/2, y: y - handleSize/2 } },
      { type: 'e', cursor: 'e-resize', position: { x: x + width - handleSize/2, y: y + height/2 - handleSize/2 } },
      { type: 'se', cursor: 'se-resize', position: { x: x + width - handleSize/2, y: y + height - handleSize/2 } },
      { type: 's', cursor: 's-resize', position: { x: x + width/2 - handleSize/2, y: y + height - handleSize/2 } },
      { type: 'sw', cursor: 'sw-resize', position: { x: x - handleSize/2, y: y + height - handleSize/2 } },
      { type: 'w', cursor: 'w-resize', position: { x: x - handleSize/2, y: y + height/2 - handleSize/2 } },
      { type: 'rotate', cursor: 'grab', position: { x: x + width/2 - handleSize/2, y: y - 30 - handleSize/2 } },
    ];
  }, [selectionBounds, selectedEntities]);

  // Setup drop zone for assets
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'asset',
    drop: (item: AssetMetadata, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        let x = (offset.x - rect.left - panOffset.x) / zoom;
        let y = (offset.y - rect.top - panOffset.y) / zoom;
        
        // Apply grid snapping if enabled
        if (gridSnap) {
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
        }
        
        // Create new entity from asset
        const newEntity: Entity = {
          id: `entity-${Date.now()}`,
          type: 'decoration',
          name: item.name,
          position: { x, y },
          size: { width: 64, height: 64 },
          sprite: item.path,
          assetPath: item.path,
          properties: {},
          layer: 0,
          visible: true
        };
        
        onAddEntity(newEntity);
        onSelectEntity(newEntity.id, false);
      }
    },
    canDrop: () => !isPlaying,
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [gridSnap, gridSize, isPlaying, zoom, panOffset, onAddEntity, onSelectEntity]);

  // Handle mouse down for selection and dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPlaying || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;
    
    // Check if clicking on an entity
    const clickedEntity = entities.find(entity => {
      if (!entity.visible || entity.locked) return false;
      return x >= entity.position.x && 
             x <= entity.position.x + (entity.size?.width || 0) &&
             y >= entity.position.y && 
             y <= entity.position.y + (entity.size?.height || 0);
    });
    
    if (clickedEntity) {
      onSelectEntity(clickedEntity.id, e.ctrlKey || e.metaKey || e.shiftKey);
      
      if (selectedTool === 'move') {
        setDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    } else {
      // Start selection box
      if (selectedTool === 'select') {
        setSelectionBox({ x, y, width: 0, height: 0 });
        setDragStart({ x, y });
      } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Clear selection
        onSelectEntity('', false);
      }
    }
  }, [entities, selectedTool, isPlaying, zoom, panOffset, onSelectEntity]);

  // Handle mouse move for dragging and selection box
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPlaying || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;
    
    // Update selection box
    if (selectionBox && selectedTool === 'select') {
      setSelectionBox({
        x: Math.min(x, dragStart.x),
        y: Math.min(y, dragStart.y),
        width: Math.abs(x - dragStart.x),
        height: Math.abs(y - dragStart.y)
      });
    }
    
    // Move selected entities
    if (dragging && selectedEntities.length > 0 && selectedTool === 'move') {
      const deltaX = (e.clientX - dragStart.x) / zoom;
      const deltaY = (e.clientY - dragStart.y) / zoom;
      
      selectedEntities.forEach(entityId => {
        const entity = entities.find(e => e.id === entityId);
        if (entity && !entity.locked) {
          let newX = entity.position.x + deltaX;
          let newY = entity.position.y + deltaY;
          
          if (gridSnap) {
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;
          }
          
          onUpdateEntity(entityId, { position: { x: newX, y: newY } });
        }
      });
      
      setDragStart({ x: e.clientX, y: e.clientY });
    }
    
    // Check hover state
    const hoveredEntity = entities.find(entity => {
      if (!entity.visible) return false;
      return x >= entity.position.x && 
             x <= entity.position.x + (entity.size?.width || 0) &&
             y >= entity.position.y && 
             y <= entity.position.y + (entity.size?.height || 0);
    });
    
    setHoveredEntity(hoveredEntity?.id || null);
  }, [selectionBox, dragging, dragStart, selectedEntities, entities, selectedTool, isPlaying, gridSnap, gridSize, zoom, panOffset, onUpdateEntity]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (selectionBox && selectedTool === 'select') {
      // Select entities within selection box
      const selected = entities.filter(entity => {
        if (!entity.visible || entity.locked) return false;
        const entityRight = entity.position.x + (entity.size?.width || 0);
        const entityBottom = entity.position.y + (entity.size?.height || 0);
        const boxRight = selectionBox.x + selectionBox.width;
        const boxBottom = selectionBox.y + selectionBox.height;
        
        return !(entityRight < selectionBox.x || 
                entity.position.x > boxRight ||
                entityBottom < selectionBox.y || 
                entity.position.y > boxBottom);
      });
      
      selected.forEach((entity, index) => {
        onSelectEntity(entity.id, index > 0);
      });
    }
    
    setDragging(false);
    setSelectionBox(null);
    setActiveHandle(null);
  }, [selectionBox, entities, selectedTool, onSelectEntity]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPlaying) return;
      
      // Delete selected entities
      if (e.key === 'Delete' && selectedEntities.length > 0) {
        selectedEntities.forEach(id => onDeleteEntity(id));
      }
      
      // Duplicate selected entities
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && selectedEntities.length > 0) {
        e.preventDefault();
        selectedEntities.forEach(id => {
          const entity = entities.find(e => e.id === id);
          if (entity) {
            const newEntity: Entity = {
              ...entity,
              id: `entity-${Date.now()}-${Math.random()}`,
              position: {
                x: entity.position.x + 20,
                y: entity.position.y + 20
              }
            };
            onAddEntity(newEntity);
          }
        });
      }
      
      // Select all
      if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        entities.forEach((entity, index) => {
          if (entity.visible && !entity.locked) {
            onSelectEntity(entity.id, index > 0);
          }
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntities, entities, isPlaying, onDeleteEntity, onAddEntity, onSelectEntity]);

  // Connect drop ref
  useEffect(() => {
    if (viewportRef.current) {
      drop(viewportRef);
    }
  }, [drop]);

  return (
    <div
      ref={viewportRef}
      className={cn(
        "relative w-full h-full overflow-hidden bg-muted/20",
        className
      )}
    >
      {/* Rulers */}
      {showRulers && !isPlaying && (
        <>
          {/* Top ruler */}
          <div className="absolute top-0 left-8 right-0 h-8 bg-background border-b flex items-end">
            {Array.from({ length: Math.ceil((scene?.width || 800) / 50) }, (_, i) => (
              <div key={i} className="relative" style={{ width: 50 * zoom }}>
                <span className="absolute bottom-1 left-1 text-xs text-muted-foreground">
                  {i * 50}
                </span>
              </div>
            ))}
          </div>
          
          {/* Left ruler */}
          <div className="absolute top-8 left-0 bottom-0 w-8 bg-background border-r flex flex-col">
            {Array.from({ length: Math.ceil((scene?.height || 600) / 50) }, (_, i) => (
              <div key={i} className="relative" style={{ height: 50 * zoom }}>
                <span className="absolute top-1 left-1 text-xs text-muted-foreground">
                  {i * 50}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={cn(
          "relative bg-background",
          showRulers && "ml-8 mt-8",
          isOver && canDrop && "ring-2 ring-primary ring-offset-2"
        )}
        style={{
          width: scene?.width || 800,
          height: scene?.height || 600,
          transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: 'top left',
          backgroundColor: scene?.backgroundColor || '#f0f0f0',
          backgroundImage: showGrid && !isPlaying ? 
            `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)` : 
            undefined,
          backgroundSize: showGrid && !isPlaying ? `${gridSize}px ${gridSize}px` : undefined,
          cursor: selectedTool === 'pan' ? 'grab' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Render entities sorted by layer */}
        {entities
          .filter(e => e.visible !== false)
          .sort((a, b) => (a.layer || 0) - (b.layer || 0))
          .map(entity => {
            const isSelected = selectedEntities.includes(entity.id);
            const isHovered = hoveredEntity === entity.id;
            const rotation = entity.rotation || 0;
            const scale = entity.scale || { x: 1, y: 1 };
            
            return (
              <div
                key={entity.id}
                className={cn(
                  "absolute transition-shadow",
                  isSelected && "ring-2 ring-primary shadow-lg",
                  isHovered && !isSelected && "ring-1 ring-primary/50",
                  entity.locked && "opacity-50 pointer-events-none"
                )}
                style={{
                  left: entity.position.x,
                  top: entity.position.y,
                  width: entity.size?.width || 64,
                  height: entity.size?.height || 64,
                  transform: `rotate(${rotation}deg) scale(${scale.x}, ${scale.y})`,
                  transformOrigin: 'center',
                  zIndex: entity.layer || 0,
                  cursor: isPlaying ? 'default' : 'move'
                }}
                data-testid={`entity-${entity.id}`}
              >
                {entity.sprite || entity.assetPath ? (
                  <img
                    src={entity.sprite || entity.assetPath}
                    alt={entity.name}
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                  />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center",
                    "bg-primary/10 border-2 border-primary/30 rounded"
                  )}>
                    <span className="text-xs font-medium text-center px-1">
                      {entity.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        
        {/* Selection box */}
        {selectionBox && (
          <div
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height
            }}
          />
        )}
        
        {/* Transform handles */}
        {!isPlaying && selectionBounds && selectedEntities.length > 0 && selectedTool !== 'pan' && (
          <>
            {/* Selection outline */}
            <div
              className="absolute border-2 border-primary border-dashed pointer-events-none"
              style={{
                left: selectionBounds.x,
                top: selectionBounds.y,
                width: selectionBounds.width,
                height: selectionBounds.height
              }}
            />
            
            {/* Transform handles */}
            {transformHandles.map((handle) => (
              <div
                key={handle.type}
                className={cn(
                  "absolute w-2 h-2 bg-primary border border-background",
                  handle.type === 'rotate' ? "rounded-full" : "rounded-sm"
                )}
                style={{
                  left: handle.position.x,
                  top: handle.position.y,
                  cursor: handle.cursor
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveHandle(handle);
                }}
              />
            ))}
          </>
        )}
        
        {/* Guides */}
        {showGuides && !isPlaying && selectedEntities.length > 0 && selectionBounds && (
          <>
            {/* Center guides */}
            <div
              className="absolute w-px bg-primary/30 pointer-events-none"
              style={{
                left: selectionBounds.x + selectionBounds.width / 2,
                top: 0,
                height: '100%'
              }}
            />
            <div
              className="absolute h-px bg-primary/30 pointer-events-none"
              style={{
                top: selectionBounds.y + selectionBounds.height / 2,
                left: 0,
                width: '100%'
              }}
            />
          </>
        )}
        
        {/* Drop indicator */}
        {isOver && canDrop && (
          <div className="absolute inset-0 bg-primary/5 pointer-events-none flex items-center justify-center">
            <div className="bg-background/90 rounded-lg p-4 shadow-lg">
              <p className="text-sm font-medium">Drop asset here</p>
            </div>
          </div>
        )}
        
        {/* Play mode indicator */}
        {isPlaying && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/90 rounded-lg px-3 py-1 shadow-lg">
            <p className="text-sm font-medium text-primary animate-pulse">Game Running</p>
          </div>
        )}
      </div>
    </div>
  );
}