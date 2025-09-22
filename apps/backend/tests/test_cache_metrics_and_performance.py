"""
Comprehensive metrics export and performance testing for cache functionality.

This test suite validates:
- Metrics export testing (JSON exports, accuracy validation, throughput reporting)
- Stress/performance testing (baseline metrics, high-throughput, regression testing)
- Cache health reporting and per-stage statistics
- Build time recording and performance tracking under load
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
import psutil
from pathlib import Path
from typing import Dict, Any, List, Tuple
from unittest import TestCase
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed, ProcessPoolExecutor
import logging

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from cache_manager import CacheManager, CacheKey, CacheStage, EvictionConfig, CacheMetrics


class TestCacheMetricsExport(TestCase):
    """Test cache metrics export functionality and accuracy validation."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_metrics_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=15)
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass
    
    def test_cache_metrics_json_export_under_load(self):
        """Test cache_metrics.json export functionality under concurrent load."""
        # Generate load to create meaningful metrics
        cache_keys = []
        operations_completed = []
        
        def load_generator_worker(worker_id: int):
            """Generate cache operations to create metrics."""
            worker_ops = []
            
            for i in range(100):
                # Mix of operations to generate diverse metrics
                operation_type = random.choices(['get', 'put'], weights=[0.7, 0.3])[0]
                
                if operation_type == 'put' or not cache_keys:
                    # Write operation
                    key = CacheKey('test', f'metrics_key_{worker_id}_{i}', 
                                 random.choice([CacheStage.CODE, CacheStage.ASSETS, CacheStage.WEB]))
                    data = {
                        'worker': worker_id,
                        'iteration': i,
                        'data': 'x' * random.randint(1024, 10240),  # 1-10KB
                        'timestamp': time.time()
                    }
                    
                    start_time = time.time()
                    success = self.cache_manager.put(key, data, build_time=random.uniform(0.1, 2.0))
                    duration = time.time() - start_time
                    
                    if success:
                        cache_keys.append(key)
                    
                    worker_ops.append({
                        'type': 'put',
                        'success': success,
                        'duration': duration,
                        'stage': key.stage,
                        'size': len(str(data))
                    })
                
                else:
                    # Read operation
                    key = random.choice(cache_keys)
                    
                    start_time = time.time()
                    data = self.cache_manager.get(key)
                    duration = time.time() - start_time
                    
                    worker_ops.append({
                        'type': 'get',
                        'success': data is not None,
                        'duration': duration,
                        'stage': key.stage,
                        'size': len(str(data)) if data else 0
                    })
                
                # Trigger metrics export periodically
                if i % 25 == 0:
                    self.cache_manager._maybe_export_metrics()
                
                time.sleep(0.001)  # Small delay
            
            operations_completed.extend(worker_ops)
            return len(worker_ops)
        
        # Run concurrent load
        num_workers = 8
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(load_generator_worker, i) for i in range(num_workers)]
            total_operations = sum(future.result() for future in as_completed(futures))
        
        # Force final metrics export
        self.cache_manager._maybe_export_metrics()
        
        # Verify metrics file was created and contains valid data
        metrics_file = self.cache_manager.metrics_file
        self.assertTrue(metrics_file.exists(), "Metrics file should be created")
        
        with open(metrics_file, 'r') as f:
            metrics_data = json.load(f)
        
        # Validate metrics structure and content
        required_sections = ['cache_info', 'current_usage', 'performance_metrics', 'stage_breakdown']
        for section in required_sections:
            self.assertIn(section, metrics_data, f"Metrics should include {section}")
        
        # Validate performance metrics
        perf_metrics = metrics_data['performance_metrics']
        self.assertIn('basic_metrics', perf_metrics)
        self.assertIn('performance_metrics', perf_metrics)
        self.assertIn('stage_statistics', perf_metrics)
        
        # Verify hit/miss counts are reasonable
        basic_metrics = perf_metrics['basic_metrics']
        total_requests = basic_metrics['hits'] + basic_metrics['misses']
        self.assertGreater(total_requests, 0, "Should have recorded cache requests")
        self.assertGreaterEqual(basic_metrics['writes'], 0, "Should have recorded writes")
        
        # Verify stage-specific statistics
        stage_stats = perf_metrics['stage_statistics']
        self.assertGreater(len(stage_stats), 0, "Should have stage-specific statistics")
        
        for stage, stats in stage_stats.items():
            self.assertIn('hits', stats)
            self.assertIn('misses', stats)
            self.assertIn('avg_read_time_ms', stats)
            self.assertIn('avg_write_time_ms', stats)
            self.assertIn('avg_build_time_s', stats)
        
        print(f"Metrics export test: {total_operations} operations, {total_requests} cache requests, "
              f"{len(stage_stats)} stages tracked")
    
    def test_cache_health_json_export_under_load(self):
        """Test cache_health.json export and health indicators."""
        # Create load scenario that generates health events
        cache_keys = []
        
        # Fill cache to trigger eviction and health events
        for i in range(200):
            key = CacheKey('test', f'health_key_{i}', CacheStage.CODE)
            data = {'health_test': True, 'data': 'x' * (1024 * 50)}  # 50KB each
            self.cache_manager.put(key, data)
            cache_keys.append(key)
        
        # Force cleanup to generate health report
        cleanup_result = self.cache_manager.force_cleanup()
        self.assertTrue(cleanup_result['success'])
        
        # Generate health report
        health_report = self.cache_manager.get_cache_health_report()
        
        # Validate health report structure
        required_fields = ['report_timestamp', 'cache_statistics', 'recommendations']
        for field in required_fields:
            self.assertIn(field, health_report, f"Health report should include {field}")
        
        # Verify cache statistics in health report
        cache_stats = health_report['cache_statistics']
        self.assertIn('current_usage', cache_stats)
        self.assertIn('performance_metrics', cache_stats)
        self.assertIn('health_indicators', cache_stats)
        
        # Verify health indicators
        health_indicators = cache_stats['health_indicators']
        self.assertIn('overall_status', health_indicators)
        self.assertIn('warnings', health_indicators)
        self.assertIn('recommendations', health_indicators)
        
        # Verify recommendations are generated
        recommendations = health_report['recommendations']
        self.assertIsInstance(recommendations, list, "Recommendations should be a list")
        
        # Check that health file was written
        health_file = self.cache_manager.health_report_file
        if health_file.exists():
            with open(health_file, 'r') as f:
                health_file_data = json.load(f)
            
            # Validate cleanup report structure
            expected_fields = ['cleanup_timestamp', 'utilization_before_percent', 
                             'utilization_after_percent', 'entries_removed']
            for field in expected_fields:
                self.assertIn(field, health_file_data, f"Health file should include {field}")
        
        print(f"Health export test: status={health_indicators['overall_status']}, "
              f"recommendations={len(recommendations)}")
    
    def test_hit_miss_rate_accuracy_with_concurrent_operations(self):
        """Test accuracy of hit/miss rate tracking during concurrent operations."""
        # Pre-populate cache with known keys
        known_keys = []
        for i in range(50):
            key = CacheKey('test', f'known_key_{i}', CacheStage.ASSETS)
            data = {'known': True, 'index': i}
            success = self.cache_manager.put(key, data)
            self.assertTrue(success)
            known_keys.append(key)
        
        # Track expected hits and misses
        expected_hits = 0
        expected_misses = 0
        operation_lock = threading.Lock()
        
        def accuracy_test_worker(worker_id: int):
            """Worker that performs predictable cache operations."""
            nonlocal expected_hits, expected_misses
            local_hits = 0
            local_misses = 0
            
            for i in range(100):
                if random.random() < 0.7:  # 70% access known keys (should hit)
                    key = random.choice(known_keys)
                    data = self.cache_manager.get(key)
                    if data is not None:
                        local_hits += 1
                    else:
                        local_misses += 1
                else:  # 30% access unknown keys (should miss)
                    key = CacheKey('test', f'unknown_key_{worker_id}_{i}', CacheStage.CODE)
                    data = self.cache_manager.get(key)
                    if data is not None:
                        local_hits += 1
                    else:
                        local_misses += 1
                
                time.sleep(0.001)
            
            with operation_lock:
                expected_hits += local_hits
                expected_misses += local_misses
        
        # Reset metrics for accurate measurement
        self.cache_manager.metrics = CacheMetrics()
        
        # Run concurrent accuracy test
        num_workers = 6
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(accuracy_test_worker, i) for i in range(num_workers)]
            for future in as_completed(futures):
                future.result()
        
        # Get final metrics
        final_metrics = self.cache_manager.metrics
        recorded_hits = final_metrics.hits
        recorded_misses = final_metrics.misses
        
        # Verify accuracy (allow small tolerance for timing issues)
        hit_accuracy = abs(recorded_hits - expected_hits) / max(1, expected_hits)
        miss_accuracy = abs(recorded_misses - expected_misses) / max(1, expected_misses)
        
        self.assertLess(hit_accuracy, 0.05, f"Hit count accuracy error too high: {hit_accuracy:.3f}")
        self.assertLess(miss_accuracy, 0.05, f"Miss count accuracy error too high: {miss_accuracy:.3f}")
        
        # Verify hit rate calculation
        total_requests = recorded_hits + recorded_misses
        calculated_hit_rate = final_metrics.get_hit_rate()
        expected_hit_rate = (recorded_hits / total_requests * 100) if total_requests > 0 else 0
        
        self.assertAlmostEqual(calculated_hit_rate, expected_hit_rate, places=2,
                              msg="Hit rate calculation should be accurate")
        
        print(f"Hit/miss accuracy test: expected {expected_hits}H/{expected_misses}M, "
              f"recorded {recorded_hits}H/{recorded_misses}M, rate {calculated_hit_rate:.1f}%")
    
    def test_throughput_reporting_and_performance_tracking(self):
        """Test throughput reporting and performance tracking capabilities."""
        # Configure for throughput measurement
        test_duration = 5.0  # 5 seconds
        start_time = time.time()
        
        # Track operations for throughput calculation
        operations_performed = []
        throughput_lock = threading.Lock()
        
        def throughput_worker(worker_id: int):
            """Worker that performs operations for throughput measurement."""
            local_ops = []
            operation_count = 0
            
            while time.time() - start_time < test_duration:
                operation_start = time.time()
                
                # Alternate between reads and writes
                if operation_count % 3 == 0:  # 33% writes
                    key = CacheKey('test', f'throughput_key_{worker_id}_{operation_count}', 
                                 CacheStage.CODE)
                    data = {'throughput_test': True, 'data': 'x' * 1024}
                    
                    success = self.cache_manager.put(key, data)
                    operation_type = 'put'
                else:  # 67% reads
                    # Try to read existing key or random key
                    key = CacheKey('test', f'throughput_key_{random.randint(0, 10)}_{random.randint(0, 100)}', 
                                 CacheStage.CODE)
                    data = self.cache_manager.get(key)
                    success = True  # Gets always "succeed"
                    operation_type = 'get'
                
                operation_duration = time.time() - operation_start
                
                local_ops.append({
                    'worker': worker_id,
                    'type': operation_type,
                    'duration': operation_duration,
                    'timestamp': time.time()
                })
                
                operation_count += 1
                time.sleep(0.001)  # Small delay to prevent overwhelming
            
            with throughput_lock:
                operations_performed.extend(local_ops)
            
            return len(local_ops)
        
        # Run throughput test
        num_workers = 8
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(throughput_worker, i) for i in range(num_workers)]
            total_operations = sum(future.result() for future in as_completed(futures))
        
        actual_duration = time.time() - start_time
        
        # Calculate throughput metrics
        overall_throughput = total_operations / actual_duration
        
        # Separate by operation type
        get_ops = [op for op in operations_performed if op['type'] == 'get']
        put_ops = [op for op in operations_performed if op['type'] == 'put']
        
        get_throughput = len(get_ops) / actual_duration
        put_throughput = len(put_ops) / actual_duration
        
        # Calculate latency statistics
        get_latencies = [op['duration'] for op in get_ops]
        put_latencies = [op['duration'] for op in put_ops]
        
        avg_get_latency = statistics.mean(get_latencies) if get_latencies else 0
        avg_put_latency = statistics.mean(put_latencies) if put_latencies else 0
        p95_get_latency = statistics.quantiles(get_latencies, n=20)[18] if len(get_latencies) > 20 else 0
        p95_put_latency = statistics.quantiles(put_latencies, n=20)[18] if len(put_latencies) > 20 else 0
        
        # Get metrics from cache manager
        cache_metrics = self.cache_manager.metrics
        
        # Verify performance tracking
        self.assertGreater(len(cache_metrics.read_times), 0, "Should have tracked read times")
        self.assertGreater(len(cache_metrics.write_times), 0, "Should have tracked write times")
        
        # Verify throughput is reasonable (should handle at least 100 ops/sec)
        self.assertGreater(overall_throughput, 100,
                          f"Overall throughput too low: {overall_throughput:.1f} ops/sec")
        
        # Verify latencies are reasonable (should be under 10ms for cached operations)
        self.assertLess(avg_get_latency, 0.01, f"Average get latency too high: {avg_get_latency:.3f}s")
        self.assertLess(avg_put_latency, 0.05, f"Average put latency too high: {avg_put_latency:.3f}s")
        
        print(f"Throughput test: {overall_throughput:.1f} ops/sec total, "
              f"{get_throughput:.1f} gets/sec, {put_throughput:.1f} puts/sec, "
              f"latencies: get={avg_get_latency*1000:.1f}ms, put={avg_put_latency*1000:.1f}ms")
    
    def test_per_stage_statistics_and_build_time_recording(self):
        """Test per-stage statistics tracking and build time recording."""
        # Test data for each stage
        stage_operations = {
            CacheStage.INPUTS: [],
            CacheStage.ASSETS: [],
            CacheStage.CODE: [],
            CacheStage.DESKTOP: [],
            CacheStage.WEB: []
        }
        
        # Perform operations on each stage with different build times
        for stage in stage_operations.keys():
            for i in range(20):
                key = CacheKey('test', f'stage_key_{stage}_{i}', stage)
                data = {
                    'stage_test': True,
                    'stage': stage,
                    'data': 'x' * random.randint(512, 2048)
                }
                
                # Simulate different build times for each stage
                build_time_map = {
                    CacheStage.INPUTS: random.uniform(0.1, 0.5),
                    CacheStage.ASSETS: random.uniform(0.5, 2.0),
                    CacheStage.CODE: random.uniform(1.0, 5.0),
                    CacheStage.DESKTOP: random.uniform(2.0, 8.0),
                    CacheStage.WEB: random.uniform(1.5, 6.0)
                }
                
                build_time = build_time_map[stage]
                
                # Store with build time
                success = self.cache_manager.put(key, data, build_time=build_time)
                self.assertTrue(success)
                
                stage_operations[stage].append({
                    'key': key,
                    'build_time': build_time,
                    'data_size': len(str(data))
                })
        
        # Perform reads to generate read statistics
        for stage, ops in stage_operations.items():
            for op in ops[:10]:  # Read first 10 from each stage
                retrieved = self.cache_manager.get(op['key'])
                self.assertIsNotNone(retrieved)
                self.assertEqual(retrieved['stage'], stage)
        
        # Get comprehensive statistics
        stats = self.cache_manager.get_comprehensive_stats()
        
        # Verify stage breakdown exists
        self.assertIn('stage_breakdown', stats)
        stage_breakdown = stats['stage_breakdown']
        
        # Verify per-stage statistics
        perf_metrics = stats['performance_metrics']
        self.assertIn('stage_statistics', perf_metrics)
        stage_stats = perf_metrics['stage_statistics']
        
        # Verify each stage has statistics
        for stage in stage_operations.keys():
            if stage in stage_stats:  # Only check stages that have data
                stage_data = stage_stats[stage]
                
                # Verify required fields
                required_fields = ['hits', 'misses', 'writes', 'avg_read_time_ms', 
                                 'avg_write_time_ms', 'avg_build_time_s']
                for field in required_fields:
                    self.assertIn(field, stage_data, f"Stage {stage} should have {field}")
                
                # Verify build time was recorded
                if stage_data['writes'] > 0:
                    self.assertGreater(stage_data['avg_build_time_s'], 0,
                                     f"Stage {stage} should have recorded build time")
                
                # Verify read/write counts are reasonable
                self.assertGreaterEqual(stage_data['writes'], 0)
                self.assertGreaterEqual(stage_data['hits'] + stage_data['misses'], 0)
        
        # Verify build time tracking in metrics
        build_times = self.cache_manager.metrics.build_times
        for stage in stage_operations.keys():
            if stage in build_times and len(build_times[stage]) > 0:
                recorded_times = list(build_times[stage])
                expected_times = [op['build_time'] for op in stage_operations[stage]]
                
                # Verify some build times were recorded
                self.assertGreater(len(recorded_times), 0,
                                 f"Stage {stage} should have recorded build times")
                
                # Verify build times are in reasonable range
                avg_recorded = statistics.mean(recorded_times)
                avg_expected = statistics.mean(expected_times)
                
                # Allow some tolerance for timing variations
                self.assertLess(abs(avg_recorded - avg_expected), avg_expected * 0.2,
                               f"Stage {stage} build time tracking inaccurate")
        
        print(f"Per-stage statistics test: {len(stage_breakdown)} stages tracked, "
              f"build times recorded for {len(build_times)} stages")


class TestCacheStressAndPerformance(TestCase):
    """Test cache under stress conditions and performance regression testing."""
    
    def setUp(self):
        """Set up test environment with temporary cache directory."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_stress_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=50)  # Larger cache for stress tests
        
    def tearDown(self):
        """Clean up test environment."""
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass
    
    def test_capture_baseline_metrics(self):
        """Capture baseline performance metrics for regression testing."""
        # Baseline test configuration
        num_entries = 1000
        entry_size = 1024 * 10  # 10KB per entry
        
        # Measure write performance
        write_times = []
        cache_keys = []
        
        for i in range(num_entries):
            key = CacheKey('baseline', f'key_{i:04d}', CacheStage.CODE)
            data = {
                'baseline_test': True,
                'index': i,
                'data': 'x' * entry_size,
                'timestamp': time.time()
            }
            
            start_time = time.time()
            success = self.cache_manager.put(key, data)
            write_duration = time.time() - start_time
            
            self.assertTrue(success, f"Baseline write {i} should succeed")
            write_times.append(write_duration)
            cache_keys.append(key)
        
        # Measure read performance
        read_times = []
        hit_count = 0
        
        for key in cache_keys:
            start_time = time.time()
            data = self.cache_manager.get(key)
            read_duration = time.time() - start_time
            
            read_times.append(read_duration)
            if data is not None:
                hit_count += 1
        
        # Calculate baseline metrics
        baseline_metrics = {
            'write_latency': {
                'mean': statistics.mean(write_times),
                'median': statistics.median(write_times),
                'p95': statistics.quantiles(write_times, n=20)[18] if len(write_times) > 20 else max(write_times),
                'p99': statistics.quantiles(write_times, n=100)[98] if len(write_times) > 100 else max(write_times)
            },
            'read_latency': {
                'mean': statistics.mean(read_times),
                'median': statistics.median(read_times),
                'p95': statistics.quantiles(read_times, n=20)[18] if len(read_times) > 20 else max(read_times),
                'p99': statistics.quantiles(read_times, n=100)[98] if len(read_times) > 100 else max(read_times)
            },
            'hit_rate': (hit_count / len(cache_keys)) * 100,
            'throughput': {
                'writes_per_second': num_entries / sum(write_times),
                'reads_per_second': len(cache_keys) / sum(read_times)
            },
            'cache_efficiency': {
                'entries': num_entries,
                'total_size_mb': (num_entries * entry_size) / (1024 * 1024),
                'avg_entry_size_kb': entry_size / 1024
            }
        }
        
        # Verify baseline performance is reasonable
        self.assertLess(baseline_metrics['write_latency']['mean'], 0.01,
                       f"Baseline write latency too high: {baseline_metrics['write_latency']['mean']:.3f}s")
        
        self.assertLess(baseline_metrics['read_latency']['mean'], 0.005,
                       f"Baseline read latency too high: {baseline_metrics['read_latency']['mean']:.3f}s")
        
        self.assertGreater(baseline_metrics['hit_rate'], 95.0,
                          f"Baseline hit rate too low: {baseline_metrics['hit_rate']:.1f}%")
        
        self.assertGreater(baseline_metrics['throughput']['writes_per_second'], 1000,
                          f"Baseline write throughput too low: {baseline_metrics['throughput']['writes_per_second']:.1f} ops/sec")
        
        # Save baseline metrics for comparison
        baseline_file = Path(self.temp_dir) / 'baseline_metrics.json'
        with open(baseline_file, 'w') as f:
            json.dump(baseline_metrics, f, indent=2)
        
        print(f"Baseline metrics: write={baseline_metrics['write_latency']['mean']*1000:.1f}ms, "
              f"read={baseline_metrics['read_latency']['mean']*1000:.1f}ms, "
              f"hit_rate={baseline_metrics['hit_rate']:.1f}%")
        
        return baseline_metrics
    
    def test_high_throughput_concurrent_operations(self):
        """Test cache performance under high-throughput concurrent load."""
        # High throughput test configuration
        num_workers = 16
        operations_per_worker = 500
        test_duration = 10.0  # 10 seconds
        
        # Track performance metrics
        all_operations = []
        operations_lock = threading.Lock()
        start_time = time.time()
        
        def high_throughput_worker(worker_id: int):
            """Worker that performs high-frequency cache operations."""
            worker_ops = []
            operation_count = 0
            
            while (time.time() - start_time) < test_duration and operation_count < operations_per_worker:
                operation_start = time.time()
                
                # Mix of operations weighted toward reads
                if random.random() < 0.8:  # 80% reads
                    key = CacheKey('stress', f'key_{random.randint(0, 1000)}', CacheStage.CODE)
                    data = self.cache_manager.get(key)
                    op_type = 'get'
                    success = True
                else:  # 20% writes
                    key = CacheKey('stress', f'key_{worker_id}_{operation_count}', CacheStage.ASSETS)
                    data = {
                        'worker': worker_id,
                        'op': operation_count,
                        'data': 'x' * random.randint(512, 5120)  # 512B-5KB
                    }
                    success = self.cache_manager.put(key, data)
                    op_type = 'put'
                
                operation_duration = time.time() - operation_start
                
                worker_ops.append({
                    'worker': worker_id,
                    'type': op_type,
                    'duration': operation_duration,
                    'success': success,
                    'timestamp': time.time()
                })
                
                operation_count += 1
            
            with operations_lock:
                all_operations.extend(worker_ops)
            
            return len(worker_ops)
        
        # Run high throughput test
        test_start = time.time()
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = [executor.submit(high_throughput_worker, i) for i in range(num_workers)]
            total_operations = sum(future.result() for future in as_completed(futures))
        
        test_actual_duration = time.time() - test_start
        
        # Analyze performance under high load
        successful_operations = sum(1 for op in all_operations if op['success'])
        failed_operations = total_operations - successful_operations
        
        # Calculate throughput metrics
        overall_throughput = total_operations / test_actual_duration
        success_rate = successful_operations / total_operations
        
        # Latency analysis
        get_ops = [op for op in all_operations if op['type'] == 'get']
        put_ops = [op for op in all_operations if op['type'] == 'put']
        
        get_latencies = [op['duration'] for op in get_ops]
        put_latencies = [op['duration'] for op in put_ops]
        
        avg_get_latency = statistics.mean(get_latencies) if get_latencies else 0
        avg_put_latency = statistics.mean(put_latencies) if put_latencies else 0
        p95_get_latency = statistics.quantiles(get_latencies, n=20)[18] if len(get_latencies) > 20 else 0
        p95_put_latency = statistics.quantiles(put_latencies, n=20)[18] if len(put_latencies) > 20 else 0
        
        # Performance assertions
        self.assertGreater(overall_throughput, 5000,
                          f"High throughput test failed: {overall_throughput:.1f} ops/sec")
        
        self.assertGreater(success_rate, 0.95,
                          f"Success rate under load too low: {success_rate:.3f}")
        
        # Latency should not degrade too much under load
        self.assertLess(avg_get_latency, 0.02,
                       f"Get latency under load too high: {avg_get_latency:.3f}s")
        
        self.assertLess(p95_get_latency, 0.05,
                       f"P95 get latency under load too high: {p95_get_latency:.3f}s")
        
        # Check system resource usage
        process = psutil.Process()
        cpu_percent = process.cpu_percent()
        memory_mb = process.memory_info().rss / (1024 * 1024)
        
        print(f"High throughput test: {overall_throughput:.1f} ops/sec, "
              f"success_rate={success_rate:.3f}, "
              f"latency: get={avg_get_latency*1000:.1f}ms/p95={p95_get_latency*1000:.1f}ms, "
              f"put={avg_put_latency*1000:.1f}ms/p95={p95_put_latency*1000:.1f}ms, "
              f"CPU={cpu_percent:.1f}%, Memory={memory_mb:.1f}MB")
    
    def test_no_deadlocks_under_stress_conditions(self):
        """Test that no deadlocks occur under extreme stress conditions."""
        # Extreme stress test configuration
        num_concurrent_operations = 32
        operation_timeout = 5.0  # 5 second timeout per operation
        test_duration = 15.0  # 15 second test
        
        # Shared resources that could cause contention
        shared_keys = [CacheKey('stress', f'shared_key_{i}', CacheStage.CODE) for i in range(10)]
        
        # Track timeouts and hangs
        completed_operations = []
        timeout_operations = []
        operation_tracking_lock = threading.Lock()
        
        def stress_worker(worker_id: int):
            """Worker that performs potentially conflicting operations."""
            worker_completions = []
            worker_timeouts = []
            start_time = time.time()
            
            operation_count = 0
            while (time.time() - start_time) < test_duration:
                operation_start = time.time()
                
                try:
                    # Randomly choose operation type and keys
                    operation_type = random.choice(['get', 'put', 'cleanup'])
                    
                    if operation_type == 'get':
                        key = random.choice(shared_keys)
                        data = self.cache_manager.get(key)
                        success = True
                    
                    elif operation_type == 'put':
                        key = random.choice(shared_keys)
                        data = {
                            'stress_worker': worker_id,
                            'operation': operation_count,
                            'data': 'x' * random.randint(1024, 10240)
                        }
                        success = self.cache_manager.put(key, data)
                    
                    else:  # cleanup
                        # Trigger cleanup occasionally
                        try:
                            self.cache_manager._maybe_cleanup_intelligent()
                            success = True
                        except Exception:
                            success = False
                    
                    operation_duration = time.time() - operation_start
                    
                    # Check for timeout
                    if operation_duration > operation_timeout:
                        worker_timeouts.append({
                            'worker': worker_id,
                            'operation': operation_type,
                            'duration': operation_duration
                        })
                    
                    worker_completions.append({
                        'worker': worker_id,
                        'operation': operation_type,
                        'duration': operation_duration,
                        'success': success
                    })
                    
                except Exception as e:
                    operation_duration = time.time() - operation_start
                    worker_completions.append({
                        'worker': worker_id,
                        'operation': operation_type,
                        'duration': operation_duration,
                        'success': False,
                        'error': str(e)
                    })
                
                operation_count += 1
                time.sleep(0.001)  # Minimal delay
            
            with operation_tracking_lock:
                completed_operations.extend(worker_completions)
                timeout_operations.extend(worker_timeouts)
            
            return len(worker_completions)
        
        # Run extreme stress test
        stress_start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_concurrent_operations) as executor:
            futures = [executor.submit(stress_worker, i) for i in range(num_concurrent_operations)]
            
            completed_workers = 0
            for future in as_completed(futures, timeout=test_duration + 10):
                try:
                    operations = future.result()
                    completed_workers += 1
                except Exception as e:
                    print(f"Stress worker failed: {e}")
        
        stress_total_duration = time.time() - stress_start_time
        
        # Analyze stress test results
        total_completed = len(completed_operations)
        total_timeouts = len(timeout_operations)
        successful_ops = sum(1 for op in completed_operations if op.get('success', False))
        
        # Calculate metrics
        completion_rate = completed_workers / num_concurrent_operations
        timeout_rate = total_timeouts / max(1, total_completed)
        success_rate = successful_ops / max(1, total_completed)
        
        # Calculate operation durations
        operation_durations = [op['duration'] for op in completed_operations if 'duration' in op]
        avg_operation_time = statistics.mean(operation_durations) if operation_durations else 0
        max_operation_time = max(operation_durations) if operation_durations else 0
        
        # Deadlock prevention verification
        self.assertGreater(completion_rate, 0.90,
                          f"Worker completion rate too low (possible deadlock): {completion_rate:.3f}")
        
        self.assertLess(timeout_rate, 0.02,
                       f"Operation timeout rate too high (possible deadlock): {timeout_rate:.3f}")
        
        self.assertGreater(success_rate, 0.85,
                          f"Operation success rate too low under stress: {success_rate:.3f}")
        
        # Performance should not degrade excessively
        self.assertLess(avg_operation_time, 0.1,
                       f"Average operation time too high under stress: {avg_operation_time:.3f}s")
        
        self.assertLess(max_operation_time, operation_timeout,
                       f"Maximum operation time exceeded timeout: {max_operation_time:.3f}s")
        
        print(f"Stress test: {total_completed} operations, {total_timeouts} timeouts, "
              f"completion_rate={completion_rate:.3f}, success_rate={success_rate:.3f}, "
              f"avg_time={avg_operation_time:.3f}s, max_time={max_operation_time:.3f}s")
    
    def test_performance_regression_testing(self):
        """Test for performance regressions compared to baseline."""
        # First establish baseline
        baseline_metrics = self.test_capture_baseline_metrics()
        
        # Run regression test with same parameters
        num_entries = 1000
        entry_size = 1024 * 10  # 10KB per entry
        
        # Test write performance
        write_times = []
        cache_keys = []
        
        for i in range(num_entries):
            key = CacheKey('regression', f'key_{i:04d}', CacheStage.CODE)
            data = {
                'regression_test': True,
                'index': i,
                'data': 'x' * entry_size,
                'timestamp': time.time()
            }
            
            start_time = time.time()
            success = self.cache_manager.put(key, data)
            write_duration = time.time() - start_time
            
            self.assertTrue(success)
            write_times.append(write_duration)
            cache_keys.append(key)
        
        # Test read performance
        read_times = []
        hit_count = 0
        
        for key in cache_keys:
            start_time = time.time()
            data = self.cache_manager.get(key)
            read_duration = time.time() - start_time
            
            read_times.append(read_duration)
            if data is not None:
                hit_count += 1
        
        # Calculate regression test metrics
        regression_metrics = {
            'write_latency': {
                'mean': statistics.mean(write_times),
                'p95': statistics.quantiles(write_times, n=20)[18] if len(write_times) > 20 else max(write_times)
            },
            'read_latency': {
                'mean': statistics.mean(read_times),
                'p95': statistics.quantiles(read_times, n=20)[18] if len(read_times) > 20 else max(read_times)
            },
            'hit_rate': (hit_count / len(cache_keys)) * 100,
            'throughput': {
                'writes_per_second': num_entries / sum(write_times),
                'reads_per_second': len(cache_keys) / sum(read_times)
            }
        }
        
        # Compare against baseline (allow 20% degradation tolerance)
        regression_tolerance = 0.20
        
        # Write latency regression check
        write_latency_regression = (regression_metrics['write_latency']['mean'] - baseline_metrics['write_latency']['mean']) / baseline_metrics['write_latency']['mean']
        self.assertLess(write_latency_regression, regression_tolerance,
                       f"Write latency regression: {write_latency_regression:.3f} > {regression_tolerance}")
        
        # Read latency regression check
        read_latency_regression = (regression_metrics['read_latency']['mean'] - baseline_metrics['read_latency']['mean']) / baseline_metrics['read_latency']['mean']
        self.assertLess(read_latency_regression, regression_tolerance,
                       f"Read latency regression: {read_latency_regression:.3f} > {regression_tolerance}")
        
        # Hit rate should not degrade
        hit_rate_change = baseline_metrics['hit_rate'] - regression_metrics['hit_rate']
        self.assertLess(hit_rate_change, 5.0,
                       f"Hit rate regression: {hit_rate_change:.1f}% drop")
        
        # Throughput should not degrade significantly
        write_throughput_change = (baseline_metrics['throughput']['writes_per_second'] - regression_metrics['throughput']['writes_per_second']) / baseline_metrics['throughput']['writes_per_second']
        self.assertLess(write_throughput_change, regression_tolerance,
                       f"Write throughput regression: {write_throughput_change:.3f} > {regression_tolerance}")
        
        print(f"Regression test: write_latency_change={write_latency_regression:.3f}, "
              f"read_latency_change={read_latency_regression:.3f}, "
              f"hit_rate_change={hit_rate_change:.1f}%, "
              f"throughput_change={write_throughput_change:.3f}")


if __name__ == '__main__':
    import unittest
    
    # Configure logging for test output
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Run the metrics and performance test suite
    test_loader = unittest.TestLoader()
    test_suite = unittest.TestSuite()
    
    # Add all test classes
    test_classes = [
        TestCacheMetricsExport,
        TestCacheStressAndPerformance
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
    print(f"CACHE METRICS & PERFORMANCE TEST RESULTS")
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