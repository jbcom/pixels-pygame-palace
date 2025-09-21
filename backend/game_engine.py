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
            'rpg': GameCompiler._rpg_template,
            'space': GameCompiler._space_template,
            'dungeon': GameCompiler._dungeon_template
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
        """Puzzle game template with match-3 mechanics"""
        code = '''import pygame
import sys
import random
import math
import time

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60
GRID_ROWS = 8
GRID_COLS = 8
TILE_SIZE = 64
GRID_OFFSET_X = (SCREEN_WIDTH - GRID_COLS * TILE_SIZE) // 2
GRID_OFFSET_Y = (SCREEN_HEIGHT - GRID_ROWS * TILE_SIZE) // 2 + 50

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
PURPLE = (255, 0, 255)
ORANGE = (255, 165, 0)
CYAN = (0, 255, 255)
GRAY = (128, 128, 128)
DARK_GRAY = (64, 64, 64)

# Puzzle piece colors
PIECE_COLORS = [RED, GREEN, BLUE, YELLOW, PURPLE, ORANGE]
PIECE_TYPES = ["gem", "star", "diamond", "circle", "square", "triangle"]

# Set up the display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Puzzle Game - Match 3")

# Clock for controlling frame rate
clock = pygame.time.Clock()

# Fonts
font_small = pygame.font.Font(None, 24)
font_medium = pygame.font.Font(None, 36)
font_large = pygame.font.Font(None, 48)

# Game State
class GameState:
    def __init__(self):
        self.score = 0
        self.moves = 0
        self.level = 1
        self.time_limit = 120  # seconds
        self.start_time = time.time()
        self.combo_multiplier = 1
        self.selected_tile = None
        self.animating = False
        self.game_over = False
        self.paused = False
        self.hint_available = True
        self.power_ups = {"bomb": 3, "shuffle": 2, "time_freeze": 1}
        
    def add_score(self, points):
        self.score += points * self.combo_multiplier
        if self.combo_multiplier > 1:
            self.combo_multiplier = min(self.combo_multiplier + 0.5, 5.0)
    
    def reset_combo(self):
        self.combo_multiplier = 1
    
    def get_time_remaining(self):
        if self.paused:
            return self.time_limit
        elapsed = time.time() - self.start_time
        return max(0, self.time_limit - int(elapsed))

# Puzzle Piece
class PuzzlePiece:
    def __init__(self, row, col, piece_type):
        self.row = row
        self.col = col
        self.piece_type = piece_type
        self.color = PIECE_COLORS[piece_type]
        self.x = GRID_OFFSET_X + col * TILE_SIZE
        self.y = GRID_OFFSET_Y + row * TILE_SIZE
        self.target_x = self.x
        self.target_y = self.y
        self.selected = False
        self.matched = False
        self.falling = False
        self.special = None  # "bomb", "line_clear", "color_change"
        
    def update(self):
        # Smooth movement animation
        if self.x != self.target_x:
            diff = self.target_x - self.x
            self.x += diff * 0.2
            if abs(diff) < 1:
                self.x = self.target_x
        
        if self.y != self.target_y:
            diff = self.target_y - self.y
            self.y += diff * 0.2
            if abs(diff) < 1:
                self.y = self.target_y
    
    def draw(self, screen):
        # Draw piece
        if self.matched:
            pygame.draw.rect(screen, WHITE, (self.x + 5, self.y + 5, TILE_SIZE - 10, TILE_SIZE - 10))
        else:
            pygame.draw.rect(screen, self.color, (self.x + 5, self.y + 5, TILE_SIZE - 10, TILE_SIZE - 10))
            pygame.draw.rect(screen, BLACK, (self.x + 5, self.y + 5, TILE_SIZE - 10, TILE_SIZE - 10), 2)
        
        # Draw selection highlight
        if self.selected:
            pygame.draw.rect(screen, WHITE, (self.x, self.y, TILE_SIZE, TILE_SIZE), 3)
        
        # Draw special power-up indicator
        if self.special:
            text = font_small.render(self.special[0].upper(), True, WHITE)
            screen.blit(text, (self.x + TILE_SIZE//2 - 8, self.y + TILE_SIZE//2 - 8))
    
    def set_position(self, row, col):
        self.row = row
        self.col = col
        self.target_x = GRID_OFFSET_X + col * TILE_SIZE
        self.target_y = GRID_OFFSET_Y + row * TILE_SIZE

# Puzzle Grid
class PuzzleGrid:
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols
        self.grid = [[None for _ in range(cols)] for _ in range(rows)]
        self.generate_initial_grid()
        
    def generate_initial_grid(self):
        # Generate initial grid without matches
        for row in range(self.rows):
            for col in range(self.cols):
                valid_types = list(range(len(PIECE_COLORS)))
                
                # Check horizontal matches
                if col >= 2:
                    if (self.grid[row][col-1] and self.grid[row][col-2] and
                        self.grid[row][col-1].piece_type == self.grid[row][col-2].piece_type):
                        if self.grid[row][col-1].piece_type in valid_types:
                            valid_types.remove(self.grid[row][col-1].piece_type)
                
                # Check vertical matches
                if row >= 2:
                    if (self.grid[row-1][col] and self.grid[row-2][col] and
                        self.grid[row-1][col].piece_type == self.grid[row-2][col].piece_type):
                        if self.grid[row-1][col].piece_type in valid_types:
                            valid_types.remove(self.grid[row-1][col].piece_type)
                
                piece_type = random.choice(valid_types) if valid_types else 0
                self.grid[row][col] = PuzzlePiece(row, col, piece_type)
    
    def swap_pieces(self, piece1, piece2):
        # Swap two pieces
        row1, col1 = piece1.row, piece1.col
        row2, col2 = piece2.row, piece2.col
        
        self.grid[row1][col1], self.grid[row2][col2] = self.grid[row2][col2], self.grid[row1][col1]
        
        piece1.set_position(row2, col2)
        piece2.set_position(row1, col1)
    
    def find_matches(self):
        matches = []
        
        # Check horizontal matches
        for row in range(self.rows):
            for col in range(self.cols - 2):
                if self.grid[row][col] and self.grid[row][col+1] and self.grid[row][col+2]:
                    if (self.grid[row][col].piece_type == self.grid[row][col+1].piece_type == 
                        self.grid[row][col+2].piece_type):
                        match = [(row, col), (row, col+1), (row, col+2)]
                        # Extend match if possible
                        k = col + 3
                        while k < self.cols and self.grid[row][k] and \
                              self.grid[row][k].piece_type == self.grid[row][col].piece_type:
                            match.append((row, k))
                            k += 1
                        matches.append(match)
        
        # Check vertical matches
        for col in range(self.cols):
            for row in range(self.rows - 2):
                if self.grid[row][col] and self.grid[row+1][col] and self.grid[row+2][col]:
                    if (self.grid[row][col].piece_type == self.grid[row+1][col].piece_type == 
                        self.grid[row+2][col].piece_type):
                        match = [(row, col), (row+1, col), (row+2, col)]
                        # Extend match if possible
                        k = row + 3
                        while k < self.rows and self.grid[k][col] and \
                              self.grid[k][col].piece_type == self.grid[row][col].piece_type:
                            match.append((k, col))
                            k += 1
                        matches.append(match)
        
        return matches
    
    def remove_matches(self, matches):
        removed_pieces = set()
        for match in matches:
            for row, col in match:
                if (row, col) not in removed_pieces:
                    self.grid[row][col].matched = True
                    removed_pieces.add((row, col))
        
        # Clear matched pieces after animation
        for row, col in removed_pieces:
            self.grid[row][col] = None
        
        return len(removed_pieces)
    
    def apply_gravity(self):
        # Make pieces fall down
        moved = False
        for col in range(self.cols):
            for row in range(self.rows - 1, -1, -1):
                if self.grid[row][col] is None:
                    # Find piece above to fall
                    for above_row in range(row - 1, -1, -1):
                        if self.grid[above_row][col] is not None:
                            self.grid[row][col] = self.grid[above_row][col]
                            self.grid[row][col].set_position(row, col)
                            self.grid[above_row][col] = None
                            moved = True
                            break
        
        # Fill empty spaces at top
        for col in range(self.cols):
            for row in range(self.rows):
                if self.grid[row][col] is None:
                    piece_type = random.choice(range(len(PIECE_COLORS)))
                    self.grid[row][col] = PuzzlePiece(row, col, piece_type)
                    self.grid[row][col].y = GRID_OFFSET_Y - TILE_SIZE  # Start above grid
                    moved = True
        
        return moved
    
    def has_valid_moves(self):
        # Check if any valid moves exist
        for row in range(self.rows):
            for col in range(self.cols):
                if self.grid[row][col]:
                    # Check swap with right
                    if col < self.cols - 1 and self.grid[row][col + 1]:
                        self.swap_pieces(self.grid[row][col], self.grid[row][col + 1])
                        if self.find_matches():
                            self.swap_pieces(self.grid[row][col + 1], self.grid[row][col])
                            return True
                        self.swap_pieces(self.grid[row][col + 1], self.grid[row][col])
                    
                    # Check swap with bottom
                    if row < self.rows - 1 and self.grid[row + 1][col]:
                        self.swap_pieces(self.grid[row][col], self.grid[row + 1][col])
                        if self.find_matches():
                            self.swap_pieces(self.grid[row + 1][col], self.grid[row][col])
                            return True
                        self.swap_pieces(self.grid[row + 1][col], self.grid[row][col])
        
        return False
    
    def shuffle(self):
        # Shuffle all pieces
        pieces = []
        for row in range(self.rows):
            for col in range(self.cols):
                if self.grid[row][col]:
                    pieces.append(self.grid[row][col].piece_type)
        
        random.shuffle(pieces)
        
        idx = 0
        for row in range(self.rows):
            for col in range(self.cols):
                if self.grid[row][col]:
                    self.grid[row][col].piece_type = pieces[idx]
                    self.grid[row][col].color = PIECE_COLORS[pieces[idx]]
                    idx += 1
    
    def update(self):
        for row in range(self.rows):
            for col in range(self.cols):
                if self.grid[row][col]:
                    self.grid[row][col].update()
    
    def draw(self, screen):
        # Draw grid background
        for row in range(self.rows):
            for col in range(self.cols):
                x = GRID_OFFSET_X + col * TILE_SIZE
                y = GRID_OFFSET_Y + row * TILE_SIZE
                pygame.draw.rect(screen, DARK_GRAY, (x, y, TILE_SIZE, TILE_SIZE), 1)
        
        # Draw pieces
        for row in range(self.rows):
            for col in range(self.cols):
                if self.grid[row][col]:
                    self.grid[row][col].draw(screen)

# Create game objects
game_state = GameState()
grid = PuzzleGrid(GRID_ROWS, GRID_COLS)

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
            elif event.key == pygame.K_p:
                game_state.paused = not game_state.paused
            elif event.key == pygame.K_h and game_state.hint_available:
                # Show hint (highlight a valid move)
                game_state.hint_available = False
            elif event.key == pygame.K_s and game_state.power_ups["shuffle"] > 0:
                grid.shuffle()
                game_state.power_ups["shuffle"] -= 1
        
        elif event.type == pygame.MOUSEBUTTONDOWN and not game_state.paused:
            if not game_state.animating:
                mouse_x, mouse_y = pygame.mouse.get_pos()
                
                # Check if click is within grid
                if (GRID_OFFSET_X <= mouse_x < GRID_OFFSET_X + GRID_COLS * TILE_SIZE and
                    GRID_OFFSET_Y <= mouse_y < GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE):
                    
                    col = (mouse_x - GRID_OFFSET_X) // TILE_SIZE
                    row = (mouse_y - GRID_OFFSET_Y) // TILE_SIZE
                    
                    if 0 <= row < GRID_ROWS and 0 <= col < GRID_COLS:
                        clicked_piece = grid.grid[row][col]
                        
                        if clicked_piece:
                            if game_state.selected_tile is None:
                                # Select first tile
                                game_state.selected_tile = clicked_piece
                                clicked_piece.selected = True
                            elif game_state.selected_tile == clicked_piece:
                                # Deselect if same tile
                                clicked_piece.selected = False
                                game_state.selected_tile = None
                            else:
                                # Try to swap tiles
                                piece1 = game_state.selected_tile
                                piece2 = clicked_piece
                                
                                # Check if adjacent
                                if (abs(piece1.row - piece2.row) == 1 and piece1.col == piece2.col) or \
                                   (abs(piece1.col - piece2.col) == 1 and piece1.row == piece2.row):
                                    
                                    # Swap and check for matches
                                    grid.swap_pieces(piece1, piece2)
                                    matches = grid.find_matches()
                                    
                                    if matches:
                                        # Valid move
                                        game_state.moves += 1
                                        pieces_removed = grid.remove_matches(matches)
                                        game_state.add_score(pieces_removed * 10)
                                        game_state.animating = True
                                    else:
                                        # Invalid move, swap back
                                        grid.swap_pieces(piece2, piece1)
                                        game_state.reset_combo()
                                    
                                    piece1.selected = False
                                    game_state.selected_tile = None
                                else:
                                    # Not adjacent, select new tile
                                    piece1.selected = False
                                    piece2.selected = True
                                    game_state.selected_tile = piece2
    
    # Update
    if not game_state.paused:
        grid.update()
        
        # Check for gravity and new matches
        if game_state.animating:
            if grid.apply_gravity():
                pass  # Still falling
            else:
                # Check for chain reactions
                matches = grid.find_matches()
                if matches:
                    pieces_removed = grid.remove_matches(matches)
                    game_state.add_score(pieces_removed * 15)  # Bonus for chains
                else:
                    game_state.animating = False
                    game_state.reset_combo()
                    
                    # Check for game over conditions
                    if not grid.has_valid_moves():
                        grid.shuffle()
        
        # Check time limit
        if game_state.get_time_remaining() <= 0:
            game_state.game_over = True
    
    # Draw
    screen.fill(BLACK)
    
    # Draw game info
    score_text = font_medium.render(f"Score: {game_state.score}", True, WHITE)
    screen.blit(score_text, (10, 10))
    
    moves_text = font_medium.render(f"Moves: {game_state.moves}", True, WHITE)
    screen.blit(moves_text, (10, 50))
    
    time_text = font_medium.render(f"Time: {game_state.get_time_remaining()}s", True, WHITE)
    screen.blit(time_text, (SCREEN_WIDTH - 150, 10))
    
    level_text = font_medium.render(f"Level: {game_state.level}", True, WHITE)
    screen.blit(level_text, (SCREEN_WIDTH - 150, 50))
    
    if game_state.combo_multiplier > 1:
        combo_text = font_small.render(f"Combo x{game_state.combo_multiplier:.1f}", True, YELLOW)
        screen.blit(combo_text, (SCREEN_WIDTH // 2 - 50, 10))
    
    # Draw power-ups
    power_up_y = 100
    for power_up, count in game_state.power_ups.items():
        text = font_small.render(f"{power_up}: {count}", True, WHITE)
        screen.blit(text, (SCREEN_WIDTH - 150, power_up_y))
        power_up_y += 25
    
    # Draw grid
    grid.draw(screen)
    
    # Draw game over or pause screen
    if game_state.game_over:
        overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
        overlay.set_alpha(128)
        overlay.fill(BLACK)
        screen.blit(overlay, (0, 0))
        
        game_over_text = font_large.render("GAME OVER", True, WHITE)
        screen.blit(game_over_text, (SCREEN_WIDTH // 2 - 120, SCREEN_HEIGHT // 2 - 50))
        
        final_score_text = font_medium.render(f"Final Score: {game_state.score}", True, WHITE)
        screen.blit(final_score_text, (SCREEN_WIDTH // 2 - 100, SCREEN_HEIGHT // 2 + 10))
    
    elif game_state.paused:
        pause_text = font_large.render("PAUSED", True, WHITE)
        screen.blit(pause_text, (SCREEN_WIDTH // 2 - 80, SCREEN_HEIGHT // 2 - 20))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

# Quit
pygame.quit()
sys.exit()
'''
        return code
    
    @staticmethod
    def _racing_template(components):
        """Racing game template"""
        # TODO: Implement racing-specific template
        return GameCompiler._default_template(components)
    
    @staticmethod
    def _rpg_template(components):
        """RPG game template with full RPG mechanics"""
        code = '''import pygame
import sys
import random
import math
import json

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60
TILE_SIZE = 32

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
GRAY = (128, 128, 128)
DARK_GRAY = (64, 64, 64)

# Set up the display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("RPG Adventure")

# Clock for controlling frame rate
clock = pygame.time.Clock()

# Fonts
font_small = pygame.font.Font(None, 24)
font_medium = pygame.font.Font(None, 36)
font_large = pygame.font.Font(None, 48)

# Character Classes
class CharacterClass:
    WARRIOR = "Warrior"
    MAGE = "Mage"
    ROGUE = "Rogue"
    HEALER = "Healer"

# Character Stats
class Character:
    def __init__(self, name="Hero", char_class=CharacterClass.WARRIOR):
        self.name = name
        self.char_class = char_class
        self.level = 1
        self.experience = 0
        self.exp_to_next_level = 100
        
        # Base stats based on class
        if char_class == CharacterClass.WARRIOR:
            self.max_hp = 150
            self.max_mp = 30
            self.strength = 15
            self.defense = 12
            self.magic = 5
            self.agility = 8
        elif char_class == CharacterClass.MAGE:
            self.max_hp = 80
            self.max_mp = 120
            self.strength = 6
            self.defense = 7
            self.magic = 18
            self.agility = 10
        elif char_class == CharacterClass.ROGUE:
            self.max_hp = 100
            self.max_mp = 50
            self.strength = 10
            self.defense = 8
            self.magic = 8
            self.agility = 16
        else:  # Healer
            self.max_hp = 90
            self.max_mp = 100
            self.strength = 7
            self.defense = 10
            self.magic = 15
            self.agility = 9
        
        self.hp = self.max_hp
        self.mp = self.max_mp
        self.gold = 50
        
        # Position
        self.x = SCREEN_WIDTH // 2
        self.y = SCREEN_HEIGHT // 2
        self.speed = 4
        
        # Combat stats
        self.in_combat = False
        self.defending = False
        
    def level_up(self):
        self.level += 1
        self.max_hp += 10
        self.max_mp += 5
        self.strength += 2
        self.defense += 2
        self.magic += 2
        self.agility += 1
        self.hp = self.max_hp
        self.mp = self.max_mp
        self.exp_to_next_level = self.level * 100
        
    def add_experience(self, exp):
        self.experience += exp
        while self.experience >= self.exp_to_next_level:
            self.experience -= self.exp_to_next_level
            self.level_up()
    
    def draw(self, screen):
        pygame.draw.rect(screen, GREEN, (self.x - 16, self.y - 16, 32, 32))
        # Draw class indicator
        text = font_small.render(self.char_class[0], True, WHITE)
        screen.blit(text, (self.x - 8, self.y - 8))

# Inventory System
class Item:
    def __init__(self, name, item_type, value=0, effect=None):
        self.name = name
        self.item_type = item_type  # "weapon", "armor", "consumable", "quest"
        self.value = value
        self.effect = effect
        self.quantity = 1

class Inventory:
    def __init__(self, max_slots=20):
        self.items = []
        self.max_slots = max_slots
        self.equipped_weapon = None
        self.equipped_armor = None
        
    def add_item(self, item):
        if len(self.items) < self.max_slots:
            # Check if item already exists and stack
            for inv_item in self.items:
                if inv_item.name == item.name and inv_item.item_type == "consumable":
                    inv_item.quantity += 1
                    return True
            self.items.append(item)
            return True
        return False
    
    def remove_item(self, item):
        if item in self.items:
            if item.quantity > 1:
                item.quantity -= 1
            else:
                self.items.remove(item)
            return True
        return False
    
    def use_item(self, item, character):
        if item.item_type == "consumable":
            if item.effect == "heal":
                character.hp = min(character.hp + item.value, character.max_hp)
            elif item.effect == "mana":
                character.mp = min(character.mp + item.value, character.max_mp)
            self.remove_item(item)
            return True
        return False

# Dialogue System
class DialogueSystem:
    def __init__(self):
        self.active = False
        self.current_dialogue = None
        self.current_index = 0
        self.npc_name = ""
        self.choices = []
        
    def start_dialogue(self, npc_name, dialogue_tree):
        self.active = True
        self.npc_name = npc_name
        self.current_dialogue = dialogue_tree
        self.current_index = 0
        
    def advance_dialogue(self):
        self.current_index += 1
        if self.current_index >= len(self.current_dialogue):
            self.end_dialogue()
    
    def end_dialogue(self):
        self.active = False
        self.current_dialogue = None
        self.current_index = 0
        
    def draw(self, screen):
        if self.active and self.current_dialogue:
            # Draw dialogue box
            pygame.draw.rect(screen, DARK_GRAY, (50, SCREEN_HEIGHT - 150, SCREEN_WIDTH - 100, 120))
            pygame.draw.rect(screen, WHITE, (50, SCREEN_HEIGHT - 150, SCREEN_WIDTH - 100, 120), 2)
            
            # Draw NPC name
            name_text = font_medium.render(self.npc_name, True, YELLOW)
            screen.blit(name_text, (60, SCREEN_HEIGHT - 140))
            
            # Draw dialogue text
            if self.current_index < len(self.current_dialogue):
                dialogue_text = self.current_dialogue[self.current_index]
                text_lines = dialogue_text.split('\\n')
                for i, line in enumerate(text_lines):
                    text = font_small.render(line, True, WHITE)
                    screen.blit(text, (60, SCREEN_HEIGHT - 100 + i * 25))

# Combat System
class Enemy:
    def __init__(self, name, hp, damage, exp_reward):
        self.name = name
        self.hp = hp
        self.max_hp = hp
        self.damage = damage
        self.exp_reward = exp_reward
        self.x = random.randint(100, SCREEN_WIDTH - 100)
        self.y = random.randint(100, SCREEN_HEIGHT - 200)
        
    def attack(self, character):
        damage = max(1, self.damage - character.defense // 2)
        if character.defending:
            damage = damage // 2
        character.hp -= damage
        return damage
    
    def draw(self, screen):
        pygame.draw.rect(screen, RED, (self.x - 16, self.y - 16, 32, 32))
        # Draw HP bar
        bar_width = 32
        bar_height = 4
        hp_percentage = self.hp / self.max_hp
        pygame.draw.rect(screen, RED, (self.x - 16, self.y - 24, bar_width, bar_height))
        pygame.draw.rect(screen, GREEN, (self.x - 16, self.y - 24, int(bar_width * hp_percentage), bar_height))

class CombatSystem:
    def __init__(self):
        self.active = False
        self.turn = "player"  # "player" or "enemy"
        self.enemy = None
        self.combat_log = []
        self.action_selected = None
        
    def start_combat(self, enemy):
        self.active = True
        self.enemy = enemy
        self.turn = "player"
        self.combat_log = [f"Battle with {enemy.name} begins!"]
        
    def player_action(self, action, character):
        if action == "attack":
            damage = max(1, character.strength - self.enemy.hp // 10)
            self.enemy.hp -= damage
            self.combat_log.append(f"You deal {damage} damage!")
            
        elif action == "magic" and character.mp >= 10:
            damage = character.magic * 2
            self.enemy.hp -= damage
            character.mp -= 10
            self.combat_log.append(f"Magic attack deals {damage} damage!")
            
        elif action == "defend":
            character.defending = True
            self.combat_log.append("You defend!")
            
        elif action == "flee":
            if random.random() < 0.5:
                self.end_combat(fled=True)
                return
            self.combat_log.append("Couldn't escape!")
        
        # Check if enemy defeated
        if self.enemy.hp <= 0:
            self.end_combat(victory=True, character=character)
        else:
            self.turn = "enemy"
            
    def enemy_turn(self, character):
        damage = self.enemy.attack(character)
        self.combat_log.append(f"{self.enemy.name} deals {damage} damage!")
        character.defending = False
        
        if character.hp <= 0:
            self.end_combat(defeat=True)
        else:
            self.turn = "player"
    
    def end_combat(self, victory=False, defeat=False, fled=False, character=None):
        if victory and character:
            self.combat_log.append(f"Victory! Gained {self.enemy.exp_reward} EXP!")
            character.add_experience(self.enemy.exp_reward)
            character.gold += random.randint(10, 50)
        elif defeat:
            self.combat_log.append("You were defeated...")
        elif fled:
            self.combat_log.append("You fled from battle!")
            
        self.active = False
        self.enemy = None
        
    def draw(self, screen):
        if self.active and self.enemy:
            # Draw combat UI
            pygame.draw.rect(screen, DARK_GRAY, (50, 50, 300, 200))
            pygame.draw.rect(screen, WHITE, (50, 50, 300, 200), 2)
            
            # Draw enemy name and HP
            enemy_text = font_medium.render(self.enemy.name, True, RED)
            screen.blit(enemy_text, (60, 60))
            hp_text = font_small.render(f"HP: {self.enemy.hp}/{self.enemy.max_hp}", True, WHITE)
            screen.blit(hp_text, (60, 95))
            
            # Draw action menu
            if self.turn == "player":
                actions = ["Attack", "Magic", "Defend", "Flee"]
                for i, action in enumerate(actions):
                    color = YELLOW if i == 0 else WHITE
                    action_text = font_small.render(f"{i+1}. {action}", True, color)
                    screen.blit(action_text, (60, 130 + i * 25))
            
            # Draw combat log (last 3 messages)
            for i, message in enumerate(self.combat_log[-3:]):
                log_text = font_small.render(message, True, WHITE)
                screen.blit(log_text, (400, 60 + i * 25))

# Quest System
class Quest:
    def __init__(self, name, description, objectives, reward_exp, reward_gold):
        self.name = name
        self.description = description
        self.objectives = objectives  # List of objectives
        self.completed_objectives = []
        self.is_complete = False
        self.reward_exp = reward_exp
        self.reward_gold = reward_gold
        
    def check_objective(self, objective):
        if objective in self.objectives and objective not in self.completed_objectives:
            self.completed_objectives.append(objective)
            if len(self.completed_objectives) == len(self.objectives):
                self.is_complete = True
            return True
        return False

class QuestLog:
    def __init__(self):
        self.active_quests = []
        self.completed_quests = []
        
    def add_quest(self, quest):
        self.active_quests.append(quest)
        
    def complete_quest(self, quest, character):
        if quest in self.active_quests and quest.is_complete:
            self.active_quests.remove(quest)
            self.completed_quests.append(quest)
            character.add_experience(quest.reward_exp)
            character.gold += quest.reward_gold
            return True
        return False
    
    def draw(self, screen):
        # Draw quest log UI
        pygame.draw.rect(screen, DARK_GRAY, (SCREEN_WIDTH - 250, 50, 200, 300))
        pygame.draw.rect(screen, WHITE, (SCREEN_WIDTH - 250, 50, 200, 300), 2)
        
        title_text = font_medium.render("Quest Log", True, YELLOW)
        screen.blit(title_text, (SCREEN_WIDTH - 240, 60))
        
        y_offset = 100
        for quest in self.active_quests:
            quest_text = font_small.render(quest.name, True, WHITE)
            screen.blit(quest_text, (SCREEN_WIDTH - 240, y_offset))
            
            # Show objectives
            for obj in quest.objectives:
                color = GREEN if obj in quest.completed_objectives else GRAY
                obj_text = font_small.render(f"  • {obj}", True, color)
                screen.blit(obj_text, (SCREEN_WIDTH - 240, y_offset + 20))
                y_offset += 25
            y_offset += 10

# NPC System
class NPC:
    def __init__(self, name, x, y, dialogue, quest=None):
        self.name = name
        self.x = x
        self.y = y
        self.dialogue = dialogue
        self.quest = quest
        self.interacted = False
        
    def interact(self, dialogue_system, quest_log):
        dialogue_system.start_dialogue(self.name, self.dialogue)
        if self.quest and not self.interacted:
            quest_log.add_quest(self.quest)
            self.interacted = True
    
    def draw(self, screen):
        pygame.draw.rect(screen, BLUE, (self.x - 16, self.y - 16, 32, 32))
        # Draw name
        name_text = font_small.render(self.name, True, WHITE)
        screen.blit(name_text, (self.x - 20, self.y - 40))

# Save/Load System
class SaveSystem:
    @staticmethod
    def save_game(character, inventory, quest_log, filename="savegame.json"):
        save_data = {
            "character": {
                "name": character.name,
                "class": character.char_class,
                "level": character.level,
                "experience": character.experience,
                "hp": character.hp,
                "mp": character.mp,
                "gold": character.gold,
                "x": character.x,
                "y": character.y
            },
            "inventory": {
                "items": [{"name": item.name, "type": item.item_type, "quantity": item.quantity} 
                         for item in inventory.items]
            },
            "quests": {
                "active": [quest.name for quest in quest_log.active_quests],
                "completed": [quest.name for quest in quest_log.completed_quests]
            }
        }
        
        try:
            with open(filename, 'w') as f:
                json.dump(save_data, f)
            return True
        except:
            return False
    
    @staticmethod
    def load_game(filename="savegame.json"):
        try:
            with open(filename, 'r') as f:
                save_data = json.load(f)
            return save_data
        except:
            return None

# Initialize game objects
character = Character("Hero", CharacterClass.WARRIOR)
inventory = Inventory()
dialogue_system = DialogueSystem()
combat_system = CombatSystem()
quest_log = QuestLog()

# Add starting items
inventory.add_item(Item("Health Potion", "consumable", 50, "heal"))
inventory.add_item(Item("Mana Potion", "consumable", 30, "mana"))
inventory.add_item(Item("Iron Sword", "weapon", 100))

# Create sample NPCs
npc1 = NPC("Village Elder", 200, 200, 
           ["Welcome, brave adventurer!",
            "Our village needs your help.",
            "Please defeat the monsters threatening us!"],
           Quest("Defeat Monsters", "Defeat 3 monsters", 
                 ["Defeat first monster", "Defeat second monster", "Defeat third monster"],
                 200, 100))

npcs = [npc1]

# Create sample enemies
enemies = []

# Game states
show_inventory = False
show_quest_log = False
show_character_stats = False

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
            
            # Combat controls
            elif combat_system.active and combat_system.turn == "player":
                if event.key == pygame.K_1:
                    combat_system.player_action("attack", character)
                elif event.key == pygame.K_2:
                    combat_system.player_action("magic", character)
                elif event.key == pygame.K_3:
                    combat_system.player_action("defend", character)
                elif event.key == pygame.K_4:
                    combat_system.player_action("flee", character)
            
            # Dialogue controls
            elif dialogue_system.active:
                if event.key == pygame.K_SPACE:
                    dialogue_system.advance_dialogue()
            
            # Game controls
            else:
                if event.key == pygame.K_i:
                    show_inventory = not show_inventory
                elif event.key == pygame.K_q:
                    show_quest_log = not show_quest_log
                elif event.key == pygame.K_c:
                    show_character_stats = not show_character_stats
                elif event.key == pygame.K_s:
                    if SaveSystem.save_game(character, inventory, quest_log):
                        print("Game saved!")
                elif event.key == pygame.K_l:
                    save_data = SaveSystem.load_game()
                    if save_data:
                        print("Game loaded!")
                elif event.key == pygame.K_SPACE:
                    # Interact with NPCs
                    for npc in npcs:
                        if abs(character.x - npc.x) < 50 and abs(character.y - npc.y) < 50:
                            npc.interact(dialogue_system, quest_log)
                elif event.key == pygame.K_b:
                    # Spawn enemy for testing
                    if not combat_system.active:
                        enemy = Enemy("Goblin", 50, 10, 50)
                        enemies.append(enemy)
                        combat_system.start_combat(enemy)
    
    # Update
    if not combat_system.active and not dialogue_system.active:
        # Player movement
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            character.x -= character.speed
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            character.x += character.speed
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            character.y -= character.speed
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            character.y += character.speed
        
        # Keep character on screen
        character.x = max(16, min(character.x, SCREEN_WIDTH - 16))
        character.y = max(16, min(character.y, SCREEN_HEIGHT - 16))
    
    # Enemy AI turn
    if combat_system.active and combat_system.turn == "enemy":
        combat_system.enemy_turn(character)
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw game world
    character.draw(screen)
    
    # Draw NPCs
    for npc in npcs:
        npc.draw(screen)
    
    # Draw enemies
    for enemy in enemies:
        if enemy != combat_system.enemy:
            enemy.draw(screen)
    
    # Draw UI elements
    # HP/MP bars
    pygame.draw.rect(screen, RED, (10, 10, 200, 20))
    pygame.draw.rect(screen, GREEN, (10, 10, int(200 * character.hp / character.max_hp), 20))
    hp_text = font_small.render(f"HP: {character.hp}/{character.max_hp}", True, WHITE)
    screen.blit(hp_text, (15, 12))
    
    pygame.draw.rect(screen, DARK_GRAY, (10, 35, 200, 20))
    pygame.draw.rect(screen, BLUE, (10, 35, int(200 * character.mp / character.max_mp), 20))
    mp_text = font_small.render(f"MP: {character.mp}/{character.max_mp}", True, WHITE)
    screen.blit(mp_text, (15, 37))
    
    # Level and gold
    level_text = font_small.render(f"Level: {character.level}  Gold: {character.gold}", True, YELLOW)
    screen.blit(level_text, (10, 60))
    
    # Draw dialogue
    dialogue_system.draw(screen)
    
    # Draw combat UI
    combat_system.draw(screen)
    
    # Draw inventory
    if show_inventory:
        pygame.draw.rect(screen, DARK_GRAY, (250, 100, 300, 400))
        pygame.draw.rect(screen, WHITE, (250, 100, 300, 400), 2)
        inv_title = font_medium.render("Inventory", True, YELLOW)
        screen.blit(inv_title, (260, 110))
        
        y_offset = 150
        for item in inventory.items:
            item_text = font_small.render(f"{item.name} x{item.quantity}", True, WHITE)
            screen.blit(item_text, (260, y_offset))
            y_offset += 25
    
    # Draw quest log
    if show_quest_log:
        quest_log.draw(screen)
    
    # Draw character stats
    if show_character_stats:
        pygame.draw.rect(screen, DARK_GRAY, (250, 100, 300, 300))
        pygame.draw.rect(screen, WHITE, (250, 100, 300, 300), 2)
        stats_title = font_medium.render("Character Stats", True, YELLOW)
        screen.blit(stats_title, (260, 110))
        
        stats = [
            f"Class: {character.char_class}",
            f"Level: {character.level}",
            f"EXP: {character.experience}/{character.exp_to_next_level}",
            f"STR: {character.strength}",
            f"DEF: {character.defense}",
            f"MAG: {character.magic}",
            f"AGI: {character.agility}"
        ]
        
        y_offset = 150
        for stat in stats:
            stat_text = font_small.render(stat, True, WHITE)
            screen.blit(stat_text, (260, y_offset))
            y_offset += 25
    
    # Draw controls hint
    controls_text = font_small.render("I: Inventory  Q: Quest Log  C: Stats  B: Battle  Space: Interact", True, GRAY)
    screen.blit(controls_text, (10, SCREEN_HEIGHT - 30))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

# Quit
pygame.quit()
sys.exit()
'''
        return code    @staticmethod
    def _space_template(components):
        """Space shooter game template"""
        code = '''import pygame
import sys
import random
import math
import time

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
CYAN = (0, 255, 255)
PURPLE = (255, 0, 255)
GRAY = (128, 128, 128)

# Set up the display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Space Adventure")

# Clock for controlling frame rate
clock = pygame.time.Clock()

# Fonts
font_small = pygame.font.Font(None, 24)
font_medium = pygame.font.Font(None, 36)
font_large = pygame.font.Font(None, 48)

# Game State
class GameState:
    def __init__(self):
        self.score = 0
        self.level = 1
        self.lives = 3
        self.game_over = False
        self.paused = False
        self.wave = 1
        self.enemies_spawned = 0
        self.enemies_per_wave = 5
        self.boss_active = False
        self.power_ups = []
        self.shield_active = False
        self.shield_timer = 0
        self.weapon_level = 1
        self.high_score = 0

# Player Ship
class PlayerShip(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.image = pygame.Surface((40, 50))
        self.image.fill(CYAN)
        self.rect = self.image.get_rect()
        self.rect.centerx = SCREEN_WIDTH // 2
        self.rect.bottom = SCREEN_HEIGHT - 20
        self.speed = 5
        self.health = 100
        self.max_health = 100
        self.shield = 50
        self.max_shield = 50
        self.weapon_type = "laser"
        self.fire_rate = 10
        self.last_shot = 0
        self.missiles = 20
        self.special_ready = True
        
    def update(self):
        # Get keyboard input
        keys = pygame.key.get_pressed()
        
        # Movement
        if keys[pygame.K_LEFT] and self.rect.left > 0:
            self.rect.x -= self.speed
        if keys[pygame.K_RIGHT] and self.rect.right < SCREEN_WIDTH:
            self.rect.x += self.speed
        if keys[pygame.K_UP] and self.rect.top > 0:
            self.rect.y -= self.speed
        if keys[pygame.K_DOWN] and self.rect.bottom < SCREEN_HEIGHT:
            self.rect.y += self.speed
            
        # Shield regeneration
        if self.shield < self.max_shield:
            self.shield += 0.1
            
    def shoot(self):
        current_time = pygame.time.get_ticks()
        if current_time - self.last_shot > 1000 / self.fire_rate:
            self.last_shot = current_time
            if self.weapon_type == "laser":
                return Projectile(self.rect.centerx, self.rect.top, "player_laser")
            elif self.weapon_type == "missile" and self.missiles > 0:
                self.missiles -= 1
                return Projectile(self.rect.centerx, self.rect.top, "player_missile")
        return None
        
    def take_damage(self, damage):
        if self.shield > 0:
            self.shield -= damage
            if self.shield < 0:
                self.health += self.shield
                self.shield = 0
        else:
            self.health -= damage
            
    def draw_health(self, screen):
        # Health bar
        pygame.draw.rect(screen, RED, (10, 10, 200, 20))
        pygame.draw.rect(screen, GREEN, (10, 10, 200 * (self.health / self.max_health), 20))
        
        # Shield bar
        if self.shield > 0:
            pygame.draw.rect(screen, GRAY, (10, 35, 200, 10))
            pygame.draw.rect(screen, CYAN, (10, 35, 200 * (self.shield / self.max_shield), 10))

# Projectile
class Projectile(pygame.sprite.Sprite):
    def __init__(self, x, y, projectile_type):
        super().__init__()
        self.type = projectile_type
        
        if "laser" in projectile_type:
            self.image = pygame.Surface((4, 15))
            self.image.fill(GREEN if "player" in projectile_type else RED)
            self.speed = 10 if "player" in projectile_type else 5
            self.damage = 10
        elif "missile" in projectile_type:
            self.image = pygame.Surface((8, 20))
            self.image.fill(YELLOW)
            self.speed = 7
            self.damage = 30
        else:
            self.image = pygame.Surface((6, 6))
            self.image.fill(WHITE)
            self.speed = 8
            self.damage = 5
            
        self.rect = self.image.get_rect()
        self.rect.centerx = x
        self.rect.centery = y
        self.direction = -1 if "player" in projectile_type else 1
        
    def update(self):
        self.rect.y += self.speed * self.direction
        
        # Remove if off screen
        if self.rect.bottom < 0 or self.rect.top > SCREEN_HEIGHT:
            self.kill()

# Enemy Ship
class EnemyShip(pygame.sprite.Sprite):
    def __init__(self, x, y, enemy_type="basic"):
        super().__init__()
        self.enemy_type = enemy_type
        
        if enemy_type == "basic":
            self.image = pygame.Surface((30, 30))
            self.image.fill(RED)
            self.health = 20
            self.speed = 2
            self.points = 100
            self.fire_rate = 1
        elif enemy_type == "fighter":
            self.image = pygame.Surface((35, 35))
            self.image.fill(PURPLE)
            self.health = 40
            self.speed = 3
            self.points = 200
            self.fire_rate = 2
        elif enemy_type == "bomber":
            self.image = pygame.Surface((45, 40))
            self.image.fill(YELLOW)
            self.health = 60
            self.speed = 1
            self.points = 300
            self.fire_rate = 0.5
        elif enemy_type == "boss":
            self.image = pygame.Surface((100, 80))
            self.image.fill(RED)
            self.health = 500
            self.max_health = 500
            self.speed = 1
            self.points = 5000
            self.fire_rate = 3
            
        self.rect = self.image.get_rect()
        self.rect.x = x
        self.rect.y = y
        self.direction = 1
        self.last_shot = 0
        self.pattern = random.choice(["straight", "zigzag", "sine"])
        self.pattern_offset = random.random() * math.pi * 2
        
    def update(self):
        # Movement patterns
        if self.pattern == "straight":
            self.rect.y += self.speed
        elif self.pattern == "zigzag":
            self.rect.x += self.direction * 2
            if self.rect.left <= 0 or self.rect.right >= SCREEN_WIDTH:
                self.direction *= -1
            self.rect.y += self.speed
        elif self.pattern == "sine":
            self.pattern_offset += 0.1
            self.rect.x += math.sin(self.pattern_offset) * 3
            self.rect.y += self.speed
            
        # Remove if off screen
        if self.rect.top > SCREEN_HEIGHT:
            self.kill()
            
    def shoot(self):
        current_time = pygame.time.get_ticks()
        if current_time - self.last_shot > 1000 / self.fire_rate:
            self.last_shot = current_time
            return Projectile(self.rect.centerx, self.rect.bottom, "enemy_laser")
        return None
        
    def take_damage(self, damage):
        self.health -= damage
        if self.health <= 0:
            self.kill()
            return True
        return False

# Main game loop
running = True
player = PlayerShip()
all_sprites = pygame.sprite.Group(player)
enemies = pygame.sprite.Group()
player_projectiles = pygame.sprite.Group()
enemy_projectiles = pygame.sprite.Group()
game_state = GameState()

# Spawn initial enemies
for i in range(5):
    enemy = EnemyShip(random.randint(50, SCREEN_WIDTH-50), random.randint(-200, -50), "basic")
    enemies.add(enemy)
    all_sprites.add(enemy)

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    if not game_state.game_over:
        # Player shooting
        keys = pygame.key.get_pressed()
        if keys[pygame.K_SPACE]:
            projectile = player.shoot()
            if projectile:
                player_projectiles.add(projectile)
                all_sprites.add(projectile)
        
        # Update all sprites
        all_sprites.update()
        
        # Enemy shooting
        for enemy in enemies:
            projectile = enemy.shoot()
            if projectile:
                enemy_projectiles.add(projectile)
                all_sprites.add(projectile)
        
        # Collision detection
        for projectile in player_projectiles:
            hits = pygame.sprite.spritecollide(projectile, enemies, False)
            for enemy in hits:
                if enemy.take_damage(projectile.damage):
                    game_state.score += enemy.points
                projectile.kill()
        
        hits = pygame.sprite.spritecollide(player, enemy_projectiles, True)
        for hit in hits:
            player.take_damage(10)
            
        if player.health <= 0:
            game_state.game_over = True
    
    # Draw everything
    screen.fill(BLACK)
    all_sprites.draw(screen)
    player.draw_health(screen)
    
    # Draw UI
    score_text = font_small.render(f"Score: {game_state.score}", True, WHITE)
    screen.blit(score_text, (SCREEN_WIDTH - 150, 10))
    
    if game_state.game_over:
        game_over_text = font_large.render("GAME OVER", True, RED)
        screen.blit(game_over_text, (SCREEN_WIDTH // 2 - 120, SCREEN_HEIGHT // 2))
    
    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
sys.exit()
'''
        return code
    
    @staticmethod
    def _dungeon_template(components):
        """Dungeon crawler game template"""
        # For now, use default template
        return GameCompiler._default_template(components)