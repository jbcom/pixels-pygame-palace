import os
import json
import uuid
import subprocess
import re
import ast
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import BadRequest
import tempfile
import base64
from io import BytesIO
from PIL import Image
import threading
import queue
import time
import atexit
import signal

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Security Configuration
MAX_CONCURRENT_SESSIONS = 10  # Limit concurrent game sessions
MAX_SESSION_TIME = 300  # 5 minutes max per session
MAX_CODE_SIZE = 100000  # 100KB max code size

# Configure CORS to allow requests from the React frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5000", "http://localhost:5173", "http://127.0.0.1:5000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Initialize SocketIO with specific CORS origins (not wildcard)
socketio = SocketIO(
    app, 
    cors_allowed_origins=["http://localhost:5000", "http://localhost:5173", "http://127.0.0.1:5000"],
    async_mode='threading'
)

# In-memory storage for projects (replace with database later)
projects_db = {}

# Game execution sessions with tracking
game_sessions = {}
session_start_times = {}  # Track session start times for timeouts

# Cleanup function for graceful shutdown
def cleanup_all_sessions():
    """Clean up all running game sessions on shutdown"""
    print("Cleaning up all game sessions...")
    for session_id in list(game_sessions.keys()):
        try:
            executor = game_sessions[session_id]
            executor.stop()
        except Exception as e:
            print(f"Error cleaning up session {session_id}: {e}")
    game_sessions.clear()
    session_start_times.clear()

# Register cleanup on exit
atexit.register(cleanup_all_sessions)
signal.signal(signal.SIGINT, lambda s, f: cleanup_all_sessions())
signal.signal(signal.SIGTERM, lambda s, f: cleanup_all_sessions())

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'pygame-backend'}), 200

@app.route('/api/compile', methods=['POST'])
@limiter.limit("10 per minute")
def compile_game():
    """Compile game from components into executable Python code"""
    try:
        data = request.json
        if not data:
            raise BadRequest("No data provided")
        
        components = data.get('components', [])
        game_type = data.get('gameType', 'platformer')
        
        # Generate Python code from components
        python_code = generate_python_code(components, game_type)
        
        return jsonify({
            'success': True,
            'code': python_code,
            'message': 'Game compiled successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/execute', methods=['POST'])
@limiter.limit("5 per minute")
def execute_game():
    """Execute Python game code with pygame"""
    try:
        data = request.json
        if not data or 'code' not in data:
            raise BadRequest("No code provided")
        
        code = data['code']
        
        # Security: Check code size
        if len(code) > MAX_CODE_SIZE:
            return jsonify({
                'success': False,
                'error': f'Code size exceeds limit ({MAX_CODE_SIZE} bytes)'
            }), 400
        
        # Security: Check concurrent sessions
        if len(game_sessions) >= MAX_CONCURRENT_SESSIONS:
            # Try to clean up old sessions first
            current_time = time.time()
            for sid in list(session_start_times.keys()):
                if current_time - session_start_times[sid] > MAX_SESSION_TIME:
                    if sid in game_sessions:
                        game_sessions[sid].stop()
                        del game_sessions[sid]
                        del session_start_times[sid]
            
            # Check again after cleanup
            if len(game_sessions) >= MAX_CONCURRENT_SESSIONS:
                return jsonify({
                    'success': False,
                    'error': 'Maximum concurrent sessions reached. Please try again later.'
                }), 429
        
        # Security: Validate and sanitize code
        validation_result = validate_user_code(code)
        if not validation_result['valid']:
            return jsonify({
                'success': False,
                'error': validation_result['error']
            }), 400
        
        session_id = str(uuid.uuid4())
        
        # Import the game engine module
        from game_engine import GameExecutor
        
        # Create a new game executor with timeout
        executor = GameExecutor(session_id, timeout=MAX_SESSION_TIME)
        game_sessions[session_id] = executor
        session_start_times[session_id] = time.time()
        
        # Start game execution in a separate thread
        def run_game():
            try:
                executor.execute(code)
            except Exception as e:
                print(f"Game execution error: {e}")
                socketio.emit('game_error', {'session_id': session_id, 'error': str(e)})
            finally:
                # Clean up after execution
                if session_id in game_sessions:
                    del game_sessions[session_id]
                if session_id in session_start_times:
                    del session_start_times[session_id]
        
        game_thread = threading.Thread(target=run_game)
        game_thread.daemon = True
        game_thread.start()
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Game execution started'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/game-stream/<session_id>', methods=['GET'])
def game_stream(session_id):
    """Stream game output using Server-Sent Events"""
    def generate():
        if session_id not in game_sessions:
            yield f"data: {json.dumps({'error': 'Invalid session'})}\n\n"
            return
        
        executor = game_sessions[session_id]
        
        while executor.is_running():
            frame = executor.get_frame()
            if frame:
                # Convert PIL image to base64 with JPEG for better performance
                buffered = BytesIO()
                frame.save(buffered, format="JPEG", quality=75, optimize=True)
                img_str = base64.b64encode(buffered.getvalue()).decode()
                
                yield f"data: {json.dumps({'type': 'frame', 'data': img_str})}\n\n"
            
            time.sleep(0.033)  # ~30 FPS
        
        yield f"data: {json.dumps({'type': 'end', 'message': 'Game ended'})}\n\n"
        
        # Clean up session
        if session_id in game_sessions:
            del game_sessions[session_id]
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/projects', methods=['POST'])
def save_project():
    """Save a game project"""
    try:
        data = request.json
        if not data or 'name' not in data:
            raise BadRequest("Project name required")
        
        project_id = str(uuid.uuid4())
        project = {
            'id': project_id,
            'name': data['name'],
            'description': data.get('description', ''),
            'gameType': data.get('gameType', 'platformer'),
            'components': data.get('components', []),
            'code': data.get('code', ''),
            'created_at': time.time(),
            'updated_at': time.time()
        }
        
        projects_db[project_id] = project
        
        return jsonify({
            'success': True,
            'project': project
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/projects', methods=['GET'])
def list_projects():
    """List all saved projects"""
    try:
        projects = list(projects_db.values())
        # Sort by updated_at descending
        projects.sort(key=lambda x: x['updated_at'], reverse=True)
        
        return jsonify({
            'success': True,
            'projects': projects
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get a specific project by ID"""
    try:
        if project_id not in projects_db:
            return jsonify({
                'success': False,
                'error': 'Project not found'
            }), 404
        
        return jsonify({
            'success': True,
            'project': projects_db[project_id]
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update an existing project"""
    try:
        if project_id not in projects_db:
            return jsonify({
                'success': False,
                'error': 'Project not found'
            }), 404
        
        data = request.json
        if not data:
            raise BadRequest("No update data provided")
        
        project = projects_db[project_id]
        
        # Update fields
        if 'name' in data:
            project['name'] = data['name']
        if 'description' in data:
            project['description'] = data['description']
        if 'gameType' in data:
            project['gameType'] = data['gameType']
        if 'components' in data:
            project['components'] = data['components']
        if 'code' in data:
            project['code'] = data['code']
        
        project['updated_at'] = time.time()
        
        return jsonify({
            'success': True,
            'project': project
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project"""
    try:
        if project_id not in projects_db:
            return jsonify({
                'success': False,
                'error': 'Project not found'
            }), 404
        
        del projects_db[project_id]
        
        return jsonify({
            'success': True,
            'message': 'Project deleted successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to game server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")

@socketio.on('game_input')
def handle_game_input(data):
    """Handle game input from client"""
    session_id = data.get('session_id')
    input_data = data.get('input')
    
    if session_id in game_sessions:
        executor = game_sessions[session_id]
        executor.send_input(input_data)
        emit('input_received', {'status': 'ok'})
    else:
        emit('input_error', {'error': 'Invalid session'})

@socketio.on('stop_game')
def handle_stop_game(data):
    """Stop a running game"""
    session_id = data.get('session_id')
    
    if session_id in game_sessions:
        executor = game_sessions[session_id]
        executor.stop()
        del game_sessions[session_id]
        emit('game_stopped', {'session_id': session_id})
    else:
        emit('stop_error', {'error': 'Invalid session'})

# Add new REST API endpoints for game control
@app.route('/api/stop/<session_id>', methods=['POST'])
@limiter.limit("20 per minute")
def stop_game_endpoint(session_id):
    """Stop a running game session"""
    try:
        if session_id not in game_sessions:
            return jsonify({
                'success': False,
                'error': 'Invalid session ID'
            }), 404
        
        executor = game_sessions[session_id]
        executor.stop()
        
        # Clean up session
        del game_sessions[session_id]
        if session_id in session_start_times:
            del session_start_times[session_id]
        
        return jsonify({
            'success': True,
            'message': 'Game stopped successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/game-input/<session_id>', methods=['POST'])
@limiter.limit("100 per minute")
def send_game_input(session_id):
    """Send input to a running game session"""
    try:
        if session_id not in game_sessions:
            return jsonify({
                'success': False,
                'error': 'Invalid session ID'
            }), 404
        
        data = request.json
        if not data or 'input' not in data:
            return jsonify({
                'success': False,
                'error': 'No input data provided'
            }), 400
        
        executor = game_sessions[session_id]
        executor.send_input(data['input'])
        
        return jsonify({
            'success': True,
            'message': 'Input sent successfully'
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sessions', methods=['GET'])
def list_active_sessions():
    """List all active game sessions"""
    try:
        current_time = time.time()
        sessions = []
        
        for session_id in game_sessions:
            start_time = session_start_times.get(session_id, current_time)
            executor = game_sessions[session_id]
            
            sessions.append({
                'session_id': session_id,
                'running_time': current_time - start_time,
                'is_running': executor.is_running(),
                'max_time': MAX_SESSION_TIME
            })
        
        return jsonify({
            'success': True,
            'sessions': sessions,
            'max_concurrent': MAX_CONCURRENT_SESSIONS,
            'current_count': len(sessions)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def validate_user_code(code):
    """Validate and sanitize user code for security"""
    # List of dangerous imports and functions
    dangerous_patterns = [
        r'\b__import__\b',
        r'\beval\b',
        r'\bexec\b',
        r'\bcompile\b',
        r'\bopen\b',
        r'\bfile\b',
        r'\binput\b',
        r'\braw_input\b',
        r'\bos\.',
        r'\bsubprocess\.',
        r'\bsocket\.',
        r'\burllib\.',
        r'\brequests\.',
        r'\b__builtins__\b',
        r'\bglobals\b',
        r'\blocals\b',
        r'\bvars\b',
        r'\bdir\b',
        r'\bgetattr\b',
        r'\bsetattr\b',
        r'\bdelattr\b',
        r'\bhasattr\b',
        r'\b__class__\b',
        r'\b__bases__\b',
        r'\b__subclasses__\b',
        r'\bimportlib\.',
        r'\bpkgutil\.',
        r'\bsys\.exit\b',
        r'\bexit\b',
        r'\bquit\b',
    ]
    
    # Check for dangerous patterns
    for pattern in dangerous_patterns:
        if re.search(pattern, code):
            return {
                'valid': False,
                'error': f'Dangerous code pattern detected: {pattern}'
            }
    
    # Try to parse the code as valid Python
    try:
        ast.parse(code)
    except SyntaxError as e:
        return {
            'valid': False,
            'error': f'Syntax error in code: {str(e)}'
        }
    
    # Check for valid pygame imports
    if 'import pygame' not in code and 'from pygame' not in code:
        return {
            'valid': False,
            'error': 'Code must import pygame to create a game'
        }
    
    return {'valid': True}

def generate_python_code(components, game_type):
    """Generate Python pygame code from visual components"""
    # Basic pygame template
    code = '''import pygame
import sys
import random

# Initialize Pygame
pygame.init()

# Set up the display
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Generated Game")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)

# Game clock
clock = pygame.time.Clock()
FPS = 60

# Game variables
running = True

# Main game loop
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
    
    # Draw components
'''
    
    # Add component-specific code
    for component in components:
        comp_type = component.get('type', '')
        props = component.get('props', {})
        
        if comp_type == 'sprite':
            x = props.get('x', 100)
            y = props.get('y', 100)
            color = props.get('color', 'RED')
            code += f'''    pygame.draw.rect(screen, {color}, ({x}, {y}, 50, 50))\n'''
        elif comp_type == 'text':
            text = props.get('text', 'Hello World')
            x = props.get('x', 100)
            y = props.get('y', 100)
            code += f'''    font = pygame.font.Font(None, 36)
    text_surface = font.render("{text}", True, WHITE)
    screen.blit(text_surface, ({x}, {y}))\n'''
    
    code += '''    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

# Quit
pygame.quit()
sys.exit()
'''
    
    return code

if __name__ == '__main__':
    # Run the Flask app with SocketIO
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)