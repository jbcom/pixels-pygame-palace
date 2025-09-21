"""
World - The main ECS container that manages entities and systems.

The World coordinates all entities and systems, handling their lifecycle
and ensuring systems process the correct entities each frame.
"""

from typing import List, Dict, Set, Type, Optional, Any
import time
import logging

from .entity import Entity
from .system import System
from .component import Component
from .event_bus import EventBus, GameEvents

logger = logging.getLogger(__name__)


class World:
    """
    Main ECS world that manages entities and systems.
    
    The World is responsible for:
    - Managing entity lifecycle
    - Running systems in priority order
    - Maintaining entity-system relationships
    - Coordinating the game loop
    """
    
    def __init__(self, event_bus: Optional[EventBus] = None):
        """
        Initialize the world.
        
        Args:
            event_bus: Event bus for communication (creates new if None)
        """
        self.entities: List[Entity] = []
        self.systems: List[System] = []
        self.event_bus = event_bus or EventBus()
        
        # Entity management
        self._entities_by_id: Dict[str, Entity] = {}
        self._entities_to_add: List[Entity] = []
        self._entities_to_remove: List[Entity] = []
        
        # System-entity caching for performance
        self._system_entities: Dict[System, List[Entity]] = {}
        self._entity_system_cache_dirty = True
        
        # World state
        self.running = False
        self.paused = False
        self.frame_count = 0
        self.total_time = 0.0
        
        # Performance tracking
        self._frame_times: List[float] = []
        self._max_frame_history = 60
        
        # Configuration
        self.max_entities = 10000
        self.target_fps = 60
        self.max_delta_time = 1.0 / 15.0  # Cap delta time to prevent instability
    
    def add_entity(self, entity: Entity) -> Entity:
        """
        Add an entity to the world.
        
        Args:
            entity: Entity to add
            
        Returns:
            The added entity
            
        Raises:
            ValueError: If entity limit reached or entity already exists
        """
        if len(self.entities) >= self.max_entities:
            raise ValueError(f"Entity limit reached ({self.max_entities})")
        
        if entity.id in self._entities_by_id:
            raise ValueError(f"Entity with ID {entity.id} already exists")
        
        self._entities_to_add.append(entity)
        self._entity_system_cache_dirty = True
        
        # Publish event
        self.event_bus.publish(
            GameEvents.ENTITY_CREATED,
            {'entity_id': entity.id, 'entity_name': entity.name},
            source_entity_id=entity.id
        )
        
        logger.debug(f"Added entity {entity.name} ({entity.id})")
        return entity
    
    def remove_entity(self, entity: Entity):
        """
        Remove an entity from the world.
        
        Args:
            entity: Entity to remove
        """
        if entity not in self._entities_to_remove:
            self._entities_to_remove.append(entity)
            self._entity_system_cache_dirty = True
            
            # Publish event
            self.event_bus.publish(
                GameEvents.ENTITY_DESTROYED,
                {'entity_id': entity.id, 'entity_name': entity.name},
                source_entity_id=entity.id
            )
            
            logger.debug(f"Marked entity {entity.name} ({entity.id}) for removal")
    
    def get_entity(self, entity_id: str) -> Optional[Entity]:
        """
        Get entity by ID.
        
        Args:
            entity_id: Entity identifier
            
        Returns:
            Entity if found, None otherwise
        """
        return self._entities_by_id.get(entity_id)
    
    def find_entities_with_component(self, component_type: Type[Component]) -> List[Entity]:
        """
        Find all entities with a specific component type.
        
        Args:
            component_type: Component type to search for
            
        Returns:
            List of entities with the component
        """
        return [entity for entity in self.entities 
                if entity.has_component(component_type)]
    
    def find_entities_with_components(self, *component_types: Type[Component]) -> List[Entity]:
        """
        Find all entities with all specified component types.
        
        Args:
            component_types: Component types that must all be present
            
        Returns:
            List of entities with all components
        """
        return [entity for entity in self.entities 
                if entity.has_components(*component_types)]
    
    def find_entities_with_tag(self, tag: str) -> List[Entity]:
        """
        Find all entities with a specific tag.
        
        Args:
            tag: Tag to search for
            
        Returns:
            List of entities with the tag
        """
        return [entity for entity in self.entities if entity.has_tag(tag)]
    
    def add_system(self, system: System):
        """
        Add a system to the world.
        
        Args:
            system: System to add
        """
        system.world = self
        self.systems.append(system)
        
        # Sort systems by priority
        self.systems.sort()
        
        # Initialize system
        if not system._initialized:
            system.initialize()
        
        self._entity_system_cache_dirty = True
        logger.info(f"Added system {system.__class__.__name__} with priority {system.priority}")
    
    def remove_system(self, system: System):
        """
        Remove a system from the world.
        
        Args:
            system: System to remove
        """
        if system in self.systems:
            system.shutdown()
            system.world = None
            self.systems.remove(system)
            
            # Clear from cache
            if system in self._system_entities:
                del self._system_entities[system]
            
            logger.info(f"Removed system {system.__class__.__name__}")
    
    def get_system(self, system_type: Type[System]) -> Optional[System]:
        """
        Get a system by type.
        
        Args:
            system_type: Type of system to find
            
        Returns:
            System instance if found, None otherwise
        """
        for system in self.systems:
            if isinstance(system, system_type):
                return system
        return None
    
    def update(self, delta_time: float):
        """
        Update the world for one frame.
        
        Args:
            delta_time: Time elapsed since last frame in seconds
        """
        frame_start = time.perf_counter()
        
        # Cap delta time to prevent instability
        delta_time = min(delta_time, self.max_delta_time)
        
        # Process pending entity changes
        self._process_entity_changes()
        
        # Update entity-system cache if needed
        if self._entity_system_cache_dirty:
            self._update_entity_system_cache()
        
        # Update all systems
        for system in self.systems:
            if not system.enabled:
                continue
            
            # Get entities for this system
            entities = self._system_entities.get(system, [])
            
            try:
                # Track performance and update
                system._track_update_time(system.update, entities, delta_time)
            except Exception as e:
                logger.error(f"Error updating system {system.__class__.__name__}: {e}", 
                           exc_info=True)
        
        # Process events
        self.event_bus.process_events()
        
        # Update world state
        self.frame_count += 1
        self.total_time += delta_time
        
        # Track frame time
        frame_time = time.perf_counter() - frame_start
        self._frame_times.append(frame_time)
        if len(self._frame_times) > self._max_frame_history:
            self._frame_times.pop(0)
    
    def _process_entity_changes(self):
        """Process pending entity additions and removals."""
        # Add new entities
        for entity in self._entities_to_add:
            self.entities.append(entity)
            self._entities_by_id[entity.id] = entity
            
            # Notify systems
            for system in self.systems:
                if system.matches_entity(entity):
                    system.on_entity_added(entity)
        
        self._entities_to_add.clear()
        
        # Remove entities
        for entity in self._entities_to_remove:
            if entity in self.entities:
                # Notify systems
                for system in self.systems:
                    if system.matches_entity(entity):
                        system.on_entity_removed(entity)
                
                # Remove from world
                self.entities.remove(entity)
                if entity.id in self._entities_by_id:
                    del self._entities_by_id[entity.id]
                
                # Clean up entity
                entity.destroy()
        
        self._entities_to_remove.clear()
    
    def _update_entity_system_cache(self):
        """Update the entity-system matching cache."""
        self._system_entities.clear()
        
        for system in self.systems:
            matching_entities = []
            for entity in self.entities:
                if system.matches_entity(entity):
                    matching_entities.append(entity)
            
            self._system_entities[system] = matching_entities
        
        self._entity_system_cache_dirty = False
        logger.debug("Updated entity-system cache")
    
    def start(self):
        """Start the world."""
        self.running = True
        self.paused = False
        
        self.event_bus.publish(GameEvents.GAME_STARTED)
        logger.info("World started")
    
    def pause(self):
        """Pause the world."""
        self.paused = True
        self.event_bus.publish(GameEvents.GAME_PAUSED)
        logger.info("World paused")
    
    def resume(self):
        """Resume the world."""
        self.paused = False
        self.event_bus.publish(GameEvents.GAME_RESUMED)
        logger.info("World resumed")
    
    def stop(self):
        """Stop the world."""
        self.running = False
        
        # Cleanup all systems
        for system in self.systems[:]:
            self.remove_system(system)
        
        # Cleanup all entities
        for entity in self.entities[:]:
            self.remove_entity(entity)
        
        self._process_entity_changes()
        
        self.event_bus.publish(GameEvents.GAME_OVER)
        logger.info("World stopped")
    
    def clear(self):
        """Clear all entities and systems."""
        # Remove all entities
        for entity in self.entities[:]:
            self.remove_entity(entity)
        
        # Remove all systems
        for system in self.systems[:]:
            self.remove_system(system)
        
        # Process changes
        self._process_entity_changes()
        
        # Clear caches
        self._system_entities.clear()
        self._entity_system_cache_dirty = True
        
        # Reset state
        self.frame_count = 0
        self.total_time = 0.0
        self._frame_times.clear()
        
        logger.info("World cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get world statistics.
        
        Returns:
            Dictionary containing world stats
        """
        avg_frame_time = 0.0
        if self._frame_times:
            avg_frame_time = sum(self._frame_times) / len(self._frame_times)
        
        system_stats = {}
        for system in self.systems:
            system_stats[system.__class__.__name__] = {
                'enabled': system.enabled,
                'priority': system.priority,
                'avg_update_time_ms': system.average_update_time,
                'entity_count': len(self._system_entities.get(system, []))
            }
        
        return {
            'entity_count': len(self.entities),
            'system_count': len(self.systems),
            'frame_count': self.frame_count,
            'total_time': self.total_time,
            'avg_frame_time_ms': avg_frame_time * 1000,
            'running': self.running,
            'paused': self.paused,
            'systems': system_stats,
            'event_bus_stats': self.event_bus.get_stats()
        }
    
    def reset_performance_stats(self):
        """Reset all performance statistics."""
        self._frame_times.clear()
        for system in self.systems:
            system.reset_performance_stats()
        self.event_bus.reset_stats()
        logger.info("Reset performance stats")