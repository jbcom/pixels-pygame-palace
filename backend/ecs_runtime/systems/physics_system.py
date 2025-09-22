"""
Physics Systems - Handle movement, gravity, and physics simulation.

Includes both general physics and specialized platformer physics systems.
"""

import math
from typing import Set, Type, Dict, Any

from ..core.system import System
from ..core.entity import Entity
from ..core.component import Component, TransformComponent, VelocityComponent
from ..core.event_bus import GameEvents


class PhysicsSystem(System):
    """
    General physics system for movement and basic physics simulation.
    
    Handles velocity integration, drag, and basic physics constraints.
    """
    
    def __init__(self, priority: int = 20, gravity: float = 0, 
                 max_velocity: float = 1000, enable_drag: bool = True):
        super().__init__(priority)
        self.gravity = gravity  # pixels/second^2
        self.max_velocity = max_velocity
        self.enable_drag = enable_drag
        
        # Physics configuration
        self.air_friction = 0.98
        self.ground_friction = 0.85
        self.bounce_damping = 0.7
        
        # World bounds (optional)
        self.world_bounds = None  # (left, top, right, bottom)
        self.wrap_around = False
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return {TransformComponent, VelocityComponent}
    
    def update(self, entities, delta_time: float):
        """Update physics for all entities."""
        for entity in entities:
            transform = entity.get_component(TransformComponent)
            velocity = entity.get_component(VelocityComponent)
            
            if transform and velocity:
                self._update_entity_physics(entity, transform, velocity, delta_time)
    
    def _update_entity_physics(self, entity: Entity, transform: TransformComponent, 
                              velocity: VelocityComponent, delta_time: float):
        """Update physics for a single entity."""
        # Apply gravity
        if self.gravity != 0:
            velocity.ay += self.gravity
        
        # Apply acceleration to velocity
        velocity.vx += velocity.ax * delta_time
        velocity.vy += velocity.ay * delta_time
        
        # Apply drag/friction
        if self.enable_drag and velocity.drag > 0:
            drag_factor = 1 - (velocity.drag * delta_time)
            drag_factor = max(0, drag_factor)  # Don't reverse direction
            velocity.vx *= drag_factor
            velocity.vy *= drag_factor
        
        # Limit maximum velocity
        if velocity.max_speed > 0:
            speed_squared = velocity.vx * velocity.vx + velocity.vy * velocity.vy
            if speed_squared > velocity.max_speed * velocity.max_speed:
                speed = math.sqrt(speed_squared)
                velocity.vx = (velocity.vx / speed) * velocity.max_speed
                velocity.vy = (velocity.vy / speed) * velocity.max_speed
        
        # Store old position for event data
        old_x, old_y = transform.x, transform.y
        
        # Apply velocity to position
        transform.x += velocity.vx * delta_time
        transform.y += velocity.vy * delta_time
        
        # Handle world bounds
        if self.world_bounds:
            self._handle_world_bounds(entity, transform, velocity)
        
        # Publish movement event if entity moved significantly
        distance_moved = math.sqrt((transform.x - old_x)**2 + (transform.y - old_y)**2)
        if distance_moved > 1.0:  # Minimum movement threshold
            if self.world:
                self.world.event_bus.publish(
                    GameEvents.ENTITY_MOVED,
                    {
                        'old_position': (old_x, old_y),
                        'new_position': (transform.x, transform.y),
                        'velocity': (velocity.vx, velocity.vy),
                        'distance': distance_moved
                    },
                    source_entity_id=entity.id
                )
        
        # Reset acceleration (forces are applied each frame)
        velocity.ax = 0
        velocity.ay = 0
    
    def _handle_world_bounds(self, entity: Entity, transform: TransformComponent, 
                           velocity: VelocityComponent):
        """Handle world boundary constraints."""
        left, top, right, bottom = self.world_bounds
        
        if self.wrap_around:
            # Wrap around world bounds
            if transform.x < left:
                transform.x = right
            elif transform.x > right:
                transform.x = left
            
            if transform.y < top:
                transform.y = bottom
            elif transform.y > bottom:
                transform.y = top
        else:
            # Bounce off world bounds
            if transform.x < left:
                transform.x = left
                velocity.vx = abs(velocity.vx) * self.bounce_damping
            elif transform.x > right:
                transform.x = right
                velocity.vx = -abs(velocity.vx) * self.bounce_damping
            
            if transform.y < top:
                transform.y = top
                velocity.vy = abs(velocity.vy) * self.bounce_damping
            elif transform.y > bottom:
                transform.y = bottom
                velocity.vy = -abs(velocity.vy) * self.bounce_damping
    
    def apply_force(self, entity: Entity, force_x: float, force_y: float):
        """Apply a force to an entity."""
        velocity = entity.get_component(VelocityComponent)
        if velocity:
            velocity.ax += force_x
            velocity.ay += force_y
    
    def apply_impulse(self, entity: Entity, impulse_x: float, impulse_y: float):
        """Apply an instantaneous impulse to an entity."""
        velocity = entity.get_component(VelocityComponent)
        if velocity:
            velocity.vx += impulse_x
            velocity.vy += impulse_y
    
    def set_world_bounds(self, left: float, top: float, right: float, bottom: float, 
                        wrap_around: bool = False):
        """Set world boundary constraints."""
        self.world_bounds = (left, top, right, bottom)
        self.wrap_around = wrap_around


class PlatformerPhysicsSystem(PhysicsSystem):
    """
    Specialized physics system for 2D platformer games.
    
    Includes platformer-specific features like coyote time, jump buffering,
    variable jump height, and ground detection.
    """
    
    def __init__(self, priority: int = 20, gravity: float = 980):
        super().__init__(priority, gravity=gravity)
        
        # Platformer-specific physics
        self.terminal_velocity = 500
        self.jump_cut_factor = 0.5  # Velocity reduction when jump is released early
        
        # Movement feel parameters
        self.ground_acceleration = 800
        self.air_acceleration = 400
        self.ground_friction = 0.85
        self.air_friction = 0.98
        
        # Jump mechanics
        self.coyote_time = 0.1  # Grace period for jumping after leaving ground
        self.jump_buffer_time = 0.15  # Grace period for jump input before landing
        
        # Track ground state for entities
        self._ground_state: Dict[str, Dict[str, Any]] = {}
    
    def _update_entity_physics(self, entity: Entity, transform: TransformComponent, 
                              velocity: VelocityComponent, delta_time: float):
        """Update platformer physics for an entity."""
        entity_id = entity.id
        
        # Initialize ground state if needed
        if entity_id not in self._ground_state:
            self._ground_state[entity_id] = {
                'on_ground': False,
                'was_on_ground': False,
                'coyote_timer': 0.0,
                'jump_buffer_timer': 0.0,
                'jump_held': False
            }
        
        state = self._ground_state[entity_id]
        
        # Update ground state (would be set by collision system)
        state['was_on_ground'] = state['on_ground']
        
        # Update coyote time
        if state['on_ground']:
            state['coyote_timer'] = self.coyote_time
        else:
            state['coyote_timer'] -= delta_time
        
        # Update jump buffer
        state['jump_buffer_timer'] -= delta_time
        
        # Apply gravity
        velocity.ay += self.gravity
        
        # Apply movement acceleration (would be driven by input system)
        if state['on_ground']:
            # Ground movement with higher acceleration and friction
            velocity.vx *= (1 - self.ground_friction * delta_time)
        else:
            # Air movement with lower acceleration and friction
            velocity.vx *= (1 - self.air_friction * delta_time)
        
        # Apply acceleration to velocity
        velocity.vx += velocity.ax * delta_time
        velocity.vy += velocity.ay * delta_time
        
        # Apply terminal velocity
        if velocity.vy > self.terminal_velocity:
            velocity.vy = self.terminal_velocity
        
        # Variable jump height (cut jump short if button released)
        if not state['jump_held'] and velocity.vy < 0:
            velocity.vy *= self.jump_cut_factor
        
        # Store old position
        old_x, old_y = transform.x, transform.y
        
        # Apply velocity to position
        transform.x += velocity.vx * delta_time
        transform.y += velocity.vy * delta_time
        
        # Publish movement events
        if abs(transform.x - old_x) > 0.5 or abs(transform.y - old_y) > 0.5:
            if self.world:
                self.world.event_bus.publish(
                    GameEvents.PLAYER_MOVED,
                    {
                        'old_position': (old_x, old_y),
                        'new_position': (transform.x, transform.y),
                        'velocity': (velocity.vx, velocity.vy),
                        'on_ground': state['on_ground']
                    },
                    source_entity_id=entity.id
                )
        
        # Check for landing
        if state['on_ground'] and not state['was_on_ground']:
            if self.world:
                self.world.event_bus.publish(
                    GameEvents.PLAYER_LANDED,
                    {
                        'position': (transform.x, transform.y),
                        'landing_velocity': velocity.vy
                    },
                    source_entity_id=entity.id
                )
        
        # Reset acceleration
        velocity.ax = 0
        velocity.ay = 0
    
    def jump(self, entity: Entity, jump_strength: float) -> bool:
        """
        Make an entity jump if conditions are met.
        
        Args:
            entity: Entity to make jump
            jump_strength: Jump velocity (negative for upward)
            
        Returns:
            True if jump was executed
        """
        entity_id = entity.id
        if entity_id not in self._ground_state:
            return False
        
        state = self._ground_state[entity_id]
        velocity = entity.get_component(VelocityComponent)
        
        if not velocity:
            return False
        
        # Can jump if on ground or within coyote time
        can_jump = state['on_ground'] or state['coyote_timer'] > 0
        
        if can_jump:
            velocity.vy = jump_strength
            state['on_ground'] = False
            state['coyote_timer'] = 0
            state['jump_held'] = True
            
            # Publish jump event
            if self.world:
                transform = entity.get_component(TransformComponent)
                self.world.event_bus.publish(
                    GameEvents.PLAYER_JUMPED,
                    {
                        'position': (transform.x, transform.y) if transform else (0, 0),
                        'jump_velocity': jump_strength
                    },
                    source_entity_id=entity.id
                )
            
            return True
        
        return False
    
    def set_ground_state(self, entity: Entity, on_ground: bool):
        """Set ground state for an entity (called by collision system)."""
        entity_id = entity.id
        if entity_id not in self._ground_state:
            self._ground_state[entity_id] = {
                'on_ground': False,
                'was_on_ground': False,
                'coyote_timer': 0.0,
                'jump_buffer_timer': 0.0,
                'jump_held': False
            }
        
        self._ground_state[entity_id]['on_ground'] = on_ground
    
    def set_jump_held(self, entity: Entity, held: bool):
        """Set jump button state for variable jump height."""
        entity_id = entity.id
        if entity_id in self._ground_state:
            self._ground_state[entity_id]['jump_held'] = held
    
    def is_on_ground(self, entity: Entity) -> bool:
        """Check if entity is on ground."""
        entity_id = entity.id
        if entity_id in self._ground_state:
            return self._ground_state[entity_id]['on_ground']
        return False
    
    def can_jump(self, entity: Entity) -> bool:
        """Check if entity can currently jump."""
        entity_id = entity.id
        if entity_id not in self._ground_state:
            return False
        
        state = self._ground_state[entity_id]
        return state['on_ground'] or state['coyote_timer'] > 0