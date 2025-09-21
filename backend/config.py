# Auto-generated from shared/config.ts - DO NOT EDIT MANUALLY
import os

SERVICE_CONFIG = {
    'EXPRESS_PORT': 5000,
    'FLASK_PORT': 5001,
    'FLASK_URL': 'http://localhost:5001',
    'RATE_LIMITS': {
        'GENERAL': {
            'WINDOW_MS': 900000,
            'MAX': 100
        },
        'STRICT': {
            'WINDOW_MS': 900000,
            'MAX': 20
        },
        'GAME_EXECUTION': {
            'WINDOW_MS': 900000,
            'MAX': 10
        }
    },
    'GAME': {
        'MAX_CONCURRENT_SESSIONS': 10,
        'MAX_SESSION_TIME': 300,
        'MAX_CODE_SIZE': 100000,
        'SCREEN_WIDTH': 800,
        'SCREEN_HEIGHT': 600,
        'FPS': 60,
        'STREAM_FPS': 30
    },
    'ALLOWED_ORIGINS': ["http://localhost:5000", "http://localhost:5173", "http://127.0.0.1:5000", "https://*.replit.dev", "https://*.repl.co"],
    'SECURITY': {
        'JWT_SECRET': os.environ.get('JWT_SECRET', 'dev-secret-change-in-production'),
        'JWT_EXPIRY': '1h',
        'SESSION_TIMEOUT': 3600
    }
}