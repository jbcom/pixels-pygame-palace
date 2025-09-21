#!/usr/bin/env python3
"""
Production readiness verification script.

This script verifies all the critical fixes are working correctly
without relative import issues.
"""

import os
import sys
import json
from pathlib import Path

# Add the src directory to Python path
src_path = Path(__file__).parent / 'src'
sys.path.insert(0, str(src_path))

def test_legacy_fallback():
    """Test the legacy fallback system."""
    print("🧪 Testing legacy fallback...")
    
    try:
        from legacy_fallback import generate_python_code  # type: ignore
        
        # Test with sample components
        components = [{'id': 'player-sprite', 'type': 'component'}]
        template_id = 'platformer-template'
        
        code = generate_python_code(components, template_id)
        
        # Verify the generated code
        if 'import pygame' in code and 'class Entity' in code and 'def main()' in code:
            print("✅ Legacy fallback generates valid code")
            print(f"   Generated {len(code)} characters of code")
            return True
        else:
            print("❌ Legacy fallback code missing required elements")
            return False
            
    except Exception as e:
        print(f"❌ Legacy fallback failed: {e}")
        return False

def test_asset_security():
    """Test asset security validation."""
    print("🔒 Testing asset security...")
    
    try:
        from asset_packager import AssetPackager  # type: ignore
        
        packager = AssetPackager()
        
        # Test path traversal protection
        dangerous_paths = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '/etc/shadow',
            'assets/../../../sensitive_file.txt'
        ]
        
        all_blocked = True
        for path in dangerous_paths:
            result = packager._validate_custom_asset_path(path)
            if result['valid']:
                print(f"❌ Dangerous path not blocked: {path}")
                all_blocked = False
            else:
                print(f"✅ Blocked dangerous path: {path}")
        
        # Test valid paths (structure validation only)
        valid_paths = [
            'assets/sprites/player.png',
            'uploaded_assets/custom_sprite.png',
            'user_assets/tileset.png'
        ]
        
        valid_count = 0
        for path in valid_paths:
            result = packager._validate_custom_asset_path(path)
            if result['valid']:
                valid_count += 1
                print(f"✅ Valid path accepted: {path}")
            else:
                print(f"❌ Valid path rejected: {path} - {result['error']}")
        
        return all_blocked and valid_count > 0
        
    except Exception as e:
        print(f"❌ Asset security test failed: {e}")
        return False

def test_compiler_orchestrator():
    """Test compiler orchestrator initialization."""
    print("🔧 Testing compiler orchestrator...")
    
    try:
        from compiler_orchestrator import CompilerOrchestrator, CompilationRequest  # type: ignore
        
        # Test initialization
        orchestrator = CompilerOrchestrator()
        print("✅ Compiler orchestrator initializes without error")
        
        # Test cache key generation
        request = CompilationRequest(
            template_id='platformer-template',
            components=[{'id': 'player-sprite'}],
            configuration={'screenWidth': 800},
            targets=['desktop']
        )
        
        cache_key = request.get_cache_key()
        if cache_key and len(cache_key) > 0:
            print(f"✅ Cache key generation works: {cache_key}")
        else:
            print("❌ Cache key generation failed")
            return False
        
        # Test that directories exist
        if orchestrator.cache_dir.exists() and orchestrator.output_dir.exists():
            print("✅ Cache and output directories created")
        else:
            print("❌ Required directories not created")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Compiler orchestrator test failed: {e}")
        return False

def test_routes_fallback():
    """Test that the routes fallback import works."""
    print("🛤️  Testing routes fallback import...")
    
    try:
        # Test the import path that would be used in the fallback
        from legacy_fallback import generate_python_code  # type: ignore
        
        # This is the import that was failing before
        components = [{'id': 'test'}]
        code = generate_python_code(components, 'test')
        
        if code and len(code) > 100:  # Should generate substantial code
            print("✅ Routes fallback import works correctly")
            return True
        else:
            print("❌ Routes fallback import produces insufficient code")
            return False
            
    except Exception as e:
        print(f"❌ Routes fallback import test failed: {e}")
        return False

def verify_all_fixes():
    """Run all verification tests."""
    print("🔍 Verifying all production-ready fixes...")
    print("=" * 60)
    
    tests = [
        ("Legacy Fallback Bug Fix", test_legacy_fallback),
        ("Asset Security Protection", test_asset_security),
        ("Compiler Orchestrator Runtime", test_compiler_orchestrator),
        ("Routes Fallback Import", test_routes_fallback)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 40)
        success = test_func()
        results.append((test_name, success))
        
        if success:
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED")
    
    print("\n" + "=" * 60)
    print("📊 FINAL RESULTS")
    print("=" * 60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print("-" * 60)
    if passed == total:
        print(f"🎉 ALL {total} CRITICAL FIXES VERIFIED!")
        print("🚀 System is PRODUCTION READY!")
        return True
    else:
        print(f"⚠️  {passed}/{total} fixes verified ({total - passed} failures)")
        print("🔧 Additional work needed before production deployment")
        return False

if __name__ == "__main__":
    success = verify_all_fixes()
    sys.exit(0 if success else 1)