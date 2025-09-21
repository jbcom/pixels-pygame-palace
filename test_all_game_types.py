#!/usr/bin/env python3
"""
Comprehensive Test Script for All Game Types
Tests compilation, execution, and project management for all 6 game types
"""

import requests
import json
import time
from datetime import datetime

class GameTypeValidator:
    def __init__(self):
        self.base_url = "http://localhost:5000/api"
        self.results = {}
        
    def test_game_type(self, game_type):
        """Test a specific game type"""
        print(f"\n{'='*60}")
        print(f"Testing {game_type.upper()} Game Type")
        print(f"{'='*60}")
        
        result = {
            "game_type": game_type,
            "compilation": {"status": "pending", "details": None, "code_length": 0},
            "project_save": {"status": "pending", "details": None},
            "project_retrieve": {"status": "pending", "details": None},
            "validation": {"status": "pending", "issues": []},
            "timestamp": datetime.now().isoformat()
        }
        
        # Define components for each game type
        components = self.get_components_for_type(game_type)
        
        # Test 1: Compilation
        print(f"\n1. Testing compilation for {game_type}...")
        try:
            response = requests.post(
                f"{self.base_url}/compile",
                json={
                    "components": components,
                    "gameType": game_type
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "code" in data:
                    code = data["code"]
                    result["compilation"]["status"] = "success"
                    result["compilation"]["code_length"] = len(code)
                    result["compilation"]["details"] = f"Generated {len(code)} characters of code"
                    
                    # Validate the generated code
                    validation_issues = self.validate_code(code, game_type)
                    if validation_issues:
                        result["validation"]["issues"] = validation_issues
                        result["validation"]["status"] = "partial"
                    else:
                        result["validation"]["status"] = "success"
                    
                    print(f"   ✓ Compilation successful ({len(code)} chars)")
                    
                    # Store the code for project save test
                    result["code"] = code
                else:
                    result["compilation"]["status"] = "failed"
                    result["compilation"]["details"] = f"Invalid response: {data}"
                    print(f"   ✗ Compilation failed: Invalid response")
            else:
                result["compilation"]["status"] = "failed"
                result["compilation"]["details"] = f"HTTP {response.status_code}: {response.text[:200]}"
                print(f"   ✗ Compilation failed: HTTP {response.status_code}")
                
        except Exception as e:
            result["compilation"]["status"] = "error"
            result["compilation"]["details"] = str(e)
            print(f"   ✗ Error during compilation: {e}")
        
        # Test 2: Project Save
        print(f"\n2. Testing project save for {game_type}...")
        try:
            project_data = {
                "name": f"Test {game_type.title()} Project",
                "components": components,
                "gameType": game_type,
                "description": f"Automated test for {game_type} game"
            }
            
            # Add code if compilation was successful
            if "code" in result:
                project_data["code"] = result["code"]
            
            response = requests.post(
                f"{self.base_url}/projects",
                json=project_data,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                if data.get("success") and "project" in data:
                    project_id = data["project"].get("id")
                    result["project_save"]["status"] = "success"
                    result["project_save"]["details"] = f"Project ID: {project_id}"
                    result["project_id"] = project_id
                    print(f"   ✓ Project saved successfully (ID: {project_id})")
                else:
                    result["project_save"]["status"] = "failed"
                    result["project_save"]["details"] = "Invalid response"
                    print(f"   ✗ Project save failed: Invalid response")
            else:
                result["project_save"]["status"] = "failed"
                result["project_save"]["details"] = f"HTTP {response.status_code}"
                print(f"   ✗ Project save failed: HTTP {response.status_code}")
                
        except Exception as e:
            result["project_save"]["status"] = "error"
            result["project_save"]["details"] = str(e)
            print(f"   ✗ Error during project save: {e}")
        
        # Test 3: Project Retrieve
        if "project_id" in result:
            print(f"\n3. Testing project retrieve for {game_type}...")
            try:
                response = requests.get(
                    f"{self.base_url}/projects/{result['project_id']}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "project" in data:
                        result["project_retrieve"]["status"] = "success"
                        result["project_retrieve"]["details"] = "Project retrieved successfully"
                        print(f"   ✓ Project retrieved successfully")
                    else:
                        result["project_retrieve"]["status"] = "failed"
                        result["project_retrieve"]["details"] = "Invalid response"
                        print(f"   ✗ Project retrieve failed: Invalid response")
                else:
                    result["project_retrieve"]["status"] = "failed"
                    result["project_retrieve"]["details"] = f"HTTP {response.status_code}"
                    print(f"   ✗ Project retrieve failed: HTTP {response.status_code}")
                    
            except Exception as e:
                result["project_retrieve"]["status"] = "error"
                result["project_retrieve"]["details"] = str(e)
                print(f"   ✗ Error during project retrieve: {e}")
        
        self.results[game_type] = result
        return result
    
    def get_components_for_type(self, game_type):
        """Get test components for a specific game type"""
        base_components = [
            {
                "type": "title_screen",
                "config": {
                    "title": f"Test {game_type.title()} Game",
                    "font": "Arial",
                    "background": "#000000"
                }
            },
            {
                "type": "player",
                "config": {
                    "sprite": "default_player.png",
                    "speed": 5,
                    "health": 100
                }
            }
        ]
        
        # Add game-type specific components
        if game_type == "platformer":
            base_components.extend([
                {
                    "type": "platform",
                    "config": {
                        "tiles": ["ground.png"],
                        "gravity": 0.8
                    }
                },
                {
                    "type": "level",
                    "config": {
                        "width": 800,
                        "height": 600
                    }
                }
            ])
        elif game_type == "rpg":
            base_components.extend([
                {
                    "type": "inventory",
                    "config": {
                        "slots": 20,
                        "items": []
                    }
                },
                {
                    "type": "dialogue_system",
                    "config": {
                        "enabled": True
                    }
                }
            ])
        elif game_type == "puzzle":
            base_components.extend([
                {
                    "type": "grid",
                    "config": {
                        "rows": 8,
                        "cols": 8,
                        "tile_size": 64
                    }
                }
            ])
        elif game_type == "racing":
            base_components.extend([
                {
                    "type": "track",
                    "config": {
                        "width": 1000,
                        "checkpoints": 5
                    }
                },
                {
                    "type": "vehicle",
                    "config": {
                        "speed": 10,
                        "acceleration": 0.5
                    }
                }
            ])
        elif game_type == "space":
            base_components.extend([
                {
                    "type": "spaceship",
                    "config": {
                        "speed": 7,
                        "weapons": ["laser"]
                    }
                },
                {
                    "type": "asteroids",
                    "config": {
                        "count": 10,
                        "speed": 3
                    }
                }
            ])
        elif game_type == "dungeon":
            base_components.extend([
                {
                    "type": "dungeon_layout",
                    "config": {
                        "rooms": 10,
                        "size": "medium"
                    }
                },
                {
                    "type": "enemies",
                    "config": {
                        "types": ["skeleton", "zombie"],
                        "difficulty": "normal"
                    }
                }
            ])
        
        return base_components
    
    def validate_code(self, code, game_type):
        """Validate the generated Python code"""
        issues = []
        
        # Check for essential pygame elements
        required_elements = [
            ("import pygame", "Missing pygame import"),
            ("pygame.init()", "Missing pygame initialization"),
            ("pygame.display.set_mode", "Missing display setup"),
            ("clock = pygame.time.Clock()", "Missing clock setup"),
            ("while", "Missing main game loop"),
            ("pygame.quit()", "Missing pygame cleanup")
        ]
        
        for element, issue in required_elements:
            if element not in code:
                issues.append(issue)
        
        # Check for game-type specific elements
        if game_type == "platformer" and "gravity" not in code.lower():
            issues.append("Platformer missing gravity implementation")
        elif game_type == "rpg" and "inventory" not in code.lower():
            issues.append("RPG missing inventory system")
        elif game_type == "puzzle" and "grid" not in code.lower():
            issues.append("Puzzle missing grid system")
        elif game_type == "racing" and "track" not in code.lower():
            issues.append("Racing missing track implementation")
        elif game_type == "space" and "spaceship" not in code.lower():
            issues.append("Space missing spaceship implementation")
        elif game_type == "dungeon" and "dungeon" not in code.lower():
            issues.append("Dungeon missing dungeon implementation")
        
        return issues
    
    def generate_report(self):
        """Generate a comprehensive test report"""
        total_tests = len(self.results) * 3  # 3 tests per game type
        passed_tests = 0
        failed_tests = 0
        
        for game_type, result in self.results.items():
            if result["compilation"]["status"] == "success":
                passed_tests += 1
            else:
                failed_tests += 1
                
            if result["project_save"]["status"] == "success":
                passed_tests += 1
            else:
                failed_tests += 1
                
            if result["project_retrieve"]["status"] == "success":
                passed_tests += 1
            else:
                failed_tests += 1
        
        report = f"""
{'='*70}
COMPREHENSIVE GAME TYPE VALIDATION REPORT
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
{'='*70}

SUMMARY
-------
Total Tests: {total_tests}
Passed: {passed_tests}
Failed: {failed_tests}
Success Rate: {(passed_tests/total_tests*100):.1f}%

DETAILED RESULTS BY GAME TYPE
-----------------------------
"""
        
        for game_type in ["platformer", "rpg", "puzzle", "racing", "space", "dungeon"]:
            if game_type in self.results:
                result = self.results[game_type]
                report += f"\n{game_type.upper()}\n"
                report += f"{'─'*len(game_type)}\n"
                
                # Compilation
                comp_status = "✓" if result["compilation"]["status"] == "success" else "✗"
                report += f"  Compilation: {comp_status} {result['compilation']['status']}\n"
                if result["compilation"]["details"]:
                    report += f"    Details: {result['compilation']['details']}\n"
                
                # Validation
                if result["validation"]["status"] != "pending":
                    val_status = "✓" if result["validation"]["status"] == "success" else "⚠"
                    report += f"  Code Validation: {val_status} {result['validation']['status']}\n"
                    if result["validation"]["issues"]:
                        report += f"    Issues:\n"
                        for issue in result["validation"]["issues"]:
                            report += f"      - {issue}\n"
                
                # Project Save
                save_status = "✓" if result["project_save"]["status"] == "success" else "✗"
                report += f"  Project Save: {save_status} {result['project_save']['status']}\n"
                if result["project_save"]["details"]:
                    report += f"    Details: {result['project_save']['details']}\n"
                
                # Project Retrieve
                ret_status = "✓" if result["project_retrieve"]["status"] == "success" else "✗"
                report += f"  Project Retrieve: {ret_status} {result['project_retrieve']['status']}\n"
                if result["project_retrieve"]["details"]:
                    report += f"    Details: {result['project_retrieve']['details']}\n"
        
        report += f"\n{'='*70}\n"
        
        return report
    
    def run_all_tests(self):
        """Run tests for all game types"""
        game_types = ["platformer", "rpg", "puzzle", "racing", "space", "dungeon"]
        
        print(f"\n{'='*70}")
        print("STARTING COMPREHENSIVE GAME TYPE VALIDATION")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}")
        
        for game_type in game_types:
            self.test_game_type(game_type)
            time.sleep(0.5)  # Small delay to avoid rate limiting
        
        report = self.generate_report()
        print(report)
        
        # Save report to file
        with open("test_results.txt", "w") as f:
            f.write(report)
        
        # Save JSON results
        with open("test_results.json", "w") as f:
            json.dump(self.results, f, indent=2)
        
        return self.results

if __name__ == "__main__":
    validator = GameTypeValidator()
    results = validator.run_all_tests()
    
    # Exit with appropriate code
    all_passed = all(
        r["compilation"]["status"] == "success" and
        r["project_save"]["status"] == "success"
        for r in results.values()
    )
    
    exit(0 if all_passed else 1)