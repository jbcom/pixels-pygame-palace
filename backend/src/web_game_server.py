"""
Web game serving infrastructure for hosting pygbag-compiled games.
Handles static file serving, CORS, and game asset management.
"""

import os
import mimetypes
from flask import Flask, send_file, send_from_directory, jsonify, abort, Response
from werkzeug.exceptions import NotFound
from typing import Optional, Dict, Any


class WebGameServer:
    """Manages serving of compiled web games."""
    
    def __init__(self, app: Flask, compiled_games_dir: str):
        self.app = app
        self.compiled_games_dir = compiled_games_dir
        self._setup_mime_types()
        self._register_routes()
    
    def _setup_mime_types(self):
        """Setup MIME types for web game assets."""
        # Add WebAssembly MIME type
        mimetypes.add_type('application/wasm', '.wasm')
        # Add other game-specific MIME types
        mimetypes.add_type('application/javascript', '.js')
        mimetypes.add_type('text/html', '.html')
        mimetypes.add_type('text/css', '.css')
        mimetypes.add_type('application/json', '.json')
        mimetypes.add_type('image/png', '.png')
        mimetypes.add_type('image/jpeg', '.jpg')
        mimetypes.add_type('image/gif', '.gif')
        mimetypes.add_type('audio/mpeg', '.mp3')
        mimetypes.add_type('audio/wav', '.wav')
        mimetypes.add_type('audio/ogg', '.ogg')
    
    def _register_routes(self):
        """Register web game serving routes."""
        
        @self.app.route('/web-games/<game_id>/')
        @self.app.route('/web-games/<game_id>/<path:filename>')
        def serve_web_game(game_id: str, filename: str = 'index.html'):
            """Serve web game files."""
            return self._serve_game_file(game_id, filename)
        
        @self.app.route('/api/web-games/<game_id>/manifest')
        def get_game_manifest(game_id: str):
            """Get game manifest/metadata."""
            return self._get_game_manifest(game_id)
        
        @self.app.route('/api/web-games')
        def list_web_games():
            """List available web games."""
            return self._list_available_games()
        
        @self.app.route('/api/web-games/<game_id>/delete', methods=['DELETE'])
        def delete_web_game(game_id: str):
            """Delete a web game."""
            return self._delete_game(game_id)
    
    def _serve_game_file(self, game_id: str, filename: str) -> Response:
        """Serve a specific file from a compiled game."""
        try:
            game_dir = os.path.join(self.compiled_games_dir, game_id)
            
            if not os.path.exists(game_dir):
                abort(404, description=f"Game {game_id} not found")
            
            # Security: Prevent directory traversal
            safe_path = os.path.normpath(filename)
            if safe_path.startswith('..') or os.path.isabs(safe_path):
                abort(403, description="Access denied")
            
            file_path = os.path.join(game_dir, safe_path)
            
            if not os.path.exists(file_path):
                # Try common fallback files
                fallback_files = ['index.html', 'main.html', f'{game_id}.html']
                for fallback in fallback_files:
                    fallback_path = os.path.join(game_dir, fallback)
                    if os.path.exists(fallback_path):
                        file_path = fallback_path
                        break
                else:
                    abort(404, description=f"File {filename} not found")
            
            # Get MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type is None:
                mime_type = 'application/octet-stream'
            
            # Set appropriate headers for web games
            response = send_file(
                file_path,
                mimetype=mime_type,
                as_attachment=False
            )
            
            # Add CORS headers for cross-origin requests
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            
            # Add headers for WebAssembly and JavaScript files
            if file_path.endswith('.wasm'):
                response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
                response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
            
            if file_path.endswith('.js'):
                response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'
            
            # Add security headers
            if file_path.endswith('.html'):
                response.headers['X-Content-Type-Options'] = 'nosniff'
                response.headers['X-Frame-Options'] = 'SAMEORIGIN'
                response.headers['Content-Security-Policy'] = (
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; "
                    "style-src 'self' 'unsafe-inline'; "
                    "img-src 'self' data: blob:; "
                    "connect-src 'self' blob:; "
                    "worker-src 'self' blob:; "
                    "font-src 'self' data:;"
                )
            
            return response
            
        except Exception as e:
            print(f"Error serving game file {game_id}/{filename}: {e}")
            abort(500, description="Internal server error")
    
    def _get_game_manifest(self, game_id: str) -> Response:
        """Get game manifest/metadata."""
        try:
            game_dir = os.path.join(self.compiled_games_dir, game_id)
            
            if not os.path.exists(game_dir):
                return jsonify({'error': f'Game {game_id} not found'}), 404
            
            # Look for manifest files
            manifest_files = ['manifest.json', 'pygbag.toml', 'package.json']
            manifest_data = {}
            
            for manifest_file in manifest_files:
                manifest_path = os.path.join(game_dir, manifest_file)
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r') as f:
                            if manifest_file.endswith('.json'):
                                import json
                                manifest_data.update(json.load(f))
                            elif manifest_file.endswith('.toml'):
                                # Simple TOML parsing for pygbag config
                                content = f.read()
                                manifest_data['config'] = content
                    except Exception as e:
                        print(f"Error reading manifest {manifest_file}: {e}")
            
            # Add directory information
            files = []
            for root, dirs, filenames in os.walk(game_dir):
                for filename in filenames:
                    rel_path = os.path.relpath(os.path.join(root, filename), game_dir)
                    file_size = os.path.getsize(os.path.join(root, filename))
                    files.append({
                        'path': rel_path,
                        'size': file_size,
                        'type': mimetypes.guess_type(filename)[0] or 'unknown'
                    })
            
            manifest_data.update({
                'game_id': game_id,
                'files': files,
                'total_files': len(files),
                'total_size': sum(f['size'] for f in files),
                'created': os.path.getctime(game_dir),
                'modified': os.path.getmtime(game_dir)
            })
            
            return jsonify(manifest_data)
            
        except Exception as e:
            return jsonify({'error': f'Error getting manifest: {str(e)}'}), 500
    
    def _list_available_games(self) -> Response:
        """List all available web games."""
        try:
            if not os.path.exists(self.compiled_games_dir):
                return jsonify({'games': []})
            
            games = []
            for item in os.listdir(self.compiled_games_dir):
                game_dir = os.path.join(self.compiled_games_dir, item)
                if os.path.isdir(game_dir):
                    # Get basic game info
                    game_info = {
                        'id': item,
                        'url': f'/web-games/{item}/',
                        'created': os.path.getctime(game_dir),
                        'modified': os.path.getmtime(game_dir),
                        'size': self._get_directory_size(game_dir)
                    }
                    
                    # Try to get title from HTML file
                    html_files = [f for f in os.listdir(game_dir) if f.endswith('.html')]
                    if html_files:
                        html_path = os.path.join(game_dir, html_files[0])
                        try:
                            with open(html_path, 'r') as f:
                                content = f.read()
                                import re
                                title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
                                if title_match:
                                    game_info['title'] = title_match.group(1)
                        except:
                            pass
                    
                    games.append(game_info)
            
            # Sort by modification time (newest first)
            games.sort(key=lambda x: x['modified'], reverse=True)
            
            return jsonify({
                'games': games,
                'total': len(games)
            })
            
        except Exception as e:
            return jsonify({'error': f'Error listing games: {str(e)}'}), 500
    
    def _delete_game(self, game_id: str) -> Response:
        """Delete a compiled web game."""
        try:
            game_dir = os.path.join(self.compiled_games_dir, game_id)
            
            if not os.path.exists(game_dir):
                return jsonify({'error': f'Game {game_id} not found'}), 404
            
            import shutil
            shutil.rmtree(game_dir)
            
            return jsonify({
                'success': True,
                'message': f'Game {game_id} deleted successfully'
            })
            
        except Exception as e:
            return jsonify({'error': f'Error deleting game: {str(e)}'}), 500
    
    def _get_directory_size(self, directory: str) -> int:
        """Get total size of directory in bytes."""
        total_size = 0
        try:
            for dirpath, dirnames, filenames in os.walk(directory):
                for filename in filenames:
                    file_path = os.path.join(dirpath, filename)
                    total_size += os.path.getsize(file_path)
        except:
            pass
        return total_size


def setup_web_game_server(app: Flask, compiled_games_dir: str) -> WebGameServer:
    """Setup web game server for the Flask app."""
    return WebGameServer(app, compiled_games_dir)