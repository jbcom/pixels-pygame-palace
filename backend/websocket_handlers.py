"""WebSocket event handlers for real-time game communication."""

from flask import request
from flask_socketio import emit

try:
    from .game_manager import game_sessions
except ImportError:
    from game_manager import game_sessions


def register_websocket_handlers(socketio):
    """Register all WebSocket event handlers."""
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client WebSocket connection."""
        client_sid = getattr(request, 'sid', 'unknown')
        print(f"🔌 WebSocket client connected: {client_sid}")
        emit('connected', {
            'message': 'Connected to pygame execution server',
            'sid': client_sid
        })

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client WebSocket disconnection."""
        client_sid = getattr(request, 'sid', 'unknown')
        print(f"🔌 WebSocket client disconnected: {client_sid}")

    @socketio.on('game_input')
    def handle_game_input(data):
        """Handle game input from client."""
        try:
            session_id = data.get('session_id')
            input_data = data.get('input')
            
            if not session_id or input_data is None:
                emit('input_error', {'error': 'Missing session_id or input data'})
                return
            
            if session_id in game_sessions:
                executor = game_sessions[session_id]
                if hasattr(executor, 'send_input'):
                    executor.send_input(input_data)
                    emit('input_received', {'status': 'ok', 'session_id': session_id})
                else:
                    emit('input_error', {'error': 'Game executor does not support input'})
            else:
                emit('input_error', {'error': 'Invalid session ID'})
                
        except Exception as e:
            print(f"❌ WebSocket input error: {e}")
            emit('input_error', {'error': str(e)})

    @socketio.on('stop_game')
    def handle_stop_game(data):
        """Handle game stop request via WebSocket."""
        try:
            session_id = data.get('session_id')
            
            if not session_id:
                emit('stop_error', {'error': 'Missing session_id'})
                return
            
            if session_id in game_sessions:
                executor = game_sessions[session_id]
                if hasattr(executor, 'stop'):
                    executor.stop()
                    
                # Clean up session
                if session_id in game_sessions:
                    del game_sessions[session_id]
                    
                emit('game_stopped', {'session_id': session_id})
                print(f"🛑 Game stopped via WebSocket: {session_id}")
            else:
                emit('stop_error', {'error': 'Invalid session ID'})
                
        except Exception as e:
            print(f"❌ WebSocket stop error: {e}")
            emit('stop_error', {'error': str(e)})

    @socketio.on('ping')
    def handle_ping(data):
        """Handle ping-pong for connection testing."""
        emit('pong', {'timestamp': data.get('timestamp', 0)})

    @socketio.on('session_status')
    def handle_session_status(data):
        """Handle session status request."""
        try:
            session_id = data.get('session_id')
            
            if not session_id:
                emit('status_error', {'error': 'Missing session_id'})
                return
            
            if session_id in game_sessions:
                executor = game_sessions[session_id]
                is_running = hasattr(executor, 'is_running') and executor.is_running()
                
                emit('session_status', {
                    'session_id': session_id,
                    'running': is_running,
                    'exists': True
                })
            else:
                emit('session_status', {
                    'session_id': session_id,
                    'running': False,
                    'exists': False
                })
                
        except Exception as e:
            print(f"❌ WebSocket status error: {e}")
            emit('status_error', {'error': str(e)})