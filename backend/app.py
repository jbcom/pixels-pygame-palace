#!/usr/bin/env python3
"""Main Flask application entry point for Pixel's PyGame Palace backend."""

import os
from src.app import create_app
from src.websocket_handlers import register_websocket_handlers

# Create Flask application
app, socketio = create_app()

# Register WebSocket event handlers
register_websocket_handlers(socketio)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_ENV') != 'production'
    
    print(f"🚀 Starting Pygame Execution Backend on port {port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"🌍 Environment: {os.environ.get('FLASK_ENV', 'development')}")
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=debug,
        use_reloader=False,  # Disable reloader to prevent double startup
        log_output=True
    )