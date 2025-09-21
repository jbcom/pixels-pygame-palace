"""
Scene Manager - Handles scene loading, unloading, and transitions.

Manages game scenes, level transitions, and scene state persistence.
Provides a clean interface for organizing game content into scenes.
"""

from typing import Dict, Any, Optional, List, Callable, Set, Type
from enum import Enum
import json
import time

from ..core.system import System
from ..core.entity import Entity
from ..core.component import Component, TransformComponent
from ..core.event_bus import GameEvents, EventPriority


class SceneState(Enum):
    """Scene lifecycle states."""
    INACTIVE = "inactive"
    LOADING = "loading"
    ACTIVE = "active"
    PAUSED = "paused"
    UNLOADING = "unloading"


class Scene:
    """
    Represents a game scene with entities and configuration.
    
    Scenes are self-contained game states that can be loaded/unloaded
    independently. Examples: menu, level1, boss_fight, etc.
    """
    
    def __init__(self, scene_id: str, name: str):
        self.id = scene_id
        self.name = name
        self.state = SceneState.INACTIVE
        
        # Scene entities
        self.entities: List[Entity] = []
        self.entity_templates: List[Dict[str, Any]] = []
        
        # Scene configuration
        self.settings: Dict[str, Any] = {}
        self.background_color = (0, 0, 0)
        self.camera_bounds = None  # (left, top, right, bottom)
        
        # Scene lifecycle callbacks
        self.on_load: Optional[Callable] = None
        self.on_unload: Optional[Callable] = None
        self.on_activate: Optional[Callable] = None
        self.on_deactivate: Optional[Callable] = None
        
        # Persistence
        self.persistent = False  # Whether to keep entities when scene is inactive
        self.auto_save = False   # Whether to auto-save scene state
        
        # Loading progress
        self.load_progress = 0.0
        self.load_error = None
    
    def add_entity_template(self, template: Dict[str, Any]):
        """Add an entity template to be instantiated when scene loads."""
        self.entity_templates.append(template)
    
    def get_setting(self, key: str, default=None):
        """Get a scene setting value."""
        return self.settings.get(key, default)
    
    def set_setting(self, key: str, value: Any):
        """Set a scene setting value."""
        self.settings[key] = value
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize scene to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'settings': self.settings,
            'background_color': self.background_color,
            'camera_bounds': self.camera_bounds,
            'entity_templates': self.entity_templates,
            'persistent': self.persistent,
            'auto_save': self.auto_save
        }
    
    def from_dict(self, data: Dict[str, Any]):
        """Deserialize scene from dictionary."""
        self.id = data.get('id', self.id)
        self.name = data.get('name', self.name)
        self.settings = data.get('settings', {})
        self.background_color = data.get('background_color', (0, 0, 0))
        self.camera_bounds = data.get('camera_bounds')
        self.entity_templates = data.get('entity_templates', [])
        self.persistent = data.get('persistent', False)
        self.auto_save = data.get('auto_save', False)


class SceneTransition:
    """Defines how to transition between scenes."""
    
    def __init__(self, from_scene: str, to_scene: str, 
                 transition_type: str = "fade", duration: float = 1.0):
        self.from_scene = from_scene
        self.to_scene = to_scene
        self.transition_type = transition_type  # fade, slide, cut, etc.
        self.duration = duration
        self.progress = 0.0
        self.completed = False
        
        # Transition callbacks
        self.on_start: Optional[Callable] = None
        self.on_complete: Optional[Callable] = None
        self.on_update: Optional[Callable] = None


class SceneManager(System):
    """
    System for managing game scenes and transitions.
    
    Handles scene loading/unloading, transitions, and state management.
    Provides a clean way to organize game content into discrete scenes.
    """
    
    def __init__(self, priority: int = 5):
        super().__init__(priority)
        
        # Scene management
        self.scenes: Dict[str, Scene] = {}
        self.current_scene: Optional[Scene] = None
        self.target_scene: Optional[str] = None
        self.current_transition: Optional[SceneTransition] = None
        
        # Scene stack for overlays/menus
        self.scene_stack: List[Scene] = []
        
        # Loading state
        self.loading_scene = False
        self.unloading_scene = False
        
        # Scene templates for runtime creation
        self.scene_templates: Dict[str, Dict[str, Any]] = {}
        
        # Default settings
        self.auto_cleanup = True  # Auto-cleanup inactive scenes
        self.max_loaded_scenes = 3  # Maximum scenes to keep in memory
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return set()  # Scene manager doesn't require specific components
    
    def initialize(self):
        """Initialize scene manager."""
        super().initialize()
        
        # Subscribe to scene events
        if self.world:
            self.world.event_bus.subscribe(
                GameEvents.LEVEL_STARTED, self._handle_level_start
            )
            self.world.event_bus.subscribe(
                GameEvents.LEVEL_COMPLETED, self._handle_level_complete
            )
    
    def update(self, entities, delta_time: float):
        """Update scene manager."""
        # Handle scene transitions
        if self.current_transition:
            self._update_transition(delta_time)
        
        # Handle scene loading/unloading
        if self.loading_scene or self.unloading_scene:
            self._update_loading_state(delta_time)
        
        # Update current scene
        if self.current_scene and self.current_scene.state == SceneState.ACTIVE:
            self._update_scene(self.current_scene, delta_time)
    
    def create_scene(self, scene_id: str, name: str) -> Scene:
        """Create a new scene."""
        scene = Scene(scene_id, name)
        self.scenes[scene_id] = scene
        return scene
    
    def load_scene(self, scene_id: str, transition: Optional[SceneTransition] = None) -> bool:
        """
        Load a scene, optionally with a transition.
        
        Args:
            scene_id: ID of scene to load
            transition: Optional transition definition
            
        Returns:
            True if loading started successfully
        """
        if scene_id not in self.scenes:
            print(f"Scene '{scene_id}' not found")
            return False
        
        target_scene = self.scenes[scene_id]
        
        # Check if scene is already active
        if self.current_scene and self.current_scene.id == scene_id:
            return True
        
        # Set up transition if provided
        if transition:
            self.current_transition = transition
            self.current_transition.progress = 0.0
            self.current_transition.completed = False
            if transition.on_start:
                transition.on_start()
        
        self.target_scene = scene_id
        self.loading_scene = True
        
        # Publish scene loading event
        if self.world:
            self.world.event_bus.publish(
                'scene_loading_started',
                {'scene_id': scene_id, 'scene_name': target_scene.name},
                priority=EventPriority.HIGH
            )
        
        return True
    
    def unload_scene(self, scene_id: str, force: bool = False) -> bool:
        """
        Unload a scene from memory.
        
        Args:
            scene_id: ID of scene to unload
            force: Force unload even if persistent
            
        Returns:
            True if unloading started successfully
        """
        if scene_id not in self.scenes:
            return False
        
        scene = self.scenes[scene_id]
        
        # Don't unload current scene or persistent scenes (unless forced)
        if ((self.current_scene and scene.id == self.current_scene.id) or 
            (scene.persistent and not force)):
            return False
        
        self._unload_scene_entities(scene)
        scene.state = SceneState.INACTIVE
        
        # Call unload callback
        if scene.on_unload:
            scene.on_unload()
        
        # Publish unload event
        if self.world:
            self.world.event_bus.publish(
                'scene_unloaded',
                {'scene_id': scene_id, 'scene_name': scene.name}
            )
        
        return True
    
    def push_scene(self, scene_id: str) -> bool:
        """
        Push a scene onto the stack (for overlays/menus).
        
        Args:
            scene_id: ID of scene to push
            
        Returns:
            True if successful
        """
        if scene_id not in self.scenes:
            return False
        
        scene = self.scenes[scene_id]
        
        # Pause current scene
        if self.current_scene:
            self.current_scene.state = SceneState.PAUSED
            if self.current_scene.on_deactivate:
                self.current_scene.on_deactivate()
        
        # Add to stack
        if self.current_scene:
            self.scene_stack.append(self.current_scene)
        
        # Activate new scene
        self._activate_scene(scene)
        return True
    
    def pop_scene(self) -> bool:
        """
        Pop the current scene from the stack.
        
        Returns:
            True if successful
        """
        if not self.scene_stack:
            return False
        
        # Deactivate current scene
        if self.current_scene:
            self._deactivate_scene(self.current_scene)
        
        # Restore previous scene
        previous_scene = self.scene_stack.pop()
        self._activate_scene(previous_scene)
        
        return True
    
    def get_scene(self, scene_id: str) -> Optional[Scene]:
        """Get a scene by ID."""
        return self.scenes.get(scene_id)
    
    def get_current_scene(self) -> Optional[Scene]:
        """Get the currently active scene."""
        return self.current_scene
    
    def is_scene_loaded(self, scene_id: str) -> bool:
        """Check if a scene is loaded."""
        scene = self.scenes.get(scene_id)
        return scene is not None and scene.state != SceneState.INACTIVE
    
    def add_scene_template(self, template_id: str, template_data: Dict[str, Any]):
        """Add a scene template for runtime creation."""
        self.scene_templates[template_id] = template_data
    
    def create_scene_from_template(self, scene_id: str, template_id: str) -> Optional[Scene]:
        """Create a scene from a template."""
        if template_id not in self.scene_templates:
            return None
        
        template = self.scene_templates[template_id]
        scene = Scene(scene_id, template.get('name', scene_id))
        scene.from_dict(template)
        
        self.scenes[scene_id] = scene
        return scene
    
    def save_scene_state(self, scene_id: str, filename: str) -> bool:
        """Save scene state to file."""
        scene = self.scenes.get(scene_id)
        if not scene:
            return False
        
        try:
            # Collect entity data
            entity_data = []
            for entity in scene.entities:
                # Serialize entity components
                # This is a simplified version - real implementation would be more comprehensive
                entity_dict = {
                    'id': entity.id,
                    'name': entity.name,
                    'tags': list(entity.tags),
                    'components': {}
                }
                
                for comp_type, component in entity.get_components().items():
                    entity_dict['components'][comp_type.__name__] = component.to_dict()
                
                entity_data.append(entity_dict)
            
            # Create save data
            save_data = scene.to_dict()
            save_data['entities'] = entity_data
            save_data['save_time'] = time.time()
            
            # Write to file
            with open(filename, 'w') as f:
                json.dump(save_data, f, indent=2)
            
            return True
            
        except Exception as e:
            print(f"Error saving scene state: {e}")
            return False
    
    def load_scene_state(self, filename: str) -> Optional[str]:
        """
        Load scene state from file.
        
        Returns:
            Scene ID if successful, None if failed
        """
        try:
            with open(filename, 'r') as f:
                save_data = json.load(f)
            
            scene_id = save_data['id']
            
            # Create or update scene
            if scene_id in self.scenes:
                scene = self.scenes[scene_id]
            else:
                scene = Scene(scene_id, save_data['name'])
                self.scenes[scene_id] = scene
            
            scene.from_dict(save_data)
            
            return scene_id
            
        except Exception as e:
            print(f"Error loading scene state: {e}")
            return None
    
    def _activate_scene(self, scene: Scene):
        """Activate a scene."""
        self.current_scene = scene
        scene.state = SceneState.ACTIVE
        
        # Load scene entities if not already loaded
        if not scene.entities and scene.entity_templates:
            self._load_scene_entities(scene)
        
        # Call activate callback
        if scene.on_activate:
            scene.on_activate()
        
        # Publish activation event
        if self.world:
            self.world.event_bus.publish(
                'scene_activated',
                {'scene_id': scene.id, 'scene_name': scene.name}
            )
    
    def _deactivate_scene(self, scene: Scene):
        """Deactivate a scene."""
        scene.state = SceneState.INACTIVE
        
        # Auto-save if enabled
        if scene.auto_save:
            self.save_scene_state(scene.id, f"{scene.id}_autosave.json")
        
        # Unload entities if not persistent
        if not scene.persistent:
            self._unload_scene_entities(scene)
        
        # Call deactivate callback
        if scene.on_deactivate:
            scene.on_deactivate()
        
        # Publish deactivation event
        if self.world:
            self.world.event_bus.publish(
                'scene_deactivated',
                {'scene_id': scene.id, 'scene_name': scene.name}
            )
    
    def _load_scene_entities(self, scene: Scene):
        """Load entities for a scene."""
        if not self.world:
            return
        
        scene.entities.clear()
        
        for template in scene.entity_templates:
            # Create entity from template
            entity = Entity(name=template.get('name', 'SceneEntity'))
            
            # Add transform if position specified
            if 'position' in template:
                pos = template['position']
                transform = TransformComponent(pos['x'], pos['y'])
                entity.add_component(transform)
            
            # Add other components based on template
            # This is simplified - real implementation would handle all component types
            
            scene.entities.append(entity)
            self.world.add_entity(entity)
    
    def _unload_scene_entities(self, scene: Scene):
        """Unload entities for a scene."""
        if not self.world:
            return
        
        for entity in scene.entities:
            self.world.remove_entity(entity)
        
        scene.entities.clear()
    
    def _update_transition(self, delta_time: float):
        """Update scene transition."""
        if not self.current_transition:
            return
        
        # Update transition progress
        self.current_transition.progress += delta_time / self.current_transition.duration
        self.current_transition.progress = min(1.0, self.current_transition.progress)
        
        # Call update callback
        if self.current_transition.on_update:
            self.current_transition.on_update(self.current_transition.progress)
        
        # Check if transition is complete
        if self.current_transition.progress >= 1.0:
            self.current_transition.completed = True
            
            # Call completion callback
            if self.current_transition.on_complete:
                self.current_transition.on_complete()
            
            self.current_transition = None
    
    def _update_loading_state(self, delta_time: float):
        """Update scene loading/unloading state."""
        if self.loading_scene and self.target_scene:
            # Simulate loading progress (real implementation would track actual loading)
            target = self.scenes[self.target_scene]
            target.load_progress += delta_time * 2.0  # 0.5 second load time
            
            if target.load_progress >= 1.0:
                # Loading complete
                target.load_progress = 1.0
                
                # Deactivate current scene
                if self.current_scene:
                    self._deactivate_scene(self.current_scene)
                
                # Activate new scene
                self._activate_scene(target)
                
                self.loading_scene = False
                self.target_scene = None
    
    def _update_scene(self, scene: Scene, delta_time: float):
        """Update scene-specific logic."""
        # Update scene timer if present
        if 'time_limit' in scene.settings:
            current_time = scene.settings.get('current_time', scene.settings['time_limit'])
            current_time -= delta_time
            scene.settings['current_time'] = max(0, current_time)
            
            # Check for time up
            if current_time <= 0:
                if self.world:
                    self.world.event_bus.publish(
                        'scene_time_expired',
                        {'scene_id': scene.id}
                    )
    
    def _handle_level_start(self, event):
        """Handle level start events."""
        # Auto-load scene if specified
        pass
    
    def _handle_level_complete(self, event):
        """Handle level completion events."""
        # Auto-transition to next scene if specified
        pass