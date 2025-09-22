"""
Collision System - Handles collision detection and response.

Provides both broad-phase and narrow-phase collision detection,
with support for solid collisions and trigger events.
"""

import math
from typing import Set, Type, List, Tuple, Dict, Any, Optional

from ..core.system import System
from ..core.entity import Entity
from ..core.component import Component, TransformComponent, CollisionComponent
from ..core.event_bus import GameEvents


class CollisionPair:
    """Represents a collision between two entities."""
    
    def __init__(self, entity_a: Entity, entity_b: Entity, 
                 overlap_x: float = 0, overlap_y: float = 0):
        self.entity_a = entity_a
        self.entity_b = entity_b
        self.overlap_x = overlap_x
        self.overlap_y = overlap_y
        
        # Sort entities by ID for consistent collision pairs
        if entity_a.id > entity_b.id:
            self.entity_a, self.entity_b = entity_b, entity_a
            self.overlap_x = -overlap_x
            self.overlap_y = -overlap_y
    
    @property
    def pair_id(self) -> str:
        """Get unique identifier for this collision pair."""
        return f"{self.entity_a.id}_{self.entity_b.id}"
    
    def __eq__(self, other):
        return isinstance(other, CollisionPair) and self.pair_id == other.pair_id
    
    def __hash__(self):
        return hash(self.pair_id)


class CollisionSystem(System):
    """
    System for detecting and resolving collisions between entities.
    
    Supports both solid collisions (blocks movement) and trigger collisions
    (detect overlap without blocking). Uses spatial partitioning for performance.
    """
    
    def __init__(self, priority: int = 30, grid_size: int = 64):
        super().__init__(priority)
        self.grid_size = grid_size
        
        # Spatial partitioning grid for broad-phase collision detection
        self._spatial_grid: Dict[Tuple[int, int], List[Entity]] = {}
        
        # Track active collisions for enter/exit events
        self._active_collisions: Set[CollisionPair] = set()
        self._previous_collisions: Set[CollisionPair] = set()
        
        # Collision layers for filtering
        self.collision_matrix: Dict[str, Set[str]] = {
            'default': {'default', 'solid', 'player', 'enemy'},
            'player': {'solid', 'enemy', 'collectible', 'trigger'},
            'enemy': {'solid', 'player', 'projectile'},
            'projectile': {'solid', 'enemy', 'player'},
            'solid': {'default', 'player', 'enemy', 'projectile'},
            'collectible': {'player'},
            'trigger': {'player'}
        }
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return {TransformComponent, CollisionComponent}
    
    def update(self, entities, delta_time: float):
        """Update collision detection and response."""
        # Clear and rebuild spatial grid
        self._rebuild_spatial_grid(entities)
        
        # Store previous collisions
        self._previous_collisions = self._active_collisions.copy()
        self._active_collisions.clear()
        
        # Broad-phase: Find potential collision pairs
        potential_pairs = self._broad_phase_detection(entities)
        
        # Narrow-phase: Test actual collisions
        for entity_a, entity_b in potential_pairs:
            collision_data = self._narrow_phase_detection(entity_a, entity_b)
            
            if collision_data:
                collision_pair = CollisionPair(
                    entity_a, entity_b,
                    collision_data['overlap_x'],
                    collision_data['overlap_y']
                )
                
                self._active_collisions.add(collision_pair)
                
                # Handle collision response
                self._handle_collision(collision_pair, collision_data)
        
        # Publish collision events
        self._publish_collision_events()
    
    def _rebuild_spatial_grid(self, entities):
        """Rebuild spatial partitioning grid."""
        self._spatial_grid.clear()
        
        for entity in entities:
            transform = entity.get_component(TransformComponent)
            collision = entity.get_component(CollisionComponent)
            
            if not transform or not collision:
                continue
            
            # Calculate grid cells occupied by entity
            left = transform.x + collision.offset_x
            top = transform.y + collision.offset_y
            right = left + collision.width
            bottom = top + collision.height
            
            grid_left = int(left // self.grid_size)
            grid_top = int(top // self.grid_size)
            grid_right = int(right // self.grid_size)
            grid_bottom = int(bottom // self.grid_size)
            
            # Add entity to all occupied grid cells
            for gx in range(grid_left, grid_right + 1):
                for gy in range(grid_top, grid_bottom + 1):
                    grid_key = (gx, gy)
                    if grid_key not in self._spatial_grid:
                        self._spatial_grid[grid_key] = []
                    self._spatial_grid[grid_key].append(entity)
    
    def _broad_phase_detection(self, entities) -> List[Tuple[Entity, Entity]]:
        """Broad-phase collision detection using spatial grid."""
        potential_pairs = set()
        
        # Check each grid cell for entity pairs
        for grid_entities in self._spatial_grid.values():
            if len(grid_entities) < 2:
                continue
            
            # Test all pairs in this grid cell
            for i in range(len(grid_entities)):
                for j in range(i + 1, len(grid_entities)):
                    entity_a = grid_entities[i]
                    entity_b = grid_entities[j]
                    
                    # Check collision layer compatibility
                    if self._should_collide(entity_a, entity_b):
                        # Ensure consistent ordering
                        if entity_a.id > entity_b.id:
                            entity_a, entity_b = entity_b, entity_a
                        potential_pairs.add((entity_a, entity_b))
        
        return list(potential_pairs)
    
    def _should_collide(self, entity_a: Entity, entity_b: Entity) -> bool:
        """Check if two entities should collide based on layers."""
        collision_a = entity_a.get_component(CollisionComponent)
        collision_b = entity_b.get_component(CollisionComponent)
        
        if not collision_a or not collision_b:
            return False
        
        # Check if entities are on compatible collision layers
        # For now, use tags as layer identifiers
        layer_a = 'default'
        layer_b = 'default'
        
        if 'player' in entity_a.tags:
            layer_a = 'player'
        elif 'enemy' in entity_a.tags:
            layer_a = 'enemy'
        elif 'solid' in entity_a.tags:
            layer_a = 'solid'
        
        if 'player' in entity_b.tags:
            layer_b = 'player'
        elif 'enemy' in entity_b.tags:
            layer_b = 'enemy'
        elif 'solid' in entity_b.tags:
            layer_b = 'solid'
        
        return layer_b in self.collision_matrix.get(layer_a, set())
    
    def _narrow_phase_detection(self, entity_a: Entity, entity_b: Entity) -> Optional[Dict[str, Any]]:
        """Narrow-phase collision detection using AABB."""
        transform_a = entity_a.get_component(TransformComponent)
        collision_a = entity_a.get_component(CollisionComponent)
        transform_b = entity_b.get_component(TransformComponent)
        collision_b = entity_b.get_component(CollisionComponent)
        
        if not all([transform_a, collision_a, transform_b, collision_b]):
            return None
        
        # Calculate bounding boxes
        left_a = transform_a.x + collision_a.offset_x
        top_a = transform_a.y + collision_a.offset_y
        right_a = left_a + collision_a.width
        bottom_a = top_a + collision_a.height
        
        left_b = transform_b.x + collision_b.offset_x
        top_b = transform_b.y + collision_b.offset_y
        right_b = left_b + collision_b.width
        bottom_b = top_b + collision_b.height
        
        # Check for overlap
        if (left_a < right_b and right_a > left_b and 
            top_a < bottom_b and bottom_a > top_b):
            
            # Calculate overlap amounts
            overlap_x = min(right_a - left_b, right_b - left_a)
            overlap_y = min(bottom_a - top_b, bottom_b - top_a)
            
            return {
                'overlap_x': overlap_x,
                'overlap_y': overlap_y,
                'bounds_a': (left_a, top_a, right_a, bottom_a),
                'bounds_b': (left_b, top_b, right_b, bottom_b)
            }
        
        return None
    
    def _handle_collision(self, collision_pair: CollisionPair, collision_data: Dict[str, Any]):
        """Handle collision response between two entities."""
        entity_a = collision_pair.entity_a
        entity_b = collision_pair.entity_b
        
        collision_a = entity_a.get_component(CollisionComponent)
        collision_b = entity_b.get_component(CollisionComponent)
        
        # Handle trigger collisions (no physical response)
        if collision_a.trigger or collision_b.trigger:
            return
        
        # Handle solid collisions
        if collision_a.solid and collision_b.solid:
            self._resolve_solid_collision(collision_pair, collision_data)
    
    def _resolve_solid_collision(self, collision_pair: CollisionPair, collision_data: Dict[str, Any]):
        """Resolve solid collision by separating entities."""
        entity_a = collision_pair.entity_a
        entity_b = collision_pair.entity_b
        
        transform_a = entity_a.get_component(TransformComponent)
        transform_b = entity_b.get_component(TransformComponent)
        
        if not transform_a or not transform_b:
            return
        
        overlap_x = collision_data['overlap_x']
        overlap_y = collision_data['overlap_y']
        
        # Determine separation direction (separate along minimum overlap axis)
        if overlap_x < overlap_y:
            # Separate horizontally
            separation = overlap_x / 2
            if transform_a.x < transform_b.x:
                transform_a.x -= separation
                transform_b.x += separation
            else:
                transform_a.x += separation
                transform_b.x -= separation
        else:
            # Separate vertically
            separation = overlap_y / 2
            if transform_a.y < transform_b.y:
                transform_a.y -= separation
                transform_b.y += separation
            else:
                transform_a.y += separation
                transform_b.y -= separation
    
    def _publish_collision_events(self):
        """Publish collision enter/exit events."""
        if not self.world:
            return
        
        # Find new collisions (collision entered)
        new_collisions = self._active_collisions - self._previous_collisions
        for collision in new_collisions:
            self.world.event_bus.publish(
                GameEvents.COLLISION_STARTED,
                {
                    'entity_a_id': collision.entity_a.id,
                    'entity_b_id': collision.entity_b.id,
                    'overlap_x': collision.overlap_x,
                    'overlap_y': collision.overlap_y
                }
            )
        
        # Find ended collisions (collision exited)
        ended_collisions = self._previous_collisions - self._active_collisions
        for collision in ended_collisions:
            self.world.event_bus.publish(
                GameEvents.COLLISION_ENDED,
                {
                    'entity_a_id': collision.entity_a.id,
                    'entity_b_id': collision.entity_b.id
                }
            )
    
    def set_collision_layer(self, layer: str, collides_with: Set[str]):
        """Set which layers a collision layer collides with."""
        self.collision_matrix[layer] = collides_with.copy()
    
    def add_collision_pair(self, layer_a: str, layer_b: str):
        """Add collision between two layers."""
        if layer_a not in self.collision_matrix:
            self.collision_matrix[layer_a] = set()
        if layer_b not in self.collision_matrix:
            self.collision_matrix[layer_b] = set()
        
        self.collision_matrix[layer_a].add(layer_b)
        self.collision_matrix[layer_b].add(layer_a)
    
    def remove_collision_pair(self, layer_a: str, layer_b: str):
        """Remove collision between two layers."""
        if layer_a in self.collision_matrix:
            self.collision_matrix[layer_a].discard(layer_b)
        if layer_b in self.collision_matrix:
            self.collision_matrix[layer_b].discard(layer_a)
    
    def get_colliding_entities(self, entity: Entity) -> List[Entity]:
        """Get all entities currently colliding with the given entity."""
        colliding = []
        
        for collision in self._active_collisions:
            if collision.entity_a == entity:
                colliding.append(collision.entity_b)
            elif collision.entity_b == entity:
                colliding.append(collision.entity_a)
        
        return colliding