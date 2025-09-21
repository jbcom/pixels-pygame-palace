"""
Integration tests for the Compiler Orchestrator - Production readiness validation.

These tests validate the complete compilation pipeline end-to-end,
including security measures and error handling.
"""

import os
import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the backend src to Python path for testing
sys.path.insert(0, str(Path(__file__).parent.parent))

from compiler_orchestrator import CompilerOrchestrator, CompilationRequest
from asset_packager import AssetPackager
from legacy_fallback import generate_python_code


class TestCompilerIntegration(unittest.TestCase):
    """Integration tests for the complete compilation pipeline."""
    
    def setUp(self):
        """Set up test environment."""
        self.test_dir = tempfile.mkdtemp()
        self.orchestrator = CompilerOrchestrator()
        self.asset_packager = AssetPackager()
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def test_legacy_fallback_import_error_handling(self):
        """Test that ImportError in fallback is handled gracefully."""
        components = [{'id': 'player-sprite', 'type': 'component'}]
        template_id = 'platformer-template'
        
        # This should not raise an exception
        code = generate_python_code(components, template_id)
        
        # Verify the generated code is valid
        self.assertIn('import pygame', code)
        self.assertIn('class Entity', code)
        self.assertIn('def main()', code)
        self.assertTrue('player-sprite' in code.lower() or 'player' in code.lower())
        
        # Verify it's syntactically correct Python
        try:
            compile(code, '<string>', 'exec')
        except SyntaxError as e:
            self.fail(f"Generated code is not syntactically correct: {e}")
    
    def test_asset_security_path_traversal_protection(self):
        """Test path traversal protection in asset validation."""
        # Test various path traversal attempts
        dangerous_paths = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '/etc/passwd',
            'C:\\Windows\\System32\\config\\SAM',
            '../../sensitive_file.txt',
            '/var/www/../../etc/shadow',
            'assets/../../../home/user/.ssh/id_rsa',
            'uploads/../../etc/hosts',
            '..%2F..%2F..%2Fetc%2Fpasswd',  # URL encoded
            '....//....//etc/passwd',  # Double dot
            '/proc/self/environ',  # Linux process environment
            'attached_assets/../../../etc/passwd'  # Even within allowed dir
        ]
        
        for dangerous_path in dangerous_paths:
            with self.subTest(path=dangerous_path):
                result = self.asset_packager._validate_custom_asset_path(dangerous_path)
                self.assertFalse(result['valid'], 
                    f"Path traversal attempt should be rejected: {dangerous_path}")
                self.assertIn('error', result)
                self.assertTrue(len(result['error']) > 0)
    
    def test_asset_security_allowed_paths(self):
        """Test that valid paths in allowed directories are accepted."""
        valid_paths = [
            'assets/sprites/player.png',
            'attached_assets/custom_sprite.png',
            'uploads/user_asset.png',
            'assets/audio/jump.ogg',
            'user_assets/custom_tileset.png'
        ]
        
        for valid_path in valid_paths:
            with self.subTest(path=valid_path):
                # Create the file temporarily for validation
                full_path = Path(valid_path)
                full_path.parent.mkdir(parents=True, exist_ok=True)
                
                try:
                    full_path.touch()  # Create empty file
                    result = self.asset_packager._validate_custom_asset_path(str(full_path))
                    self.assertTrue(result['valid'], 
                        f"Valid path should be accepted: {valid_path}. Error: {result.get('error')}")
                finally:
                    # Cleanup
                    if full_path.exists():
                        full_path.unlink()
                    # Remove directories if empty
                    try:
                        full_path.parent.rmdir()
                    except OSError:
                        pass  # Directory not empty or doesn't exist
    
    def test_compilation_request_cache_key_generation(self):
        """Test that compilation requests generate consistent cache keys."""
        request1 = CompilationRequest(
            template_id='platformer-template',
            components=[{'id': 'player-sprite'}, {'id': 'platform-ground'}],
            configuration={'screenWidth': 800},
            targets=['desktop', 'web']
        )
        
        request2 = CompilationRequest(
            template_id='platformer-template',
            components=[{'id': 'platform-ground'}, {'id': 'player-sprite'}],  # Different order
            configuration={'screenWidth': 800},
            targets=['web', 'desktop']  # Different order
        )
        
        # Cache keys should be the same despite different ordering
        self.assertEqual(request1.get_cache_key(), request2.get_cache_key())
        
        # Different components should generate different cache keys
        request3 = CompilationRequest(
            template_id='platformer-template',
            components=[{'id': 'player-sprite'}, {'id': 'basic-enemy'}],
            configuration={'screenWidth': 800},
            targets=['desktop', 'web']
        )
        
        self.assertNotEqual(request1.get_cache_key(), request3.get_cache_key())
    
    def test_compiler_orchestrator_initialization(self):
        """Test that compiler orchestrator initializes correctly."""
        # Should initialize without errors
        orchestrator = CompilerOrchestrator()
        
        # Should have required attributes
        self.assertTrue(hasattr(orchestrator, 'cache_dir'))
        self.assertTrue(hasattr(orchestrator, 'output_dir'))
        self.assertTrue(hasattr(orchestrator, 'active_compilations'))
        self.assertTrue(hasattr(orchestrator, 'templates_registry'))
        self.assertTrue(hasattr(orchestrator, 'components_registry'))
        
        # Directories should be created
        self.assertTrue(orchestrator.cache_dir.exists())
        self.assertTrue(orchestrator.output_dir.exists())
        
        # Should have thread safety
        self.assertTrue(hasattr(orchestrator, '_compilation_lock'))
    
    @patch('backend.src.compiler_orchestrator.threading.Thread')
    def test_async_compilation_start(self, mock_thread):
        """Test that compilation starts asynchronously."""
        mock_thread_instance = MagicMock()
        mock_thread.return_value = mock_thread_instance
        
        request = CompilationRequest(
            template_id='platformer-template',
            components=[{'id': 'player-sprite'}],
            configuration={},
            targets=['desktop']
        )
        
        compilation_id = self.orchestrator.start_compilation(request)
        
        # Should return a compilation ID
        self.assertIsInstance(compilation_id, str)
        self.assertTrue(compilation_id.startswith('comp_'))
        
        # Should create thread and start it
        mock_thread.assert_called_once()
        mock_thread_instance.start.assert_called_once()
        
        # Should track the compilation
        self.assertIn(compilation_id, self.orchestrator.active_compilations)
        status = self.orchestrator.active_compilations[compilation_id]
        self.assertEqual(status['status'], 'queued')
        self.assertEqual(status['progress'], 0)
    
    def test_compilation_status_retrieval(self):
        """Test compilation status can be retrieved."""
        request = CompilationRequest(
            template_id='platformer-template',
            components=[{'id': 'player-sprite'}],
            configuration={},
            targets=['desktop']
        )
        
        # Start compilation (mock the thread execution)
        with patch('backend.src.compiler_orchestrator.threading.Thread'):
            compilation_id = self.orchestrator.start_compilation(request)
        
        # Should be able to get status
        status = self.orchestrator.get_compilation_status(compilation_id)
        self.assertIsNotNone(status)
        if status is not None:
            self.assertIn('status', status)
            self.assertIn('progress', status)
            self.assertIn('errors', status)
            self.assertIn('warnings', status)
        
        # Non-existent compilation should return None
        fake_status = self.orchestrator.get_compilation_status('fake_id')
        self.assertIsNone(fake_status)
    
    def test_smoke_platformer_template_compilation(self):
        """Smoke test for complete platformer template compilation."""
        # Create a minimal but realistic compilation request
        request = CompilationRequest(
            template_id='platformer-template',
            components=[
                {'id': 'player-sprite', 'type': 'component', 'config': {'sprite': 'player.png'}},
                {'id': 'platform-ground', 'type': 'component', 'config': {'texture': 'grass.png'}},
                {'id': 'input-handler', 'type': 'system'},
                {'id': 'physics-movement', 'type': 'system'},
                {'id': 'collision-detection', 'type': 'system'}
            ],
            configuration={
                'screenWidth': 800,
                'screenHeight': 600,
                'gameTitle': 'Test Platformer'
            },
            targets=['desktop'],
            user_id='test_user'
        )
        
        # Should generate valid cache key
        cache_key = request.get_cache_key()
        self.assertIsInstance(cache_key, str)
        self.assertTrue(len(cache_key) > 0)
        
        # Should start compilation without error
        with patch('backend.src.compiler_orchestrator.threading.Thread'):
            compilation_id = self.orchestrator.start_compilation(request)
        
        # Should track the compilation
        status = self.orchestrator.get_compilation_status(compilation_id)
        self.assertIsNotNone(status)
        if status is not None:
            self.assertEqual(status['status'], 'queued')
    
    def test_asset_file_size_validation(self):
        """Test that asset file size limits are enforced."""
        # Create a large temporary file
        large_file = Path(self.test_dir) / 'large_file.png'
        large_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Create file larger than limit (50MB default)
        large_size = self.asset_packager.max_file_size + 1024
        with open(large_file, 'wb') as f:
            f.write(b'x' * large_size)
        
        # Should reject the large file
        result = self.asset_packager._validate_custom_asset_path(str(large_file))
        self.assertFalse(result['valid'])
        self.assertIn('exceeds size limit', result['error'])
    
    def test_asset_extension_validation(self):
        """Test that only allowed file extensions are accepted."""
        test_files = [
            ('valid.png', True),
            ('valid.jpg', True), 
            ('valid.ogg', True),
            ('valid.ttf', True),
            ('malicious.exe', False),
            ('script.sh', False),
            ('config.ini', False),
            ('data.xml', True),  # XML is allowed
            ('badfile.bat', False)
        ]
        
        for filename, should_pass in test_files:
            with self.subTest(filename=filename):
                file_path = Path('assets') / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.touch()
                
                try:
                    result = self.asset_packager._validate_custom_asset_path(str(file_path))
                    if should_pass:
                        self.assertTrue(result['valid'], 
                            f"File {filename} should be valid but was rejected: {result.get('error')}")
                    else:
                        self.assertFalse(result['valid'], 
                            f"File {filename} should be rejected but was accepted")
                finally:
                    if file_path.exists():
                        file_path.unlink()
                    try:
                        file_path.parent.rmdir()
                    except OSError:
                        pass


class TestStartupChecks(unittest.TestCase):
    """Tests for startup validation system."""
    
    def test_startup_checks_comprehensive(self):
        """Test that startup checks validate critical functionality."""
        from startup_checks import perform_startup_checks
        
        # Should complete without crashing
        success, errors, warnings = perform_startup_checks()
        
        # Should return proper types
        self.assertIsInstance(success, bool)
        self.assertIsInstance(errors, list)
        self.assertIsInstance(warnings, list)
        
        # Errors should be strings if any exist
        for error in errors:
            self.assertIsInstance(error, str)
            self.assertTrue(len(error) > 0)
    
    def test_legacy_fallback_in_startup_checks(self):
        """Test that startup checks validate the legacy fallback system."""
        from startup_checks import perform_startup_checks
        
        # Startup checks should validate that generate_python_code works
        success, errors, warnings = perform_startup_checks()
        
        # Should not have errors related to code generation
        code_gen_errors = [e for e in errors if 'code generation' in e.lower()]
        self.assertEqual(len(code_gen_errors), 0, 
            f"Code generation should work in startup checks: {code_gen_errors}")


if __name__ == '__main__':
    # Run the integration tests
    unittest.main(verbosity=2)