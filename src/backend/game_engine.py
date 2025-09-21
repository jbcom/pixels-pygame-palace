"""
Secure game execution engine using subprocess execution
"""

import os
import sys
import tempfile
import threading
import queue
import time
import json
import base64
import uuid
import shutil
import subprocess
from io import BytesIO
from typing import Optional, Dict, Any, Union
from PIL import Image

from .security_config import (
    SANDBOX_LIMITS,
    CodeValidator
)


class GameExecutor:
    """Executes pygame code in a secure subprocess"""
    
    def __init__(self, session_id: str, timeout: Optional[int] = None):
        """
        Initialize the subprocess game executor
        
        Args:
            session_id: Unique session identifier
            timeout: Maximum execution time in seconds (default from config)
        """
        self.session_id = session_id
        self.process: Optional[subprocess.Popen] = None
        self.running = False
        self.frame_queue = queue.Queue(maxsize=10)
        self.temp_dir: Optional[str] = None
        self.timeout = timeout or SANDBOX_LIMITS['max_execution_time']
        self.start_time: Optional[float] = None
        self.cleanup_lock = threading.Lock()
        self.monitor_thread: Optional[threading.Thread] = None
        self.output_thread: Optional[threading.Thread] = None
    
    def execute(self, code: str) -> None:
        """
        Execute pygame code in a secure subprocess
        
        Args:
            code: Python code to execute
            
        Raises:
            ValueError: If code validation fails
            RuntimeError: If subprocess execution fails
        """
        # Validate code for security
        is_valid, error_msg = CodeValidator.validate_code(code)
        if not is_valid:
            raise ValueError(f"Code validation failed: {error_msg}")
        
        try:
            self.running = True
            self.start_time = time.time()
            
            # Create temporary directory for code
            self.temp_dir = tempfile.mkdtemp(prefix=f"game_{self.session_id}_")
            
            # Write the game code to a file
            game_file = os.path.join(self.temp_dir, "user_game.py")
            with open(game_file, 'w') as f:
                f.write(self._wrap_code_with_template(code))
            
            # Run subprocess with security constraints
            self._run_subprocess()
            
            # Start monitoring threads
            self._start_monitoring()
            
        except Exception as e:
            print(f"Error executing game: {e}")
            self.running = False
            self._cleanup()
            raise
    
    def _wrap_code_with_template(self, code: str) -> str:
        """Wrap user code with security template"""
        template = '''
import sys
import os
import json
import base64
import signal
import time
import pygame
from io import BytesIO
from PIL import Image

# Security: Set resource limits and timeout
MAX_EXECUTION_TIME = {timeout}
START_TIME = time.time()
FRAME_COUNT = 0
CAPTURE_INTERVAL = 2

def timeout_handler(signum, frame):
    """Handle timeout signal"""
    print("GAME_TIMEOUT: Execution time limit reached", file=sys.stderr)
    pygame.quit()
    sys.exit(1)

# Set up timeout handler (Unix/Linux only)
if hasattr(signal, 'SIGALRM'):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(MAX_EXECUTION_TIME)

def capture_frame(screen):
    """Capture and send frame data"""
    global FRAME_COUNT
    FRAME_COUNT += 1
    
    if FRAME_COUNT % CAPTURE_INTERVAL != 0:
        return
    
    try:
        # Convert pygame surface to PIL Image
        width, height = screen.get_size()
        pygame_str = pygame.image.tostring(screen, 'RGB')
        img = Image.frombytes('RGB', (width, height), pygame_str)
        
        # Resize if too large
        if width > 800 or height > 600:
            img.thumbnail((800, 600), Image.Resampling.LANCZOS)
        
        # Save as JPEG
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=75, optimize=True)
        img_data = buffer.getvalue()
        
        # Send frame data
        frame_data = {{
            'type': 'frame',
            'data': base64.b64encode(img_data).decode(),
            'frame': FRAME_COUNT,
            'timestamp': time.time() - START_TIME
        }}
        print(f"FRAME:{{json.dumps(frame_data)}}", flush=True)
        
    except Exception as e:
        print(f"CAPTURE_ERROR:{{str(e)}}", file=sys.stderr, flush=True)

# Initialize pygame
pygame.init()

# Monkey patch pygame display functions
_original_flip = pygame.display.flip
_original_update = pygame.display.update

def wrapped_flip():
    """Wrapped pygame.display.flip with frame capture"""
    try:
        # Try to find screen variable
        frame = sys._getframe(1)
        if 'screen' in frame.f_locals:
            capture_frame(frame.f_locals['screen'])
        elif 'screen' in frame.f_globals:
            capture_frame(frame.f_globals['screen'])
    except:
        pass
    _original_flip()

def wrapped_update(*args, **kwargs):
    """Wrapped pygame.display.update with frame capture"""
    try:
        # Try to find screen variable
        frame = sys._getframe(1)
        if 'screen' in frame.f_locals:
            capture_frame(frame.f_locals['screen'])
        elif 'screen' in frame.f_globals:
            capture_frame(frame.f_globals['screen'])
    except:
        pass
    _original_update(*args, **kwargs)

# Patch functions
pygame.display.flip = wrapped_flip
pygame.display.update = wrapped_update

try:
    # User game code starts here
    {user_code}
    
except KeyboardInterrupt:
    print("GAME_INTERRUPTED: User stopped execution", file=sys.stderr)
except Exception as e:
    print(f"GAME_ERROR:{{str(e)}}", file=sys.stderr)
finally:
    try:
        pygame.quit()
    except:
        pass
    print("GAME_FINISHED", file=sys.stderr)
'''.format(timeout=self.timeout, user_code=code)
        
        return template
    
    def _run_subprocess(self):
        """Run the game code in a subprocess with security constraints"""
        if not self.temp_dir:
            raise RuntimeError("Temporary directory not created")
        
        game_file = os.path.join(self.temp_dir, "user_game.py")
        
        # Set up subprocess environment
        env = os.environ.copy()
        env['SDL_VIDEODRIVER'] = 'dummy'  # No video output
        env['SDL_AUDIODRIVER'] = 'dummy'  # No audio output
        env['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
        env['PYTHONDONTWRITEBYTECODE'] = '1'
        env['PYTHONUNBUFFERED'] = '1'
        
        # Start subprocess
        try:
            self.process = subprocess.Popen(
                [sys.executable, game_file],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                cwd=self.temp_dir,
                preexec_fn=None,  # Don't set process group in Replit
                text=True,
                bufsize=1
            )
            print(f"✅ Started game subprocess for session {self.session_id}")
            
        except Exception as e:
            self.running = False
            raise RuntimeError(f"Failed to start subprocess: {e}")
    
    def _start_monitoring(self):
        """Start monitoring threads for the subprocess"""
        if not self.process:
            return
        
        # Start output monitoring thread
        self.output_thread = threading.Thread(
            target=self._monitor_output,
            daemon=True
        )
        self.output_thread.start()
        
        # Start timeout monitoring thread
        self.monitor_thread = threading.Thread(
            target=self._monitor_timeout,
            daemon=True
        )
        self.monitor_thread.start()
    
    def _monitor_output(self):
        """Monitor subprocess output for frames and errors"""
        if not self.process:
            return
        
        try:
            while self.running and self.process.poll() is None:
                # Read stdout
                if self.process.stdout:
                    line = self.process.stdout.readline()
                    if line:
                        self._process_output_line(line.strip())
                
                # Small delay to prevent busy waiting
                time.sleep(0.01)
                
        except Exception as e:
            print(f"Error monitoring output: {e}")
        finally:
            # Read any remaining output
            if self.process and self.process.stdout:
                for line in self.process.stdout:
                    self._process_output_line(line.strip())
    
    def _process_output_line(self, line: str):
        """Process a line of output from the subprocess"""
        if not line:
            return
        
        try:
            if line.startswith('FRAME:'):
                # Parse frame data
                frame_json = line[6:]  # Remove 'FRAME:' prefix
                frame_data = json.loads(frame_json)
                
                # Add to frame queue (non-blocking)
                try:
                    self.frame_queue.put_nowait(frame_data)
                except queue.Full:
                    # If queue is full, remove oldest frame and add new one
                    try:
                        self.frame_queue.get_nowait()
                        self.frame_queue.put_nowait(frame_data)
                    except queue.Empty:
                        pass
                        
            elif line.startswith('GAME_ERROR:'):
                error_msg = line[11:]  # Remove 'GAME_ERROR:' prefix
                print(f"🎮 Game error in session {self.session_id}: {error_msg}")
                
            elif line.startswith('GAME_TIMEOUT:'):
                print(f"⏰ Game timeout in session {self.session_id}")
                self.stop()
                
            elif line.startswith('GAME_FINISHED'):
                print(f"🏁 Game finished in session {self.session_id}")
                self.stop()
                
        except json.JSONDecodeError:
            # Ignore malformed JSON
            pass
        except Exception as e:
            print(f"Error processing output line: {e}")
    
    def _monitor_timeout(self):
        """Monitor for execution timeout"""
        try:
            while self.running and self.start_time:
                elapsed = time.time() - self.start_time
                if elapsed > self.timeout:
                    print(f"⏰ Session {self.session_id} timed out after {elapsed:.1f}s")
                    self.stop()
                    break
                time.sleep(1)
        except Exception as e:
            print(f"Error in timeout monitor: {e}")
    
    def get_frame(self) -> Optional[Dict[str, Any]]:
        """Get the latest frame from the game"""
        try:
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None
    
    def is_running(self) -> bool:
        """Check if the game is currently running"""
        if not self.running:
            return False
        
        if self.process:
            return self.process.poll() is None
        
        return False
    
    def stop(self):
        """Stop the game execution"""
        with self.cleanup_lock:
            if not self.running:
                return
            
            self.running = False
            print(f"🛑 Stopping game session {self.session_id}")
            
            # Terminate subprocess
            if self.process:
                try:
                    # Try graceful termination first
                    self.process.terminate()
                    
                    # Wait for termination with timeout
                    try:
                        self.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        # Force kill if graceful termination fails
                        self.process.kill()
                        self.process.wait()
                    
                    print(f"✅ Subprocess terminated for session {self.session_id}")
                except Exception as e:
                    print(f"❌ Error terminating subprocess: {e}")
                finally:
                    self.process = None
            
            # Clean up threads
            if self.monitor_thread and self.monitor_thread.is_alive():
                self.monitor_thread.join(timeout=2)
            
            if self.output_thread and self.output_thread.is_alive():
                self.output_thread.join(timeout=2)
            
            # Clean up temporary files
            self._cleanup()
    
    def _cleanup(self):
        """Clean up temporary resources"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
                print(f"🧹 Cleaned up temp directory for session {self.session_id}")
            except Exception as e:
                print(f"❌ Error cleaning temp directory: {e}")
            finally:
                self.temp_dir = None


class GameCompiler:
    """Compiles visual game components into Python pygame code"""
    
    @staticmethod
    def compile(components: list, game_type: str = 'platformer') -> str:
        """
        Compile visual components into executable Python code
        
        Args:
            components: List of visual game components
            game_type: Type of game ('platformer', 'shooter', etc.)
            
        Returns:
            Compiled Python pygame code
        """
        if game_type == 'platformer':
            return GameCompiler._compile_platformer(components)
        elif game_type == 'shooter':
            return GameCompiler._compile_shooter(components)
        elif game_type == 'racing':
            return GameCompiler._compile_racing(components)
        elif game_type == 'rpg':
            return GameCompiler._compile_rpg(components)
        else:
            return GameCompiler._compile_generic(components)
    
    @staticmethod
    def _compile_platformer(components: list) -> str:
        """Compile a basic platformer game"""
        return '''
import pygame
import sys

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 800, 600
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)

# Set up display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Platformer Game")
clock = pygame.time.Clock()

# Player
player_x = 100
player_y = 400
player_width = 30
player_height = 50
player_vel_y = 0
player_speed = 5
jump_strength = -15
gravity = 0.8
on_ground = False

# Platforms
platforms = [
    pygame.Rect(0, HEIGHT-20, WIDTH, 20),  # Ground
    pygame.Rect(200, 450, 200, 20),
    pygame.Rect(500, 350, 200, 20),
    pygame.Rect(300, 250, 200, 20),
]

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Handle input
    keys = pygame.key.get_pressed()
    if keys[pygame.K_LEFT]:
        player_x -= player_speed
    if keys[pygame.K_RIGHT]:
        player_x += player_speed
    if keys[pygame.K_SPACE] and on_ground:
        player_vel_y = jump_strength
        on_ground = False
    
    # Apply gravity
    player_vel_y += gravity
    player_y += player_vel_y
    
    # Create player rect
    player_rect = pygame.Rect(player_x, player_y, player_width, player_height)
    
    # Check platform collisions
    on_ground = False
    for platform in platforms:
        if player_rect.colliderect(platform):
            if player_vel_y > 0:  # Falling
                player_y = platform.top - player_height
                player_vel_y = 0
                on_ground = True
    
    # Keep player on screen
    player_x = max(0, min(WIDTH - player_width, player_x))
    
    # Reset if player falls off screen
    if player_y > HEIGHT:
        player_x = 100
        player_y = 400
        player_vel_y = 0
    
    # Draw everything
    screen.fill(BLACK)
    
    # Draw platforms
    for platform in platforms:
        pygame.draw.rect(screen, GREEN, platform)
    
    # Draw player
    pygame.draw.rect(screen, BLUE, (player_x, player_y, player_width, player_height))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _compile_shooter(components: list) -> str:
        """Compile a basic shooter game"""
        return '''
import pygame
import random
import sys

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 800, 600
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
YELLOW = (255, 255, 0)

# Set up display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Space Shooter")
clock = pygame.time.Clock()

# Player
ship_x = WIDTH // 2
ship_y = HEIGHT - 50
ship_size = 15
ship_speed = 7

# Game objects
bullets = []
asteroids = []
score = 0

# Speeds
bullet_speed = 10
asteroid_speed = 3

# Timers
spawn_timer = 0

# Font
font = pygame.font.Font(None, 36)

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_SPACE:
                bullets.append([ship_x, ship_y])
    
    # Handle input
    keys = pygame.key.get_pressed()
    if keys[pygame.K_LEFT]:
        ship_x -= ship_speed
    if keys[pygame.K_RIGHT]:
        ship_x += ship_speed
    
    # Keep ship on screen
    ship_x = max(ship_size, min(WIDTH - ship_size, ship_x))
    
    # Move bullets
    for bullet in bullets[:]:
        bullet[1] -= bullet_speed
        if bullet[1] < 0:
            bullets.remove(bullet)
    
    # Spawn asteroids
    spawn_timer += 1
    if spawn_timer > 30:
        spawn_timer = 0
        asteroid_x = random.randint(20, WIDTH - 20)
        asteroids.append([asteroid_x, -20])
    
    # Move asteroids
    for asteroid in asteroids[:]:
        asteroid[1] += asteroid_speed
        if asteroid[1] > HEIGHT:
            asteroids.remove(asteroid)
    
    # Check bullet-asteroid collisions
    for bullet in bullets[:]:
        for asteroid in asteroids[:]:
            if abs(bullet[0] - asteroid[0]) < 20 and abs(bullet[1] - asteroid[1]) < 20:
                if bullet in bullets:
                    bullets.remove(bullet)
                if asteroid in asteroids:
                    asteroids.remove(asteroid)
                    score += 10
    
    # Check ship-asteroid collisions
    for asteroid in asteroids:
        if abs(ship_x - asteroid[0]) < 30 and abs(ship_y - asteroid[1]) < 30:
            print(f"Game Over! Score: {score}")
            running = False
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw stars
    for _ in range(50):
        star_x = random.randint(0, WIDTH)
        star_y = random.randint(0, HEIGHT)
        pygame.draw.circle(screen, WHITE, (star_x, star_y), 1)
    
    # Draw ship
    points = [(ship_x, ship_y - ship_size),
              (ship_x - ship_size, ship_y + ship_size),
              (ship_x + ship_size, ship_y + ship_size)]
    pygame.draw.polygon(screen, WHITE, points)
    
    # Draw bullets
    for bullet in bullets:
        pygame.draw.circle(screen, YELLOW, (bullet[0], bullet[1]), 3)
    
    # Draw asteroids
    for asteroid in asteroids:
        pygame.draw.circle(screen, RED, (asteroid[0], asteroid[1]), 15)
    
    # Draw score
    score_text = font.render(f"Score: {score}", True, WHITE)
    screen.blit(score_text, (10, 10))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _compile_racing(components: list) -> str:
        """Compile a basic racing game"""
        return '''
import pygame
import random
import math
import sys

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 800, 600
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
GRAY = (128, 128, 128)
YELLOW = (255, 255, 0)

# Set up display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Racing Game")
clock = pygame.time.Clock()

# Player car
car_x = WIDTH // 2
car_y = HEIGHT - 100
car_width = 20
car_height = 40
car_speed = 0
max_speed = 8
acceleration = 0.3
friction = 0.1

# Road
road_width = 300
road_x = (WIDTH - road_width) // 2

# Other cars
other_cars = []
car_spawn_timer = 0

# Road lines
road_lines = []
for i in range(0, HEIGHT + 50, 50):
    road_lines.append(i)

line_speed = 5
score = 0

# Font
font = pygame.font.Font(None, 36)

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Handle input
    keys = pygame.key.get_pressed()
    if keys[pygame.K_UP]:
        car_speed = min(max_speed, car_speed + acceleration)
    elif keys[pygame.K_DOWN]:
        car_speed = max(-max_speed//2, car_speed - acceleration)
    else:
        car_speed *= (1 - friction)
    
    if keys[pygame.K_LEFT] and car_x > road_x + 10:
        car_x -= 4
    if keys[pygame.K_RIGHT] and car_x < road_x + road_width - car_width - 10:
        car_x += 4
    
    # Move road lines
    for i in range(len(road_lines)):
        road_lines[i] += line_speed
        if road_lines[i] > HEIGHT:
            road_lines[i] = -50
    
    # Spawn other cars
    car_spawn_timer += 1
    if car_spawn_timer > 90:
        car_spawn_timer = 0
        other_car_x = road_x + random.randint(20, road_width - 40)
        other_cars.append([other_car_x, -40])
    
    # Move other cars
    for other_car in other_cars[:]:
        other_car[1] += line_speed
        if other_car[1] > HEIGHT:
            other_cars.remove(other_car)
            score += 1
    
    # Check collisions
    car_rect = pygame.Rect(car_x, car_y, car_width, car_height)
    for other_car in other_cars:
        other_rect = pygame.Rect(other_car[0], other_car[1], car_width, car_height)
        if car_rect.colliderect(other_rect):
            print(f"Crash! Score: {score}")
            running = False
    
    # Clear screen
    screen.fill(GREEN)
    
    # Draw road
    pygame.draw.rect(screen, GRAY, (road_x, 0, road_width, HEIGHT))
    
    # Draw road lines
    for line_y in road_lines:
        pygame.draw.rect(screen, YELLOW, (WIDTH//2 - 2, line_y, 4, 30))
    
    # Draw road edges
    pygame.draw.rect(screen, WHITE, (road_x, 0, 5, HEIGHT))
    pygame.draw.rect(screen, WHITE, (road_x + road_width - 5, 0, 5, HEIGHT))
    
    # Draw player car
    pygame.draw.rect(screen, BLUE, (car_x, car_y, car_width, car_height))
    
    # Draw other cars
    for other_car in other_cars:
        pygame.draw.rect(screen, RED, (other_car[0], other_car[1], car_width, car_height))
    
    # Draw score
    score_text = font.render(f"Score: {score}", True, BLACK)
    screen.blit(score_text, (10, 10))
    
    # Draw speed
    speed_text = font.render(f"Speed: {int(car_speed * 10)}", True, BLACK)
    screen.blit(speed_text, (10, 50))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _compile_rpg(components: list) -> str:
        """Compile a basic RPG game"""
        return '''
import pygame
import random
import sys

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 800, 600
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
BROWN = (139, 69, 19)
YELLOW = (255, 255, 0)

# Set up display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("RPG Adventure")
clock = pygame.time.Clock()

# Player
player_x = WIDTH // 2
player_y = HEIGHT // 2
player_size = 20
player_speed = 4
player_hp = 100
player_max_hp = 100
player_level = 1
player_exp = 0
player_exp_to_next = 100

# Enemies
enemies = []
for _ in range(5):
    enemy_x = random.randint(player_size, WIDTH - player_size)
    enemy_y = random.randint(player_size, HEIGHT - player_size)
    enemies.append([enemy_x, enemy_y, 50])  # x, y, hp

# Items
items = []
for _ in range(10):
    item_x = random.randint(10, WIDTH - 10)
    item_y = random.randint(10, HEIGHT - 10)
    items.append([item_x, item_y])

# Font
font = pygame.font.Font(None, 24)

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_SPACE:
                # Attack nearby enemies
                for enemy in enemies[:]:
                    enemy_x, enemy_y, enemy_hp = enemy
                    distance = ((player_x - enemy_x) ** 2 + (player_y - enemy_y) ** 2) ** 0.5
                    if distance < 40:
                        enemy[2] -= 25  # Damage
                        if enemy[2] <= 0:
                            enemies.remove(enemy)
                            player_exp += 20
                            if player_exp >= player_exp_to_next:
                                player_level += 1
                                player_exp = 0
                                player_max_hp += 20
                                player_hp = player_max_hp
    
    # Handle movement
    keys = pygame.key.get_pressed()
    if keys[pygame.K_LEFT]:
        player_x -= player_speed
    if keys[pygame.K_RIGHT]:
        player_x += player_speed
    if keys[pygame.K_UP]:
        player_y -= player_speed
    if keys[pygame.K_DOWN]:
        player_y += player_speed
    
    # Keep player on screen
    player_x = max(player_size, min(WIDTH - player_size, player_x))
    player_y = max(player_size, min(HEIGHT - player_size, player_y))
    
    # Move enemies toward player
    for enemy in enemies:
        enemy_x, enemy_y, enemy_hp = enemy
        if enemy_x < player_x:
            enemy[0] += 1
        elif enemy_x > player_x:
            enemy[0] -= 1
        
        if enemy_y < player_y:
            enemy[1] += 1
        elif enemy_y > player_y:
            enemy[1] -= 1
        
        # Check collision with player
        distance = ((player_x - enemy[0]) ** 2 + (player_y - enemy[1]) ** 2) ** 0.5
        if distance < 25:
            player_hp -= 1
            if player_hp <= 0:
                print("Game Over!")
                running = False
    
    # Collect items
    for item in items[:]:
        item_x, item_y = item
        distance = ((player_x - item_x) ** 2 + (player_y - item_y) ** 2) ** 0.5
        if distance < 20:
            items.remove(item)
            player_hp = min(player_max_hp, player_hp + 10)
    
    # Spawn new enemies occasionally
    if len(enemies) < 3 and random.randint(1, 300) == 1:
        enemy_x = random.randint(player_size, WIDTH - player_size)
        enemy_y = random.randint(player_size, HEIGHT - player_size)
        enemies.append([enemy_x, enemy_y, 50])
    
    # Clear screen
    screen.fill(GREEN)
    
    # Draw items
    for item in items:
        pygame.draw.circle(screen, YELLOW, (item[0], item[1]), 8)
    
    # Draw enemies
    for enemy in enemies:
        enemy_x, enemy_y, enemy_hp = enemy
        pygame.draw.circle(screen, RED, (enemy_x, enemy_y), 15)
        # Health bar
        bar_width = 30
        bar_height = 4
        health_ratio = enemy_hp / 50
        pygame.draw.rect(screen, RED, (enemy_x - bar_width//2, enemy_y - 25, bar_width, bar_height))
        pygame.draw.rect(screen, GREEN, (enemy_x - bar_width//2, enemy_y - 25, bar_width * health_ratio, bar_height))
    
    # Draw player
    pygame.draw.circle(screen, BLUE, (player_x, player_y), player_size)
    
    # Draw UI
    hp_text = font.render(f"HP: {player_hp}/{player_max_hp}", True, WHITE)
    screen.blit(hp_text, (10, 10))
    
    level_text = font.render(f"Level: {player_level}", True, WHITE)
    screen.blit(level_text, (10, 35))
    
    exp_text = font.render(f"EXP: {player_exp}/{player_exp_to_next}", True, WHITE)
    screen.blit(exp_text, (10, 60))
    
    enemies_text = font.render(f"Enemies: {len(enemies)}", True, WHITE)
    screen.blit(enemies_text, (10, 85))
    
    items_text = font.render(f"Items: {len(items)}", True, WHITE)
    screen.blit(items_text, (10, 110))
    
    controls_text = font.render("Arrow keys: Move, Space: Attack", True, WHITE)
    screen.blit(controls_text, (10, HEIGHT - 25))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _compile_generic(components: list) -> str:
        """Compile a generic pygame template"""
        return '''
import pygame
import sys

# Initialize Pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 800, 600
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)

# Set up display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("My Game")
clock = pygame.time.Clock()

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw something
    pygame.draw.circle(screen, WHITE, (WIDTH//2, HEIGHT//2), 50)
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
sys.exit()
'''


# For backward compatibility, export the aliases that existing code expects
DockerGameExecutor = GameExecutor  # Alias for backward compatibility