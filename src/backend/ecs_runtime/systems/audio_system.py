"""
Audio System - Handles sound effects and music playback.

Manages audio components, provides spatial audio support,
and handles background music and sound effect management.
"""

import pygame
from typing import Set, Type, Dict, Any, Optional
import os

from ..core.system import System
from ..core.entity import Entity
from ..core.component import Component, AudioComponent, TransformComponent
from ..core.event_bus import GameEvents


class AudioSystem(System):
    """
    System for managing audio playback including sound effects and music.
    
    Provides spatial audio, volume control, and music management.
    Integrates with pygame.mixer for audio playback.
    """
    
    def __init__(self, priority: int = 50, master_volume: float = 1.0,
                 sound_volume: float = 1.0, music_volume: float = 1.0):
        super().__init__(priority)
        
        # Volume controls
        self.master_volume = master_volume
        self.sound_volume = sound_volume
        self.music_volume = music_volume
        
        # Audio management
        self.loaded_sounds: Dict[str, pygame.mixer.Sound] = {}
        self.current_music = None
        self.music_position = 0.0
        
        # Spatial audio settings
        self.listener_position = (0, 0)
        self.max_audio_distance = 500
        self.audio_rolloff = 1.0
        
        # Audio channels for organization
        self.sound_channels = []
        self.music_channel = None
        
        # Initialize pygame mixer if not already initialized
        self._initialize_mixer()
    
    def _initialize_mixer(self):
        """Initialize pygame mixer with optimal settings."""
        try:
            if not pygame.mixer.get_init():
                # Initialize with good quality settings
                pygame.mixer.pre_init(
                    frequency=22050,  # Sample rate
                    size=-16,         # 16-bit signed samples
                    channels=2,       # Stereo
                    buffer=1024       # Buffer size
                )
                pygame.mixer.init()
            
            # Reserve channels for different audio types
            pygame.mixer.set_num_channels(32)  # Total channels
            self.sound_channels = list(range(24))  # Reserve 24 for sound effects
            self.music_channel = 31  # Reserve last channel for music
            
        except pygame.error as e:
            print(f"Warning: Audio system initialization failed: {e}")
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return {AudioComponent}
    
    @property
    def optional_components(self) -> Set[Type[Component]]:
        return {TransformComponent}
    
    def initialize(self):
        """Initialize audio system."""
        super().initialize()
        
        # Subscribe to audio events
        if self.world:
            self.world.event_bus.subscribe(
                GameEvents.SOUND_PLAY, self._handle_sound_play_event
            )
            self.world.event_bus.subscribe(
                GameEvents.SOUND_STOP, self._handle_sound_stop_event
            )
            self.world.event_bus.subscribe(
                GameEvents.MUSIC_CHANGED, self._handle_music_change_event
            )
    
    def update(self, entities, delta_time: float):
        """Update audio for all entities."""
        for entity in entities:
            audio_comp = entity.get_component(AudioComponent)
            if audio_comp and audio_comp.enabled:
                self._update_entity_audio(entity, audio_comp, delta_time)
    
    def _update_entity_audio(self, entity: Entity, audio_comp: AudioComponent, delta_time: float):
        """Update audio for a single entity."""
        # Handle auto-play
        if audio_comp.auto_play and not audio_comp.playing and audio_comp.sound_path:
            self.play_sound(entity, audio_comp.sound_path, audio_comp.volume, audio_comp.loop)
        
        # Update playback position for tracking
        if audio_comp.playing:
            audio_comp.position += delta_time
    
    def play_sound(self, entity: Entity, sound_path: str, volume: float = 1.0, 
                  loop: bool = False, spatial: bool = True) -> bool:
        """
        Play a sound effect.
        
        Args:
            entity: Entity playing the sound
            sound_path: Path to sound file
            volume: Volume level (0.0 to 1.0)
            loop: Whether to loop the sound
            spatial: Whether to apply spatial audio
            
        Returns:
            True if sound was played successfully
        """
        try:
            # Load sound if not already loaded
            sound = self._load_sound(sound_path)
            if not sound:
                return False
            
            # Calculate spatial audio if enabled and entity has transform
            final_volume = volume * self.sound_volume * self.master_volume
            
            if spatial:
                transform = entity.get_component(TransformComponent)
                if transform:
                    spatial_volume = self._calculate_spatial_volume(
                        (transform.x, transform.y), final_volume
                    )
                    final_volume = spatial_volume
            
            # Find available channel
            channel = self._find_available_channel()
            if channel is None:
                return False
            
            # Play sound
            loops = -1 if loop else 0
            pygame_channel = pygame.mixer.Channel(channel)
            pygame_channel.play(sound, loops=loops)
            pygame_channel.set_volume(final_volume)
            
            # Update audio component
            audio_comp = entity.get_component(AudioComponent)
            if audio_comp:
                audio_comp.playing = True
                audio_comp.sound_path = sound_path
                audio_comp.volume = volume
                audio_comp.loop = loop
                audio_comp.position = 0.0
            
            return True
            
        except Exception as e:
            print(f"Error playing sound {sound_path}: {e}")
            return False
    
    def stop_sound(self, entity: Entity):
        """Stop sound for an entity."""
        audio_comp = entity.get_component(AudioComponent)
        if audio_comp:
            audio_comp.playing = False
            audio_comp.position = 0.0
        
        # Stop all channels (simple approach - could be more sophisticated)
        # In a real implementation, you'd track which channel each entity is using
        for channel_id in self.sound_channels:
            channel = pygame.mixer.Channel(channel_id)
            if channel.get_busy():
                channel.stop()
    
    def play_music(self, music_path: str, volume: float = 1.0, 
                   loop: bool = True, fade_in: float = 0.0) -> bool:
        """
        Play background music.
        
        Args:
            music_path: Path to music file
            volume: Volume level (0.0 to 1.0)
            loop: Whether to loop the music
            fade_in: Fade in duration in seconds
            
        Returns:
            True if music was started successfully
        """
        try:
            # Stop current music
            self.stop_music()
            
            # Load and play new music
            pygame.mixer.music.load(music_path)
            
            loops = -1 if loop else 0
            if fade_in > 0:
                pygame.mixer.music.play(loops=loops, fade_ms=int(fade_in * 1000))
            else:
                pygame.mixer.music.play(loops=loops)
            
            # Set volume
            final_volume = volume * self.music_volume * self.master_volume
            pygame.mixer.music.set_volume(final_volume)
            
            self.current_music = music_path
            self.music_position = 0.0
            
            # Publish music change event
            if self.world:
                self.world.event_bus.publish(
                    GameEvents.MUSIC_CHANGED,
                    {'music_path': music_path, 'volume': volume}
                )
            
            return True
            
        except Exception as e:
            print(f"Error playing music {music_path}: {e}")
            return False
    
    def stop_music(self, fade_out: float = 0.0):
        """
        Stop background music.
        
        Args:
            fade_out: Fade out duration in seconds
        """
        try:
            if fade_out > 0:
                pygame.mixer.music.fadeout(int(fade_out * 1000))
            else:
                pygame.mixer.music.stop()
            
            self.current_music = None
            self.music_position = 0.0
            
        except Exception as e:
            print(f"Error stopping music: {e}")
    
    def pause_music(self):
        """Pause background music."""
        try:
            pygame.mixer.music.pause()
        except Exception as e:
            print(f"Error pausing music: {e}")
    
    def resume_music(self):
        """Resume paused background music."""
        try:
            pygame.mixer.music.unpause()
        except Exception as e:
            print(f"Error resuming music: {e}")
    
    def set_master_volume(self, volume: float):
        """Set master volume (affects all audio)."""
        self.master_volume = max(0.0, min(1.0, volume))
        self._update_all_volumes()
    
    def set_sound_volume(self, volume: float):
        """Set sound effects volume."""
        self.sound_volume = max(0.0, min(1.0, volume))
        self._update_all_volumes()
    
    def set_music_volume(self, volume: float):
        """Set music volume."""
        self.music_volume = max(0.0, min(1.0, volume))
        final_volume = volume * self.master_volume
        pygame.mixer.music.set_volume(final_volume)
    
    def set_listener_position(self, x: float, y: float):
        """Set listener position for spatial audio."""
        self.listener_position = (x, y)
    
    def _load_sound(self, sound_path: str) -> Optional[pygame.mixer.Sound]:
        """Load a sound file, using cache if available."""
        if sound_path in self.loaded_sounds:
            return self.loaded_sounds[sound_path]
        
        try:
            if os.path.exists(sound_path):
                sound = pygame.mixer.Sound(sound_path)
                self.loaded_sounds[sound_path] = sound
                return sound
            else:
                print(f"Sound file not found: {sound_path}")
                return None
        except Exception as e:
            print(f"Error loading sound {sound_path}: {e}")
            return None
    
    def _find_available_channel(self) -> Optional[int]:
        """Find an available audio channel."""
        for channel_id in self.sound_channels:
            channel = pygame.mixer.Channel(channel_id)
            if not channel.get_busy():
                return channel_id
        return None
    
    def _calculate_spatial_volume(self, sound_position: tuple, base_volume: float) -> float:
        """Calculate volume based on distance from listener."""
        if not self.listener_position:
            return base_volume
        
        # Calculate distance
        dx = sound_position[0] - self.listener_position[0]
        dy = sound_position[1] - self.listener_position[1]
        distance = (dx * dx + dy * dy) ** 0.5
        
        # Apply distance rolloff
        if distance >= self.max_audio_distance:
            return 0.0
        
        distance_factor = 1.0 - (distance / self.max_audio_distance)
        distance_factor = distance_factor ** self.audio_rolloff
        
        return base_volume * distance_factor
    
    def _update_all_volumes(self):
        """Update volumes for all playing audio."""
        # Update music volume
        if self.current_music:
            final_volume = self.music_volume * self.master_volume
            pygame.mixer.music.set_volume(final_volume)
        
        # Update sound effect volumes (would need per-channel tracking for precise control)
        # This is a simplified implementation
    
    def _handle_sound_play_event(self, event):
        """Handle sound play events."""
        data = event.data
        entity_id = data.get('entity_id')
        sound_path = data.get('sound_path')
        volume = data.get('volume', 1.0)
        loop = data.get('loop', False)
        
        if entity_id and sound_path and self.world:
            entity = self.world.get_entity(entity_id)
            if entity:
                self.play_sound(entity, sound_path, volume, loop)
    
    def _handle_sound_stop_event(self, event):
        """Handle sound stop events."""
        data = event.data
        entity_id = data.get('entity_id')
        
        if entity_id and self.world:
            entity = self.world.get_entity(entity_id)
            if entity:
                self.stop_sound(entity)
    
    def _handle_music_change_event(self, event):
        """Handle music change events."""
        data = event.data
        music_path = data.get('music_path')
        volume = data.get('volume', 1.0)
        loop = data.get('loop', True)
        fade_in = data.get('fade_in', 0.0)
        
        if music_path:
            self.play_music(music_path, volume, loop, fade_in)
    
    def get_audio_stats(self) -> Dict[str, Any]:
        """Get audio system statistics."""
        active_channels = sum(1 for channel_id in self.sound_channels 
                            if pygame.mixer.Channel(channel_id).get_busy())
        
        return {
            'master_volume': self.master_volume,
            'sound_volume': self.sound_volume,
            'music_volume': self.music_volume,
            'loaded_sounds': len(self.loaded_sounds),
            'active_channels': active_channels,
            'total_channels': len(self.sound_channels),
            'current_music': self.current_music,
            'music_playing': pygame.mixer.music.get_busy()
        }