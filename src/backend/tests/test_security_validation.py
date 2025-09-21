"""
Security validation tests for asset handling and path traversal protection.

These tests ensure that all security measures are properly implemented
and cannot be bypassed through various attack vectors.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, mock_open

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from asset_packager import AssetPackager


class TestAssetSecurityValidation(unittest.TestCase):
    """Comprehensive security tests for asset handling."""
    
    def setUp(self):
        """Set up test environment."""
        self.asset_packager = AssetPackager()
        self.test_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def test_null_byte_injection_prevention(self):
        """Test that null byte injection is prevented."""
        malicious_paths = [
            'assets/file.png\x00.exe',
            'uploads/image.jpg\x00/../../../etc/passwd',
            'assets/\x00../../sensitive.txt',
            'user_assets/file\x00\x01\x02.png'
        ]
        
        for path in malicious_paths:
            with self.subTest(path=repr(path)):
                result = self.asset_packager._validate_custom_asset_path(path)
                self.assertFalse(result['valid'], 
                    f"Null byte injection should be prevented: {repr(path)}")
                self.assertIn('Invalid characters', result['error'])
    
    def test_control_character_prevention(self):
        """Test that control characters are rejected."""
        control_char_paths = [
            'assets/file\x01.png',
            'uploads/image\x1f.jpg',
            'assets/\x08file.png',
            'user_assets/\x7ffile.png'
        ]
        
        for path in control_char_paths:
            with self.subTest(path=repr(path)):
                result = self.asset_packager._validate_custom_asset_path(path)
                self.assertFalse(result['valid'], 
                    f"Control characters should be rejected: {repr(path)}")
                self.assertIn('Invalid characters', result['error'])
    
    def test_symlink_attack_prevention(self):
        """Test that dangerous symlinks are prevented."""
        # Create a test symlink pointing outside allowed directories
        if os.name != 'nt':  # Skip on Windows (symlinks need admin)
            symlink_path = Path(self.test_dir) / 'assets' / 'malicious_link.png'
            symlink_path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                # Create symlink pointing to /etc/passwd
                symlink_path.symlink_to('/etc/passwd')
                
                result = self.asset_packager._validate_custom_asset_path(str(symlink_path))
                self.assertFalse(result['valid'], 
                    "Symlinks to external paths should be rejected")
                self.assertIn('Symlinks to external paths not allowed', result['error'])
            except OSError:
                # Skip if symlink creation fails (permission issues)
                self.skipTest("Cannot create symlinks in test environment")
    
    def test_directory_traversal_edge_cases(self):
        """Test edge cases in directory traversal prevention."""
        edge_case_paths = [
            'assets/..\\..\\..\\windows\\system32\\config\\SAM',  # Windows-style
            'assets/....//....//etc/passwd',  # Double dots
            'assets/..//../../etc/shadow',  # Mixed separators
            'assets/..%252F..%252F..%252Fetc%252Fpasswd',  # Double URL encoding
            'assets/..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',  # Unicode bypass attempt
            'assets/../%2e%2e/%2e%2e/etc/passwd',  # Mixed encoding
        ]
        
        for path in edge_case_paths:
            with self.subTest(path=path):
                result = self.asset_packager._validate_custom_asset_path(path)
                self.assertFalse(result['valid'], 
                    f"Directory traversal edge case should be prevented: {path}")
    
    def test_allowed_directories_enforcement(self):
        """Test that only whitelisted directories are allowed."""
        # Valid directories from the whitelist
        valid_dirs = [
            'assets/sprite.png',
            'uploads/custom.jpg',
            'user_assets/tileset.png',
            'attached_assets/background.png',
            'static/assets/icon.png',
            'public/assets/logo.png'
        ]
        
        # Invalid directories not in whitelist
        invalid_dirs = [
            'src/main.py',
            'config/secrets.json',
            'database/users.db',
            'logs/application.log',
            'tmp/temp_file.txt',
            'home/user/private.key',
            'etc/passwd',
            'var/www/index.html'
        ]
        
        # Test valid directories
        for path in valid_dirs:
            with self.subTest(path=path, expected=True):
                full_path = Path(path)
                full_path.parent.mkdir(parents=True, exist_ok=True)
                full_path.touch()
                
                try:
                    result = self.asset_packager._validate_custom_asset_path(str(full_path))
                    self.assertTrue(result['valid'], 
                        f"Valid directory should be allowed: {path}. Error: {result.get('error')}")
                finally:
                    if full_path.exists():
                        full_path.unlink()
                    try:
                        full_path.parent.rmdir()
                    except OSError:
                        pass
        
        # Test invalid directories
        for path in invalid_dirs:
            with self.subTest(path=path, expected=False):
                # Don't actually create these files for security
                result = self.asset_packager._validate_custom_asset_path(path)
                self.assertFalse(result['valid'], 
                    f"Invalid directory should be rejected: {path}")
                self.assertIn('allowed directories', result['error'])
    
    def test_file_type_validation_comprehensive(self):
        """Test comprehensive file type validation."""
        # Allowed file types
        allowed_files = [
            ('image.png', True),
            ('photo.jpg', True),
            ('photo.jpeg', True),
            ('animation.gif', True),
            ('texture.bmp', True),
            ('icon.svg', True),
            ('sound.ogg', True),
            ('music.mp3', True),
            ('audio.wav', True),
            ('song.m4a', True),
            ('font.ttf', True),
            ('font.otf', True),
            ('font.woff', True),
            ('font.woff2', True),
            ('data.json', True),
            ('readme.txt', True),
            ('config.xml', True),
            ('data.csv', True)
        ]
        
        # Dangerous file types
        dangerous_files = [
            ('malware.exe', False),
            ('script.bat', False),
            ('script.sh', False),
            ('script.ps1', False),
            ('program.com', False),
            ('library.dll', False),
            ('driver.sys', False),
            ('config.reg', False),
            ('macro.vbs', False),
            ('script.js', False),
            ('page.html', False),
            ('style.css', False),
            ('code.py', False),
            ('source.c', False),
            ('binary.bin', False),
            ('archive.zip', False),
            ('package.deb', False),
            ('installer.msi', False)
        ]
        
        all_test_files = allowed_files + dangerous_files
        
        for filename, should_pass in all_test_files:
            with self.subTest(filename=filename):
                file_path = Path('assets') / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Create empty file for testing
                file_path.touch()
                
                try:
                    result = self.asset_packager._validate_custom_asset_path(str(file_path))
                    if should_pass:
                        self.assertTrue(result['valid'], 
                            f"File type {filename} should be allowed but was rejected: {result.get('error')}")
                    else:
                        self.assertFalse(result['valid'], 
                            f"Dangerous file type {filename} should be rejected but was allowed")
                        self.assertIn('disallowed extension', result['error'])
                finally:
                    if file_path.exists():
                        file_path.unlink()
                    try:
                        file_path.parent.rmdir()
                    except OSError:
                        pass
    
    def test_path_validation_error_handling(self):
        """Test that path validation handles errors gracefully."""
        # Test with non-existent path (should still validate structure)
        result = self.asset_packager._validate_custom_asset_path('assets/nonexistent.png')
        # Should be valid structurally, even if file doesn't exist
        self.assertTrue(result['valid'])
        
        # Test with invalid path characters that cause OS errors
        invalid_paths = []
        if os.name == 'nt':  # Windows
            invalid_paths = ['assets/file<.png', 'assets/file>.png', 'assets/file|.png']
        else:  # Unix-like
            # Most characters are valid in Unix filenames, so this test is less applicable
            pass
        
        for invalid_path in invalid_paths:
            with self.subTest(path=invalid_path):
                result = self.asset_packager._validate_custom_asset_path(invalid_path)
                # Should handle the error gracefully
                self.assertFalse(result['valid'])
                self.assertIn('error', result)
    
    def test_concurrent_validation_safety(self):
        """Test that validation is thread-safe."""
        import threading
        import time
        
        results = []
        errors = []
        
        def validate_path(path):
            try:
                result = self.asset_packager._validate_custom_asset_path(path)
                results.append(result)
            except Exception as e:
                errors.append(e)
        
        # Test concurrent validation
        threads = []
        test_paths = [
            'assets/file1.png',
            'assets/file2.jpg', 
            '../../../etc/passwd',
            'uploads/file3.ogg',
            '..\\..\\windows\\system32\\config\\SAM'
        ]
        
        for path in test_paths:
            thread = threading.Thread(target=validate_path, args=(path,))
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join(timeout=5.0)
        
        # Check results
        self.assertEqual(len(results), len(test_paths), 
            f"All validations should complete. Errors: {errors}")
        self.assertEqual(len(errors), 0, f"No errors should occur: {errors}")
        
        # Check that dangerous paths were rejected
        dangerous_results = [r for r in results if not r['valid']]
        self.assertGreater(len(dangerous_results), 0, 
            "At least some dangerous paths should be rejected")


if __name__ == '__main__':
    unittest.main(verbosity=2)