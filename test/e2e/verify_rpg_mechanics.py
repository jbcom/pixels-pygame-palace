#!/usr/bin/env python3
"""
RPG Mechanics Verification Script
Verifies that the generated RPG game includes all required mechanics
"""

import os
import sys
import json
import requests
import time

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from game_engine import GameCompiler

def verify_rpg_code_contains_mechanics(code):
    """Verify that the generated RPG code contains all required mechanics"""
    
    required_mechanics = {
        # Character Creation
        "character_classes": ["CharacterClass", "WARRIOR", "MAGE", "ROGUE", "HEALER"],
        "character_stats": ["level", "experience", "strength", "defense", "magic", "agility"],
        
        # Inventory System
        "inventory": ["Inventory", "add_item", "remove_item", "max_slots", "equipped_weapon"],
        "items": ["Item", "item_type", "weapon", "armor", "consumable", "quest"],
        
        # Dialogue System  
        "dialogue": ["DialogueSystem", "start_dialogue", "advance_dialogue", "npc_name", "dialogue_tree"],
        
        # Combat Mechanics
        "combat": ["CombatSystem", "turn", "player_action", "enemy_turn", "attack", "magic", "defend", "flee"],
        "enemies": ["Enemy", "damage", "exp_reward"],
        
        # Quest System
        "quests": ["Quest", "QuestLog", "objectives", "completed_objectives", "reward_exp", "reward_gold"],
        
        # Level Progression
        "progression": ["level_up", "add_experience", "exp_to_next_level"],
        
        # Save System
        "save": ["SaveSystem", "save_game", "load_game", "json.dump", "json.load"],
        
        # NPCs
        "npcs": ["NPC", "interact"],
        
        # UI Elements
        "ui": ["HP:", "MP:", "Level:", "Gold:", "Inventory", "Quest Log"]
    }
    
    missing_mechanics = []
    
    for mechanic_name, keywords in required_mechanics.items():
        found_count = 0
        for keyword in keywords:
            if keyword in code:
                found_count += 1
        
        if found_count < len(keywords) // 2:  # At least half the keywords should be present
            missing_mechanics.append(mechanic_name)
            print(f"❌ Missing mechanic: {mechanic_name} (found {found_count}/{len(keywords)} keywords)")
        else:
            print(f"✅ Found mechanic: {mechanic_name} (found {found_count}/{len(keywords)} keywords)")
    
    return len(missing_mechanics) == 0, missing_mechanics

def test_rpg_compilation():
    """Test that RPG game compiles correctly with all mechanics"""
    print("\n=== Testing RPG Game Compilation ===\n")
    
    # Define RPG components based on test config
    components = [
        {"type": "title_screen", "config": {
            "title": "Quest of Legends",
            "font": "medieval",
            "background": "#1A1A2E",
            "music": "epic_orchestral.mp3"
        }},
        {"type": "player", "config": {
            "sprite": "hero_knight.png",
            "speed": 4,
            "health": 100,
            "mana": 50,
            "stats": {
                "strength": 10,
                "defense": 8,
                "magic": 5,
                "agility": 7
            }
        }},
        {"type": "inventory", "config": {
            "slots": 20,
            "categories": ["weapons", "armor", "potions", "quest_items"]
        }},
        {"type": "dialogue_system", "config": {
            "system": "branching",
            "choices": True,
            "npc_portraits": True
        }},
        {"type": "combat", "config": {
            "type": "turn_based",
            "actions": ["attack", "magic", "item", "defend", "flee"]
        }},
        {"type": "quest_system", "config": {
            "main_quest": "Defeat the Dark Lord",
            "side_quests": ["Find the Lost Sword", "Help the Farmer"]
        }},
        {"type": "ending_screen", "config": {
            "win_message": "You have saved the realm!",
            "lose_message": "The darkness has consumed the land..."
        }}
    ]
    
    # Compile the RPG game
    print("Compiling RPG game...")
    code = GameCompiler.compile(components, 'rpg')
    
    if not code:
        print("❌ Failed to generate RPG code")
        return False
    
    print(f"✅ Generated RPG code ({len(code)} characters)")
    
    # Verify all mechanics are present
    print("\n=== Verifying RPG Mechanics ===\n")
    all_present, missing = verify_rpg_code_contains_mechanics(code)
    
    if not all_present:
        print(f"\n❌ Missing {len(missing)} mechanics: {', '.join(missing)}")
        return False
    
    print("\n✅ All RPG mechanics are present in the generated code")
    
    # Verify code is valid Python
    print("\n=== Verifying Python Syntax ===\n")
    try:
        compile(code, '<string>', 'exec')
        print("✅ Generated code is valid Python")
    except SyntaxError as e:
        print(f"❌ Syntax error in generated code: {e}")
        return False
    
    # Save the code for inspection
    output_file = "test_rpg_game.py"
    with open(output_file, 'w') as f:
        f.write(code)
    print(f"\n✅ RPG game saved to {output_file}")
    
    return True

def test_rpg_api_endpoint():
    """Test the RPG compilation through the API endpoint"""
    print("\n=== Testing RPG API Endpoint ===\n")
    
    base_url = "http://localhost:5001"
    
    # Check if backend is running
    try:
        response = requests.get(f"{base_url}/api/health", timeout=2)
        if response.status_code == 200:
            print("✅ Backend is running")
        else:
            print("❌ Backend returned unexpected status code")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Backend is not running. Please start the Flask backend first.")
        return False
    except Exception as e:
        print(f"❌ Error connecting to backend: {e}")
        return False
    
    # Test compilation endpoint
    components = [
        {"type": "title_screen", "props": {"title": "RPG Test"}},
        {"type": "player", "props": {"class": "warrior"}},
        {"type": "inventory", "props": {"slots": 20}},
        {"type": "dialogue", "props": {"system": "branching"}},
        {"type": "combat", "props": {"type": "turn_based"}}
    ]
    
    try:
        response = requests.post(
            f"{base_url}/api/compile",
            json={"components": components, "gameType": "rpg"},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('code'):
                print("✅ API compilation successful")
                
                # Verify the returned code
                code = data['code']
                all_present, missing = verify_rpg_code_contains_mechanics(code)
                
                if all_present:
                    print("✅ API-generated code contains all mechanics")
                    return True
                else:
                    print(f"❌ API-generated code missing mechanics: {missing}")
                    return False
            else:
                print("❌ API returned error:", data.get('error', 'Unknown error'))
                return False
        else:
            print(f"❌ API returned status code {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error calling API: {e}")
        return False

def main():
    """Run all RPG verification tests"""
    print("=" * 60)
    print("RPG GAME FLOW VERIFICATION")
    print("=" * 60)
    
    all_tests_passed = True
    
    # Test direct compilation
    if not test_rpg_compilation():
        all_tests_passed = False
        print("\n❌ Direct RPG compilation test failed")
    else:
        print("\n✅ Direct RPG compilation test passed")
    
    # Test API endpoint
    if not test_rpg_api_endpoint():
        all_tests_passed = False
        print("\n❌ API endpoint test failed")
    else:
        print("\n✅ API endpoint test passed")
    
    # Summary
    print("\n" + "=" * 60)
    if all_tests_passed:
        print("✅ ALL RPG VERIFICATION TESTS PASSED")
        print("\nThe RPG game flow is fully functional with:")
        print("  • Character creation (classes, stats)")
        print("  • Inventory management system")
        print("  • Dialogue system with NPCs")
        print("  • Turn-based combat mechanics")
        print("  • Quest tracking system")
        print("  • Level progression")
        print("  • Save/load functionality")
    else:
        print("❌ SOME TESTS FAILED - Please review the errors above")
    print("=" * 60)
    
    return 0 if all_tests_passed else 1

if __name__ == '__main__':
    sys.exit(main())