"""Authentication and authorization utilities."""

import jwt
from datetime import datetime
from functools import wraps
from flask import request, jsonify

try:
    from .config import get_config
except ImportError:
    from config import get_config

def verify_token(f):
    """Verify JWT token from Express backend."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        config = get_config()
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            # Verify the JWT token
            payload = jwt.decode(
                token, 
                config['SECURITY']['JWT_SECRET'],
                algorithms=['HS256']
            )
            
            # Check if token has expired
            if 'exp' in payload:
                if datetime.utcnow().timestamp() > payload['exp']:
                    return jsonify({'error': 'Token has expired'}), 401
            
            # Add user info to request context
            setattr(request, 'user', payload.get('user'))
            setattr(request, 'session_id', payload.get('session_id'))
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    return decorated_function