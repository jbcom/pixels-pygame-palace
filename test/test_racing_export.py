#!/usr/bin/env python
"""
Test racing game export functionality
"""
import os
import sys
import requests
import json
import tempfile

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from game_engine import GameCompiler

def test_racing_compilation():
    """Test that racing game compiles correctly"""
    print("Testing racing game compilation...")
    
    # Test components for racing game
    components = [
        {
            'type': 'title_screen',
            'config': {
                'title': 'Speed Racer Pro',
                'font': 'bold',
                'background': '#FF0000',
                'music': 'engine_rev.mp3',
                'style': 'dynamic'
            }
        },
        {
            'type': 'vehicle',
            'config': {
                'type': 'SPORTS_CAR',
                'speed': 200,
                'acceleration': 5,
                'handling': 8,
                'nitro': 100
            }
        },
        {
            'type': 'track',
            'config': {
                'environment': 'CITY',
                'laps': 3,
                'checkpoints': True
            }
        },
        {
            'type': 'weather',
            'config': {
                'type': 'CLEAR'
            }
        },
        {
            'type': 'ai_opponents',
            'config': {
                'count': 3,
                'difficulty': 'medium'
            }
        },
        {
            'type': 'power_ups',
            'config': {
                'enabled': True,
                'types': ['nitro', 'shield', 'speed']
            }
        }
    ]
    
    # Compile the game
    code = GameCompiler.compile(components, 'racing')
    
    # Verify the code contains racing-specific elements
    assert 'Racing Game' in code, "Missing racing game title"
    assert 'Vehicle' in code, "Missing vehicle class"
    assert 'Track' in code, "Missing track class"
    assert 'nitro' in code.lower(), "Missing nitro mechanic"
    assert 'drift' in code.lower(), "Missing drift mechanic"
    assert 'lap' in code.lower(), "Missing lap system"
    assert 'AIOpponent' in code, "Missing AI opponents"
    assert 'Weather' in code, "Missing weather system"
    assert 'Championship' in code, "Missing championship mode"
    
    print("✓ Racing game compilation successful")
    print(f"✓ Generated {len(code)} bytes of code")
    
    # Test that code is valid Python
    try:
        compile(code, '<string>', 'exec')
        print("✓ Generated code is valid Python")
    except SyntaxError as e:
        print(f"✗ Syntax error in generated code: {e}")
        return False
    
    return True

def test_racing_export():
    """Test that racing game can be exported to file"""
    print("\nTesting racing game export...")
    
    # Compile the game
    components = [
        {'type': 'vehicle', 'config': {'type': 'SPORTS_CAR'}},
        {'type': 'track', 'config': {'environment': 'CITY'}}
    ]
    
    code = GameCompiler.compile(components, 'racing')
    
    # Export to temporary file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        temp_file = f.name
    
    print(f"✓ Exported racing game to {temp_file}")
    
    # Verify file exists and is readable
    assert os.path.exists(temp_file), "Export file doesn't exist"
    
    with open(temp_file, 'r') as f:
        exported_code = f.read()
    
    assert len(exported_code) > 0, "Exported file is empty"
    assert exported_code == code, "Exported code doesn't match"
    
    # Clean up
    os.remove(temp_file)
    print("✓ Export verification complete")
    
    return True

def test_racing_api_integration():
    """Test racing game through API"""
    print("\nTesting racing game API integration...")
    
    base_url = 'http://localhost:5000/api'
    
    # Test compilation endpoint
    components = [
        {'type': 'vehicle', 'config': {'type': 'FORMULA'}},
        {'type': 'track', 'config': {'environment': 'DESERT'}},
        {'type': 'weather', 'config': {'type': 'RAIN'}}
    ]
    
    try:
        response = requests.post(f'{base_url}/compile', 
                                json={
                                    'components': components,
                                    'gameType': 'racing'
                                },
                                timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            assert data['success'], "Compilation failed"
            assert 'code' in data, "No code returned"
            assert len(data['code']) > 1000, "Code too short"
            print("✓ API compilation successful")
            
            # Verify racing-specific content
            code = data['code']
            assert 'FORMULA' in code or 'Formula' in code, "Vehicle type not applied"
            assert 'DESERT' in code or 'Desert' in code, "Track environment not applied"
            assert 'RAIN' in code or 'Rain' in code, "Weather not applied"
            print("✓ Racing components correctly applied")
        else:
            print(f"✗ API returned status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"✗ API request failed: {e}")
        print("  Make sure the Flask server is running on port 5000")
        return False
    
    return True

def main():
    """Run all racing game tests"""
    print("=" * 60)
    print("RACING GAME EXPORT TESTS")
    print("=" * 60)
    
    all_passed = True
    
    # Test compilation
    if not test_racing_compilation():
        all_passed = False
    
    # Test export
    if not test_racing_export():
        all_passed = False
    
    # Test API integration
    if not test_racing_api_integration():
        all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL RACING GAME TESTS PASSED!")
    else:
        print("❌ Some tests failed")
    print("=" * 60)
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())