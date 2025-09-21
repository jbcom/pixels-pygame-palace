"""
Shared configuration loader for Flask service
Reads from shared/config.json with environment overrides
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, List
from dataclasses import dataclass, field
from functools import cached_property

@dataclass
class RateLimit:
    window_ms: int
    max: int

@dataclass
class GameConfig:
    max_concurrent_sessions: int
    max_session_time: int
    max_code_size: int
    screen_width: int
    screen_height: int
    fps: int
    stream_fps: int

@dataclass
class ServiceConfig:
    """Type-safe configuration loader"""
    _raw_config: Dict[str, Any] = field(repr=False)

    @classmethod
    def load(cls) -> 'ServiceConfig':
        """Load configuration from JSON with environment overrides"""
        config_path = Path(__file__).parent.parent / 'shared' / 'config.json'

        with open(config_path) as f:
            config = json.load(f)

        # Apply environment overrides
        if port := os.getenv('PORT'):
            config['services']['express']['port'] = int(port)

        if flask_port := os.getenv('FLASK_PORT'):
            config['services']['flask']['port'] = int(flask_port)

        if flask_url := os.getenv('FLASK_URL'):
            config['services']['flask']['url'] = flask_url

        # Production adjustments
        if os.getenv('FLASK_ENV') == 'production':
            config['game']['maxConcurrentSessions'] = min(
                config['game']['maxConcurrentSessions'], 5
            )
            config['services']['flask']['url'] = 'http://flask:5001'

        return cls(_raw_config=config)

    @cached_property
    def express_port(self) -> int:
        return self._raw_config['services']['express']['port']

    @cached_property
    def flask_port(self) -> int:
        return self._raw_config['services']['flask']['port']

    @cached_property
    def flask_url(self) -> str:
        return self._raw_config['services']['flask']['url']

    @cached_property
    def rate_limits(self) -> Dict[str, RateLimit]:
        return {
            'general': RateLimit(
                window_ms=self._raw_config['rateLimits']['general']['windowMs'],
                max=self._raw_config['rateLimits']['general']['max']
            ),
            'strict': RateLimit(
                window_ms=self._raw_config['rateLimits']['strict']['windowMs'],
                max=self._raw_config['rateLimits']['strict']['max']
            ),
            'game_execution': RateLimit(
                window_ms=self._raw_config['rateLimits']['gameExecution']['windowMs'],
                max=self._raw_config['rateLimits']['gameExecution']['max']
            )
        }

    @cached_property
    def game(self) -> GameConfig:
        game = self._raw_config['game']
        return GameConfig(
            max_concurrent_sessions=game['maxConcurrentSessions'],
            max_session_time=game['maxSessionTime'],
            max_code_size=game['maxCodeSize'],
            screen_width=game['screenWidth'],
            screen_height=game['screenHeight'],
            fps=game['fps'],
            stream_fps=game['streamFps']
        )

    @cached_property
    def allowed_origins(self) -> List[str]:
        return self._raw_config['cors']['allowedOrigins']

    @cached_property
    def jwt_secret(self) -> str:
        return os.getenv('JWT_SECRET', 'dev-secret-change-in-production')

    @cached_property
    def jwt_expiry(self) -> str:
        return self._raw_config['security']['jwtExpiry']

    @cached_property
    def session_timeout(self) -> int:
        return self._raw_config['security']['sessionTimeout']

# Global config instance
SERVICE_CONFIG = ServiceConfig.load()

# For backward compatibility
RATE_LIMITS = SERVICE_CONFIG.rate_limits
GAME = SERVICE_CONFIG.game
ALLOWED_ORIGINS = SERVICE_CONFIG.allowed_origins