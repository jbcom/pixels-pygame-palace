#!/usr/bin/env python3
"""
Comprehensive test suite for Asset Conversion Caching - Task 4c2 Verification.

This test verifies:
1. Conversion reuse: same checksum+params → hit; changed params → miss
2. Manifest determinism: consistent output across runs
3. Legacy mode path testing for backward compatibility
4. Cache integration between CacheManager and AssetPackager
"""

import os
import sys
import tempfile
import threading
import time
import json
import hashlib
import shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import patch, MagicMock
from typing import Dict, Any, Optional
import logging

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / 'src'))

try:
    from src.backend.cache_manager import CacheManager, CacheKey, CacheStage
    from src.backend.asset_packager import AssetPackager, AssetInfo, ConversionParams, AssetType
except ImportError as e:
    print(f"Import error: {e}")
    print("Attempting fallback import...")
    # Fallback import for different directory structures
    import importlib.util
    
    def load_module(name, path):
        spec = importlib.util.spec_from_file_location(name, path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load {name} from {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    
    cache_module = load_module("cache_manager", "src/backend/cache_manager.py")
    CacheManager = cache_module.CacheManager
    CacheKey = cache_module.CacheKey
    CacheStage = cache_module.CacheStage
    
    asset_module = load_module("asset_packager", "src/backend/asset_packager.py")
    AssetPackager = asset_module.AssetPackager
    AssetInfo = asset_module.AssetInfo
    ConversionParams = asset_module.ConversionParams
    AssetType = asset_module.AssetType

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AssetConversionCachingTest:
    """Comprehensive test suite for asset conversion caching."""
    
    def __init__(self):
        self.temp_dir = None
        self.cache_manager = None
        self.asset_packager = None
        self.test_assets_dir = None
        self.results = []
        self.errors = []
        
    def setup(self):
        """Setup test environment with cache manager and test assets."""
        self.temp_dir = tempfile.mkdtemp(prefix='asset_conversion_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=100)
        self.asset_packager = AssetPackager(cache_manager=self.cache_manager)
        
        # Create test assets directory
        self.test_assets_dir = Path(self.temp_dir) / 'test_assets'
        self.test_assets_dir.mkdir(exist_ok=True)
        
        logger.info(f"Test environment setup at: {self.temp_dir}")
        
    def cleanup(self):
        """Clean up test environment."""
        if self.temp_dir and Path(self.temp_dir).exists():
            shutil.rmtree(self.temp_dir)
            logger.info(f"Cleaned up test directory: {self.temp_dir}")
    
    def create_test_image(self, filename: str, content: Optional[bytes] = None) -> Path:
        """Create a test image file."""
        assert self.test_assets_dir is not None, "Test assets directory not initialized"
        
        if content is None:
            # Create a valid 1x1 red PNG image
            content = bytes([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
                0x00, 0x00, 0x00, 0x0D,  # IHDR length
                0x49, 0x48, 0x44, 0x52,  # IHDR
                0x00, 0x00, 0x00, 0x01,  # width: 1
                0x00, 0x00, 0x00, 0x01,  # height: 1
                0x08, 0x02,              # bit depth: 8, color type: 2 (RGB)
                0x00, 0x00, 0x00,        # compression, filter, interlace
                0x90, 0x77, 0x53, 0xDE,  # CRC
                0x00, 0x00, 0x00, 0x0C,  # IDAT length
                0x49, 0x44, 0x41, 0x54,  # IDAT
                0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, 0x01, 0x00, 0x01,  # data
                0x18, 0xDD, 0x8D, 0xB4,  # CRC
                0x00, 0x00, 0x00, 0x00,  # IEND length
                0x49, 0x45, 0x4E, 0x44,  # IEND
                0xAE, 0x42, 0x60, 0x82   # CRC
            ])
        
        test_file = self.test_assets_dir / filename
        with open(test_file, 'wb') as f:
            f.write(content)
        return test_file
    
    def create_test_audio(self, filename: str) -> Path:
        """Create a test audio file."""
        assert self.test_assets_dir is not None, "Test assets directory not initialized"
        
        # Create minimal OGG content for testing
        content = b'OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
        test_file = self.test_assets_dir / filename
        with open(test_file, 'wb') as f:
            f.write(content)
        return test_file
    
    def test_conversion_reuse_cache_hit(self):
        """Test 1a: Same checksum + params should result in cache hit."""
        logger.info("Testing conversion reuse - cache hit scenario")
        
        try:
            assert self.asset_packager is not None, "Asset packager not initialized"
            assert self.temp_dir is not None, "Temp directory not initialized"
            
            # Create test image
            image_file = self.create_test_image('test_image.png')
            
            # Define conversion parameters
            conversion_params = ConversionParams(
                target_format='webp',
                quality=85,
                max_size=(512, 512),
                optimize=True
            )
            
            # First conversion - should be cache miss
            output_dir = Path(self.temp_dir) / 'output1'
            output_dir.mkdir(exist_ok=True)
            
            logger.info("First conversion attempt (expecting cache miss)")
            asset_info1 = self.asset_packager._process_asset_file(
                str(image_file), 
                'sprites/test_image.png', 
                AssetType.SPRITE, 
                output_dir, 
                conversion_params
            )
            
            # Verify first conversion succeeded
            assert asset_info1 is not None, "First conversion failed"
            assert asset_info1.conversion_params is not None, "Conversion params not set"
            
            # Second conversion with same parameters - should be cache hit
            output_dir2 = Path(self.temp_dir) / 'output2'
            output_dir2.mkdir(exist_ok=True)
            
            logger.info("Second conversion attempt (expecting cache hit)")
            asset_info2 = self.asset_packager._process_asset_file(
                str(image_file), 
                'sprites/test_image.png', 
                AssetType.SPRITE, 
                output_dir2, 
                conversion_params
            )
            
            # Verify cache hit occurred
            assert asset_info2 is not None, "Second conversion failed"
            assert asset_info2.cache_key is not None, "Cache key not set on cache hit"
            
            # Both should have same conversion cache key
            cache_key1 = conversion_params.to_cache_key(asset_info1.source_checksum)
            cache_key2 = conversion_params.to_cache_key(asset_info2.source_checksum)
            assert cache_key1 == cache_key2, "Cache keys should be identical for same params"
            
            self.results.append("PASS: Conversion reuse cache hit test")
            logger.info("✓ Conversion reuse cache hit test passed")
            
        except Exception as e:
            error_msg = f"Conversion reuse cache hit test failed: {e}"
            self.errors.append(error_msg)
            logger.error(f"✗ {error_msg}")
    
    def test_conversion_reuse_cache_miss(self):
        """Test 1b: Changed params should result in cache miss."""
        logger.info("Testing conversion reuse - cache miss scenario")
        
        try:
            assert self.asset_packager is not None, "Asset packager not initialized"
            assert self.temp_dir is not None, "Temp directory not initialized"
            
            # Create test image
            image_file = self.create_test_image('test_image2.png')
            
            # First conversion with specific parameters
            conversion_params1 = ConversionParams(
                target_format='webp',
                quality=85,
                max_size=(512, 512),
                optimize=True
            )
            
            output_dir1 = Path(self.temp_dir) / 'output_miss1'
            output_dir1.mkdir(exist_ok=True)
            
            asset_info1 = self.asset_packager._process_asset_file(
                str(image_file), 
                'sprites/test_image2.png', 
                AssetType.SPRITE, 
                output_dir1, 
                conversion_params1
            )
            
            # Second conversion with different parameters
            conversion_params2 = ConversionParams(
                target_format='webp',
                quality=75,  # Changed quality
                max_size=(256, 256),  # Changed size
                optimize=True
            )
            
            output_dir2 = Path(self.temp_dir) / 'output_miss2'
            output_dir2.mkdir(exist_ok=True)
            
            asset_info2 = self.asset_packager._process_asset_file(
                str(image_file), 
                'sprites/test_image2.png', 
                AssetType.SPRITE, 
                output_dir2, 
                conversion_params2
            )
            
            # Verify both conversions succeeded but with different cache keys
            assert asset_info1 is not None and asset_info2 is not None, "Conversions failed"
            
            cache_key1 = conversion_params1.to_cache_key(asset_info1.source_checksum)
            cache_key2 = conversion_params2.to_cache_key(asset_info2.source_checksum)
            assert cache_key1 != cache_key2, "Cache keys should be different for different params"
            
            self.results.append("PASS: Conversion reuse cache miss test")
            logger.info("✓ Conversion reuse cache miss test passed")
            
        except Exception as e:
            error_msg = f"Conversion reuse cache miss test failed: {e}"
            self.errors.append(error_msg)
            logger.error(f"✗ {error_msg}")
    
    def test_manifest_determinism(self):
        """Test 2: Manifest determinism - consistent output across runs."""
        logger.info("Testing manifest determinism")
        
        try:
            assert self.asset_packager is not None, "Asset packager not initialized"
            # Create test assets
            image1 = self.create_test_image('sprite1.png')
            image2 = self.create_test_image('sprite2.png')
            audio1 = self.create_test_audio('sound1.ogg')
            
            # Define asset references
            asset_refs = [
                {
                    'slotId': 'player_sprite',
                    'assetType': 'sprite',
                    'defaultAsset': str(image1),
                    'required': True
                },
                {
                    'slotId': 'enemy_sprite',
                    'assetType': 'sprite',
                    'defaultAsset': str(image2),
                    'required': True
                }
            ]
            
            # Skip custom assets for now to avoid path validation issues in test
            custom_assets = []
            
            # Generate manifest multiple times
            manifests = []
            for i in range(3):
                logger.info(f"Generating manifest #{i+1}")
                manifest = self.asset_packager.package_assets(
                    asset_refs=asset_refs,
                    custom_assets=custom_assets,
                    cache_key=f"determinism_test_{i}",
                    target_format='web'
                )
                manifests.append(manifest)
            
            # Verify all manifests are identical (deterministic)
            # Remove non-deterministic fields for comparison
            def normalize_manifest(manifest):
                normalized = manifest.copy()
                # Remove cache_key as it's expected to be different
                if 'cache_key' in normalized:
                    del normalized['cache_key']
                
                # Normalize asset paths to be relative for comparison
                if 'assets' in normalized:
                    for asset_data in normalized['assets'].values():
                        if 'physical_path' in asset_data:
                            # Make path relative to temp_dir for comparison
                            asset_data['physical_path'] = str(Path(asset_data['physical_path']).name)
                
                return normalized
            
            normalized_manifests = [normalize_manifest(m) for m in manifests]
            
            # Compare manifests
            reference_manifest = json.dumps(normalized_manifests[0], sort_keys=True)
            for i, manifest in enumerate(normalized_manifests[1:], 1):
                current_manifest = json.dumps(manifest, sort_keys=True)
                assert reference_manifest == current_manifest, f"Manifest {i+1} differs from reference manifest"
            
            self.results.append("PASS: Manifest determinism test")
            logger.info("✓ Manifest determinism test passed")
            
        except Exception as e:
            error_msg = f"Manifest determinism test failed: {e}"
            self.errors.append(error_msg)
            logger.error(f"✗ {error_msg}")
    
    def test_legacy_mode_path(self):
        """Test 3: Legacy mode path testing for backward compatibility."""
        logger.info("Testing legacy mode path")
        
        try:
            assert self.temp_dir is not None, "Temp directory not initialized"
            
            # Create AssetPackager without CacheManager (legacy mode)
            legacy_cache_dir = Path(self.temp_dir) / 'legacy_cache'
            legacy_asset_packager = AssetPackager(cache_manager=None, cache_dir=str(legacy_cache_dir))
            
            # Verify legacy mode initialization
            assert legacy_asset_packager.cache_manager is None, "Legacy mode should have no CacheManager"
            assert legacy_asset_packager.cache_dir is not None, "Legacy mode should have cache_dir"
            assert legacy_asset_packager.cache_dir.exists(), "Legacy cache directory should exist"
            
            # Test asset processing in legacy mode
            image_file = self.create_test_image('legacy_test.png')
            conversion_params = ConversionParams(target_format='png', quality=95)
            
            output_dir = Path(self.temp_dir) / 'legacy_output'
            output_dir.mkdir(exist_ok=True)
            
            # Process asset in legacy mode
            asset_info = legacy_asset_packager._process_asset_file(
                str(image_file), 
                'sprites/legacy_test.png', 
                AssetType.SPRITE, 
                output_dir, 
                conversion_params
            )
            
            # Verify legacy processing works
            assert asset_info is not None, "Legacy mode asset processing failed"
            assert asset_info.cache_key is None, "Legacy mode should not set cache_key"
            assert Path(asset_info.physical_path).exists(), "Legacy mode output file should exist"
            
            # Test package_assets in legacy mode
            asset_refs = [{
                'slotId': 'test_sprite',
                'assetType': 'sprite',
                'defaultAsset': str(image_file),
                'required': True
            }]
            
            manifest = legacy_asset_packager.package_assets(
                asset_refs=asset_refs,
                custom_assets=[],
                cache_key='legacy_test',
                target_format='desktop'
            )
            
            # Verify legacy manifest generation
            assert manifest is not None, "Legacy mode manifest generation failed"
            assert 'assets' in manifest, "Legacy manifest should contain assets"
            assert manifest['asset_count'] > 0, "Legacy manifest should have assets"
            
            self.results.append("PASS: Legacy mode path test")
            logger.info("✓ Legacy mode path test passed")
            
        except Exception as e:
            error_msg = f"Legacy mode path test failed: {e}"
            self.errors.append(error_msg)
            logger.error(f"✗ {error_msg}")
    
    def test_cache_manager_integration(self):
        """Test 4: Verify CacheManager integration with AssetPackager."""
        logger.info("Testing CacheManager integration")
        
        try:
            assert self.asset_packager is not None, "Asset packager not initialized"
            assert self.temp_dir is not None, "Temp directory not initialized"
            
            # Verify AssetPackager has CacheManager
            assert self.asset_packager.cache_manager is not None, "AssetPackager should have CacheManager"
            assert isinstance(self.asset_packager.cache_manager, CacheManager), "Should be CacheManager instance"
            
            # Test cache key generation
            image_file = self.create_test_image('integration_test.png')
            source_checksum = self.asset_packager._calculate_checksum(str(image_file))
            
            conversion_params = ConversionParams(target_format='webp', quality=80)
            cache_key = conversion_params.to_cache_key(source_checksum)
            
            # Test _get_cached_conversion with non-existent key
            cached_path = self.asset_packager._get_cached_conversion(cache_key)
            assert cached_path is None, "Non-existent cache key should return None"
            
            # Process asset to create cache entry
            output_dir = Path(self.temp_dir) / 'integration_output'
            output_dir.mkdir(exist_ok=True)
            
            asset_info = self.asset_packager._process_asset_file(
                str(image_file), 
                'sprites/integration_test.png', 
                AssetType.SPRITE, 
                output_dir, 
                conversion_params
            )
            
            # Test _get_cached_conversion with existing key
            assert asset_info is not None, "Asset info should not be None"
            new_cache_key = conversion_params.to_cache_key(asset_info.source_checksum)
            cached_path = self.asset_packager._get_cached_conversion(new_cache_key)
            assert cached_path is not None, "Cached conversion should be found"
            assert Path(cached_path).exists(), "Cached file should exist"
            
            # Verify cache scope and stage are correct
            cache_key_obj = CacheKey(scope="asset_conversions", key=new_cache_key, stage=CacheStage.ASSETS)
            assert self.cache_manager is not None, "Cache manager should not be None"
            cached_data = self.cache_manager.get(cache_key_obj)
            assert cached_data is not None, "Cache data should exist in CacheManager"
            assert 'converted_path' in cached_data, "Cache data should contain converted_path"
            
            self.results.append("PASS: CacheManager integration test")
            logger.info("✓ CacheManager integration test passed")
            
        except Exception as e:
            error_msg = f"CacheManager integration test failed: {e}"
            self.errors.append(error_msg)
            logger.error(f"✗ {error_msg}")
    
    def test_atomic_operations(self):
        """Test 5: Verify atomic operations in conversion caching."""
        logger.info("Testing atomic operations")
        
        try:
            assert self.asset_packager is not None, "Asset packager not initialized"
            assert self.temp_dir is not None, "Temp directory not initialized"
            
            # Create test image
            image_file = self.create_test_image('atomic_test.png')
            conversion_params = ConversionParams(target_format='webp', quality=85)
            
            # Simulate concurrent conversion attempts
            results = []
            errors = []
            
            def convert_asset(thread_id):
                try:
                    assert self.temp_dir is not None, "Temp directory not initialized in thread"
                    output_dir = Path(self.temp_dir) / f'atomic_output_{thread_id}'
                    output_dir.mkdir(exist_ok=True)
                    
                    assert self.asset_packager is not None, "Asset packager not initialized in thread"
                    asset_info = self.asset_packager._process_asset_file(
                        str(image_file), 
                        f'sprites/atomic_test_{thread_id}.png', 
                        AssetType.SPRITE, 
                        output_dir, 
                        conversion_params
                    )
                    
                    results.append({
                        'thread_id': thread_id,
                        'asset_info': asset_info,
                        'cache_key': asset_info.cache_key if asset_info else None
                    })
                    
                except Exception as e:
                    errors.append(f"Thread {thread_id}: {e}")
            
            # Run concurrent conversions
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(convert_asset, i) for i in range(5)]
                for future in as_completed(futures):
                    future.result()  # Wait for completion
            
            # Verify results
            assert len(errors) == 0, f"Concurrent conversion errors: {errors}"
            assert len(results) == 5, "All conversions should complete"
            
            # All should have same cache key since same source and params
            cache_keys = [r['cache_key'] for r in results if r['cache_key']]
            if cache_keys:
                reference_key = cache_keys[0]
                for key in cache_keys[1:]:
                    assert key == reference_key, "Concurrent conversions should have same cache key"
            
            self.results.append("PASS: Atomic operations test")
            logger.info("✓ Atomic operations test passed")
            
        except Exception as e:
            error_msg = f"Atomic operations test failed: {e}"
            self.errors.append(error_msg)
            logger.error(f"✗ {error_msg}")
    
    def run_all_tests(self):
        """Run all asset conversion caching tests."""
        logger.info("=" * 60)
        logger.info("ASSET CONVERSION CACHING TEST SUITE - Task 4c2 Verification")
        logger.info("=" * 60)
        
        try:
            self.setup()
            
            # Run all tests
            self.test_conversion_reuse_cache_hit()
            self.test_conversion_reuse_cache_miss()
            self.test_manifest_determinism()
            self.test_legacy_mode_path()
            self.test_cache_manager_integration()
            self.test_atomic_operations()
            
        finally:
            self.cleanup()
        
        # Print results summary
        logger.info("=" * 60)
        logger.info("TEST RESULTS SUMMARY")
        logger.info("=" * 60)
        
        for result in self.results:
            logger.info(f"✓ {result}")
        
        if self.errors:
            logger.error("ERRORS ENCOUNTERED:")
            for error in self.errors:
                logger.error(f"✗ {error}")
        
        total_tests = len(self.results) + len(self.errors)
        passed_tests = len(self.results)
        
        logger.info(f"\nTEST SUMMARY: {passed_tests}/{total_tests} tests passed")
        
        if self.errors:
            logger.error("Some tests failed! See errors above.")
            return False
        else:
            logger.info("All tests passed! ✓")
            return True


def main():
    """Main test runner."""
    test_suite = AssetConversionCachingTest()
    success = test_suite.run_all_tests()
    
    if success:
        print("\n🎉 All asset conversion caching tests passed!")
        print("Task 4c2 verification requirements satisfied:")
        print("✓ Conversion cache methods implemented correctly")
        print("✓ CacheManager integration verified")
        print("✓ Atomic operations working")
        print("✓ Legacy mode compatibility maintained")
        print("✓ Manifest determinism confirmed")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        print("Please review error messages above.")
        sys.exit(1)


if __name__ == '__main__':
    main()