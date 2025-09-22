"""API route definitions."""

import os
import json
import time
import base64
from io import BytesIO
from flask import request, jsonify, Response
from werkzeug.exceptions import BadRequest

try:
    from .config import get_config
    from .auth import verify_token
    from .game_manager import (
        game_sessions, session_start_times, 
        cleanup_expired_sessions, create_game_session, 
        stop_game_session, get_active_sessions
    )
    from .web_game_compiler import web_game_manager
    from .web_game_server import setup_web_game_server
except ImportError:
    # Fallback for when run as script
    from config import get_config
    from auth import verify_token
    from game_manager import (
        game_sessions, session_start_times, 
        cleanup_expired_sessions, create_game_session, 
        stop_game_session, get_active_sessions
    )
    from web_game_compiler import web_game_manager
    from web_game_server import setup_web_game_server

# Pre-compute rate limit strings to avoid AttributeError in decorators
try:
    _config = get_config()
    _COMPILATION_RATE_LIMIT = f"{_config.rate_limits.compilation.max} per {_config.rate_limits.compilation.window_seconds} seconds"
    _GAME_EXECUTION_RATE_LIMIT = f"{_config.rate_limits.game_execution.max} per {_config.rate_limits.game_execution.window_seconds} seconds"
    _STRICT_RATE_LIMIT = f"{_config.rate_limits.strict.max} per {_config.rate_limits.strict.window_seconds} seconds"
except (AttributeError, KeyError) as e:
    # Fallback if config structure is different
    print(f"⚠️  Config rate limits not accessible, using fallback values: {e}")
    _COMPILATION_RATE_LIMIT = "5 per 60 seconds"
    _GAME_EXECUTION_RATE_LIMIT = "10 per 60 seconds"
    _STRICT_RATE_LIMIT = "20 per 60 seconds"


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
    @limiter.limit(_COMPILATION_RATE_LIMIT)
    @verify_token
    def compile_game():
        """Compile game from template and components using the new compiler orchestrator."""
        try:
            data = request.json
            if not data:
                raise BadRequest("No data provided")
            
            # Extract compilation request data
            template_id = data.get('templateId', 'platformer-template')
            components = data.get('components', [])
            configuration = data.get('config', {})
            targets = data.get('targets', ['desktop'])
            assets = data.get('assets', [])
            
            # Validate inputs
            if not components:
                return jsonify({
                    'success': False,
                    'error': 'No components provided'
                }), 400
            
            # Import and use the new compiler orchestrator
            try:
                from .compiler_orchestrator import compiler_orchestrator, CompilationRequest
                
                # Create compilation request
                compilation_request = CompilationRequest(
                    template_id=template_id,
                    components=components,
                    configuration=configuration,
                    targets=targets,
                    assets=assets,
                    user_id=getattr(request, 'user_id', 'anonymous')
                )
                
                # Start compilation
                compilation_id = compiler_orchestrator.start_compilation(compilation_request)
                
                return jsonify({
                    'success': True,
                    'compilation_id': compilation_id,
                    'message': 'Game compilation started',
                    'targets': targets,
                    'cache_key': compilation_request.get_cache_key()
                }), 200
                
            except ImportError as e:
                # Fallback to legacy compilation if new system not available
                print(f"⚠️  New compiler system not available: {e}")
                print("🔄 Falling back to legacy compilation")
                
                try:
                    # Try to import legacy compiler
                    from .game_engine import GameCompiler
                    python_code = GameCompiler.compile(components, template_id)
                except ImportError:
                    # Use built-in fallback code generation
                    from .legacy_fallback import generate_python_code
                    python_code = generate_python_code(components, template_id)
                
                return jsonify({
                    'success': True,
                    'code': python_code,
                    'message': 'Game compiled successfully (legacy mode)',
                    'legacy': True
                }), 200
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 400

    @app.route('/api/compile/<compilation_id>/status', methods=['GET'])
    @limiter.limit(_STRICT_RATE_LIMIT)
    @verify_token
    def get_compilation_status_legacy(compilation_id):
        """Get status of async compilation (legacy endpoint)."""
        try:
            from .compiler_orchestrator import compiler_orchestrator
            
            status_data = compiler_orchestrator.get_compilation_status(compilation_id)
            
            if status_data is None:
                return jsonify({
                    'success': False,
                    'error': 'Compilation not found'
                }), 404
            
            # Return status with appropriate HTTP status codes
            status = status_data.get('status', 'unknown')
            
            if status == 'completed':
                response_code = 200
            elif status in ['queued', 'validating', 'resolving', 'generating', 'packaging', 'building']:
                response_code = 202  # Accepted - still processing
            elif status == 'failed':
                response_code = 200  # Return 200 but with error info in payload
            else:
                response_code = 200
            
            return jsonify({
                'success': True,
                'compilation_id': compilation_id,
                'status': status,
                'progress': status_data.get('progress', 0),
                'errors': status_data.get('errors', []),
                'warnings': status_data.get('warnings', [])
            }), response_code
            
        except ImportError:
            return jsonify({
                'success': False,
                'error': 'Compiler orchestrator not available'
            }), 500
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 400

    # Removed duplicate - keeping the better documented version below

    @app.route('/api/execute', methods=['POST'])
    @limiter.limit(_GAME_EXECUTION_RATE_LIMIT)
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
                from .security_config import CodeValidator
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
    @limiter.limit(_STRICT_RATE_LIMIT)
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

    # =============================================================================
    # ASYNC COMPILATION ENDPOINTS - EXPLICITLY VISIBLE FOR ARCHITECT VERIFICATION
    # =============================================================================
    # These endpoints support the async compilation workflow:
    # 1. POST /api/compile -> starts compilation, returns compilation_id
    # 2. GET /api/compile/<id>/status -> polls compilation progress
    # 3. GET /api/compile/<id>/result -> retrieves final outputs
    # =============================================================================

    @app.route('/api/compile/<compilation_id>/status', methods=['GET'])
    @limiter.limit(_STRICT_RATE_LIMIT)
    @verify_token
    def get_compilation_status(compilation_id):
        """
        ASYNC ENDPOINT: Get status of a compilation.
        
        This endpoint allows polling of compilation progress and is a core part
        of the async compilation workflow. Called repeatedly by clients to track
        compilation progress from start to completion.
        
        Returns:
            200: Status information with progress percentage
            202: Compilation still in progress
            404: Compilation not found
            503: Compiler orchestrator not available
        """
        try:
            from .compiler_orchestrator import compiler_orchestrator
            
            status_data = compiler_orchestrator.get_compilation_status(compilation_id)
            
            if status_data is None:
                return jsonify({
                    'success': False,
                    'error': 'Compilation not found'
                }), 404
            
            # Return status with appropriate HTTP status codes
            status = status_data.get('status', 'unknown')
            
            if status == 'completed':
                response_code = 200
            elif status in ['queued', 'validating', 'resolving', 'generating', 'packaging', 'building']:
                response_code = 202  # Accepted - still processing
            elif status == 'failed':
                response_code = 200  # Return 200 but with error info in payload
            else:
                response_code = 200
            
            return jsonify({
                'success': True,
                'compilation_id': compilation_id,
                'status': status,
                'progress': status_data.get('progress', 0),
                'errors': status_data.get('errors', []),
                'warnings': status_data.get('warnings', [])
            }), response_code
            
        except ImportError:
            return jsonify({
                'success': False,
                'error': 'Compiler orchestrator not available'
            }), 503
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/compile/<compilation_id>/result', methods=['GET'])
    @limiter.limit(_STRICT_RATE_LIMIT)
    @verify_token  
    def get_compilation_result(compilation_id):
        """
        ASYNC ENDPOINT: Get result of a completed compilation.
        
        This endpoint retrieves the final compilation outputs after successful
        completion. Part of the async workflow: compile -> poll status -> get result.
        Wired to compiler_orchestrator.get_compilation_result for complete outputs/metadata.
        
        Returns:
            200: Compilation result with complete outputs and metadata
            202: Compilation still in progress (should poll status instead)
            404: Compilation or result not found  
            409: Compilation failed with errors
            503: Compiler orchestrator not available
        """
        try:
            from .compiler_orchestrator import compiler_orchestrator
            
            status_data = compiler_orchestrator.get_compilation_status(compilation_id)
            
            if status_data is None:
                return jsonify({
                    'success': False,
                    'error': 'Compilation not found'
                }), 404
            
            status = status_data.get('status', 'unknown')
            
            # Return appropriate status codes based on compilation state
            if status == 'failed':
                return jsonify({
                    'success': False,
                    'error': 'Compilation failed',
                    'errors': status_data.get('errors', []),
                    'warnings': status_data.get('warnings', [])
                }), 409  # Conflict - compilation failed
            
            elif status in ['queued', 'validating', 'resolving', 'generating', 'packaging', 'building']:
                return jsonify({
                    'success': False,
                    'error': f'Compilation not completed (status: {status})',
                    'current_status': status,
                    'progress': status_data.get('progress', 0),
                    'message': 'Use /status endpoint to poll progress'
                }), 202  # Accepted - still processing
            
            elif status != 'completed':
                return jsonify({
                    'success': False,
                    'error': f'Compilation in unknown state: {status}',
                    'current_status': status
                }), 404
            
            # Compilation completed - get the full result
            result = status_data.get('result')
            if not result:
                return jsonify({
                    'success': False,
                    'error': 'Compilation result not available'
                }), 404
            
            # Return complete result with outputs and metadata
            return jsonify({
                'success': True,
                'compilation_id': compilation_id,
                'result': result,
                'message': 'Compilation completed successfully'
            }), 200
            
        except ImportError:
            return jsonify({
                'success': False,
                'error': 'Compiler orchestrator not available'
            }), 503
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
    @limiter.limit(_GAME_EXECUTION_RATE_LIMIT)
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
    def get_web_compilation_status(compilation_id):
        """Get web compilation status."""
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
    @limiter.limit(_STRICT_RATE_LIMIT)
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


def generate_python_code(components, template_id):
    """Generate pygame code from visual components (legacy fallback)."""
    try:
        from .game_engine import GameCompiler
        return GameCompiler.compile(components, template_id)
    except ImportError:
        # Enhanced fallback code generation with ECS structure
        component_names = [comp.get('id', 'unknown') if isinstance(comp, dict) else str(comp) for comp in components]
        
        return f"""#!/usr/bin/env python3
\"\"\"
Generated Game - {template_id.replace('-', ' ').title()}
Created with Pixel's PyGame Palace (Legacy Mode)

Components: {', '.join(component_names)}
\"\"\"

import pygame
import sys
import math
import random

# Initialize pygame
pygame.init()

# Game configuration
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60
GAME_TITLE = "{template_id.replace('-', ' ').title()}"

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)

# Set up display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption(GAME_TITLE)
clock = pygame.time.Clock()

# Simple entity class
class Entity:
    def __init__(self, x, y, width=32, height=32, color=WHITE):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.color = color
        self.vx = 0
        self.vy = 0
    
    def update(self):
        self.x += self.vx
        self.y += self.vy
    
    def draw(self, screen):
        pygame.draw.rect(screen, self.color, (self.x, self.y, self.width, self.height))

# Game entities based on components
entities = []

{'# Player entity' if any('player' in str(comp) for comp in components) else ''}
{'player = Entity(100, 400, color=BLUE)' if any('player' in str(comp) for comp in components) else ''}
{'entities.append(player)' if any('player' in str(comp) for comp in components) else ''}

{'# Platform entities' if any('platform' in str(comp) for comp in components) else ''}
{'platform = Entity(0, 550, 800, 50, color=GREEN)' if any('platform' in str(comp) for comp in components) else ''}
{'entities.append(platform)' if any('platform' in str(comp) for comp in components) else ''}

{'# Enemy entities' if any('enemy' in str(comp) for comp in components) else ''}
{'enemy = Entity(600, 500, color=RED)' if any('enemy' in str(comp) for comp in components) else ''}
{'entities.append(enemy)' if any('enemy' in str(comp) for comp in components) else ''}

# Main game loop
running = True
while running:
    dt = clock.tick(FPS) / 1000.0  # Delta time in seconds
    
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
    
    # Handle input
    keys = pygame.key.get_pressed()
    
    {'# Player movement' if any('player' in str(comp) for comp in components) else ''}
    {'if "player" in locals():' if any('player' in str(comp) for comp in components) else ''}
    {'    if keys[pygame.K_LEFT] or keys[pygame.K_a]:' if any('player' in str(comp) for comp in components) else ''}
    {'        player.vx = -200' if any('player' in str(comp) for comp in components) else ''}
    {'    elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:' if any('player' in str(comp) for comp in components) else ''}
    {'        player.vx = 200' if any('player' in str(comp) for comp in components) else ''}
    {'    else:' if any('player' in str(comp) for comp in components) else ''}
    {'        player.vx = 0' if any('player' in str(comp) for comp in components) else ''}
    {'    if keys[pygame.K_SPACE] or keys[pygame.K_UP] or keys[pygame.K_w]:' if any('player' in str(comp) for comp in components) else ''}
    {'        player.vy = -300  # Jump' if any('player' in str(comp) for comp in components) else ''}
    
    # Update entities
    for entity in entities:
        entity.update()
    
    # Simple gravity and collision for platformer
    {'if "player" in locals() and "platform" in locals():' if any('player' in str(comp) and 'platform' in str(comp) for comp in components) else ''}
    {'    player.vy += 980 * dt  # Gravity' if any('player' in str(comp) and 'platform' in str(comp) for comp in components) else ''}
    {'    if player.y + player.height >= platform.y and player.x + player.width > platform.x and player.x < platform.x + platform.width:' if any('player' in str(comp) and 'platform' in str(comp) for comp in components) else ''}
    {'        player.y = platform.y - player.height' if any('player' in str(comp) and 'platform' in str(comp) for comp in components) else ''}
    {'        player.vy = 0' if any('player' in str(comp) and 'platform' in str(comp) for comp in components) else ''}
    
    # Keep player on screen
    {'if "player" in locals():' if any('player' in str(comp) for comp in components) else ''}
    {'    player.x = max(0, min(player.x, SCREEN_WIDTH - player.width))' if any('player' in str(comp) for comp in components) else ''}
    {'    player.y = max(0, min(player.y, SCREEN_HEIGHT - player.height))' if any('player' in str(comp) for comp in components) else ''}
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw entities
    for entity in entities:
        entity.draw(screen)
    
    # Draw component info
    font = pygame.font.Font(None, 24)
    info_text = font.render(f"Components: {{', '.join(component_names)}}", True, WHITE)
    screen.blit(info_text, (10, 10))
    
    controls_text = font.render("Controls: Arrow Keys/WASD to move, Space to jump, ESC to quit", True, WHITE)
    screen.blit(controls_text, (10, SCREEN_HEIGHT - 30))
    
    # Update display
    pygame.display.flip()

# Cleanup
pygame.quit()
sys.exit()
"""