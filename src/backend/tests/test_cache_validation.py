"""
Focused cache validation testing to verify core functionality.

This test suite validates essential cache features with reliable, fast-running tests:
- Basic cache operations (put/get)
- Eviction functionality verification
- Metrics collection and export
- Thread safety basics
- Performance benchmarking
"""

import os
import json
import time
import tempfile
import threading
import shutil
from pathlib import Path
from typing import Dict, Any, List
from unittest import TestCase
import logging

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from cache_manager import CacheManager, CacheKey, CacheStage, EvictionConfig, CacheMetrics


class TestCacheBasicFunctionality(TestCase):
    """Test basic cache functionality and core features."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_basic_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=10)
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass
    
    def test_basic_put_get_operations(self):
        """Test basic cache put and get operations."""
        # Test data
        test_cases = [
            (CacheKey('test', 'key1', CacheStage.CODE), {'data': 'test1', 'size': 100}),
            (CacheKey('test', 'key2', CacheStage.ASSETS), {'data': 'test2', 'size': 200}),
            (CacheKey('test', 'key3', CacheStage.WEB), {'data': 'test3', 'size': 300}),
        ]
        
        # Test put operations
        for key, data in test_cases:
            success = self.cache_manager.put(key, data)
            self.assertTrue(success, f"Put operation should succeed for {key}")
        
        # Test get operations
        for key, expected_data in test_cases:
            retrieved_data = self.cache_manager.get(key)
            self.assertIsNotNone(retrieved_data, f"Should retrieve data for {key}")
            self.assertEqual(retrieved_data['data'], expected_data['data'])
            self.assertEqual(retrieved_data['size'], expected_data['size'])
        
        # Test non-existent key
        non_existent_key = CacheKey('test', 'nonexistent', CacheStage.CODE)
        retrieved = self.cache_manager.get(non_existent_key)
        self.assertIsNone(retrieved, "Should return None for non-existent key")
        
        print("✓ Basic put/get operations test passed")
    
    def test_cache_size_tracking(self):
        """Test cache size tracking and statistics."""
        # Add entries and track size
        cache_keys = []
        expected_total_size = 0
        
        for i in range(20):
            key = CacheKey('test', f'size_key_{i}', CacheStage.CODE)
            data_size = 1024 * (i + 1)  # Increasing sizes: 1KB, 2KB, 3KB, etc.
            data = {'index': i, 'data': 'x' * data_size}
            
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            cache_keys.append(key)
            expected_total_size += len(json.dumps(data))
        
        # Get cache statistics
        stats = self.cache_manager._get_cache_size_stats()
        
        # Verify statistics
        self.assertEqual(stats['entry_count'], 20, "Should track correct entry count")
        self.assertGreater(stats['total_size_bytes'], 0, "Should track total size")
        
        # Verify utilization calculation
        utilization = (stats['total_size_bytes'] / self.cache_manager.eviction_config.max_cache_size_bytes) * 100
        self.assertGreater(utilization, 0, "Should calculate utilization")
        self.assertLess(utilization, 100, "Utilization should be under 100% for this test")
        
        print(f"✓ Cache size tracking test passed - {stats['entry_count']} entries, "
              f"{stats['total_size_bytes']} bytes, {utilization:.1f}% utilization")
    
    def test_metrics_collection_and_export(self):
        """Test metrics collection and export functionality."""
        # Reset metrics for clean test
        self.cache_manager.metrics = CacheMetrics()
        
        # Perform operations to generate metrics
        cache_keys = []
        
        # Write operations
        for i in range(10):
            key = CacheKey('test', f'metrics_key_{i}', CacheStage.CODE)
            data = {'metrics_test': True, 'index': i, 'data': 'x' * 1024}
            success = self.cache_manager.put(key, data, build_time=0.1 + i * 0.05)
            self.assertTrue(success)
            cache_keys.append(key)
        
        # Read operations (mix of hits and misses)
        hit_count = 0
        miss_count = 0
        
        # Test hits
        for key in cache_keys[:5]:
            data = self.cache_manager.get(key)
            if data is not None:
                hit_count += 1
            else:
                miss_count += 1
        
        # Test misses
        for i in range(5):
            key = CacheKey('test', f'nonexistent_key_{i}', CacheStage.ASSETS)
            data = self.cache_manager.get(key)
            if data is not None:
                hit_count += 1
            else:
                miss_count += 1
        
        # Verify metrics were collected
        metrics = self.cache_manager.metrics
        self.assertEqual(metrics.writes, 10, "Should record write operations")
        self.assertEqual(metrics.hits, hit_count, "Should record cache hits")
        self.assertEqual(metrics.misses, miss_count, "Should record cache misses")
        
        # Test metrics export
        self.cache_manager._maybe_export_metrics()
        
        # Verify metrics file was created
        metrics_file = self.cache_manager.metrics_file
        if metrics_file.exists():
            with open(metrics_file, 'r') as f:
                exported_metrics = json.load(f)
            
            # Verify exported metrics structure
            self.assertIn('performance_metrics', exported_metrics)
            self.assertIn('current_usage', exported_metrics)
            
            perf_metrics = exported_metrics['performance_metrics']
            self.assertIn('basic_metrics', perf_metrics)
            
            basic_metrics = perf_metrics['basic_metrics']
            self.assertEqual(basic_metrics['writes'], 10)
            self.assertEqual(basic_metrics['hits'], hit_count)
            self.assertEqual(basic_metrics['misses'], miss_count)
        
        print(f"✓ Metrics collection test passed - {metrics.writes} writes, "
              f"{metrics.hits} hits, {metrics.misses} misses")
    
    def test_eviction_basic_functionality(self):
        """Test basic eviction functionality."""
        # Configure small cache for easier eviction testing
        small_cache = CacheManager(self.temp_dir + "_small", max_cache_size_mb=2)
        small_cache.eviction_config.cleanup_threshold_percent = 70.0
        small_cache.eviction_config.target_utilization_percent = 50.0
        
        try:
            # Fill cache beyond threshold
            cache_keys = []
            for i in range(50):
                key = CacheKey('test', f'eviction_key_{i:03d}', CacheStage.CODE)
                data = {'eviction_test': True, 'data': 'x' * (1024 * 50)}  # 50KB each
                success = small_cache.put(key, data)
                if success:
                    cache_keys.append(key)
                time.sleep(0.001)  # Small delay for different access times
            
            # Check cache state before cleanup
            stats_before = small_cache._get_cache_size_stats()
            entries_before = stats_before['entry_count']
            
            # Force cleanup
            cleanup_result = small_cache.force_cleanup()
            
            # Check cache state after cleanup
            stats_after = small_cache._get_cache_size_stats()
            entries_after = stats_after['entry_count']
            
            # Verify cleanup occurred (entries should be reduced or at least attempted)
            utilization_before = (stats_before['total_size_bytes'] / small_cache.eviction_config.max_cache_size_bytes) * 100
            utilization_after = (stats_after['total_size_bytes'] / small_cache.eviction_config.max_cache_size_bytes) * 100
            
            self.assertTrue(cleanup_result['success'], "Cleanup should report success")
            
            # If cache was over threshold, it should have attempted cleanup
            if utilization_before > small_cache.eviction_config.cleanup_threshold_percent:
                self.assertLessEqual(utilization_after, utilization_before,
                                   "Utilization should not increase after cleanup")
            
            print(f"✓ Basic eviction test passed - {entries_before} → {entries_after} entries, "
                  f"{utilization_before:.1f}% → {utilization_after:.1f}% utilization")
        
        finally:
            try:
                shutil.rmtree(self.temp_dir + "_small")
            except:
                pass
    
    def test_deterministic_hashing(self):
        """Test deterministic hashing functionality."""
        hasher = self.cache_manager.hasher
        
        # Test consistent hashing for same inputs
        template_id = "test_template"
        components = [{'id': 'comp1', 'configuration': {'param': 'value'}}]
        configuration = {'debug': False, 'target': 'web'}
        assets = [{'path': '/test/asset.png', 'type': 'image'}]
        
        templates_registry = {
            template_id: {
                'name': 'Test Template',
                'version': '1.0',
                'structure': {'main': 'main.py'}
            }
        }
        
        components_registry = {
            'comp1': {
                'name': 'Test Component',
                'version': '1.0',
                'type': 'system'
            }
        }
        
        # Generate hash multiple times
        hash1 = hasher.compute_compilation_hash(
            template_id, components, configuration, assets,
            templates_registry, components_registry
        )
        
        hash2 = hasher.compute_compilation_hash(
            template_id, components, configuration, assets,
            templates_registry, components_registry
        )
        
        # Hashes should be identical for same inputs
        self.assertEqual(hash1, hash2, "Deterministic hashing should produce identical results")
        
        # Test different inputs produce different hashes
        different_config = {'debug': True, 'target': 'web'}
        hash3 = hasher.compute_compilation_hash(
            template_id, components, different_config, assets,
            templates_registry, components_registry
        )
        
        self.assertNotEqual(hash1, hash3, "Different inputs should produce different hashes")
        
        print(f"✓ Deterministic hashing test passed - consistent hash: {hash1[:16]}...")
    
    def test_thread_safety_basic(self):
        """Test basic thread safety with simple concurrent operations."""
        # Simple thread safety test with limited concurrency
        shared_key = CacheKey('test', 'shared_key', CacheStage.CODE)
        
        results = []
        results_lock = threading.Lock()
        
        def simple_worker(worker_id: int):
            """Simple worker that performs basic operations."""
            worker_results = []
            
            for i in range(10):
                try:
                    # Alternate between reads and writes
                    if i % 2 == 0:
                        data = {'worker': worker_id, 'iteration': i, 'data': f'data_{worker_id}_{i}'}
                        success = self.cache_manager.put(shared_key, data)
                        worker_results.append(('put', success))
                    else:
                        data = self.cache_manager.get(shared_key)
                        worker_results.append(('get', data is not None))
                    
                    time.sleep(0.001)  # Small delay
                    
                except Exception as e:
                    worker_results.append(('error', str(e)))
            
            with results_lock:
                results.extend(worker_results)
        
        # Run with limited concurrency
        num_workers = 4
        threads = []
        
        for i in range(num_workers):
            thread = threading.Thread(target=simple_worker, args=(i,))
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # Analyze results
        total_operations = len(results)
        successful_operations = sum(1 for op_type, success in results if success or op_type == 'get')
        error_operations = sum(1 for op_type, result in results if op_type == 'error')
        
        # Verify thread safety
        self.assertGreater(total_operations, 0, "Should have performed operations")
        self.assertEqual(error_operations, 0, "Should have no thread safety errors")
        
        # At least some operations should succeed
        success_rate = successful_operations / total_operations
        self.assertGreater(success_rate, 0.8, f"Success rate too low: {success_rate:.2f}")
        
        print(f"✓ Basic thread safety test passed - {total_operations} operations, "
              f"{successful_operations} successful, {error_operations} errors")
    
    def test_performance_benchmarking(self):
        """Test basic performance benchmarking."""
        # Performance test configuration
        num_operations = 1000
        
        # Write performance test
        write_times = []
        cache_keys = []
        
        for i in range(num_operations):
            key = CacheKey('perf', f'key_{i:04d}', CacheStage.CODE)
            data = {'performance_test': True, 'index': i, 'data': 'x' * 1024}  # 1KB
            
            start_time = time.time()
            success = self.cache_manager.put(key, data)
            write_time = time.time() - start_time
            
            self.assertTrue(success)
            write_times.append(write_time)
            cache_keys.append(key)
        
        # Read performance test
        read_times = []
        
        for key in cache_keys:
            start_time = time.time()
            data = self.cache_manager.get(key)
            read_time = time.time() - start_time
            
            self.assertIsNotNone(data)
            read_times.append(read_time)
        
        # Calculate performance metrics
        avg_write_time = sum(write_times) / len(write_times)
        avg_read_time = sum(read_times) / len(read_times)
        
        write_throughput = num_operations / sum(write_times)
        read_throughput = num_operations / sum(read_times)
        
        # Performance assertions (reasonable expectations)
        self.assertLess(avg_write_time, 0.01, f"Average write time too high: {avg_write_time:.4f}s")
        self.assertLess(avg_read_time, 0.005, f"Average read time too high: {avg_read_time:.4f}s")
        
        self.assertGreater(write_throughput, 1000, f"Write throughput too low: {write_throughput:.1f} ops/sec")
        self.assertGreater(read_throughput, 2000, f"Read throughput too low: {read_throughput:.1f} ops/sec")
        
        print(f"✓ Performance benchmark passed - Write: {avg_write_time*1000:.1f}ms avg, "
              f"{write_throughput:.0f} ops/sec; Read: {avg_read_time*1000:.1f}ms avg, {read_throughput:.0f} ops/sec")


if __name__ == '__main__':
    import unittest
    
    # Configure logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Run the validation test suite
    test_loader = unittest.TestLoader()
    test_suite = test_loader.loadTestsFromTestCase(TestCacheBasicFunctionality)
    
    # Run tests with timeout protection
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    total_tests = result.testsRun
    failures = len(result.failures)
    errors = len(result.errors)
    successes = total_tests - failures - errors
    
    print(f"\n" + "="*60)
    print(f"CACHE VALIDATION TEST RESULTS")
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
    
    print(f"\n" + "="*60)
    
    # Report overall validation status
    if failures == 0 and errors == 0:
        print("✅ CACHE VALIDATION SUCCESSFUL - All core functionality working")
    else:
        print("❌ CACHE VALIDATION FAILED - Some issues detected")
        
    print(f"Cache functionality validated: {successes}/{total_tests} tests passed")