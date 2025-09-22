"""
Tests for cache manager atomic operations and concurrency safety.

These tests validate the atomic write operations, crash safety, and 
concurrent access patterns for the cache manager as required by task 4c1.
"""

import os
import json
import time
import tempfile
import threading
import subprocess
import multiprocessing
from pathlib import Path
from typing import Dict, Any
from unittest import TestCase
from unittest.mock import patch, MagicMock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from cache_manager import CacheManager, CacheKey, CacheStage


class TestCacheAtomicity(TestCase):
    """Test atomic operations and concurrency safety for cache manager."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=10)
        
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass  # Best effort cleanup
    
    def test_atomic_write_operations(self):
        """Test that cache writes are atomic - no partial states visible."""
        cache_key = CacheKey('test', 'atomic_test', 'stage1')
        test_data = {'large_data': 'x' * 10000, 'nested': {'key': 'value'}}
        
        # Simulate interruption during write by patching os.rename
        original_rename = os.rename
        call_count = 0
        
        def failing_rename(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call (backup move) succeeds
                return original_rename(*args, **kwargs)
            else:
                # Second call (final move) fails
                raise OSError("Simulated failure during atomic move")
        
        # Test that partial failure is handled correctly
        with patch('os.rename', failing_rename):
            result = self.cache_manager.put(cache_key, test_data)
            self.assertFalse(result)  # Should return False on failure
        
        # Verify cache is not corrupted - no partial data
        retrieved = self.cache_manager.get(cache_key)
        self.assertIsNone(retrieved)  # Should not find partial data
        
        # Verify original data can still be written successfully
        result = self.cache_manager.put(cache_key, test_data)
        self.assertTrue(result)
        
        retrieved = self.cache_manager.get(cache_key)
        self.assertIsNotNone(retrieved)
        assert retrieved is not None  # For type checker
        self.assertEqual(retrieved['large_data'], test_data['large_data'])
        self.assertEqual(retrieved['nested']['key'], test_data['nested']['key'])
    
    def test_concurrent_writes_same_key(self):
        """Test concurrent writes to the same cache key are handled safely."""
        cache_key = CacheKey('test', 'concurrent_test', 'stage1')
        num_threads = 5
        barrier = threading.Barrier(num_threads)
        results = []
        errors = []
        
        def concurrent_writer(thread_id):
            try:
                # Wait for all threads to be ready
                barrier.wait()
                
                # All threads write different data to same key
                test_data = {
                    'thread_id': thread_id,
                    'data': f'thread_{thread_id}_data',
                    'timestamp': time.time()
                }
                
                result = self.cache_manager.put(cache_key, test_data)
                results.append((thread_id, result))
                
                # Brief delay then read back
                time.sleep(0.01)
                retrieved = self.cache_manager.get(cache_key)
                
                if retrieved:
                    results.append(('read', retrieved.get('thread_id')))
                
            except Exception as e:
                errors.append((thread_id, str(e)))
        
        # Start concurrent threads
        threads = []
        for i in range(num_threads):
            t = threading.Thread(target=concurrent_writer, args=(i,))
            threads.append(t)
            t.start()
        
        # Wait for all threads to complete
        for t in threads:
            t.join()
        
        # Verify no errors occurred
        self.assertEqual(len(errors), 0, f"Concurrent write errors: {errors}")
        
        # Verify at least one write succeeded
        write_results = [r for thread_id, r in results if isinstance(r, bool)]
        self.assertTrue(any(write_results), "At least one concurrent write should succeed")
        
        # Verify final data is consistent (not corrupted)
        final_data = self.cache_manager.get(cache_key)
        self.assertIsNotNone(final_data)
        assert final_data is not None  # For type checker
        self.assertIn('thread_id', final_data)
        self.assertIn('data', final_data)
        
    def test_concurrent_reads_during_write(self):
        """Test that reads during writes don't see partial data."""
        cache_key = CacheKey('test', 'read_write_test', 'stage1')
        
        # Pre-populate cache with initial data
        initial_data = {'state': 'initial', 'value': 100}
        self.cache_manager.put(cache_key, initial_data)
        
        # Flags for coordination
        write_started = threading.Event()
        stop_reading = threading.Event()
        read_results = []
        
        def slow_writer():
            """Writer that takes time to complete."""
            write_started.set()
            
            # Simulate slow write operation
            new_data = {'state': 'updated', 'value': 200, 'large_field': 'x' * 5000}
            
            # Patch atomic write to be slower
            original_atomic_write = self.cache_manager._atomic_write
            
            def slow_atomic_write(*args, **kwargs):
                time.sleep(0.1)  # Slow down the atomic write
                return original_atomic_write(*args, **kwargs)
            
            with patch.object(self.cache_manager, '_atomic_write', slow_atomic_write):
                result = self.cache_manager.put(cache_key, new_data)
                return result
        
        def concurrent_reader():
            """Reader that reads during the write operation."""
            write_started.wait()  # Wait for write to start
            
            # Read multiple times during write
            for i in range(10):
                if stop_reading.is_set():
                    break
                    
                data = self.cache_manager.get(cache_key)
                if data:
                    read_results.append(data['state'])
                time.sleep(0.01)
        
        # Start writer and readers
        writer_thread = threading.Thread(target=slow_writer)
        reader_threads = [threading.Thread(target=concurrent_reader) for _ in range(3)]
        
        writer_thread.start()
        for rt in reader_threads:
            rt.start()
        
        writer_thread.join()
        stop_reading.set()
        
        for rt in reader_threads:
            rt.join()
        
        # Verify readers only saw consistent states (never partial data)
        valid_states = {'initial', 'updated'}
        for state in read_results:
            self.assertIn(state, valid_states, f"Invalid intermediate state seen: {state}")
        
        # Verify final state is correct
        final_data = self.cache_manager.get(cache_key)
        self.assertIsNotNone(final_data)
        assert final_data is not None  # For type checker
        self.assertEqual(final_data['state'], 'updated')
        self.assertEqual(final_data['value'], 200)
    
    def test_crash_safety_simulation(self):
        """Test that cache survives simulated crashes during writes."""
        cache_key = CacheKey('test', 'crash_test', 'stage1')
        
        # Write initial data
        initial_data = {'crash_test': True, 'data': 'initial'}
        success = self.cache_manager.put(cache_key, initial_data)
        self.assertTrue(success)
        
        # Verify initial data is readable
        retrieved = self.cache_manager.get(cache_key)
        self.assertIsNotNone(retrieved)
        assert retrieved is not None  # For type checker
        self.assertEqual(retrieved['data'], 'initial')
        
        # Simulate crash by killing process during atomic write
        def crash_during_write():
            """Simulate a crash during the critical atomic operation."""
            crash_data = {'crash_test': True, 'data': 'should_not_exist_if_crashed'}
            
            # Patch to simulate crash during os.rename
            original_rename = os.rename
            
            def crashing_rename(src, dst):
                # First rename (backup) succeeds
                if 'backup' in str(dst):
                    return original_rename(src, dst)
                else:
                    # Simulate crash during final rename
                    raise KeyboardInterrupt("Simulated crash")
            
            with patch('os.rename', crashing_rename):
                try:
                    self.cache_manager.put(cache_key, crash_data)
                except KeyboardInterrupt:
                    pass  # Expected crash simulation
        
        # Simulate the crash
        crash_during_write()
        
        # Create new cache manager instance (simulate restart after crash)
        crashed_cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=10)
        
        # Verify original data is still intact (crash safety)
        recovered_data = crashed_cache_manager.get(cache_key)
        self.assertIsNotNone(recovered_data, "Cache should survive crash")
        assert recovered_data is not None  # For type checker
        self.assertEqual(recovered_data['data'], 'initial', "Original data should be preserved")
        
        # Verify no corrupted data exists
        self.assertNotEqual(recovered_data['data'], 'should_not_exist_if_crashed')
    
    def test_filesystem_sync_operations(self):
        """Test that fsync operations are properly called during atomic writes."""
        cache_key = CacheKey('test', 'fsync_test', 'stage1')
        test_data = {'fsync_test': True}
        
        # Track fsync calls
        fsync_calls = []
        original_fsync = os.fsync
        
        def tracking_fsync(fd):
            fsync_calls.append(fd)
            return original_fsync(fd)
        
        with patch('os.fsync', tracking_fsync):
            success = self.cache_manager.put(cache_key, test_data)
            self.assertTrue(success)
        
        # Verify fsync was called (should be called for data.json and metadata.json)
        self.assertGreaterEqual(len(fsync_calls), 2, "fsync should be called for data and metadata files")
        
        # Verify data is retrievable
        retrieved = self.cache_manager.get(cache_key)
        self.assertIsNotNone(retrieved)
        assert retrieved is not None  # For type checker
        self.assertEqual(retrieved['fsync_test'], True)
    
    def test_deterministic_cache_key_generation(self):
        """Test that cache keys are deterministic and consistent."""
        # Test data with same content should generate same keys
        data1 = {'template': 'test', 'components': [{'id': 'comp1'}]}
        data2 = {'template': 'test', 'components': [{'id': 'comp1'}]}
        
        key1 = CacheKey('test', 'key1', CacheStage.INPUTS)  
        key2 = CacheKey('test', 'key1', CacheStage.INPUTS)
        
        # Same keys should be equal
        self.assertEqual(str(key1), str(key2))
        
        # Different stages should produce different keys
        key3 = CacheKey('test', 'key1', CacheStage.CODE)
        self.assertNotEqual(str(key1), str(key3))
        
        # Keys should have proper structure
        self.assertEqual(str(key1), "test/key1/inputs")
        self.assertEqual(str(key3), "test/key1/code")
    
    def test_cache_invalidation_scenarios(self):
        """Test that cache invalidation works correctly for recompilation scenarios."""
        # Create multiple cache entries
        keys_data = [
            (CacheKey('compilation', 'key1', CacheStage.INPUTS), {'type': 'inputs'}),
            (CacheKey('compilation', 'key1', CacheStage.CODE), {'type': 'code'}), 
            (CacheKey('compilation', 'key1', CacheStage.ASSETS), {'type': 'assets'}),
            (CacheKey('compilation', 'key2', CacheStage.INPUTS), {'type': 'inputs2'}),
            (CacheKey('templates', 'template1', 'data'), {'type': 'template'})
        ]
        
        # Populate cache
        for key, data in keys_data:
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
        
        # Verify all entries exist
        for key, expected_data in keys_data:
            retrieved = self.cache_manager.get(key)
            self.assertIsNotNone(retrieved)
            assert retrieved is not None  # For type checker
            self.assertEqual(retrieved['type'], expected_data['type'])
        
        # Test scope-specific invalidation
        invalidated_count = self.cache_manager.invalidate('compilation', '*')
        self.assertEqual(invalidated_count, 4)  # Should invalidate 4 compilation entries
        
        # Verify compilation entries are gone
        compilation_keys = [k for k, _ in keys_data if k.scope == 'compilation']
        for key in compilation_keys:
            retrieved = self.cache_manager.get(key)
            self.assertIsNone(retrieved, f"Key {key} should be invalidated")
        
        # Verify template entry still exists
        template_key = [k for k, _ in keys_data if k.scope == 'templates'][0]
        retrieved = self.cache_manager.get(template_key)
        self.assertIsNotNone(retrieved, "Template cache should not be affected")
        assert retrieved is not None  # For type checker
        self.assertEqual(retrieved['type'], 'template')


if __name__ == '__main__':
    import unittest
    unittest.main()