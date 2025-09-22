"""Configuration management for Flask backend."""

import os
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, Any, Union, Protocol, cast
from types import SimpleNamespace

# Add project root to Python path for shared imports  
project_root = Path(__file__).parent.parent.parent
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
        from config import SERVICE_CONFIG  # type: ignore
        # Convert to SimpleNamespace if it's a plain dict
        if isinstance(SERVICE_CONFIG, dict):
            return cast(ConfigProtocol, _dict_to_namespace(SERVICE_CONFIG))
        return cast(ConfigProtocol, SERVICE_CONFIG)
    except ImportError:
        # Fallback configuration if shared config unavailable
        config_dict = {
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
            'COMPILER': {
                'CACHE_DIR': os.environ.get('COMPILER_CACHE_DIR', '/tmp/game_cache'),
                'OUTPUT_DIR': os.environ.get('COMPILER_OUTPUT_DIR', '/tmp/game_builds'),
                'MAX_COMPILATION_TIME': int(os.environ.get('MAX_COMPILATION_TIME', 300)),
                'CLEANUP_INTERVAL': int(os.environ.get('CLEANUP_INTERVAL', 3600)),
                'MAX_CACHED_BUILDS': int(os.environ.get('MAX_CACHED_BUILDS', 100)),
                'ENABLE_WEB_BUILDS': os.environ.get('ENABLE_WEB_BUILDS', 'true').lower() == 'true',
                'ENABLE_DESKTOP_BUILDS': os.environ.get('ENABLE_DESKTOP_BUILDS', 'true').lower() == 'true'
            },
            'ASSETS': {
                'CACHE_DIR': os.environ.get('ASSET_CACHE_DIR', '/tmp/asset_cache'),
                'MAX_CACHE_SIZE': int(os.environ.get('MAX_ASSET_CACHE_SIZE', 1073741824)),  # 1GB
                'IMAGE_QUALITY': int(os.environ.get('IMAGE_QUALITY', 85)),
                'MAX_IMAGE_SIZE': tuple(map(int, os.environ.get('MAX_IMAGE_SIZE', '1024,1024').split(','))),
            },
            'rate_limits': {
                'general': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_GENERAL', 100)),
                    window_ms=60000  # 1 minute
                ),
                'game_execution': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_EXECUTION', 10)),
                    window_ms=60000
                ),
                'compilation': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_COMPILATION', 5)),
                    window_ms=60000
                ),
                'strict': RateLimitConfig(
                    max=int(os.environ.get('RATE_LIMIT_STRICT', 20)),
                    window_ms=60000
                )
            },
            'SECURITY': {
                'JWT_SECRET': os.environ.get('JWT_SECRET', 'dev-secret-change-in-production')
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