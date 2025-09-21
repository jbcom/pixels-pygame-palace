"""
Component - Data containers in the ECS system.

Components hold data and state but no behavior. All behavior is implemented
in Systems that operate on entities with specific component combinations.
"""

from typing import Any, Dict, Optional, TYPE_CHECKING
from abc import ABC
import json

if TYPE_CHECKING:
    from .entity import Entity


class Component(ABC):
    """
    Base class for all components.
    
    Components are pure data containers with no behavior. They can be
    serialized to/from JSON for saving/loading game state.
    """
    
    def __init__(self):
        """Initialize component."""
        self.entity: Optional['Entity'] = None
        self.enabled = True
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize component to dictionary.
        
        Returns:
            Dictionary representation of component data
        """
        result = {}
        for key, value in self.__dict__.items():
            if key.startswith('_') or key == 'entity':
                continue
            try:
                # Test if value is JSON serializable
                json.dumps(value)
                result[key] = value
            except (TypeError, ValueError):
                # Skip non-serializable values
                pass
        return result
    
    def from_dict(self, data: Dict[str, Any]) -> 'Component':
        """
        Deserialize component from dictionary.
        
        Args:
            data: Dictionary containing component data
            
        Returns:
            Self for method chaining
        """
        for key, value in data.items():
            if hasattr(self, key) and key != 'entity':
                setattr(self, key, value)
        return self
    
    def copy(self) -> 'Component':
        """
        Create a copy of this component.
        
        Returns:
            New component instance with same data
        """
        new_component = self.__class__()
        new_component.from_dict(self.to_dict())
        return new_component
    
    def __repr__(self) -> str:
        """String representation for debugging."""
        data = self.to_dict()
        return f"{self.__class__.__name__}({data})"


# Common component types used across the ECS system

class TransformComponent(Component):
    """Position, rotation, and scale component."""
    
    def __init__(self, x: float = 0, y: float = 0, rotation: float = 0, 
                 scale_x: float = 1, scale_y: float = 1):
        super().__init__()
        self.x = x
        self.y = y
        self.rotation = rotation  # in degrees
        self.scale_x = scale_x
        self.scale_y = scale_y
    
    @property
    def position(self) -> tuple:
        """Get position as tuple."""
        return (self.x, self.y)
    
    @position.setter
    def position(self, pos: tuple):
        """Set position from tuple."""
        self.x, self.y = pos
    
    @property
    def scale(self) -> tuple:
        """Get scale as tuple."""
        return (self.scale_x, self.scale_y)
    
    @scale.setter
    def scale(self, scale: tuple):
        """Set scale from tuple."""
        self.scale_x, self.scale_y = scale


class VelocityComponent(Component):
    """Velocity and acceleration component for physics."""
    
    def __init__(self, vx: float = 0, vy: float = 0, 
                 ax: float = 0, ay: float = 0,
                 max_speed: float = 500, drag: float = 0):
        super().__init__()
        self.vx = vx  # velocity x
        self.vy = vy  # velocity y
        self.ax = ax  # acceleration x
        self.ay = ay  # acceleration y
        self.max_speed = max_speed
        self.drag = drag  # drag coefficient
    
    @property
    def velocity(self) -> tuple:
        """Get velocity as tuple."""
        return (self.vx, self.vy)
    
    @velocity.setter
    def velocity(self, vel: tuple):
        """Set velocity from tuple."""
        self.vx, self.vy = vel
    
    @property
    def acceleration(self) -> tuple:
        """Get acceleration as tuple."""
        return (self.ax, self.ay)
    
    @acceleration.setter
    def acceleration(self, acc: tuple):
        """Set acceleration from tuple."""
        self.ax, self.ay = acc


class SpriteComponent(Component):
    """Sprite rendering component."""
    
    def __init__(self, texture_path: str = "", width: int = 32, height: int = 32,
                 color: tuple = (255, 255, 255), alpha: int = 255,
                 flip_x: bool = False, flip_y: bool = False):
        super().__init__()
        self.texture_path = texture_path
        self.width = width
        self.height = height
        self.color = color  # tint color
        self.alpha = alpha  # transparency
        self.flip_x = flip_x
        self.flip_y = flip_y
        self.visible = True
        self.layer = 0  # rendering layer/depth


class CollisionComponent(Component):
    """Collision detection component."""
    
    def __init__(self, width: float = 32, height: float = 32,
                 offset_x: float = 0, offset_y: float = 0,
                 solid: bool = True, trigger: bool = False):
        super().__init__()
        self.width = width
        self.height = height
        self.offset_x = offset_x
        self.offset_y = offset_y
        self.solid = solid  # blocks movement
        self.trigger = trigger  # only detects overlap
        self.collision_layers = set()  # which layers this collides with
        self.collision_mask = 0  # bitmask for collision layers


class AnimationComponent(Component):
    """Animation state and control component."""
    
    def __init__(self, current_animation: str = "idle", 
                 frame_time: float = 0.1, loop: bool = True):
        super().__init__()
        self.current_animation = current_animation
        self.frame_time = frame_time  # time per frame
        self.loop = loop
        self.current_frame = 0
        self.time_accumulator = 0.0
        self.animations = {}  # animation_name -> list of frame data
        self.playing = True


class HealthComponent(Component):
    """Health and damage component."""
    
    def __init__(self, max_health: int = 1, current_health: Optional[int] = None,
                 invulnerable: bool = False, invulnerability_time: float = 0):
        super().__init__()
        self.max_health = max_health
        self.current_health = current_health if current_health is not None else max_health
        self.invulnerable = invulnerable
        self.invulnerability_time = invulnerability_time
        self.invulnerability_timer = 0.0
    
    @property
    def is_alive(self) -> bool:
        """Check if entity is alive."""
        return self.current_health > 0
    
    @property
    def health_percentage(self) -> float:
        """Get health as percentage."""
        return self.current_health / self.max_health if self.max_health > 0 else 0


class InputComponent(Component):
    """Input state component for controllable entities."""
    
    def __init__(self):
        super().__init__()
        self.keys_down = set()
        self.keys_pressed = set()  # just pressed this frame
        self.keys_released = set()  # just released this frame
        self.mouse_pos = (0, 0)
        self.mouse_buttons = set()
        self.mouse_clicked = set()  # just clicked this frame


class AudioComponent(Component):
    """Audio playback component."""
    
    def __init__(self, sound_path: str = "", volume: float = 1.0,
                 loop: bool = False, auto_play: bool = False):
        super().__init__()
        self.sound_path = sound_path
        self.volume = volume
        self.loop = loop
        self.auto_play = auto_play
        self.playing = False
        self.position = 0.0  # playback position


class TagComponent(Component):
    """Simple tag component for entity identification."""
    
    def __init__(self, tag: str = ""):
        super().__init__()
        self.tag = tag


class ScriptComponent(Component):
    """Component for custom behavior scripts."""
    
    def __init__(self, script_path: str = "", 
                 parameters: Optional[Dict[str, Any]] = None):
        super().__init__()
        self.script_path = script_path
        self.parameters = parameters or {}
        self.script_instance = None