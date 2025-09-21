import pygame
import sys
import random
import math
import json

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60
TILE_SIZE = 32

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
GRAY = (128, 128, 128)
DARK_GRAY = (64, 64, 64)

# Set up the display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("RPG Adventure")

# Clock for controlling frame rate
clock = pygame.time.Clock()

# Fonts
font_small = pygame.font.Font(None, 24)
font_medium = pygame.font.Font(None, 36)
font_large = pygame.font.Font(None, 48)

# Character Classes
class CharacterClass:
    WARRIOR = "Warrior"
    MAGE = "Mage"
    ROGUE = "Rogue"
    HEALER = "Healer"

# Character Stats
class Character:
    def __init__(self, name="Hero", char_class=CharacterClass.WARRIOR):
        self.name = name
        self.char_class = char_class
        self.level = 1
        self.experience = 0
        self.exp_to_next_level = 100
        
        # Base stats based on class
        if char_class == CharacterClass.WARRIOR:
            self.max_hp = 150
            self.max_mp = 30
            self.strength = 15
            self.defense = 12
            self.magic = 5
            self.agility = 8
        elif char_class == CharacterClass.MAGE:
            self.max_hp = 80
            self.max_mp = 120
            self.strength = 6
            self.defense = 7
            self.magic = 18
            self.agility = 10
        elif char_class == CharacterClass.ROGUE:
            self.max_hp = 100
            self.max_mp = 50
            self.strength = 10
            self.defense = 8
            self.magic = 8
            self.agility = 16
        else:  # Healer
            self.max_hp = 90
            self.max_mp = 100
            self.strength = 7
            self.defense = 10
            self.magic = 15
            self.agility = 9
        
        self.hp = self.max_hp
        self.mp = self.max_mp
        self.gold = 50
        
        # Position
        self.x = SCREEN_WIDTH // 2
        self.y = SCREEN_HEIGHT // 2
        self.speed = 4
        
        # Combat stats
        self.in_combat = False
        self.defending = False
        
    def level_up(self):
        self.level += 1
        self.max_hp += 10
        self.max_mp += 5
        self.strength += 2
        self.defense += 2
        self.magic += 2
        self.agility += 1
        self.hp = self.max_hp
        self.mp = self.max_mp
        self.exp_to_next_level = self.level * 100
        
    def add_experience(self, exp):
        self.experience += exp
        while self.experience >= self.exp_to_next_level:
            self.experience -= self.exp_to_next_level
            self.level_up()
    
    def draw(self, screen):
        pygame.draw.rect(screen, GREEN, (self.x - 16, self.y - 16, 32, 32))
        # Draw class indicator
        text = font_small.render(self.char_class[0], True, WHITE)
        screen.blit(text, (self.x - 8, self.y - 8))

# Inventory System
class Item:
    def __init__(self, name, item_type, value=0, effect=None):
        self.name = name
        self.item_type = item_type  # "weapon", "armor", "consumable", "quest"
        self.value = value
        self.effect = effect
        self.quantity = 1

class Inventory:
    def __init__(self, max_slots=20):
        self.items = []
        self.max_slots = max_slots
        self.equipped_weapon = None
        self.equipped_armor = None
        
    def add_item(self, item):
        if len(self.items) < self.max_slots:
            # Check if item already exists and stack
            for inv_item in self.items:
                if inv_item.name == item.name and inv_item.item_type == "consumable":
                    inv_item.quantity += 1
                    return True
            self.items.append(item)
            return True
        return False
    
    def remove_item(self, item):
        if item in self.items:
            if item.quantity > 1:
                item.quantity -= 1
            else:
                self.items.remove(item)
            return True
        return False
    
    def use_item(self, item, character):
        if item.item_type == "consumable":
            if item.effect == "heal":
                character.hp = min(character.hp + item.value, character.max_hp)
            elif item.effect == "mana":
                character.mp = min(character.mp + item.value, character.max_mp)
            self.remove_item(item)
            return True
        return False

# Dialogue System
class DialogueSystem:
    def __init__(self):
        self.active = False
        self.current_dialogue = None
        self.current_index = 0
        self.npc_name = ""
        self.choices = []
        
    def start_dialogue(self, npc_name, dialogue_tree):
        self.active = True
        self.npc_name = npc_name
        self.current_dialogue = dialogue_tree
        self.current_index = 0
        
    def advance_dialogue(self):
        self.current_index += 1
        if self.current_index >= len(self.current_dialogue):
            self.end_dialogue()
    
    def end_dialogue(self):
        self.active = False
        self.current_dialogue = None
        self.current_index = 0
        
    def draw(self, screen):
        if self.active and self.current_dialogue:
            # Draw dialogue box
            pygame.draw.rect(screen, DARK_GRAY, (50, SCREEN_HEIGHT - 150, SCREEN_WIDTH - 100, 120))
            pygame.draw.rect(screen, WHITE, (50, SCREEN_HEIGHT - 150, SCREEN_WIDTH - 100, 120), 2)
            
            # Draw NPC name
            name_text = font_medium.render(self.npc_name, True, YELLOW)
            screen.blit(name_text, (60, SCREEN_HEIGHT - 140))
            
            # Draw dialogue text
            if self.current_index < len(self.current_dialogue):
                dialogue_text = self.current_dialogue[self.current_index]
                text_lines = dialogue_text.split('\n')
                for i, line in enumerate(text_lines):
                    text = font_small.render(line, True, WHITE)
                    screen.blit(text, (60, SCREEN_HEIGHT - 100 + i * 25))

# Combat System
class Enemy:
    def __init__(self, name, hp, damage, exp_reward):
        self.name = name
        self.hp = hp
        self.max_hp = hp
        self.damage = damage
        self.exp_reward = exp_reward
        self.x = random.randint(100, SCREEN_WIDTH - 100)
        self.y = random.randint(100, SCREEN_HEIGHT - 200)
        
    def attack(self, character):
        damage = max(1, self.damage - character.defense // 2)
        if character.defending:
            damage = damage // 2
        character.hp -= damage
        return damage
    
    def draw(self, screen):
        pygame.draw.rect(screen, RED, (self.x - 16, self.y - 16, 32, 32))
        # Draw HP bar
        bar_width = 32
        bar_height = 4
        hp_percentage = self.hp / self.max_hp
        pygame.draw.rect(screen, RED, (self.x - 16, self.y - 24, bar_width, bar_height))
        pygame.draw.rect(screen, GREEN, (self.x - 16, self.y - 24, int(bar_width * hp_percentage), bar_height))

class CombatSystem:
    def __init__(self):
        self.active = False
        self.turn = "player"  # "player" or "enemy"
        self.enemy = None
        self.combat_log = []
        self.action_selected = None
        
    def start_combat(self, enemy):
        self.active = True
        self.enemy = enemy
        self.turn = "player"
        self.combat_log = [f"Battle with {enemy.name} begins!"]
        
    def player_action(self, action, character):
        if action == "attack":
            damage = max(1, character.strength - self.enemy.hp // 10)
            self.enemy.hp -= damage
            self.combat_log.append(f"You deal {damage} damage!")
            
        elif action == "magic" and character.mp >= 10:
            damage = character.magic * 2
            self.enemy.hp -= damage
            character.mp -= 10
            self.combat_log.append(f"Magic attack deals {damage} damage!")
            
        elif action == "defend":
            character.defending = True
            self.combat_log.append("You defend!")
            
        elif action == "flee":
            if random.random() < 0.5:
                self.end_combat(fled=True)
                return
            self.combat_log.append("Couldn't escape!")
        
        # Check if enemy defeated
        if self.enemy.hp <= 0:
            self.end_combat(victory=True, character=character)
        else:
            self.turn = "enemy"
            
    def enemy_turn(self, character):
        damage = self.enemy.attack(character)
        self.combat_log.append(f"{self.enemy.name} deals {damage} damage!")
        character.defending = False
        
        if character.hp <= 0:
            self.end_combat(defeat=True)
        else:
            self.turn = "player"
    
    def end_combat(self, victory=False, defeat=False, fled=False, character=None):
        if victory and character:
            self.combat_log.append(f"Victory! Gained {self.enemy.exp_reward} EXP!")
            character.add_experience(self.enemy.exp_reward)
            character.gold += random.randint(10, 50)
        elif defeat:
            self.combat_log.append("You were defeated...")
        elif fled:
            self.combat_log.append("You fled from battle!")
            
        self.active = False
        self.enemy = None
        
    def draw(self, screen):
        if self.active and self.enemy:
            # Draw combat UI
            pygame.draw.rect(screen, DARK_GRAY, (50, 50, 300, 200))
            pygame.draw.rect(screen, WHITE, (50, 50, 300, 200), 2)
            
            # Draw enemy name and HP
            enemy_text = font_medium.render(self.enemy.name, True, RED)
            screen.blit(enemy_text, (60, 60))
            hp_text = font_small.render(f"HP: {self.enemy.hp}/{self.enemy.max_hp}", True, WHITE)
            screen.blit(hp_text, (60, 95))
            
            # Draw action menu
            if self.turn == "player":
                actions = ["Attack", "Magic", "Defend", "Flee"]
                for i, action in enumerate(actions):
                    color = YELLOW if i == 0 else WHITE
                    action_text = font_small.render(f"{i+1}. {action}", True, color)
                    screen.blit(action_text, (60, 130 + i * 25))
            
            # Draw combat log (last 3 messages)
            for i, message in enumerate(self.combat_log[-3:]):
                log_text = font_small.render(message, True, WHITE)
                screen.blit(log_text, (400, 60 + i * 25))

# Quest System
class Quest:
    def __init__(self, name, description, objectives, reward_exp, reward_gold):
        self.name = name
        self.description = description
        self.objectives = objectives  # List of objectives
        self.completed_objectives = []
        self.is_complete = False
        self.reward_exp = reward_exp
        self.reward_gold = reward_gold
        
    def check_objective(self, objective):
        if objective in self.objectives and objective not in self.completed_objectives:
            self.completed_objectives.append(objective)
            if len(self.completed_objectives) == len(self.objectives):
                self.is_complete = True
            return True
        return False

class QuestLog:
    def __init__(self):
        self.active_quests = []
        self.completed_quests = []
        
    def add_quest(self, quest):
        self.active_quests.append(quest)
        
    def complete_quest(self, quest, character):
        if quest in self.active_quests and quest.is_complete:
            self.active_quests.remove(quest)
            self.completed_quests.append(quest)
            character.add_experience(quest.reward_exp)
            character.gold += quest.reward_gold
            return True
        return False
    
    def draw(self, screen):
        # Draw quest log UI
        pygame.draw.rect(screen, DARK_GRAY, (SCREEN_WIDTH - 250, 50, 200, 300))
        pygame.draw.rect(screen, WHITE, (SCREEN_WIDTH - 250, 50, 200, 300), 2)
        
        title_text = font_medium.render("Quest Log", True, YELLOW)
        screen.blit(title_text, (SCREEN_WIDTH - 240, 60))
        
        y_offset = 100
        for quest in self.active_quests:
            quest_text = font_small.render(quest.name, True, WHITE)
            screen.blit(quest_text, (SCREEN_WIDTH - 240, y_offset))
            
            # Show objectives
            for obj in quest.objectives:
                color = GREEN if obj in quest.completed_objectives else GRAY
                obj_text = font_small.render(f"  • {obj}", True, color)
                screen.blit(obj_text, (SCREEN_WIDTH - 240, y_offset + 20))
                y_offset += 25
            y_offset += 10

# NPC System
class NPC:
    def __init__(self, name, x, y, dialogue, quest=None):
        self.name = name
        self.x = x
        self.y = y
        self.dialogue = dialogue
        self.quest = quest
        self.interacted = False
        
    def interact(self, dialogue_system, quest_log):
        dialogue_system.start_dialogue(self.name, self.dialogue)
        if self.quest and not self.interacted:
            quest_log.add_quest(self.quest)
            self.interacted = True
    
    def draw(self, screen):
        pygame.draw.rect(screen, BLUE, (self.x - 16, self.y - 16, 32, 32))
        # Draw name
        name_text = font_small.render(self.name, True, WHITE)
        screen.blit(name_text, (self.x - 20, self.y - 40))

# Save/Load System
class SaveSystem:
    @staticmethod
    def save_game(character, inventory, quest_log, filename="savegame.json"):
        save_data = {
            "character": {
                "name": character.name,
                "class": character.char_class,
                "level": character.level,
                "experience": character.experience,
                "hp": character.hp,
                "mp": character.mp,
                "gold": character.gold,
                "x": character.x,
                "y": character.y
            },
            "inventory": {
                "items": [{"name": item.name, "type": item.item_type, "quantity": item.quantity} 
                         for item in inventory.items]
            },
            "quests": {
                "active": [quest.name for quest in quest_log.active_quests],
                "completed": [quest.name for quest in quest_log.completed_quests]
            }
        }
        
        try:
            with open(filename, 'w') as f:
                json.dump(save_data, f)
            return True
        except:
            return False
    
    @staticmethod
    def load_game(filename="savegame.json"):
        try:
            with open(filename, 'r') as f:
                save_data = json.load(f)
            return save_data
        except:
            return None

# Initialize game objects
character = Character("Hero", CharacterClass.WARRIOR)
inventory = Inventory()
dialogue_system = DialogueSystem()
combat_system = CombatSystem()
quest_log = QuestLog()

# Add starting items
inventory.add_item(Item("Health Potion", "consumable", 50, "heal"))
inventory.add_item(Item("Mana Potion", "consumable", 30, "mana"))
inventory.add_item(Item("Iron Sword", "weapon", 100))

# Create sample NPCs
npc1 = NPC("Village Elder", 200, 200, 
           ["Welcome, brave adventurer!",
            "Our village needs your help.",
            "Please defeat the monsters threatening us!"],
           Quest("Defeat Monsters", "Defeat 3 monsters", 
                 ["Defeat first monster", "Defeat second monster", "Defeat third monster"],
                 200, 100))

npcs = [npc1]

# Create sample enemies
enemies = []

# Game states
show_inventory = False
show_quest_log = False
show_character_stats = False

# Main game loop
running = True
while running:
    # Handle events
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                running = False
            
            # Combat controls
            elif combat_system.active and combat_system.turn == "player":
                if event.key == pygame.K_1:
                    combat_system.player_action("attack", character)
                elif event.key == pygame.K_2:
                    combat_system.player_action("magic", character)
                elif event.key == pygame.K_3:
                    combat_system.player_action("defend", character)
                elif event.key == pygame.K_4:
                    combat_system.player_action("flee", character)
            
            # Dialogue controls
            elif dialogue_system.active:
                if event.key == pygame.K_SPACE:
                    dialogue_system.advance_dialogue()
            
            # Game controls
            else:
                if event.key == pygame.K_i:
                    show_inventory = not show_inventory
                elif event.key == pygame.K_q:
                    show_quest_log = not show_quest_log
                elif event.key == pygame.K_c:
                    show_character_stats = not show_character_stats
                elif event.key == pygame.K_s:
                    if SaveSystem.save_game(character, inventory, quest_log):
                        print("Game saved!")
                elif event.key == pygame.K_l:
                    save_data = SaveSystem.load_game()
                    if save_data:
                        print("Game loaded!")
                elif event.key == pygame.K_SPACE:
                    # Interact with NPCs
                    for npc in npcs:
                        if abs(character.x - npc.x) < 50 and abs(character.y - npc.y) < 50:
                            npc.interact(dialogue_system, quest_log)
                elif event.key == pygame.K_b:
                    # Spawn enemy for testing
                    if not combat_system.active:
                        enemy = Enemy("Goblin", 50, 10, 50)
                        enemies.append(enemy)
                        combat_system.start_combat(enemy)
    
    # Update
    if not combat_system.active and not dialogue_system.active:
        # Player movement
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            character.x -= character.speed
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            character.x += character.speed
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            character.y -= character.speed
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            character.y += character.speed
        
        # Keep character on screen
        character.x = max(16, min(character.x, SCREEN_WIDTH - 16))
        character.y = max(16, min(character.y, SCREEN_HEIGHT - 16))
    
    # Enemy AI turn
    if combat_system.active and combat_system.turn == "enemy":
        combat_system.enemy_turn(character)
    
    # Clear screen
    screen.fill(BLACK)
    
    # Draw game world
    character.draw(screen)
    
    # Draw NPCs
    for npc in npcs:
        npc.draw(screen)
    
    # Draw enemies
    for enemy in enemies:
        if enemy != combat_system.enemy:
            enemy.draw(screen)
    
    # Draw UI elements
    # HP/MP bars
    pygame.draw.rect(screen, RED, (10, 10, 200, 20))
    pygame.draw.rect(screen, GREEN, (10, 10, int(200 * character.hp / character.max_hp), 20))
    hp_text = font_small.render(f"HP: {character.hp}/{character.max_hp}", True, WHITE)
    screen.blit(hp_text, (15, 12))
    
    pygame.draw.rect(screen, DARK_GRAY, (10, 35, 200, 20))
    pygame.draw.rect(screen, BLUE, (10, 35, int(200 * character.mp / character.max_mp), 20))
    mp_text = font_small.render(f"MP: {character.mp}/{character.max_mp}", True, WHITE)
    screen.blit(mp_text, (15, 37))
    
    # Level and gold
    level_text = font_small.render(f"Level: {character.level}  Gold: {character.gold}", True, YELLOW)
    screen.blit(level_text, (10, 60))
    
    # Draw dialogue
    dialogue_system.draw(screen)
    
    # Draw combat UI
    combat_system.draw(screen)
    
    # Draw inventory
    if show_inventory:
        pygame.draw.rect(screen, DARK_GRAY, (250, 100, 300, 400))
        pygame.draw.rect(screen, WHITE, (250, 100, 300, 400), 2)
        inv_title = font_medium.render("Inventory", True, YELLOW)
        screen.blit(inv_title, (260, 110))
        
        y_offset = 150
        for item in inventory.items:
            item_text = font_small.render(f"{item.name} x{item.quantity}", True, WHITE)
            screen.blit(item_text, (260, y_offset))
            y_offset += 25
    
    # Draw quest log
    if show_quest_log:
        quest_log.draw(screen)
    
    # Draw character stats
    if show_character_stats:
        pygame.draw.rect(screen, DARK_GRAY, (250, 100, 300, 300))
        pygame.draw.rect(screen, WHITE, (250, 100, 300, 300), 2)
        stats_title = font_medium.render("Character Stats", True, YELLOW)
        screen.blit(stats_title, (260, 110))
        
        stats = [
            f"Class: {character.char_class}",
            f"Level: {character.level}",
            f"EXP: {character.experience}/{character.exp_to_next_level}",
            f"STR: {character.strength}",
            f"DEF: {character.defense}",
            f"MAG: {character.magic}",
            f"AGI: {character.agility}"
        ]
        
        y_offset = 150
        for stat in stats:
            stat_text = font_small.render(stat, True, WHITE)
            screen.blit(stat_text, (260, y_offset))
            y_offset += 25
    
    # Draw controls hint
    controls_text = font_small.render("I: Inventory  Q: Quest Log  C: Stats  B: Battle  Space: Interact", True, GRAY)
    screen.blit(controls_text, (10, SCREEN_HEIGHT - 30))
    
    # Update display
    pygame.display.flip()
    clock.tick(FPS)

# Quit
pygame.quit()
sys.exit()
