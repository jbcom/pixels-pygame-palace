"""
UI System - Handles user interface rendering and interaction.

Manages UI components, HUD elements, menus, and user interaction.
Provides both immediate mode and retained mode UI support.
"""

import pygame
from typing import Set, Type, Dict, Any, List, Optional, Callable
from enum import Enum

from ..core.system import System
from ..core.entity import Entity
from ..core.component import Component, TransformComponent
from ..core.event_bus import GameEvents


class UIElement:
    """Base class for UI elements."""
    
    def __init__(self, x: float, y: float, width: float, height: float):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.visible = True
        self.enabled = True
        self.parent = None
        self.children = []
        
        # Style properties
        self.background_color = (50, 50, 50)
        self.border_color = (100, 100, 100)
        self.border_width = 1
        self.padding = 4
        
        # Event callbacks
        self.on_click = None
        self.on_hover = None
        self.on_focus = None
    
    def add_child(self, child: 'UIElement'):
        """Add a child element."""
        child.parent = self
        self.children.append(child)
    
    def remove_child(self, child: 'UIElement'):
        """Remove a child element."""
        if child in self.children:
            child.parent = None
            self.children.remove(child)
    
    def get_absolute_position(self) -> tuple:
        """Get absolute screen position."""
        if self.parent:
            parent_x, parent_y = self.parent.get_absolute_position()
            return (parent_x + self.x, parent_y + self.y)
        return (self.x, self.y)
    
    def contains_point(self, x: float, y: float) -> bool:
        """Check if point is within element bounds."""
        abs_x, abs_y = self.get_absolute_position()
        return (abs_x <= x <= abs_x + self.width and 
                abs_y <= y <= abs_y + self.height)
    
    def handle_click(self, x: float, y: float) -> bool:
        """Handle mouse click. Returns True if handled."""
        if not self.visible or not self.enabled:
            return False
        
        # Check children first (front to back)
        for child in reversed(self.children):
            if child.handle_click(x, y):
                return True
        
        # Check self
        if self.contains_point(x, y):
            if self.on_click:
                self.on_click(self, x, y)
            return True
        
        return False
    
    def update(self, delta_time: float):
        """Update element logic."""
        for child in self.children:
            child.update(delta_time)
    
    def render(self, screen):
        """Render element and children."""
        if not self.visible:
            return
        
        self._render_self(screen)
        
        for child in self.children:
            child.render(screen)
    
    def _render_self(self, screen):
        """Render this element (override in subclasses)."""
        abs_x, abs_y = self.get_absolute_position()
        rect = pygame.Rect(abs_x, abs_y, self.width, self.height)
        
        # Draw background
        pygame.draw.rect(screen, self.background_color, rect)
        
        # Draw border
        if self.border_width > 0:
            pygame.draw.rect(screen, self.border_color, rect, self.border_width)


class UIButton(UIElement):
    """Button UI element."""
    
    def __init__(self, x: float, y: float, width: float, height: float, text: str = ""):
        super().__init__(x, y, width, height)
        self.text = text
        self.font = None  # Will be set by UI system
        self.text_color = (255, 255, 255)
        self.hover_color = (70, 70, 70)
        self.pressed_color = (30, 30, 30)
        
        self.is_hovered = False
        self.is_pressed = False
    
    def _render_self(self, screen):
        """Render button with text."""
        abs_x, abs_y = self.get_absolute_position()
        rect = pygame.Rect(abs_x, abs_y, self.width, self.height)
        
        # Choose background color based on state
        bg_color = self.background_color
        if self.is_pressed:
            bg_color = self.pressed_color
        elif self.is_hovered:
            bg_color = self.hover_color
        
        # Draw background
        pygame.draw.rect(screen, bg_color, rect)
        
        # Draw border
        if self.border_width > 0:
            pygame.draw.rect(screen, self.border_color, rect, self.border_width)
        
        # Draw text
        if self.text and self.font:
            text_surface = self.font.render(self.text, True, self.text_color)
            text_rect = text_surface.get_rect(center=rect.center)
            screen.blit(text_surface, text_rect)


class UILabel(UIElement):
    """Label UI element for displaying text."""
    
    def __init__(self, x: float, y: float, text: str = "", width: float = 0, height: float = 0):
        super().__init__(x, y, width, height)
        self.text = text
        self.font = None
        self.text_color = (255, 255, 255)
        self.text_align = 'left'  # 'left', 'center', 'right'
        self.auto_size = width == 0 or height == 0
    
    def _render_self(self, screen):
        """Render label text."""
        if not self.text or not self.font:
            return
        
        abs_x, abs_y = self.get_absolute_position()
        
        text_surface = self.font.render(self.text, True, self.text_color)
        
        if self.auto_size:
            self.width = text_surface.get_width()
            self.height = text_surface.get_height()
        
        # Calculate text position based on alignment
        if self.text_align == 'center':
            text_x = abs_x + (self.width - text_surface.get_width()) / 2
        elif self.text_align == 'right':
            text_x = abs_x + self.width - text_surface.get_width()
        else:  # left
            text_x = abs_x
        
        text_y = abs_y + (self.height - text_surface.get_height()) / 2
        
        screen.blit(text_surface, (text_x, text_y))


class UIProgressBar(UIElement):
    """Progress bar UI element."""
    
    def __init__(self, x: float, y: float, width: float, height: float):
        super().__init__(x, y, width, height)
        self.value = 0.0  # 0.0 to 1.0
        self.max_value = 1.0
        self.fill_color = (0, 255, 0)
        self.empty_color = (100, 100, 100)
    
    def set_value(self, value: float, max_value: float = None):
        """Set progress value."""
        if max_value is not None:
            self.max_value = max_value
        self.value = max(0, min(value, self.max_value))
    
    def _render_self(self, screen):
        """Render progress bar."""
        abs_x, abs_y = self.get_absolute_position()
        
        # Draw background
        bg_rect = pygame.Rect(abs_x, abs_y, self.width, self.height)
        pygame.draw.rect(screen, self.empty_color, bg_rect)
        
        # Draw fill
        if self.value > 0 and self.max_value > 0:
            fill_width = (self.value / self.max_value) * self.width
            fill_rect = pygame.Rect(abs_x, abs_y, fill_width, self.height)
            pygame.draw.rect(screen, self.fill_color, fill_rect)
        
        # Draw border
        if self.border_width > 0:
            pygame.draw.rect(screen, self.border_color, bg_rect, self.border_width)


class UIComponent(Component):
    """Component for entities that have UI elements."""
    
    def __init__(self):
        super().__init__()
        self.elements: List[UIElement] = []
        self.layer = 0  # UI rendering layer
        self.screen_space = True  # True for screen space, False for world space


class HUDComponent(Component):
    """Component for HUD elements like health bars, score displays."""
    
    def __init__(self):
        super().__init__()
        self.health_bar: Optional[UIProgressBar] = None
        self.score_label: Optional[UILabel] = None
        self.lives_label: Optional[UILabel] = None
        self.time_label: Optional[UILabel] = None
        
        # HUD data
        self.health = 100
        self.max_health = 100
        self.score = 0
        self.lives = 3
        self.time_remaining = 0


class UISystem(System):
    """
    System for managing and rendering UI elements.
    
    Handles UI element updates, rendering, and interaction.
    """
    
    def __init__(self, priority: int = 900, screen=None):
        super().__init__(priority)
        self.screen = screen
        
        # UI state
        self.mouse_position = (0, 0)
        self.mouse_clicked = False
        self.hovered_element = None
        self.focused_element = None
        
        # Fonts
        self.fonts: Dict[str, pygame.font.Font] = {}
        self._load_default_fonts()
        
        # UI layers for rendering order
        self.ui_layers: Dict[int, List[Entity]] = {}
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return {UIComponent}
    
    def initialize(self):
        """Initialize UI system."""
        super().initialize()
        
        # Subscribe to input events
        if self.world:
            self.world.event_bus.subscribe(
                'mouse_clicked', self._handle_mouse_click
            )
            self.world.event_bus.subscribe(
                'mouse_moved', self._handle_mouse_move
            )
    
    def update(self, entities, delta_time: float):
        """Update UI for all entities."""
        # Clear layers
        self.ui_layers.clear()
        
        # Group entities by UI layer
        for entity in entities:
            ui_comp = entity.get_component(UIComponent)
            if ui_comp:
                layer = ui_comp.layer
                if layer not in self.ui_layers:
                    self.ui_layers[layer] = []
                self.ui_layers[layer].append(entity)
        
        # Update UI elements
        for entity in entities:
            ui_comp = entity.get_component(UIComponent)
            if ui_comp:
                for element in ui_comp.elements:
                    element.update(delta_time)
    
    def render(self):
        """Render all UI elements."""
        if not self.screen:
            return
        
        # Render layers in order
        for layer in sorted(self.ui_layers.keys()):
            for entity in self.ui_layers[layer]:
                ui_comp = entity.get_component(UIComponent)
                if ui_comp:
                    for element in ui_comp.elements:
                        element.render(self.screen)
    
    def create_button(self, entity: Entity, x: float, y: float, width: float, height: float,
                     text: str, on_click: Callable = None) -> UIButton:
        """Create a button and add it to an entity."""
        ui_comp = entity.get_component(UIComponent)
        if not ui_comp:
            ui_comp = UIComponent()
            entity.add_component(ui_comp)
        
        button = UIButton(x, y, width, height, text)
        button.font = self.fonts.get('default')
        button.on_click = on_click
        
        ui_comp.elements.append(button)
        return button
    
    def create_label(self, entity: Entity, x: float, y: float, text: str,
                    font_name: str = 'default') -> UILabel:
        """Create a label and add it to an entity."""
        ui_comp = entity.get_component(UIComponent)
        if not ui_comp:
            ui_comp = UIComponent()
            entity.add_component(ui_comp)
        
        label = UILabel(x, y, text)
        label.font = self.fonts.get(font_name)
        
        ui_comp.elements.append(label)
        return label
    
    def create_progress_bar(self, entity: Entity, x: float, y: float, 
                           width: float, height: float) -> UIProgressBar:
        """Create a progress bar and add it to an entity."""
        ui_comp = entity.get_component(UIComponent)
        if not ui_comp:
            ui_comp = UIComponent()
            entity.add_component(ui_comp)
        
        progress_bar = UIProgressBar(x, y, width, height)
        ui_comp.elements.append(progress_bar)
        return progress_bar
    
    def _load_default_fonts(self):
        """Load default fonts."""
        try:
            pygame.font.init()
            self.fonts['default'] = pygame.font.Font(None, 24)
            self.fonts['small'] = pygame.font.Font(None, 18)
            self.fonts['large'] = pygame.font.Font(None, 32)
            self.fonts['title'] = pygame.font.Font(None, 48)
        except Exception as e:
            print(f"Error loading fonts: {e}")
    
    def _handle_mouse_click(self, event):
        """Handle mouse click events."""
        self.mouse_position = event.data.get('position', (0, 0))
        self.mouse_clicked = True
        
        # Propagate click to UI elements (in reverse layer order for proper z-ordering)
        for layer in sorted(self.ui_layers.keys(), reverse=True):
            for entity in self.ui_layers[layer]:
                ui_comp = entity.get_component(UIComponent)
                if ui_comp:
                    for element in ui_comp.elements:
                        if element.handle_click(*self.mouse_position):
                            return  # Click was handled
    
    def _handle_mouse_move(self, event):
        """Handle mouse movement events."""
        self.mouse_position = event.data.get('position', (0, 0))
        
        # Update hover states
        # Implementation would check which elements are under the mouse


class HUDSystem(UISystem):
    """
    Specialized system for HUD (Heads-Up Display) elements.
    
    Manages common HUD elements like health bars, score displays, etc.
    """
    
    def __init__(self, priority: int = 910, screen=None):
        super().__init__(priority, screen)
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return {HUDComponent}
    
    def update(self, entities, delta_time: float):
        """Update HUD elements."""
        for entity in entities:
            hud_comp = entity.get_component(HUDComponent)
            if hud_comp:
                self._update_hud_elements(entity, hud_comp)
        
        # Call parent update for UI rendering
        super().update(entities, delta_time)
    
    def _update_hud_elements(self, entity: Entity, hud_comp: HUDComponent):
        """Update HUD component elements with current data."""
        # Update health bar
        if hud_comp.health_bar:
            hud_comp.health_bar.set_value(hud_comp.health, hud_comp.max_health)
        
        # Update score label
        if hud_comp.score_label:
            hud_comp.score_label.text = f"Score: {hud_comp.score}"
        
        # Update lives label
        if hud_comp.lives_label:
            hud_comp.lives_label.text = f"Lives: {hud_comp.lives}"
        
        # Update time label
        if hud_comp.time_label and hud_comp.time_remaining > 0:
            minutes = int(hud_comp.time_remaining // 60)
            seconds = int(hud_comp.time_remaining % 60)
            hud_comp.time_label.text = f"Time: {minutes:02d}:{seconds:02d}"
    
    def create_hud(self, entity: Entity, screen_width: int, screen_height: int):
        """Create standard HUD layout for an entity."""
        hud_comp = entity.get_component(HUDComponent)
        if not hud_comp:
            hud_comp = HUDComponent()
            entity.add_component(hud_comp)
        
        # Create UI component for rendering
        ui_comp = UIComponent()
        ui_comp.layer = 1000  # High layer for HUD
        entity.add_component(ui_comp)
        
        # Health bar (top-left)
        hud_comp.health_bar = UIProgressBar(10, 10, 200, 20)
        hud_comp.health_bar.fill_color = (255, 0, 0)  # Red for health
        ui_comp.elements.append(hud_comp.health_bar)
        
        # Score label (top-center)
        hud_comp.score_label = UILabel(screen_width // 2 - 50, 10, "Score: 0")
        hud_comp.score_label.font = self.fonts.get('default')
        hud_comp.score_label.text_align = 'center'
        ui_comp.elements.append(hud_comp.score_label)
        
        # Lives label (top-right)
        hud_comp.lives_label = UILabel(screen_width - 100, 10, "Lives: 3")
        hud_comp.lives_label.font = self.fonts.get('default')
        hud_comp.lives_label.text_align = 'right'
        ui_comp.elements.append(hud_comp.lives_label)
        
        # Time label (top-right, below lives)
        hud_comp.time_label = UILabel(screen_width - 100, 35, "Time: 00:00")
        hud_comp.time_label.font = self.fonts.get('default')
        hud_comp.time_label.text_align = 'right'
        ui_comp.elements.append(hud_comp.time_label)