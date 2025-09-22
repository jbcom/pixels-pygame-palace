#!/usr/bin/env python3
"""
Concurrency test for CacheManager atomic operations.

This test verifies that _atomic_write operations work correctly under 
parallel writes and that cache consistency is maintained.
"""

import os
import sys
import tempfile
import threading
import time
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / 'src'))

try:
    from backend.cache_manager import CacheManager, CacheKey, CacheStage
except ImportError:
    # Fallback import
    import importlib.util
    spec = importlib.util.spec_from_file_location("cache_manager", "backend/cache_manager.py")
    if spec is None:
        raise ImportError("Could not load cache_manager module spec")
    cache_module = importlib.util.module_from_spec(spec)
    if spec.loader is None:
        raise ImportError("Cache manager module spec has no loader")
    spec.loader.exec_module(cache_module)
    CacheManager = cache_module.CacheManager
    CacheKey = cache_module.CacheKey
    CacheStage = cache_module.CacheStage


class AtomicityConcurrencyTest:
    """Test atomic operations under concurrent access."""
    
    def __init__(self, num_threads=10, num_operations=50):
        self.num_threads = num_threads
        self.num_operations = num_operations
        self.cache_manager = None
        self.temp_dir = None
        self.results = []
        self.errors = []
        
    def setup(self):
        """Setup test environment."""
        self.temp_dir = tempfile.mkdtemp(prefix='cache_atomicity_test_')
        self.cache_manager = CacheManager(self.temp_dir, max_cache_size_mb=100)
        print(f"Test cache directory: {self.temp_dir}")
        
    def cleanup(self):
        """Cleanup test environment."""
        if self.temp_dir and Path(self.temp_dir).exists():
            import shutil
            shutil.rmtree(self.temp_dir)
            print(f"Cleaned up test directory: {self.temp_dir}")
    
    def worker_thread(self, thread_id: int, shared_key: str):
        """Worker thread that performs concurrent cache operations."""
        try:
            for op_id in range(self.num_operations):
                # Create unique data for this thread/operation
                data = {
                    'thread_id': thread_id,
                    'operation_id': op_id,
                    'timestamp': time.time(),
                    'payload': f"data_from_thread_{thread_id}_op_{op_id}",
                    'large_data': ['item_' + str(i) for i in range(100)]  # Make it substantial
                }
                
                # Use both shared and unique cache keys to test different scenarios
                if op_id % 2 == 0:
                    # Use shared key to test concurrent access to same cache entry
                    cache_key = CacheKey('test', shared_key, CacheStage.INPUTS)
                else:
                    # Use unique key for this thread/operation
                    cache_key = CacheKey('test', f"thread_{thread_id}_op_{op_id}", CacheStage.CODE)
                
                # Perform write operation
                if self.cache_manager is None:
                    self.errors.append(f"Thread {thread_id} Op {op_id}: Cache manager not initialized")
                    continue
                success = self.cache_manager.put(cache_key, data, {
                    'thread_id': thread_id,
                    'operation_id': op_id,
                    'test_metadata': True
                })
                
                if not success:
                    self.errors.append(f"Thread {thread_id} Op {op_id}: Failed to write to cache")
                    continue
                
                # Brief pause to increase chance of concurrent access
                time.sleep(0.001)
                
                # Immediately try to read back the data
                if self.cache_manager is None:
                    self.errors.append(f"Thread {thread_id} Op {op_id}: Cache manager not initialized")
                    continue
                retrieved_data = self.cache_manager.get(cache_key)
                if retrieved_data is None:
                    self.errors.append(f"Thread {thread_id} Op {op_id}: Failed to read back data")
                    continue
                
                # Verify data integrity
                if retrieved_data != data:
                    self.errors.append(f"Thread {thread_id} Op {op_id}: Data corruption detected")
                    continue
                
                self.results.append({
                    'thread_id': thread_id,
                    'operation_id': op_id,
                    'cache_key': str(cache_key),
                    'success': True
                })
                
        except Exception as e:
            self.errors.append(f"Thread {thread_id}: Exception {e}")
    
    def run_concurrent_test(self):
        """Run the concurrent access test."""
        print(f"Starting concurrency test with {self.num_threads} threads, {self.num_operations} ops each...")
        
        shared_key = "shared_atomic_test_key"
        start_time = time.time()
        
        # Use ThreadPoolExecutor for concurrent execution
        with ThreadPoolExecutor(max_workers=self.num_threads) as executor:
            # Submit all worker threads
            futures = [
                executor.submit(self.worker_thread, thread_id, shared_key)
                for thread_id in range(self.num_threads)
            ]
            
            # Wait for all threads to complete
            for future in as_completed(futures):
                try:
                    future.result()  # This will raise any exceptions from the thread
                except Exception as e:
                    self.errors.append(f"Thread execution error: {e}")
        
        end_time = time.time()
        
        print(f"Concurrency test completed in {end_time - start_time:.2f} seconds")
        print(f"Successful operations: {len(self.results)}")
        print(f"Errors: {len(self.errors)}")
        
        return len(self.errors) == 0
    
    def test_atomic_replacement(self):
        """Test that atomic replacement works correctly."""
        print("Testing atomic replacement...")
        
        cache_key = CacheKey('test', 'atomic_replacement_test', CacheStage.ASSETS)
        
        # Write initial data
        initial_data = {'version': 1, 'content': 'initial'}
        if self.cache_manager is None:
            self.errors.append("Cache manager not initialized for atomic replacement test")
            return False
        success = self.cache_manager.put(cache_key, initial_data)
        if not success:
            self.errors.append("Failed to write initial data for atomic replacement test")
            return False
        
        # Verify initial data
        if self.cache_manager is None:
            self.errors.append("Cache manager not initialized for atomic replacement test")
            return False
        retrieved = self.cache_manager.get(cache_key)
        if retrieved != initial_data:
            self.errors.append("Initial data verification failed")
            return False
        
        # Replace with new data
        replacement_data = {'version': 2, 'content': 'replacement', 'new_field': 'added'}
        if self.cache_manager is None:
            self.errors.append("Cache manager not initialized for atomic replacement test")
            return False
        success = self.cache_manager.put(cache_key, replacement_data)
        if not success:
            self.errors.append("Failed to write replacement data")
            return False
        
        # Verify replacement data
        if self.cache_manager is None:
            self.errors.append("Cache manager not initialized for atomic replacement test")
            return False
        retrieved = self.cache_manager.get(cache_key)
        if retrieved != replacement_data:
            self.errors.append("Replacement data verification failed")
            return False
        
        print("Atomic replacement test passed")
        return True
    
    def test_cache_file_integrity(self):
        """Test that cache files maintain integrity under concurrent access."""
        print("Testing cache file integrity...")
        
        # Check cache directory structure
        if self.temp_dir is None:
            self.errors.append("Temporary directory not initialized for file integrity test")
            return False
        cache_root = Path(self.temp_dir)
        
        # Count cache entries
        data_files = list(cache_root.rglob('data.json'))
        metadata_files = list(cache_root.rglob('metadata.json'))
        access_files = list(cache_root.rglob('last_access'))
        
        print(f"Found {len(data_files)} data files")
        print(f"Found {len(metadata_files)} metadata files") 
        print(f"Found {len(access_files)} access files")
        
        # Verify each data file is valid JSON
        corrupted_files = 0
        for data_file in data_files:
            try:
                with open(data_file, 'r') as f:
                    json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                self.errors.append(f"Corrupted data file {data_file}: {e}")
                corrupted_files += 1
        
        # Verify metadata files
        for metadata_file in metadata_files:
            try:
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    # Check required metadata fields
                    if 'created_at' not in metadata or 'size_bytes' not in metadata:
                        self.errors.append(f"Invalid metadata structure in {metadata_file}")
            except (json.JSONDecodeError, IOError) as e:
                self.errors.append(f"Corrupted metadata file {metadata_file}: {e}")
                corrupted_files += 1
        
        print(f"File integrity check: {corrupted_files} corrupted files found")
        return corrupted_files == 0
    
    def run_all_tests(self):
        """Run all atomicity and concurrency tests."""
        print("="*60)
        print("CACHE ATOMICITY AND CONCURRENCY TEST SUITE")
        print("="*60)
        
        try:
            self.setup()
            
            # Test 1: Atomic replacement
            test1_passed = self.test_atomic_replacement()
            
            # Test 2: Concurrent access
            test2_passed = self.run_concurrent_test()
            
            # Test 3: File integrity
            test3_passed = self.test_cache_file_integrity()
            
            # Final results
            print("\n" + "="*60)
            print("TEST RESULTS")
            print("="*60)
            print(f"✅ Atomic replacement test: {'PASSED' if test1_passed else 'FAILED'}")
            print(f"✅ Concurrent access test: {'PASSED' if test2_passed else 'FAILED'}")
            print(f"✅ File integrity test: {'PASSED' if test3_passed else 'FAILED'}")
            
            if self.errors:
                print(f"\n❌ {len(self.errors)} errors found:")
                for error in self.errors[:10]:  # Show first 10 errors
                    print(f"   - {error}")
                if len(self.errors) > 10:
                    print(f"   ... and {len(self.errors) - 10} more errors")
            
            overall_success = test1_passed and test2_passed and test3_passed
            print(f"\n🎯 OVERALL RESULT: {'SUCCESS' if overall_success else 'FAILURE'}")
            
            # Cache stats
            if self.cache_manager is None:
                print("\n📊 Cache Stats: Cache manager not initialized")
                return overall_success
            stats = self.cache_manager.get_stats()
            print(f"\n📊 Cache Stats:")
            print(f"   - Total cache entries: {stats.get('entry_count', 0)}")
            print(f"   - Cache size: {stats.get('cache_size_mb', 0):.2f} MB")
            print(f"   - Cache hits: {stats.get('metrics', {}).get('hits', 0)}")
            print(f"   - Cache misses: {stats.get('metrics', {}).get('misses', 0)}")
            print(f"   - Cache writes: {stats.get('metrics', {}).get('writes', 0)}")
            
            return overall_success
            
        finally:
            self.cleanup()


def main():
    """Run the atomicity test."""
    # Test with moderate concurrency
    test = AtomicityConcurrencyTest(num_threads=8, num_operations=25)
    success = test.run_all_tests()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()