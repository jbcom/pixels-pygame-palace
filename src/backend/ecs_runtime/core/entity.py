"""
Entity - The fundamental game object in the ECS system.

An Entity is a unique identifier that can have multiple Components attached.
"""

from typing import Dict, Any, Set, Optional, Type
import uuid


class Entity:
    """
    A unique game object that holds components.
    
    Entities are lightweight containers for components and have no behavior
    themselves. All behavior is implemented through Systems that operate
    on entities with specific component combinations.
    """
    
    def __init__(self, entity_id: Optional[str] = None, name: Optional[str] = None):
        """
        Initialize a new entity.
        
        Args:
            entity_id: Unique identifier (auto-generated if None)
            name: Human-readable name for debugging
        """
        self.id = entity_id or str(uuid.uuid4())
        self.name = name or f"Entity_{self.id[:8]}"
        self._components: Dict[Type, Any] = {}
        self._component_types: Set[Type] = set()
        self.active = True
        self.tags: Set[str] = set()
        
        # Metadata for debugging and editor support
        self.metadata: Dict[str, Any] = {}
    
    def add_component(self, component: 'Component') -> 'Entity':
        """
        Add a component to this entity.
        
        Args:
            component: The component instance to add
            
        Returns:
            Self for method chaining
            
        Raises:
            ValueError: If component of this type already exists
        """
        component_type = type(component)
        
        if component_type in self._components:
            raise ValueError(f"Entity {self.name} already has component {component_type.__name__}")
        
        self._components[component_type] = component
        self._component_types.add(component_type)
        component.entity = self
        
        return self
    
    def remove_component(self, component_type: Type) -> 'Entity':
        """
        Remove a component from this entity.
        
        Args:
            component_type: The type of component to remove
            
        Returns:
            Self for method chaining
        """
        if component_type in self._components:
            component = self._components[component_type]
            component.entity = None
            del self._components[component_type]
            self._component_types.discard(component_type)
        
        return self
    
    def get_component(self, component_type: Type) -> Optional['Component']:
        """
        Get a component of the specified type.
        
        Args:
            component_type: The type of component to get
            
        Returns:
            The component instance or None if not found
        """
        return self._components.get(component_type)
    
    def has_component(self, component_type: Type) -> bool:
        """
        Check if entity has a component of the specified type.
        
        Args:
            component_type: The type of component to check
            
        Returns:
            True if component exists
        """
        return component_type in self._component_types
    
    def has_components(self, *component_types: Type) -> bool:
        """
        Check if entity has all specified component types.
        
        Args:
            component_types: Component types to check
            
        Returns:
            True if all component types exist
        """
        return all(comp_type in self._component_types for comp_type in component_types)
    
    def get_components(self) -> Dict[Type, 'Component']:
        """
        Get all components attached to this entity.
        
        Returns:
            Dictionary mapping component types to instances
        """
        return self._components.copy()
    
    def get_component_types(self) -> Set[Type]:
        """
        Get all component types attached to this entity.
        
        Returns:
            Set of component types
        """
        return self._component_types.copy()
    
    def add_tag(self, tag: str) -> 'Entity':
        """
        Add a tag to this entity.
        
        Args:
            tag: Tag string to add
            
        Returns:
            Self for method chaining
        """
        self.tags.add(tag)
        return self
    
    def remove_tag(self, tag: str) -> 'Entity':
        """
        Remove a tag from this entity.
        
        Args:
            tag: Tag string to remove
            
        Returns:
            Self for method chaining
        """
        self.tags.discard(tag)
        return self
    
    def has_tag(self, tag: str) -> bool:
        """
        Check if entity has a specific tag.
        
        Args:
            tag: Tag to check
            
        Returns:
            True if tag exists
        """
        return tag in self.tags
    
    def destroy(self):
        """
        Mark entity for destruction.
        
        The entity will be removed from the world on the next frame.
        This also cleans up all component references.
        """
        self.active = False
        for component in self._components.values():
            component.entity = None
        self._components.clear()
        self._component_types.clear()
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        component_names = [comp_type.__name__ for comp_type in self._component_types]
        return f"Entity({self.name}, components=[{', '.join(component_names)}])"
    
    def __eq__(self, other) -> bool:
        """Entity equality based on ID."""
        return isinstance(other, Entity) and self.id == other.id
    
    def __hash__(self) -> int:
        """Entity hash based on ID."""
        return hash(self.id)