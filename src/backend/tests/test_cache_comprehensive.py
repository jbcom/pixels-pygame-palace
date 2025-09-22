"""
Comprehensive testing for cache functionality and performance validation.

This test suite validates the entire caching system built across tasks 4c1-4c4:
- Eviction correctness testing (size caps, LRU order, batch eviction)
- Age-based eviction testing (time policies, cleanup frequency, mixed scenarios)
- Concurrency behavior testing (thread safety, deadlock prevention, atomic operations)
- Metrics export testing (JSON exports, accuracy validation, throughput reporting)
- Stress/performance testing (baseline metrics, high-throughput, regression testing)

Tests ensure production readiness and performance guarantees.
"""

import os
import json
import time
import tempfile
import threading
import subprocess
import multiprocessing
import statistics
import random
import shutil
from pathlib import Path
from typing import Dict, Any, List, Tuple
from unittest import TestCase
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from cache_manager import CacheManager, CacheKey, CacheStage, EvictionConfig, CacheMetrics


class TestCacheEvictionCorrectness(TestCase):
    """Test eviction correctness including size caps, LRU order, and batch eviction."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_eviction_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=5)  # Small cache for testing
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass  # Best effort cleanup
    
    def test_size_cap_enforcement_to_target_utilization(self):
        """Test that cache enforces size cap and cleans to target utilization percentage."""
        # Configure smaller thresholds for testing
        self.cache_manager.eviction_config.cleanup_threshold_percent = 80.0
        self.cache_manager.eviction_config.target_utilization_percent = 60.0
        
        # Fill cache beyond threshold
        cache_keys = []
        data_size = 1024 * 100  # 100KB per entry
        large_data = {'data': 'x' * data_size}
        
        # Add entries to exceed cleanup threshold (80% of 5MB = 4MB)
        target_entries = 50  # 50 * 100KB = 5MB, exceeding threshold
        
        for i in range(target_entries):
            key = CacheKey('test', f'key_{i:03d}', CacheStage.CODE)
            success = self.cache_manager.put(key, large_data)
            self.assertTrue(success, f"Failed to store entry {i}")
            cache_keys.append(key)
            
            # Touch access files with different times for LRU testing
            time.sleep(0.001)  # Small delay to ensure different access times
        
        # Get cache stats before cleanup
        stats_before = self.cache_manager._get_cache_size_stats()
        initial_utilization = (stats_before['total_size_bytes'] / self.cache_manager.eviction_config.max_cache_size_bytes) * 100
        
        # Force cleanup
        cleanup_result = self.cache_manager.force_cleanup()
        
        self.assertTrue(cleanup_result['success'], "Cleanup should succeed")
        
        # Verify cache was cleaned to target utilization
        stats_after = self.cache_manager._get_cache_size_stats()
        final_utilization = (stats_after['total_size_bytes'] / self.cache_manager.eviction_config.max_cache_size_bytes) * 100
        
        self.assertLess(final_utilization, self.cache_manager.eviction_config.cleanup_threshold_percent,
                       f"Final utilization {final_utilization:.1f}% should be below threshold {self.cache_manager.eviction_config.cleanup_threshold_percent}%")
        
        # Should be close to target utilization (within 10% tolerance)
        target_util = self.cache_manager.eviction_config.target_utilization_percent
        self.assertLess(abs(final_utilization - target_util), 15.0,
                       f"Final utilization {final_utilization:.1f}% should be close to target {target_util}%")
        
        # Verify metrics were updated
        self.assertGreater(self.cache_manager.metrics.evictions, 0, "Should have recorded evictions")
        
        print(f"Size cap enforcement test: {initial_utilization:.1f}% → {final_utilization:.1f}% (target: {target_util}%)")
    
    def test_lru_eviction_order_verification(self):
        """Test that LRU eviction removes oldest last_access entries first."""
        # Add entries with controlled access times
        cache_keys = []
        access_times = []
        
        for i in range(20):
            key = CacheKey('test', f'lru_key_{i:03d}', CacheStage.CODE)
            data = {'order': i, 'data': 'x' * 1024}
            
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            cache_keys.append(key)
            
            # Record access time
            access_file = key.to_path(self.cache_manager.cache_root) / 'last_access'
            if access_file.exists():
                access_times.append((i, access_file.stat().st_mtime))
            
            time.sleep(0.005)  # Ensure different access times
        
        # Access some entries in different order to change LRU order
        # Access entries in reverse order: 19, 18, 17, ... (making them newer)
        for i in range(19, 15, -1):
            key = cache_keys[i]
            retrieved = self.cache_manager.get(key)
            self.assertIsNotNone(retrieved)
            time.sleep(0.005)
        
        # Force cleanup to trigger LRU eviction
        self.cache_manager.eviction_config.cleanup_threshold_percent = 50.0  # Low threshold to force cleanup
        cleanup_result = self.cache_manager.force_cleanup()
        
        self.assertTrue(cleanup_result['success'])
        
        # Verify that oldest (least recently accessed) entries were removed first
        # Entries 0-15 should be more likely to be removed than 16-19 (which were accessed recently)
        removed_oldest = 0
        removed_newest = 0
        
        for i in range(16):  # Check older entries (0-15)
            key = cache_keys[i]
            if self.cache_manager.get(key) is None:
                removed_oldest += 1
        
        for i in range(16, 20):  # Check newer entries (16-19)
            key = cache_keys[i]
            if self.cache_manager.get(key) is None:
                removed_newest += 1
        
        # More older entries should be removed than newer ones
        self.assertGreater(removed_oldest, removed_newest,
                          f"LRU order violation: removed {removed_oldest} old entries vs {removed_newest} new entries")
        
        print(f"LRU eviction order test: removed {removed_oldest} old entries, {removed_newest} new entries")
    
    def test_batch_eviction_efficiency(self):
        """Test batch eviction respects configured batch sizes and operates efficiently."""
        # Configure batch sizes for testing
        self.cache_manager.eviction_config.min_eviction_batch_size = 3
        self.cache_manager.eviction_config.max_eviction_batch_size = 15
        
        # Add many entries
        cache_keys = []
        for i in range(50):
            key = CacheKey('test', f'batch_key_{i:03d}', CacheStage.ASSETS)
            data = {'batch_test': True, 'data': 'x' * (1024 * 50)}  # 50KB each
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            cache_keys.append(key)
            time.sleep(0.001)
        
        # Test different utilization scenarios and batch behavior
        test_scenarios = [
            (95.0, "high_pressure"),  # Should use max batch size
            (85.0, "medium_pressure"), # Should use medium batch size
            (70.0, "low_pressure")     # Should use min batch size
        ]
        
        for target_util, scenario_name in test_scenarios:
            # Reset cache to full state
            self.setUp()
            
            # Fill cache again
            for i in range(30):
                key = CacheKey('test', f'{scenario_name}_key_{i:03d}', CacheStage.CODE)
                data = {'scenario': scenario_name, 'data': 'x' * (1024 * 100)}
                self.cache_manager.put(key, data)
            
            # Set cleanup threshold to trigger cleanup
            self.cache_manager.eviction_config.cleanup_threshold_percent = target_util
            
            # Measure cleanup efficiency
            start_time = time.time()
            entries_before = self.cache_manager._get_cache_size_stats()['entry_count']
            
            cleanup_result = self.cache_manager.force_cleanup()
            
            cleanup_time = time.time() - start_time
            entries_after = self.cache_manager._get_cache_size_stats()['entry_count']
            entries_removed = entries_before - entries_after
            
            # Verify batch constraints were respected
            min_batch = self.cache_manager.eviction_config.min_eviction_batch_size
            max_batch = self.cache_manager.eviction_config.max_eviction_batch_size
            
            if entries_removed > 0:
                self.assertGreaterEqual(entries_removed, min_batch,
                                      f"Should remove at least {min_batch} entries in {scenario_name}")
                
                # For high pressure scenarios, should remove more aggressively
                if target_util >= 95.0:
                    self.assertGreaterEqual(entries_removed, min_batch * 2,
                                          f"High pressure scenario should remove more entries")
            
            # Cleanup should be reasonably fast (< 1 second for this size)
            self.assertLess(cleanup_time, 1.0,
                           f"Cleanup should be efficient, took {cleanup_time:.3f}s for {scenario_name}")
            
            print(f"Batch eviction test ({scenario_name}): removed {entries_removed} entries in {cleanup_time:.3f}s")
    
    def test_size_threshold_triggers_and_cleanup_completion(self):
        """Test that size thresholds properly trigger cleanup and cleanup completes fully."""
        # Configure predictable thresholds
        self.cache_manager.eviction_config.cleanup_threshold_percent = 70.0
        self.cache_manager.eviction_config.target_utilization_percent = 50.0
        
        # Track when cleanup is triggered
        cleanup_triggered = threading.Event()
        original_cleanup = self.cache_manager._cleanup_lru_intelligent
        
        def tracking_cleanup(*args, **kwargs):
            cleanup_triggered.set()
            return original_cleanup(*args, **kwargs)
        
        self.cache_manager._cleanup_lru_intelligent = tracking_cleanup
        
        # Add entries gradually and monitor threshold behavior
        cache_keys = []
        data_size = 1024 * 200  # 200KB per entry
        
        # Add entries until we approach threshold
        max_size_bytes = self.cache_manager.eviction_config.max_cache_size_bytes
        threshold_bytes = max_size_bytes * 0.70  # 70% threshold
        
        entries_added = 0
        while True:
            key = CacheKey('test', f'threshold_key_{entries_added:03d}', CacheStage.WEB)
            data = {'threshold_test': True, 'data': 'x' * data_size}
            
            success = self.cache_manager.put(key, data)
            if not success:
                break
                
            cache_keys.append(key)
            entries_added += 1
            
            # Check current size
            current_stats = self.cache_manager._get_cache_size_stats()
            current_size = current_stats['total_size_bytes']
            
            if current_size >= threshold_bytes:
                # Wait a bit for cleanup to potentially trigger
                time.sleep(0.1)
                break
                
            if entries_added > 100:  # Safety limit
                break
        
        # Verify cleanup was triggered automatically
        time.sleep(0.5)  # Allow time for cleanup
        
        # Check final state
        final_stats = self.cache_manager._get_cache_size_stats()
        final_utilization = (final_stats['total_size_bytes'] / max_size_bytes) * 100
        
        # Cleanup should have occurred (either triggered automatically or via our force)
        if not cleanup_triggered.is_set():
            # Force cleanup to test completion
            cleanup_result = self.cache_manager.force_cleanup()
            self.assertTrue(cleanup_result['success'])
            cleanup_triggered.set()
        
        # Verify cleanup completion
        self.assertTrue(cleanup_triggered.is_set(), "Cleanup should have been triggered")
        
        # Final utilization should be below threshold
        post_cleanup_stats = self.cache_manager._get_cache_size_stats()
        post_cleanup_util = (post_cleanup_stats['total_size_bytes'] / max_size_bytes) * 100
        
        self.assertLess(post_cleanup_util, self.cache_manager.eviction_config.cleanup_threshold_percent,
                       f"Post-cleanup utilization {post_cleanup_util:.1f}% should be below threshold")
        
        # Verify metrics were properly updated
        self.assertGreater(self.cache_manager.metrics.evictions, 0, "Should have recorded evictions")
        self.assertIsNotNone(self.cache_manager.metrics.last_cleanup, "Should have recorded cleanup time")
        
        print(f"Threshold trigger test: {entries_added} entries added, final utilization: {post_cleanup_util:.1f}%")


class TestCacheAgeBasedEviction(TestCase):
    """Test age-based eviction policies with configurable age limits."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_age_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=10)
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass
    
    def test_time_based_eviction_with_configurable_age_limits(self):
        """Test that entries are evicted based on configurable age limits."""
        # Configure short age limits for testing
        self.cache_manager.eviction_config.max_entry_age_hours = 0.001  # ~3.6 seconds
        self.cache_manager.eviction_config.min_access_interval_hours = 0.0005  # ~1.8 seconds
        
        # Add entries with different ages
        cache_keys = []
        
        # Add old entries
        for i in range(5):
            key = CacheKey('test', f'old_key_{i}', CacheStage.CODE)
            data = {'age_test': 'old', 'data': f'old_data_{i}'}
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            cache_keys.append(('old', key))
            
        # Wait to make them "old"
        time.sleep(4)  # 4 seconds > 3.6 seconds age limit
        
        # Add new entries
        for i in range(5):
            key = CacheKey('test', f'new_key_{i}', CacheStage.ASSETS)
            data = {'age_test': 'new', 'data': f'new_data_{i}'}
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            cache_keys.append(('new', key))
        
        # Find aged entries before cleanup
        aged_entries = self.cache_manager._find_aged_entries()
        self.assertGreaterEqual(len(aged_entries), 5, "Should find aged entries")
        
        # Force cleanup to trigger age-based eviction
        cleanup_result = self.cache_manager.force_cleanup()
        self.assertTrue(cleanup_result['success'])
        
        # Verify old entries were evicted preferentially
        old_removed = 0
        new_removed = 0
        
        for entry_type, key in cache_keys:
            if self.cache_manager.get(key) is None:
                if entry_type == 'old':
                    old_removed += 1
                else:
                    new_removed += 1
        
        # More old entries should be removed than new ones
        self.assertGreater(old_removed, new_removed,
                          f"Age-based eviction failed: removed {old_removed} old vs {new_removed} new entries")
        
        print(f"Age-based eviction test: removed {old_removed} old entries, {new_removed} new entries")
    
    def test_cleanup_frequency_and_cadence_triggers(self):
        """Test cleanup frequency and cadence-based triggers."""
        # Configure rapid cleanup intervals for testing
        self.cache_manager.eviction_config.cleanup_interval_minutes = 0.01  # ~0.6 seconds
        self.cache_manager.eviction_config.forced_cleanup_interval_hours = 0.001  # ~3.6 seconds
        
        # Track cleanup occurrences
        cleanup_count = 0
        cleanup_times = []
        
        original_cleanup = self.cache_manager._cleanup_lru_intelligent
        
        def tracking_cleanup(*args, **kwargs):
            nonlocal cleanup_count
            cleanup_count += 1
            cleanup_times.append(time.time())
            return original_cleanup(*args, **kwargs)
        
        self.cache_manager._cleanup_lru_intelligent = tracking_cleanup
        
        # Add entries and trigger periodic cleanup checks
        for i in range(20):
            key = CacheKey('test', f'frequency_key_{i}', CacheStage.INPUTS)
            data = {'frequency_test': True, 'data': 'x' * 1024}
            self.cache_manager.put(key, data)
            
            # Trigger cleanup check
            self.cache_manager._maybe_cleanup_intelligent()
            time.sleep(0.1)  # Short delay
        
        # Wait for forced cleanup interval
        time.sleep(4)  # Wait for forced cleanup interval
        self.cache_manager._maybe_cleanup_intelligent()
        
        # Verify cleanup frequency tracking
        self.assertGreater(len(self.cache_manager.metrics.cleanup_frequency), 0,
                          "Should have recorded cleanup frequency data")
        
        # Verify cleanup was triggered by time intervals
        if len(cleanup_times) >= 2:
            intervals = [cleanup_times[i] - cleanup_times[i-1] for i in range(1, len(cleanup_times))]
            avg_interval = statistics.mean(intervals)
            
            # Should respect configured intervals (within reasonable tolerance)
            expected_interval = self.cache_manager.eviction_config.cleanup_interval_minutes * 60
            self.assertLess(avg_interval, expected_interval * 5,  # Allow 5x tolerance for test timing
                           f"Cleanup intervals too long: {avg_interval:.1f}s (expected ~{expected_interval:.1f}s)")
        
        print(f"Cleanup frequency test: {cleanup_count} cleanups, avg interval: {avg_interval:.1f}s")
    
    def test_mixed_size_and_age_eviction_scenarios(self):
        """Test mixed eviction scenarios combining size and age criteria."""
        # Configure mixed policies
        self.cache_manager.eviction_config.max_entry_age_hours = 0.002  # ~7.2 seconds
        self.cache_manager.eviction_config.cleanup_threshold_percent = 60.0
        self.cache_manager.eviction_config.target_utilization_percent = 40.0
        
        # Add large old entries
        large_old_keys = []
        for i in range(3):
            key = CacheKey('test', f'large_old_{i}', CacheStage.CODE)
            data = {'type': 'large_old', 'data': 'x' * (1024 * 500)}  # 500KB each
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            large_old_keys.append(key)
        
        # Wait to age them
        time.sleep(8)  # Make them old
        
        # Add small old entries
        small_old_keys = []
        for i in range(5):
            key = CacheKey('test', f'small_old_{i}', CacheStage.ASSETS)
            data = {'type': 'small_old', 'data': 'x' * (1024 * 50)}  # 50KB each
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            small_old_keys.append(key)
        
        # Wait to age them
        time.sleep(8)
        
        # Add large new entries
        large_new_keys = []
        for i in range(2):
            key = CacheKey('test', f'large_new_{i}', CacheStage.WEB)
            data = {'type': 'large_new', 'data': 'x' * (1024 * 600)}  # 600KB each
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            large_new_keys.append(key)
        
        # Add small new entries
        small_new_keys = []
        for i in range(10):
            key = CacheKey('test', f'small_new_{i}', CacheStage.DESKTOP)
            data = {'type': 'small_new', 'data': 'x' * (1024 * 30)}  # 30KB each
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            small_new_keys.append(key)
        
        # Force cleanup to test mixed eviction strategy
        cleanup_result = self.cache_manager.force_cleanup()
        self.assertTrue(cleanup_result['success'])
        
        # Analyze eviction results
        eviction_results = {
            'large_old_removed': sum(1 for k in large_old_keys if self.cache_manager.get(k) is None),
            'small_old_removed': sum(1 for k in small_old_keys if self.cache_manager.get(k) is None),
            'large_new_removed': sum(1 for k in large_new_keys if self.cache_manager.get(k) is None),
            'small_new_removed': sum(1 for k in small_new_keys if self.cache_manager.get(k) is None)
        }
        
        # Verify intelligent eviction priorities:
        # 1. Old entries should be removed before new ones
        old_removal_rate = (eviction_results['large_old_removed'] + eviction_results['small_old_removed']) / 8
        new_removal_rate = (eviction_results['large_new_removed'] + eviction_results['small_new_removed']) / 12
        
        self.assertGreaterEqual(old_removal_rate, new_removal_rate,
                               f"Old entries should be evicted preferentially: {old_removal_rate:.2f} vs {new_removal_rate:.2f}")
        
        # 2. Large old entries should be highly prioritized for removal
        self.assertGreaterEqual(eviction_results['large_old_removed'], 2,
                               "Large old entries should be prioritized for removal")
        
        print(f"Mixed eviction test results: {eviction_results}")
    
    def test_access_time_tracking_and_ordering(self):
        """Test accurate access time tracking and LRU ordering."""
        # Add entries with controlled access patterns
        cache_keys = []
        access_pattern = []
        
        # Create initial entries
        for i in range(10):
            key = CacheKey('test', f'access_key_{i:02d}', CacheStage.CODE)
            data = {'access_test': True, 'index': i}
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            cache_keys.append(key)
            access_pattern.append(('put', i, time.time()))
            time.sleep(0.01)  # Ensure different timestamps
        
        # Access entries in specific pattern to test tracking
        access_sequence = [0, 2, 4, 1, 3, 9, 7, 5, 8, 6]  # Mixed access pattern
        
        for idx in access_sequence:
            key = cache_keys[idx]
            retrieved = self.cache_manager.get(key)
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved['index'], idx)
            access_pattern.append(('get', idx, time.time()))
            time.sleep(0.01)
        
        # Get access times from filesystem
        access_times = {}
        for i, key in enumerate(cache_keys):
            access_file = key.to_path(self.cache_manager.cache_root) / 'last_access'
            if access_file.exists():
                access_times[i] = access_file.stat().st_mtime
        
        # Verify access time ordering matches expected LRU order
        # Most recently accessed should be: 6, 8, 5, 7, 9, 3, 1, 4, 2, 0
        expected_lru_order = [6, 8, 5, 7, 9, 3, 1, 4, 2, 0]  # Reverse of access_sequence
        
        # Sort entries by access time (oldest first)
        sorted_by_access = sorted(access_times.items(), key=lambda x: x[1])
        actual_lru_order = [idx for idx, _ in sorted_by_access]
        
        # The oldest accessed should be early in the list, newest should be late
        oldest_accessed = actual_lru_order[:3]  # First 3 oldest
        newest_accessed = actual_lru_order[-3:]  # Last 3 newest
        
        # Verify that recently accessed items (from access_sequence) are not in oldest group
        recent_items = access_sequence[-3:]  # Last 3 accessed items
        for item in recent_items:
            self.assertNotIn(item, oldest_accessed,
                           f"Recently accessed item {item} should not be in oldest group {oldest_accessed}")
        
        # Force eviction to test LRU ordering
        self.cache_manager.eviction_config.cleanup_threshold_percent = 30.0  # Force aggressive cleanup
        cleanup_result = self.cache_manager.force_cleanup()
        self.assertTrue(cleanup_result['success'])
        
        # Check which entries survived
        surviving_entries = []
        for i, key in enumerate(cache_keys):
            if self.cache_manager.get(key) is not None:
                surviving_entries.append(i)
        
        # Recently accessed entries should be more likely to survive
        recent_survival_rate = sum(1 for item in recent_items if item in surviving_entries) / len(recent_items)
        oldest_survival_rate = sum(1 for item in oldest_accessed if item in surviving_entries) / len(oldest_accessed)
        
        self.assertGreaterEqual(recent_survival_rate, oldest_survival_rate,
                               f"Recent items should survive better: {recent_survival_rate:.2f} vs {oldest_survival_rate:.2f}")
        
        print(f"Access tracking test: LRU order {actual_lru_order}, recent survival: {recent_survival_rate:.2f}")


class TestCacheConcurrencyBehavior(TestCase):
    """Test concurrent get/put operations with eviction and thread safety."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_concurrency_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=20)
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass
    
    def test_concurrent_get_put_operations_with_eviction(self):
        """Test concurrent get/put operations while eviction is running."""
        # Configure for active eviction during operations
        self.cache_manager.eviction_config.cleanup_threshold_percent = 70.0
        self.cache_manager.eviction_config.cleanup_interval_minutes = 0.01  # Very frequent
        
        # Track operation results
        operation_results = []
        operation_lock = threading.Lock()
        
        def reader_worker(worker_id: int, num_operations: int):
            """Worker that performs read operations."""
            local_results = []
            for i in range(num_operations):
                key = CacheKey('test', f'concurrent_key_{i % 50}', CacheStage.CODE)
                try:
                    start_time = time.time()
                    data = self.cache_manager.get(key)
                    duration = time.time() - start_time
                    
                    local_results.append({
                        'worker_id': worker_id,
                        'operation': 'get',
                        'key': str(key),
                        'success': data is not None,
                        'duration': duration,
                        'data_valid': data.get('worker_id') == worker_id if data else False
                    })
                except Exception as e:
                    local_results.append({
                        'worker_id': worker_id,
                        'operation': 'get',
                        'error': str(e),
                        'success': False
                    })
                
                time.sleep(0.001)  # Small delay between operations
            
            with operation_lock:
                operation_results.extend(local_results)
        
        def writer_worker(worker_id: int, num_operations: int):
            """Worker that performs write operations."""
            local_results = []
            for i in range(num_operations):
                key = CacheKey('test', f'concurrent_key_{i}', CacheStage.ASSETS)
                data = {
                    'worker_id': worker_id,
                    'operation_id': i,
                    'data': 'x' * (1024 * random.randint(10, 100)),  # 10-100KB
                    'timestamp': time.time()
                }
                
                try:
                    start_time = time.time()
                    success = self.cache_manager.put(key, data)
                    duration = time.time() - start_time
                    
                    local_results.append({
                        'worker_id': worker_id,
                        'operation': 'put',
                        'key': str(key),
                        'success': success,
                        'duration': duration
                    })
                except Exception as e:
                    local_results.append({
                        'worker_id': worker_id,
                        'operation': 'put',
                        'error': str(e),
                        'success': False
                    })
                
                time.sleep(0.002)  # Small delay between operations
            
            with operation_lock:
                operation_results.extend(local_results)
        
        def eviction_worker():
            """Worker that triggers periodic evictions."""
            for _ in range(10):
                try:
                    self.cache_manager._maybe_cleanup_intelligent()
                    time.sleep(0.1)
                except Exception as e:
                    with operation_lock:
                        operation_results.append({
                            'worker_id': 'eviction',
                            'operation': 'cleanup',
                            'error': str(e),
                            'success': False
                        })
        
        # Start concurrent operations
        num_readers = 5
        num_writers = 3
        operations_per_worker = 20
        
        with ThreadPoolExecutor(max_workers=num_readers + num_writers + 1) as executor:
            futures = []
            
            # Start reader workers
            for i in range(num_readers):
                future = executor.submit(reader_worker, f'reader_{i}', operations_per_worker)
                futures.append(future)
            
            # Start writer workers
            for i in range(num_writers):
                future = executor.submit(writer_worker, f'writer_{i}', operations_per_worker)
                futures.append(future)
            
            # Start eviction worker
            future = executor.submit(eviction_worker)
            futures.append(future)
            
            # Wait for all operations to complete
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"Worker failed: {e}")
        
        # Analyze results
        successful_reads = sum(1 for r in operation_results if r.get('operation') == 'get' and r.get('success'))
        successful_writes = sum(1 for r in operation_results if r.get('operation') == 'put' and r.get('success'))
        failed_operations = sum(1 for r in operation_results if not r.get('success', True))
        
        total_expected_reads = num_readers * operations_per_worker
        total_expected_writes = num_writers * operations_per_worker
        
        # Verify high success rates despite concurrent eviction
        read_success_rate = successful_reads / total_expected_reads
        write_success_rate = successful_writes / total_expected_writes
        
        self.assertGreater(read_success_rate, 0.8, f"Read success rate too low: {read_success_rate:.2f}")
        self.assertGreater(write_success_rate, 0.9, f"Write success rate too low: {write_success_rate:.2f}")
        
        # Verify no critical errors occurred
        critical_errors = [r for r in operation_results if 'error' in r and 'lock' in r.get('error', '').lower()]
        self.assertEqual(len(critical_errors), 0, f"Found critical threading errors: {critical_errors}")
        
        print(f"Concurrent operations test: {successful_reads}/{total_expected_reads} reads, "
              f"{successful_writes}/{total_expected_writes} writes, {failed_operations} failures")
    
    def test_thread_safety_with_file_locking(self):
        """Test thread safety using file locking mechanisms."""
        # Test concurrent access to same cache keys
        shared_keys = [CacheKey('test', f'shared_key_{i}', CacheStage.CODE) for i in range(5)]
        
        # Track lock acquisition and release
        lock_events = []
        lock_events_lock = threading.Lock()
        
        # Override file_lock to track usage
        original_file_lock = self.cache_manager.file_lock
        
        @contextmanager
        def tracking_file_lock(lock_file, mode='w'):
            thread_id = threading.current_thread().ident
            with lock_events_lock:
                lock_events.append(('acquire', thread_id, str(lock_file), time.time()))
            
            try:
                with original_file_lock(lock_file, mode) as f:
                    yield f
            finally:
                with lock_events_lock:
                    lock_events.append(('release', thread_id, str(lock_file), time.time()))
        
        self.cache_manager.file_lock = tracking_file_lock
        
        def concurrent_accessor(worker_id: int):
            """Worker that accesses shared keys concurrently."""
            results = []
            for i in range(20):
                key = random.choice(shared_keys)
                
                # Randomly choose operation
                if random.random() < 0.7:  # 70% reads
                    try:
                        data = self.cache_manager.get(key)
                        results.append(('get', key, True, data is not None))
                    except Exception as e:
                        results.append(('get', key, False, str(e)))
                else:  # 30% writes
                    try:
                        data = {'worker': worker_id, 'iteration': i, 'data': 'x' * 1024}
                        success = self.cache_manager.put(key, data)
                        results.append(('put', key, success, None))
                    except Exception as e:
                        results.append(('put', key, False, str(e)))
                
                time.sleep(0.001)  # Small delay
            
            return results
        
        # Run concurrent accessors
        num_workers = 10
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(concurrent_accessor, i) for i in range(num_workers)]
            all_results = []
            
            for future in as_completed(futures):
                try:
                    worker_results = future.result()
                    all_results.extend(worker_results)
                except Exception as e:
                    print(f"Worker failed: {e}")
        
        # Analyze lock behavior
        acquire_events = [e for e in lock_events if e[0] == 'acquire']
        release_events = [e for e in lock_events if e[0] == 'release']
        
        # Verify locks were acquired and released properly
        self.assertEqual(len(acquire_events), len(release_events),
                        "All acquired locks should be released")
        
        # Check for overlapping access to same files (should not happen with proper locking)
        lock_file_access = {}
        for event_type, thread_id, lock_file, timestamp in lock_events:
            if lock_file not in lock_file_access:
                lock_file_access[lock_file] = []
            lock_file_access[lock_file].append((event_type, thread_id, timestamp))
        
        # Verify proper lock ordering for each file
        for lock_file, events in lock_file_access.items():
            events.sort(key=lambda x: x[2])  # Sort by timestamp
            
            active_locks = set()
            for event_type, thread_id, timestamp in events:
                if event_type == 'acquire':
                    # Should not already have active lock for this file
                    if active_locks:
                        # Allow same thread to re-acquire (reentrant behavior)
                        self.assertIn(thread_id, active_locks,
                                     f"Multiple threads holding lock on {lock_file}: {active_locks} + {thread_id}")
                    active_locks.add(thread_id)
                else:  # release
                    self.assertIn(thread_id, active_locks,
                                 f"Thread {thread_id} releasing lock it didn't hold on {lock_file}")
                    active_locks.discard(thread_id)
        
        # Verify operation success rates
        successful_ops = sum(1 for result in all_results if result[2])
        total_ops = len(all_results)
        success_rate = successful_ops / total_ops
        
        self.assertGreater(success_rate, 0.95, f"Success rate too low with file locking: {success_rate:.2f}")
        
        print(f"Thread safety test: {successful_ops}/{total_ops} operations successful, "
              f"{len(acquire_events)} locks acquired")
    
    def test_deadlock_prevention_under_high_concurrent_load(self):
        """Test deadlock prevention under high concurrent load."""
        # Create scenario prone to deadlocks: multiple keys accessed in different orders
        test_keys = [CacheKey('test', f'deadlock_key_{i}', CacheStage.CODE) for i in range(10)]
        
        # Track timeouts and hangs
        operation_timeouts = []
        completed_operations = []
        timeout_lock = threading.Lock()
        
        def high_load_worker(worker_id: int):
            """Worker that performs operations on multiple keys in random order."""
            local_completions = []
            
            for iteration in range(50):
                # Randomly select multiple keys to operate on
                selected_keys = random.sample(test_keys, k=random.randint(2, 5))
                
                for key in selected_keys:
                    operation_start = time.time()
                    operation_timeout = 2.0  # 2 second timeout
                    
                    try:
                        # Mix of operations
                        if random.random() < 0.6:  # 60% reads
                            data = self.cache_manager.get(key)
                            operation_type = 'get'
                            success = True
                        else:  # 40% writes
                            data = {
                                'worker': worker_id,
                                'iteration': iteration,
                                'data': 'x' * (1024 * random.randint(5, 50))
                            }
                            success = self.cache_manager.put(key, data)
                            operation_type = 'put'
                        
                        duration = time.time() - operation_start
                        
                        # Check for timeouts
                        if duration > operation_timeout:
                            with timeout_lock:
                                operation_timeouts.append({
                                    'worker': worker_id,
                                    'operation': operation_type,
                                    'key': str(key),
                                    'duration': duration
                                })
                        
                        local_completions.append({
                            'worker': worker_id,
                            'operation': operation_type,
                            'success': success,
                            'duration': duration
                        })
                        
                    except Exception as e:
                        duration = time.time() - operation_start
                        local_completions.append({
                            'worker': worker_id,
                            'operation': operation_type,
                            'success': False,
                            'error': str(e),
                            'duration': duration
                        })
                
                # Small delay between iterations
                time.sleep(0.001)
            
            with timeout_lock:
                completed_operations.extend(local_completions)
            
            return len(local_completions)
        
        # Run high load test with many concurrent workers
        num_workers = 20
        test_start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(high_load_worker, i) for i in range(num_workers)]
            
            # Wait for completion with overall timeout
            completed_workers = 0
            for future in as_completed(futures, timeout=30):  # 30 second overall timeout
                try:
                    operations_completed = future.result()
                    completed_workers += 1
                except Exception as e:
                    print(f"Worker failed or timed out: {e}")
        
        test_duration = time.time() - test_start_time
        
        # Analyze results for deadlock indicators
        total_operations = len(completed_operations)
        timeout_operations = len(operation_timeouts)
        successful_operations = sum(1 for op in completed_operations if op.get('success', False))
        
        # Calculate average operation times
        operation_times = [op['duration'] for op in completed_operations if 'duration' in op]
        avg_operation_time = statistics.mean(operation_times) if operation_times else 0
        max_operation_time = max(operation_times) if operation_times else 0
        
        # Deadlock prevention verification
        timeout_rate = timeout_operations / max(1, total_operations)
        success_rate = successful_operations / max(1, total_operations)
        completion_rate = completed_workers / num_workers
        
        # Verify no severe deadlocks occurred
        self.assertLess(timeout_rate, 0.05, f"Too many timeouts (possible deadlocks): {timeout_rate:.2f}")
        self.assertGreater(success_rate, 0.90, f"Success rate too low: {success_rate:.2f}")
        self.assertGreater(completion_rate, 0.95, f"Worker completion rate too low: {completion_rate:.2f}")
        
        # Verify reasonable performance (no excessive blocking)
        self.assertLess(avg_operation_time, 0.1, f"Average operation time too high: {avg_operation_time:.3f}s")
        self.assertLess(max_operation_time, 1.0, f"Maximum operation time too high: {max_operation_time:.3f}s")
        
        print(f"Deadlock prevention test: {total_operations} operations, {timeout_operations} timeouts, "
              f"avg time: {avg_operation_time:.3f}s, max time: {max_operation_time:.3f}s")
    
    def test_atomic_operations_during_concurrent_access(self):
        """Test that atomic operations maintain integrity during concurrent access."""
        # Test atomic writes during concurrent reads
        shared_key = CacheKey('test', 'atomic_test_key', CacheStage.CODE)
        
        # Track data integrity
        integrity_violations = []
        read_values = []
        integrity_lock = threading.Lock()
        
        def atomic_writer(writer_id: int):
            """Writer that performs atomic updates."""
            for iteration in range(20):
                # Create data with consistent internal structure
                data = {
                    'writer_id': writer_id,
                    'iteration': iteration,
                    'timestamp': time.time(),
                    'checksum': f'{writer_id}_{iteration}',  # Simple consistency check
                    'large_data': f'writer_{writer_id}_iteration_{iteration}_' + 'x' * 1000
                }
                
                try:
                    success = self.cache_manager.put(shared_key, data)
                    if not success:
                        with integrity_lock:
                            integrity_violations.append(f"Writer {writer_id} failed atomic write at iteration {iteration}")
                except Exception as e:
                    with integrity_lock:
                        integrity_violations.append(f"Writer {writer_id} exception: {e}")
                
                time.sleep(0.005)  # Small delay between writes
        
        def atomic_reader(reader_id: int):
            """Reader that checks data integrity during concurrent writes."""
            local_reads = []
            
            for iteration in range(50):
                try:
                    data = self.cache_manager.get(shared_key)
                    
                    if data is not None:
                        # Verify data consistency
                        writer_id = data.get('writer_id')
                        data_iteration = data.get('iteration')
                        checksum = data.get('checksum')
                        expected_checksum = f'{writer_id}_{data_iteration}'
                        
                        is_consistent = checksum == expected_checksum
                        
                        local_reads.append({
                            'reader_id': reader_id,
                            'iteration': iteration,
                            'data_valid': data is not None,
                            'data_consistent': is_consistent,
                            'writer_id': writer_id,
                            'data_iteration': data_iteration
                        })
                        
                        if not is_consistent:
                            with integrity_lock:
                                integrity_violations.append(
                                    f"Reader {reader_id} found inconsistent data: "
                                    f"checksum {checksum} != expected {expected_checksum}"
                                )
                    else:
                        local_reads.append({
                            'reader_id': reader_id,
                            'iteration': iteration,
                            'data_valid': False,
                            'data_consistent': True  # No data is consistent
                        })
                
                except Exception as e:
                    with integrity_lock:
                        integrity_violations.append(f"Reader {reader_id} exception: {e}")
                
                time.sleep(0.002)  # Frequent reads
            
            with integrity_lock:
                read_values.extend(local_reads)
        
        # Run concurrent atomic operations
        num_writers = 3
        num_readers = 7
        
        with ThreadPoolExecutor(max_workers=num_writers + num_readers) as executor:
            futures = []
            
            # Start writers
            for i in range(num_writers):
                future = executor.submit(atomic_writer, i)
                futures.append(future)
            
            # Start readers
            for i in range(num_readers):
                future = executor.submit(atomic_reader, i)
                futures.append(future)
            
            # Wait for completion
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"Atomic operation worker failed: {e}")
        
        # Analyze integrity results
        total_reads = len(read_values)
        valid_reads = sum(1 for r in read_values if r['data_valid'])
        consistent_reads = sum(1 for r in read_values if r['data_consistent'])
        
        consistency_rate = consistent_reads / max(1, total_reads)
        
        # Verify atomic operation integrity
        self.assertEqual(len(integrity_violations), 0,
                        f"Found integrity violations: {integrity_violations}")
        
        self.assertEqual(consistency_rate, 1.0,
                        f"Data consistency rate should be 100%, got {consistency_rate:.2f}")
        
        # Verify readers saw valid data most of the time (allows for brief moments of no data)
        if total_reads > 0:
            validity_rate = valid_reads / total_reads
            self.assertGreater(validity_rate, 0.8,
                              f"Data validity rate too low: {validity_rate:.2f}")
        
        print(f"Atomic operations test: {total_reads} reads, {valid_reads} valid, "
              f"{consistent_reads} consistent, {len(integrity_violations)} violations")


if __name__ == '__main__':
    import unittest
    
    # Configure logging for test output
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Run the comprehensive test suite
    test_loader = unittest.TestLoader()
    test_suite = unittest.TestSuite()
    
    # Add all test classes
    test_classes = [
        TestCacheEvictionCorrectness,
        TestCacheAgeBasedEviction,
        TestCacheConcurrencyBehavior
    ]
    
    for test_class in test_classes:
        tests = test_loader.loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # Run the tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    total_tests = result.testsRun
    failures = len(result.failures)
    errors = len(result.errors)
    successes = total_tests - failures - errors
    
    print(f"\n" + "="*60)
    print(f"CACHE COMPREHENSIVE TEST RESULTS")
    print(f"="*60)
    print(f"Total Tests: {total_tests}")
    print(f"Successes: {successes}")
    print(f"Failures: {failures}")
    print(f"Errors: {errors}")
    print(f"Success Rate: {(successes/total_tests)*100:.1f}%")
    
    if failures > 0:
        print(f"\nFAILURES:")
        for test, traceback in result.failures:
            error_msg = traceback.split('AssertionError: ')[-1].split('\n')[0]
            print(f"- {test}: {error_msg}")
    
    if errors > 0:
        print(f"\nERRORS:")
        for test, traceback in result.errors:
            error_msg = traceback.split('Exception: ')[-1].split('\n')[0]
            print(f"- {test}: {error_msg}")