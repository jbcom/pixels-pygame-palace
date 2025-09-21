"""
Comprehensive Space Flow Test
Tests all space-specific features in the space adventure game flow
"""

import os
import sys
import json
import time
import unittest
import requests

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from game_flow_tests import BaseGameFlowTest, GameFlowState


class SpaceFlowComprehensiveTest(BaseGameFlowTest):
    """Comprehensive test for space shooter game creation flow"""
    
    def setUp(self):
        super().setUp()
        self.init_flow("space")
    
    def test_space_specific_components(self):
        """Test all space-specific components are properly configured"""
        # Load the space test config
        config = self.config.get('stages', {})
        
        # Test spaceship configuration
        spaceship_config = config.get('gameplay', {}).get('spaceship', {})
        self.assertIn('health', spaceship_config)
        self.assertIn('shields', spaceship_config)
        self.assertIn('weapons', spaceship_config)
        self.assertIn('speed', spaceship_config)
        
        # Add spaceship component
        self.flow_state.add_component("spaceship", spaceship_config)
        
        # Test weapon systems
        weapons_config = config.get('gameplay', {}).get('weapons', [])
        self.assertGreater(len(weapons_config), 0)
        
        for weapon in weapons_config:
            self.assertIn('type', weapon)
            self.assertIn('damage', weapon)
            self.assertIn('rate_of_fire', weapon)
            
            # Add weapon component
            self.flow_state.add_component("weapon", weapon)
        
        # Test enemy types
        enemies_config = config.get('gameplay', {}).get('enemies', [])
        self.assertGreater(len(enemies_config), 0)
        
        for enemy in enemies_config:
            self.assertIn('type', enemy)
            self.assertIn('health', enemy)
            self.assertIn('pattern', enemy)
            
            # Add enemy component
            self.flow_state.add_component("enemy", enemy)
        
        # Test power-ups
        powerups_config = config.get('gameplay', {}).get('power_ups', [])
        self.assertGreater(len(powerups_config), 0)
        
        for powerup in powerups_config:
            self.assertIn('type', powerup)
            self.assertIn('effect', powerup)
            
            # Add power-up component
            self.flow_state.add_component("powerup", powerup)
        
        # Test asteroids
        asteroids_config = config.get('gameplay', {}).get('asteroids', {})
        self.assertIn('types', asteroids_config)
        self.assertIn('breakable', asteroids_config)
        
        self.flow_state.add_component("asteroids", asteroids_config)
        
        # Verify all components added
        self.assertGreater(len(self.flow_state.components), 10)
    
    def test_boss_battle_configuration(self):
        """Test boss battle is properly configured"""
        enemies_config = self.config.get('stages', {}).get('gameplay', {}).get('enemies', [])
        
        # Find boss enemy
        boss_configs = [e for e in enemies_config if 'boss' in e.get('type', '').lower()]
        self.assertGreater(len(boss_configs), 0)
        
        boss = boss_configs[0]
        self.assertIn('health', boss)
        self.assertGreater(boss['health'], 300)  # Boss should have significant health
        self.assertIn('phases', boss)
        self.assertIn('weapons', boss)
    
    def test_game_modes(self):
        """Test different game modes are configured"""
        game_modes = self.config.get('stages', {}).get('game_modes', {})
        
        # Test campaign mode
        self.assertIn('campaign', game_modes)
        campaign = game_modes['campaign']
        self.assertIn('missions', campaign)
        
        # Test survival mode
        self.assertIn('survival', game_modes)
        survival = game_modes['survival']
        self.assertIn('leaderboard', survival)
        
        # Test arcade mode
        self.assertIn('arcade', game_modes)
        arcade = game_modes['arcade']
        self.assertIn('lives', arcade)
        
        # Test boss rush mode
        self.assertIn('boss_rush', game_modes)
    
    def test_upgrade_system(self):
        """Test upgrade system is configured"""
        upgrades = self.config.get('stages', {}).get('upgrades', {})
        
        # Test weapon upgrades
        self.assertIn('weapons', upgrades)
        weapon_upgrades = upgrades['weapons']
        self.assertIn('damage', weapon_upgrades)
        self.assertIn('fire_rate', weapon_upgrades)
        
        # Test ship upgrades
        self.assertIn('ship', upgrades)
        ship_upgrades = upgrades['ship']
        self.assertIn('health', ship_upgrades)
        self.assertIn('shields', ship_upgrades)
        self.assertIn('speed', ship_upgrades)
    
    def test_ui_elements(self):
        """Test UI elements are configured"""
        ui_config = self.config.get('stages', {}).get('ui_elements', {})
        
        # Test HUD elements
        self.assertIn('hud', ui_config)
        hud = ui_config['hud']
        self.assertIn('health_bar', hud)
        self.assertIn('shield_bar', hud)
        self.assertIn('score', hud)
        self.assertIn('ammo_counter', hud)
        self.assertIn('boss_health', hud)
        
        # Test effects
        self.assertIn('effects', ui_config)
        effects = ui_config['effects']
        self.assertIn('particle_effects', effects)
        self.assertIn('screen_shake', effects)
    
    def test_space_compilation(self):
        """Test that space game compiles with correct template"""
        # Add minimal components needed for compilation
        self.flow_state.add_component("title_screen", {
            "title": "Space Adventure",
            "style": "sci-fi"
        })
        
        self.flow_state.add_component("spaceship", {
            "type": "fighter",
            "health": 100,
            "shields": 50
        })
        
        self.flow_state.add_component("weapon", {
            "type": "laser",
            "damage": 10
        })
        
        self.flow_state.add_component("enemy", {
            "type": "scout",
            "pattern": "zigzag"
        })
        
        # Compile the game
        response = self.client.post('/api/compile',
                                   json={
                                       "components": self.flow_state.components,
                                       "gameType": "space"
                                   })
        
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertTrue(data['success'])
        self.assertIn('code', data)
        
        code = data['code']
        
        # Verify space-specific elements in compiled code
        self.assertIn('PlayerShip', code)
        self.assertIn('EnemyShip', code)
        self.assertIn('Projectile', code)
        self.assertIn('PowerUp', code)
        self.assertIn('shield', code)
        self.assertIn('missile', code)
        self.assertIn('laser', code)
        self.assertIn('boss', code)
        self.assertIn('wave', code)
        self.assertIn('Space Adventure', code)
        
        self.flow_state.compiled_code = code
    
    def test_export_space_game(self):
        """Test exporting space game as Python file"""
        # Ensure we have compiled code
        if not self.flow_state.compiled_code:
            self.test_space_compilation()
        
        # Test that code is valid Python
        try:
            compile(self.flow_state.compiled_code, '<string>', 'exec')
            export_valid = True
        except SyntaxError as e:
            print(f"Syntax error in exported code: {e}")
            export_valid = False
        
        self.assertTrue(export_valid)
        
        # Verify exported code has all required components
        code = self.flow_state.compiled_code
        
        # Check for game loop
        self.assertIn('while running:', code)
        self.assertIn('pygame.quit()', code)
        
        # Check for collision detection
        self.assertIn('pygame.sprite.spritecollide', code)
        
        # Check for score system
        self.assertIn('score', code)
        
        # Check for game over conditions
        self.assertIn('game_over', code)
    
    def test_complete_space_flow(self):
        """Test the complete space game creation flow"""
        # Run all stages
        self.test_stage_title_screen()
        self.test_space_specific_components()
        self.test_boss_battle_configuration()
        self.test_game_modes()
        self.test_upgrade_system()
        self.test_ui_elements()
        self.test_stage_assets_selection()
        self.test_stage_ending_screen()
        self.test_space_compilation()
        self.test_export_space_game()
        self.test_save_project()
        
        # Mark as complete
        self.flow_state.advance_stage("complete")
        
        # Validate complete flow
        self.assertTrue(self.flow_state.is_complete())
        self.assertGreater(len(self.flow_state.components), 15)
        self.assertIsNotNone(self.flow_state.compiled_code)
        self.assertEqual(len(self.flow_state.errors), 0)
        
        print("\n✅ Space Adventure Flow Test Complete!")
        print(f"  - Components created: {len(self.flow_state.components)}")
        print(f"  - Assets loaded: {len(self.flow_state.assets)}")
        print(f"  - Code size: {len(self.flow_state.compiled_code)} characters")
        print(f"  - All space-specific features verified!")


if __name__ == '__main__':
    # Run the comprehensive test
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(SpaceFlowComprehensiveTest))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Clean up any remaining sessions
    try:
        response = requests.get('http://localhost:5001/api/sessions')
        if response.status_code == 200:
            sessions = response.json().get('sessions', [])
            for session in sessions:
                requests.post(f'http://localhost:5001/api/stop/{session["session_id"]}')
    except:
        pass
    
    print("\nCleaning up all game sessions...")
    
    sys.exit(0 if result.wasSuccessful() else 1)