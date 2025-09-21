"""
Concurrent Sessions Performance Test
Tests Flask backend performance with multiple concurrent game sessions
"""

import os
import sys
import time
import json
import threading
import concurrent.futures
from typing import List, Dict, Any, Tuple
import statistics
import psutil
import traceback
from datetime import datetime

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from e2e.backend_test_suite import APITestHelper

# Test configuration
API_BASE_URL = "http://localhost:5000/api"
CONCURRENT_USERS = [5, 10, 20]
GAME_DURATION = 10  # seconds per game session
FRAME_COLLECTION_INTERVAL = 0.1  # seconds between frame requests

class ConcurrentSessionTester:
    """Test concurrent game sessions on Flask backend"""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.results = {
            "test_timestamp": datetime.now().isoformat(),
            "concurrent_tests": [],
            "resource_usage": [],
            "errors": []
        }
        
    def create_test_game_code(self) -> str:
        """Create a simple pygame test code"""
        return """
import pygame
import sys
import random
import time

pygame.init()
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("Performance Test Game")
clock = pygame.time.Clock()

# Simple game with moving objects for performance testing
class TestObject:
    def __init__(self):
        self.x = random.randint(0, 800)
        self.y = random.randint(0, 600)
        self.vx = random.randint(-5, 5)
        self.vy = random.randint(-5, 5)
        self.color = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
    
    def update(self):
        self.x += self.vx
        self.y += self.vy
        if self.x < 0 or self.x > 800:
            self.vx = -self.vx
        if self.y < 0 or self.y > 600:
            self.vy = -self.vy
    
    def draw(self, screen):
        pygame.draw.circle(screen, self.color, (int(self.x), int(self.y)), 10)

# Create test objects
objects = [TestObject() for _ in range(20)]

running = True
frame_count = 0
start_time = time.time()

while running and time.time() - start_time < 10:  # Run for 10 seconds max
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Update objects
    for obj in objects:
        obj.update()
    
    # Draw everything
    screen.fill((0, 0, 0))
    for obj in objects:
        obj.draw(screen)
    
    # Draw FPS counter
    fps = clock.get_fps()
    font = pygame.font.Font(None, 36)
    text = font.render(f"FPS: {fps:.1f} Frame: {frame_count}", True, (255, 255, 255))
    screen.blit(text, (10, 10))
    
    pygame.display.flip()
    clock.tick(60)  # 60 FPS target
    frame_count += 1

pygame.quit()
sys.exit()
"""
    
    def simulate_single_user(self, user_id: int, duration: int = GAME_DURATION) -> Dict:
        """Simulate a single user playing a game"""
        result = {
            "user_id": user_id,
            "start_time": time.time(),
            "end_time": None,
            "compilation_time": None,
            "execution_start_time": None,
            "frames_received": 0,
            "errors": [],
            "response_times": [],
            "session_id": None,
            "success": False
        }
        
        api = APITestHelper(self.base_url)
        
        try:
            # Test 1: Compile game
            compile_start = time.time()
            components = [
                {"type": "player", "x": 100, "y": 100},
                {"type": "enemy", "x": 400, "y": 300},
                {"type": "platform", "x": 200, "y": 400}
            ]
            
            compile_result, status_code = api.compile_game(components, "platformer")
            compile_time = time.time() - compile_start
            result["compilation_time"] = compile_time
            result["response_times"].append(("compile", compile_time))
            
            if status_code != 200:
                result["errors"].append(f"Compilation failed: {compile_result}")
                return result
            
            # Test 2: Execute game
            exec_start = time.time()
            code = self.create_test_game_code()
            session_id, status_code = api.execute_game(code)
            exec_time = time.time() - exec_start
            result["execution_start_time"] = exec_time
            result["response_times"].append(("execute", exec_time))
            
            if status_code != 200:
                result["errors"].append(f"Execution failed: status {status_code}")
                return result
            
            result["session_id"] = session_id
            
            # Test 3: Stream frames
            stream_start = time.time()
            frame_count = 0
            
            while time.time() - stream_start < duration:
                try:
                    frame_start = time.time()
                    frames = api.stream_game_frames(session_id, max_frames=1)
                    frame_time = time.time() - frame_start
                    
                    if frames:
                        frame_count += len(frames)
                        result["response_times"].append(("frame", frame_time))
                    
                    time.sleep(FRAME_COLLECTION_INTERVAL)
                    
                except Exception as e:
                    result["errors"].append(f"Frame streaming error: {str(e)}")
                    break
            
            result["frames_received"] = frame_count
            result["success"] = frame_count > 0
            
        except Exception as e:
            result["errors"].append(f"User simulation error: {str(e)}\n{traceback.format_exc()}")
        
        finally:
            result["end_time"] = time.time()
            result["total_time"] = result["end_time"] - result["start_time"]
        
        return result
    
    def test_concurrent_users(self, num_users: int) -> Dict:
        """Test with specified number of concurrent users"""
        print(f"\nTesting with {num_users} concurrent users...")
        
        test_result = {
            "num_users": num_users,
            "start_time": time.time(),
            "end_time": None,
            "user_results": [],
            "statistics": {},
            "resource_usage_before": self.get_resource_usage(),
            "resource_usage_after": None,
            "resource_usage_during": []
        }
        
        # Monitor resources in background
        monitor_stop = threading.Event()
        def monitor_resources():
            while not monitor_stop.is_set():
                test_result["resource_usage_during"].append(self.get_resource_usage())
                time.sleep(1)
        
        monitor_thread = threading.Thread(target=monitor_resources)
        monitor_thread.start()
        
        # Execute concurrent user simulations
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_users) as executor:
            futures = []
            for i in range(num_users):
                time.sleep(0.1)  # Slight stagger to avoid thundering herd
                future = executor.submit(self.simulate_single_user, i, GAME_DURATION)
                futures.append(future)
            
            # Collect results
            for future in concurrent.futures.as_completed(futures):
                try:
                    user_result = future.result(timeout=GAME_DURATION + 10)
                    test_result["user_results"].append(user_result)
                except Exception as e:
                    test_result["user_results"].append({
                        "error": f"Future execution failed: {str(e)}"
                    })
        
        # Stop resource monitoring
        monitor_stop.set()
        monitor_thread.join()
        
        test_result["end_time"] = time.time()
        test_result["total_time"] = test_result["end_time"] - test_result["start_time"]
        test_result["resource_usage_after"] = self.get_resource_usage()
        
        # Calculate statistics
        test_result["statistics"] = self.calculate_statistics(test_result["user_results"])
        
        return test_result
    
    def calculate_statistics(self, user_results: List[Dict]) -> Dict:
        """Calculate performance statistics from user results"""
        stats = {
            "total_users": len(user_results),
            "successful_users": 0,
            "failed_users": 0,
            "compilation_times": [],
            "execution_times": [],
            "frame_counts": [],
            "total_frames": 0,
            "avg_compilation_time": 0,
            "avg_execution_time": 0,
            "avg_frames_per_user": 0,
            "p95_compilation_time": 0,
            "p95_execution_time": 0,
            "errors": []
        }
        
        for result in user_results:
            if result.get("success"):
                stats["successful_users"] += 1
            else:
                stats["failed_users"] += 1
            
            if result.get("compilation_time"):
                stats["compilation_times"].append(result["compilation_time"])
            
            if result.get("execution_start_time"):
                stats["execution_times"].append(result["execution_start_time"])
            
            if result.get("frames_received"):
                stats["frame_counts"].append(result["frames_received"])
                stats["total_frames"] += result["frames_received"]
            
            if result.get("errors"):
                stats["errors"].extend(result["errors"])
        
        # Calculate averages and percentiles
        if stats["compilation_times"]:
            stats["avg_compilation_time"] = statistics.mean(stats["compilation_times"])
            if len(stats["compilation_times"]) > 1:
                stats["p95_compilation_time"] = statistics.quantiles(
                    stats["compilation_times"], n=20
                )[18]  # 95th percentile
        
        if stats["execution_times"]:
            stats["avg_execution_time"] = statistics.mean(stats["execution_times"])
            if len(stats["execution_times"]) > 1:
                stats["p95_execution_time"] = statistics.quantiles(
                    stats["execution_times"], n=20
                )[18]  # 95th percentile
        
        if stats["frame_counts"]:
            stats["avg_frames_per_user"] = statistics.mean(stats["frame_counts"])
        
        return stats
    
    def get_resource_usage(self) -> Dict:
        """Get current system resource usage"""
        process = psutil.Process()
        
        return {
            "timestamp": time.time(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": psutil.virtual_memory().percent,
            "memory_mb": process.memory_info().rss / 1024 / 1024,
            "num_threads": process.num_threads(),
            "open_files": len(process.open_files()) if hasattr(process, 'open_files') else 0,
            "connections": len(process.connections()) if hasattr(process, 'connections') else 0
        }
    
    def test_session_cleanup(self) -> Dict:
        """Test that sessions are properly cleaned up after completion"""
        print("\nTesting session cleanup...")
        
        cleanup_result = {
            "start_sessions": [],
            "end_sessions": [],
            "leaked_sessions": [],
            "cleanup_success": False
        }
        
        api = APITestHelper(self.base_url)
        
        # Create multiple sessions
        session_ids = []
        for i in range(5):
            code = self.create_test_game_code()
            session_id, status = api.execute_game(code)
            if status == 200 and session_id:
                session_ids.append(session_id)
                cleanup_result["start_sessions"].append(session_id)
        
        # Wait for games to complete
        time.sleep(12)  # Games run for 10 seconds + buffer
        
        # Check if sessions are cleaned up
        for session_id in session_ids:
            try:
                # Try to get frames from ended session
                frames = api.stream_game_frames(session_id, max_frames=1)
                if frames and frames[0].get('type') != 'end':
                    cleanup_result["leaked_sessions"].append(session_id)
            except:
                cleanup_result["end_sessions"].append(session_id)
        
        cleanup_result["cleanup_success"] = len(cleanup_result["leaked_sessions"]) == 0
        
        return cleanup_result
    
    def run_all_tests(self) -> Dict:
        """Run all concurrent session tests"""
        print("=" * 60)
        print("CONCURRENT SESSIONS PERFORMANCE TEST")
        print("=" * 60)
        
        # Test different levels of concurrency
        for num_users in CONCURRENT_USERS:
            result = self.test_concurrent_users(num_users)
            self.results["concurrent_tests"].append(result)
            
            # Print summary
            stats = result["statistics"]
            print(f"\nResults for {num_users} concurrent users:")
            print(f"  Success rate: {stats['successful_users']}/{stats['total_users']}")
            print(f"  Avg compilation time: {stats['avg_compilation_time']:.3f}s")
            print(f"  Avg execution time: {stats['avg_execution_time']:.3f}s")
            print(f"  Avg frames per user: {stats['avg_frames_per_user']:.1f}")
            print(f"  Total frames streamed: {stats['total_frames']}")
            
            # Cool down between tests
            time.sleep(5)
        
        # Test session cleanup
        cleanup_result = self.test_session_cleanup()
        self.results["cleanup_test"] = cleanup_result
        print(f"\nSession cleanup test: {'PASSED' if cleanup_result['cleanup_success'] else 'FAILED'}")
        if cleanup_result["leaked_sessions"]:
            print(f"  Leaked sessions: {cleanup_result['leaked_sessions']}")
        
        return self.results
    
    def save_results(self, filename: str = "concurrent_sessions_results.json"):
        """Save test results to JSON file"""
        output_path = os.path.join(os.path.dirname(__file__), filename)
        with open(output_path, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"\nResults saved to {output_path}")


def main():
    """Run concurrent sessions performance tests"""
    tester = ConcurrentSessionTester()
    
    try:
        results = tester.run_all_tests()
        tester.save_results()
        
        # Print final summary
        print("\n" + "=" * 60)
        print("CONCURRENT SESSIONS TEST SUMMARY")
        print("=" * 60)
        
        for test in results["concurrent_tests"]:
            stats = test["statistics"]
            print(f"\n{test['num_users']} concurrent users:")
            print(f"  Success rate: {stats['successful_users']}/{stats['total_users']} "
                  f"({100 * stats['successful_users'] / stats['total_users']:.1f}%)")
            print(f"  P95 compilation time: {stats['p95_compilation_time']:.3f}s")
            print(f"  P95 execution time: {stats['p95_execution_time']:.3f}s")
            
            # Resource usage analysis
            if test["resource_usage_during"]:
                max_cpu = max(r["cpu_percent"] for r in test["resource_usage_during"])
                max_memory = max(r["memory_mb"] for r in test["resource_usage_during"])
                print(f"  Peak CPU usage: {max_cpu:.1f}%")
                print(f"  Peak memory usage: {max_memory:.1f} MB")
        
        if results.get("cleanup_test", {}).get("cleanup_success"):
            print("\n✓ Session cleanup: PASSED")
        else:
            print("\n✗ Session cleanup: FAILED")
        
        # Check for critical issues
        critical_issues = []
        for test in results["concurrent_tests"]:
            if test["statistics"]["successful_users"] < test["statistics"]["total_users"] * 0.8:
                critical_issues.append(f"Low success rate at {test['num_users']} users")
            if test["statistics"]["p95_compilation_time"] > 5:
                critical_issues.append(f"Slow compilation at {test['num_users']} users")
        
        if critical_issues:
            print("\n⚠️  CRITICAL ISSUES DETECTED:")
            for issue in critical_issues:
                print(f"  - {issue}")
        else:
            print("\n✓ All tests passed successfully!")
        
        return 0 if not critical_issues else 1
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())