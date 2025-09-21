"""
Web game compiler using pygbag for WebAssembly support.
Converts pygame games to run in web browsers.
"""

import os
import sys
import tempfile
import shutil
import asyncio
import subprocess
import time
import json
import uuid
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from .config import get_config
from security_config import CodeValidator


class WebGameCompiler:
    """Compiles pygame games to WebAssembly using pygbag."""
    
    def __init__(self):
        self.config = get_config()
        self.temp_base_dir = tempfile.gettempdir()
        self.compiled_games_dir = os.path.join(os.path.dirname(__file__), '..', 'compiled_games')
        os.makedirs(self.compiled_games_dir, exist_ok=True)
    
    def compile_game(self, code: str, game_id: str, assets: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Compile pygame code to WebAssembly using pygbag.
        
        Args:
            code: Python pygame code to compile
            game_id: Unique identifier for the game
            assets: Optional list of game assets
            
        Returns:
            Dict containing compilation result and paths
        """
        # Validate code
        is_valid, error_msg = CodeValidator.validate_code(code)
        if not is_valid:
            return {
                'success': False,
                'error': f'Code validation failed: {error_msg}'
            }
        
        try:
            # Create temporary project directory
            project_dir = os.path.join(self.temp_base_dir, f"web_game_{game_id}")
            if os.path.exists(project_dir):
                shutil.rmtree(project_dir)
            os.makedirs(project_dir)
            
            # Create pygbag-compatible project structure
            self._create_project_structure(project_dir, code, game_id, assets)
            
            # Run pygbag compilation
            compilation_result = self._run_pygbag_compilation(project_dir, game_id)
            
            if compilation_result['success']:
                # Move compiled output to served directory
                output_path = self._move_compiled_output(project_dir, game_id)
                compilation_result['output_path'] = output_path
                compilation_result['web_url'] = f'/web-games/{game_id}/'
            
            # Clean up temporary directory
            if os.path.exists(project_dir):
                shutil.rmtree(project_dir)
            
            return compilation_result
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Compilation error: {str(e)}'
            }
    
    def _create_project_structure(self, project_dir: str, code: str, game_id: str, assets: Optional[List[Dict]] = None):
        """Create pygbag-compatible project structure."""
        
        # Create main game file
        main_file = os.path.join(project_dir, 'main.py')
        wrapped_code = self._wrap_code_for_pygbag(code, game_id)
        
        with open(main_file, 'w') as f:
            f.write(wrapped_code)
        
        # Create assets directory if needed
        if assets:
            assets_dir = os.path.join(project_dir, 'assets')
            os.makedirs(assets_dir, exist_ok=True)
            
            for asset in assets:
                self._copy_asset_to_project(asset, assets_dir)
        
        # Create pygbag configuration
        self._create_pygbag_config(project_dir, game_id)
    
    def _wrap_code_for_pygbag(self, code: str, game_id: str) -> str:
        """Wrap user code for pygbag compatibility with format detection and adaptation."""
        
        # Analyze the user code to determine the format and patterns
        code_analysis = self._analyze_code_format(code)
        
        # Transform code for web compatibility
        transformed_code = self._transform_code_for_web(code, code_analysis)
        
        template = '''
import asyncio
import pygame
import sys
import os

# pygbag compatibility imports
try:
    import pygame_gui
    HAS_PYGAME_GUI = True
except ImportError:
    HAS_PYGAME_GUI = False

# Initialize pygame
pygame.init()

# Game configuration
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# Web compatibility flags
IS_WEB_BUILD = True
PYGAME_VERSION = pygame.version.ver

# Compatibility layer for pygame features
class WebCompatibility:
    """Handles pygame feature compatibility for web builds."""
    
    @staticmethod
    def init_audio():
        """Initialize audio with web-safe settings."""
        try:
            pygame.mixer.pre_init(frequency=22050, size=-16, channels=2, buffer=1024)
            pygame.mixer.init()
            return True
        except pygame.error:
            print("Warning: Audio initialization failed in web build")
            return False
    
    @staticmethod
    def load_sound(path):
        """Load sound with web compatibility."""
        try:
            return pygame.mixer.Sound(path)
        except (pygame.error, FileNotFoundError):
            print(f"Warning: Could not load sound {path}")
            return None
    
    @staticmethod
    def load_image(path):
        """Load image with web compatibility."""
        try:
            return pygame.image.load(path).convert_alpha()
        except (pygame.error, FileNotFoundError):
            print(f"Warning: Could not load image {path}")
            # Return a placeholder surface
            surf = pygame.Surface((32, 32))
            surf.fill((255, 0, 255))  # Magenta placeholder
            return surf
    
    @staticmethod
    def get_font(name, size):
        """Get font with web compatibility."""
        try:
            if name and name != 'default':
                return pygame.font.Font(name, size)
            else:
                return pygame.font.Font(None, size)
        except (pygame.error, FileNotFoundError):
            return pygame.font.Font(None, size)

# Initialize web compatibility
web_compat = WebCompatibility()
has_audio = web_compat.init_audio()

# Monkey patch pygame functions for web compatibility
_original_mixer_sound = pygame.mixer.Sound
_original_image_load = pygame.image.load
_original_font_font = pygame.font.Font

pygame.mixer.Sound = web_compat.load_sound
pygame.image.load = web_compat.load_image
pygame.font.Font = web_compat.get_font

class Game:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("{game_title}")
        self.clock = pygame.time.Clock()
        self.running = True
        self.web_compat = web_compat
        
        # Initialize user game state
        self.init_user_game()
    
    def init_user_game(self):
        """Initialize user-specific game state."""
        # User initialization code will be inserted here
        pass
    
    async def main_loop(self):
        """Main game loop with async support for pygbag."""
        while self.running:
            # Handle events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                self.handle_user_events(event)
            
            # Update game state
            self.update_user_game()
            
            # Draw everything
            self.draw_user_game()
            
            # Update display
            pygame.display.flip()
            self.clock.tick(FPS)
            
            # Essential for pygbag - allows the browser to handle other tasks
            await asyncio.sleep(0)
        
        pygame.quit()
        sys.exit()
    
    def handle_user_events(self, event):
        """Handle user-defined events."""
        # User event handling code will be inserted here
        pass
    
    def update_user_game(self):
        """Update user game logic."""
        # User update code will be inserted here
        pass
    
    def draw_user_game(self):
        """Draw user game."""
        # User drawing code will be inserted here
        pass

# User code starts here (transformed for web compatibility)
{transformed_code}

# End user code

# Handle different pygame code patterns
if '{code_pattern}' == 'class_based':
    # User defined a game class - instantiate and run it
    game_instance = None
    for name, obj in globals().items():
        if (isinstance(obj, type) and 
            issubclass(obj, object) and 
            hasattr(obj, 'run') and 
            name not in ['Game', 'WebCompatibility']):
            game_instance = obj()
            break
    
    if game_instance and hasattr(game_instance, 'run'):
        if asyncio.iscoroutinefunction(game_instance.run):
            asyncio.run(game_instance.run())
        else:
            # Wrap synchronous run method
            async def async_wrapper():
                while hasattr(game_instance, 'running') and game_instance.running:
                    if hasattr(game_instance, 'update'):
                        game_instance.update()
                    if hasattr(game_instance, 'draw'):
                        game_instance.draw()
                    await asyncio.sleep(0)
            asyncio.run(async_wrapper())

elif '{code_pattern}' == 'main_function':
    # User defined a main function
    if 'main' in globals() and callable(globals()['main']):
        main_func = globals()['main']
        if asyncio.iscoroutinefunction(main_func):
            asyncio.run(main_func())
        else:
            # Wrap synchronous main function
            async def async_main():
                main_func()
                await asyncio.sleep(0)
            asyncio.run(async_main())

elif '{code_pattern}' == 'game_loop':
    # User defined a traditional game loop - extract and adapt it
    game = Game()
    asyncio.run(game.main_loop())

else:
    # Default: run our main loop
    game = Game()
    asyncio.run(game.main_loop())
'''.format(
            game_title=f"Game {game_id}",
            transformed_code=transformed_code,
            code_pattern=code_analysis['pattern']
        )
        
        return template
    
    def _analyze_code_format(self, code: str) -> Dict[str, Any]:
        """Analyze the code to determine format and patterns."""
        analysis = {
            'pattern': 'game_loop',  # default
            'has_main_function': False,
            'has_game_class': False,
            'has_async': False,
            'pygame_features': [],
            'needs_transformation': []
        }
        
        lines = code.split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Check for main function
            if line.startswith('def main(') or line.startswith('async def main('):
                analysis['has_main_function'] = True
                analysis['pattern'] = 'main_function'
                if 'async def' in line:
                    analysis['has_async'] = True
            
            # Check for game class
            if line.startswith('class ') and ('Game' in line or 'App' in line):
                analysis['has_game_class'] = True
                analysis['pattern'] = 'class_based'
            
            # Check for async/await
            if 'async ' in line or 'await ' in line:
                analysis['has_async'] = True
            
            # Check for pygame features that need special handling
            if 'pygame.mixer' in line:
                analysis['pygame_features'].append('audio')
            if 'pygame.font' in line:
                analysis['pygame_features'].append('fonts')
            if 'pygame.image.load' in line:
                analysis['pygame_features'].append('images')
            if 'pygame.time.wait' in line or 'time.sleep' in line:
                analysis['needs_transformation'].append('blocking_delays')
            if 'input(' in line:
                analysis['needs_transformation'].append('blocking_input')
        
        return analysis
    
    def _transform_code_for_web(self, code: str, analysis: Dict[str, Any]) -> str:
        """Transform code for web compatibility."""
        transformed = code
        
        # Transform blocking operations
        if 'blocking_delays' in analysis['needs_transformation']:
            # Replace time.sleep with await asyncio.sleep
            import re
            transformed = re.sub(
                r'time\.sleep\(([^)]+)\)',
                r'await asyncio.sleep(\1)',
                transformed
            )
            transformed = re.sub(
                r'pygame\.time\.wait\(([^)]+)\)',
                r'await asyncio.sleep(\1 / 1000)',
                transformed
            )
        
        # Transform blocking input
        if 'blocking_input' in analysis['needs_transformation']:
            # Replace input() calls with web-safe alternatives
            transformed = transformed.replace(
                'input(',
                '# input() not supported in web build # input('
            )
        
        # Add pygame-ce compatibility
        if 'pygame-ce' in transformed or 'import pygame_ce' in transformed:
            transformed = transformed.replace('import pygame_ce as pygame', 'import pygame')
            transformed = transformed.replace('pygame_ce', 'pygame')
        
        # Ensure async compatibility for main loops
        if not analysis['has_async'] and 'while' in transformed:
            # Find while loops that look like main game loops
            lines = transformed.split('\n')
            new_lines = []
            in_main_loop = False
            
            for line in lines:
                if ('while' in line and 
                    ('running' in line or 'True' in line) and 
                    not line.strip().startswith('#')):
                    in_main_loop = True
                    new_lines.append(line)
                elif in_main_loop and line.strip() == '':
                    new_lines.append(line)
                elif in_main_loop and (line.startswith('    ') or line.startswith('\t')):
                    new_lines.append(line)
                    # Add await asyncio.sleep(0) before pygame.display.flip() or at end of loop
                    if ('pygame.display.flip()' in line or 
                        'pygame.display.update()' in line):
                        indent = len(line) - len(line.lstrip())
                        new_lines.append(' ' * indent + 'await asyncio.sleep(0)')
                else:
                    if in_main_loop:
                        in_main_loop = False
                    new_lines.append(line)
            
            transformed = '\n'.join(new_lines)
        
        return transformed
    
    def _copy_asset_to_project(self, asset: Dict, assets_dir: str):
        """Copy asset to project directory."""
        try:
            asset_name = asset.get('name', f"asset_{asset.get('id', 'unknown')}")
            asset_path = asset.get('path')
            
            if asset_path and os.path.exists(asset_path):
                dest_path = os.path.join(assets_dir, asset_name)
                shutil.copy2(asset_path, dest_path)
                print(f"Copied asset: {asset_name}")
        except Exception as e:
            print(f"Warning: Failed to copy asset {asset}: {e}")
    
    def _create_pygbag_config(self, project_dir: str, game_id: str):
        """Create pygbag configuration file."""
        
        config = {
            "pygbag": {
                "width": 800,
                "height": 600,
                "title": f"Game {game_id}",
                "author": "Pixel's PyGame Palace",
                "icon": "pygame",
                "archive": False,
                "ume_block": 0,
                "cdn": "https://pyodide.org/",
                "template": "custom",
                "name": game_id
            }
        }
        
        config_file = os.path.join(project_dir, 'pygbag.toml')
        
        # Convert to TOML format manually (simple case)
        toml_content = f'''[pygbag]
width = {config["pygbag"]["width"]}
height = {config["pygbag"]["height"]}
title = "{config["pygbag"]["title"]}"
author = "{config["pygbag"]["author"]}"
icon = "{config["pygbag"]["icon"]}"
archive = {str(config["pygbag"]["archive"]).lower()}
ume_block = {config["pygbag"]["ume_block"]}
cdn = "{config["pygbag"]["cdn"]}"
template = "{config["pygbag"]["template"]}"
name = "{config["pygbag"]["name"]}"
'''
        
        with open(config_file, 'w') as f:
            f.write(toml_content)
    
    def _run_pygbag_compilation(self, project_dir: str, game_id: str) -> Dict[str, Any]:
        """Run pygbag compilation process."""
        try:
            # Change to project directory for compilation
            original_cwd = os.getcwd()
            os.chdir(project_dir)
            
            # Run pygbag command
            cmd = [
                sys.executable, '-m', 'pygbag',
                '--width', '800',
                '--height', '600',
                '--template', 'custom',
                '--name', game_id,
                'main.py'
            ]
            
            print(f"Running pygbag compilation: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout
            )
            
            os.chdir(original_cwd)
            
            if result.returncode == 0:
                return {
                    'success': True,
                    'message': 'Game compiled successfully',
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
            else:
                return {
                    'success': False,
                    'error': f'Compilation failed: {result.stderr}',
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
                
        except subprocess.TimeoutExpired:
            os.chdir(original_cwd)
            return {
                'success': False,
                'error': 'Compilation timeout after 2 minutes'
            }
        except Exception as e:
            os.chdir(original_cwd)
            return {
                'success': False,
                'error': f'Compilation error: {str(e)}'
            }
    
    def _move_compiled_output(self, project_dir: str, game_id: str) -> str:
        """Move compiled output to served directory."""
        
        # pygbag typically creates output in project_dir/dist
        dist_dir = os.path.join(project_dir, 'dist')
        
        # Create target directory
        target_dir = os.path.join(self.compiled_games_dir, game_id)
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)
        
        if os.path.exists(dist_dir):
            shutil.copytree(dist_dir, target_dir)
        else:
            # Fallback: copy all files from project dir
            shutil.copytree(project_dir, target_dir)
        
        return target_dir
    
    def get_compiled_game_path(self, game_id: str) -> Optional[str]:
        """Get path to compiled game."""
        game_path = os.path.join(self.compiled_games_dir, game_id)
        return game_path if os.path.exists(game_path) else None
    
    def list_compiled_games(self) -> List[str]:
        """List all compiled games."""
        if not os.path.exists(self.compiled_games_dir):
            return []
        
        return [d for d in os.listdir(self.compiled_games_dir) 
                if os.path.isdir(os.path.join(self.compiled_games_dir, d))]
    
    def delete_compiled_game(self, game_id: str) -> bool:
        """Delete a compiled game."""
        game_path = os.path.join(self.compiled_games_dir, game_id)
        if os.path.exists(game_path):
            try:
                shutil.rmtree(game_path)
                return True
            except Exception as e:
                print(f"Error deleting compiled game {game_id}: {e}")
        return False


class WebGameManager:
    """Manages web-based game sessions and compilation."""
    
    def __init__(self):
        self.compiler = WebGameCompiler()
        self.active_compilations: Dict[str, Dict] = {}
    
    def start_compilation(self, code: str, game_id: Optional[str] = None, assets: Optional[List[Dict]] = None) -> str:
        """Start asynchronous game compilation."""
        
        if game_id is None:
            game_id = str(uuid.uuid4())
        
        compilation_id = f"comp_{game_id}_{int(time.time())}"
        
        # Initialize compilation status with frontend-compatible schema
        self.active_compilations[compilation_id] = {
            'game_id': game_id,
            'status': 'compiling',  # 'compiling'|'completed'|'failed'
            'start_time': time.time(),
            'code': code,
            'assets': assets,
            'result': None
        }
        
        # Start compilation in background using threading to avoid blocking
        import threading
        def run_compilation():
            try:
                result = self.compiler.compile_game(code, game_id, assets)
                
                # Update status with frontend-compatible format
                if result['success']:
                    self.active_compilations[compilation_id].update({
                        'status': 'completed',
                        'result': {
                            'success': True,
                            'web_url': result.get('web_url', f'/web-games/{game_id}/'),
                            'game_id': game_id,
                            'output_path': result.get('output_path'),
                            'message': result.get('message', 'Game compiled successfully')
                        },
                        'end_time': time.time()
                    })
                else:
                    self.active_compilations[compilation_id].update({
                        'status': 'failed',
                        'result': {
                            'success': False,
                            'error': result.get('error', 'Compilation failed'),
                            'message': result.get('message', 'Compilation failed')
                        },
                        'end_time': time.time()
                    })
            except Exception as e:
                self.active_compilations[compilation_id].update({
                    'status': 'failed',
                    'result': {
                        'success': False,
                        'error': f'Compilation error: {str(e)}',
                        'message': 'Compilation failed due to internal error'
                    },
                    'end_time': time.time()
                })
        
        # Start compilation thread
        compilation_thread = threading.Thread(target=run_compilation)
        compilation_thread.daemon = True
        compilation_thread.start()
        
        return compilation_id
    
    def get_compilation_status(self, compilation_id: str) -> Optional[Dict]:
        """Get compilation status in frontend-compatible format."""
        compilation_data = self.active_compilations.get(compilation_id)
        
        if compilation_data is None:
            return None
        
        # Return status in the expected frontend schema format
        return {
            'status': compilation_data['status'],  # 'compiling'|'completed'|'failed' 
            'result': compilation_data.get('result'),
            'game_id': compilation_data['game_id'],
            'start_time': compilation_data['start_time'],
            'end_time': compilation_data.get('end_time'),
            'compilation_id': compilation_id
        }
    
    def cleanup_old_compilations(self, max_age_hours: int = 24):
        """Clean up old compilation records."""
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        expired_compilations = [
            comp_id for comp_id, comp_data in self.active_compilations.items()
            if current_time - comp_data.get('start_time', 0) > max_age_seconds
        ]
        
        for comp_id in expired_compilations:
            del self.active_compilations[comp_id]
        
        return len(expired_compilations)


# Create global instance for import by routes.py
web_game_manager = WebGameManager()