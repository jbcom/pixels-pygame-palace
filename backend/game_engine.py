"""
Secure game execution engine using Docker containerization
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
from io import BytesIO
from typing import Optional, Dict, Any, Union
from PIL import Image

# Docker imports with proper type handling
try:
    import docker
    from docker.errors import DockerException, ContainerError, ImageNotFound
    from docker.types import Mount
    from docker.models.containers import Container
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    # Define stub classes for type checking when Docker is not available
    docker = None  # type: ignore
    DockerException = Exception
    ContainerError = Exception 
    ImageNotFound = Exception
    Mount = None  # type: ignore
    Container = None  # type: ignore
    print("WARNING: Docker library not available. Install with: pip install docker")

from security_config import (
    DOCKER_CONFIG, 
    SANDBOX_LIMITS,
    CodeValidator
)


class DockerGameExecutor:
    """Executes pygame code in a secure Docker container"""
    
    # Class-level Docker client
    _docker_client = None
    
    @classmethod
    def get_docker_client(cls):
        """Get or create Docker client"""
        if not DOCKER_AVAILABLE:
            raise RuntimeError("Docker library not installed")
            
        if cls._docker_client is None:
            try:
                if docker is None:
                    raise RuntimeError("Docker library not available")
                cls._docker_client = docker.from_env()
                # Test connection
                cls._docker_client.ping()
            except DockerException as e:
                raise RuntimeError(f"Failed to connect to Docker daemon: {e}. Is Docker running?")
        return cls._docker_client
    
    def __init__(self, session_id: str, timeout: Optional[int] = None):
        """
        Initialize the Docker game executor
        
        Args:
            session_id: Unique session identifier
            timeout: Maximum execution time in seconds (default from config)
        """
        self.session_id = session_id
        self.container: Optional[Any] = None
        self.running = False
        self.frame_queue = queue.Queue(maxsize=10)
        self.temp_dir: Optional[str] = None
        self.timeout = timeout or DOCKER_CONFIG['timeout']
        self.start_time: Optional[float] = None
        self.cleanup_lock = threading.Lock()
        self.monitor_thread: Optional[threading.Thread] = None
        self.output_thread: Optional[threading.Thread] = None
        
        # Get Docker client
        try:
            self.client = self.get_docker_client()
        except RuntimeError as e:
            print(f"Docker initialization failed: {e}")
            raise
    
    def execute(self, code: str) -> None:
        """
        Execute pygame code in a secure Docker container
        
        Args:
            code: Python code to execute
            
        Raises:
            ValueError: If code validation fails
            RuntimeError: If container execution fails
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
            
            # Ensure Docker image is built
            self._ensure_image_built()
            
            # Run container with security constraints
            self._run_container()
            
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

pygame.display.flip = wrapped_flip
pygame.display.update = wrapped_update

# User code starts here
try:
    {code}
except Exception as e:
    print(f"GAME_ERROR: {{str(e)}}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
'''
        return template.format(timeout=self.timeout, code=code)
    
    def _ensure_image_built(self) -> None:
        """Ensure Docker image is built"""
        try:
            if not DOCKER_AVAILABLE:
                raise RuntimeError("Docker not available")
            self.client.images.get(DOCKER_CONFIG['image_name'])
        except ImageNotFound:
            print(f"Building Docker image {DOCKER_CONFIG['image_name']}...")
            self._build_docker_image()
    
    def _build_docker_image(self) -> None:
        """Build the Docker image if not present"""
        dockerfile_path = os.path.join(os.path.dirname(__file__), 'Dockerfile.game-executor')
        
        if not os.path.exists(dockerfile_path):
            raise FileNotFoundError(f"Dockerfile not found: {dockerfile_path}")
        
        try:
            # Build the image
            result = self.client.images.build(
                path=os.path.dirname(__file__),
                dockerfile='Dockerfile.game-executor',
                tag=DOCKER_CONFIG['image_name'],
                rm=True,
                forcerm=True
            )
            
            # Handle result as tuple (image, build_logs) or just image
            if isinstance(result, tuple):
                image, build_logs = result
            else:
                image = result
                build_logs = None
            
            if build_logs:
                try:
                    for log in build_logs:
                        if isinstance(log, dict) and 'stream' in log:
                            print(log['stream'].strip())
                except Exception as e:
                    print(f"Error processing build logs: {e}")
                    
            print(f"Successfully built Docker image: {DOCKER_CONFIG['image_name']}")
            
        except Exception as e:
            raise RuntimeError(f"Failed to build Docker image: {e}")
    
    def _run_container(self) -> None:
        """Run the game in a Docker container with security constraints"""
        try:
            # Container configuration
            container_config = {
                'image': DOCKER_CONFIG['image_name'],
                'command': [
                    'xvfb-run',
                    '-s', '-screen 0 800x600x24',
                    '-f', '/tmp/.Xauthority',  # Use auth file (secure, no -ac flag)
                    'python', '/tmp/game/user_game.py'
                ],
                'detach': True,
                'name': f'game_{self.session_id}',
                'network_mode': DOCKER_CONFIG['network_mode'],
                'read_only': DOCKER_CONFIG['read_only'],
                'mem_limit': DOCKER_CONFIG['memory_limit'],
                'memswap_limit': DOCKER_CONFIG['memory_limit'],  # Prevent swap usage
                'cpu_quota': int(DOCKER_CONFIG['cpu_quota'] * 100000),  # Convert to microseconds
                'cpu_period': 100000,
                'pids_limit': DOCKER_CONFIG['pids_limit'],
                'security_opt': DOCKER_CONFIG['security_opts'],
                'cap_drop': DOCKER_CONFIG['cap_drop'],
                'tmpfs': DOCKER_CONFIG['tmpfs'],
                'mounts': [
                    Mount(
                        target='/tmp/game',
                        source=self.temp_dir,
                        type='bind',
                        read_only=False  # Allow writing to temp directory only
                    ) if Mount is not None else None
                ] if Mount is not None else [],
                'environment': {
                    'PYTHONDONTWRITEBYTECODE': '1',
                    'PYTHONUNBUFFERED': '1',
                    'DISPLAY': ':99',
                    'SDL_VIDEODRIVER': 'x11',
                    'SDL_AUDIODRIVER': 'dummy',
                    'PYGAME_HIDE_SUPPORT_PROMPT': '1'
                },
                'user': 'gamerunner',  # Run as non-root user
                'working_dir': '/tmp/game',
                'auto_remove': False,  # Don't auto-remove, we'll clean up manually
                'remove': False,
                'stdin_open': False,
                'tty': False
            }
            
            # Create and start the container
            self.container = self.client.containers.run(**container_config)
            
            container_name = getattr(self.container, 'name', self.session_id)
            print(f"Started container {container_name} for session {self.session_id}")
            
        except ContainerError as e:
            raise RuntimeError(f"Container failed to start: {e}")
        except Exception as e:
            raise RuntimeError(f"Failed to run container: {e}")
    
    def _start_monitoring(self) -> None:
        """Start threads to monitor container output and timeout"""
        self.output_thread = threading.Thread(target=self._read_container_output)
        self.monitor_thread = threading.Thread(target=self._monitor_timeout)
        
        self.output_thread.daemon = True
        self.monitor_thread.daemon = True
        
        self.output_thread.start()
        self.monitor_thread.start()
    
    def _read_container_output(self) -> None:
        """Read output from the container"""
        if not self.container:
            return
        
        try:
            # Stream logs from container
            for log in self.container.logs(stream=True, follow=True):
                if not self.running:
                    break
                
                try:
                    line = log.decode('utf-8').strip()
                    
                    # Check if it's a frame capture
                    if line.startswith('FRAME:'):
                        frame_data = json.loads(line[6:])
                        img_data = base64.b64decode(frame_data['data'])
                        img = Image.open(BytesIO(img_data))
                        
                        # Add to frame queue
                        if not self.frame_queue.full():
                            self.frame_queue.put(img)
                    
                    elif line.startswith('GAME_ERROR:'):
                        print(f"Game error: {line[11:]}", file=sys.stderr)
                    
                    elif line.startswith('CAPTURE_ERROR:'):
                        print(f"Capture error: {line[14:]}", file=sys.stderr)
                    
                    elif line.startswith('GAME_TIMEOUT:'):
                        print(f"Game timeout: {line}", file=sys.stderr)
                        self.stop()
                    
                    elif line:
                        print(f"Game output: {line}")
                        
                except Exception as e:
                    print(f"Error processing output: {e}")
                    
        except Exception as e:
            print(f"Error reading container output: {e}")
    
    def _monitor_timeout(self) -> None:
        """Monitor container execution time and kill if timeout exceeded"""
        while self.running and self.container:
            try:
                # Reload container state
                self.container.reload()
                
                # Check if container is still running
                if self.container.status != 'running':
                    print(f"Container {self.session_id} stopped with status: {self.container.status}")
                    self.running = False
                    break
                
                # Check timeout
                if self.start_time is not None:
                    elapsed = time.time() - self.start_time
                    if elapsed > self.timeout:
                        print(f"Container {self.session_id} exceeded timeout of {self.timeout}s")
                        self.stop()
                        break
                
                time.sleep(1)
                
            except Exception as e:
                print(f"Error monitoring container: {e}")
                break
    
    def get_frame(self) -> Optional[Image.Image]:
        """Get the next frame from the queue"""
        try:
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None
    
    def send_input(self, input_data: Dict[str, Any]) -> None:
        """Send input to the game container (not implemented for Docker)"""
        # Input handling would require a more complex setup with stdin piping
        # For now, games will need to be self-contained
        print(f"Input sending not supported in Docker mode: {input_data}")
    
    def stop(self) -> None:
        """Stop the game execution and clean up"""
        with self.cleanup_lock:
            if not self.running:
                return
            
            self.running = False
            self._cleanup()
    
    def _cleanup(self) -> None:
        """Clean up container and temporary files"""
        print(f"Cleaning up session {self.session_id}...")
        
        # Stop and remove container
        if self.container:
            try:
                self.container.stop(timeout=5)
                self.container.remove(force=True)
                print(f"Container {self.session_id} stopped and removed")
            except Exception as e:
                print(f"Error stopping container: {e}")
                try:
                    # Force remove if stop failed
                    self.container.remove(force=True)
                except:
                    pass
        
        # Clean up temporary directory
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
                print(f"Cleaned up temp directory: {self.temp_dir}")
            except Exception as e:
                print(f"Error cleaning temp directory: {e}")
    
    def is_running(self) -> bool:
        """Check if the game is still running"""
        return self.running


# Fallback to original subprocess executor when Docker is not available
import subprocess
import signal
import psutil
import resource


class GameExecutor:
    """Original subprocess-based executor - fallback when Docker not available"""
    
    def __init__(self, session_id, timeout=300):
        self.session_id = session_id
        self.process = None
        self.running = False
        self.frame_queue = queue.Queue(maxsize=10)
        self.input_queue = queue.Queue()
        self.temp_dir = None
        self.xvfb_process = None
        self.display_num = None
        self.timeout = timeout
        self.start_time = None
        self.cleanup_lock = threading.Lock()
        self.xvfb_cleanup_done = False
        
        # Try to use Docker if explicitly requested and available
        use_docker = os.environ.get('USE_DOCKER', 'false').lower() == 'true'
        
        if use_docker and DOCKER_AVAILABLE:
            try:
                # Try to create Docker executor
                self._docker_executor = DockerGameExecutor(session_id, timeout)
                self._use_docker = True
                print(f"Using Docker executor for session {session_id}")
                return
            except Exception as e:
                print(f"Failed to initialize Docker executor: {e}")
                print("Falling back to subprocess executor")
                self._use_docker = False
        else:
            self._use_docker = False
            
        # Use subprocess executor (default and works on Replit)
        print(f"Using subprocess executor for session {session_id}")
    
    def execute(self, code):
        """Execute pygame code"""
        # If using Docker, delegate to Docker executor
        if hasattr(self, '_use_docker') and self._use_docker:
            return self._docker_executor.execute(code)
        
        # Otherwise, validate code and use subprocess (less secure)
        is_valid, error_msg = CodeValidator.validate_code(code)
        if not is_valid:
            raise ValueError(f"Code validation failed: {error_msg}")
        
        # Original subprocess implementation (kept for compatibility)
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
                # Start Xvfb (virtual display) with proper authentication
                self.display_num = self._find_free_display()
                try:
                    # Create auth file for Xvfb (secure)
                    auth_file = os.path.join(self.temp_dir, '.Xauthority')
                    
                    self.xvfb_process = subprocess.Popen([
                        'Xvfb',
                        f':{self.display_num}',
                        '-screen', '0', '800x600x24',
                        '-auth', auth_file,  # Use auth file instead of -ac
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
                env['XAUTHORITY'] = auth_file
            else:
                # Use existing display
                env = os.environ.copy()
                env['SDL_VIDEODRIVER'] = 'x11'
            
            # Disable SDL audio to avoid issues
            env['SDL_AUDIODRIVER'] = 'dummy'
            
            # Set resource limits for security
            env['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
            
            # Run the game with resource limits
            self.process = subprocess.Popen(
                [sys.executable, '-u', game_file],
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
        
        # Memory limit (soft, hard) in bytes - 256MB to match Docker
        max_memory = 256 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (max_memory, max_memory))
        
        # Limit number of processes to match Docker
        resource.setrlimit(resource.RLIMIT_NPROC, (50, 50))
        
        # Limit number of open files
        resource.setrlimit(resource.RLIMIT_NOFILE, (50, 50))
    
    def _monitor_timeout(self):
        """Monitor process execution time and kill if timeout exceeded"""
        while self.running and self.process:
            if self.process.poll() is not None:
                break
            
            if self.start_time is not None:
                elapsed = time.time() - self.start_time
                if elapsed > self.timeout:
                    print(f"Game {self.session_id} exceeded timeout of {self.timeout}s")
                    self.stop()
                    break
            
            time.sleep(1)
    
    def _find_free_display(self):
        """Find a free X display number"""
        for display_num in range(99, 200):
            if not os.path.exists(f'/tmp/.X{display_num}-lock'):
                return display_num
        return 99
    
    def _read_stdout(self):
        """Read stdout from the game process"""
        if not self.process or not self.process.stdout:
            return
        
        try:
            for line in iter(self.process.stdout.readline, b''):
                if not self.running:
                    break
                
                line = line.decode('utf-8').strip()
                
                # Check if it's a frame capture
                if line.startswith('FRAME:'):
                    try:
                        frame_data = json.loads(line[6:])
                        img_data = base64.b64decode(frame_data['data'])
                        img = Image.open(BytesIO(img_data))
                        
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
        if not self.process or not self.process.stderr:
            return
        
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
        if hasattr(self, '_use_docker') and self._use_docker:
            return self._docker_executor.send_input(input_data)
        
        if self.process and self.process.poll() is None and self.process.stdin:
            try:
                input_json = json.dumps(input_data) + '\n'
                self.process.stdin.write(input_json.encode())
                self.process.stdin.flush()
            except Exception as e:
                print(f"Error sending input: {e}")
    
    def get_frame(self):
        """Get the latest frame from the queue"""
        if hasattr(self, '_use_docker') and self._use_docker:
            return self._docker_executor.get_frame()
        
        try:
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None
    
    def stop(self):
        """Stop the game execution with proper cleanup"""
        if hasattr(self, '_use_docker') and self._use_docker:
            return self._docker_executor.stop()
        
        with self.cleanup_lock:
            if not self.running:
                return
            
            self.running = False
            
            # Stop the process
            if self.process:
                try:
                    self.process.terminate()
                    self.process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    try:
                        self.process.kill()
                        self.process.wait(timeout=1)
                    except:
                        try:
                            p = psutil.Process(self.process.pid)
                            p.kill()
                        except:
                            pass
                except Exception as e:
                    print(f"Error stopping process: {e}")
            
            self._cleanup()
    
    def _cleanup(self):
        """Clean up resources with proper error handling"""
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
        if hasattr(self, '_use_docker') and self._use_docker:
            return self._docker_executor.is_running()
        
        if self.process:
            return self.process.poll() is None
        return False


# Game compiler for generating code templates
class GameCompiler:
    """Compiles visual components into executable Python code"""
    
    @staticmethod
    def compile(components: list, game_type: str) -> str:
        """Generate Python pygame code from components"""
        if game_type == 'platformer':
            return GameCompiler._generate_platformer_template()
        elif game_type == 'puzzle':
            return GameCompiler._generate_puzzle_template()
        elif game_type == 'racing':
            return GameCompiler._generate_racing_template()
        elif game_type == 'rpg':
            return GameCompiler._generate_rpg_template()
        elif game_type == 'space':
            return GameCompiler._generate_space_template()
        else:
            return GameCompiler._generate_basic_template()
    
    @staticmethod
    def _generate_basic_template() -> str:
        """Generate basic pygame template"""
        return '''
import pygame
import sys

# Initialize Pygame
pygame.init()

# Set up the display
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("My Game")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)

# Game clock
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
    pygame.draw.circle(screen, RED, (WIDTH // 2, HEIGHT // 2), 50)
    
    # Update display
    pygame.display.flip()
    
    # Control frame rate
    clock.tick(60)

# Quit
pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _generate_platformer_template() -> str:
        """Generate platformer game template"""
        return '''
import pygame
import sys

# Initialize Pygame
pygame.init()

# Set up the display
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Platformer Game")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
BLUE = (0, 100, 255)
GREEN = (0, 255, 0)

# Player settings
player_x = WIDTH // 2
player_y = HEIGHT - 100
player_width = 40
player_height = 60
player_vel_y = 0
player_speed = 5
gravity = 0.8
jump_power = -15

# Ground
ground_y = HEIGHT - 40

# Game clock
clock = pygame.time.Clock()

# Game loop
running = True
on_ground = False

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_SPACE and on_ground:
                player_vel_y = jump_power
    
    # Get keys
    keys = pygame.key.get_pressed()
    
    # Move player
    if keys[pygame.K_LEFT]:
        player_x -= player_speed
    if keys[pygame.K_RIGHT]:
        player_x += player_speed
    
    # Apply gravity
    player_vel_y += gravity
    player_y += player_vel_y
    
    # Ground collision
    if player_y + player_height >= ground_y:
        player_y = ground_y - player_height
        player_vel_y = 0
        on_ground = True
    else:
        on_ground = False
    
    # Keep player on screen
    player_x = max(0, min(WIDTH - player_width, player_x))
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw ground
    pygame.draw.rect(screen, GREEN, (0, ground_y, WIDTH, HEIGHT - ground_y))
    
    # Draw player
    pygame.draw.rect(screen, BLUE, (player_x, player_y, player_width, player_height))
    
    # Update display
    pygame.display.flip()
    
    # Control frame rate
    clock.tick(60)

# Quit
pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _generate_puzzle_template() -> str:
        """Generate puzzle game template"""
        return '''
import pygame
import sys
import random

# Initialize Pygame
pygame.init()

# Set up the display
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Puzzle Game")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
COLORS = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255)]

# Grid settings
GRID_SIZE = 10
CELL_SIZE = 40
grid_x = (WIDTH - GRID_SIZE * CELL_SIZE) // 2
grid_y = (HEIGHT - GRID_SIZE * CELL_SIZE) // 2

# Create grid
grid = [[random.choice(COLORS) for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]

# Game clock
clock = pygame.time.Clock()

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.MOUSEBUTTONDOWN:
            # Get grid position from mouse
            mouse_x, mouse_y = pygame.mouse.get_pos()
            col = (mouse_x - grid_x) // CELL_SIZE
            row = (mouse_y - grid_y) // CELL_SIZE
            
            if 0 <= row < GRID_SIZE and 0 <= col < GRID_SIZE:
                # Change color of clicked cell
                grid[row][col] = random.choice(COLORS)
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw grid
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            x = grid_x + col * CELL_SIZE
            y = grid_y + row * CELL_SIZE
            pygame.draw.rect(screen, grid[row][col], (x, y, CELL_SIZE - 2, CELL_SIZE - 2))
    
    # Update display
    pygame.display.flip()
    
    # Control frame rate
    clock.tick(60)

# Quit
pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _generate_racing_template() -> str:
        """Generate racing game template"""
        return '''
import pygame
import sys
import random

# Initialize Pygame
pygame.init()

# Set up the display
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Racing Game")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GRAY = (128, 128, 128)
YELLOW = (255, 255, 0)

# Player car
car_x = WIDTH // 2
car_y = HEIGHT - 100
car_width = 40
car_height = 60
car_speed = 8

# Road
road_x = WIDTH // 4
road_width = WIDTH // 2

# Obstacles
obstacles = []
obstacle_speed = 5
spawn_timer = 0

# Game clock
clock = pygame.time.Clock()

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Get keys
    keys = pygame.key.get_pressed()
    
    # Move car
    if keys[pygame.K_LEFT]:
        car_x -= car_speed
    if keys[pygame.K_RIGHT]:
        car_x += car_speed
    
    # Keep car on road
    car_x = max(road_x, min(road_x + road_width - car_width, car_x))
    
    # Spawn obstacles
    spawn_timer += 1
    if spawn_timer > 60:
        spawn_timer = 0
        obstacle_x = random.randint(road_x, road_x + road_width - 40)
        obstacles.append([obstacle_x, -60])
    
    # Move obstacles
    for obstacle in obstacles[:]:
        obstacle[1] += obstacle_speed
        if obstacle[1] > HEIGHT:
            obstacles.remove(obstacle)
    
    # Check collisions
    for obstacle in obstacles:
        if (car_x < obstacle[0] + 40 and car_x + car_width > obstacle[0] and
            car_y < obstacle[1] + 60 and car_y + car_height > obstacle[1]):
            print("Game Over!")
            running = False
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw road
    pygame.draw.rect(screen, GRAY, (road_x, 0, road_width, HEIGHT))
    
    # Draw center line
    for y in range(0, HEIGHT, 40):
        pygame.draw.rect(screen, YELLOW, (WIDTH // 2 - 5, y, 10, 20))
    
    # Draw car
    pygame.draw.rect(screen, RED, (car_x, car_y, car_width, car_height))
    
    # Draw obstacles
    for obstacle in obstacles:
        pygame.draw.rect(screen, WHITE, (obstacle[0], obstacle[1], 40, 60))
    
    # Update display
    pygame.display.flip()
    
    # Control frame rate
    clock.tick(60)

# Quit
pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _generate_rpg_template() -> str:
        """Generate RPG game template"""
        return '''
import pygame
import sys
import random

# Initialize Pygame
pygame.init()

# Set up the display
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("RPG Adventure")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
RED = (255, 0, 0)
BROWN = (139, 69, 19)

# Player
player_x = WIDTH // 2
player_y = HEIGHT // 2
player_size = 30
player_speed = 4
player_health = 100

# Enemies
enemies = []
for _ in range(5):
    enemy_x = random.randint(50, WIDTH - 50)
    enemy_y = random.randint(50, HEIGHT - 50)
    enemies.append([enemy_x, enemy_y, 50])  # x, y, health

# Items
items = []
for _ in range(3):
    item_x = random.randint(50, WIDTH - 50)
    item_y = random.randint(50, HEIGHT - 50)
    items.append([item_x, item_y])

# Game clock
clock = pygame.time.Clock()

# Font for text
font = pygame.font.Font(None, 36)

# Game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Get keys
    keys = pygame.key.get_pressed()
    
    # Move player
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
    
    # Check item collection
    for item in items[:]:
        if abs(player_x - item[0]) < 30 and abs(player_y - item[1]) < 30:
            items.remove(item)
            player_health = min(100, player_health + 20)
    
    # Move enemies toward player
    for enemy in enemies:
        if enemy[0] < player_x:
            enemy[0] += 1
        elif enemy[0] > player_x:
            enemy[0] -= 1
        if enemy[1] < player_y:
            enemy[1] += 1
        elif enemy[1] > player_y:
            enemy[1] -= 1
    
    # Check enemy collision
    for enemy in enemies:
        if abs(player_x - enemy[0]) < 30 and abs(player_y - enemy[1]) < 30:
            player_health -= 1
    
    # Clear screen
    screen.fill(BROWN)
    
    # Draw items
    for item in items:
        pygame.draw.circle(screen, GREEN, (item[0], item[1]), 15)
    
    # Draw enemies
    for enemy in enemies:
        if enemy[2] > 0:
            pygame.draw.circle(screen, RED, (enemy[0], enemy[1]), 20)
    
    # Draw player
    pygame.draw.circle(screen, BLUE, (player_x, player_y), player_size)
    
    # Draw health
    health_text = font.render(f"Health: {player_health}", True, WHITE)
    screen.blit(health_text, (10, 10))
    
    # Check game over
    if player_health <= 0:
        game_over_text = font.render("GAME OVER", True, WHITE)
        screen.blit(game_over_text, (WIDTH // 2 - 100, HEIGHT // 2))
    
    # Update display
    pygame.display.flip()
    
    # Control frame rate
    clock.tick(60)

# Quit
pygame.quit()
sys.exit()
'''
    
    @staticmethod
    def _generate_space_template() -> str:
        """Generate space shooter game template"""
        return '''
import pygame
import sys
import random
import math

# Initialize Pygame
pygame.init()

# Set up the display
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Space Shooter")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
YELLOW = (255, 255, 0)
RED = (255, 0, 0)

# Player ship
ship_x = WIDTH // 2
ship_y = HEIGHT - 50
ship_size = 30
ship_speed = 6

# Bullets
bullets = []
bullet_speed = 10

# Asteroids
asteroids = []
asteroid_speed = 3
spawn_timer = 0

# Score
score = 0

# Game clock
clock = pygame.time.Clock()

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
    
    # Get keys
    keys = pygame.key.get_pressed()
    
    # Move ship
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
    
    # Control frame rate
    clock.tick(60)

# Quit
pygame.quit()
sys.exit()
'''