"""
Input System - Handles keyboard, mouse, and gamepad input.

This system processes input events and updates InputComponent states,
providing a clean interface between hardware input and game logic.
"""

from typing import Set, Type, Dict, Any, Optional
import pygame

from ..core.system import System
from ..core.entity import Entity
from ..core.component import Component, InputComponent
from ..core.event_bus import GameEvents


class InputSystem(System):
    """
    System for handling player input and updating input components.
    
    The InputSystem translates pygame input events into component state
    and publishes input events for other systems to react to.
    """
    
    def __init__(self, priority: int = 10):
        super().__init__(priority)
        
        # Input state tracking
        self.keys_down: Set[int] = set()
        self.keys_pressed: Set[int] = set()  # Just pressed this frame
        self.keys_released: Set[int] = set()  # Just released this frame
        
        self.mouse_pos = (0, 0)
        self.mouse_buttons: Set[int] = set()
        self.mouse_clicked: Set[int] = set()  # Just clicked this frame
        self.mouse_released: Set[int] = set()  # Just released this frame
        
        # Key bindings configuration
        self.key_bindings: Dict[str, Set[int]] = {
            'left': {pygame.K_LEFT, pygame.K_a},
            'right': {pygame.K_RIGHT, pygame.K_d},
            'up': {pygame.K_UP, pygame.K_w},
            'down': {pygame.K_DOWN, pygame.K_s},
            'jump': {pygame.K_SPACE, pygame.K_UP, pygame.K_w},
            'action': {pygame.K_e, pygame.K_RETURN},
            'pause': {pygame.K_ESCAPE, pygame.K_p}
        }
        
        # Previous frame state for edge detection
        self._prev_keys_down: Set[int] = set()
        self._prev_mouse_buttons: Set[int] = set()
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return {InputComponent}
    
    def initialize(self):
        """Initialize input system."""
        super().initialize()
        
        # Subscribe to input events
        if self.world:
            self.world.event_bus.subscribe(
                'raw_input', self._handle_raw_input
            )
    
    def update(self, entities, delta_time: float):
        """Process input events and update input components."""
        # Update edge detection for keys
        self.keys_pressed = self.keys_down - self._prev_keys_down
        self.keys_released = self._prev_keys_down - self.keys_down
        
        # Update edge detection for mouse
        self.mouse_clicked = self.mouse_buttons - self._prev_mouse_buttons
        self.mouse_released = self._prev_mouse_buttons - self.mouse_buttons
        
        # Update all input components
        for entity in entities:
            input_comp = entity.get_component(InputComponent)
            if input_comp:
                self._update_input_component(entity, input_comp)
        
        # Publish input events
        self._publish_input_events()
        
        # Store state for next frame
        self._prev_keys_down = self.keys_down.copy()
        self._prev_mouse_buttons = self.mouse_buttons.copy()
    
    def _update_input_component(self, entity: Entity, input_comp: InputComponent):
        """Update an input component with current input state."""
        # Update key states
        input_comp.keys_down = self.keys_down.copy()
        input_comp.keys_pressed = self.keys_pressed.copy()
        input_comp.keys_released = self.keys_released.copy()
        
        # Update mouse states
        input_comp.mouse_pos = self.mouse_pos
        input_comp.mouse_buttons = self.mouse_buttons.copy()
        input_comp.mouse_clicked = self.mouse_clicked.copy()
    
    def _publish_input_events(self):
        """Publish input events for other systems."""
        if not self.world:
            return
        
        # Publish key events
        for key in self.keys_pressed:
            action = self._get_action_for_key(key)
            if action:
                self.world.event_bus.publish(
                    f'input_{action}_pressed',
                    {'key': key, 'action': action}
                )
        
        for key in self.keys_released:
            action = self._get_action_for_key(key)
            if action:
                self.world.event_bus.publish(
                    f'input_{action}_released',
                    {'key': key, 'action': action}
                )
        
        # Publish mouse events
        for button in self.mouse_clicked:
            self.world.event_bus.publish(
                'mouse_clicked',
                {'button': button, 'position': self.mouse_pos}
            )
        
        for button in self.mouse_released:
            self.world.event_bus.publish(
                'mouse_released',
                {'button': button, 'position': self.mouse_pos}
            )
    
    def _get_action_for_key(self, key: int) -> Optional[str]:
        """Get action name for a key code."""
        for action, keys in self.key_bindings.items():
            if key in keys:
                return action
        return None
    
    def _handle_raw_input(self, event):
        """Handle raw pygame input events."""
        # This would be called from the main game loop
        # when pygame events are processed
        pass
    
    def process_pygame_events(self, events):
        """
        Process pygame events and update input state.
        
        This should be called from the main game loop.
        
        Args:
            events: List of pygame events
        """
        for event in events:
            if event.type == pygame.KEYDOWN:
                self.keys_down.add(event.key)
            elif event.type == pygame.KEYUP:
                self.keys_down.discard(event.key)
            elif event.type == pygame.MOUSEBUTTONDOWN:
                self.mouse_buttons.add(event.button)
            elif event.type == pygame.MOUSEBUTTONUP:
                self.mouse_buttons.discard(event.button)
            elif event.type == pygame.MOUSEMOTION:
                self.mouse_pos = event.pos
    
    def is_action_pressed(self, action: str) -> bool:
        """Check if an action is currently pressed."""
        if action in self.key_bindings:
            return any(key in self.keys_down for key in self.key_bindings[action])
        return False
    
    def is_action_just_pressed(self, action: str) -> bool:
        """Check if an action was just pressed this frame."""
        if action in self.key_bindings:
            return any(key in self.keys_pressed for key in self.key_bindings[action])
        return False
    
    def is_action_just_released(self, action: str) -> bool:
        """Check if an action was just released this frame."""
        if action in self.key_bindings:
            return any(key in self.keys_released for key in self.key_bindings[action])
        return False
    
    def bind_key(self, action: str, key: int):
        """Bind a key to an action."""
        if action not in self.key_bindings:
            self.key_bindings[action] = set()
        self.key_bindings[action].add(key)
    
    def unbind_key(self, action: str, key: int):
        """Unbind a key from an action."""
        if action in self.key_bindings:
            self.key_bindings[action].discard(key)
    
    def clear_bindings(self, action: str):
        """Clear all key bindings for an action."""
        if action in self.key_bindings:
            self.key_bindings[action].clear()
    
    def get_bindings(self) -> Dict[str, Set[int]]:
        """Get current key bindings."""
        return self.key_bindings.copy()