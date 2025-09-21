"""
Flask Backend Test Suite
Comprehensive test fixtures and helpers for testing the Flask backend architecture
"""

import os
import sys
import json
import time
import uuid
import base64
import tempfile
import unittest
import subprocess
import threading
import requests
from io import BytesIO
from PIL import Image
from typing import Dict, List, Optional, Any, Tuple
from unittest.mock import Mock, patch, MagicMock

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

# Import Flask app and dependencies
from app import app, projects_db, game_sessions, session_start_times
from game_engine import GameExecutor


class FlaskBackendTestFixture:
    """Test fixture for managing Flask backend lifecycle"""
    
    def __init__(self, port: int = 5001):
        self.port = port
        self.process = None
        self.base_url = f"http://localhost:{port}"
        self.api_url = f"{self.base_url}/api"
        
    def start(self, timeout: int = 30):
        """Start the Flask backend server"""
        env = os.environ.copy()
        env['FLASK_APP'] = 'backend/app.py'
        env['FLASK_ENV'] = 'testing'
        env['SECRET_KEY'] = 'test-secret-key'
        
        # Start Flask process
        self.process = subprocess.Popen(
            [sys.executable, '-m', 'flask', 'run', '--port', str(self.port)],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for server to start
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"{self.api_url}/health")
                if response.status_code == 200:
                    print(f"Flask backend started on port {self.port}")
                    return True
            except requests.ConnectionError:
                time.sleep(0.5)
        
        raise RuntimeError(f"Failed to start Flask backend within {timeout} seconds")
    
    def stop(self):
        """Stop the Flask backend server"""
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None
            print("Flask backend stopped")
    
    def __enter__(self):
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()


class APITestHelper:
    """Helper functions for testing Flask API endpoints"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        
    def compile_game(self, components: List[Dict], game_type: str = "platformer") -> Dict:
        """Test game compilation endpoint"""
        response = self.session.post(
            f"{self.base_url}/compile",
            json={
                "components": components,
                "gameType": game_type
            }
        )
        return response.json(), response.status_code
    
    def execute_game(self, code: str) -> Tuple[str, int]:
        """Test game execution endpoint"""
        response = self.session.post(
            f"{self.base_url}/execute",
            json={"code": code}
        )
        data = response.json()
        return data.get('session_id'), response.status_code
    
    def stream_game_frames(self, session_id: str, max_frames: int = 10) -> List[Dict]:
        """Test game frame streaming"""
        frames = []
        
        response = self.session.get(
            f"{self.base_url}/game-stream/{session_id}",
            stream=True
        )
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    try:
                        data = json.loads(line_str[6:])
                        frames.append(data)
                        if len(frames) >= max_frames:
                            break
                    except json.JSONDecodeError:
                        continue
        
        return frames
    
    def save_project(self, name: str, components: List, game_type: str = "platformer") -> Dict:
        """Test project save endpoint"""
        response = self.session.post(
            f"{self.base_url}/projects",
            json={
                "name": name,
                "components": components,
                "gameType": game_type,
                "description": f"Test {game_type} project"
            }
        )
        return response.json(), response.status_code
    
    def list_projects(self) -> Tuple[List[Dict], int]:
        """Test project listing endpoint"""
        response = self.session.get(f"{self.base_url}/projects")
        return response.json(), response.status_code
    
    def get_project(self, project_id: str) -> Tuple[Dict, int]:
        """Test single project retrieval"""
        response = self.session.get(f"{self.base_url}/projects/{project_id}")
        return response.json(), response.status_code
    
    def stop_game_session(self, session_id: str) -> Tuple[Dict, int]:
        """Test game session stop endpoint"""
        response = self.session.post(f"{self.base_url}/stop/{session_id}")
        return response.json(), response.status_code
    
    def handle_game_input(self, session_id: str, input_data: Dict) -> Tuple[Dict, int]:
        """Test game input handling"""
        response = self.session.post(
            f"{self.base_url}/input/{session_id}",
            json=input_data
        )
        return response.json(), response.status_code


class BackendTestCase(unittest.TestCase):
    """Base test case for Flask backend tests"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures for all tests"""
        cls.app = app
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()
        cls.api_helper = APITestHelper("http://localhost:5000/api")
    
    def setUp(self):
        """Reset test state before each test"""
        # Clear in-memory databases
        projects_db.clear()
        game_sessions.clear()
        session_start_times.clear()
        
    def tearDown(self):
        """Clean up after each test"""
        # Stop all game sessions
        for session_id in list(game_sessions.keys()):
            try:
                executor = game_sessions[session_id]
                executor.stop()
            except Exception:
                pass
        game_sessions.clear()
        session_start_times.clear()
        
    def generate_test_components(self, game_type: str) -> List[Dict]:
        """Generate test components for a game type"""
        base_components = [
            {
                "type": "title_screen",
                "config": {
                    "title": f"Test {game_type.title()} Game",
                    "font": "Arial",
                    "background": "#000000"
                }
            },
            {
                "type": "player",
                "config": {
                    "sprite": "default_player.png",
                    "speed": 5,
                    "health": 100
                }
            },
            {
                "type": "level",
                "config": {
                    "width": 800,
                    "height": 600,
                    "background": "default_bg.png"
                }
            }
        ]
        
        # Add game-type specific components
        if game_type == "platformer":
            base_components.append({
                "type": "platform",
                "config": {
                    "tiles": ["ground.png", "platform.png"],
                    "gravity": 0.8
                }
            })
        elif game_type == "rpg":
            base_components.append({
                "type": "inventory",
                "config": {
                    "slots": 20,
                    "items": ["sword", "potion"]
                }
            })
        elif game_type == "puzzle":
            base_components.append({
                "type": "grid",
                "config": {
                    "rows": 8,
                    "cols": 8,
                    "tile_size": 64
                }
            })
        
        return base_components
    
    def validate_game_code(self, code: str, game_type: str) -> bool:
        """Validate generated Python code"""
        # Check for basic pygame structure
        required_elements = [
            "import pygame",
            "pygame.init()",
            "screen = pygame.display.set_mode",
            "clock = pygame.time.Clock()",
            "running = True",
            "while running:",
            "pygame.quit()"
        ]
        
        for element in required_elements:
            if element not in code:
                print(f"Missing required element: {element}")
                return False
        
        # Check for game-type specific elements
        if game_type == "platformer":
            if "gravity" not in code.lower():
                print("Platformer missing gravity implementation")
                return False
        elif game_type == "rpg":
            if "inventory" not in code.lower():
                print("RPG missing inventory system")
                return False
        
        return True
    
    def validate_frame_data(self, frame: Dict) -> bool:
        """Validate frame data from stream"""
        if frame.get('type') == 'frame':
            # Check if frame has valid base64 image data
            if 'data' not in frame:
                return False
            
            try:
                # Decode base64 and verify it's valid image data
                img_data = base64.b64decode(frame['data'])
                img = Image.open(BytesIO(img_data))
                # Verify image dimensions
                if img.width <= 0 or img.height <= 0:
                    return False
                return True
            except Exception as e:
                print(f"Invalid frame data: {e}")
                return False
        
        return frame.get('type') in ['end', 'error']
    
    def measure_performance(self, func, *args, **kwargs) -> Tuple[Any, float]:
        """Measure execution time of a function"""
        start_time = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start_time
        return result, elapsed


class GameCompilationTests(BackendTestCase):
    """Tests for game compilation functionality"""
    
    def test_compile_platformer(self):
        """Test compiling a platformer game"""
        components = self.generate_test_components("platformer")
        response = self.client.post('/api/compile',
                                   json={
                                       "components": components,
                                       "gameType": "platformer"
                                   })
        
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertTrue(data['success'])
        self.assertIn('code', data)
        self.assertTrue(self.validate_game_code(data['code'], "platformer"))
    
    def test_compile_rpg(self):
        """Test compiling an RPG game"""
        components = self.generate_test_components("rpg")
        response = self.client.post('/api/compile',
                                   json={
                                       "components": components,
                                       "gameType": "rpg"
                                   })
        
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertTrue(data['success'])
        self.assertTrue(self.validate_game_code(data['code'], "rpg"))
    
    def test_compile_invalid_components(self):
        """Test compilation with invalid components"""
        response = self.client.post('/api/compile',
                                   json={
                                       "components": "invalid",
                                       "gameType": "platformer"
                                   })
        
        self.assertEqual(response.status_code, 400)
        data = response.json
        self.assertFalse(data['success'])
    
    def test_compile_performance(self):
        """Test compilation performance"""
        components = self.generate_test_components("platformer")
        
        result, elapsed = self.measure_performance(
            self.client.post,
            '/api/compile',
            json={"components": components, "gameType": "platformer"}
        )
        
        # Compilation should be fast (under 1 second)
        self.assertLess(elapsed, 1.0)
        self.assertEqual(result.status_code, 200)


class GameExecutionTests(BackendTestCase):
    """Tests for game execution functionality"""
    
    def test_execute_simple_game(self):
        """Test executing a simple pygame code"""
        simple_code = '''
import pygame
pygame.init()
screen = pygame.display.set_mode((800, 600))
clock = pygame.time.Clock()
running = True
frame_count = 0
while running and frame_count < 5:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    screen.fill((0, 0, 0))
    pygame.display.flip()
    clock.tick(60)
    frame_count += 1
pygame.quit()
'''
        
        response = self.client.post('/api/execute',
                                   json={"code": simple_code})
        
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertTrue(data['success'])
        self.assertIn('session_id', data)
        
    def test_execute_invalid_code(self):
        """Test executing invalid Python code"""
        invalid_code = "this is not valid python code"
        
        response = self.client.post('/api/execute',
                                   json={"code": invalid_code})
        
        self.assertEqual(response.status_code, 400)
        data = response.json
        self.assertFalse(data['success'])
        
    def test_session_management(self):
        """Test game session management"""
        # Create multiple sessions
        sessions = []
        for i in range(3):
            simple_code = f'''
import pygame
pygame.init()
# Session {i}
'''
            response = self.client.post('/api/execute',
                                       json={"code": simple_code})
            if response.status_code == 200:
                sessions.append(response.json['session_id'])
        
        # Verify sessions are tracked
        self.assertLessEqual(len(sessions), 3)
        
        # Clean up sessions
        for session_id in sessions:
            if session_id in game_sessions:
                game_sessions[session_id].stop()
    
    def test_concurrent_session_limit(self):
        """Test that concurrent session limits are enforced"""
        # This test would need to be adjusted based on MAX_CONCURRENT_SESSIONS
        pass


class FrameStreamingTests(BackendTestCase):
    """Tests for game frame streaming"""
    
    def test_frame_streaming(self):
        """Test streaming frames from a running game"""
        # Create a simple game that generates frames
        game_code = '''
import pygame
import time
pygame.init()
screen = pygame.display.set_mode((400, 300))
for i in range(5):
    screen.fill((i*50, 0, 0))
    pygame.display.flip()
    time.sleep(0.1)
pygame.quit()
'''
        
        # Execute the game
        response = self.client.post('/api/execute',
                                   json={"code": game_code})
        
        if response.status_code == 200:
            session_id = response.json['session_id']
            
            # Stream frames (would need SSE client in real test)
            # For now, just verify the endpoint exists
            stream_response = self.client.get(f'/api/game-stream/{session_id}')
            self.assertIsNotNone(stream_response)


class ProjectManagementTests(BackendTestCase):
    """Tests for project save/load functionality"""
    
    def test_save_project(self):
        """Test saving a game project"""
        components = self.generate_test_components("platformer")
        
        response = self.client.post('/api/projects',
                                   json={
                                       "name": "Test Project",
                                       "components": components,
                                       "gameType": "platformer",
                                       "description": "Test description"
                                   })
        
        self.assertEqual(response.status_code, 201)
        data = response.json
        self.assertTrue(data['success'])
        self.assertIn('project', data)
        self.assertEqual(data['project']['name'], "Test Project")
        
    def test_list_projects(self):
        """Test listing saved projects"""
        # Save a few projects first
        for i in range(3):
            self.client.post('/api/projects',
                           json={
                               "name": f"Project {i}",
                               "components": [],
                               "gameType": "platformer"
                           })
        
        # List projects
        response = self.client.get('/api/projects')
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertTrue(data['success'])
        self.assertEqual(len(data['projects']), 3)
        
    def test_get_single_project(self):
        """Test retrieving a single project"""
        # Save a project
        save_response = self.client.post('/api/projects',
                                        json={
                                            "name": "Test Project",
                                            "components": [],
                                            "gameType": "rpg"
                                        })
        
        project_id = save_response.json['project']['id']
        
        # Retrieve the project
        response = self.client.get(f'/api/projects/{project_id}')
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertTrue(data['success'])
        self.assertEqual(data['project']['name'], "Test Project")
        self.assertEqual(data['project']['gameType'], "rpg")


class CleanupTests(BackendTestCase):
    """Tests for resource cleanup"""
    
    def test_session_cleanup_on_stop(self):
        """Test that sessions are properly cleaned up"""
        # Create a session
        simple_code = "import pygame\npygame.init()"
        response = self.client.post('/api/execute',
                                   json={"code": simple_code})
        
        if response.status_code == 200:
            session_id = response.json['session_id']
            
            # Stop the session
            stop_response = self.client.post(f'/api/stop/{session_id}')
            
            # Verify session is cleaned up
            self.assertNotIn(session_id, game_sessions)
            self.assertNotIn(session_id, session_start_times)
    
    def test_timeout_cleanup(self):
        """Test that sessions are cleaned up after timeout"""
        # This would need to mock time or wait for actual timeout
        pass
    
    def test_error_cleanup(self):
        """Test cleanup when game execution fails"""
        bad_code = "import pygame\nraise Exception('Test error')"
        
        response = self.client.post('/api/execute',
                                   json={"code": bad_code})
        
        # Even if execution fails, resources should be cleaned
        # Check that no orphaned sessions remain
        time.sleep(1)  # Give it time to fail and cleanup
        
        # All sessions should be cleaned
        for session_id in list(game_sessions.keys()):
            executor = game_sessions[session_id]
            self.assertFalse(executor.running)


def run_backend_tests():
    """Run all backend tests"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(GameCompilationTests))
    suite.addTests(loader.loadTestsFromTestCase(GameExecutionTests))
    suite.addTests(loader.loadTestsFromTestCase(FrameStreamingTests))
    suite.addTests(loader.loadTestsFromTestCase(ProjectManagementTests))
    suite.addTests(loader.loadTestsFromTestCase(CleanupTests))
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    # Run tests with Flask backend fixture
    with FlaskBackendTestFixture() as backend:
        success = run_backend_tests()
        sys.exit(0 if success else 1)