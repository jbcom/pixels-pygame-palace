"""
Targeted tests for the critical eviction bug fix.

This test specifically reproduces the issue where cache reaches over 122% utilization
but removes 0 entries during eviction, ensuring the fix works correctly.
"""

import os
import tempfile
import shutil
import time
from pathlib import Path
from unittest import TestCase

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from cache_manager import CacheManager, CacheKey, CacheStage


class TestEvictionBugFix(TestCase):
    """Test the specific eviction bug and its fix."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_eviction_bug_test_')
        # Small cache to easily trigger thresholds
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=2)
        
        # Configure to reproduce the exact bug scenario
        self.cache_manager.eviction_config.cleanup_threshold_percent = 80.0
        self.cache_manager.eviction_config.target_utilization_percent = 60.0
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass  # Best effort cleanup
    
    def test_critical_eviction_bug_reproduction_and_fix(self):
        """
        Reproduce the exact bug: cache reaches 122%+ utilization but removes 0 entries.
        Verify the fix ensures entries are actually removed and utilization is reduced.
        """
        print("\\n=== Testing Critical Eviction Bug Fix ===")
        
        # Disable automatic cleanup during filling to ensure we reach high utilization
        original_threshold = self.cache_manager.eviction_config.cleanup_threshold_percent
        self.cache_manager.eviction_config.cleanup_threshold_percent = 200.0  # Disable auto-cleanup
        
        # Fill cache well beyond threshold to reproduce 122%+ utilization
        cache_keys = []
        data_size = 1024 * 300  # 300KB per entry
        large_data = {'test_data': 'x' * data_size}
        
        # Add entries to significantly exceed threshold
        # 2MB cache, 80% threshold = 1.6MB limit
        # We'll add ~4.5MB to get to 225%+ utilization
        target_entries = 15  # 15 * 300KB = 4.5MB
        
        print(f"Adding {target_entries} entries of {data_size} bytes each...")
        print(f"Expected total: {target_entries * data_size / 1024 / 1024:.2f} MB")
        
        for i in range(target_entries):
            key = CacheKey('eviction_test', f'bug_repro_key_{i:03d}', CacheStage.CODE)
            success = self.cache_manager.put(key, large_data)
            if not success:
                print(f"WARNING: Failed to store entry {i}")
            cache_keys.append(key)
            time.sleep(0.001)  # Small delay to ensure different access times
        
        # Restore original threshold for cleanup test
        self.cache_manager.eviction_config.cleanup_threshold_percent = original_threshold
        
        # Get stats before cleanup to confirm high utilization
        stats_before = self.cache_manager._get_cache_size_stats()
        initial_utilization = (stats_before['total_size_bytes'] / self.cache_manager.eviction_config.max_cache_size_bytes) * 100
        
        print(f"Initial utilization: {initial_utilization:.1f}%")
        print(f"Total size before: {stats_before['total_size_bytes'] / 1024 / 1024:.2f} MB")
        print(f"Entry count before: {stats_before['entry_count']}")
        
        # Verify we've reproduced the problematic scenario (>122% utilization)
        self.assertGreater(initial_utilization, 122.0, 
                          f"Failed to reproduce high utilization scenario: {initial_utilization:.1f}%")
        
        # Force cleanup - this should now work correctly with the fix
        print("\\nTriggering eviction cleanup...")
        cleanup_result = self.cache_manager.force_cleanup()
        
        # Verify cleanup succeeded
        self.assertTrue(cleanup_result['success'], 
                       f"Cleanup should succeed: {cleanup_result}")
        
        # Get stats after cleanup
        stats_after = self.cache_manager._get_cache_size_stats()
        final_utilization = (stats_after['total_size_bytes'] / self.cache_manager.eviction_config.max_cache_size_bytes) * 100
        
        print(f"Final utilization: {final_utilization:.1f}%")
        print(f"Total size after: {stats_after['total_size_bytes'] / 1024 / 1024:.2f} MB")
        print(f"Entry count after: {stats_after['entry_count']}")
        print(f"Entries removed: {stats_before['entry_count'] - stats_after['entry_count']}")
        print(f"Utilization reduction: {initial_utilization - final_utilization:.1f}%")
        
        # CRITICAL: Verify that entries were actually removed (this was the bug)
        entries_removed = stats_before['entry_count'] - stats_after['entry_count']
        self.assertGreater(entries_removed, 0, 
                          "BUG: Eviction removed 0 entries despite high utilization!")
        
        # Verify utilization was significantly reduced
        utilization_reduction = initial_utilization - final_utilization
        self.assertGreater(utilization_reduction, 10.0,
                          f"Utilization should be significantly reduced, only reduced by {utilization_reduction:.1f}%")
        
        # Verify we're now below the cleanup threshold
        self.assertLess(final_utilization, self.cache_manager.eviction_config.cleanup_threshold_percent,
                       f"Final utilization {final_utilization:.1f}% should be below threshold {self.cache_manager.eviction_config.cleanup_threshold_percent}%")
        
        # Verify we're close to target utilization (within reasonable tolerance)
        target_util = self.cache_manager.eviction_config.target_utilization_percent
        self.assertLess(abs(final_utilization - target_util), 20.0,
                       f"Final utilization {final_utilization:.1f}% should be close to target {target_util}%")
        
        # Verify metrics were updated
        self.assertGreater(self.cache_manager.metrics.evictions, 0, 
                          "Should have recorded evictions in metrics")
        
        print(f"✅ Eviction bug fix verified successfully!")
        print(f"   - Removed {entries_removed} entries")
        print(f"   - Reduced utilization by {utilization_reduction:.1f}%")
        print(f"   - Achieved target utilization within tolerance")
    
    def test_lru_ordering_with_mixed_access_patterns(self):
        """Test that LRU ordering works correctly with mixed access patterns."""
        print("\\n=== Testing LRU Ordering Fix ===")
        
        # Add entries with controlled timing
        cache_keys = []
        for i in range(10):
            key = CacheKey('lru_test', f'lru_key_{i:03d}', CacheStage.ASSETS)
            data = {'order': i, 'data': 'x' * (1024 * 100)}  # 100KB each
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            cache_keys.append(key)
            time.sleep(0.01)  # Ensure different access times
        
        # Access some entries to change LRU order (making them newer)
        for i in [7, 8, 9]:  # Access the last 3 entries
            retrieved = self.cache_manager.get(cache_keys[i])
            self.assertIsNotNone(retrieved)
            time.sleep(0.01)
        
        # Force cleanup
        self.cache_manager.eviction_config.cleanup_threshold_percent = 70.0
        cleanup_result = self.cache_manager.force_cleanup()
        self.assertTrue(cleanup_result['success'])
        
        # Verify LRU behavior: older entries (0-6) should be more likely to be removed
        # than recently accessed entries (7-9)
        removed_old = sum(1 for i in range(7) if self.cache_manager.get(cache_keys[i]) is None)
        removed_new = sum(1 for i in range(7, 10) if self.cache_manager.get(cache_keys[i]) is None)
        
        # More old entries should be removed than new ones
        print(f"Removed old entries (0-6): {removed_old}")
        print(f"Removed new entries (7-9): {removed_new}")
        
        # Allow for some flexibility, but old entries should be preferentially removed
        self.assertGreaterEqual(removed_old, removed_new,
                               f"LRU ordering issue: removed {removed_old} old vs {removed_new} new entries")
        
        print("✅ LRU ordering verified correctly!")
    
    def test_edge_case_empty_cache_cleanup(self):
        """Test cleanup on empty cache doesn't cause errors."""
        cleanup_result = self.cache_manager.force_cleanup()
        self.assertTrue(cleanup_result['success'])
        
    def test_edge_case_single_entry_cleanup(self):
        """Test cleanup with single entry works correctly."""
        key = CacheKey('single_test', 'single_key', CacheStage.WEB)
        data = {'data': 'x' * (1024 * 1024 * 3)}  # 3MB - exceeds our 2MB cache
        success = self.cache_manager.put(key, data)
        self.assertTrue(success)
        
        # This should trigger cleanup immediately
        cleanup_result = self.cache_manager.force_cleanup()
        self.assertTrue(cleanup_result['success'])


if __name__ == '__main__':
    import unittest
    unittest.main(verbosity=2)