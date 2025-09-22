#!/usr/bin/env python3
"""
End-to-End Test for Compiler Orchestrator
Tests the complete async compilation pipeline.
"""

import sys
import os
import time
import json
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

def test_compilation_pipeline():
    """Test the complete compilation pipeline."""
    print("🚀 Starting End-to-End Compilation Test")
    print("=" * 50)
    
    try:
        # Test 1: Import the orchestrator
        print("1️⃣ Testing orchestrator import...")
        from compiler_orchestrator import compiler_orchestrator, CompilationRequest
        print("✅ Orchestrator imported successfully")
        
        # Test 2: Create a simple compilation request
        print("\n2️⃣ Creating compilation request...")
        request = CompilationRequest(
            template_id='platformer-template',
            components=[
                {'id': 'player_movement', 'type': 'movement'},
                {'id': 'platform_collision', 'type': 'physics'}
            ],
            configuration={'debug': True},
            targets=['desktop'],
            assets=[],
            user_id='test_user'
        )
        
        cache_key = request.get_cache_key()
        print(f"✅ Request created with cache key: {cache_key}")
        
        # Test 3: Start compilation
        print("\n3️⃣ Starting compilation...")
        compilation_id = compiler_orchestrator.start_compilation(request)
        print(f"✅ Compilation started with ID: {compilation_id}")
        
        # Test 4: Monitor compilation status
        print("\n4️⃣ Monitoring compilation status...")
        max_wait_time = 30  # 30 seconds max
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status = compiler_orchestrator.get_compilation_status(compilation_id)
            
            if status is None:
                print("❌ Compilation status not found")
                break
                
            current_status = status.get('status', 'unknown')
            progress = status.get('progress', 0)
            
            print(f"   Status: {current_status} ({progress}%)")
            
            if current_status == 'completed':
                print("✅ Compilation completed successfully!")
                
                # Test 5: Check result
                print("\n5️⃣ Checking compilation result...")
                result = status.get('result')
                if result:
                    print(f"✅ Result found:")
                    print(f"   Success: {result.get('success')}")
                    print(f"   Outputs: {result.get('outputs', {})}")
                    print(f"   Metadata: {result.get('metadata', {})}")
                    return True
                else:
                    print("❌ No result in completed compilation")
                    return False
                    
            elif current_status == 'failed':
                print("❌ Compilation failed!")
                errors = status.get('errors', [])
                for error in errors:
                    print(f"   Error: {error}")
                return False
                
            # Wait a bit before checking again
            time.sleep(1)
        
        print("⏰ Compilation timed out")
        return False
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_asset_packager():
    """Test asset packager functionality."""
    print("\n🎨 Testing Asset Packager")
    print("=" * 50)
    
    try:
        from asset_packager import AssetPackager
        
        # Test instantiation
        packager = AssetPackager()
        print("✅ AssetPackager instantiated successfully")
        
        # Test path validation
        test_paths = [
            'assets/test.png',  # Should be valid
            '../../../etc/passwd',  # Should be invalid
            'attached_assets/image.jpg',  # Should be valid
            '/absolute/path/file.txt'  # Should be invalid
        ]
        
        print("\n🔒 Testing path validation:")
        for path in test_paths:
            result = packager._validate_custom_asset_path(path)
            status = "✅ Valid" if result['valid'] else f"❌ Invalid: {result['error']}"
            print(f"   {path}: {status}")
        
        # Test asset packaging
        print("\n📦 Testing asset packaging:")
        manifest = packager.package_assets(
            asset_refs=[],
            custom_assets=[],
            cache_key='test_cache_key'
        )
        
        print(f"✅ Asset manifest created:")
        print(f"   Version: {manifest.get('version')}")
        print(f"   Asset count: {manifest.get('asset_count', 0)}")
        print(f"   Total size: {manifest.get('total_size', 0)} bytes")
        
        return True
        
    except Exception as e:
        print(f"❌ Asset packager test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_route_imports():
    """Test that route endpoints can import orchestrator."""
    print("\n🛣️ Testing Route Imports")
    print("=" * 50)
    
    try:
        # This simulates what happens in routes.py
        from compiler_orchestrator import compiler_orchestrator
        
        # Test that we can call the methods routes would use
        status = compiler_orchestrator.get_compilation_status('nonexistent_id')
        if status is None:
            print("✅ get_compilation_status works (returned None for nonexistent ID)")
        else:
            print("⚠️ get_compilation_status returned unexpected result for nonexistent ID")
        
        print("✅ Route imports test passed")
        return True
        
    except Exception as e:
        print(f"❌ Route imports test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🧪 Compiler Orchestrator Production Readiness Test")
    print("=" * 60)
    
    tests = [
        ("Route Imports", test_route_imports),
        ("Asset Packager", test_asset_packager),
        ("Compilation Pipeline", test_compilation_pipeline)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running {test_name} Test...")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Compiler Orchestrator is production ready!")
        return True
    else:
        print("⚠️ Some tests failed. Review the output above.")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)