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
import psutil
import resource

class GameExecutor:
    """Executes pygame code in a subprocess with virtual display support"""
    
    def __init__(self, session_id, timeout=300):
        self.session_id = session_id
        self.process = None
        self.running = False
        self.frame_queue = queue.Queue(maxsize=10)
        self.input_queue = queue.Queue()
        self.temp_dir = None
        self.xvfb_process = None
        self.display_num = None
        self.timeout = timeout  # Maximum execution time in seconds
        self.start_time = None
        self.cleanup_lock = threading.Lock()
        self.xvfb_cleanup_done = False
        
    def execute(self, code):
        """Execute pygame code in a subprocess with security constraints"""
        try:
            self.running = True
            self.start_time = time.time()
            
            # Create temporary directory for game files
            self.temp_dir = tempfile.mkdtemp(prefix=f"game_{self.session_id}_")
            
            # Copy the game template to temp directory
            template_path = os.path.join(os.path.dirname(__file__), 'game_template.py')
            game_file = os.path.join(self.temp_dir, "game.py")
            
            # Read template and inject user code
            with open(template_path, 'r') as f:
                template_code = f.read()
            
            # Replace the USER_CODE placeholder with actual user code
            modified_code = template_code.replace(
                "USER_CODE = '''\n# User game code will be inserted here\npass\n'''",
                f"USER_CODE = '''{code}'''"
            )
            
            # Write the complete game file
            with open(game_file, 'w') as f:
                f.write(modified_code)
            
            # Also write user code separately for execution
            user_code_file = os.path.join(self.temp_dir, "user_game.py")
            with open(user_code_file, 'w') as f:
                f.write(code)
            
            # Check if we can use a real display or need Xvfb
            if not os.environ.get('DISPLAY'):
                # Start Xvfb (virtual display) if no display is available
                self.display_num = self._find_free_display()
                try:
                    self.xvfb_process = subprocess.Popen([
                        'Xvfb',
                        f':{self.display_num}',
                        '-screen', '0', '800x600x24',
                        '-ac',  # Disable access control
                        '+extension', 'GLX'  # Enable OpenGL extension
                    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    
                    # Wait for Xvfb to start
                    time.sleep(0.5)
                    
                    # Verify Xvfb started successfully
                    if self.xvfb_process.poll() is not None:
                        raise Exception("Xvfb failed to start")
                    
                except Exception as e:
                    print(f"Error starting Xvfb: {e}")
                    raise
                
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
            
            # Set resource limits for security
            env['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'  # Hide pygame welcome message
            
            # Run the game with resource limits
            self.process = subprocess.Popen(
                [sys.executable, '-u', game_file],  # -u for unbuffered output
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                env=env,
                cwd=self.temp_dir,
                preexec_fn=self._set_resource_limits if os.name != 'nt' else None
            )
            
            # Start threads to handle output and timeout
            stdout_thread = threading.Thread(target=self._read_stdout)
            stderr_thread = threading.Thread(target=self._read_stderr)
            timeout_thread = threading.Thread(target=self._monitor_timeout)
            
            stdout_thread.daemon = True
            stderr_thread.daemon = True
            timeout_thread.daemon = True
            
            stdout_thread.start()
            stderr_thread.start()
            timeout_thread.start()
            
            # Wait for the process to complete or timeout
            self.process.wait()
            
        except Exception as e:
            print(f"Error executing game: {e}")
            raise
        finally:
            self.running = False
            self._cleanup()
    
    def _set_resource_limits(self):
        """Set resource limits for the subprocess (Unix/Linux only)"""
        # CPU time limit (soft, hard) in seconds
        resource.setrlimit(resource.RLIMIT_CPU, (self.timeout, self.timeout + 10))
        
        # Memory limit (soft, hard) in bytes - 512MB
        max_memory = 512 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (max_memory, max_memory))
        
        # Limit number of processes
        resource.setrlimit(resource.RLIMIT_NPROC, (10, 10))
        
        # Limit number of open files
        resource.setrlimit(resource.RLIMIT_NOFILE, (50, 50))
    
    def _monitor_timeout(self):
        """Monitor process execution time and kill if timeout exceeded"""
        while self.running and self.process:
            if self.process.poll() is not None:
                # Process has ended
                break
            
            elapsed = time.time() - self.start_time
            if elapsed > self.timeout:
                print(f"Game {self.session_id} exceeded timeout of {self.timeout}s")
                self.stop()
                break
            
            time.sleep(1)
    
    def _modify_code_for_headless(self, code):
        """[DEPRECATED] This method is no longer used - template system is used instead"""
        # This method is kept for backward compatibility but not used
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
        """Stop the game execution with proper cleanup"""
        with self.cleanup_lock:
            if not self.running:
                return  # Already stopped
            
            self.running = False
            
            # Stop the process
            if self.process:
                try:
                    # Try graceful termination first
                    self.process.terminate()
                    self.process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    # Force kill if it doesn't stop
                    try:
                        self.process.kill()
                        self.process.wait(timeout=1)
                    except:
                        # If kill also fails, try using psutil
                        try:
                            p = psutil.Process(self.process.pid)
                            p.kill()
                        except:
                            pass
                except Exception as e:
                    print(f"Error stopping process: {e}")
            
            # Clean up resources
            self._cleanup()
    
    def _cleanup(self):
        """Clean up resources with proper error handling"""
        # Prevent double cleanup
        if self.xvfb_cleanup_done:
            return
        
        try:
            # Stop Xvfb if it was started
            if self.xvfb_process:
                try:
                    self.xvfb_process.terminate()
                    self.xvfb_process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    try:
                        self.xvfb_process.kill()
                        self.xvfb_process.wait(timeout=1)
                    except:
                        pass
                except Exception as e:
                    print(f"Error stopping Xvfb: {e}")
                finally:
                    self.xvfb_process = None
            
            # Clean up X lock file and socket
            if self.display_num:
                files_to_remove = [
                    f'/tmp/.X{self.display_num}-lock',
                    f'/tmp/.X11-unix/X{self.display_num}'
                ]
                for file_path in files_to_remove:
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"Error removing {file_path}: {e}")
            
            # Remove temporary directory
            if self.temp_dir and os.path.exists(self.temp_dir):
                try:
                    shutil.rmtree(self.temp_dir, ignore_errors=True)
                except Exception as e:
                    print(f"Error removing temp directory: {e}")
                finally:
                    self.temp_dir = None
            
            self.xvfb_cleanup_done = True
            
        except Exception as e:
            print(f"Cleanup error: {e}")
    
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