"""Configuration management for Flask backend."""

import os
import sys
from pathlib import Path

# Add parent directory to Python path for shared imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def get_config():
    """Get configuration from environment or shared config."""
    try:
        from config import SERVICE_CONFIG  # type: ignore
        return SERVICE_CONFIG
    except ImportError:
        # Fallback configuration if shared config unavailable
        return {
            'FLASK_PORT': int(os.environ.get('PORT', 5001)),
            'ALLOWED_ORIGINS': [
                "http://localhost:5000",
                "http://localhost:3000", 
                "http://127.0.0.1:5000",
                "http://127.0.0.1:3000"
            ],
            'GAME': {
                'MAX_CONCURRENT_SESSIONS': int(os.environ.get('MAX_CONCURRENT_SESSIONS', 10)),
                'MAX_SESSION_TIME': int(os.environ.get('MAX_SESSION_TIME', 300)),
                'MAX_CODE_SIZE': int(os.environ.get('MAX_CODE_SIZE', 50000)),
                'STREAM_FPS': int(os.environ.get('STREAM_FPS', 15))
            },
            'RATE_LIMITS': {
                'GENERAL': {
                    'MAX': int(os.environ.get('RATE_LIMIT_GENERAL', 100)),
                    'WINDOW_MS': 60000  # 1 minute
                },
                'GAME_EXECUTION': {
                    'MAX': int(os.environ.get('RATE_LIMIT_EXECUTION', 10)),
                    'WINDOW_MS': 60000
                },
                'STRICT': {
                    'MAX': int(os.environ.get('RATE_LIMIT_STRICT', 20)),
                    'WINDOW_MS': 60000
                }
            },
            'SECURITY': {
                'JWT_SECRET': os.environ.get('JWT_SECRET', 'dev-secret-change-in-production')
            }
        }