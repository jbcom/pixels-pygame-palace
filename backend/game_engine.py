import os
import sys
import subprocess
import tempfile
import threading
import queue
import time
import json
import base64
from io import BytesIO
from PIL import Image
import signal
import shutil

class GameExecutor:
    """Executes pygame code in a subprocess with virtual display support"""
    
    def __init__(self, session_id):
        self.session_id = session_id
        self.process = None
        self.running = False
        self.frame_queue = queue.Queue(maxsize=10)
        self.input_queue = queue.Queue()
        self.temp_dir = None
        self.xvfb_process = None
        self.display_num = None
        
    def execute(self, code):
        """Execute pygame code in a subprocess"""
        try:
            self.running = True
            
            # Create temporary directory for game files
            self.temp_dir = tempfile.mkdtemp(prefix=f"game_{self.session_id}_")
            
            # Write the game code to a temporary file
            game_file = os.path.join(self.temp_dir, "game.py")
            with open(game_file, 'w') as f:
                # Modify the code to work in headless mode
                modified_code = self._modify_code_for_headless(code)
                f.write(modified_code)
            
            # Check if we can use a real display or need Xvfb
            if not os.environ.get('DISPLAY'):
                # Start Xvfb (virtual display) if no display is available
                self.display_num = self._find_free_display()
                self.xvfb_process = subprocess.Popen([
                    'Xvfb',
                    f':{self.display_num}',
                    '-screen', '0', '800x600x24',
                    '-ac',  # Disable access control
                    '+extension', 'GLX'  # Enable OpenGL extension
                ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                # Wait for Xvfb to start
                time.sleep(0.5)
                
                # Set display environment variable
                env = os.environ.copy()
                env['DISPLAY'] = f':{self.display_num}'
                env['SDL_VIDEODRIVER'] = 'x11'
            else:
                # Use existing display
                env = os.environ.copy()
                env['SDL_VIDEODRIVER'] = 'x11'
            
            # Disable SDL audio to avoid issues
            env['SDL_AUDIODRIVER'] = 'dummy'
            
            # Run the game
            self.process = subprocess.Popen(
                [sys.executable, game_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                env=env,
                cwd=self.temp_dir
            )
            
            # Start threads to handle output
            stdout_thread = threading.Thread(target=self._read_stdout)
            stderr_thread = threading.Thread(target=self._read_stderr)
            stdout_thread.daemon = True
            stderr_thread.daemon = True
            stdout_thread.start()
            stderr_thread.start()
            
            # Wait for the process to complete
            self.process.wait()
            
        except Exception as e:
            print(f"Error executing game: {e}")
            raise
        finally:
            self.running = False
            self._cleanup()
    
    def _modify_code_for_headless(self, code):
        """Modify pygame code to work in headless mode and capture frames"""
        # Insert frame capture code
        capture_code = '''
# Frame capture setup for streaming
import os
import sys
import json
import base64
from io import BytesIO

frame_count = 0
CAPTURE_INTERVAL = 2  # Capture every 2 frames

def capture_frame(screen):
    global frame_count
    frame_count += 1
    if frame_count % CAPTURE_INTERVAL == 0:
        try:
            # Convert pygame surface to string buffer
            pygame_str = pygame.image.tostring(screen, 'RGB')
            width, height = screen.get_size()
            
            # Create PIL image from the buffer
            from PIL import Image
            img = Image.frombytes('RGB', (width, height), pygame_str)
            
            # Save to BytesIO buffer
            buffer = BytesIO()
            img.save(buffer, format='PNG', optimize=True, quality=85)
            img_data = buffer.getvalue()
            
            # Send frame data to stdout as JSON
            frame_data = {
                'type': 'frame',
                'data': base64.b64encode(img_data).decode(),
                'frame': frame_count
            }
            print(f"FRAME:{json.dumps(frame_data)}", flush=True)
        except Exception as e:
            print(f"CAPTURE_ERROR:{str(e)}", file=sys.stderr, flush=True)

'''
        
        # Find where pygame.display.flip() or pygame.display.update() is called
        # and insert frame capture before it
        lines = code.split('\n')
        modified_lines = []
        
        # Add the capture code after pygame import
        for i, line in enumerate(lines):
            modified_lines.append(line)
            if 'import pygame' in line and i == 0:
                modified_lines.append(capture_code)
            elif 'pygame.display.flip()' in line or 'pygame.display.update()' in line:
                # Add frame capture before display update
                indent = len(line) - len(line.lstrip())
                modified_lines.insert(-1, ' ' * indent + 'capture_frame(screen)')
        
        return '\n'.join(modified_lines)
    
    def _find_free_display(self):
        """Find a free X display number"""
        for display_num in range(99, 200):
            if not os.path.exists(f'/tmp/.X{display_num}-lock'):
                return display_num
        return 99  # Default to 99 if no free display found
    
    def _read_stdout(self):
        """Read stdout from the game process"""
        try:
            for line in iter(self.process.stdout.readline, b''):
                if not self.running:
                    break
                
                line = line.decode('utf-8').strip()
                
                # Check if it's a frame capture
                if line.startswith('FRAME:'):
                    try:
                        frame_data = json.loads(line[6:])
                        # Decode the base64 image data
                        img_data = base64.b64decode(frame_data['data'])
                        img = Image.open(BytesIO(img_data))
                        
                        # Add to frame queue
                        if not self.frame_queue.full():
                            self.frame_queue.put(img)
                    except Exception as e:
                        print(f"Error processing frame: {e}")
                else:
                    print(f"Game output: {line}")
        except Exception as e:
            print(f"Error reading stdout: {e}")
    
    def _read_stderr(self):
        """Read stderr from the game process"""
        try:
            for line in iter(self.process.stderr.readline, b''):
                if not self.running:
                    break
                
                line = line.decode('utf-8').strip()
                if line:
                    print(f"Game error: {line}", file=sys.stderr)
        except Exception as e:
            print(f"Error reading stderr: {e}")
    
    def send_input(self, input_data):
        """Send input to the game process"""
        if self.process and self.process.poll() is None:
            try:
                # Convert input data to JSON and send to stdin
                input_json = json.dumps(input_data) + '\n'
                self.process.stdin.write(input_json.encode())
                self.process.stdin.flush()
            except Exception as e:
                print(f"Error sending input: {e}")
    
    def get_frame(self):
        """Get the latest frame from the queue"""
        try:
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None
    
    def stop(self):
        """Stop the game execution"""
        self.running = False
        
        if self.process:
            try:
                # Try graceful termination first
                self.process.terminate()
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                # Force kill if it doesn't stop
                self.process.kill()
                self.process.wait()
        
        self._cleanup()
    
    def _cleanup(self):
        """Clean up resources"""
        # Stop Xvfb if it was started
        if self.xvfb_process:
            try:
                self.xvfb_process.terminate()
                self.xvfb_process.wait(timeout=2)
            except:
                self.xvfb_process.kill()
            
            # Clean up X lock file
            if self.display_num:
                lock_file = f'/tmp/.X{self.display_num}-lock'
                if os.path.exists(lock_file):
                    try:
                        os.remove(lock_file)
                    except:
                        pass
        
        # Remove temporary directory
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
            except:
                pass
    
    def is_running(self):
        """Check if the game is still running"""
        if self.process:
            return self.process.poll() is None
        return False


class GameCompiler:
    """Compiles visual components into pygame code"""
    
    @staticmethod
    def compile(components, game_type='platformer'):
        """Compile components into executable pygame code"""
        
        # Different templates for different game types
        templates = {
            'platformer': GameCompiler._platformer_template,
            'puzzle': GameCompiler._puzzle_template,
            'racing': GameCompiler._racing_template,
            'rpg': GameCompiler._rpg_template
        }
        
        template_func = templates.get(game_type, GameCompiler._default_template)
        return template_func(components)
    
    @staticmethod
    def _default_template(components):
        """Default game template"""
        code = '''import pygame
import sys
import random
import math

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)

# Set up the display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Visual Game")

# Clock for controlling frame rate
clock = pygame.time.Clock()

# Game objects
sprites = []

'''
        
        # Add sprite classes based on components
        for component in components:
            if component.get('type') == 'sprite':
                code += GameCompiler._generate_sprite_code(component)
        
        # Add main game loop
        code += '''
# Main game loop
running = True
while running:
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
    
    # Update
    keys = pygame.key.get_pressed()
    for sprite in sprites:
        sprite.update(keys)
    
    # Draw
    screen.fill(BLACK)
    for sprite in sprites:
        sprite.draw(screen)
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

# Quit
pygame.quit()
sys.exit()
'''
        return code
    
    @staticmethod
    def _generate_sprite_code(component):
        """Generate code for a sprite component"""
        props = component.get('props', {})
        sprite_id = component.get('id', 'sprite_' + str(random.randint(1000, 9999)))
        
        code = f'''
class {sprite_id}(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.rect = pygame.Rect({props.get('x', 100)}, {props.get('y', 100)}, {props.get('width', 50)}, {props.get('height', 50)})
        self.color = {props.get('color', 'RED')}
        self.speed = {props.get('speed', 5)}
        self.vel_x = 0
        self.vel_y = 0
    
    def update(self, keys):
        # Basic movement
        if keys[pygame.K_LEFT]:
            self.rect.x -= self.speed
        if keys[pygame.K_RIGHT]:
            self.rect.x += self.speed
        if keys[pygame.K_UP]:
            self.rect.y -= self.speed
        if keys[pygame.K_DOWN]:
            self.rect.y += self.speed
        
        # Keep on screen
        self.rect.x = max(0, min(self.rect.x, SCREEN_WIDTH - self.rect.width))
        self.rect.y = max(0, min(self.rect.y, SCREEN_HEIGHT - self.rect.height))
    
    def draw(self, screen):
        pygame.draw.rect(screen, self.color, self.rect)

# Create sprite instance
{sprite_id.lower()}_instance = {sprite_id}()
sprites.append({sprite_id.lower()}_instance)

'''
        return code
    
    @staticmethod
    def _platformer_template(components):
        """Platformer game template"""
        # TODO: Implement platformer-specific template
        return GameCompiler._default_template(components)
    
    @staticmethod
    def _puzzle_template(components):
        """Puzzle game template"""
        # TODO: Implement puzzle-specific template
        return GameCompiler._default_template(components)
    
    @staticmethod
    def _racing_template(components):
        """Racing game template"""
        # TODO: Implement racing-specific template
        return GameCompiler._default_template(components)
    
    @staticmethod
    def _rpg_template(components):
        """RPG game template"""
        # TODO: Implement RPG-specific template
        return GameCompiler._default_template(components)