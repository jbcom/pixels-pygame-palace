"""
Template Renderer - Jinja2-based template system for code generation.

This module provides template rendering for generating game code,
configuration files, and web-compatible wrappers.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional
import jinja2
import logging

logger = logging.getLogger(__name__)


class TemplateRenderer:
    """
    Jinja2-based template renderer for code generation.
    
    Provides templates for generating main.py, configuration files,
    and web-compatible game wrappers.
    """
    
    def __init__(self, template_dir: Optional[str] = None):
        """
        Initialize template renderer.
        
        Args:
            template_dir: Directory containing templates (uses default if None)
        """
        if template_dir is None:
            template_dir = Path(__file__).parent / 'jinja2'
        
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(exist_ok=True)
        
        # Initialize Jinja2 environment
        self.env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(self.template_dir)),
            autoescape=jinja2.select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True
        )
        
        # Add custom filters
        self._setup_custom_filters()
        
        # Create default templates if they don't exist
        self._create_default_templates()
    
    def _setup_custom_filters(self):
        """Set up custom Jinja2 filters."""
        
        def format_component_name(component_id: str) -> str:
            """Convert component ID to class name format."""
            return ''.join(word.capitalize() for word in component_id.split('-'))
        
        def format_variable_name(component_id: str) -> str:
            """Convert component ID to variable name format."""
            return component_id.replace('-', '_')
        
        def parse_color(color_str: str) -> str:
            """Parse color string to RGB tuple string."""
            if color_str.startswith('#'):
                hex_color = color_str[1:]
                if len(hex_color) == 6:
                    r = int(hex_color[0:2], 16)
                    g = int(hex_color[2:4], 16)
                    b = int(hex_color[4:6], 16)
                    return f"({r}, {g}, {b})"
            return "(135, 206, 235)"  # Default light blue
        
        def format_imports(imports: list) -> str:
            """Format import statements."""
            if not imports:
                return ""
            return "\n".join(f"import {imp}" if not imp.startswith('from ') else imp for imp in imports)
        
        # Register filters
        self.env.filters['component_name'] = format_component_name
        self.env.filters['variable_name'] = format_variable_name
        self.env.filters['parse_color'] = parse_color
        self.env.filters['format_imports'] = format_imports
    
    def render_main_py(self, template_data: Dict[str, Any]) -> str:
        """
        Render main.py template.
        
        Args:
            template_data: Data for template rendering
            
        Returns:
            Rendered Python code
        """
        try:
            template = self.env.get_template('main.py.j2')
            return template.render(**template_data)
        except jinja2.TemplateNotFound:
            logger.warning("main.py template not found, using fallback")
            return self._render_fallback_main(template_data)
        except Exception as e:
            logger.error(f"Error rendering main.py template: {e}")
            return self._render_fallback_main(template_data)
    
    def render_config_py(self, template_data: Dict[str, Any]) -> str:
        """
        Render config.py template.
        
        Args:
            template_data: Data for template rendering
            
        Returns:
            Rendered Python configuration code
        """
        try:
            template = self.env.get_template('config.py.j2')
            return template.render(**template_data)
        except jinja2.TemplateNotFound:
            return self._render_fallback_config(template_data)
        except Exception as e:
            logger.error(f"Error rendering config.py template: {e}")
            return self._render_fallback_config(template_data)
    
    def wrap_for_web(self, game_code: str, template_id: str) -> str:
        """
        Wrap game code for web compatibility (pygbag).
        
        Args:
            game_code: Original game code
            template_id: Template identifier
            
        Returns:
            Web-compatible wrapped code
        """
        try:
            template = self.env.get_template('web_wrapper.py.j2')
            return template.render(
                game_code=game_code,
                template_id=template_id
            )
        except jinja2.TemplateNotFound:
            return self._render_fallback_web_wrapper(game_code, template_id)
        except Exception as e:
            logger.error(f"Error rendering web wrapper template: {e}")
            return self._render_fallback_web_wrapper(game_code, template_id)
    
    def render_template(self, template_name: str, **kwargs) -> str:
        """
        Render a custom template.
        
        Args:
            template_name: Name of template file
            **kwargs: Template variables
            
        Returns:
            Rendered content
        """
        try:
            template = self.env.get_template(template_name)
            return template.render(**kwargs)
        except Exception as e:
            logger.error(f"Error rendering template {template_name}: {e}")
            raise
    
    def _create_default_templates(self):
        """Create default Jinja2 templates."""
        templates_to_create = [
            ('main.py.j2', self._get_main_template()),
            ('config.py.j2', self._get_config_template()),
            ('web_wrapper.py.j2', self._get_web_wrapper_template()),
            ('components.py.j2', self._get_components_template()),
            ('systems.py.j2', self._get_systems_template())
        ]
        
        for template_name, template_content in templates_to_create:
            template_path = self.template_dir / template_name
            if not template_path.exists():
                try:
                    template_path.write_text(template_content)
                    logger.info(f"Created template: {template_name}")
                except Exception as e:
                    logger.error(f"Failed to create template {template_name}: {e}")
    
    def _get_main_template(self) -> str:
        """Get main.py Jinja2 template."""
        return '''#!/usr/bin/env python3
"""
Generated Game - {{ template.name }}
Created with Pixel's PyGame Palace

Template: {{ template.id }}
Category: {{ template.category }}
Components: {{ components | map(attribute='id') | join(', ') }}
"""

import pygame
import sys
import os
from typing import Dict, Any

# ECS Runtime imports
from ecs_runtime import (
    World, Entity, EventBus,
    TransformComponent, VelocityComponent, SpriteComponent, 
    CollisionComponent, AnimationComponent, HealthComponent,
    InputComponent, AudioComponent,
    InputSystem, PhysicsSystem, PlatformerPhysicsSystem,
    CollisionSystem, AnimationSystem, AudioSystem,
    UISystem, HUDSystem, SceneManager
)

# Game configuration
SCREEN_WIDTH = {{ game_settings.screenWidth | default(800) }}
SCREEN_HEIGHT = {{ game_settings.screenHeight | default(600) }}
TARGET_FPS = {{ game_settings.targetFPS | default(60) }}
GAME_TITLE = "{{ template.name }}"

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
BACKGROUND_COLOR = {{ game_settings.backgroundColor | default('#87CEEB') | parse_color }}

class Game:
    """Main game class."""
    
    def __init__(self):
        """Initialize the game."""
        # Initialize pygame
        pygame.init()
        
        # Create display
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption(GAME_TITLE)
        self.clock = pygame.time.Clock()
        
        # Create ECS world
        self.world = World()
        self.running = True
        
        # Initialize systems
        self._setup_systems()
        
        # Initialize game entities
        self._setup_entities()
        
        # Start the world
        self.world.start()
    
    def _setup_systems(self):
        """Set up ECS systems."""
        # Input System
        input_system = InputSystem(priority=10)
        self.world.add_system(input_system)
        
        # Physics System
        {% if template.category == 'platformer' %}
        physics_system = PlatformerPhysicsSystem(priority=20, gravity={{ game_settings.physics.gravity | default(980) }})
        {% else %}
        physics_system = PhysicsSystem(priority=20, gravity={{ game_settings.physics.gravity | default(0) }})
        {% endif %}
        self.world.add_system(physics_system)
        
        {% if needs_collision %}
        # Collision System
        collision_system = CollisionSystem(priority=30)
        self.world.add_system(collision_system)
        {% endif %}
        
        {% if needs_animation %}
        # Animation System
        animation_system = AnimationSystem(priority=40)
        self.world.add_system(animation_system)
        {% endif %}
        
        {% if needs_audio %}
        # Audio System
        audio_system = AudioSystem(priority=50)
        self.world.add_system(audio_system)
        {% endif %}
        
        # UI Systems
        ui_system = UISystem(priority=900, screen=self.screen)
        self.world.add_system(ui_system)
        
        hud_system = HUDSystem(priority=910, screen=self.screen)
        self.world.add_system(hud_system)
    
    def _setup_entities(self):
        """Set up game entities."""
        {% for scene in scenes %}
        # Scene: {{ scene.name }}
        {% for entity in scene.entities %}
        # Entity: {{ entity.componentId }}
        entity_{{ loop.index }} = Entity(name='{{ entity.componentId }}_{{ loop.index }}')
        
        # Transform
        transform_{{ loop.index }} = TransformComponent({{ entity.position.x }}, {{ entity.position.y }})
        entity_{{ loop.index }}.add_component(transform_{{ loop.index }})
        
        {% set component_id = entity.componentId %}
        {% set config = entity.configuration %}
        
        {% if component_id == 'player-sprite' %}
        # Player components
        velocity_{{ loop.index }} = VelocityComponent()
        entity_{{ loop.index }}.add_component(velocity_{{ loop.index }})
        
        sprite_{{ loop.index }} = SpriteComponent('player.png', 32, 32)
        entity_{{ loop.index }}.add_component(sprite_{{ loop.index }})
        
        collision_{{ loop.index }} = CollisionComponent(32, 32)
        entity_{{ loop.index }}.add_component(collision_{{ loop.index }})
        
        health_{{ loop.index }} = HealthComponent({{ config.health | default(3) }})
        entity_{{ loop.index }}.add_component(health_{{ loop.index }})
        
        input_{{ loop.index }} = InputComponent()
        entity_{{ loop.index }}.add_component(input_{{ loop.index }})
        
        entity_{{ loop.index }}.add_tag('player')
        
        {% elif component_id == 'platform-ground' %}
        # Platform components
        sprite_{{ loop.index }} = SpriteComponent('platform.png', {{ config.width | default(128) }}, {{ config.height | default(32) }})
        entity_{{ loop.index }}.add_component(sprite_{{ loop.index }})
        
        collision_{{ loop.index }} = CollisionComponent({{ config.width | default(128) }}, {{ config.height | default(32) }}, solid=True)
        entity_{{ loop.index }}.add_component(collision_{{ loop.index }})
        
        entity_{{ loop.index }}.add_tag('platform')
        
        {% elif component_id == 'collectible-item' %}
        # Collectible components
        sprite_{{ loop.index }} = SpriteComponent('collectible.png', 24, 24)
        entity_{{ loop.index }}.add_component(sprite_{{ loop.index }})
        
        collision_{{ loop.index }} = CollisionComponent(24, 24, trigger=True)
        entity_{{ loop.index }}.add_component(collision_{{ loop.index }})
        
        animation_{{ loop.index }} = AnimationComponent('spin')
        entity_{{ loop.index }}.add_component(animation_{{ loop.index }})
        
        entity_{{ loop.index }}.add_tag('collectible')
        
        {% elif component_id == 'basic-enemy' %}
        # Enemy components
        velocity_{{ loop.index }} = VelocityComponent()
        entity_{{ loop.index }}.add_component(velocity_{{ loop.index }})
        
        sprite_{{ loop.index }} = SpriteComponent('enemy.png', 32, 32)
        entity_{{ loop.index }}.add_component(sprite_{{ loop.index }})
        
        collision_{{ loop.index }} = CollisionComponent(32, 32)
        entity_{{ loop.index }}.add_component(collision_{{ loop.index }})
        
        health_{{ loop.index }} = HealthComponent({{ config.health | default(1) }})
        entity_{{ loop.index }}.add_component(health_{{ loop.index }})
        
        entity_{{ loop.index }}.add_tag('enemy')
        {% endif %}
        
        self.world.add_entity(entity_{{ loop.index }})
        
        {% endfor %}
        {% endfor %}
    
    def handle_events(self):
        """Handle pygame events."""
        events = pygame.event.get()
        
        for event in events:
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
        
        # Update input system with events
        input_system = self.world.get_system(InputSystem)
        if input_system:
            input_system.process_pygame_events(events)
    
    def update(self, delta_time: float):
        """Update game logic."""
        if not self.world.paused:
            self.world.update(delta_time)
    
    def render(self):
        """Render the game."""
        # Clear screen
        self.screen.fill(BACKGROUND_COLOR)
        
        # Render UI
        ui_system = self.world.get_system(UISystem)
        if ui_system:
            ui_system.render()
        
        hud_system = self.world.get_system(HUDSystem)
        if hud_system:
            hud_system.render()
        
        # Update display
        pygame.display.flip()
    
    def run(self):
        """Main game loop."""
        last_time = pygame.time.get_ticks() / 1000.0
        
        while self.running:
            # Calculate delta time
            current_time = pygame.time.get_ticks() / 1000.0
            delta_time = current_time - last_time
            last_time = current_time
            
            # Limit delta time to prevent large jumps
            delta_time = min(delta_time, 1.0 / 15.0)
            
            # Game loop
            self.handle_events()
            self.update(delta_time)
            self.render()
            
            # Maintain target FPS
            self.clock.tick(TARGET_FPS)
        
        # Cleanup
        self.world.stop()
        pygame.quit()
        sys.exit()


def main():
    """Main entry point."""
    try:
        game = Game()
        game.run()
    except Exception as e:
        print(f"Game error: {e}")
        pygame.quit()
        sys.exit(1)


if __name__ == "__main__":
    main()
'''
    
    def _get_config_template(self) -> str:
        """Get config.py Jinja2 template."""
        return '''"""Game configuration settings."""

# Generated configuration
GAME_TITLE = "{{ template.name }}"
SCREEN_WIDTH = {{ game_settings.screenWidth | default(800) }}
SCREEN_HEIGHT = {{ game_settings.screenHeight | default(600) }}
TARGET_FPS = {{ game_settings.targetFPS | default(60) }}
GRAVITY = {{ game_settings.physics.gravity | default(980) }}
AUDIO_ENABLED = {{ game_settings.audio.enabled | default(true) | lower }}
AUDIO_VOLUME = {{ game_settings.audio.volume | default(0.7) }}

# Custom configuration
{% for key, value in custom_config.items() %}
{{ key.upper() }} = {% if value is string %}"{{ value }}"{% else %}{{ value }}{% endif %}
{% endfor %}
'''
    
    def _get_web_wrapper_template(self) -> str:
        """Get web wrapper Jinja2 template."""
        return '''"""
Web-compatible wrapper for {{ template_id }}
This file makes the game compatible with pygbag/WebAssembly
"""

import asyncio
import pygame
import sys

# Import the original game
{{ game_code }}

# Async wrapper for web compatibility
async def async_main():
    """Async wrapper for the main game loop."""
    game = Game()
    
    # Modify the run method for async compatibility
    last_time = pygame.time.get_ticks() / 1000.0
    
    while game.running:
        # Calculate delta time
        current_time = pygame.time.get_ticks() / 1000.0
        delta_time = current_time - last_time
        last_time = current_time
        
        # Limit delta time
        delta_time = min(delta_time, 1.0 / 15.0)
        
        # Game loop
        game.handle_events()
        game.update(delta_time)
        game.render()
        
        # Essential for pygbag - yield control to browser
        await asyncio.sleep(0)
        
        # Maintain target FPS
        game.clock.tick(TARGET_FPS)
    
    # Cleanup
    game.world.stop()
    pygame.quit()

# Entry point for web
if __name__ == "__main__":
    asyncio.run(async_main())
'''
    
    def _get_components_template(self) -> str:
        """Get components.py Jinja2 template."""
        return '''"""Custom game components."""

from ecs_runtime import Component

{% for component in custom_components %}
class {{ component.id | component_name }}(Component):
    """{{ component.description }}"""
    
    def __init__(self{% for param in component.params %}, {{ param.name }}={{ param.default }}{% endfor %}):
        super().__init__()
        {% for param in component.params %}
        self.{{ param.name }} = {{ param.name }}
        {% endfor %}

{% endfor %}
'''
    
    def _get_systems_template(self) -> str:
        """Get systems.py Jinja2 template."""
        return '''"""Custom game systems."""

from typing import Set, Type
from ecs_runtime import System, Entity, Component

{% for system in custom_systems %}
class {{ system.id | component_name }}(System):
    """{{ system.description }}"""
    
    def __init__(self, priority: int = {{ system.priority | default(100) }}):
        super().__init__(priority)
    
    @property
    def required_components(self) -> Set[Type[Component]]:
        return { {% for comp in system.required_components %}{{ comp | component_name }}{% if not loop.last %}, {% endif %}{% endfor %} }
    
    def update(self, entities, delta_time: float):
        """Update system logic."""
        for entity in entities:
            # TODO: Implement system logic
            pass

{% endfor %}
'''
    
    def _render_fallback_main(self, template_data: Dict[str, Any]) -> str:
        """Fallback main.py generation without Jinja2."""
        template = template_data.get('template', {})
        game_settings = template.get('gameSettings', {})
        
        return f'''#!/usr/bin/env python3
"""
Generated Game - {template.get('name', 'Untitled Game')}
"""

import pygame
import sys

# Game configuration
SCREEN_WIDTH = {game_settings.get('screenWidth', 800)}
SCREEN_HEIGHT = {game_settings.get('screenHeight', 600)}
TARGET_FPS = {game_settings.get('targetFPS', 60)}

def main():
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    clock = pygame.time.Clock()
    
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        
        screen.fill((0, 0, 0))
        pygame.display.flip()
        clock.tick(TARGET_FPS)
    
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
'''
    
    def _render_fallback_config(self, template_data: Dict[str, Any]) -> str:
        """Fallback config.py generation."""
        return '''"""Game configuration."""

GAME_TITLE = "Generated Game"
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
TARGET_FPS = 60
'''
    
    def _render_fallback_web_wrapper(self, game_code: str, template_id: str) -> str:
        """Fallback web wrapper generation."""
        return f'''"""Web wrapper for {template_id}"""

import asyncio
{game_code}

async def async_main():
    main()

if __name__ == "__main__":
    asyncio.run(async_main())
'''