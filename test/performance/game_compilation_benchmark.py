"""
Game Compilation Benchmark
Tests compilation performance for different game types and complexities
"""

import os
import sys
import time
import json
import random
import statistics
from typing import List, Dict, Any, Tuple
from datetime import datetime
import traceback
import gc

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from e2e.backend_test_suite import APITestHelper

# Test configuration
API_BASE_URL = "http://localhost:5000/api"
GAME_TYPES = ["platformer", "puzzle", "racing", "rpg", "space", "dungeon"]
ITERATIONS_PER_TYPE = 10
COMPONENT_COUNTS = [5, 10, 25, 50, 100]  # Different project sizes

class CompilationBenchmark:
    """Benchmark game compilation performance"""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.results = {
            "test_timestamp": datetime.now().isoformat(),
            "game_type_benchmarks": {},
            "component_scaling": {},
            "code_generation": {},
            "export_performance": {},
            "optimization_suggestions": []
        }
    
    def generate_components(self, game_type: str, count: int) -> List[Dict]:
        """Generate realistic components for a game type"""
        components = []
        
        if game_type == "platformer":
            # Player
            components.append({
                "type": "player",
                "id": "player_1",
                "x": 100,
                "y": 300,
                "width": 32,
                "height": 32,
                "sprite": "player_idle.png",
                "animations": {
                    "idle": ["player_idle_1.png", "player_idle_2.png"],
                    "run": ["player_run_1.png", "player_run_2.png", "player_run_3.png"],
                    "jump": ["player_jump.png"]
                },
                "speed": 5,
                "jumpPower": 15
            })
            
            # Platforms
            for i in range(min(count - 1, 20)):
                components.append({
                    "type": "platform",
                    "id": f"platform_{i}",
                    "x": random.randint(0, 800),
                    "y": random.randint(200, 500),
                    "width": random.randint(50, 200),
                    "height": 20,
                    "texture": "platform_texture.png",
                    "solid": True
                })
            
            # Enemies
            for i in range(min(count // 3, 15)):
                components.append({
                    "type": "enemy",
                    "id": f"enemy_{i}",
                    "x": random.randint(200, 700),
                    "y": random.randint(200, 400),
                    "width": 32,
                    "height": 32,
                    "sprite": "enemy_sprite.png",
                    "behavior": "patrol",
                    "speed": 2,
                    "health": 3
                })
            
            # Items
            for i in range(min(count // 4, 10)):
                components.append({
                    "type": "item",
                    "id": f"item_{i}",
                    "x": random.randint(100, 700),
                    "y": random.randint(200, 400),
                    "width": 16,
                    "height": 16,
                    "sprite": "coin.png",
                    "value": 10,
                    "collectible": True
                })
                
        elif game_type == "puzzle":
            # Grid
            components.append({
                "type": "grid",
                "id": "puzzle_grid",
                "rows": 8,
                "cols": 8,
                "cellSize": 50,
                "x": 200,
                "y": 100
            })
            
            # Puzzle pieces
            for i in range(min(count - 1, 64)):
                components.append({
                    "type": "piece",
                    "id": f"piece_{i}",
                    "row": i // 8,
                    "col": i % 8,
                    "color": random.choice(["red", "blue", "green", "yellow", "purple"]),
                    "shape": random.choice(["square", "circle", "triangle"]),
                    "movable": True
                })
                
        elif game_type == "racing":
            # Player car
            components.append({
                "type": "car",
                "id": "player_car",
                "x": 400,
                "y": 500,
                "width": 40,
                "height": 60,
                "sprite": "car_player.png",
                "speed": 0,
                "maxSpeed": 10,
                "acceleration": 0.5,
                "handling": 0.3
            })
            
            # Track segments
            for i in range(min(count - 1, 30)):
                components.append({
                    "type": "track_segment",
                    "id": f"track_{i}",
                    "x": 0,
                    "y": i * 100,
                    "width": 800,
                    "height": 100,
                    "texture": "track_asphalt.png",
                    "curve": random.choice([0, -0.1, 0.1])  # Straight or slight curve
                })
            
            # Obstacles
            for i in range(min(count // 3, 10)):
                components.append({
                    "type": "obstacle",
                    "id": f"obstacle_{i}",
                    "x": random.randint(200, 600),
                    "y": random.randint(0, 600),
                    "width": 40,
                    "height": 40,
                    "sprite": "cone.png",
                    "damage": 1
                })
                
        elif game_type == "rpg":
            # Player character
            components.append({
                "type": "character",
                "id": "player",
                "x": 400,
                "y": 300,
                "width": 32,
                "height": 32,
                "sprite": "hero.png",
                "stats": {
                    "health": 100,
                    "mana": 50,
                    "attack": 10,
                    "defense": 5,
                    "speed": 3
                },
                "inventory": []
            })
            
            # NPCs
            for i in range(min(count // 2, 20)):
                components.append({
                    "type": "npc",
                    "id": f"npc_{i}",
                    "x": random.randint(100, 700),
                    "y": random.randint(100, 500),
                    "width": 32,
                    "height": 32,
                    "sprite": f"npc_{i % 5}.png",
                    "dialogue": [
                        "Hello, adventurer!",
                        "Have you seen any monsters around?",
                        "The weather is nice today."
                    ],
                    "questGiver": i % 3 == 0
                })
            
            # Items and equipment
            for i in range(min(count // 3, 15)):
                components.append({
                    "type": "item",
                    "id": f"item_{i}",
                    "x": random.randint(100, 700),
                    "y": random.randint(100, 500),
                    "width": 24,
                    "height": 24,
                    "sprite": "potion.png",
                    "itemType": random.choice(["potion", "weapon", "armor"]),
                    "stats": {
                        "value": random.randint(10, 100),
                        "effect": random.choice(["heal", "damage", "defense"])
                    }
                })
                
        elif game_type == "space":
            # Player ship
            components.append({
                "type": "spaceship",
                "id": "player_ship",
                "x": 400,
                "y": 500,
                "width": 48,
                "height": 48,
                "sprite": "ship_player.png",
                "health": 100,
                "shields": 50,
                "weapons": ["laser", "missile"],
                "speed": 5
            })
            
            # Asteroids
            for i in range(min(count // 2, 25)):
                components.append({
                    "type": "asteroid",
                    "id": f"asteroid_{i}",
                    "x": random.randint(0, 800),
                    "y": random.randint(-500, 0),
                    "width": random.randint(20, 60),
                    "height": random.randint(20, 60),
                    "sprite": f"asteroid_{i % 3}.png",
                    "rotation": random.uniform(0, 360),
                    "rotationSpeed": random.uniform(-2, 2),
                    "velocity": {
                        "x": random.uniform(-2, 2),
                        "y": random.uniform(1, 3)
                    }
                })
            
            # Enemy ships
            for i in range(min(count // 3, 10)):
                components.append({
                    "type": "enemy_ship",
                    "id": f"enemy_{i}",
                    "x": random.randint(100, 700),
                    "y": random.randint(-200, 0),
                    "width": 40,
                    "height": 40,
                    "sprite": "ship_enemy.png",
                    "health": 30,
                    "weapons": ["laser"],
                    "ai": "aggressive",
                    "speed": 3
                })
                
        elif game_type == "dungeon":
            # Player
            components.append({
                "type": "hero",
                "id": "player",
                "x": 100,
                "y": 100,
                "width": 32,
                "height": 32,
                "sprite": "hero_knight.png",
                "stats": {
                    "health": 100,
                    "stamina": 100,
                    "attack": 15,
                    "defense": 10
                },
                "equipment": {
                    "weapon": "sword",
                    "armor": "leather"
                }
            })
            
            # Dungeon rooms
            for i in range(min(count // 2, 20)):
                components.append({
                    "type": "room",
                    "id": f"room_{i}",
                    "x": (i % 5) * 200,
                    "y": (i // 5) * 200,
                    "width": 180,
                    "height": 180,
                    "roomType": random.choice(["corridor", "chamber", "treasure", "boss"]),
                    "enemies": random.randint(0, 3),
                    "traps": random.randint(0, 2),
                    "exits": random.sample(["north", "south", "east", "west"], k=random.randint(1, 3))
                })
            
            # Monsters
            for i in range(min(count // 3, 15)):
                components.append({
                    "type": "monster",
                    "id": f"monster_{i}",
                    "x": random.randint(200, 700),
                    "y": random.randint(200, 500),
                    "width": 32,
                    "height": 32,
                    "sprite": f"monster_{i % 5}.png",
                    "monsterType": random.choice(["goblin", "skeleton", "orc", "dragon"]),
                    "health": random.randint(20, 100),
                    "attack": random.randint(5, 20),
                    "loot": random.choice(["gold", "potion", "weapon", None])
                })
        
        # Ensure we have exactly the requested count
        while len(components) < count:
            components.append({
                "type": "decoration",
                "id": f"decor_{len(components)}",
                "x": random.randint(0, 800),
                "y": random.randint(0, 600),
                "width": 16,
                "height": 16,
                "sprite": "decoration.png"
            })
        
        return components[:count]
    
    def benchmark_game_type(self, game_type: str) -> Dict:
        """Benchmark compilation for a specific game type"""
        print(f"\nBenchmarking {game_type} compilation...")
        
        result = {
            "game_type": game_type,
            "iterations": ITERATIONS_PER_TYPE,
            "compilation_times": [],
            "code_sizes": [],
            "errors": [],
            "statistics": {}
        }
        
        api = APITestHelper(self.base_url)
        
        # Warm-up run
        components = self.generate_components(game_type, 10)
        api.compile_game(components, game_type)
        
        # Actual benchmark runs
        for i in range(ITERATIONS_PER_TYPE):
            components = self.generate_components(game_type, 20)
            
            # Force garbage collection before timing
            gc.collect()
            
            start_time = time.time()
            try:
                compile_result, status = api.compile_game(components, game_type)
                compilation_time = time.time() - start_time
                
                if status == 200 and compile_result.get("code"):
                    result["compilation_times"].append(compilation_time)
                    result["code_sizes"].append(len(compile_result["code"]))
                else:
                    result["errors"].append(f"Iteration {i}: Status {status}")
                    
            except Exception as e:
                result["errors"].append(f"Iteration {i}: {str(e)}")
            
            # Small delay between iterations
            time.sleep(0.1)
        
        # Calculate statistics
        if result["compilation_times"]:
            result["statistics"] = {
                "mean": statistics.mean(result["compilation_times"]),
                "median": statistics.median(result["compilation_times"]),
                "stdev": statistics.stdev(result["compilation_times"]) if len(result["compilation_times"]) > 1 else 0,
                "min": min(result["compilation_times"]),
                "max": max(result["compilation_times"]),
                "p95": statistics.quantiles(result["compilation_times"], n=20)[18] if len(result["compilation_times"]) > 1 else result["compilation_times"][0],
                "avg_code_size": statistics.mean(result["code_sizes"])
            }
            
            print(f"  Average: {result['statistics']['mean']:.3f}s")
            print(f"  P95: {result['statistics']['p95']:.3f}s")
            print(f"  Code size: {result['statistics']['avg_code_size']:.0f} bytes")
        else:
            print(f"  ❌ All compilation attempts failed")
        
        return result
    
    def benchmark_component_scaling(self) -> Dict:
        """Test how compilation time scales with number of components"""
        print("\n" + "=" * 60)
        print("BENCHMARKING COMPONENT SCALING")
        print("=" * 60)
        
        result = {
            "component_counts": COMPONENT_COUNTS,
            "scaling_data": [],
            "scaling_factor": None
        }
        
        api = APITestHelper(self.base_url)
        
        for count in COMPONENT_COUNTS:
            print(f"\nTesting with {count} components...")
            
            count_result = {
                "count": count,
                "compilation_times": [],
                "memory_usage": []
            }
            
            # Test each game type with this component count
            for game_type in ["platformer", "rpg", "space"]:  # Representative subset
                components = self.generate_components(game_type, count)
                
                # Measure memory before
                gc.collect()
                
                # Compile multiple times
                for _ in range(3):
                    start_time = time.time()
                    try:
                        compile_result, status = api.compile_game(components, game_type)
                        if status == 200:
                            compilation_time = time.time() - start_time
                            count_result["compilation_times"].append(compilation_time)
                    except Exception as e:
                        print(f"    Error: {str(e)}")
                    
                    time.sleep(0.1)
            
            if count_result["compilation_times"]:
                avg_time = statistics.mean(count_result["compilation_times"])
                count_result["avg_compilation_time"] = avg_time
                print(f"  Average time: {avg_time:.3f}s")
            
            result["scaling_data"].append(count_result)
        
        # Calculate scaling factor (should ideally be close to O(n) or O(n log n))
        if len(result["scaling_data"]) >= 2:
            first = result["scaling_data"][0]
            last = result["scaling_data"][-1]
            
            if first.get("avg_compilation_time") and last.get("avg_compilation_time"):
                time_ratio = last["avg_compilation_time"] / first["avg_compilation_time"]
                count_ratio = last["count"] / first["count"]
                
                # Calculate complexity (O(n^x) where x is the scaling factor)
                import math
                scaling_factor = math.log(time_ratio) / math.log(count_ratio)
                result["scaling_factor"] = scaling_factor
                
                print(f"\nScaling analysis:")
                print(f"  Time increased {time_ratio:.1f}x for {count_ratio:.1f}x components")
                print(f"  Estimated complexity: O(n^{scaling_factor:.2f})")
                
                if scaling_factor > 1.5:
                    print(f"  ⚠️ Non-linear scaling detected - optimization needed")
                else:
                    print(f"  ✓ Acceptable scaling performance")
        
        return result
    
    def benchmark_code_generation(self) -> Dict:
        """Benchmark Python code generation performance"""
        print("\n" + "=" * 60)
        print("BENCHMARKING CODE GENERATION")
        print("=" * 60)
        
        result = {
            "generation_tests": [],
            "template_rendering": {},
            "optimization_impact": {}
        }
        
        api = APITestHelper(self.base_url)
        
        # Test different code generation scenarios
        test_scenarios = [
            {
                "name": "minimal",
                "components": [
                    {"type": "player", "x": 100, "y": 100}
                ]
            },
            {
                "name": "simple_game",
                "components": self.generate_components("platformer", 10)
            },
            {
                "name": "complex_game",
                "components": self.generate_components("rpg", 50)
            },
            {
                "name": "physics_heavy",
                "components": [
                    {"type": "player", "x": 100, "y": 100, "physics": True},
                    *[{"type": "physics_object", "x": i*50, "y": 200, "mass": 1.0, "elasticity": 0.8} 
                      for i in range(20)]
                ]
            },
            {
                "name": "ai_heavy",
                "components": [
                    {"type": "player", "x": 400, "y": 300},
                    *[{"type": "ai_enemy", "x": i*100, "y": j*100, "ai": "pathfinding", "behavior": "aggressive"} 
                      for i in range(5) for j in range(5)]
                ]
            }
        ]
        
        for scenario in test_scenarios:
            print(f"\nTesting {scenario['name']} scenario...")
            
            scenario_result = {
                "name": scenario["name"],
                "component_count": len(scenario["components"]),
                "compilation_times": [],
                "code_sizes": []
            }
            
            # Run multiple iterations
            for _ in range(5):
                gc.collect()
                
                start_time = time.time()
                try:
                    compile_result, status = api.compile_game(
                        scenario["components"], 
                        "platformer"
                    )
                    
                    if status == 200 and compile_result.get("code"):
                        compilation_time = time.time() - start_time
                        scenario_result["compilation_times"].append(compilation_time)
                        scenario_result["code_sizes"].append(len(compile_result["code"]))
                except Exception as e:
                    print(f"    Error: {str(e)}")
                
                time.sleep(0.1)
            
            # Calculate statistics
            if scenario_result["compilation_times"]:
                scenario_result["avg_time"] = statistics.mean(scenario_result["compilation_times"])
                scenario_result["avg_code_size"] = statistics.mean(scenario_result["code_sizes"])
                
                print(f"  Avg time: {scenario_result['avg_time']:.3f}s")
                print(f"  Avg code size: {scenario_result['avg_code_size']:.0f} bytes")
                print(f"  Bytes per component: {scenario_result['avg_code_size'] / scenario_result['component_count']:.0f}")
            
            result["generation_tests"].append(scenario_result)
        
        return result
    
    def benchmark_export_functionality(self) -> Dict:
        """Benchmark game export/download functionality"""
        print("\n" + "=" * 60)
        print("BENCHMARKING EXPORT FUNCTIONALITY")
        print("=" * 60)
        
        result = {
            "export_tests": [],
            "compression_ratios": [],
            "export_times": []
        }
        
        # Note: Export functionality would need to be implemented in the backend
        # This is a placeholder for when that functionality is added
        
        print("  Export functionality not yet implemented in backend")
        print("  Placeholder for future benchmarking")
        
        # Simulate what we would test
        simulated_tests = [
            "ZIP archive creation time",
            "Asset bundling performance",
            "Code minification impact",
            "Download speed for different project sizes"
        ]
        
        for test in simulated_tests:
            print(f"  Would test: {test}")
        
        return result
    
    def analyze_and_suggest_optimizations(self) -> List[str]:
        """Analyze results and suggest optimizations"""
        suggestions = []
        
        # Check compilation times
        slow_types = []
        for game_type, data in self.results["game_type_benchmarks"].items():
            if data.get("statistics", {}).get("p95", 0) > 1.0:
                slow_types.append(game_type)
        
        if slow_types:
            suggestions.append(f"Add caching for {', '.join(slow_types)} game type compilation")
        
        # Check scaling
        if self.results.get("component_scaling", {}).get("scaling_factor", 0) > 1.5:
            suggestions.append("Optimize component processing algorithm - currently O(n^2) or worse")
            suggestions.append("Consider using batch processing for components")
        
        # Check code generation
        code_gen = self.results.get("code_generation", {})
        if code_gen:
            for test in code_gen.get("generation_tests", []):
                if test.get("avg_time", 0) > 0.5:
                    suggestions.append(f"Optimize code generation for {test['name']} scenarios")
        
        # General optimizations
        suggestions.extend([
            "Implement template caching to avoid re-parsing",
            "Use connection pooling for database operations",
            "Add Redis caching for frequently compiled games",
            "Implement async compilation for better concurrency",
            "Use code generation templates instead of string concatenation",
            "Add request queuing for high load scenarios"
        ])
        
        return suggestions
    
    def run_all_benchmarks(self) -> Dict:
        """Run all compilation benchmarks"""
        print("=" * 60)
        print("GAME COMPILATION BENCHMARK SUITE")
        print("=" * 60)
        
        # Benchmark each game type
        print("\n" + "=" * 60)
        print("BENCHMARKING GAME TYPES")
        print("=" * 60)
        
        for game_type in GAME_TYPES:
            result = self.benchmark_game_type(game_type)
            self.results["game_type_benchmarks"][game_type] = result
            time.sleep(1)  # Cool down between tests
        
        # Benchmark component scaling
        self.results["component_scaling"] = self.benchmark_component_scaling()
        time.sleep(2)
        
        # Benchmark code generation
        self.results["code_generation"] = self.benchmark_code_generation()
        time.sleep(2)
        
        # Benchmark export functionality
        self.results["export_performance"] = self.benchmark_export_functionality()
        
        # Generate optimization suggestions
        self.results["optimization_suggestions"] = self.analyze_and_suggest_optimizations()
        
        return self.results
    
    def save_results(self, filename: str = "compilation_benchmark_results.json"):
        """Save benchmark results to JSON file"""
        output_path = os.path.join(os.path.dirname(__file__), filename)
        with open(output_path, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"\nResults saved to {output_path}")


def main():
    """Run compilation benchmarks"""
    benchmark = CompilationBenchmark()
    
    try:
        results = benchmark.run_all_benchmarks()
        benchmark.save_results()
        
        # Print summary
        print("\n" + "=" * 60)
        print("COMPILATION BENCHMARK SUMMARY")
        print("=" * 60)
        
        # Game type performance
        print("\n📊 Game Type Compilation Times (P95):")
        for game_type, data in results["game_type_benchmarks"].items():
            stats = data.get("statistics", {})
            if stats:
                p95 = stats.get("p95", 0)
                status = "✓" if p95 < 1.0 else "⚠️"
                print(f"  {status} {game_type}: {p95:.3f}s")
        
        # Scaling performance
        scaling = results.get("component_scaling", {})
        if scaling.get("scaling_factor"):
            factor = scaling["scaling_factor"]
            status = "✓" if factor <= 1.5 else "⚠️"
            print(f"\n{status} Component Scaling: O(n^{factor:.2f})")
        
        # Code generation
        code_gen = results.get("code_generation", {})
        if code_gen.get("generation_tests"):
            print("\n📝 Code Generation Performance:")
            for test in code_gen["generation_tests"]:
                if test.get("avg_time"):
                    status = "✓" if test["avg_time"] < 0.5 else "⚠️"
                    print(f"  {status} {test['name']}: {test['avg_time']:.3f}s")
        
        # Optimization suggestions
        if results.get("optimization_suggestions"):
            print("\n💡 Optimization Suggestions:")
            for i, suggestion in enumerate(results["optimization_suggestions"][:5], 1):
                print(f"  {i}. {suggestion}")
        
        # Performance grade
        slow_count = sum(1 for _, data in results["game_type_benchmarks"].items() 
                        if data.get("statistics", {}).get("p95", 0) > 1.0)
        
        if slow_count == 0:
            print("\n🎉 Excellent Performance - All benchmarks passed!")
            return 0
        elif slow_count <= 2:
            print("\n✅ Good Performance - Minor optimizations needed")
            return 0
        else:
            print("\n⚠️ Performance Issues Detected - Optimization required")
            return 1
            
    except Exception as e:
        print(f"\n❌ Benchmark failed with error: {str(e)}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())