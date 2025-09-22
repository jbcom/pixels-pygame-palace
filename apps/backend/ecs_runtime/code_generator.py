"""
Code Generator - Generates Python game code from ECS components and templates.

This module translates the visual component selections into executable
Python code using the ECS runtime system.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import json

from .core.entity import Entity
from .core.component import (
    TransformComponent, VelocityComponent, SpriteComponent, 
    CollisionComponent, AnimationComponent, HealthComponent,
    InputComponent, AudioComponent
)


@dataclass
class GeneratedCode:
    """Container for generated code files."""
    main_py: str
    components_py: str = ""
    systems_py: str = ""
    config_py: str = ""
    
    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary for file writing."""
        result = {"main.py": self.main_py}
        if self.components_py:
            result["components.py"] = self.components_py
        if self.systems_py:
            result["systems.py"] = self.systems_py
        if self.config_py:
            result["config.py"] = self.config_py
        return result


class CodeGenerator:
    """
    Generates executable Python game code from component selections.
    
    Takes a template and selected components and generates a complete
    pygame application using the ECS runtime system.
    """
    
    def __init__(self):
        """Initialize code generator."""
        # Component type mappings
        self.component_mappings = {
            'player-sprite': 'PlayerComponent',
            'platform-ground': 'PlatformComponent',
            'collectible-item': 'CollectibleComponent',
            'basic-enemy': 'EnemyComponent',
            'scrolling-background': 'BackgroundComponent',
            'ui-display': 'UIComponent',
            'sound-effect': 'AudioComponent',
            'particle-effect': 'ParticleComponent'
        }
        
        # System mappings
        self.system_mappings = {
            'input-handler': 'InputSystem',
            'physics-movement': 'PhysicsSystem',
            'collision-detection': 'CollisionSystem',
            'animation-controller': 'AnimationSystem',
            'weapon-controller': 'WeaponSystem',
            'projectile-spawner': 'ProjectileSystem'
        }
    
    def generate_game(self, template: Dict[str, Any], components: List[Dict[str, Any]], 
                     resolved_order: List[str], configuration: Dict[str, Any]) -> Dict[str, str]:
        """
        Generate complete game code.
        
        Args:
            template: Game template definition
            components: Selected components with configurations
            resolved_order: Dependency-resolved component order
            configuration: Game configuration settings
            
        Returns:
            Dictionary mapping filenames to code content
        """
        # Generate main game file
        main_code = self._generate_main_py(template, components, resolved_order, configuration)
        
        # Generate additional modules if needed
        components_code = self._generate_components_py(components)
        systems_code = self._generate_systems_py(template, components)
        config_code = self._generate_config_py(template, configuration)
        
        generated = GeneratedCode(
            main_py=main_code,
            components_py=components_code,
            systems_py=systems_code,
            config_py=config_code
        )
        
        return generated.to_dict()
    
    def _generate_main_py(self, template: Dict[str, Any], components: List[Dict[str, Any]], 
                         resolved_order: List[str], configuration: Dict[str, Any]) -> str:
        """Generate the main game file."""
        
        game_settings = template.get('gameSettings', {})
        screen_width = game_settings.get('screenWidth', 800)
        screen_height = game_settings.get('screenHeight', 600)
        target_fps = game_settings.get('targetFPS', 60)
        
        # Determine if this is a platformer or other game type
        category = template.get('category', 'platformer')
        
        code = f'''#!/usr/bin/env python3
"""
Generated Game - {template.get('name', 'Untitled Game')}
Created with Pixel's PyGame Palace

Template: {template.get('id', 'unknown')}
Category: {category}
Components: {', '.join(resolved_order)}
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
SCREEN_WIDTH = {screen_width}
SCREEN_HEIGHT = {screen_height}
TARGET_FPS = {target_fps}
GAME_TITLE = "{template.get('name', 'Generated Game')}"

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
BACKGROUND_COLOR = {self._parse_color(game_settings.get('backgroundColor', '#87CEEB'))}

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
{self._generate_system_setup(template, components)}
    
    def _setup_entities(self):
        """Set up game entities."""
{self._generate_entity_setup(template, components, configuration)}
    
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
        print(f"Game error: {{e}}")
        pygame.quit()
        sys.exit(1)


if __name__ == "__main__":
    main()
'''
        
        return code
    
    def _generate_system_setup(self, template: Dict[str, Any], components: List[Dict[str, Any]]) -> str:
        """Generate system setup code."""
        lines = []
        
        # Always add input system
        lines.append("        # Input System")
        lines.append("        input_system = InputSystem(priority=10)")
        lines.append("        self.world.add_system(input_system)")
        lines.append("")
        
        # Add physics system based on game type
        category = template.get('category', 'platformer')
        if category == 'platformer':
            lines.append("        # Platformer Physics System")
            lines.append("        physics_system = PlatformerPhysicsSystem(priority=20)")
            lines.append("        self.world.add_system(physics_system)")
        else:
            lines.append("        # General Physics System")
            lines.append("        physics_system = PhysicsSystem(priority=20)")
            lines.append("        self.world.add_system(physics_system)")
        lines.append("")
        
        # Add collision system if needed
        has_collision = any(self._component_needs_collision(comp['id']) for comp in components)
        if has_collision:
            lines.append("        # Collision System")
            lines.append("        collision_system = CollisionSystem(priority=30)")
            lines.append("        self.world.add_system(collision_system)")
            lines.append("")
        
        # Add animation system if needed
        has_animation = any(self._component_needs_animation(comp['id']) for comp in components)
        if has_animation:
            lines.append("        # Animation System")
            lines.append("        animation_system = AnimationSystem(priority=40)")
            lines.append("        self.world.add_system(animation_system)")
            lines.append("")
        
        # Add audio system if needed
        has_audio = any(self._component_needs_audio(comp['id']) for comp in components)
        if has_audio:
            lines.append("        # Audio System")
            lines.append("        audio_system = AudioSystem(priority=50)")
            lines.append("        self.world.add_system(audio_system)")
            lines.append("")
        
        # Add UI systems
        lines.append("        # UI Systems")
        lines.append("        ui_system = UISystem(priority=900, screen=self.screen)")
        lines.append("        self.world.add_system(ui_system)")
        lines.append("")
        lines.append("        hud_system = HUDSystem(priority=910, screen=self.screen)")
        lines.append("        self.world.add_system(hud_system)")
        lines.append("")
        
        return "\n".join(lines)
    
    def _generate_entity_setup(self, template: Dict[str, Any], components: List[Dict[str, Any]], 
                              configuration: Dict[str, Any]) -> str:
        """Generate entity setup code."""
        lines = []
        
        # Get scene data from template
        scene_graph = template.get('sceneGraph', {})
        scenes = scene_graph.get('scenes', [])
        
        if scenes:
            # Use first scene as default
            scene = scenes[0]
            entities = scene.get('entities', [])
            
            lines.append(f"        # Entities from scene: {scene.get('name', 'Default')}")
            lines.append("")
            
            for i, entity_data in enumerate(entities):
                component_id = entity_data.get('componentId', 'unknown')
                position = entity_data.get('position', {'x': 0, 'y': 0})
                config = entity_data.get('configuration', {})
                
                lines.append(f"        # Entity {i+1}: {component_id}")
                lines.append(f"        entity_{i+1} = Entity(name='{component_id}_{i+1}')")
                lines.append("")
                
                # Add transform component
                lines.append(f"        transform_{i+1} = TransformComponent({position['x']}, {position['y']})")
                lines.append(f"        entity_{i+1}.add_component(transform_{i+1})")
                lines.append("")
                
                # Add component-specific setup
                entity_setup = self._generate_entity_component_setup(component_id, config, i+1)
                if entity_setup:
                    lines.extend(entity_setup)
                    lines.append("")
                
                lines.append(f"        self.world.add_entity(entity_{i+1})")
                lines.append("")
        
        else:
            # Generate default entities based on components
            lines.append("        # Default entities based on components")
            lines.append("")
            
            for i, component in enumerate(components):
                comp_id = component['id']
                lines.append(f"        # {comp_id}")
                lines.append(f"        entity_{i+1} = Entity(name='{comp_id}')")
                lines.append(f"        transform_{i+1} = TransformComponent(100 + {i * 100}, 400)")
                lines.append(f"        entity_{i+1}.add_component(transform_{i+1})")
                
                # Add basic component setup
                entity_setup = self._generate_entity_component_setup(comp_id, {}, i+1)
                if entity_setup:
                    lines.extend(entity_setup)
                
                lines.append(f"        self.world.add_entity(entity_{i+1})")
                lines.append("")
        
        return "\n".join(lines)
    
    def _generate_entity_component_setup(self, component_id: str, config: Dict[str, Any], 
                                       entity_num: int) -> List[str]:
        """Generate component setup for an entity."""
        lines = []
        
        if component_id == 'player-sprite':
            lines.extend([
                f"        # Player components",
                f"        velocity_{entity_num} = VelocityComponent()",
                f"        entity_{entity_num}.add_component(velocity_{entity_num})",
                f"        ",
                f"        sprite_{entity_num} = SpriteComponent('player.png', 32, 32)",
                f"        entity_{entity_num}.add_component(sprite_{entity_num})",
                f"        ",
                f"        collision_{entity_num} = CollisionComponent(32, 32)",
                f"        entity_{entity_num}.add_component(collision_{entity_num})",
                f"        ",
                f"        health_{entity_num} = HealthComponent({config.get('health', 3)})",
                f"        entity_{entity_num}.add_component(health_{entity_num})",
                f"        ",
                f"        input_{entity_num} = InputComponent()",
                f"        entity_{entity_num}.add_component(input_{entity_num})",
                f"        ",
                f"        entity_{entity_num}.add_tag('player')"
            ])
        
        elif component_id == 'platform-ground':
            width = config.get('width', 128)
            height = config.get('height', 32)
            lines.extend([
                f"        # Platform components",
                f"        sprite_{entity_num} = SpriteComponent('platform.png', {width}, {height})",
                f"        entity_{entity_num}.add_component(sprite_{entity_num})",
                f"        ",
                f"        collision_{entity_num} = CollisionComponent({width}, {height}, solid=True)",
                f"        entity_{entity_num}.add_component(collision_{entity_num})",
                f"        ",
                f"        entity_{entity_num}.add_tag('platform')"
            ])
        
        elif component_id == 'collectible-item':
            lines.extend([
                f"        # Collectible components",
                f"        sprite_{entity_num} = SpriteComponent('collectible.png', 24, 24)",
                f"        entity_{entity_num}.add_component(sprite_{entity_num})",
                f"        ",
                f"        collision_{entity_num} = CollisionComponent(24, 24, trigger=True)",
                f"        entity_{entity_num}.add_component(collision_{entity_num})",
                f"        ",
                f"        animation_{entity_num} = AnimationComponent('spin')",
                f"        entity_{entity_num}.add_component(animation_{entity_num})",
                f"        ",
                f"        entity_{entity_num}.add_tag('collectible')"
            ])
        
        elif component_id == 'basic-enemy':
            lines.extend([
                f"        # Enemy components",
                f"        velocity_{entity_num} = VelocityComponent()",
                f"        entity_{entity_num}.add_component(velocity_{entity_num})",
                f"        ",
                f"        sprite_{entity_num} = SpriteComponent('enemy.png', 32, 32)",
                f"        entity_{entity_num}.add_component(sprite_{entity_num})",
                f"        ",
                f"        collision_{entity_num} = CollisionComponent(32, 32)",
                f"        entity_{entity_num}.add_component(collision_{entity_num})",
                f"        ",
                f"        health_{entity_num} = HealthComponent({config.get('health', 1)})",
                f"        entity_{entity_num}.add_component(health_{entity_num})",
                f"        ",
                f"        entity_{entity_num}.add_tag('enemy')"
            ])
        
        return lines
    
    def _generate_components_py(self, components: List[Dict[str, Any]]) -> str:
        """Generate additional components file if needed."""
        # For now, return empty - all components are in the runtime
        return ""
    
    def _generate_systems_py(self, template: Dict[str, Any], components: List[Dict[str, Any]]) -> str:
        """Generate additional systems file if needed."""
        # For now, return empty - all systems are in the runtime
        return ""
    
    def _generate_config_py(self, template: Dict[str, Any], configuration: Dict[str, Any]) -> str:
        """Generate configuration file."""
        game_settings = template.get('gameSettings', {})
        
        config_dict = {
            'GAME_TITLE': template.get('name', 'Generated Game'),
            'SCREEN_WIDTH': game_settings.get('screenWidth', 800),
            'SCREEN_HEIGHT': game_settings.get('screenHeight', 600),
            'TARGET_FPS': game_settings.get('targetFPS', 60),
            'GRAVITY': game_settings.get('physics', {}).get('gravity', 980),
            'AUDIO_ENABLED': game_settings.get('audio', {}).get('enabled', True),
            'AUDIO_VOLUME': game_settings.get('audio', {}).get('volume', 0.7),
            **configuration
        }
        
        lines = [
            '"""Game configuration settings."""',
            '',
            '# Generated configuration',
        ]
        
        for key, value in config_dict.items():
            if isinstance(value, str):
                lines.append(f'{key} = "{value}"')
            else:
                lines.append(f'{key} = {value}')
        
        return '\n'.join(lines)
    
    def _component_needs_collision(self, component_id: str) -> bool:
        """Check if component needs collision system."""
        collision_components = {
            'player-sprite', 'platform-ground', 'basic-enemy', 
            'collectible-item', 'projectile'
        }
        return component_id in collision_components
    
    def _component_needs_animation(self, component_id: str) -> bool:
        """Check if component needs animation system."""
        animation_components = {
            'player-sprite', 'basic-enemy', 'collectible-item', 
            'particle-effect'
        }
        return component_id in animation_components
    
    def _component_needs_audio(self, component_id: str) -> bool:
        """Check if component needs audio system."""
        audio_components = {
            'sound-effect', 'music-background', 'player-sprite',
            'basic-enemy', 'collectible-item'
        }
        return component_id in audio_components
    
    def _parse_color(self, color_str: str) -> tuple:
        """Parse color string to RGB tuple."""
        if color_str.startswith('#'):
            # Hex color
            hex_color = color_str[1:]
            if len(hex_color) == 6:
                r = int(hex_color[0:2], 16)
                g = int(hex_color[2:4], 16)
                b = int(hex_color[4:6], 16)
                return (r, g, b)
        
        # Default to light blue
        return (135, 206, 235)