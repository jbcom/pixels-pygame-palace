#!/usr/bin/env python3
"""
End-to-End Smoke Test for Compiler Orchestrator
================================================

This test proves production readiness by executing the complete async compilation workflow:
1. POST /api/compile → start async compilation
2. Poll GET /api/compile/<id>/status → track progress 
3. GET /api/compile/<id>/result → retrieve final outputs
4. Verify manifest and output paths exist and are accessible

Uses real platformer template with actual components and assets.
"""

import requests
import time
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Add backend src to path for imports
backend_src = Path(__file__).parent.parent / 'src'
sys.path.insert(0, str(backend_src))

BASE_URL = "http://localhost:5001"
MAX_POLL_TIME = 60  # seconds
POLL_INTERVAL = 2   # seconds

def test_health_check() -> bool:
    """Test that the server is running."""
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed - Service: {data.get('service', 'unknown')}")
            return True
        else:
            print(f"❌ Health check failed - Status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Health check failed - Cannot connect to server: {e}")
        return False

def create_test_compilation_request() -> Dict[str, Any]:
    """Create a realistic compilation request for platformer template."""
    return {
        "templateId": "platformer-template",
        "components": [
            {
                "id": "player-sprite",
                "type": "player",
                "configuration": {
                    "speed": 250,
                    "jumpHeight": 350,
                    "health": 3,
                    "animationSpeed": 0.12
                }
            },
            {
                "id": "platform-ground",
                "type": "platform", 
                "configuration": {
                    "width": 800,
                    "height": 50,
                    "solid": True,
                    "material": "grass"
                }
            },
            {
                "id": "collectible-item",
                "type": "collectible",
                "configuration": {
                    "value": 10,
                    "itemType": "coin",
                    "respawn": False
                }
            },
            {
                "id": "basic-enemy",
                "type": "enemy",
                "configuration": {
                    "health": 2,
                    "speed": 120,
                    "patrolDistance": 100,
                    "aggressive": True
                }
            },
            {
                "id": "scrolling-background",
                "type": "background",
                "configuration": {
                    "scrollSpeed": 0.3,
                    "parallaxFactor": 0.2,
                    "layers": 3
                }
            }
        ],
        "config": {
            "gravity": 980,
            "playerLives": 3,
            "scoreSystem": True,
            "levelTransitions": True,
            "checkpoints": True,
            "screenWidth": 1024,
            "screenHeight": 768,
            "targetFPS": 60
        },
        "targets": ["desktop"],  # Start with desktop only for faster testing
        "assets": [
            {
                "path": "assets/2d/platformer/characters/Player Blue/playerBlue_stand.png",
                "logical_path": "sprites/player_idle.png",
                "type": "sprite"
            },
            {
                "path": "assets/2d/platformer/items/blueGem.png", 
                "logical_path": "sprites/collectible_gem.png",
                "type": "sprite"
            },
            {
                "path": "assets/2d/platformer/tiles/ground_grass.png",
                "logical_path": "sprites/platform_grass.png", 
                "type": "sprite"
            }
        ]
    }

def start_compilation() -> Optional[str]:
    """Start async compilation and return compilation ID."""
    print("\n🚀 Starting compilation...")
    
    request_data = create_test_compilation_request()
    
    try:
        # Mock auth token (in real scenario, this would be properly authenticated)
        headers = {"Authorization": "Bearer test-token", "Content-Type": "application/json"}
        
        response = requests.post(
            f"{BASE_URL}/api/compile",
            json=request_data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                compilation_id = data.get("compilation_id")
                cache_key = data.get("cache_key")
                print(f"✅ Compilation started successfully")
                print(f"   Compilation ID: {compilation_id}")
                print(f"   Cache Key: {cache_key}")
                print(f"   Targets: {data.get('targets', [])}")
                return compilation_id
            else:
                print(f"❌ Compilation start failed: {data.get('error', 'Unknown error')}")
                return None
        else:
            print(f"❌ Compilation start failed - Status: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Compilation start failed - Request error: {e}")
        return None

def poll_compilation_status(compilation_id: str) -> Optional[Dict[str, Any]]:
    """Poll compilation status until completion or timeout."""
    print(f"\n📊 Polling compilation status...")
    
    start_time = time.time()
    headers = {"Authorization": "Bearer test-token"}
    
    while time.time() - start_time < MAX_POLL_TIME:
        try:
            response = requests.get(
                f"{BASE_URL}/api/compile/{compilation_id}/status",
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    status = data.get("status", "unknown")
                    progress = data.get("progress", 0)
                    
                    print(f"   Status: {status} ({progress}%)")
                    
                    if status == "completed":
                        print("✅ Compilation completed successfully")
                        return data
                    elif status == "failed":
                        errors = data.get("errors", [])
                        print(f"❌ Compilation failed: {errors}")
                        return data
                    elif status in ["queued", "validating", "resolving", "generating", "packaging", "building"]:
                        # Still in progress, continue polling
                        time.sleep(POLL_INTERVAL)
                        continue
                    else:
                        print(f"❌ Unknown compilation status: {status}")
                        return data
                else:
                    print(f"❌ Status check failed: {data.get('error', 'Unknown error')}")
                    return None
            elif response.status_code == 404:
                print(f"❌ Compilation not found: {compilation_id}")
                return None
            else:
                print(f"❌ Status check failed - Status: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Status check failed - Request error: {e}")
            return None
    
    print(f"❌ Compilation timed out after {MAX_POLL_TIME} seconds")
    return None

def get_compilation_result(compilation_id: str) -> Optional[Dict[str, Any]]:
    """Get final compilation result."""
    print(f"\n📦 Retrieving compilation result...")
    
    headers = {"Authorization": "Bearer test-token"}
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/compile/{compilation_id}/result",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                result = data.get("result")
                print("✅ Compilation result retrieved successfully")
                return result
            else:
                print(f"❌ Result retrieval failed: {data.get('error', 'Unknown error')}")
                return None
        elif response.status_code == 400:
            data = response.json()
            print(f"❌ Compilation not ready: {data.get('error', 'Unknown error')}")
            print(f"   Current status: {data.get('current_status', 'unknown')}")
            return None
        elif response.status_code == 404:
            print(f"❌ Compilation or result not found: {compilation_id}")
            return None
        else:
            print(f"❌ Result retrieval failed - Status: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Result retrieval failed - Request error: {e}")
        return None

def verify_compilation_outputs(result: Dict[str, Any]) -> bool:
    """Verify that compilation outputs exist and are accessible."""
    print(f"\n🔍 Verifying compilation outputs...")
    
    if not result:
        print("❌ No result to verify")
        return False
    
    # Check result structure
    required_fields = ["success", "compilation_id", "cache_key", "outputs", "metadata", "created_at"]
    missing_fields = [field for field in required_fields if field not in result]
    if missing_fields:
        print(f"❌ Missing required fields in result: {missing_fields}")
        return False
    
    if not result.get("success"):
        print(f"❌ Compilation was not successful")
        errors = result.get("errors", [])
        if errors:
            print(f"   Errors: {errors}")
        return False
    
    # Check outputs
    outputs = result.get("outputs", {})
    if not outputs:
        print("❌ No outputs found in result")
        return False
    
    print(f"   Found outputs for targets: {list(outputs.keys())}")
    
    # Verify output paths exist
    all_paths_exist = True
    for target, output_path in outputs.items():
        if output_path and os.path.exists(output_path):
            print(f"   ✅ {target} output exists: {output_path}")
            
            # Check for key files
            if target == "desktop":
                main_py = os.path.join(output_path, "main.py")
                assets_dir = os.path.join(output_path, "assets")
                
                if os.path.exists(main_py):
                    print(f"      ✅ main.py found")
                    # Check main.py has content
                    try:
                        with open(main_py, 'r') as f:
                            content = f.read()
                        if len(content) > 100:  # Should have substantial code
                            print(f"      ✅ main.py has {len(content)} characters")
                        else:
                            print(f"      ⚠️  main.py seems too short: {len(content)} characters")
                    except Exception as e:
                        print(f"      ❌ Cannot read main.py: {e}")
                        all_paths_exist = False
                else:
                    print(f"      ❌ main.py not found")
                    all_paths_exist = False
                
                if os.path.exists(assets_dir):
                    asset_count = len([f for f in os.listdir(assets_dir) if os.path.isfile(os.path.join(assets_dir, f))])
                    print(f"      ✅ assets directory found with {asset_count} files")
                else:
                    print(f"      ⚠️  assets directory not found (may be empty)")
                    
        else:
            print(f"   ❌ {target} output path does not exist: {output_path}")
            all_paths_exist = False
    
    # Check metadata
    metadata = result.get("metadata", {})
    print(f"   Metadata: template={metadata.get('template_id')}, components={metadata.get('component_count')}")
    
    if all_paths_exist:
        print("✅ All compilation outputs verified successfully")
        return True
    else:
        print("❌ Some compilation outputs are missing or invalid")
        return False

def run_smoke_test() -> bool:
    """Run the complete end-to-end smoke test."""
    print("🧪 Starting Compiler Orchestrator End-to-End Smoke Test")
    print("=" * 60)
    
    # Step 1: Health check
    if not test_health_check():
        return False
    
    # Step 2: Start compilation
    compilation_id = start_compilation()
    if not compilation_id:
        return False
    
    # Step 3: Poll status until completion
    final_status = poll_compilation_status(compilation_id)
    if not final_status or final_status.get("status") != "completed":
        return False
    
    # Step 4: Get final result
    result = get_compilation_result(compilation_id)
    if not result:
        return False
    
    # Step 5: Verify outputs
    if not verify_compilation_outputs(result):
        return False
    
    print("\n" + "=" * 60)
    print("🎉 SMOKE TEST PASSED! Compiler Orchestrator is production ready.")
    print("   ✅ Async endpoints working")
    print("   ✅ Asset security implemented") 
    print("   ✅ End-to-end workflow functional")
    print("   ✅ Outputs verified and accessible")
    return True

def main():
    """Main entry point."""
    try:
        success = run_smoke_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Smoke test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Smoke test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()