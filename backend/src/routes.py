"""API route definitions."""

import os
import json
import time
import base64
from io import BytesIO
from flask import request, jsonify, Response
from werkzeug.exceptions import BadRequest

from .config import get_config
from .auth import verify_token
from .game_manager import (
    game_sessions, session_start_times, 
    cleanup_expired_sessions, create_game_session, 
    stop_game_session, get_active_sessions
)


def register_api_routes(app, limiter, socketio):
    """Register all API routes."""
    config = get_config()
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Comprehensive health check endpoint."""
        import psutil
        from datetime import datetime
        
        health_data = {
            'status': 'healthy',
            'service': 'pygame-execution-backend',
            'port': config['FLASK_PORT'],
            'version': '2.1.0',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'environment': os.environ.get('FLASK_ENV', 'development'),
            'system': {
                'cpu_count': psutil.cpu_count(),
                'memory_total': psutil.virtual_memory().total,
                'memory_available': psutil.virtual_memory().available,
                'disk_usage': psutil.disk_usage('/').percent
            },
            'game_sessions': {
                'active_count': len(game_sessions),
                'max_allowed': config['GAME']['MAX_CONCURRENT_SESSIONS'],
                'sessions': list(game_sessions.keys())
            },
            'checks': {
                'docker_available': False,
                'subprocess_executor': True
            }
        }
        
        # Check Docker availability (optional)
        try:
            import docker
            health_data['checks']['docker_available'] = True
            try:
                client = docker.from_env()
                client.ping()
                health_data['checks']['docker_daemon'] = True
            except:
                health_data['checks']['docker_daemon'] = False
        except ImportError:
            health_data['checks']['docker_available'] = False
        
        # Resource checks
        if health_data['system']['memory_available'] < 100 * 1024 * 1024:
            health_data['status'] = 'degraded'
            health_data['warning'] = 'Low memory available'
        
        if health_data['system']['disk_usage'] > 90:
            health_data['status'] = 'degraded'
            health_data['warning'] = 'High disk usage'
        
        status_code = 200 if health_data['status'] == 'healthy' else 503
        return jsonify(health_data), status_code

    @app.route('/api/compile', methods=['POST'])
    @limiter.limit(f"{config['RATE_LIMITS']['GAME_EXECUTION']['MAX']} per {config['RATE_LIMITS']['GAME_EXECUTION']['WINDOW_MS']//1000} seconds")
    @verify_token
    def compile_game():
        """Compile game from components into Python code."""
        try:
            data = request.json
            if not data:
                raise BadRequest("No data provided")
            
            components = data.get('components', [])
            game_type = data.get('gameType', 'platformer')
            
            # Generate Python code
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
    @limiter.limit(f"{config['RATE_LIMITS']['GAME_EXECUTION']['MAX']} per {config['RATE_LIMITS']['GAME_EXECUTION']['WINDOW_MS']//1000} seconds")
    @verify_token
    def execute_game():
        """Execute Python game code."""
        try:
            data = request.json
            if not data or 'code' not in data:
                raise BadRequest("No code provided")
            
            code = data['code']
            
            # Security checks
            if len(code) > config['GAME']['MAX_CODE_SIZE']:
                return jsonify({
                    'success': False,
                    'error': f'Code size exceeds limit ({config["GAME"]["MAX_CODE_SIZE"]} bytes)'
                }), 400
            
            # Check session limits
            max_sessions = config['GAME']['MAX_CONCURRENT_SESSIONS']
            max_time = config['GAME']['MAX_SESSION_TIME']
            
            if len(game_sessions) >= max_sessions:
                # Clean up expired sessions first
                cleaned = cleanup_expired_sessions(max_time)
                print(f"🧹 Cleaned {cleaned} expired sessions")
                
                if len(game_sessions) >= max_sessions:
                    return jsonify({
                        'success': False,
                        'error': 'Maximum concurrent sessions reached. Try again later.'
                    }), 429
            
            # Validate code
            try:
                from ..security_config import CodeValidator
                is_valid, error_msg = CodeValidator.validate_code(code)
                if not is_valid:
                    return jsonify({
                        'success': False,
                        'error': f'Code validation failed: {error_msg}'
                    }), 400
            except ImportError:
                print("⚠️  Security validator not available, proceeding without validation")
            
            # Create and start game session
            session_id = create_game_session(code, max_time, socketio)
            
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
        """Stream game frames via Server-Sent Events."""
        def generate():
            if session_id not in game_sessions:
                yield f"data: {json.dumps({'error': 'Invalid session'})}\n\n"
                return
            
            executor = game_sessions[session_id]
            
            while hasattr(executor, 'is_running') and executor.is_running():
                if hasattr(executor, 'get_frame'):
                    frame = executor.get_frame()
                    if frame:
                        # Convert to base64 JPEG
                        buffered = BytesIO()
                        frame.save(buffered, format="JPEG", quality=75, optimize=True)
                        img_str = base64.b64encode(buffered.getvalue()).decode()
                        
                        yield f"data: {json.dumps({'type': 'frame', 'data': img_str})}\n\n"
                
                time.sleep(1.0 / config['GAME']['STREAM_FPS'])
            
            yield f"data: {json.dumps({'type': 'end', 'message': 'Game ended'})}\n\n"
            
            # Clean up
            if session_id in game_sessions:
                del game_sessions[session_id]
            if session_id in session_start_times:
                del session_start_times[session_id]
        
        return Response(generate(), mimetype='text/event-stream')

    @app.route('/api/stop-game/<session_id>', methods=['POST'])
    @limiter.limit(f"{config['RATE_LIMITS']['STRICT']['MAX']} per {config['RATE_LIMITS']['STRICT']['WINDOW_MS']//1000} seconds")
    @verify_token
    def stop_game_endpoint(session_id):
        """Stop a game session."""
        try:
            if stop_game_session(session_id):
                return jsonify({
                    'success': True,
                    'message': 'Game stopped successfully'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Invalid session ID'
                }), 404
                
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/game-input/<session_id>', methods=['POST'])
    @limiter.limit("100 per minute")
    @verify_token
    def send_game_input(session_id):
        """Send input to a game session."""
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
            if hasattr(executor, 'send_input'):
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
        """List all active game sessions."""
        try:
            sessions = get_active_sessions()
            
            return jsonify({
                'success': True,
                'sessions': sessions,
                'max_concurrent': config['GAME']['MAX_CONCURRENT_SESSIONS'],
                'current_count': len(sessions)
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500


def generate_python_code(components, game_type):
    """Generate pygame code from visual components."""
    try:
        from ..game_engine import GameCompiler
        return GameCompiler.compile(components, game_type)
    except ImportError:
        # Fallback basic code generation
        return f"""
import pygame
import sys

# Initialize pygame
pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("{game_type.title()} Game")
clock = pygame.time.Clock()

# Main game loop
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Clear screen
    screen.fill((0, 0, 0))
    
    # Game logic here
    # Components: {components}
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()
sys.exit()
"""