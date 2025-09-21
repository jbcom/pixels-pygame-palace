import os
import json
import uuid
import secrets
from typing import Any, Optional
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
from datetime import timedelta, datetime
import jwt
from functools import wraps

# Type extension for Flask Request with custom attributes
from flask import Request

# Monkey patch the Request class to add custom attributes
def extend_request():
    """Add custom attributes to Flask Request class"""
    # Add as class attributes with proper typing
    setattr(Request, 'user', None)
    setattr(Request, 'session_id', None)
    setattr(Request, 'sid', None)

# Apply extensions
extend_request()

# Initialize Flask app with secure configuration
app = Flask(__name__)

# Load configuration
from config import SERVICE_CONFIG

# Security: Generate secure SECRET_KEY
if os.environ.get('FLASK_ENV') == 'production':
    # In production, require SECRET_KEY from environment
    if not os.environ.get('FLASK_SECRET_KEY'):
        raise RuntimeError("FLASK_SECRET_KEY environment variable is required in production")
    app.config['SECRET_KEY'] = os.environ['FLASK_SECRET_KEY']
else:
    # In development, generate a random secret key
    app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

# Session security settings
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'  # HTTPS only in production
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent XSS attacks
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # CSRF protection
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)  # Session timeout

# Load configuration from shared config
MAX_CONCURRENT_SESSIONS = SERVICE_CONFIG['GAME']['MAX_CONCURRENT_SESSIONS']
MAX_SESSION_TIME = SERVICE_CONFIG['GAME']['MAX_SESSION_TIME']
MAX_CODE_SIZE = SERVICE_CONFIG['GAME']['MAX_CODE_SIZE']

# Configure CORS using shared configuration
CORS(app, resources={
    r"/api/*": {
        "origins": SERVICE_CONFIG['ALLOWED_ORIGINS'],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize rate limiter with shared configuration
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[
        f"{SERVICE_CONFIG['RATE_LIMITS']['GENERAL']['MAX']} per {SERVICE_CONFIG['RATE_LIMITS']['GENERAL']['WINDOW_MS']//1000} seconds"
    ]
)

# Initialize SocketIO with specific CORS origins (not wildcard)
socketio = SocketIO(
    app, 
    cors_allowed_origins=SERVICE_CONFIG['ALLOWED_ORIGINS'],
    async_mode='threading'
)

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

# JWT Authentication decorator
def verify_token(f):
    """Verify JWT token from Express backend"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            # Verify the JWT token
            payload = jwt.decode(
                token, 
                SERVICE_CONFIG['SECURITY']['JWT_SECRET'],
                algorithms=['HS256']
            )
            
            # Check if token has expired
            if 'exp' in payload:
                if datetime.utcnow().timestamp() > payload['exp']:
                    return jsonify({'error': 'Token has expired'}), 401
            
            # Add user info to request context
            setattr(request, 'user', payload.get('user'))
            setattr(request, 'session_id', payload.get('session_id'))
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/health', methods=['GET'])
def health_check():
    """Comprehensive health check endpoint with diagnostics"""
    import psutil
    import time
    from datetime import datetime
    
    health_data = {
        'status': 'healthy',
        'service': 'pygame-execution-backend',
        'port': SERVICE_CONFIG['FLASK_PORT'],
        'version': '2.0.0',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'environment': os.environ.get('FLASK_ENV', 'development'),
        'uptime': time.time() - psutil.boot_time(),
        'system': {
            'cpu_count': psutil.cpu_count(),
            'memory_total': psutil.virtual_memory().total,
            'memory_available': psutil.virtual_memory().available,
            'disk_usage': psutil.disk_usage('/').percent
        },
        'process': {
            'memory_rss': psutil.Process().memory_info().rss,
            'memory_vms': psutil.Process().memory_info().vms,
            'cpu_percent': psutil.Process().cpu_percent(interval=0.1)
        },
        'game_sessions': {
            'active_count': len(game_sessions),
            'max_allowed': MAX_CONCURRENT_SESSIONS,
            'sessions': list(game_sessions.keys())
        },
        'checks': {
            'docker_available': False,
            'docker_daemon': False,
            'game_executor_image': False,
            'force_docker_mode': False
        }
    }
    
    try:
        # Check Docker availability
        force_docker = os.environ.get('FORCE_DOCKER_EXECUTION', 'false').lower() == 'true'
        health_data['checks']['force_docker_mode'] = force_docker
        
        try:
            import docker
            health_data['checks']['docker_available'] = True
            
            # Test Docker daemon connection
            try:
                client = docker.from_env()
                client.ping()
                health_data['checks']['docker_daemon'] = True
                
                # Check if game executor image exists
                # Import docker.errors conditionally to avoid import issues  
                try:
                    import docker.errors
                    ImageNotFoundError = docker.errors.ImageNotFound
                except (ImportError, AttributeError):
                    ImageNotFoundError = Exception
                    
                try:
                    from security_config import DOCKER_CONFIG
                    client.images.get(DOCKER_CONFIG['image_name'])
                    health_data['checks']['game_executor_image'] = True
                except ImageNotFoundError:
                    health_data['checks']['game_executor_image'] = False
                    if force_docker:
                        health_data['status'] = 'unhealthy'
                        health_data['error'] = 'Game executor Docker image not found'
                except Exception as e:
                    health_data['checks']['game_executor_image'] = False
                    if force_docker:
                        health_data['status'] = 'unhealthy'
                        health_data['error'] = f'Error checking Docker image: {e}'
                        
            except Exception as e:
                health_data['checks']['docker_daemon'] = False
                if force_docker:
                    health_data['status'] = 'unhealthy'
                    health_data['error'] = f'Docker daemon unavailable: {str(e)}'
                    
        except ImportError:
            health_data['checks']['docker_available'] = False
            if force_docker:
                health_data['status'] = 'unhealthy'
                health_data['error'] = 'Docker library not installed but required in production'
        
        # Check resource limits
        if health_data['system']['memory_available'] < 100 * 1024 * 1024:  # Less than 100MB
            health_data['status'] = 'unhealthy'
            health_data['warning'] = 'Low memory available'
            
        if health_data['system']['disk_usage'] > 90:  # More than 90% disk usage
            health_data['status'] = 'unhealthy'
            health_data['warning'] = 'High disk usage'
            
        # Check session limits
        if len(game_sessions) >= MAX_CONCURRENT_SESSIONS:
            health_data['warning'] = 'Maximum concurrent sessions reached'
            
    except Exception as e:
        health_data['status'] = 'unhealthy'
        health_data['error'] = f'Health check failed: {str(e)}'
    
    status_code = 200 if health_data['status'] == 'healthy' else 503
    return jsonify(health_data), status_code

@app.route('/api/compile', methods=['POST'])
@limiter.limit(f"{SERVICE_CONFIG['RATE_LIMITS']['GAME_EXECUTION']['MAX']} per {SERVICE_CONFIG['RATE_LIMITS']['GAME_EXECUTION']['WINDOW_MS']//1000} seconds")
@verify_token
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
@limiter.limit(f"{SERVICE_CONFIG['RATE_LIMITS']['GAME_EXECUTION']['MAX']} per {SERVICE_CONFIG['RATE_LIMITS']['GAME_EXECUTION']['WINDOW_MS']//1000} seconds")
@verify_token
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
        
        # Security: Validate code using enhanced security validator
        from security_config import CodeValidator
        is_valid, error_msg = CodeValidator.validate_code(code)
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400
        
        session_id = str(uuid.uuid4())
        
        # Import the secure game engine module
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
@verify_token
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
            
            time.sleep(1.0 / SERVICE_CONFIG['GAME']['STREAM_FPS'])  # Stream FPS from config
        
        yield f"data: {json.dumps({'type': 'end', 'message': 'Game ended'})}\n\n"
        
        # Clean up session
        if session_id in game_sessions:
            del game_sessions[session_id]
    
    return Response(generate(), mimetype='text/event-stream')

# Project management endpoints have been removed - handled by Express backend

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    client_sid = getattr(request, 'sid', 'unknown')
    print(f"Client connected: {client_sid}")
    emit('connected', {'message': 'Connected to game server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    client_sid = getattr(request, 'sid', 'unknown')
    print(f"Client disconnected: {client_sid}")

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
@app.route('/api/stop-game/<session_id>', methods=['POST'])
@limiter.limit(f"{SERVICE_CONFIG['RATE_LIMITS']['STRICT']['MAX']} per {SERVICE_CONFIG['RATE_LIMITS']['STRICT']['WINDOW_MS']//1000} seconds")
@verify_token
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
@verify_token
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
@verify_token
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

# Code validation is now handled by security_config.CodeValidator
# This provides enhanced AST-based validation with better security

def generate_python_code(components, game_type):
    """Generate Python pygame code from visual components"""
    # Import the GameCompiler from game_engine module
    from game_engine import GameCompiler
    
    # Use the GameCompiler to generate appropriate code for the game type
    return GameCompiler.compile(components, game_type)

if __name__ == '__main__':
    # Run the Flask app on port 5001
    port = SERVICE_CONFIG['FLASK_PORT']
    print(f"Starting Pygame Execution Backend on port {port}")
    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.environ.get('FLASK_ENV') != 'production',
        use_reloader=False  # Disable reloader for game execution
    )