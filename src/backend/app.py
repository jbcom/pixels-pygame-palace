"""Flask application factory and configuration."""

import os
import secrets
from datetime import timedelta
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from .config import get_config
from .routes import register_api_routes
from .models import extend_request_class


def create_app():
    """Create and configure Flask application."""
    app = Flask(__name__)
    
    # Apply Flask Request extensions
    extend_request_class()
    
    # Load configuration
    config = get_config()
    
    # Security: Generate secure SECRET_KEY
    if os.environ.get('FLASK_ENV') == 'production':
        if not os.environ.get('FLASK_SECRET_KEY'):
            raise RuntimeError("FLASK_SECRET_KEY environment variable is required in production")
        app.config['SECRET_KEY'] = os.environ['FLASK_SECRET_KEY']
    else:
        app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))

    # Session security settings
    app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

    # Configure CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": config.allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    # Initialize rate limiter
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=[
            f"{config.rate_limits['general'].max} per {config.rate_limits['general'].window_ms//1000} seconds"
        ]
    )

    # Initialize SocketIO
    socketio = SocketIO(
        app, 
        cors_allowed_origins=config.allowed_origins,
        async_mode='threading',
        logger=False,
        engineio_logger=False
    )

    # Register API routes
    register_api_routes(app, limiter, socketio)

    return app, socketio