"""
Mock Flask handler for testing without Flask backend
Provides mock implementations of Flask endpoints for testing
"""

import json
from typing import Dict, List, Optional, Any
import uuid
import base64
from io import BytesIO

def generate_mock_python_code(components: List[Dict], game_type: str) -> str:
    """Generate mock Python code for testing"""
    code = '''import pygame
import sys

# Initialize Pygame
pygame.init()

# Set up the display
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("{game_title}")

# Define colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

# Game clock
clock = pygame.time.Clock()

# Game loop
running = True
while running:
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
    
    # Clear screen
    screen.fill(BLACK)
    
    # Game-specific logic based on type
    {game_logic}
    
    # Update display
    pygame.display.flip()
    clock.tick(60)

# Quit
pygame.quit()
sys.exit()
'''
    
    # Get game title from components
    title = f"Test {game_type.title()} Game"
    for comp in components:
        if comp.get('type') == 'title_screen':
            title = comp.get('config', {}).get('title', title)
            break
    
    # Generate game-specific logic
    game_logic = ""
    if game_type == "platformer":
        game_logic = '''
    # Draw platform
    pygame.draw.rect(screen, WHITE, (100, 400, 600, 20))
    
    # Draw player
    pygame.draw.rect(screen, (0, 255, 0), (375, 350, 50, 50))
    
    # Apply gravity (simplified)
    # gravity = 0.8'''
    elif game_type == "rpg":
        game_logic = '''
    # Draw RPG world
    pygame.draw.rect(screen, (0, 100, 0), (0, 400, SCREEN_WIDTH, 200))
    
    # Draw player character
    pygame.draw.circle(screen, (255, 0, 0), (400, 350), 25)
    
    # Inventory system (simplified)
    # inventory = []'''
    elif game_type == "puzzle":
        game_logic = '''
    # Draw puzzle grid
    for i in range(8):
        for j in range(8):
            pygame.draw.rect(screen, WHITE, (100 + i*60, 100 + j*60, 58, 58), 1)'''
    elif game_type == "racing":
        game_logic = '''
    # Draw race track
    pygame.draw.rect(screen, (128, 128, 128), (150, 100, 500, 400), 3)
    
    # Draw car
    pygame.draw.rect(screen, (255, 0, 0), (375, 450, 50, 30))'''
    elif game_type == "space":
        game_logic = '''
    # Draw stars
    for i in range(10):
        pygame.draw.circle(screen, WHITE, (100 + i*60, 100 + i*30), 2)
    
    # Draw spaceship
    pygame.draw.polygon(screen, (0, 255, 255), [(400, 500), (380, 530), (420, 530)])'''
    elif game_type == "dungeon":
        game_logic = '''
    # Draw dungeon walls
    pygame.draw.rect(screen, (100, 100, 100), (50, 50, 700, 500), 3)
    
    # Draw player
    pygame.draw.circle(screen, (0, 255, 0), (400, 300), 15)
    
    # Draw enemies (simplified)
    pygame.draw.circle(screen, (255, 0, 0), (200, 200), 10)'''
    
    return code.format(game_title=title, game_logic=game_logic)


class MockFlaskHandler:
    """Mock Flask handler for testing"""
    
    @staticmethod
    def compile_game(components: List[Dict], game_type: str = "platformer") -> Dict:
        """Mock compile endpoint response"""
        try:
            code = generate_mock_python_code(components, game_type)
            return {
                'success': True,
                'code': code,
                'message': 'Game compiled successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def execute_game(code: str) -> Dict:
        """Mock execute endpoint response"""
        session_id = str(uuid.uuid4())
        return {
            'success': True,
            'session_id': session_id,
            'message': 'Game execution started'
        }
    
    @staticmethod
    def stop_game(session_id: str) -> Dict:
        """Mock stop endpoint response"""
        return {
            'success': True,
            'message': 'Game stopped successfully'
        }
    
    @staticmethod
    def save_project(project_data: Dict) -> Dict:
        """Mock save project response"""
        project_id = str(uuid.uuid4())
        return {
            'success': True,
            'project': {
                'id': project_id,
                'name': project_data.get('name', 'Untitled'),
                'gameType': project_data.get('gameType', 'platformer'),
                'components': project_data.get('components', []),
                'assets': project_data.get('assets', []),
                'code': project_data.get('code', ''),
                'created': '2025-09-21T00:00:00Z',
                'updated': '2025-09-21T00:00:00Z'
            }
        }