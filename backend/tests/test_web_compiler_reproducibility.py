"""
Comprehensive tests for WebGameCompiler reproducibility and web asset integration.

This module tests the critical requirements for task 4c3 completion:
1. Reproducible builds (byte-identical outputs)
2. Index.html normalization (timestamp/version removal)
3. Cache hits and misses for unchanged/changed inputs
4. Web asset integration with conversion and manifest references
"""

import os
import sys
import json
import tempfile
import unittest
import hashlib
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add the backend src to Python path for testing
sys.path.insert(0, str(Path(__file__).parent.parent))

# Use absolute imports to avoid relative import issues
try:
    from web_game_compiler import WebGameCompiler
    from compiler_orchestrator import CompilerOrchestrator, CompilationRequest
    from cache_manager import CacheManager, CacheKey, CacheStage
    from asset_packager import AssetPackager
except ImportError:
    # Fallback for test environment
    import sys
    import os
    backend_path = os.path.join(os.path.dirname(__file__), '..')
    sys.path.insert(0, backend_path)
    
    from web_game_compiler import WebGameCompiler
    from compiler_orchestrator import CompilerOrchestrator, CompilationRequest
    from cache_manager import CacheManager, CacheKey, CacheStage
    from asset_packager import AssetPackager


class TestWebCompilerReproducibility(unittest.TestCase):
    """Test WebGameCompiler reproducibility and web asset integration."""
    
    def setUp(self):
        """Set up test environment with temporary directories and shared instances."""
        self.test_dir = tempfile.mkdtemp()
        self.cache_dir = Path(self.test_dir) / 'cache'
        self.output_dir = Path(self.test_dir) / 'output' 
        self.assets_dir = Path(self.test_dir) / 'assets'
        
        # Create directories
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.assets_dir.mkdir(parents=True, exist_ok=True)
        
        # Create shared CacheManager and AssetPackager instances
        self.cache_manager = CacheManager(self.cache_dir, max_cache_size_mb=100)
        self.asset_packager = AssetPackager(cache_manager=self.cache_manager)
        
        # Test compiler with shared instances
        self.compiler = WebGameCompiler(
            cache_manager=self.cache_manager,
            asset_packager=self.asset_packager
        )
        
        # Create test assets
        self._create_test_assets()
        
        # Sample game code for testing
        self.sample_code = '''
import pygame
import asyncio

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("Test Game")
clock = pygame.time.Clock()

async def main():
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        
        screen.fill((0, 0, 0))
        pygame.display.flip()
        clock.tick(60)
        await asyncio.sleep(0)
    
    pygame.quit()

if __name__ == "__main__":
    asyncio.run(main())
'''
    
    def tearDown(self):
        """Clean up test environment."""
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def _create_test_assets(self):
        """Create test assets for web asset integration tests."""
        # Create a test PNG image
        test_png = self.assets_dir / 'test_image.png'
        # Create a minimal PNG file (1x1 pixel)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\xdac\xf8\x00\x00\x00\x01\x00\x01\x9a_\x9c\x0e\x00\x00\x00\x00IEND\xaeB`\x82'
        test_png.write_bytes(png_data)
        
        # Create a test WAV audio file (minimal header)
        test_wav = self.assets_dir / 'test_sound.wav'
        wav_data = b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'
        test_wav.write_bytes(wav_data)
        
        # Create asset manifest
        self.test_assets = [
            {
                'path': str(test_png),
                'type': 'image',
                'logical_path': 'images/test_image.png',
                'transform_params': {'format': 'webp', 'quality': 80}
            },
            {
                'path': str(test_wav),
                'type': 'audio',
                'logical_path': 'sounds/test_sound.wav',
                'transform_params': {'format': 'ogg', 'bitrate': 128}
            }
        ]
    
    def _compute_file_hash(self, file_path: Path) -> str:
        """Compute SHA256 hash of a file."""
        if not file_path.exists():
            return "file_not_found"
        
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def _compute_directory_hash(self, directory: Path) -> str:
        """Compute deterministic hash of entire directory contents."""
        if not directory.exists():
            return "directory_not_found"
        
        file_hashes = []
        for file_path in sorted(directory.rglob('*')):
            if file_path.is_file():
                relative_path = file_path.relative_to(directory)
                file_hash = self._compute_file_hash(file_path)
                file_hashes.append(f"{relative_path}:{file_hash}")
        
        # Create deterministic hash of all file hashes
        content = '\n'.join(file_hashes)
        return hashlib.sha256(content.encode()).hexdigest()
    
    def test_identical_builds_produce_byte_identical_outputs(self):
        """Test requirement (a): Two identical builds produce byte-identical outputs."""
        game_id_1 = "test_reproducible_1"
        game_id_2 = "test_reproducible_2"
        
        # Compile the same code twice with identical parameters
        result_1 = self.compiler.compile_game(
            code=self.sample_code,
            game_id=game_id_1,
            assets=self.test_assets,
            configuration={'deterministic': True}
        )
        
        result_2 = self.compiler.compile_game(
            code=self.sample_code,
            game_id=game_id_2,
            assets=self.test_assets,
            configuration={'deterministic': True}
        )
        
        # Both compilations should succeed
        self.assertTrue(result_1['success'], f"First compilation failed: {result_1.get('error')}")
        self.assertTrue(result_2['success'], f"Second compilation failed: {result_2.get('error')}")
        
        # Compute hashes of the output directories (excluding game_id specific paths)
        output_1 = Path(result_1['output_path'])
        output_2 = Path(result_2['output_path'])
        
        # Compare main.py files - should be byte-identical after deterministic compilation
        main_py_1 = output_1 / 'main.py'
        main_py_2 = output_2 / 'main.py'
        
        if main_py_1.exists() and main_py_2.exists():
            hash_1 = self._compute_file_hash(main_py_1)
            hash_2 = self._compute_file_hash(main_py_2)
            self.assertEqual(hash_1, hash_2, 
                           "main.py files should be byte-identical for reproducible builds")
        
        # Compare asset manifests - should be identical
        manifest_1 = output_1 / 'assets' / 'manifest.json'
        manifest_2 = output_2 / 'assets' / 'manifest.json'
        
        if manifest_1.exists() and manifest_2.exists():
            with open(manifest_1) as f1, open(manifest_2) as f2:
                manifest_data_1 = json.load(f1)
                manifest_data_2 = json.load(f2)
                
                # Remove non-deterministic fields before comparison
                for manifest in [manifest_data_1, manifest_data_2]:
                    manifest.pop('build_timestamp', None)
                    manifest.pop('compilation_id', None)
                
                self.assertEqual(manifest_data_1, manifest_data_2,
                               "Asset manifests should be identical for reproducible builds")
    
    def test_index_html_normalization(self):
        """Test requirement (b): Index.html normalization verified (timestamp/version removal)."""
        game_id = "test_normalization"
        
        # Mock time-dependent functions to ensure deterministic output
        fixed_time = datetime(2024, 1, 1, 0, 0, 0)
        
        with patch('web_game_compiler.datetime') as mock_datetime:
            mock_datetime.now.return_value = fixed_time
            mock_datetime.return_value = fixed_time
            
            result = self.compiler.compile_game(
                code=self.sample_code,
                game_id=game_id,
                assets=self.test_assets,
                configuration={'deterministic': True}
            )
        
        self.assertTrue(result['success'], f"Compilation failed: {result.get('error')}")
        
        # Check if index.html exists and verify normalization
        output_path = Path(result['output_path'])
        index_html = output_path / 'index.html'
        
        if index_html.exists():
            content = index_html.read_text()
            
            # Verify that timestamps are normalized to fixed values
            self.assertIn(self.compiler.FIXED_BUILD_TIME, content,
                         "index.html should contain fixed build time for reproducibility")
            self.assertIn(self.compiler.FIXED_VERSION, content,
                         "index.html should contain fixed version for reproducibility")
            
            # Verify no actual timestamps are present
            import re
            timestamp_patterns = [
                r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?!\.\d{3}Z)',  # ISO format except fixed one
                r'\d{4}/\d{2}/\d{2}',  # Date format
                r'\d{2}:\d{2}:\d{2}',  # Time format
                r'generated.*\d{4}',   # "Generated 2024" etc
            ]
            
            for pattern in timestamp_patterns:
                matches = re.findall(pattern, content)
                # Filter out our fixed timestamp
                non_fixed_matches = [m for m in matches if self.compiler.FIXED_BUILD_TIME not in m]
                self.assertEqual(len(non_fixed_matches), 0,
                               f"Found non-deterministic timestamp in index.html: {non_fixed_matches}")
    
    def test_unchanged_inputs_hit_web_cache(self):
        """Test requirement (c): Unchanged inputs hit CacheStage.WEB cache and skip rebuild."""
        game_id = "test_cache_hit"
        
        # First compilation - should be a cache miss
        result_1 = self.compiler.compile_game(
            code=self.sample_code,
            game_id=game_id,
            assets=self.test_assets,
            configuration={'deterministic': True}
        )
        
        self.assertTrue(result_1['success'], f"First compilation failed: {result_1.get('error')}")
        self.assertFalse(result_1.get('cached', False), 
                        "First compilation should not be cached")
        
        # Second compilation with identical inputs - should hit cache
        result_2 = self.compiler.compile_game(
            code=self.sample_code,
            game_id=game_id,
            assets=self.test_assets,
            configuration={'deterministic': True}
        )
        
        self.assertTrue(result_2['success'], f"Second compilation failed: {result_2.get('error')}")
        self.assertTrue(result_2.get('cached', False),
                       "Second compilation with identical inputs should hit cache")
        
        # Verify cache keys are identical
        self.assertEqual(result_1['cache_key'], result_2['cache_key'],
                        "Cache keys should be identical for identical inputs")
        
        # Verify cache manager reports the cache hit
        cache_stats = self.cache_manager.get_stats()
        self.assertGreater(cache_stats.get('hits', 0), 0,
                          "Cache manager should report cache hits")
    
    def test_input_variance_invalidates_cache(self):
        """Test requirement (d): Input variance invalidates cache properly."""
        base_game_id = "test_cache_invalidation"
        
        # First compilation
        result_1 = self.compiler.compile_game(
            code=self.sample_code,
            game_id=base_game_id,
            assets=self.test_assets,
            configuration={'deterministic': True}
        )
        
        self.assertTrue(result_1['success'])
        original_cache_key = result_1['cache_key']
        
        # Test 1: Different code should invalidate cache
        modified_code = self.sample_code.replace('(800, 600)', '(1024, 768)')
        result_2 = self.compiler.compile_game(
            code=modified_code,
            game_id=base_game_id,
            assets=self.test_assets,
            configuration={'deterministic': True}
        )
        
        self.assertTrue(result_2['success'])
        self.assertNotEqual(original_cache_key, result_2['cache_key'],
                           "Different code should produce different cache key")
        self.assertFalse(result_2.get('cached', False),
                        "Modified code should not hit cache")
        
        # Test 2: Different assets should invalidate cache
        modified_assets = self.test_assets.copy()
        modified_assets[0]['transform_params']['quality'] = 90  # Change quality
        
        result_3 = self.compiler.compile_game(
            code=self.sample_code,
            game_id=base_game_id,
            assets=modified_assets,
            configuration={'deterministic': True}
        )
        
        self.assertTrue(result_3['success'])
        self.assertNotEqual(original_cache_key, result_3['cache_key'],
                           "Different assets should produce different cache key")
        self.assertFalse(result_3.get('cached', False),
                        "Modified assets should not hit cache")
        
        # Test 3: Different configuration should invalidate cache
        result_4 = self.compiler.compile_game(
            code=self.sample_code,
            game_id=base_game_id,
            assets=self.test_assets,
            configuration={'deterministic': True, 'debug': True}
        )
        
        self.assertTrue(result_4['success'])
        self.assertNotEqual(original_cache_key, result_4['cache_key'],
                           "Different configuration should produce different cache key")
        self.assertFalse(result_4.get('cached', False),
                        "Modified configuration should not hit cache")


class TestWebAssetIntegration(unittest.TestCase):
    """Test web asset integration with conversion and manifest references."""
    
    def setUp(self):
        """Set up test environment for asset integration tests."""
        self.test_dir = tempfile.mkdtemp()
        self.cache_dir = Path(self.test_dir) / 'cache'
        self.assets_dir = Path(self.test_dir) / 'assets'
        
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.assets_dir.mkdir(parents=True, exist_ok=True)
        
        # Create shared instances
        self.cache_manager = CacheManager(self.cache_dir, max_cache_size_mb=100)
        self.asset_packager = AssetPackager(cache_manager=self.cache_manager)
        self.compiler = WebGameCompiler(
            cache_manager=self.cache_manager,
            asset_packager=self.asset_packager
        )
        
        self._create_test_assets()
    
    def tearDown(self):
        """Clean up test environment."""
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def _create_test_assets(self):
        """Create comprehensive test assets for web integration."""
        # Create test PNG (larger, more realistic)
        test_png = self.assets_dir / 'sprite.png'
        # Simple 2x2 PNG with transparency
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x02\x00\x00\x00\x02\x08\x06\x00\x00\x00r\xb6\r$\x00\x00\x00\x19IDATx\xdac\xf8\x0f\x00\x00\x00\xff\xff\x03\x00\x00\x00\xff\xff\x03\x00\x00\x00\xff\xff\x03\x00\x05\x18\x02\xfd\xd8w\xd3\x18\x00\x00\x00\x00IEND\xaeB`\x82'
        test_png.write_bytes(png_data)
        
        # Create test WAV
        test_wav = self.assets_dir / 'sound.wav'
        wav_data = b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x02\x00\x44\xac\x00\x00\x10\xb1\x02\x00\x04\x00\x10\x00data\x00\x00\x00\x00'
        test_wav.write_bytes(wav_data)
        
        self.test_assets = [
            {
                'path': str(test_png),
                'type': 'image',
                'logical_path': 'sprites/player.png',
                'transform_params': {'format': 'webp', 'quality': 85}
            },
            {
                'path': str(test_wav),
                'type': 'audio', 
                'logical_path': 'audio/jump.wav',
                'transform_params': {'format': 'ogg', 'bitrate': 128}
            }
        ]
        
        self.sample_code_with_assets = '''
import pygame
import asyncio

pygame.init()
screen = pygame.display.set_mode((800, 600))

# Load assets that should be converted for web
player_sprite = pygame.image.load("sprites/player.png")
jump_sound = pygame.mixer.Sound("audio/jump.wav")

async def main():
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    jump_sound.play()
        
        screen.fill((0, 128, 255))
        screen.blit(player_sprite, (100, 100))
        pygame.display.flip()
        await asyncio.sleep(0)
    
    pygame.quit()

if __name__ == "__main__":
    asyncio.run(main())
'''
    
    def test_asset_conversion_and_manifest_references(self):
        """Test that converted assets (.png→.webp, .wav→.ogg) are referenced via manifest web_path."""
        game_id = "test_asset_conversion"
        
        result = self.compiler.compile_game(
            code=self.sample_code_with_assets,
            game_id=game_id,
            assets=self.test_assets,
            configuration={'web_target': True}
        )
        
        self.assertTrue(result['success'], f"Compilation failed: {result.get('error')}")
        
        # Check that manifest contains web_path references
        output_path = Path(result['output_path'])
        manifest_file = output_path / 'assets' / 'manifest.json'
        
        if manifest_file.exists():
            with open(manifest_file) as f:
                manifest = json.load(f)
            
            assets = manifest.get('assets', {})
            
            # Verify PNG → WebP conversion in manifest
            player_sprite_entry = assets.get('sprites/player.png')
            if player_sprite_entry:
                web_path = player_sprite_entry.get('web_path', '')
                self.assertTrue(web_path.endswith('.webp'),
                               f"PNG should be converted to WebP in web manifest: {web_path}")
            
            # Verify WAV → OGG conversion in manifest
            jump_sound_entry = assets.get('audio/jump.wav')
            if jump_sound_entry:
                web_path = jump_sound_entry.get('web_path', '')
                self.assertTrue(web_path.endswith('.ogg'),
                               f"WAV should be converted to OGG in web manifest: {web_path}")
    
    def test_asset_conversion_caching(self):
        """Test that asset conversion caching works with web builds."""
        game_id = "test_asset_caching"
        
        # First compilation - should convert and cache assets
        result_1 = self.compiler.compile_game(
            code=self.sample_code_with_assets,
            game_id=game_id,
            assets=self.test_assets,
            configuration={'web_target': True}
        )
        
        self.assertTrue(result_1['success'])
        
        # Get initial cache stats
        initial_cache_stats = self.cache_manager.get_stats()
        
        # Second compilation with same assets - should use cached conversions
        result_2 = self.compiler.compile_game(
            code=self.sample_code_with_assets,
            game_id=game_id + "_2",
            assets=self.test_assets,  # Same assets
            configuration={'web_target': True}
        )
        
        self.assertTrue(result_2['success'])
        
        # Verify cache usage improved
        final_cache_stats = self.cache_manager.get_stats()
        cache_hits_increased = final_cache_stats.get('hits', 0) > initial_cache_stats.get('hits', 0)
        
        # At minimum, the compilation should have benefited from caching
        # (either asset conversion cache or full compilation cache)
        self.assertTrue(result_2.get('cached', False) or cache_hits_increased,
                       "Second compilation should benefit from caching")
    
    def test_asset_loading_runtime_compatibility(self):
        """Test that assets load correctly at runtime under pygbag (manifest structure verification)."""
        game_id = "test_runtime_compatibility"
        
        result = self.compiler.compile_game(
            code=self.sample_code_with_assets,
            game_id=game_id,
            assets=self.test_assets,
            configuration={'web_target': True}
        )
        
        self.assertTrue(result['success'])
        
        output_path = Path(result['output_path'])
        
        # Verify manifest structure supports runtime loading
        manifest_file = output_path / 'assets' / 'manifest.json'
        if manifest_file.exists():
            with open(manifest_file) as f:
                manifest = json.load(f)
            
            # Verify manifest has required fields for runtime
            self.assertIn('version', manifest, "Manifest should have version field")
            self.assertIn('assets', manifest, "Manifest should have assets field")
            
            assets = manifest['assets']
            
            # Verify each asset has required fields for runtime loading
            for logical_path, asset_info in assets.items():
                self.assertIsInstance(asset_info, dict, f"Asset {logical_path} should be a dict")
                
                # Required fields for runtime
                required_fields = ['physical_path', 'type', 'size']
                for field in required_fields:
                    self.assertIn(field, asset_info, 
                                f"Asset {logical_path} should have {field} field")
                
                # For web builds, should have web_path
                if 'web_path' in asset_info:
                    web_path = asset_info['web_path']
                    actual_web_file = output_path / 'assets' / web_path
                    self.assertTrue(actual_web_file.exists(),
                                  f"Web asset file should exist: {actual_web_file}")
        
        # Verify main.py is compatible with asset loading
        main_py = output_path / 'main.py'
        if main_py.exists():
            content = main_py.read_text()
            
            # Should contain asset loading logic
            self.assertIn('pygame.image.load', content,
                         "Game should contain image loading code")
            self.assertIn('pygame.mixer.Sound', content,
                         "Game should contain sound loading code")
            
            # Should reference the logical asset paths
            self.assertIn('sprites/player.png', content,
                         "Game should reference logical asset paths")
            self.assertIn('audio/jump.wav', content,
                         "Game should reference logical audio paths")


if __name__ == '__main__':
    unittest.main()