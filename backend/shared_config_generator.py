"""
Generate Python configuration from shared TypeScript config
This ensures consistency between Express and Flask services
"""

import os


def generate_python_config():
    """Generate Python config equivalent to shared/config.ts"""
    
    # Read environment variables with defaults
    express_port = int(os.environ.get('PORT', '5000'))
    flask_port = int(os.environ.get('FLASK_PORT', '5001'))
    flask_url = os.environ.get('FLASK_URL', 'http://localhost:5001')
    
    # In production Docker, Flask URL should be internal
    if os.environ.get('FLASK_ENV') == 'production':
        flask_url = 'http://flask:5001'
    
    # Generate allowed origins for production
    allowed_origins_env = os.environ.get('ALLOWED_ORIGINS', '')
    if allowed_origins_env:
        allowed_origins = [origin.strip() for origin in allowed_origins_env.split(',')]
    else:
        # Default origins for development
        allowed_origins = [
            'http://localhost:5000',
            'http://localhost:5173', 
            'http://127.0.0.1:5000',
            'https://*.replit.dev',
            'https://*.repl.co'
        ]
    
    config_content = f'''# Auto-generated from shared/config.ts - DO NOT EDIT MANUALLY
import os

SERVICE_CONFIG = {{
    'EXPRESS_PORT': {express_port},
    'FLASK_PORT': {flask_port},
    'FLASK_URL': '{flask_url}',
    'RATE_LIMITS': {{
        'GENERAL': {{
            'WINDOW_MS': 900000,  # 15 minutes
            'MAX': 100
        }},
        'STRICT': {{
            'WINDOW_MS': 900000,  # 15 minutes
            'MAX': 20
        }},
        'GAME_EXECUTION': {{
            'WINDOW_MS': 900000,  # 15 minutes
            'MAX': 10
        }}
    }},
    'GAME': {{
        'MAX_CONCURRENT_SESSIONS': int(os.environ.get('MAX_CONCURRENT_SESSIONS', '10')),
        'MAX_SESSION_TIME': int(os.environ.get('MAX_SESSION_TIME', '300')),
        'MAX_CODE_SIZE': int(os.environ.get('MAX_CODE_SIZE', '100000')),
        'SCREEN_WIDTH': 800,
        'SCREEN_HEIGHT': 600,
        'FPS': 60,
        'STREAM_FPS': 30
    }},
    'ALLOWED_ORIGINS': {allowed_origins},
    'SECURITY': {{
        'JWT_SECRET': os.environ.get('JWT_SECRET', 'dev-secret-change-in-production'),
        'JWT_EXPIRY': '1h',
        'SESSION_TIMEOUT': 3600
    }}
}}

# Production-specific overrides
if os.environ.get('FLASK_ENV') == 'production':
    # Stricter limits in production
    SERVICE_CONFIG['GAME']['MAX_CONCURRENT_SESSIONS'] = min(
        SERVICE_CONFIG['GAME']['MAX_CONCURRENT_SESSIONS'], 5
    )
    SERVICE_CONFIG['GAME']['MAX_SESSION_TIME'] = min(
        SERVICE_CONFIG['GAME']['MAX_SESSION_TIME'], 300
    )
'''
    
    return config_content


if __name__ == '__main__':
    print(generate_python_config())