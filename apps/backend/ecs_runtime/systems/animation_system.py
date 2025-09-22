"""
Animation System - Handles sprite animation and state management.

Manages frame-based animations, animation state transitions,
and synchronization with entity behavior.
"""

from typing import Set, Type, Dict, Any, List, Optional, Tuple

from ..core.system import System
from ..core.entity import Entity
from ..core.component import Component, AnimationComponent, SpriteComponent
from ..core.event_bus import GameEvents


class AnimationFrame:
    """Represents a single animation frame."""
    
    def __init__(self, texture_path: str = "", duration: float = 0.1,
                 offset_x: int = 0, offset_y: int = 0, 
                 width: int = 32, height: int = 32):
        self.texture_path = texture_path
        self.duration = duration
        self.offset_x = offset_x
        self.offset_y = offset_y
        self.width = width
        self.height = height


class Animation:
    """Represents a complete animation sequence."""
    
    def __init__(self, name: str, frames: List[AnimationFrame], 
                 loop: bool = True, next_animation: Optional[str] = None):
        self.name = name
        self.frames = frames
        self.loop = loop
        self.next_animation = next_animation  # Auto-transition to this animation
        
        # Calculate total duration
        self.total_duration = sum(frame.duration for frame in frames)
    
    def get_frame_at_time(self, time: float) -> Tuple[int, AnimationFrame]:
        """Get frame index and frame at a specific time."""
        if not self.frames:
            return 0, None
        
        if self.loop:
            time = time % self.total_duration
        elif time >= self.total_duration:
            # Clamp to last frame
            return len(self.frames) - 1, self.frames[-1]
        
        accumulated_time = 0
        for i, frame in enumerate(self.frames):
            if time < accumulated_time + frame.duration:
                return i, frame
            accumulated_time += frame.duration
        
        # Fallback to last frame
        return len(self.frames) - 1, self.frames[-1]


class AnimationSystem(System):
    """
    System for updating sprite animations based on time and entity state.
    
    Handles frame progression, animation state transitions, and
    sprite component updates based on current animation state.
    """
    
    def __init__(self, priority: int = 40):
        super().__init__(priority)
        
        # Global animation library
        self.animations: Dict[str, Animation] = {}
        
        # Animation state machines for different entity types
        self.state_machines: Dict[str, Dict[str, str]] = {}
        
        # Default animation configurations
        self._setup_default_animations()
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return {AnimationComponent, SpriteComponent}
    
    def initialize(self):
        """Initialize animation system."""
        super().initialize()
        
        # Subscribe to events that might trigger animation changes
        if self.world:
            self.world.event_bus.subscribe(
                GameEvents.PLAYER_MOVED, self._handle_movement_event
            )
            self.world.event_bus.subscribe(
                GameEvents.PLAYER_JUMPED, self._handle_jump_event
            )
            self.world.event_bus.subscribe(
                GameEvents.PLAYER_LANDED, self._handle_land_event
            )
    
    def update(self, entities, delta_time: float):
        """Update animations for all entities."""
        for entity in entities:
            animation_comp = entity.get_component(AnimationComponent)
            sprite_comp = entity.get_component(SpriteComponent)
            
            if animation_comp and sprite_comp:
                self._update_entity_animation(entity, animation_comp, sprite_comp, delta_time)
    
    def _update_entity_animation(self, entity: Entity, animation_comp: AnimationComponent,
                                sprite_comp: SpriteComponent, delta_time: float):
        """Update animation for a single entity."""
        if not animation_comp.playing:
            return
        
        current_animation = self.animations.get(animation_comp.current_animation)
        if not current_animation:
            return
        
        # Update time accumulator
        animation_comp.time_accumulator += delta_time
        
        # Get current frame
        frame_index, frame = current_animation.get_frame_at_time(
            animation_comp.time_accumulator
        )
        
        if frame:
            # Update sprite component with frame data
            sprite_comp.texture_path = frame.texture_path
            sprite_comp.width = frame.width
            sprite_comp.height = frame.height
            
            # Check if frame changed
            if frame_index != animation_comp.current_frame:
                old_frame = animation_comp.current_frame
                animation_comp.current_frame = frame_index
                
                # Publish frame change event
                if self.world:
                    self.world.event_bus.publish(
                        'animation_frame_changed',
                        {
                            'animation': animation_comp.current_animation,
                            'old_frame': old_frame,
                            'new_frame': frame_index,
                            'total_frames': len(current_animation.frames)
                        },
                        source_entity_id=entity.id
                    )
        
        # Check for animation completion
        if (not current_animation.loop and 
            animation_comp.time_accumulator >= current_animation.total_duration):
            
            # Animation finished
            if self.world:
                self.world.event_bus.publish(
                    GameEvents.ANIMATION_FINISHED,
                    {
                        'animation': animation_comp.current_animation,
                        'entity_id': entity.id
                    },
                    source_entity_id=entity.id
                )
            
            # Auto-transition to next animation if specified
            if current_animation.next_animation:
                self.play_animation(entity, current_animation.next_animation)
            else:
                animation_comp.playing = False
        
        # Check for loop completion
        elif (current_animation.loop and 
              animation_comp.time_accumulator >= current_animation.total_duration):
            
            # Reset time for loop
            animation_comp.time_accumulator = 0
            animation_comp.current_frame = 0
            
            if self.world:
                self.world.event_bus.publish(
                    GameEvents.ANIMATION_LOOP,
                    {
                        'animation': animation_comp.current_animation,
                        'entity_id': entity.id
                    },
                    source_entity_id=entity.id
                )
    
    def play_animation(self, entity: Entity, animation_name: str, 
                      reset_time: bool = True) -> bool:
        """
        Play an animation on an entity.
        
        Args:
            entity: Entity to animate
            animation_name: Name of animation to play
            reset_time: Whether to reset animation time
            
        Returns:
            True if animation was started successfully
        """
        animation_comp = entity.get_component(AnimationComponent)
        
        if not animation_comp or animation_name not in self.animations:
            return False
        
        # Don't restart the same animation unless explicitly requested
        if (animation_comp.current_animation == animation_name and 
            animation_comp.playing and not reset_time):
            return True
        
        animation_comp.current_animation = animation_name
        animation_comp.playing = True
        
        if reset_time:
            animation_comp.time_accumulator = 0
            animation_comp.current_frame = 0
        
        # Publish animation start event
        if self.world:
            self.world.event_bus.publish(
                GameEvents.ANIMATION_STARTED,
                {
                    'animation': animation_name,
                    'entity_id': entity.id
                },
                source_entity_id=entity.id
            )
        
        return True
    
    def stop_animation(self, entity: Entity):
        """Stop current animation on an entity."""
        animation_comp = entity.get_component(AnimationComponent)
        if animation_comp:
            animation_comp.playing = False
    
    def pause_animation(self, entity: Entity):
        """Pause current animation on an entity."""
        animation_comp = entity.get_component(AnimationComponent)
        if animation_comp:
            animation_comp.playing = False
    
    def resume_animation(self, entity: Entity):
        """Resume paused animation on an entity."""
        animation_comp = entity.get_component(AnimationComponent)
        if animation_comp:
            animation_comp.playing = True
    
    def add_animation(self, animation: Animation):
        """Add an animation to the global library."""
        self.animations[animation.name] = animation
    
    def remove_animation(self, animation_name: str):
        """Remove an animation from the global library."""
        if animation_name in self.animations:
            del self.animations[animation_name]
    
    def create_animation_from_spritesheet(self, name: str, spritesheet_path: str,
                                        frame_width: int, frame_height: int,
                                        frame_count: int, frame_duration: float = 0.1,
                                        loop: bool = True) -> Animation:
        """
        Create an animation from a spritesheet.
        
        Args:
            name: Animation name
            spritesheet_path: Path to spritesheet image
            frame_width: Width of each frame
            frame_height: Height of each frame
            frame_count: Number of frames
            frame_duration: Duration per frame
            loop: Whether animation loops
            
        Returns:
            Created Animation object
        """
        frames = []
        
        for i in range(frame_count):
            # Calculate frame position in spritesheet
            # Assumes horizontal layout for now
            offset_x = i * frame_width
            offset_y = 0
            
            frame = AnimationFrame(
                texture_path=spritesheet_path,
                duration=frame_duration,
                offset_x=offset_x,
                offset_y=offset_y,
                width=frame_width,
                height=frame_height
            )
            frames.append(frame)
        
        animation = Animation(name, frames, loop)
        self.add_animation(animation)
        return animation
    
    def _setup_default_animations(self):
        """Set up default animations for common entity types."""
        # Player animations
        self.create_animation_from_spritesheet(
            'player_idle', 'player_idle.png', 32, 32, 4, 0.2, True
        )
        self.create_animation_from_spritesheet(
            'player_walk', 'player_walk.png', 32, 32, 6, 0.15, True
        )
        self.create_animation_from_spritesheet(
            'player_jump', 'player_jump.png', 32, 32, 3, 0.1, False
        )
        self.create_animation_from_spritesheet(
            'player_fall', 'player_fall.png', 32, 32, 2, 0.15, True
        )
        
        # Enemy animations
        self.create_animation_from_spritesheet(
            'enemy_idle', 'enemy_idle.png', 32, 32, 2, 0.5, True
        )
        self.create_animation_from_spritesheet(
            'enemy_walk', 'enemy_walk.png', 32, 32, 4, 0.2, True
        )
        
        # Collectible animations
        self.create_animation_from_spritesheet(
            'coin_spin', 'coin.png', 16, 16, 8, 0.1, True
        )
        self.create_animation_from_spritesheet(
            'gem_sparkle', 'gem.png', 24, 24, 6, 0.15, True
        )
    
    def _handle_movement_event(self, event):
        """Handle movement events to trigger appropriate animations."""
        # This would be called when entities move
        # Implementation depends on specific game requirements
        pass
    
    def _handle_jump_event(self, event):
        """Handle jump events to trigger jump animations."""
        # This would trigger jump animation on the entity that jumped
        pass
    
    def _handle_land_event(self, event):
        """Handle landing events to trigger landing animations."""
        # This would trigger landing animation or return to idle/walk
        pass