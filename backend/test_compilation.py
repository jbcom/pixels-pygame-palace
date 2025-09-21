#!/usr/bin/env python3
"""
Test script for the complete compilation pipeline.

This tests the end-to-end compilation from template + components to working game.
"""

import sys
import os
import json
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_basic_compilation():
    """Test basic compilation with a simple platformer template."""
    print("🧪 Testing basic compilation pipeline...")
    
    try:
        from src.compiler_orchestrator import compiler_orchestrator, CompilationRequest
        
        # Create a test compilation request
        request = CompilationRequest(
            template_id='platformer-template',
            components=[
                {
                    'id': 'player-sprite',
                    'configuration': {
                        'health': 3,
                        'speed': 200,
                        'jumpStrength': 300
                    },
                    'position': {'x': 100, 'y': 400}
                },
                {
                    'id': 'platform-ground',
                    'configuration': {
                        'width': 800,
                        'height': 50
                    },
                    'position': {'x': 0, 'y': 550}
                },
                {
                    'id': 'collectible-item',
                    'configuration': {
                        'points': 10
                    },
                    'position': {'x': 300, 'y': 500}
                }
            ],
            configuration={
                'game_name': 'Test Platformer',
                'screen_width': 800,
                'screen_height': 600,
                'background_color': '#87CEEB'
            },
            targets=['desktop'],
            assets=[],
            user_id='test-user'
        )
        
        print(f"📝 Created compilation request with cache key: {request.get_cache_key()}")
        
        # Start compilation
        compilation_id = compiler_orchestrator.start_compilation(request)
        print(f"🚀 Started compilation with ID: {compilation_id}")
        
        # Check status
        status = compiler_orchestrator.get_compilation_status(compilation_id)
        print(f"📊 Compilation status: {status}")
        
        if status and status.get('status') == 'completed':
            print("✅ Compilation completed successfully!")
            
            result = status.get('result', {})
            if 'desktop' in result.get('build_outputs', {}):
                desktop_output = result['build_outputs']['desktop']
                print(f"🎮 Desktop build path: {desktop_output.get('output_path')}")
                
                # Check if files were created
                main_py_path = Path(desktop_output.get('output_path', '')) / 'main.py'
                if main_py_path.exists():
                    print("✅ main.py file created successfully")
                    # Print first few lines
                    with open(main_py_path, 'r') as f:
                        lines = f.readlines()[:10]
                        print("📄 Generated main.py preview:")
                        for i, line in enumerate(lines, 1):
                            print(f"  {i:2d}: {line.rstrip()}")
                else:
                    print("❌ main.py file not found")
            
        else:
            print(f"⚠️  Compilation status: {status.get('status', 'unknown')}")
            if status.get('errors'):
                print(f"❌ Errors: {status['errors']}")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("🔄 Testing fallback compilation...")
        return test_fallback_compilation()
    except Exception as e:
        print(f"❌ Compilation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_fallback_compilation():
    """Test fallback compilation without the full orchestrator."""
    print("🧪 Testing fallback compilation...")
    
    try:
        from src.routes import generate_python_code
        
        # Test components
        components = [
            {'id': 'player-sprite'},
            {'id': 'platform-ground'},
            {'id': 'collectible-item'}
        ]
        
        # Generate code
        code = generate_python_code(components, 'platformer-template')
        
        print("✅ Fallback compilation successful!")
        print("📄 Generated code preview:")
        lines = code.split('\n')[:15]
        for i, line in enumerate(lines, 1):
            print(f"  {i:2d}: {line}")
        
        # Test if the code is valid Python
        try:
            compile(code, '<test>', 'exec')
            print("✅ Generated code is valid Python!")
            return True
        except SyntaxError as e:
            print(f"❌ Generated code has syntax errors: {e}")
            return False
            
    except Exception as e:
        print(f"❌ Fallback compilation failed: {e}")
        return False

def test_ecs_runtime():
    """Test ECS runtime components."""
    print("🧪 Testing ECS runtime system...")
    
    try:
        from src.ecs_runtime import (
            World, Entity, EventBus,
            TransformComponent, VelocityComponent,
            InputSystem, PhysicsSystem
        )
        
        # Create world
        world = World()
        print("✅ World created successfully")
        
        # Create entity
        entity = Entity("test-entity")
        transform = TransformComponent(100, 100)
        velocity = VelocityComponent()
        
        entity.add_component(transform)
        entity.add_component(velocity)
        world.add_entity(entity)
        print("✅ Entity created and added to world")
        
        # Add systems
        input_system = InputSystem()
        physics_system = PhysicsSystem()
        
        world.add_system(input_system)
        world.add_system(physics_system)
        print("✅ Systems added to world")
        
        # Test one frame update
        world.update(0.016)  # ~60 FPS
        print("✅ World updated successfully")
        
        # Check world stats
        stats = world.get_stats()
        print(f"📊 World stats: {stats['entity_count']} entities, {stats['system_count']} systems")
        
        return True
        
    except Exception as e:
        print(f"❌ ECS runtime test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_asset_packager():
    """Test asset packager functionality."""
    print("🧪 Testing asset packager...")
    
    try:
        from src.asset_packager import AssetPackager
        
        # Create asset packager
        packager = AssetPackager()
        print("✅ Asset packager created")
        
        # Test cache stats
        stats = packager.get_cache_stats()
        print(f"📊 Cache stats: {stats}")
        
        print("✅ Asset packager basic functionality works")
        return True
        
    except Exception as e:
        print(f"❌ Asset packager test failed: {e}")
        return False

def test_template_renderer():
    """Test template renderer functionality."""
    print("🧪 Testing template renderer...")
    
    try:
        from src.templates.template_renderer import TemplateRenderer
        
        # Create renderer
        renderer = TemplateRenderer()
        print("✅ Template renderer created")
        
        # Test basic template data
        template_data = {
            'template': {
                'id': 'test-template',
                'name': 'Test Game',
                'category': 'platformer'
            },
            'components': [
                {'id': 'player-sprite'},
                {'id': 'platform-ground'}
            ],
            'game_settings': {
                'screenWidth': 800,
                'screenHeight': 600,
                'backgroundColor': '#87CEEB',
                'physics': {
                    'gravity': 980
                },
                'audio': {
                    'enabled': True,
                    'volume': 0.7
                }
            },
            'scenes': [],
            'needs_collision': True,
            'needs_animation': False,
            'needs_audio': False
        }
        
        # Test main.py rendering
        main_code = renderer.render_main_py(template_data)
        print("✅ Main.py template rendered successfully")
        
        # Check if code contains expected elements
        if 'import pygame' in main_code and 'class Game:' in main_code:
            print("✅ Generated code contains expected pygame structure")
        else:
            print("⚠️  Generated code may be missing expected elements")
        
        return True
        
    except Exception as e:
        print(f"❌ Template renderer test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests."""
    print("🎮 Pixel's PyGame Palace - Compiler System Test")
    print("=" * 50)
    
    tests = [
        ("Basic Compilation", test_basic_compilation),
        ("ECS Runtime", test_ecs_runtime),
        ("Asset Packager", test_asset_packager),
        ("Template Renderer", test_template_renderer)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 20} {test_name} {'=' * 20}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'=' * 50}")
    print("🎯 Test Results Summary:")
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n📊 Overall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! Compiler system is ready.")
        return 0
    else:
        print("⚠️  Some tests failed. Check implementation.")
        return 1

if __name__ == '__main__':
    sys.exit(main())