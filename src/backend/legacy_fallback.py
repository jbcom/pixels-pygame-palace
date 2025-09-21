"""Legacy fallback code generation for when the full compiler system isn't available."""

def generate_python_code(components, template_id):
    """Generate pygame code from visual components (legacy fallback)."""
    try:
        from .game_engine import GameCompiler
        return GameCompiler.compile(components, template_id)
    except ImportError:
        # Enhanced fallback code generation with ECS structure
        component_names = [comp.get('id', 'unknown') if isinstance(comp, dict) else str(comp) for comp in components]
        
        return f"""#!/usr/bin/env python3
\"\"\"
Generated Game - {template_id.replace('-', ' ').title()}
Created with Pixel's PyGame Palace (Legacy Mode)

Components: {', '.join(component_names)}
\"\"\"

import pygame
import sys
import math
import random

# Initialize pygame
pygame.init()

# Game configuration
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60
GAME_TITLE = "{template_id.replace('-', ' ').title()}"

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)

# Set up display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption(GAME_TITLE)
clock = pygame.time.Clock()

# Simple entity class
class Entity:
    def __init__(self, x, y, width=32, height=32, color=WHITE):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.color = color
        self.vx = 0
        self.vy = 0
    
    def update(self):
        self.x += self.vx
        self.y += self.vy
    
    def draw(self, screen):
        pygame.draw.rect(screen, self.color, (self.x, self.y, self.width, self.height))

# Game entities based on components
entities = []

{'# Player entity' if any('player' in str(comp).lower() for comp in components) else ''}
{'player = Entity(100, 400, color=BLUE)' if any('player' in str(comp).lower() for comp in components) else ''}
{'entities.append(player)' if any('player' in str(comp).lower() for comp in components) else ''}

{'# Platform entities' if any('platform' in str(comp).lower() for comp in components) else ''}
{'platform = Entity(0, 550, 800, 50, color=GREEN)' if any('platform' in str(comp).lower() for comp in components) else ''}
{'entities.append(platform)' if any('platform' in str(comp).lower() for comp in components) else ''}

{'# Enemy entities' if any('enemy' in str(comp).lower() for comp in components) else ''}
{'enemy = Entity(600, 500, color=RED)' if any('enemy' in str(comp).lower() for comp in components) else ''}
{'entities.append(enemy)' if any('enemy' in str(comp).lower() for comp in components) else ''}

# Main game loop
def main():
    running = True
    while running:
        dt = clock.tick(FPS) / 1000.0  # Delta time in seconds
        
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
        
        # Handle input
        keys = pygame.key.get_pressed()
        
        {'# Player movement' if any('player' in str(comp).lower() for comp in components) else ''}
        {'if "player" in locals():' if any('player' in str(comp).lower() for comp in components) else ''}
        {'    if keys[pygame.K_LEFT] or keys[pygame.K_a]:' if any('player' in str(comp).lower() for comp in components) else ''}
        {'        player.vx = -200 * dt' if any('player' in str(comp).lower() for comp in components) else ''}
        {'    elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:' if any('player' in str(comp).lower() for comp in components) else ''}
        {'        player.vx = 200 * dt' if any('player' in str(comp).lower() for comp in components) else ''}
        {'    else:' if any('player' in str(comp).lower() for comp in components) else ''}
        {'        player.vx = 0' if any('player' in str(comp).lower() for comp in components) else ''}
        {'    if keys[pygame.K_SPACE] or keys[pygame.K_UP] or keys[pygame.K_w]:' if any('player' in str(comp).lower() for comp in components) else ''}
        {'        if player.vy == 0:  # Only jump if on ground' if any('player' in str(comp).lower() for comp in components) else ''}
        {'            player.vy = -300' if any('player' in str(comp).lower() for comp in components) else ''}
        
        # Update entities
        for entity in entities:
            entity.update()
        
        # Simple gravity and collision for platformer
        {'if "player" in locals() and "platform" in locals():' if any('player' in str(comp).lower() and 'platform' in str(comp).lower() for comp in components) else ''}
        {'    player.vy += 980 * dt  # Gravity' if any('player' in str(comp).lower() and 'platform' in str(comp).lower() for comp in components) else ''}
        {'    if (player.y + player.height >= platform.y and ' if any('player' in str(comp).lower() and 'platform' in str(comp).lower() for comp in components) else ''}
        {'        player.x + player.width > platform.x and player.x < platform.x + platform.width):' if any('player' in str(comp).lower() and 'platform' in str(comp).lower() for comp in components) else ''}
        {'        player.y = platform.y - player.height' if any('player' in str(comp).lower() and 'platform' in str(comp).lower() for comp in components) else ''}
        {'        player.vy = 0' if any('player' in str(comp).lower() and 'platform' in str(comp).lower() for comp in components) else ''}
        
        # Keep entities on screen
        for entity in entities:
            entity.x = max(0, min(SCREEN_WIDTH - entity.width, entity.x))
            entity.y = max(0, min(SCREEN_HEIGHT - entity.height, entity.y))
        
        # Render everything
        screen.fill(BLACK)
        
        # Draw entities
        for entity in entities:
            entity.draw(screen)
        
        # Draw UI
        font = pygame.font.Font(None, 36)
        text = font.render(GAME_TITLE, True, WHITE)
        screen.blit(text, (10, 10))
        
        # Show controls
        font_small = pygame.font.Font(None, 24)
        controls = [
            "Arrow Keys/WASD: Move",
            "Space: Jump", 
            "ESC: Exit"
        ]
        for i, control in enumerate(controls):
            text = font_small.render(control, True, WHITE)
            screen.blit(text, (10, SCREEN_HEIGHT - 80 + i * 25))
        
        # Update display
        pygame.display.flip()
    
    # Quit
    pygame.quit()
    sys.exit()

if __name__ == '__main__':
    main()
"""