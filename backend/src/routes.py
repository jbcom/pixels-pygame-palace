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
from .web_game_compiler import web_game_manager
from .web_game_server import setup_web_game_server


def register_api_routes(app, limiter, socketio):
    """Register all API routes."""
    config = get_config()
    
    # Setup web game server
    compiled_games_dir = os.path.join(os.path.dirname(__file__), '..', 'compiled_games')
    web_game_server = setup_web_game_server(app, compiled_games_dir)
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Comprehensive health check endpoint."""
        import psutil
        from datetime import datetime
        
        health_data = {
            'status': 'healthy',
            'service': 'pygame-execution-backend',
            'port': config.flask_port,
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
                'max_allowed': config.game.max_concurrent_sessions,
                'sessions': list(game_sessions.keys())
            },
            'checks': {
                'subprocess_executor': True
            }
        }
        
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
    @limiter.limit(f"{config.rate_limits['game_execution'].max} per {config.rate_limits['game_execution'].window_ms//1000} seconds")
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
    @limiter.limit(f"{config.rate_limits['game_execution'].max} per {config.rate_limits['game_execution'].window_ms//1000} seconds")
    @verify_token
    def execute_game():
        """Execute Python game code."""
        try:
            data = request.json
            if not data or 'code' not in data:
                raise BadRequest("No code provided")
            
            code = data['code']
            
            # Security checks
            if len(code) > config.game.max_code_size:
                return jsonify({
                    'success': False,
                    'error': f'Code size exceeds limit ({config.game.max_code_size} bytes)'
                }), 400
            
            # Check session limits
            max_sessions = config.game.max_concurrent_sessions
            max_time = config.game.max_session_time
            
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
                
                time.sleep(1.0 / config.game.stream_fps)
            
            yield f"data: {json.dumps({'type': 'end', 'message': 'Game ended'})}\n\n"
            
            # Clean up
            if session_id in game_sessions:
                del game_sessions[session_id]
            if session_id in session_start_times:
                del session_start_times[session_id]
        
        return Response(generate(), mimetype='text/event-stream')

    @app.route('/api/stop-game/<session_id>', methods=['POST'])
    @limiter.limit(f"{config.rate_limits['strict'].max} per {config.rate_limits['strict'].window_ms//1000} seconds")
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
                'max_concurrent': config.game.max_concurrent_sessions,
                'current_count': len(sessions)
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/compile-web-game', methods=['POST'])
    @limiter.limit(f"{config.rate_limits['game_execution'].max} per {config.rate_limits['game_execution'].window_ms//1000} seconds")
    @verify_token
    def compile_web_game():
        """Compile game to WebAssembly using pygbag."""
        try:
            data = request.json
            if not data or 'code' not in data:
                raise BadRequest("No code provided")
            
            code = data['code']
            game_id = data.get('game_id')
            assets = data.get('assets', [])
            
            # Security checks
            if len(code) > config.game.max_code_size:
                return jsonify({
                    'success': False,
                    'error': f'Code size exceeds limit ({config.game.max_code_size} bytes)'
                }), 400
            
            # Start compilation
            compilation_id = web_game_manager.start_compilation(code, game_id, assets)
            
            return jsonify({
                'success': True,
                'compilation_id': compilation_id,
                'message': 'Web game compilation started'
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 400

    @app.route('/api/compilation-status/<compilation_id>', methods=['GET'])
    @verify_token
    def get_compilation_status(compilation_id):
        """Get compilation status."""
        try:
            status = web_game_manager.get_compilation_status(compilation_id)
            
            if status is None:
                return jsonify({
                    'success': False,
                    'error': 'Compilation not found'
                }), 404
            
            return jsonify({
                'success': True,
                'status': status
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/web-games/manage', methods=['GET'])
    @verify_token
    def manage_web_games():
        """Get web games management info."""
        try:
            # Get list of compiled games
            compiled_games = web_game_manager.compiler.list_compiled_games()
            
            # Clean up old compilations
            cleaned = web_game_manager.cleanup_old_compilations()
            
            games_info = []
            for game_id in compiled_games:
                game_path = web_game_manager.compiler.get_compiled_game_path(game_id)
                if game_path:
                    games_info.append({
                        'id': game_id,
                        'path': game_path,
                        'url': f'/web-games/{game_id}/',
                        'created': os.path.getctime(game_path),
                        'modified': os.path.getmtime(game_path)
                    })
            
            return jsonify({
                'success': True,
                'games': games_info,
                'total_games': len(games_info),
                'cleaned_compilations': cleaned
            }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/web-games/<game_id>/delete', methods=['DELETE'])
    @limiter.limit(f"{config.rate_limits['strict'].max} per {config.rate_limits['strict'].window_ms//1000} seconds")
    @verify_token
    def delete_web_game_api(game_id):
        """Delete a compiled web game."""
        try:
            success = web_game_manager.compiler.delete_compiled_game(game_id)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': f'Web game {game_id} deleted successfully'
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': f'Failed to delete web game {game_id}'
                }), 404
                
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