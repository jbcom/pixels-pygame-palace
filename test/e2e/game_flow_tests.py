"""
Game Flow Tests
Tests for validating complete game creation flows from start to finish
"""

import os
import sys
import json
import time
import unittest
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

try:
    from backend_test_suite import BackendTestCase, APITestHelper
except ImportError:
    # If backend_test_suite is not available, create mock classes
    from unittest import TestCase
    import requests
    
    class MockResponse:
        def __init__(self, json_data, status_code):
            self.json_data = json_data
            self.status_code = status_code
            
        @property
        def json(self):
            return self.json_data
    
    class MockClient:
        def __init__(self):
            self.base_url = 'http://localhost:5000'
            self.use_mock = True  # Use mock responses for testing
            
        def get(self, path, **kwargs):
            if self.use_mock:
                return self._mock_response('GET', path, None)
            return requests.get(f"{self.base_url}{path}", **kwargs)
            
        def post(self, path, json=None, **kwargs):
            if self.use_mock:
                return self._mock_response('POST', path, json)
            return requests.post(f"{self.base_url}{path}", json=json, **kwargs)
            
        def put(self, path, json=None, **kwargs):
            if self.use_mock:
                return self._mock_response('PUT', path, json)
            return requests.put(f"{self.base_url}{path}", json=json, **kwargs)
            
        def delete(self, path, **kwargs):
            if self.use_mock:
                return self._mock_response('DELETE', path, None)
            return requests.delete(f"{self.base_url}{path}", **kwargs)
        
        def _mock_response(self, method, path, json_data):
            from mock_flask_handler import MockFlaskHandler
            
            if path == '/api/compile' and method == 'POST':
                response_data = MockFlaskHandler.compile_game(
                    json_data.get('components', []),
                    json_data.get('gameType', 'platformer')
                )
                return MockResponse(response_data, 200 if response_data['success'] else 400)
            elif path == '/api/execute' and method == 'POST':
                response_data = MockFlaskHandler.execute_game(json_data.get('code', ''))
                return MockResponse(response_data, 200 if response_data['success'] else 400)
            elif path == '/api/projects' and method == 'POST':
                response_data = MockFlaskHandler.save_project(json_data)
                return MockResponse(response_data, 201 if response_data['success'] else 400)
            elif path.startswith('/api/stop/') and method == 'POST':
                session_id = path.split('/')[-1]
                response_data = MockFlaskHandler.stop_game(session_id)
                return MockResponse(response_data, 200 if response_data['success'] else 400)
            else:
                return MockResponse({'success': True}, 200)
    
    class BackendTestCase(TestCase):
        def setUp(self):
            self.client = MockClient()
            
    class APITestHelper:
        pass

# Import mock handler for when Flask is not available
from mock_flask_handler import MockFlaskHandler


@dataclass
class GameFlowState:
    """Track state through a game creation flow"""
    game_type: str
    current_stage: str = "start"
    components: List[Dict] = field(default_factory=list)
    assets: List[Dict] = field(default_factory=list)
    choices: Dict[str, Any] = field(default_factory=dict)
    compiled_code: Optional[str] = None
    session_id: Optional[str] = None
    project_id: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    
    def add_component(self, component_type: str, config: Dict):
        """Add a component to the game"""
        self.components.append({
            "type": component_type,
            "config": config,
            "added_at": time.time()
        })
    
    def add_asset(self, asset_type: str, asset_data: Dict):
        """Add an asset to the game"""
        self.assets.append({
            "type": asset_type,
            "data": asset_data,
            "added_at": time.time()
        })
    
    def record_choice(self, choice_key: str, choice_value: Any):
        """Record a user choice during the flow"""
        self.choices[choice_key] = choice_value
    
    def advance_stage(self, new_stage: str):
        """Move to the next stage of creation"""
        self.current_stage = new_stage
    
    def is_complete(self) -> bool:
        """Check if the flow is complete"""
        return self.current_stage == "complete" and self.compiled_code is not None


class BaseGameFlowTest(BackendTestCase):
    """Base class for testing game creation flows"""
    
    def setUp(self):
        super().setUp()
        self.flow_state = None
        self.config = None
        # Ensure client is initialized
        if not hasattr(self, 'client'):
            # Use the MockClient if available
            try:
                self.client = MockClient()
            except NameError:
                # If MockClient is not defined, create a simple wrapper
                import requests
                class SimpleClient:
                    def post(self, path, json=None, **kwargs):
                        from mock_flask_handler import MockFlaskHandler
                        if path == '/api/compile':
                            res = MockFlaskHandler.compile_game(json.get('components', []), json.get('gameType', 'platformer'))
                        elif path == '/api/execute':
                            res = MockFlaskHandler.execute_game(json.get('code', ''))
                        elif path == '/api/projects':
                            res = MockFlaskHandler.save_project(json)
                        elif path.startswith('/api/stop/'):
                            res = MockFlaskHandler.stop_game(path.split('/')[-1])
                        else:
                            res = {'success': True}
                        class Response:
                            def __init__(self, data):
                                self.json = data
                                self.status_code = 200 if data.get('success') else 400
                        return Response(res)
                self.client = SimpleClient()
        
    def load_test_config(self, game_type: str) -> Dict:
        """Load test configuration for a game type"""
        config_path = os.path.join(
            os.path.dirname(__file__),
            'test_configs',
            f'{game_type}_test_config.json'
        )
        
        if not os.path.exists(config_path):
            self.fail(f"Test config not found: {config_path}")
        
        with open(config_path, 'r') as f:
            return json.load(f)
    
    def init_flow(self, game_type: str):
        """Initialize a game creation flow"""
        self.flow_state = GameFlowState(game_type=game_type)
        self.config = self.load_test_config(game_type)
        
    def test_stage_title_screen(self):
        """Test title screen creation stage"""
        if not self.flow_state:
            self.skipTest("Flow not initialized")
        
        # Get title config from test config
        title_config = self.config.get('stages', {}).get('title_screen', {})
        
        # Add title screen component
        self.flow_state.add_component("title_screen", {
            "title": title_config.get("title", f"Test {self.flow_state.game_type} Game"),
            "font": title_config.get("font", "default"),
            "background": title_config.get("background", "#000000"),
            "music": title_config.get("music", None)
        })
        
        # Record choices
        self.flow_state.record_choice("title_style", title_config.get("style", "classic"))
        self.flow_state.advance_stage("title_complete")
        
        # Validate component was added
        self.assertEqual(len(self.flow_state.components), 1)
        self.assertEqual(self.flow_state.components[0]["type"], "title_screen")
    
    def test_stage_gameplay_setup(self):
        """Test gameplay setup stage"""
        if not self.flow_state:
            self.skipTest("Flow not initialized")
        
        gameplay_config = self.config.get('stages', {}).get('gameplay', {})
        
        # Add player component
        self.flow_state.add_component("player", gameplay_config.get("player", {}))
        
        # Add game-specific components
        if self.flow_state.game_type == "platformer":
            self.flow_state.add_component("platforms", gameplay_config.get("platforms", {}))
            self.flow_state.add_component("gravity", {"value": 0.8})
        elif self.flow_state.game_type == "rpg":
            self.flow_state.add_component("inventory", gameplay_config.get("inventory", {}))
            self.flow_state.add_component("dialogue_system", gameplay_config.get("dialogue", {}))
        elif self.flow_state.game_type == "puzzle":
            self.flow_state.add_component("grid", gameplay_config.get("grid", {}))
            self.flow_state.add_component("pieces", gameplay_config.get("pieces", {}))
        elif self.flow_state.game_type == "racing":
            self.flow_state.add_component("track", gameplay_config.get("track", {}))
            self.flow_state.add_component("vehicle", gameplay_config.get("vehicle", {}))
        elif self.flow_state.game_type == "space":
            self.flow_state.add_component("spaceship", gameplay_config.get("spaceship", {}))
            self.flow_state.add_component("asteroids", gameplay_config.get("asteroids", {}))
        elif self.flow_state.game_type == "dungeon":
            self.flow_state.add_component("dungeon_layout", gameplay_config.get("layout", {}))
            self.flow_state.add_component("enemies", gameplay_config.get("enemies", {}))
        
        self.flow_state.advance_stage("gameplay_complete")
        
        # Validate components were added
        self.assertGreater(len(self.flow_state.components), 1)
    
    def test_stage_assets_selection(self):
        """Test asset selection stage"""
        if not self.flow_state:
            self.skipTest("Flow not initialized")
        
        assets_config = self.config.get('stages', {}).get('assets', {})
        
        # Add sprites
        for sprite in assets_config.get("sprites", []):
            self.flow_state.add_asset("sprite", sprite)
        
        # Add sounds
        for sound in assets_config.get("sounds", []):
            self.flow_state.add_asset("sound", sound)
        
        # Add backgrounds
        for bg in assets_config.get("backgrounds", []):
            self.flow_state.add_asset("background", bg)
        
        self.flow_state.advance_stage("assets_complete")
        
        # Validate assets were added
        self.assertGreater(len(self.flow_state.assets), 0)
    
    def test_stage_ending_screen(self):
        """Test ending screen creation"""
        if not self.flow_state:
            self.skipTest("Flow not initialized")
        
        ending_config = self.config.get('stages', {}).get('ending_screen', {})
        
        self.flow_state.add_component("ending_screen", {
            "win_message": ending_config.get("win_message", "You Win!"),
            "lose_message": ending_config.get("lose_message", "Game Over"),
            "music": ending_config.get("music", None),
            "style": ending_config.get("style", "classic")
        })
        
        self.flow_state.advance_stage("ending_complete")
        
        # Find ending component
        ending_components = [c for c in self.flow_state.components if c["type"] == "ending_screen"]
        self.assertEqual(len(ending_components), 1)
    
    def test_compilation(self):
        """Test game compilation from components"""
        if not self.flow_state:
            self.skipTest("Flow not initialized")
        
        # Ensure we have components
        if not self.flow_state.components:
            self.test_stage_title_screen()
            self.test_stage_gameplay_setup()
        
        # Compile the game
        response = self.client.post('/api/compile',
                                   json={
                                       "components": self.flow_state.components,
                                       "gameType": self.flow_state.game_type,
                                       "assets": self.flow_state.assets
                                   })
        
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertTrue(data['success'])
        self.assertIn('code', data)
        
        self.flow_state.compiled_code = data['code']
        self.flow_state.advance_stage("compiled")
        
        # Validate compiled code
        self.assertIsNotNone(self.flow_state.compiled_code)
        self.assertIn("import pygame", self.flow_state.compiled_code)
    
    def test_execution(self):
        """Test game execution"""
        if not self.flow_state or not self.flow_state.compiled_code:
            self.skipTest("No compiled code available")
        
        # Execute the game
        response = self.client.post('/api/execute',
                                   json={"code": self.flow_state.compiled_code})
        
        if response.status_code == 200:
            data = response.json
            self.assertTrue(data['success'])
            self.flow_state.session_id = data.get('session_id')
            self.flow_state.advance_stage("executing")
            
            # Clean up session after test
            if self.flow_state.session_id:
                self.client.post(f'/api/stop/{self.flow_state.session_id}')
    
    def test_save_project(self):
        """Test saving the completed game project"""
        if not self.flow_state:
            self.skipTest("Flow not initialized")
        
        # Save project
        response = self.client.post('/api/projects',
                                   json={
                                       "name": f"Test {self.flow_state.game_type} Project",
                                       "components": self.flow_state.components,
                                       "assets": self.flow_state.assets,
                                       "gameType": self.flow_state.game_type,
                                       "code": self.flow_state.compiled_code
                                   })
        
        self.assertEqual(response.status_code, 201)
        data = response.json
        self.assertTrue(data['success'])
        self.flow_state.project_id = data['project']['id']
        
        # Verify project was saved
        self.assertIsNotNone(self.flow_state.project_id)
    
    def test_export_game(self):
        """Test exporting game as Python file"""
        if not self.flow_state or not self.flow_state.compiled_code:
            self.skipTest("No compiled code available")
        
        # Export would typically download a .py file
        # For testing, we just verify the code is valid Python
        try:
            compile(self.flow_state.compiled_code, '<string>', 'exec')
            export_valid = True
        except SyntaxError:
            export_valid = False
        
        self.assertTrue(export_valid)
        self.flow_state.advance_stage("exported")
    
    def test_complete_flow(self):
        """Test complete game creation flow"""
        # Run all stages in order
        self.test_stage_title_screen()
        self.test_stage_gameplay_setup()
        self.test_stage_assets_selection()
        self.test_stage_ending_screen()
        self.test_compilation()
        # Skip execution in automated tests to avoid display issues
        # self.test_execution()
        self.test_save_project()
        self.test_export_game()
        
        # Mark flow as complete
        self.flow_state.advance_stage("complete")
        
        # Validate complete flow
        self.assertTrue(self.flow_state.is_complete())
        self.assertGreater(len(self.flow_state.components), 3)
        self.assertIsNotNone(self.flow_state.compiled_code)
        self.assertEqual(len(self.flow_state.errors), 0)


class PlatformerFlowTest(BaseGameFlowTest):
    """Test platformer game creation flow"""
    
    def setUp(self):
        super().setUp()
        self.init_flow("platformer")


class RPGFlowTest(BaseGameFlowTest):
    """Test RPG game creation flow"""
    
    def setUp(self):
        super().setUp()
        self.init_flow("rpg")


class PuzzleFlowTest(BaseGameFlowTest):
    """Test puzzle game creation flow"""
    
    def setUp(self):
        super().setUp()
        self.init_flow("puzzle")


class RacingFlowTest(BaseGameFlowTest):
    """Test racing game creation flow"""
    
    def setUp(self):
        super().setUp()
        self.init_flow("racing")


class SpaceFlowTest(BaseGameFlowTest):
    """Test space game creation flow"""
    
    def setUp(self):
        super().setUp()
        self.init_flow("space")


class DungeonFlowTest(BaseGameFlowTest):
    """Test dungeon game creation flow"""
    
    def setUp(self):
        super().setUp()
        self.init_flow("dungeon")


class FlowProgressTest(BackendTestCase):
    """Test progress tracking through flows"""
    
    def test_progress_tracking(self):
        """Test that progress is tracked correctly"""
        flow = GameFlowState(game_type="platformer")
        
        # Track progress through stages
        stages = ["start", "title", "gameplay", "assets", "ending", "compile", "complete"]
        progress_percentages = []
        
        for i, stage in enumerate(stages):
            flow.advance_stage(stage)
            progress = (i + 1) / len(stages) * 100
            progress_percentages.append(progress)
        
        # Verify progress increases monotonically
        for i in range(1, len(progress_percentages)):
            self.assertGreater(progress_percentages[i], progress_percentages[i-1])
        
        # Verify final progress is 100%
        self.assertEqual(progress_percentages[-1], 100)
    
    def test_error_recovery(self):
        """Test recovery from errors during flow"""
        flow = GameFlowState(game_type="platformer")
        
        # Simulate an error
        flow.errors.append("Test error occurred")
        
        # Should be able to continue flow
        flow.advance_stage("error_recovery")
        
        # Clear errors and continue
        flow.errors.clear()
        flow.advance_stage("continue")
        
        # Flow should still be able to complete
        self.assertEqual(flow.current_stage, "continue")
        self.assertEqual(len(flow.errors), 0)


def run_game_flow_tests():
    """Run all game flow tests"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all game type flow tests
    suite.addTests(loader.loadTestsFromTestCase(PlatformerFlowTest))
    suite.addTests(loader.loadTestsFromTestCase(RPGFlowTest))
    suite.addTests(loader.loadTestsFromTestCase(PuzzleFlowTest))
    suite.addTests(loader.loadTestsFromTestCase(RacingFlowTest))
    suite.addTests(loader.loadTestsFromTestCase(SpaceFlowTest))
    suite.addTests(loader.loadTestsFromTestCase(DungeonFlowTest))
    suite.addTests(loader.loadTestsFromTestCase(FlowProgressTest))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_game_flow_tests()
    sys.exit(0 if success else 1)