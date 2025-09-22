#!/usr/bin/env python3
"""
Unit Tests for Asset Security Validation
========================================

Comprehensive tests for _validate_custom_asset_path method covering:
- Path traversal attempts (../ attacks)
- Oversized files and invalid types
- Symlink attacks and null byte injection
- Directory whitelist enforcement
- File validation edge cases
"""

import unittest
import tempfile
import os
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add backend src to path
backend_src = Path(__file__).parent.parent.parent / 'src' / 'backend'
sys.path.insert(0, str(backend_src.resolve()))

# Import from the src directory
from asset_packager import AssetPackager


class TestAssetSecurity(unittest.TestCase):
    """Test asset path validation security."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.packager = AssetPackager(cache_dir=self.temp_dir)
        
        # Create test directories and files
        self.assets_dir = Path(self.temp_dir) / 'assets' 
        self.assets_dir.mkdir()
        
        self.attached_assets_dir = Path(self.temp_dir) / 'attached_assets'
        self.attached_assets_dir.mkdir()
        
        # Create valid test file
        self.valid_file = self.assets_dir / 'test.png'
        self.valid_file.write_text('fake png content')
        
        # Create oversized test file
        self.oversized_file = self.assets_dir / 'oversized.png'
        self.oversized_file.write_bytes(b'x' * (51 * 1024 * 1024))  # 51MB
        
        # Change working directory to temp dir for tests
        self.original_cwd = os.getcwd()
        os.chdir(self.temp_dir)
    
    def tearDown(self):
        """Clean up test environment."""
        os.chdir(self.original_cwd)
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_directory_traversal_attacks(self):
        """Test protection against directory traversal attacks."""
        # Test various traversal patterns
        traversal_attempts = [
            "../../../etc/passwd",
            "assets/../../../etc/passwd", 
            "assets/../../secret.txt",
            "..\\..\\windows\\system32\\config\\sam",  # Windows style
            "assets\\..\\..\\secret.txt",
            "assets/subdir/../../secret.txt"
        ]
        
        for malicious_path in traversal_attempts:
            with self.subTest(path=malicious_path):
                result = self.packager._validate_custom_asset_path(malicious_path)
                self.assertFalse(result['valid'], 
                               f"Traversal attack should be blocked: {malicious_path}")
                self.assertIn('Directory traversal', result['error'])
    
    def test_null_byte_injection(self):
        """Test protection against null byte injection."""
        malicious_paths = [
            "assets/test.png\x00.exe",
            "assets/test\x00/../../etc/passwd", 
            "assets/normal.png\x00\x01\x02",
            "assets/file\x00name.txt"
        ]
        
        for malicious_path in malicious_paths:
            with self.subTest(path=malicious_path):
                result = self.packager._validate_custom_asset_path(malicious_path)
                self.assertFalse(result['valid'],
                               f"Null byte injection should be blocked: {repr(malicious_path)}")
                self.assertIn('Invalid characters', result['error'])
    
    def test_dangerous_characters(self):
        """Test filtering of dangerous control characters."""
        dangerous_paths = [
            "assets/test\x01.png",  # Control char
            "assets/test\x1f.png",  # Control char
            "assets/test\x7f.png",  # DEL char
            "assets/file\x0c.txt",  # Form feed
        ]
        
        for dangerous_path in dangerous_paths:
            with self.subTest(path=dangerous_path):
                result = self.packager._validate_custom_asset_path(dangerous_path)
                self.assertFalse(result['valid'],
                               f"Dangerous characters should be blocked: {repr(dangerous_path)}")
                self.assertIn('Invalid characters', result['error'])
    
    def test_symlink_attacks(self):
        """Test protection against symlink attacks."""
        # Create symlink pointing outside allowed directory
        external_file = Path(self.temp_dir) / 'external_secret.txt'
        external_file.write_text('secret data')
        
        symlink_file = self.assets_dir / 'symlink_attack.txt'
        symlink_file.symlink_to(external_file)
        
        result = self.packager._validate_custom_asset_path(str(symlink_file))
        self.assertFalse(result['valid'], "Symlink to external file should be blocked")
        self.assertIn('Symlinks to external paths', result['error'])
        
        # Test relative symlink with traversal
        traversal_symlink = self.assets_dir / 'traversal_symlink.txt'
        traversal_symlink.symlink_to(Path('../external_secret.txt'))
        
        result = self.packager._validate_custom_asset_path(str(traversal_symlink))
        self.assertFalse(result['valid'], "Traversal symlink should be blocked")
    
    def test_directory_whitelist_enforcement(self):
        """Test that only whitelisted directories are allowed."""
        # Test invalid directories
        invalid_paths = [
            "etc/passwd",
            "tmp/secret.txt", 
            "var/log/sensitive.log",
            "home/user/.ssh/id_rsa",
            "random_dir/file.txt"
        ]
        
        for invalid_path in invalid_paths:
            with self.subTest(path=invalid_path):
                result = self.packager._validate_custom_asset_path(invalid_path)
                self.assertFalse(result['valid'], 
                               f"Non-whitelisted directory should be blocked: {invalid_path}")
                self.assertIn('Path must be in allowed directories', result['error'])
    
    def test_valid_whitelisted_directories(self):
        """Test that whitelisted directories are allowed."""
        valid_paths = [
            "assets/sprite.png",
            "attached_assets/user_upload.jpg",
            "uploads/file.txt",
            "assets/subdir/nested_file.png"
        ]
        
        # Create these files for testing
        for valid_path in valid_paths:
            path_obj = Path(self.temp_dir) / valid_path
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            path_obj.write_text('valid content')
            
            with self.subTest(path=valid_path):
                result = self.packager._validate_custom_asset_path(valid_path)
                self.assertTrue(result['valid'], 
                              f"Whitelisted path should be valid: {valid_path}, error: {result.get('error')}")
    
    def test_file_type_validation(self):
        """Test validation of file types (not directories, devices, etc.)."""
        # Create a directory with same name as file
        directory_path = self.assets_dir / 'not_a_file'
        directory_path.mkdir()
        
        result = self.packager._validate_custom_asset_path(str(directory_path))
        self.assertFalse(result['valid'], "Directory should not be valid as file")
        self.assertIn('Path must be a regular file', result['error'])
    
    def test_oversized_file_rejection(self):
        """Test rejection of oversized files in the calling method."""
        # This test verifies size checking in _process_custom_asset method
        custom_asset = {
            'path': str(self.oversized_file),
            'logical_path': 'sprites/oversized.png',
            'type': 'sprite'
        }
        
        output_dir = Path(self.temp_dir) / 'output'
        output_dir.mkdir()
        
        result = self.packager._process_custom_asset(custom_asset, output_dir)
        self.assertIsNone(result, "Oversized file should be rejected")
    
    def test_invalid_file_extensions(self):
        """Test rejection of disallowed file extensions."""
        # Create files with disallowed extensions
        disallowed_files = [
            ('assets/script.exe', 'executable'),
            ('assets/script.bat', 'batch file'),
            ('assets/script.sh', 'shell script'),
            ('assets/binary.bin', 'binary file'),
            ('assets/config.cfg', 'config file')
        ]
        
        for file_path, file_type in disallowed_files:
            path_obj = Path(self.temp_dir) / file_path
            path_obj.write_text(f'fake {file_type} content')
            
            custom_asset = {
                'path': file_path,
                'logical_path': f'test/{Path(file_path).name}',
                'type': 'data'
            }
            
            output_dir = Path(self.temp_dir) / 'output'
            output_dir.mkdir(exist_ok=True)
            
            with self.subTest(extension=Path(file_path).suffix):
                result = self.packager._process_custom_asset(custom_asset, output_dir)
                self.assertIsNone(result, f"Disallowed extension should be rejected: {file_path}")
    
    def test_valid_file_extensions(self):
        """Test acceptance of allowed file extensions."""
        allowed_files = [
            'assets/image.png',
            'assets/photo.jpg', 
            'assets/audio.mp3',
            'assets/sound.ogg',
            'assets/font.ttf',
            'assets/data.json',
            'assets/text.txt'
        ]
        
        output_dir = Path(self.temp_dir) / 'output'
        output_dir.mkdir(exist_ok=True)
        
        for file_path in allowed_files:
            path_obj = Path(self.temp_dir) / file_path
            path_obj.write_text('valid content')
            
            custom_asset = {
                'path': file_path,
                'logical_path': f'test/{Path(file_path).name}',
                'type': 'data'
            }
            
            with self.subTest(extension=Path(file_path).suffix):
                result = self.packager._process_custom_asset(custom_asset, output_dir)
                self.assertIsNotNone(result, f"Allowed extension should be accepted: {file_path}")
    
    def test_empty_and_malformed_paths(self):
        """Test handling of empty and malformed paths."""
        invalid_paths = [
            "",           # Empty path
            "   ",        # Whitespace only
            "/",          # Root path
            "//",         # Double slash
            ".",          # Current directory
        ]
        
        for invalid_path in invalid_paths:
            with self.subTest(path=repr(invalid_path)):
                result = self.packager._validate_custom_asset_path(invalid_path)
                self.assertFalse(result['valid'], 
                               f"Invalid path should be rejected: {repr(invalid_path)}")
    
    def test_path_validation_exception_handling(self):
        """Test that path validation handles exceptions gracefully."""
        # Test with a path that will cause an exception
        with patch('pathlib.Path.resolve', side_effect=OSError("Simulated error")):
            result = self.packager._validate_custom_asset_path("assets/test.txt")
            self.assertFalse(result['valid'], "Exception should result in invalid path")
            self.assertIn('Path validation error', result['error'])
    
    def test_comprehensive_security_workflow(self):
        """Test complete security workflow from asset to validation."""
        # Test a complete workflow with various attack vectors
        test_cases = [
            # (path, should_be_valid, description)
            ("assets/safe_image.png", True, "Valid safe path"),
            ("../../../etc/passwd", False, "Path traversal attack"),
            ("assets/file\x00.exe", False, "Null byte injection"),
            ("assets/normal.txt\x01", False, "Control character"),
            (str(self.valid_file), True, "Valid existing file"),
        ]
        
        for test_path, should_be_valid, description in test_cases:
            with self.subTest(path=test_path, desc=description):
                if should_be_valid and not Path(self.temp_dir, test_path).exists():
                    # Create the file if it should be valid but doesn't exist
                    path_obj = Path(self.temp_dir) / test_path
                    path_obj.parent.mkdir(parents=True, exist_ok=True)
                    path_obj.write_text('test content')
                
                result = self.packager._validate_custom_asset_path(test_path)
                
                if should_be_valid:
                    self.assertTrue(result['valid'], 
                                  f"{description} should be valid but was rejected: {result.get('error')}")
                else:
                    self.assertFalse(result['valid'], 
                                   f"{description} should be invalid but was accepted")


if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)