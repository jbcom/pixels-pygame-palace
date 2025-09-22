"""Configuration management for Flask backend."""

import os
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, Any, Union, Protocol, cast
from types import SimpleNamespace

# Add project root to Python path for shared imports  
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@dataclass
class RateLimitConfig:
    """Rate limit configuration for a specific endpoint type."""
    max: int
    window_ms: int
    
    @property
    def window_seconds(self) -> int:
        """Get window in seconds for limiter expressions."""
        return self.window_ms // 1000


class ConfigProtocol(Protocol):
    """Protocol describing the expected configuration structure."""
    flask_port: int
    allowed_origins: list[str]
    
    class game:
        max_concurrent_sessions: int
        max_session_time: int
        max_code_size: int
        stream_fps: int
    
    class compiler:
        cache_dir: str
        output_dir: str
        max_compilation_time: int
        cleanup_interval: int
        max_cached_builds: int
        enable_web_builds: bool
        enable_desktop_builds: bool
    
    class rate_limits:
        general: RateLimitConfig
        game_execution: RateLimitConfig
        compilation: RateLimitConfig
        strict: RateLimitConfig


class ConfigValidator:
    """Validates configuration structure and content."""
    
    @staticmethod
    def validate_rate_limits(rate_limits: Dict[str, RateLimitConfig]) -> None:
        """Validate that all required rate limit keys exist and are properly configured."""
        required_keys = {'general', 'game_execution', 'compilation', 'strict'}
        existing_keys = set(rate_limits.keys())
        
        missing_keys = required_keys - existing_keys
        if missing_keys:
            raise ValueError(f"Missing required rate limit configurations: {missing_keys}")
        
        for key, config in rate_limits.items():
            if not isinstance(config, RateLimitConfig):
                raise ValueError(f"Rate limit '{key}' must be a RateLimitConfig instance")
            if config.max <= 0:
                raise ValueError(f"Rate limit '{key}' max must be positive")
            if config.window_ms <= 0:
                raise ValueError(f"Rate limit '{key}' window_ms must be positive")

def get_config() -> ConfigProtocol:
    """Get configuration from environment or shared config."""
    try:
        # Import from root config.py by adding parent to path temporarily
        import sys
        from pathlib import Path
        root_path = str(Path(__file__).parent.parent)
        if root_path not in sys.path:
            sys.path.insert(0, root_path)
        
        # Import the shared config module
        import importlib.util
        config_path = Path(__file__).parent.parent.parent / 'shared' / 'config.py'
        spec = importlib.util.spec_from_file_location("root_config", config_path)
        root_config = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(root_config)
        
        SERVICE_CONFIG = root_config.SERVICE_CONFIG
        
        # SERVICE_CONFIG should already be a SimpleNamespace from the root config module
        if hasattr(SERVICE_CONFIG, 'rate_limits'):
            print("✅ Successfully loaded shared configuration")
            
            # Convert rate limit dicts to RateLimitConfig objects for compatibility
            if hasattr(SERVICE_CONFIG.rate_limits, 'general') and not isinstance(SERVICE_CONFIG.rate_limits.general, RateLimitConfig):
                SERVICE_CONFIG.rate_limits.general = RateLimitConfig(
                    max=SERVICE_CONFIG.rate_limits.general.max,
                    window_ms=getattr(SERVICE_CONFIG.rate_limits.general, 'window_ms', SERVICE_CONFIG.rate_limits.general.windowMs)
                )
            if hasattr(SERVICE_CONFIG.rate_limits, 'game_execution') and not isinstance(SERVICE_CONFIG.rate_limits.game_execution, RateLimitConfig):
                SERVICE_CONFIG.rate_limits.game_execution = RateLimitConfig(
                    max=SERVICE_CONFIG.rate_limits.game_execution.max,
                    window_ms=getattr(SERVICE_CONFIG.rate_limits.game_execution, 'window_ms', SERVICE_CONFIG.rate_limits.game_execution.windowMs)
                )
            if hasattr(SERVICE_CONFIG.rate_limits, 'compilation') and not isinstance(SERVICE_CONFIG.rate_limits.compilation, RateLimitConfig):
                SERVICE_CONFIG.rate_limits.compilation = RateLimitConfig(
                    max=SERVICE_CONFIG.rate_limits.compilation.max,
                    window_ms=getattr(SERVICE_CONFIG.rate_limits.compilation, 'window_ms', SERVICE_CONFIG.rate_limits.compilation.windowMs)
                )
            if hasattr(SERVICE_CONFIG.rate_limits, 'strict') and not isinstance(SERVICE_CONFIG.rate_limits.strict, RateLimitConfig):
                SERVICE_CONFIG.rate_limits.strict = RateLimitConfig(
                    max=SERVICE_CONFIG.rate_limits.strict.max,
                    window_ms=getattr(SERVICE_CONFIG.rate_limits.strict, 'window_ms', SERVICE_CONFIG.rate_limits.strict.windowMs)
                )
            
            return cast(ConfigProtocol, SERVICE_CONFIG)
        else:
            print("⚠️  SERVICE_CONFIG missing rate_limits, falling back")
            raise ImportError("Invalid SERVICE_CONFIG structure")
            
    except ImportError as e:
        print(f"⚠️  Failed to import shared config: {e}")
        print("🔄 Using fallback configuration")
        
        # Fallback configuration if shared config unavailable
        config_dict = {
            'flask_port': int(os.environ.get('FLASK_PORT', 5001)),
            'allowed_origins': [
                "http://localhost:5000",
                "http://localhost:5173",
                "http://127.0.0.1:5000",
                "https://*.replit.dev",
                "https://*.repl.co"
            ],
            'services': {
                'flask': {
                    'port': int(os.environ.get('FLASK_PORT', 5001)),
                    'url': os.environ.get('FLASK_URL', 'http://localhost:5001')
                }
            },
            'game': {
                'max_concurrent_sessions': int(os.environ.get('MAX_CONCURRENT_SESSIONS', 10)),
                'max_session_time': int(os.environ.get('MAX_SESSION_TIME', 300)),
                'max_code_size': int(os.environ.get('MAX_CODE_SIZE', 100000)),
                'stream_fps': int(os.environ.get('STREAM_FPS', 30))
            },
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
            },
            'rate_limits': {
                'general': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_GENERAL', 100)),
                    window_ms=900000  # 15 minutes to match shared config
                ),
                'game_execution': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_EXECUTION', 10)),
                    window_ms=900000
                ),
                'compilation': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_COMPILATION', 5)),
                    window_ms=900000
                ),
                'strict': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_STRICT', 20)),
                    window_ms=900000
                )
            },
            'security': {
                'jwt_secret': os.environ.get('JWT_SECRET', 'dev-secret-change-in-production'),
                'jwt_expiry': '1h',
                'session_timeout': 3600
            },
            'cors': {
                'allowed_origins': [
                    "http://localhost:5000",
                    "http://localhost:5173",
                    "http://127.0.0.1:5000",
                    "https://*.replit.dev",
                    "https://*.repl.co"
                ]
            }
        }
        
        # Validate the configuration before converting to namespace
        try:
            ConfigValidator.validate_rate_limits(config_dict['rate_limits'])
        except Exception as e:
            print(f"❌ Configuration validation failed: {e}")
            # Don't raise in production, use fallback
        
        # Convert dict to SimpleNamespace for attribute access
        return cast(ConfigProtocol, _dict_to_namespace(config_dict))


def _dict_to_namespace(d):
    """Recursively convert dict to SimpleNamespace for attribute access."""
    if isinstance(d, dict):
        namespace = SimpleNamespace()
        for key, value in d.items():
            # Convert keys to attribute-friendly names
            attr_name = key.lower() if key.isupper() else key
            setattr(namespace, attr_name, _dict_to_namespace(value))
        return namespace
    elif isinstance(d, list):
        return [_dict_to_namespace(item) for item in d]
    else:
        return d