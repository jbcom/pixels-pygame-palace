"""
Stress Test for Flask Backend
Tests system limits, recovery, and stability under extreme load
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
import gc
import traceback
from datetime import datetime
import random
import requests

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from e2e.backend_test_suite import APITestHelper

# Test configuration
API_BASE_URL = "http://localhost:5000/api"
MAX_CONCURRENT_SESSIONS = 50  # Test up to this many concurrent sessions
MEMORY_TEST_DURATION = 60  # seconds for memory leak test
RATE_LIMIT_TEST_REQUESTS = 100  # Number of requests for rate limit test

class StressTester:
    """Stress test the Flask backend to find limits and issues"""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.results = {
            "test_timestamp": datetime.now().isoformat(),
            "max_sessions_test": {},
            "memory_test": {},
            "rate_limit_test": {},
            "recovery_test": {},
            "database_pool_test": {},
            "errors": []
        }
        
    def create_complex_game_code(self, complexity: str = "medium") -> str:
        """Create game code with varying complexity"""
        if complexity == "simple":
            objects = 5
            updates = 10
        elif complexity == "medium":
            objects = 20
            updates = 50
        else:  # complex
            objects = 100
            updates = 200
            
        return f"""
import pygame
import sys
import random
import time
import math

pygame.init()
screen = pygame.display.set_mode((800, 600))
clock = pygame.time.Clock()

# Stress test with {objects} objects and {updates} updates per frame
class GameObject:
    def __init__(self, idx):
        self.x = random.uniform(0, 800)
        self.y = random.uniform(0, 600)
        self.vx = random.uniform(-10, 10)
        self.vy = random.uniform(-10, 10)
        self.color = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        self.radius = random.randint(5, 20)
        self.angle = random.uniform(0, 2 * math.pi)
        self.rotation_speed = random.uniform(-0.1, 0.1)
        self.data = [random.random() for _ in range({updates})]  # Memory usage
    
    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.angle += self.rotation_speed
        
        # Boundary collision
        if self.x < 0 or self.x > 800:
            self.vx = -self.vx
        if self.y < 0 or self.y > 600:
            self.vy = -self.vy
        
        # Simulate complex calculations
        for i in range(len(self.data)):
            self.data[i] = math.sin(self.data[i] + self.angle) * math.cos(time.time())
    
    def draw(self, screen):
        pygame.draw.circle(screen, self.color, (int(self.x), int(self.y)), self.radius)

objects = [GameObject(i) for i in range({objects})]
running = True
frame_count = 0
start_time = time.time()

while running and time.time() - start_time < 30:  # Run for max 30 seconds
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    
    # Update all objects
    for obj in objects:
        obj.update()
    
    # Draw everything
    screen.fill((0, 0, 0))
    for obj in objects:
        obj.draw(screen)
    
    pygame.display.flip()
    clock.tick(30)
    frame_count += 1

pygame.quit()
"""
    
    def test_maximum_concurrent_sessions(self) -> Dict:
        """Find the maximum number of concurrent sessions before degradation"""
        print("\n" + "=" * 60)
        print("TESTING MAXIMUM CONCURRENT SESSIONS")
        print("=" * 60)
        
        result = {
            "start_time": time.time(),
            "sessions_tested": [],
            "max_successful": 0,
            "degradation_point": None,
            "failure_point": None,
            "response_times": [],
            "resource_usage": []
        }
        
        api = APITestHelper(self.base_url)
        active_sessions = []
        session_threads = []
        
        def keep_session_alive(session_id):
            """Keep streaming frames from a session"""
            try:
                while session_id in active_sessions:
                    api.stream_game_frames(session_id, max_frames=1)
                    time.sleep(0.5)
            except:
                pass
        
        try:
            for num_sessions in range(1, MAX_CONCURRENT_SESSIONS + 1):
                print(f"\nTesting {num_sessions} concurrent sessions...")
                
                # Record resource usage before
                resources_before = self.get_detailed_resource_usage()
                
                # Start a new session
                start_time = time.time()
                code = self.create_complex_game_code("simple")
                
                try:
                    session_id, status = api.execute_game(code)
                    response_time = time.time() - start_time
                    
                    if status == 200 and session_id:
                        active_sessions.append(session_id)
                        
                        # Start thread to keep session alive
                        thread = threading.Thread(target=keep_session_alive, args=(session_id,))
                        thread.daemon = True
                        thread.start()
                        session_threads.append(thread)
                        
                        # Record success
                        session_data = {
                            "num_sessions": num_sessions,
                            "success": True,
                            "response_time": response_time,
                            "session_id": session_id
                        }
                        
                        result["sessions_tested"].append(session_data)
                        result["max_successful"] = num_sessions
                        
                        # Check for degradation (response time > 2 seconds)
                        if response_time > 2.0 and not result["degradation_point"]:
                            result["degradation_point"] = num_sessions
                            print(f"  ⚠️ Performance degradation detected at {num_sessions} sessions")
                        
                    else:
                        # Session creation failed
                        session_data = {
                            "num_sessions": num_sessions,
                            "success": False,
                            "error": f"Status code: {status}"
                        }
                        result["sessions_tested"].append(session_data)
                        result["failure_point"] = num_sessions
                        print(f"  ❌ Failed to create session #{num_sessions}")
                        break
                        
                except Exception as e:
                    session_data = {
                        "num_sessions": num_sessions,
                        "success": False,
                        "error": str(e)
                    }
                    result["sessions_tested"].append(session_data)
                    result["failure_point"] = num_sessions
                    print(f"  ❌ Exception at session #{num_sessions}: {str(e)}")
                    break
                
                # Record resource usage
                resources_after = self.get_detailed_resource_usage()
                resources_after["num_sessions"] = num_sessions
                result["resource_usage"].append(resources_after)
                
                # Small delay between session creation
                time.sleep(0.2)
                
                # Stop if we're using too much memory (>80%)
                if resources_after["memory_percent"] > 80:
                    print(f"  ⚠️ Memory usage critical at {resources_after['memory_percent']:.1f}%")
                    break
                    
        finally:
            # Clean up all sessions
            print("\nCleaning up sessions...")
            active_sessions.clear()
            time.sleep(2)  # Wait for threads to finish
        
        result["end_time"] = time.time()
        result["total_time"] = result["end_time"] - result["start_time"]
        
        print(f"\n✓ Maximum successful concurrent sessions: {result['max_successful']}")
        if result["degradation_point"]:
            print(f"⚠️ Performance degradation at: {result['degradation_point']} sessions")
        if result["failure_point"]:
            print(f"❌ System failure at: {result['failure_point']} sessions")
        
        return result
    
    def test_memory_usage_over_time(self) -> Dict:
        """Test for memory leaks by running sessions over time"""
        print("\n" + "=" * 60)
        print("TESTING MEMORY USAGE OVER TIME")
        print("=" * 60)
        
        result = {
            "start_time": time.time(),
            "duration": MEMORY_TEST_DURATION,
            "memory_samples": [],
            "sessions_created": 0,
            "memory_leak_detected": False
        }
        
        api = APITestHelper(self.base_url)
        start_memory = self.get_detailed_resource_usage()["memory_mb"]
        
        print(f"Starting memory: {start_memory:.1f} MB")
        print(f"Running test for {MEMORY_TEST_DURATION} seconds...")
        
        test_start = time.time()
        session_count = 0
        
        while time.time() - test_start < MEMORY_TEST_DURATION:
            # Create and execute a session
            try:
                code = self.create_complex_game_code("medium")
                session_id, status = api.execute_game(code)
                
                if status == 200:
                    session_count += 1
                    
                    # Stream some frames
                    for _ in range(5):
                        api.stream_game_frames(session_id, max_frames=1)
                        time.sleep(0.1)
                    
                    # Record memory usage
                    memory_data = self.get_detailed_resource_usage()
                    memory_data["session_count"] = session_count
                    memory_data["elapsed_time"] = time.time() - test_start
                    result["memory_samples"].append(memory_data)
                    
                    if session_count % 10 == 0:
                        current_memory = memory_data["memory_mb"]
                        print(f"  Sessions: {session_count}, Memory: {current_memory:.1f} MB "
                              f"(+{current_memory - start_memory:.1f} MB)")
                    
                    # Force garbage collection periodically
                    if session_count % 20 == 0:
                        gc.collect()
                        
            except Exception as e:
                result["errors"] = str(e)
                
            # Wait before next session
            time.sleep(1)
        
        result["sessions_created"] = session_count
        result["end_time"] = time.time()
        
        # Analyze for memory leak
        if len(result["memory_samples"]) > 10:
            first_samples = result["memory_samples"][:5]
            last_samples = result["memory_samples"][-5:]
            
            avg_first = statistics.mean([s["memory_mb"] for s in first_samples])
            avg_last = statistics.mean([s["memory_mb"] for s in last_samples])
            
            memory_growth = avg_last - avg_first
            growth_per_session = memory_growth / session_count if session_count > 0 else 0
            
            result["memory_growth"] = memory_growth
            result["growth_per_session"] = growth_per_session
            
            # Detect leak if memory grows more than 1MB per session
            if growth_per_session > 1.0:
                result["memory_leak_detected"] = True
                print(f"\n⚠️ Potential memory leak detected: {growth_per_session:.2f} MB/session")
            else:
                print(f"\n✓ Memory usage stable: {growth_per_session:.2f} MB/session")
        
        return result
    
    def test_rate_limiting(self) -> Dict:
        """Test rate limiting effectiveness"""
        print("\n" + "=" * 60)
        print("TESTING RATE LIMITING")
        print("=" * 60)
        
        result = {
            "start_time": time.time(),
            "requests_sent": 0,
            "requests_successful": 0,
            "requests_rate_limited": 0,
            "response_times": [],
            "rate_limit_working": False
        }
        
        api = APITestHelper(self.base_url)
        
        print(f"Sending {RATE_LIMIT_TEST_REQUESTS} rapid requests...")
        
        # Send rapid-fire requests
        for i in range(RATE_LIMIT_TEST_REQUESTS):
            start_time = time.time()
            
            try:
                # Try to compile a game (rate limited endpoint)
                components = [{"type": "test", "id": i}]
                response, status = api.compile_game(components)
                response_time = time.time() - start_time
                
                result["requests_sent"] += 1
                result["response_times"].append(response_time)
                
                if status == 200:
                    result["requests_successful"] += 1
                elif status == 429:  # Too Many Requests
                    result["requests_rate_limited"] += 1
                    if not result["rate_limit_working"]:
                        print(f"  ✓ Rate limiting triggered at request #{i+1}")
                        result["rate_limit_working"] = True
                    
            except Exception as e:
                if "429" in str(e):
                    result["requests_rate_limited"] += 1
                    
            # No delay - hammer the server
            if i % 20 == 0:
                print(f"  Sent {i} requests...")
        
        result["end_time"] = time.time()
        result["total_time"] = result["end_time"] - result["start_time"]
        
        # Calculate request rate
        if result["total_time"] > 0:
            result["request_rate"] = result["requests_sent"] / result["total_time"]
        
        print(f"\nRate limiting test results:")
        print(f"  Requests sent: {result['requests_sent']}")
        print(f"  Successful: {result['requests_successful']}")
        print(f"  Rate limited: {result['requests_rate_limited']}")
        print(f"  Request rate: {result.get('request_rate', 0):.1f} req/sec")
        
        if result["rate_limit_working"]:
            print("  ✓ Rate limiting is working correctly")
        else:
            print("  ⚠️ Rate limiting may not be configured properly")
        
        return result
    
    def test_recovery_from_overload(self) -> Dict:
        """Test system recovery after overload condition"""
        print("\n" + "=" * 60)
        print("TESTING RECOVERY FROM OVERLOAD")
        print("=" * 60)
        
        result = {
            "start_time": time.time(),
            "overload_phase": {},
            "recovery_phase": {},
            "recovery_successful": False
        }
        
        api = APITestHelper(self.base_url)
        
        # Phase 1: Create overload condition
        print("Phase 1: Creating overload condition...")
        overload_sessions = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = []
            for i in range(20):
                future = executor.submit(
                    api.execute_game,
                    self.create_complex_game_code("complex")
                )
                futures.append(future)
            
            # Collect results
            for future in concurrent.futures.as_completed(futures, timeout=10):
                try:
                    session_id, status = future.result()
                    if session_id:
                        overload_sessions.append(session_id)
                except:
                    pass
        
        result["overload_phase"]["sessions_created"] = len(overload_sessions)
        
        # Measure response time during overload
        start_time = time.time()
        try:
            _, status = api.compile_game([{"type": "test"}])
            overload_response_time = time.time() - start_time
            result["overload_phase"]["response_time"] = overload_response_time
            print(f"  Response time during overload: {overload_response_time:.2f}s")
        except Exception as e:
            result["overload_phase"]["error"] = str(e)
            print(f"  Error during overload: {e}")
        
        # Phase 2: Wait for recovery
        print("\nPhase 2: Waiting for system recovery...")
        time.sleep(10)  # Give system time to clean up
        
        # Phase 3: Test recovery
        print("Phase 3: Testing recovery...")
        recovery_tests = []
        
        for i in range(5):
            start_time = time.time()
            try:
                _, status = api.compile_game([{"type": "recovery_test", "id": i}])
                response_time = time.time() - start_time
                recovery_tests.append({
                    "success": status == 200,
                    "response_time": response_time
                })
                print(f"  Recovery test {i+1}: {response_time:.2f}s")
            except Exception as e:
                recovery_tests.append({
                    "success": False,
                    "error": str(e)
                })
        
        result["recovery_phase"]["tests"] = recovery_tests
        
        # Check if recovery was successful
        if recovery_tests:
            successful_tests = [t for t in recovery_tests if t.get("success")]
            if len(successful_tests) >= 3:  # At least 3 successful tests
                avg_recovery_time = statistics.mean([t["response_time"] for t in successful_tests])
                result["recovery_phase"]["avg_response_time"] = avg_recovery_time
                
                if avg_recovery_time < 2.0:  # Response time back to normal
                    result["recovery_successful"] = True
        
        result["end_time"] = time.time()
        
        if result["recovery_successful"]:
            print("\n✓ System recovered successfully from overload")
        else:
            print("\n❌ System failed to recover properly from overload")
        
        return result
    
    def test_database_connection_pooling(self) -> Dict:
        """Test database connection pooling under load"""
        print("\n" + "=" * 60)
        print("TESTING DATABASE CONNECTION POOLING")
        print("=" * 60)
        
        result = {
            "start_time": time.time(),
            "project_operations": [],
            "connection_errors": 0,
            "successful_operations": 0,
            "pooling_effective": False
        }
        
        api = APITestHelper(self.base_url)
        
        def perform_db_operations(thread_id: int, num_operations: int = 10) -> List[Dict]:
            """Perform multiple database operations"""
            operations = []
            
            for i in range(num_operations):
                op_result = {"thread_id": thread_id, "operation": i}
                
                try:
                    # Create project (DB write)
                    project_name = f"stress_test_{thread_id}_{i}_{random.randint(1000, 9999)}"
                    save_result, status = api.save_project(
                        name=project_name,
                        components=[{"type": "test"}],
                        game_type="platformer"
                    )
                    
                    if status == 201 and save_result.get("project"):
                        op_result["create_success"] = True
                        project_id = save_result["project"]["id"]
                        
                        # List projects (DB read)
                        list_result, status = api.list_projects()
                        op_result["list_success"] = status == 200
                        
                        # Get specific project (DB read)
                        get_result, status = api.get_project(project_id)
                        op_result["get_success"] = status == 200
                        
                        # Update project (DB write)
                        update_result, status = api.session.put(
                            f"{api.base_url}/projects/{project_id}",
                            json={"name": f"{project_name}_updated"}
                        ).json(), api.session.put(
                            f"{api.base_url}/projects/{project_id}",
                            json={"name": f"{project_name}_updated"}
                        ).status_code
                        op_result["update_success"] = status == 200
                        
                    else:
                        op_result["create_success"] = False
                        
                except Exception as e:
                    op_result["error"] = str(e)
                    
                operations.append(op_result)
                
            return operations
        
        print("Testing concurrent database operations...")
        
        # Run concurrent database operations
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for thread_id in range(10):
                future = executor.submit(perform_db_operations, thread_id, 5)
                futures.append(future)
            
            # Collect results
            for future in concurrent.futures.as_completed(futures):
                try:
                    thread_operations = future.result()
                    result["project_operations"].extend(thread_operations)
                except Exception as e:
                    result["connection_errors"] += 1
        
        # Analyze results
        for op in result["project_operations"]:
            if all(op.get(f"{action}_success", False) 
                   for action in ["create", "list", "get", "update"]):
                result["successful_operations"] += 1
            if "error" in op and "connection" in op["error"].lower():
                result["connection_errors"] += 1
        
        total_operations = len(result["project_operations"])
        success_rate = (result["successful_operations"] / total_operations * 100 
                       if total_operations > 0 else 0)
        
        result["total_operations"] = total_operations
        result["success_rate"] = success_rate
        result["pooling_effective"] = success_rate > 80 and result["connection_errors"] < 5
        
        result["end_time"] = time.time()
        
        print(f"\nDatabase connection pooling results:")
        print(f"  Total operations: {total_operations}")
        print(f"  Successful: {result['successful_operations']} ({success_rate:.1f}%)")
        print(f"  Connection errors: {result['connection_errors']}")
        
        if result["pooling_effective"]:
            print("  ✓ Database connection pooling is effective")
        else:
            print("  ⚠️ Database connection pooling may need optimization")
        
        return result
    
    def get_detailed_resource_usage(self) -> Dict:
        """Get detailed system resource usage"""
        process = psutil.Process()
        
        return {
            "timestamp": time.time(),
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "cpu_count": psutil.cpu_count(),
            "memory_percent": psutil.virtual_memory().percent,
            "memory_mb": process.memory_info().rss / 1024 / 1024,
            "memory_available_mb": psutil.virtual_memory().available / 1024 / 1024,
            "swap_percent": psutil.swap_memory().percent if hasattr(psutil, 'swap_memory') else 0,
            "num_threads": process.num_threads(),
            "num_fds": len(process.open_files()) if hasattr(process, 'open_files') else 0,
            "num_connections": len(process.connections()) if hasattr(process, 'connections') else 0,
            "disk_io": process.io_counters()._asdict() if hasattr(process, 'io_counters') else {}
        }
    
    def run_all_tests(self) -> Dict:
        """Run all stress tests"""
        print("=" * 60)
        print("FLASK BACKEND STRESS TEST SUITE")
        print("=" * 60)
        
        # Run individual stress tests
        self.results["max_sessions_test"] = self.test_maximum_concurrent_sessions()
        time.sleep(5)  # Cool down
        
        self.results["memory_test"] = self.test_memory_usage_over_time()
        time.sleep(5)  # Cool down
        
        self.results["rate_limit_test"] = self.test_rate_limiting()
        time.sleep(5)  # Cool down
        
        self.results["recovery_test"] = self.test_recovery_from_overload()
        time.sleep(5)  # Cool down
        
        self.results["database_pool_test"] = self.test_database_connection_pooling()
        
        return self.results
    
    def save_results(self, filename: str = "stress_test_results.json"):
        """Save test results to JSON file"""
        output_path = os.path.join(os.path.dirname(__file__), filename)
        with open(output_path, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"\nResults saved to {output_path}")


def main():
    """Run stress tests"""
    tester = StressTester()
    
    try:
        results = tester.run_all_tests()
        tester.save_results()
        
        # Print final summary
        print("\n" + "=" * 60)
        print("STRESS TEST SUMMARY")
        print("=" * 60)
        
        # Maximum sessions
        max_test = results.get("max_sessions_test", {})
        print(f"\n📊 Maximum Concurrent Sessions:")
        print(f"  Max successful: {max_test.get('max_successful', 0)}")
        if max_test.get('degradation_point'):
            print(f"  Performance degradation: {max_test['degradation_point']} sessions")
        if max_test.get('failure_point'):
            print(f"  System failure: {max_test['failure_point']} sessions")
        
        # Memory usage
        mem_test = results.get("memory_test", {})
        if mem_test.get("memory_leak_detected"):
            print(f"\n⚠️ Memory Leak Detected:")
            print(f"  Growth per session: {mem_test.get('growth_per_session', 0):.2f} MB")
        else:
            print(f"\n✓ Memory Usage: Stable")
        
        # Rate limiting
        rate_test = results.get("rate_limit_test", {})
        if rate_test.get("rate_limit_working"):
            print(f"\n✓ Rate Limiting: Working")
            print(f"  Blocked requests: {rate_test.get('requests_rate_limited', 0)}")
        else:
            print(f"\n⚠️ Rate Limiting: Not properly configured")
        
        # Recovery
        recovery_test = results.get("recovery_test", {})
        if recovery_test.get("recovery_successful"):
            print(f"\n✓ Recovery from Overload: Successful")
        else:
            print(f"\n❌ Recovery from Overload: Failed")
        
        # Database pooling
        db_test = results.get("database_pool_test", {})
        if db_test.get("pooling_effective"):
            print(f"\n✓ Database Connection Pooling: Effective")
        else:
            print(f"\n⚠️ Database Connection Pooling: Needs optimization")
        
        # Critical issues
        critical_issues = []
        if max_test.get("max_successful", 0) < 10:
            critical_issues.append("Cannot handle 10+ concurrent sessions")
        if mem_test.get("memory_leak_detected"):
            critical_issues.append("Memory leak detected")
        if not rate_test.get("rate_limit_working"):
            critical_issues.append("Rate limiting not working")
        if not recovery_test.get("recovery_successful"):
            critical_issues.append("Cannot recover from overload")
        
        if critical_issues:
            print("\n⚠️ CRITICAL ISSUES:")
            for issue in critical_issues:
                print(f"  - {issue}")
            return 1
        else:
            print("\n✅ All stress tests passed!")
            return 0
            
    except Exception as e:
        print(f"\n❌ Stress test failed with error: {str(e)}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())