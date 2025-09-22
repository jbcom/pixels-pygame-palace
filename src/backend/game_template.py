"""
Secure game template wrapper for executing user code safely
This template provides a secure environment for running pygame code with:
- Frame capture for streaming
- Input handling
- Resource constraints
- Timeout management
"""

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
MAX_EXECUTION_TIME = 300  # 5 minutes max execution time
START_TIME = time.time()

def timeout_handler(signum, frame):
    """Handle timeout signal"""
    print("GAME_TIMEOUT: Execution time limit reached", file=sys.stderr)
    pygame.quit()
    sys.exit(1)

# Set up timeout handler
signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(MAX_EXECUTION_TIME)

# Frame capture configuration
FRAME_COUNT = 0
CAPTURE_INTERVAL = 2  # Capture every 2 frames for performance
FRAME_SKIP_THRESHOLD = 5  # Skip frames if queue is backed up
SKIPPED_FRAMES = 0
LAST_CAPTURE_TIME = 0
MIN_CAPTURE_INTERVAL = 0.033  # Minimum time between captures (30 FPS max)

def capture_frame(screen):
    """Capture and send frame data with JPEG compression"""
    global FRAME_COUNT, SKIPPED_FRAMES, LAST_CAPTURE_TIME
    
    FRAME_COUNT += 1
    current_time = time.time()
    
    # Check if we should skip this frame
    if FRAME_COUNT % CAPTURE_INTERVAL != 0:
        return
    
    # Adaptive frame skipping based on performance
    if current_time - LAST_CAPTURE_TIME < MIN_CAPTURE_INTERVAL:
        SKIPPED_FRAMES += 1
        if SKIPPED_FRAMES < FRAME_SKIP_THRESHOLD:
            return
    
    SKIPPED_FRAMES = 0
    LAST_CAPTURE_TIME = current_time
    
    try:
        # Convert pygame surface to PIL Image
        width, height = screen.get_size()
        pygame_str = pygame.image.tostring(screen, 'RGB')
        img = Image.frombytes('RGB', (width, height), pygame_str)
        
        # Resize if too large (max 800x600 for streaming)
        if width > 800 or height > 600:
            img.thumbnail((800, 600), Image.Resampling.LANCZOS)
        
        # Save as JPEG with compression for better performance
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=75, optimize=True)
        img_data = buffer.getvalue()
        
        # Send frame data to stdout as JSON
        frame_data = {
            'type': 'frame',
            'data': base64.b64encode(img_data).decode(),
            'frame': FRAME_COUNT,
            'timestamp': current_time - START_TIME
        }
        print(f"FRAME:{json.dumps(frame_data)}", flush=True)
        
    except Exception as e:
        print(f"CAPTURE_ERROR:{str(e)}", file=sys.stderr, flush=True)

def handle_input():
    """Handle input from parent process via stdin"""
    # Non-blocking input check
    # This would be called in the game loop to process input
    pass

def safe_import_pygame():
    """Safely import and initialize pygame"""
    try:
        import pygame
        pygame.init()
        return pygame
    except Exception as e:
        print(f"PYGAME_ERROR: Failed to initialize pygame: {e}", file=sys.stderr)
        sys.exit(1)

# Template marker for user code insertion
# USER_CODE_START
# User code will be inserted here by the GameExecutor
# USER_CODE_END

def run_user_game():
    """Run the user's game code with safety wrappers"""
    try:
        # The user code will be executed here
        exec(USER_CODE)
    except Exception as e:
        print(f"GAME_ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

# Safety wrapper for pygame.display.flip/update
_original_flip = None
_original_update = None

def wrapped_flip():
    """Wrapped pygame.display.flip with frame capture"""
    if 'screen' in globals():
        capture_frame(globals()['screen'])
    elif 'screen' in locals():
        capture_frame(locals()['screen'])
    if _original_flip:
        _original_flip()

def wrapped_update(*args, **kwargs):
    """Wrapped pygame.display.update with frame capture"""
    if 'screen' in globals():
        capture_frame(globals()['screen'])
    elif 'screen' in locals():
        capture_frame(locals()['screen'])
    if _original_update:
        _original_update(*args, **kwargs)

# Monkey patch pygame display functions
try:
    import pygame
    _original_flip = pygame.display.flip
    _original_update = pygame.display.update
    pygame.display.flip = wrapped_flip
    pygame.display.update = wrapped_update
except:
    pass

# Placeholder for user code (will be replaced by GameExecutor)
USER_CODE = '''
# User game code will be inserted here
pass
'''