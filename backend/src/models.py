"""Data models and Flask extensions."""

from flask import Request

def extend_request_class():
    """Add custom attributes to Flask Request class for type safety."""
    # Add custom attributes for JWT authentication
    if not hasattr(Request, 'user'):
        setattr(Request, 'user', None)
    if not hasattr(Request, 'session_id'):  
        setattr(Request, 'session_id', None)
    if not hasattr(Request, 'sid'):
        setattr(Request, 'sid', None)