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
import hashlib
import re
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
from datetime import datetime
import logging

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

try:
    from .config import get_config
    from .security_config import CodeValidator
    from .cache_manager import CacheManager, CacheKey, CacheStage
    from .asset_packager import AssetPackager
except ImportError:
    # Fallback for standalone execution
    from config import get_config
    from security_config import CodeValidator
    from cache_manager import CacheManager, CacheKey, CacheStage
    from asset_packager import AssetPackager

logger = logging.getLogger(__name__)


class WebGameCompiler:
    """Compiles pygame games to WebAssembly using pygbag with reproducible builds and caching."""
    
    def __init__(self, cache_manager: Optional[CacheManager] = None, asset_packager: Optional[AssetPackager] = None):
        self.config = get_config()
        self.temp_base_dir = tempfile.gettempdir()
        self.compiled_games_dir = os.path.join(os.path.dirname(__file__), '..', 'compiled_games')
        os.makedirs(self.compiled_games_dir, exist_ok=True)
        
        # Initialize cache manager and asset packager
        # CRITICAL FIX: Properly handle CacheManager fallback with required parameters
        if cache_manager is None:
            # Get configuration for cache settings
            compiler_config = getattr(self.config, 'compiler', None) or getattr(self.config, 'COMPILER', None)
            if compiler_config:
                cache_dir = getattr(compiler_config, 'cache_dir', getattr(compiler_config, 'CACHE_DIR', tempfile.gettempdir() + '/game_cache'))
                max_cache_size_mb = getattr(compiler_config, 'max_cache_size_mb', getattr(compiler_config, 'MAX_CACHE_SIZE_MB', 1024))
            else:
                # Fallback configuration
                cache_dir = tempfile.gettempdir() + '/game_cache'
                max_cache_size_mb = 1024
            
            self.cache_manager = CacheManager(cache_dir, max_cache_size_mb)
        else:
            self.cache_manager = cache_manager
            
        self.asset_packager = asset_packager or AssetPackager(cache_manager=self.cache_manager)
        
        # Deterministic build settings
        self.deterministic_build = True
        self.strip_timestamps = True
        self.normalize_output = True
        
        # Reproducible build constants
        self.FIXED_BUILD_TIME = "2024-01-01T00:00:00Z"
        self.FIXED_VERSION = "1.0.0"
        self.FIXED_GENERATOR = "pygbag-reproducible"
    
    def compile_game(self, code: str, game_id: str, assets: Optional[List[Dict]] = None, 
                    asset_refs: Optional[List[Dict]] = None, configuration: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Compile pygame code to WebAssembly using pygbag with content-addressable caching.
        
        Args:
            code: Python pygame code to compile
            game_id: Unique identifier for the game
            assets: Optional list of custom game assets
            asset_refs: Optional asset references from components
            configuration: Optional build configuration
            
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
            # Generate content-addressable cache key for web build
            cache_key = self._generate_web_cache_key(code, assets or [], asset_refs or [], configuration or {})
            web_cache_key = CacheKey(scope="compilation", key=cache_key, stage=CacheStage.WEB)
            
            # Check if web build is already cached
            cached_result = self.cache_manager.get(web_cache_key)
            if cached_result:
                logger.info(f"Using cached web build: {cache_key}")
                return self._handle_cached_web_build(cached_result, game_id, cache_key)
            
            # Process assets using AssetPackager for web target
            asset_manifest = self._process_assets_for_web(assets or [], asset_refs or [], cache_key)
            
            # Create temporary project directory with deterministic structure
            project_dir = self._create_deterministic_project_dir(cache_key)
            
            try:
                # Create pygbag-compatible project structure with asset manifest integration
                self._create_project_structure_with_assets(project_dir, code, game_id, asset_manifest)
                
                # Run reproducible pygbag compilation
                compilation_result = self._run_reproducible_pygbag_compilation(project_dir, game_id, cache_key)
                
                if compilation_result['success']:
                    # Normalize and move compiled output
                    output_path = self._normalize_and_cache_output(project_dir, game_id, cache_key, web_cache_key)
                    compilation_result['output_path'] = output_path
                    compilation_result['web_url'] = f'/web-games/{game_id}/'
                    compilation_result['cache_key'] = cache_key
                    compilation_result['cached'] = False
                    
                    # Cache the successful build result
                    self.cache_manager.put(web_cache_key, compilation_result, metadata={
                        'asset_count': len(asset_manifest.get('assets', {})),
                        'total_size': asset_manifest.get('total_size', 0),
                        'build_time': datetime.now().isoformat()
                    })
                
                return compilation_result
                
            finally:
                # Clean up temporary directory
                if os.path.exists(project_dir):
                    shutil.rmtree(project_dir)
            
        except Exception as e:
            logger.error(f"Web compilation error: {e}")
            return {
                'success': False,
                'error': f'Compilation error: {str(e)}'
            }
    
    def _create_project_structure_with_assets(self, project_dir: str, code: str, game_id: str, asset_manifest: Dict[str, Any]):
        """Create pygbag-compatible project structure with proper asset integration."""
        
        # Create main game file with asset manifest integration
        main_file = os.path.join(project_dir, 'main.py')
        wrapped_code = self._wrap_code_for_pygbag_with_assets(code, game_id, asset_manifest)
        
        with open(main_file, 'w', encoding='utf-8') as f:
            f.write(wrapped_code)
        
        # Copy processed assets from asset manifest
        self._setup_assets_from_manifest(project_dir, asset_manifest)
        
        # Create deterministic pygbag configuration
        self._create_deterministic_pygbag_config(project_dir, game_id)
    
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
    
    def _create_deterministic_pygbag_config(self, project_dir: str, game_id: str):
        """Create deterministic pygbag configuration file."""
        
        # Use deterministic values for reproducible builds
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
                "name": game_id,
                # Deterministic build flags
                "reproducible": True,
                "strip_debug": True,
                "optimize": True
            }
        }
        
        config_file = os.path.join(project_dir, 'pygbag.toml')
        
        # Create deterministic TOML content (sorted keys)
        toml_lines = ['[pygbag]']
        for key, value in sorted(config["pygbag"].items()):
            if isinstance(value, str):
                toml_lines.append(f'{key} = "{value}"')
            elif isinstance(value, bool):
                toml_lines.append(f'{key} = {str(value).lower()}')
            else:
                toml_lines.append(f'{key} = {value}')
        
        toml_content = '\n'.join(toml_lines) + '\n'
        
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(toml_content)
    
    def _run_reproducible_pygbag_compilation(self, project_dir: str, game_id: str, cache_key: str) -> Dict[str, Any]:
        """Run reproducible pygbag compilation process."""
        original_cwd = os.getcwd()
        try:
            # Change to project directory for compilation
            os.chdir(project_dir)
            
            # Deterministic environment variables for reproducible builds
            env = os.environ.copy()
            env.update({
                'SOURCE_DATE_EPOCH': '1704067200',  # Fixed timestamp: 2024-01-01
                'PYGBAG_REPRODUCIBLE': '1',
                'PYGBAG_CACHE_KEY': cache_key,
                'PYTHONHASHSEED': '0',  # Deterministic hash seed
                'TZ': 'UTC'  # Fixed timezone
            })
            
            # Deterministic compilation command
            cmd = [
                sys.executable, '-m', 'pygbag',
                '--width', '800',
                '--height', '600',
                '--template', 'custom',
                '--name', game_id,
                '--optimize',
                '--strip',
                'main.py'
            ]
            
            logger.info(f"Running reproducible pygbag compilation: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,  # 3 minute timeout for reproducible builds
                env=env
            )
            
            os.chdir(original_cwd)
            
            if result.returncode == 0:
                return {
                    'success': True,
                    'message': 'Reproducible game compiled successfully',
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'reproducible': True
                }
            else:
                return {
                    'success': False,
                    'error': f'Reproducible compilation failed: {result.stderr}',
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
                
        except subprocess.TimeoutExpired:
            try:
                os.chdir(original_cwd)
            except:
                pass
            return {
                'success': False,
                'error': 'Reproducible compilation timeout after 3 minutes'
            }
        except Exception as e:
            try:
                os.chdir(original_cwd)
            except:
                pass
            return {
                'success': False,
                'error': f'Reproducible compilation error: {str(e)}'
            }
    
    def _normalize_and_cache_output(self, project_dir: str, game_id: str, cache_key: str, web_cache_key: CacheKey) -> str:
        """Normalize and cache compiled output for reproducible builds."""
        
        # pygbag typically creates output in project_dir/dist
        dist_dir = os.path.join(project_dir, 'dist')
        
        if not os.path.exists(dist_dir):
            raise Exception("pygbag dist directory not found")
        
        # Normalize output for reproducibility
        self._normalize_web_output(dist_dir)
        
        # Cache the normalized output in CacheManager
        cache_output_dir = web_cache_key.to_path(self.cache_manager.cache_root)
        cache_output_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy normalized output to cache
        if cache_output_dir.exists():
            shutil.rmtree(cache_output_dir)
        shutil.copytree(dist_dir, cache_output_dir)
        
        # Also copy to served directory for immediate access
        target_dir = os.path.join(self.compiled_games_dir, game_id)
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)
        shutil.copytree(dist_dir, target_dir)
        
        return target_dir
    
    def _generate_web_cache_key(self, code: str, assets: List[Dict], asset_refs: List[Dict], configuration: Dict) -> str:
        """Generate content-addressable cache key for web compilation."""
        
        # Create deterministic hash components
        hash_components = []
        
        # (a) Code content hash
        code_hash = hashlib.sha256(code.encode('utf-8')).hexdigest()
        hash_components.append(('code', code_hash))
        
        # (b) Assets content hash
        assets_data = json.dumps([
            {
                'name': asset.get('name', ''),
                'path': asset.get('path', ''),
                'type': asset.get('type', ''),
                'size': asset.get('size', 0)
            }
            for asset in assets
        ], sort_keys=True, separators=(',', ':'))
        assets_hash = hashlib.sha256(assets_data.encode('utf-8')).hexdigest()
        hash_components.append(('assets', assets_hash))
        
        # (c) Asset references hash
        asset_refs_data = json.dumps(asset_refs, sort_keys=True, separators=(',', ':'))
        asset_refs_hash = hashlib.sha256(asset_refs_data.encode('utf-8')).hexdigest()
        hash_components.append(('asset_refs', asset_refs_hash))
        
        # (d) Configuration hash
        config_data = json.dumps(configuration, sort_keys=True, separators=(',', ':'))
        config_hash = hashlib.sha256(config_data.encode('utf-8')).hexdigest()
        hash_components.append(('config', config_hash))
        
        # (e) Web target specific settings
        web_settings = {
            'target': 'web',
            'pygbag_version': '0.8.7',
            'pygame_ce_version': '2.4.1',
            'deterministic': self.deterministic_build,
            'strip_timestamps': self.strip_timestamps,
            'normalize_output': self.normalize_output
        }
        web_settings_data = json.dumps(web_settings, sort_keys=True, separators=(',', ':'))
        web_settings_hash = hashlib.sha256(web_settings_data.encode('utf-8')).hexdigest()
        hash_components.append(('web_settings', web_settings_hash))
        
        # Create final deterministic hash
        combined_data = json.dumps(hash_components, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(combined_data.encode('utf-8')).hexdigest()
    
    def _handle_cached_web_build(self, cached_result: Dict, game_id: str, cache_key: str) -> Dict[str, Any]:
        """Handle cached web build result."""
        
        # Copy cached build to served directory for immediate access
        web_cache_key = CacheKey(scope="compilation", key=cache_key, stage=CacheStage.WEB)
        cached_output_dir = web_cache_key.to_path(self.cache_manager.cache_root)
        
        if cached_output_dir.exists():
            target_dir = os.path.join(self.compiled_games_dir, game_id)
            if os.path.exists(target_dir):
                shutil.rmtree(target_dir)
            shutil.copytree(cached_output_dir, target_dir)
            
            return {
                'success': True,
                'message': 'Using cached web build',
                'output_path': target_dir,
                'web_url': f'/web-games/{game_id}/',
                'cache_key': cache_key,
                'cached': True,
                'reproducible': True
            }
        else:
            # Cache entry exists but files missing - rebuild
            logger.warning(f"Cached entry found but files missing for {cache_key}")
            return None
    
    def _process_assets_for_web(self, assets: List[Dict], asset_refs: List[Dict], cache_key: str) -> Dict[str, Any]:
        """Process assets for web target using AssetPackager."""
        
        try:
            # Use AssetPackager to process assets for web target with caching
            asset_manifest = self.asset_packager.package_assets(
                asset_refs=asset_refs,
                custom_assets=assets,
                cache_key=cache_key,
                target_format='web'
            )
            
            return asset_manifest
            
        except Exception as e:
            logger.error(f"Asset processing failed: {e}")
            # Return empty manifest to allow compilation to continue
            return {
                'asset_count': 0,
                'assets': {},
                'cache_key': cache_key,
                'target_format': 'web',
                'total_size': 0,
                'version': '1.0'
            }
    
    def _create_deterministic_project_dir(self, cache_key: str) -> str:
        """Create deterministic project directory."""
        
        # Use cache key for deterministic directory name
        project_dir = os.path.join(self.temp_base_dir, f"web_project_{cache_key[:16]}")
        
        # Clean up any existing directory
        if os.path.exists(project_dir):
            shutil.rmtree(project_dir)
        
        os.makedirs(project_dir)
        return project_dir
    
    def _wrap_code_for_pygbag_with_assets(self, code: str, game_id: str, asset_manifest: Dict[str, Any]) -> str:
        """Wrap user code for pygbag compatibility with asset manifest integration."""
        
        # Analyze the user code to determine the format and patterns
        code_analysis = self._analyze_code_format(code)
        
        # Transform code for web compatibility
        transformed_code = self._transform_code_for_web(code, code_analysis)
        
        # Generate asset loading code from manifest
        asset_loading_code = self._generate_asset_loading_code(asset_manifest)
        
        template = '''
import asyncio
import pygame
import sys
import os
import json

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

# Asset manifest for reproducible web builds
ASSET_MANIFEST = {asset_manifest_json}

{asset_loading_code}

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
        """Load sound with web compatibility and asset manifest."""
        # Check asset manifest for web-optimized path
        web_path = get_asset_web_path(path)
        try:
            return pygame.mixer.Sound(web_path)
        except (pygame.error, FileNotFoundError):
            print(f"Warning: Could not load sound {{web_path}}")
            return None
    
    @staticmethod
    def load_image(path):
        """Load image with web compatibility and asset manifest."""
        # Check asset manifest for web-optimized path
        web_path = get_asset_web_path(path)
        try:
            return pygame.image.load(web_path).convert_alpha()
        except (pygame.error, FileNotFoundError):
            print(f"Warning: Could not load image {{web_path}}")
            # Return a placeholder surface
            surf = pygame.Surface((32, 32))
            surf.fill((255, 0, 255))  # Magenta placeholder
            return surf
    
    @staticmethod
    def get_font(name, size):
        """Get font with web compatibility and asset manifest."""
        try:
            if name and name != 'default':
                web_path = get_asset_web_path(name)
                return pygame.font.Font(web_path, size)
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
            code_pattern=code_analysis['pattern'],
            asset_manifest_json=json.dumps(asset_manifest, separators=(',', ':')),
            asset_loading_code=asset_loading_code
        )
        
        return template
    
    def _generate_asset_loading_code(self, asset_manifest: Dict[str, Any]) -> str:
        """Generate asset loading code from manifest."""
        
        assets = asset_manifest.get('assets', {})
        if not assets:
            return '''
def get_asset_web_path(path):
    """Get web-optimized asset path."""
    return path  # No assets to optimize
'''
        
        # Create mapping from logical paths to web paths
        path_mapping = {}
        for logical_path, asset_info in assets.items():
            web_path = asset_info.get('web_path', asset_info.get('physical_path', logical_path))
            path_mapping[logical_path] = web_path
        
        mapping_json = json.dumps(path_mapping, separators=(',', ':'))
        
        return f'''
# Asset path mapping for web builds
ASSET_PATH_MAPPING = {mapping_json}

def get_asset_web_path(path):
    """Get web-optimized asset path from manifest."""
    # Normalize path separators
    normalized_path = path.replace('\\\\', '/').replace('//', '/')
    
    # Check direct mapping
    if normalized_path in ASSET_PATH_MAPPING:
        return ASSET_PATH_MAPPING[normalized_path]
    
    # Check for relative path matches
    for logical_path, web_path in ASSET_PATH_MAPPING.items():
        if normalized_path.endswith(logical_path) or logical_path.endswith(normalized_path):
            return web_path
    
    # Fallback to original path
    return path
'''
    
    def _setup_assets_from_manifest(self, project_dir: str, asset_manifest: Dict[str, Any]):
        """Setup assets from manifest in project directory."""
        
        assets = asset_manifest.get('assets', {})
        if not assets:
            return
        
        # Create assets directory
        assets_dir = os.path.join(project_dir, 'assets')
        os.makedirs(assets_dir, exist_ok=True)
        
        # Copy assets from cache to project directory
        for logical_path, asset_info in assets.items():
            physical_path = asset_info.get('physical_path')
            if physical_path and os.path.exists(physical_path):
                # Determine destination path in project
                asset_name = os.path.basename(logical_path)
                dest_path = os.path.join(assets_dir, asset_name)
                
                try:
                    shutil.copy2(physical_path, dest_path)
                    logger.debug(f"Copied asset: {logical_path} -> {dest_path}")
                except Exception as e:
                    logger.warning(f"Failed to copy asset {logical_path}: {e}")
    
    def _normalize_web_output(self, dist_dir: str):
        """Normalize web output for reproducible builds."""
        
        # Find and normalize index.html
        index_html_path = os.path.join(dist_dir, 'index.html')
        if os.path.exists(index_html_path):
            self._normalize_index_html(index_html_path)
        
        # Normalize any JavaScript files
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                if file.endswith('.js'):
                    js_path = os.path.join(root, file)
                    self._normalize_javascript_file(js_path)
                elif file.endswith('.json'):
                    json_path = os.path.join(root, file)
                    self._normalize_json_file(json_path)
        
        # Remove any timestamp or build-specific files
        self._remove_non_deterministic_files(dist_dir)
    
    def _normalize_index_html(self, index_html_path: str):
        """Normalize index.html to remove timestamps and version stamps."""
        
        try:
            with open(index_html_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Remove timestamps
            content = re.sub(r'<!-- Generated on .* -->', f'<!-- Generated by {self.FIXED_GENERATOR} -->', content)
            content = re.sub(r'<!-- Build time: .* -->', f'<!-- Build time: {self.FIXED_BUILD_TIME} -->', content)
            
            # Normalize version references
            content = re.sub(r'version="[^"]*"', f'version="{self.FIXED_VERSION}"', content)
            content = re.sub(r"version='[^']*'", f"version='{self.FIXED_VERSION}'", content)
            
            # Remove build dates
            content = re.sub(r'date="[^"]*"', f'date="{self.FIXED_BUILD_TIME}"', content)
            content = re.sub(r"date='[^']*'", f"date='{self.FIXED_BUILD_TIME}'", content)
            
            # Normalize cache-busting parameters to use content hash instead of timestamp
            content = re.sub(r'\\?v=[0-9]+', '', content)
            content = re.sub(r'\\?t=[0-9]+', '', content)
            
            with open(index_html_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
        except Exception as e:
            logger.warning(f"Failed to normalize index.html: {e}")
    
    def _normalize_javascript_file(self, js_path: str):
        """Normalize JavaScript files to remove timestamps."""
        
        try:
            with open(js_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Remove build timestamps
            content = re.sub(r'/\\*\\* Build time: .* \\*/', f'/** Build time: {self.FIXED_BUILD_TIME} */', content)
            content = re.sub(r'// Generated on .*', f'// Generated by {self.FIXED_GENERATOR}', content)
            
            # Normalize version strings
            content = re.sub(r'"version":"[^"]*"', f'"version":"{self.FIXED_VERSION}"', content)
            content = re.sub(r"'version':'[^']*'", f"'version':'{self.FIXED_VERSION}'", content)
            
            with open(js_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
        except Exception as e:
            logger.warning(f"Failed to normalize JavaScript file {js_path}: {e}")
    
    def _normalize_json_file(self, json_path: str):
        """Normalize JSON files to remove timestamps and sort keys."""
        
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Remove timestamp fields if present
            if isinstance(data, dict):
                data.pop('timestamp', None)
                data.pop('build_time', None)
                data.pop('generated_at', None)
                
                # Normalize version if present
                if 'version' in data:
                    data['version'] = self.FIXED_VERSION
            
            # Write back with sorted keys for deterministic output
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, sort_keys=True, separators=(',', ':'))
                
        except Exception as e:
            logger.warning(f"Failed to normalize JSON file {json_path}: {e}")
    
    def _remove_non_deterministic_files(self, dist_dir: str):
        """Remove files that introduce non-determinism."""
        
        # Files to remove for reproducible builds
        files_to_remove = [
            'build.log',
            'compilation.log',
            'debug.log',
            '.build_timestamp',
            'build_info.json'
        ]
        
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                if file in files_to_remove:
                    file_path = os.path.join(root, file)
                    try:
                        os.remove(file_path)
                        logger.debug(f"Removed non-deterministic file: {file_path}")
                    except Exception as e:
                        logger.warning(f"Failed to remove {file_path}: {e}")

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
    """Manages web-based game sessions and compilation with performance optimizations."""
    
    def __init__(self, cache_manager: Optional[CacheManager] = None, asset_packager: Optional[AssetPackager] = None):
        # Initialize with shared cache manager and asset packager for optimal performance
        # CRITICAL FIX: Properly handle CacheManager fallback with required parameters
        if cache_manager is None:
            # Get configuration for cache settings
            config = get_config()
            compiler_config = getattr(config, 'compiler', None) or getattr(config, 'COMPILER', None)
            if compiler_config:
                cache_dir = getattr(compiler_config, 'cache_dir', getattr(compiler_config, 'CACHE_DIR', tempfile.gettempdir() + '/game_cache'))
                max_cache_size_mb = getattr(compiler_config, 'max_cache_size_mb', getattr(compiler_config, 'MAX_CACHE_SIZE_MB', 1024))
            else:
                # Fallback configuration
                cache_dir = tempfile.gettempdir() + '/game_cache'
                max_cache_size_mb = 1024
            
            self.cache_manager = CacheManager(cache_dir, max_cache_size_mb)
        else:
            self.cache_manager = cache_manager
            
        self.asset_packager = asset_packager or AssetPackager(cache_manager=self.cache_manager)
        self.compiler = WebGameCompiler(cache_manager=self.cache_manager, asset_packager=self.asset_packager)
        
        self.active_compilations: Dict[str, Dict] = {}
        
        # Performance tracking
        self.compilation_stats = {
            'total_compilations': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'avg_build_time': 0.0,
            'total_build_time': 0.0
        }
    
    def start_compilation(self, code: str, game_id: Optional[str] = None, assets: Optional[List[Dict]] = None,
                         asset_refs: Optional[List[Dict]] = None, configuration: Optional[Dict] = None) -> str:
        """Start optimized asynchronous game compilation with intelligent caching."""
        
        if game_id is None:
            game_id = str(uuid.uuid4())
        
        compilation_id = f"comp_{game_id}_{int(time.time())}"
        
        # Initialize compilation status with performance tracking
        self.active_compilations[compilation_id] = {
            'game_id': game_id,
            'status': 'compiling',  # 'compiling'|'completed'|'failed'|'cached'
            'start_time': time.time(),
            'code': code,
            'assets': assets or [],
            'asset_refs': asset_refs or [],
            'configuration': configuration or {},
            'result': None,
            'cache_key': None,
            'cache_hit': False
        }
        
        # Start optimized compilation in background
        import threading
        def run_optimized_compilation():
            try:
                compilation_start = time.time()
                
                # Enhanced compilation with all optimization features
                result = self.compiler.compile_game(
                    code=code,
                    game_id=game_id,
                    assets=assets or [],
                    asset_refs=asset_refs or [],
                    configuration=configuration or {}
                )
                
                compilation_time = time.time() - compilation_start
                
                # Update performance statistics
                self.compilation_stats['total_compilations'] += 1
                self.compilation_stats['total_build_time'] += compilation_time
                self.compilation_stats['avg_build_time'] = (
                    self.compilation_stats['total_build_time'] / 
                    self.compilation_stats['total_compilations']
                )
                
                # Track cache performance
                is_cache_hit = result.get('cached', False)
                if is_cache_hit:
                    self.compilation_stats['cache_hits'] += 1
                else:
                    self.compilation_stats['cache_misses'] += 1
                
                # Update status with comprehensive result information
                if result['success']:
                    self.active_compilations[compilation_id].update({
                        'status': 'cached' if is_cache_hit else 'completed',
                        'result': {
                            'success': True,
                            'web_url': result.get('web_url', f'/web-games/{game_id}/'),
                            'game_id': game_id,
                            'output_path': result.get('output_path'),
                            'message': result.get('message', 'Game compiled successfully'),
                            'cache_key': result.get('cache_key'),
                            'cached': is_cache_hit,
                            'reproducible': result.get('reproducible', False),
                            'compilation_time': compilation_time,
                            'performance_stats': self._get_performance_summary()
                        },
                        'end_time': time.time(),
                        'cache_hit': is_cache_hit,
                        'cache_key': result.get('cache_key')
                    })
                else:
                    self.active_compilations[compilation_id].update({
                        'status': 'failed',
                        'result': {
                            'success': False,
                            'error': result.get('error', 'Compilation failed'),
                            'message': result.get('message', 'Compilation failed'),
                            'compilation_time': compilation_time
                        },
                        'end_time': time.time()
                    })
                    
            except Exception as e:
                logger.error(f"Compilation error for {compilation_id}: {e}")
                self.active_compilations[compilation_id].update({
                    'status': 'failed',
                    'result': {
                        'success': False,
                        'error': f'Unexpected compilation error: {str(e)}',
                        'message': 'Compilation failed'
                    },
                    'end_time': time.time()
                })
        
        thread = threading.Thread(target=run_optimized_compilation)
        thread.daemon = True
        thread.start()
        
        return compilation_id
    
    def _get_performance_summary(self) -> Dict[str, Any]:
        """Get performance statistics summary."""
        total_compilations = self.compilation_stats['total_compilations']
        cache_hits = self.compilation_stats['cache_hits']
        
        return {
            'total_compilations': total_compilations,
            'cache_hit_rate': (cache_hits / max(total_compilations, 1)) * 100,
            'average_build_time': round(self.compilation_stats['avg_build_time'], 3),
            'total_cache_hits': cache_hits,
            'total_cache_misses': self.compilation_stats['cache_misses']
        }
    
    def get_cache_performance(self) -> Dict[str, Any]:
        """Get detailed cache performance metrics."""
        return {
            'performance_stats': self._get_performance_summary(),
            'cache_manager_stats': self.cache_manager.get_cache_stats() if hasattr(self.cache_manager, 'get_cache_stats') else {},
            'asset_packager_stats': self.asset_packager.get_cache_stats() if hasattr(self.asset_packager, 'get_cache_stats') else {}
        }
    
    def optimize_cache(self) -> Dict[str, Any]:
        """Run cache optimization and cleanup."""
        try:
            # Run cache manager optimization if available
            if hasattr(self.cache_manager, 'optimize'):
                cache_result = self.cache_manager.optimize()
            else:
                cache_result = {'message': 'Cache manager optimization not available'}
            
            # Run asset packager optimization if available
            if hasattr(self.asset_packager, 'optimize_cache'):
                asset_result = self.asset_packager.optimize_cache()
            else:
                asset_result = {'message': 'Asset packager optimization not available'}
            
            return {
                'success': True,
                'cache_manager': cache_result,
                'asset_packager': asset_result,
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Cache optimization failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': time.time()
            }
    
    def prefetch_assets(self, asset_refs: List[Dict], configuration: Dict) -> Dict[str, Any]:
        """Prefetch and cache assets for faster future compilations."""
        try:
            # Generate cache key for assets
            cache_key = self.compiler._generate_web_cache_key("", [], asset_refs, configuration)
            
            # Process assets in advance
            asset_manifest = self.compiler._process_assets_for_web([], asset_refs, cache_key)
            
            return {
                'success': True,
                'message': f'Prefetched {asset_manifest.get("asset_count", 0)} assets',
                'cache_key': cache_key,
                'asset_count': asset_manifest.get('asset_count', 0),
                'total_size': asset_manifest.get('total_size', 0)
            }
            
        except Exception as e:
            logger.error(f"Asset prefetch failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_compilation_status(self, compilation_id: str) -> Optional[Dict]:
        """Get compilation status in frontend-compatible format with performance data."""
        compilation_data = self.active_compilations.get(compilation_id)
        
        if compilation_data is None:
            return None
        
        # Return status in the expected frontend schema format with enhancements
        status_data = {
            'status': compilation_data['status'],  # 'compiling'|'completed'|'failed'|'cached'
            'result': compilation_data.get('result'),
            'game_id': compilation_data['game_id'],
            'start_time': compilation_data['start_time'],
            'end_time': compilation_data.get('end_time'),
            'compilation_id': compilation_id
        }
        
        # Add performance tracking data
        if compilation_data.get('cache_hit') is not None:
            status_data['cache_hit'] = compilation_data['cache_hit']
        if compilation_data.get('cache_key'):
            status_data['cache_key'] = compilation_data['cache_key']
        
        return status_data
    
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


# Create global instance for import by routes.py with optimized configuration
web_game_manager = WebGameManager()