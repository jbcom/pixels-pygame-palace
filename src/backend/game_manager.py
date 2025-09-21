"""Game session management and execution."""

import time
import uuid
import atexit
import signal
import threading
from typing import Dict, Optional, Any

# Session storage
game_sessions: Dict[str, Any] = {}
session_start_times: Dict[str, float] = {}

def cleanup_all_sessions():
    """Clean up all running game sessions on shutdown."""
    print("🧹 Cleaning up all game sessions...")
    for session_id in list(game_sessions.keys()):
        try:
            executor = game_sessions[session_id]
            if hasattr(executor, 'stop'):
                executor.stop()
        except Exception as e:
            print(f"❌ Error cleaning up session {session_id}: {e}")
    game_sessions.clear()
    session_start_times.clear()

def get_active_sessions():
    """Get list of active game sessions."""
    current_time = time.time()
    sessions = []
    
    for session_id in game_sessions:
        start_time = session_start_times.get(session_id, current_time)
        executor = game_sessions[session_id]
        
        sessions.append({
            'session_id': session_id,
            'running_time': current_time - start_time,
            'is_running': hasattr(executor, 'is_running') and executor.is_running(),
            'start_time': start_time
        })
    
    return sessions

def cleanup_expired_sessions(max_session_time: int):
    """Clean up expired sessions based on max time."""
    current_time = time.time()
    expired_sessions = []
    
    for session_id, start_time in list(session_start_times.items()):
        if current_time - start_time > max_session_time:
            expired_sessions.append(session_id)
    
    for session_id in expired_sessions:
        try:
            if session_id in game_sessions:
                executor = game_sessions[session_id]
                if hasattr(executor, 'stop'):
                    executor.stop()
                del game_sessions[session_id]
            if session_id in session_start_times:
                del session_start_times[session_id]
            print(f"🕐 Cleaned up expired session: {session_id}")
        except Exception as e:
            print(f"❌ Error cleaning expired session {session_id}: {e}")
    
    return len(expired_sessions)

def create_game_session(code: str, max_session_time: int, socketio):
    """Create a new game execution session."""
    from .game_engine import GameExecutor
    
    session_id = str(uuid.uuid4())
    
    # Create executor
    executor = GameExecutor(session_id, timeout=max_session_time)
    game_sessions[session_id] = executor
    session_start_times[session_id] = time.time()
    
    # Start execution in separate thread
    def run_game():
        try:
            executor.execute(code)
        except Exception as e:
            print(f"🎮 Game execution error: {e}")
            if socketio:
                socketio.emit('game_error', {
                    'session_id': session_id, 
                    'error': str(e)
                })
        finally:
            # Clean up after execution
            if session_id in game_sessions:
                del game_sessions[session_id]
            if session_id in session_start_times:
                del session_start_times[session_id]
    
    game_thread = threading.Thread(target=run_game)
    game_thread.daemon = True
    game_thread.start()
    
    return session_id

def stop_game_session(session_id: str) -> bool:
    """Stop and clean up a specific game session."""
    if session_id not in game_sessions:
        return False
    
    try:
        executor = game_sessions[session_id]
        if hasattr(executor, 'stop'):
            executor.stop()
        
        # Clean up
        del game_sessions[session_id]
        if session_id in session_start_times:
            del session_start_times[session_id]
        
        print(f"🛑 Stopped game session: {session_id}")
        return True
    except Exception as e:
        print(f"❌ Error stopping session {session_id}: {e}")
        return False

# Register cleanup handlers
atexit.register(cleanup_all_sessions)
signal.signal(signal.SIGINT, lambda s, f: cleanup_all_sessions())
signal.signal(signal.SIGTERM, lambda s, f: cleanup_all_sessions())