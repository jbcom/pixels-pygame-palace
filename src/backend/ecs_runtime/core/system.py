"""
System - Behavior processors in the ECS system.

Systems contain all the logic and behavior, operating on entities that have
specific component combinations. They are updated each frame in priority order.
"""

from typing import List, Set, Type, Optional, Dict, Any
from abc import ABC, abstractmethod
import time

from .entity import Entity
from .component import Component


class System(ABC):
    """
    Base class for all systems in the ECS architecture.
    
    Systems process entities that have specific component requirements.
    They define the behavior and logic of the game.
    """
    
    def __init__(self, priority: int = 0, enabled: bool = True):
        """
        Initialize system.
        
        Args:
            priority: System update priority (lower = earlier)
            enabled: Whether system is active
        """
        self.priority = priority
        self.enabled = enabled
        self.world = None  # Set by World when system is added
        
        # Performance tracking
        self._update_time = 0.0
        self._update_count = 0
        
        # System lifecycle hooks
        self._initialized = False
    
    @property
    @abstractmethod
    def required_components(self) -> Set[Type[Component]]:
        """
        Define which components entities must have to be processed.
        
        Returns:
            Set of required component types
        """
        pass
    
    @property
    def optional_components(self) -> Set[Type[Component]]:
        """
        Define optional components that enhance processing.
        
        Returns:
            Set of optional component types
        """
        return set()
    
    @property
    def excluded_components(self) -> Set[Type[Component]]:
        """
        Define components that exclude entities from processing.
        
        Returns:
            Set of excluded component types
        """
        return set()
    
    def initialize(self):
        """
        Initialize system when added to world.
        Called once when system is registered.
        """
        self._initialized = True
    
    def shutdown(self):
        """
        Cleanup system when removed from world.
        Called once when system is unregistered.
        """
        pass
    
    @abstractmethod
    def update(self, entities: List[Entity], delta_time: float):
        """
        Update system logic for one frame.
        
        Args:
            entities: List of entities matching component requirements
            delta_time: Time elapsed since last frame in seconds
        """
        pass
    
    def process_entity(self, entity: Entity, delta_time: float):
        """
        Process a single entity (optional override).
        
        Args:
            entity: Entity to process
            delta_time: Time elapsed since last frame
        """
        pass
    
    def on_entity_added(self, entity: Entity):
        """
        Called when an entity starts matching this system's requirements.
        
        Args:
            entity: The newly matching entity
        """
        pass
    
    def on_entity_removed(self, entity: Entity):
        """
        Called when an entity stops matching this system's requirements.
        
        Args:
            entity: The entity that no longer matches
        """
        pass
    
    def matches_entity(self, entity: Entity) -> bool:
        """
        Check if entity matches this system's component requirements.
        
        Args:
            entity: Entity to check
            
        Returns:
            True if entity should be processed by this system
        """
        # Must have all required components
        if not entity.has_components(*self.required_components):
            return False
        
        # Must not have any excluded components
        for excluded_type in self.excluded_components:
            if entity.has_component(excluded_type):
                return False
        
        # Must be active
        return entity.active
    
    def get_entities(self) -> List[Entity]:
        """
        Get all entities that match this system's requirements.
        
        Returns:
            List of matching entities
        """
        if not self.world:
            return []
        
        return [entity for entity in self.world.entities 
                if self.matches_entity(entity)]
    
    def _track_update_time(self, update_func, *args, **kwargs):
        """Track system update performance."""
        start_time = time.perf_counter()
        result = update_func(*args, **kwargs)
        end_time = time.perf_counter()
        
        self._update_time += (end_time - start_time)
        self._update_count += 1
        
        return result
    
    @property
    def average_update_time(self) -> float:
        """Get average update time in milliseconds."""
        if self._update_count == 0:
            return 0.0
        return (self._update_time / self._update_count) * 1000
    
    def reset_performance_stats(self):
        """Reset performance tracking counters."""
        self._update_time = 0.0
        self._update_count = 0
    
    def __lt__(self, other: 'System') -> bool:
        """Sort systems by priority."""
        return self.priority < other.priority
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"{self.__class__.__name__}(priority={self.priority}, enabled={self.enabled})"


class MovementSystem(System):
    """Basic movement system that applies velocity to transform."""
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        from .component import TransformComponent, VelocityComponent
        return {TransformComponent, VelocityComponent}
    
    def update(self, entities: List[Entity], delta_time: float):
        """Apply velocity to entity positions."""
        from .component import TransformComponent, VelocityComponent
        
        for entity in entities:
            transform = entity.get_component(TransformComponent)
            velocity = entity.get_component(VelocityComponent)
            
            if transform and velocity:
                # Apply velocity
                transform.x += velocity.vx * delta_time
                transform.y += velocity.vy * delta_time
                
                # Apply drag
                if velocity.drag > 0:
                    velocity.vx *= (1 - velocity.drag * delta_time)
                    velocity.vy *= (1 - velocity.drag * delta_time)
                
                # Limit maximum speed
                speed_squared = velocity.vx * velocity.vx + velocity.vy * velocity.vy
                if speed_squared > velocity.max_speed * velocity.max_speed:
                    speed = (speed_squared ** 0.5)
                    velocity.vx = (velocity.vx / speed) * velocity.max_speed
                    velocity.vy = (velocity.vy / speed) * velocity.max_speed


class RenderSystem(System):
    """Basic sprite rendering system."""
    
    def __init__(self, screen, priority: int = 1000):
        super().__init__(priority)
        self.screen = screen
        self.sprites_by_layer: Dict[int, List[Entity]] = {}
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        from .component import TransformComponent, SpriteComponent
        return {TransformComponent, SpriteComponent}
    
    def update(self, entities: List[Entity], delta_time: float):
        """Render all sprite entities."""
        from .component import TransformComponent, SpriteComponent
        
        # Group sprites by layer
        self.sprites_by_layer.clear()
        
        for entity in entities:
            sprite = entity.get_component(SpriteComponent)
            if sprite and sprite.visible:
                layer = sprite.layer
                if layer not in self.sprites_by_layer:
                    self.sprites_by_layer[layer] = []
                self.sprites_by_layer[layer].append(entity)
        
        # Render in layer order
        for layer in sorted(self.sprites_by_layer.keys()):
            for entity in self.sprites_by_layer[layer]:
                self._render_entity(entity)
    
    def _render_entity(self, entity: Entity):
        """Render a single sprite entity."""
        from .component import TransformComponent, SpriteComponent
        
        transform = entity.get_component(TransformComponent)
        sprite = entity.get_component(SpriteComponent)
        
        if not transform or not sprite:
            return
        
        # This is a placeholder - actual rendering would load textures
        # and draw them with pygame or another graphics library
        pass


class CleanupSystem(System):
    """System for cleaning up destroyed entities."""
    
    def __init__(self, priority: int = 9999):
        super().__init__(priority)
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return set()  # Processes all entities
    
    def update(self, entities: List[Entity], delta_time: float):
        """Remove destroyed entities from world."""
        if not self.world:
            return
        
        destroyed_entities = [entity for entity in entities if not entity.active]
        
        for entity in destroyed_entities:
            self.world.remove_entity(entity)


class SystemRegistry:
    """Registry for managing system types and creation."""
    
    def __init__(self):
        self._system_types: Dict[str, Type[System]] = {}
        self._system_configs: Dict[str, Dict[str, Any]] = {}
    
    def register_system(self, name: str, system_type: Type[System], 
                       default_config: Optional[Dict[str, Any]] = None):
        """
        Register a system type.
        
        Args:
            name: System identifier
            system_type: System class
            default_config: Default configuration
        """
        self._system_types[name] = system_type
        self._system_configs[name] = default_config or {}
    
    def create_system(self, name: str, config: Optional[Dict[str, Any]] = None) -> System:
        """
        Create a system instance.
        
        Args:
            name: System identifier
            config: System configuration
            
        Returns:
            System instance
            
        Raises:
            ValueError: If system type not registered
        """
        if name not in self._system_types:
            raise ValueError(f"Unknown system type: {name}")
        
        system_type = self._system_types[name]
        final_config = self._system_configs[name].copy()
        if config:
            final_config.update(config)
        
        # Create system with configuration
        try:
            return system_type(**final_config)
        except TypeError:
            # Fallback to no-argument constructor
            return system_type()
    
    def get_available_systems(self) -> List[str]:
        """Get list of registered system names."""
        return list(self._system_types.keys())
    
    def get_system_config(self, name: str) -> Dict[str, Any]:
        """Get default configuration for a system."""
        return self._system_configs.get(name, {}).copy()


# Global system registry
system_registry = SystemRegistry()

# Register built-in systems
system_registry.register_system('movement', MovementSystem)
system_registry.register_system('cleanup', CleanupSystem)