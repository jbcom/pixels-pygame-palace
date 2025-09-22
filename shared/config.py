"""Root-level configuration module that unifies Express and Flask config access.

This module loads the shared/config.json and exports it as SERVICE_CONFIG
for Flask to import, ensuring both systems use the same configuration source.
"""

import json
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict


def load_shared_config() -> Dict[str, Any]:
    """Load configuration from shared/config.json."""
    config_path = Path(__file__).parent / "config.json"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Shared config file not found at {config_path}")
    
    with open(config_path, 'r') as f:
        return json.load(f)


def transform_config_for_flask(config: Dict[str, Any]) -> Dict[str, Any]:
    """Transform shared config to Flask-compatible format with environment overrides."""
    
    # Apply environment variable overrides
    transformed = {
        'services': {
            'express': {
                'port': int(os.environ.get('PORT', config['services']['express']['port']))
            },
            'flask': {
                'port': int(os.environ.get('FLASK_PORT', config['services']['flask']['port'])),
                'url': os.environ.get('FLASK_URL', config['services']['flask']['url'])
            }
        },
        'rate_limits': config['rate_limits'],  # Use snake_case version
        'rateLimits': config['rateLimits'],    # Keep camelCase for compatibility
        'game': config['game'],
        'cors': config['cors'],
        'security': {
            **config['security'],
            'jwtSecret': os.environ.get('JWT_SECRET', config['security'].get('jwtSecret') or 'dev-secret-change-in-production'),
            'jwt_secret': os.environ.get('JWT_SECRET', config['security'].get('jwtSecret') or 'dev-secret-change-in-production')
        },
        
        # Flask-specific mappings for backward compatibility
        'flask_port': int(os.environ.get('FLASK_PORT', config['services']['flask']['port'])),
        'allowed_origins': config['cors']['allowedOrigins'],
        
        # Add additional Flask-specific config that may not be in shared config
        'compiler': {
            'cache_dir': os.environ.get('COMPILER_CACHE_DIR', '/tmp/game_cache'),
            'output_dir': os.environ.get('COMPILER_OUTPUT_DIR', '/tmp/game_builds'),
            'max_compilation_time': int(os.environ.get('MAX_COMPILATION_TIME', 300)),
            'cleanup_interval': int(os.environ.get('CLEANUP_INTERVAL', 3600)),
            'max_cached_builds': int(os.environ.get('MAX_CACHED_BUILDS', 100)),
            'enable_web_builds': os.environ.get('ENABLE_WEB_BUILDS', 'true').lower() == 'true',
            'enable_desktop_builds': os.environ.get('ENABLE_DESKTOP_BUILDS', 'true').lower() == 'true'
        },
        'assets': {
            'cache_dir': os.environ.get('ASSET_CACHE_DIR', '/tmp/asset_cache'),
            'max_cache_size': int(os.environ.get('MAX_ASSET_CACHE_SIZE', 1073741824)),  # 1GB
            'image_quality': int(os.environ.get('IMAGE_QUALITY', 85)),
            'max_image_size': tuple(map(int, os.environ.get('MAX_IMAGE_SIZE', '1024,1024').split(','))),
        }
    }
    
    return transformed


def dict_to_namespace(d: Any) -> Any:
    """Recursively convert dict to SimpleNamespace for attribute access."""
    if isinstance(d, dict):
        namespace = SimpleNamespace()
        for key, value in d.items():
            # Set the original key
            setattr(namespace, key, dict_to_namespace(value))
            
            # Also set snake_case version for Flask compatibility
            snake_case_key = camel_to_snake(key)
            if snake_case_key != key:
                setattr(namespace, snake_case_key, dict_to_namespace(value))
                
            # For certain keys, also set specific Flask-expected names
            if key == 'jwtSecret':
                setattr(namespace, 'jwt_secret', value)
            elif key == 'maxConcurrentSessions':
                setattr(namespace, 'max_concurrent_sessions', value)
            elif key == 'maxSessionTime':
                setattr(namespace, 'max_session_time', value)
            elif key == 'maxCodeSize':
                setattr(namespace, 'max_code_size', value)
            elif key == 'streamFps':
                setattr(namespace, 'stream_fps', value)
            elif key == 'allowedOrigins':
                setattr(namespace, 'allowed_origins', value)
                
        return namespace
    elif isinstance(d, list):
        return [dict_to_namespace(item) for item in d]
    else:
        return d


def camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    import re
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()


# Load and transform the shared configuration
try:
    _raw_config = load_shared_config()
    _flask_config = transform_config_for_flask(_raw_config)
    
    # Export as SERVICE_CONFIG for Flask to import
    SERVICE_CONFIG = dict_to_namespace(_flask_config)
    
    # Also export the raw config for other uses
    RAW_CONFIG = _raw_config
    
except Exception as e:
    print(f"❌ Failed to load shared config: {e}")
    print("⚠️  Flask will fall back to environment-based configuration")
    
    # Provide a minimal fallback to prevent import errors
    SERVICE_CONFIG = SimpleNamespace()
    RAW_CONFIG = {}


def get_config():
    """Get configuration - compatibility function for Flask backend."""
    return SERVICE_CONFIG