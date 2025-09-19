// Game Building Blocks - Modular components for creating unique games
// Each component has A/B choices that fundamentally change how the game plays

export interface ComponentChoice {
  component: string;
  choice: 'A' | 'B';
}

export interface ComponentOption {
  title: string;
  description: string;
  features: string[];
  pythonCode: string;
  preview?: string;
}

export interface GameComponent {
  id: string;
  title: string;
  description: string;
  optionA: ComponentOption;
  optionB: ComponentOption;
}

// Define all game components with their Python implementations
export const gameComponents: GameComponent[] = [
  {
    id: 'combat',
    title: 'Combat System',
    description: 'How battles work in your game',
    optionA: {
      title: 'Real-time Combat',
      description: 'Fast-paced action with instant reactions',
      features: ['Health bars', 'Collision damage', 'Cooldown timers', 'Dodge mechanics'],
      pythonCode: `# Real-time Combat System
class CombatSystem:
    def __init__(self):
        self.enemies = []
        self.projectiles = []
        self.damage_cooldown = 0
        
    def add_enemy(self, x, y, health=100):
        enemy = {
            'x': x, 'y': y,
            'health': health,
            'max_health': health,
            'damage': 10,
            'rect': pygame.Rect(x, y, 40, 40)
        }
        self.enemies.append(enemy)
        
    def check_collision_damage(self, player_rect):
        """Check if player touches enemy and return damage amount"""
        if self.damage_cooldown <= 0:
            for enemy in self.enemies:
                if player_rect.colliderect(enemy['rect']):
                    self.damage_cooldown = 60  # 1 second at 60 FPS
                    return enemy['damage']  # Return damage to be applied
        else:
            self.damage_cooldown -= 1
        return 0  # No damage this frame
    
    def fire_projectile(self, x, y, direction):
        """Create a projectile for ranged attacks"""
        projectile = {
            'x': x, 'y': y,
            'vel_x': direction[0] * 10,
            'vel_y': direction[1] * 10,
            'damage': 25,
            'rect': pygame.Rect(x, y, 10, 10)
        }
        self.projectiles.append(projectile)
    
    def update_combat(self, player_rect):
        # Update projectiles
        for projectile in self.projectiles[:]:
            projectile['x'] += projectile['vel_x']
            projectile['y'] += projectile['vel_y']
            projectile['rect'].x = projectile['x']
            projectile['rect'].y = projectile['y']
            
            # Check projectile hits
            for enemy in self.enemies:
                if projectile['rect'].colliderect(enemy['rect']):
                    enemy['health'] -= projectile['damage']
                    if projectile in self.projectiles:
                        self.projectiles.remove(projectile)
                    break
            
            # Remove off-screen projectiles
            if (projectile['x'] < 0 or projectile['x'] > 800 or
                projectile['y'] < 0 or projectile['y'] > 600):
                if projectile in self.projectiles:
                    self.projectiles.remove(projectile)
        
        # Remove defeated enemies
        self.enemies = [e for e in self.enemies if e['health'] > 0]
        
        # Check collision damage (damage is handled elsewhere)
        # Note: Collision detection only, damage applied in main game loop
    
    def draw_combat(self, screen):
        # Draw enemies with health bars
        for enemy in self.enemies:
            # Enemy body
            pygame.draw.rect(screen, (200, 50, 50), enemy['rect'])
            
            # Health bar
            bar_width = 40
            bar_height = 5
            health_percent = enemy['health'] / enemy['max_health']
            pygame.draw.rect(screen, (100, 0, 0), 
                           (enemy['x'], enemy['y'] - 10, bar_width, bar_height))
            pygame.draw.rect(screen, (0, 255, 0),
                           (enemy['x'], enemy['y'] - 10, 
                            bar_width * health_percent, bar_height))
        
        # Draw projectiles
        for projectile in self.projectiles:
            pygame.draw.circle(screen, (255, 255, 0),
                             (int(projectile['x']), int(projectile['y'])), 5)`
    },
    optionB: {
      title: 'Turn-based Combat',
      description: 'Strategic battles with planned moves',
      features: ['Action points', 'Turn order', 'Move selection', 'Strategy planning'],
      pythonCode: `# Turn-based Combat System
class CombatSystem:
    def __init__(self):
        self.enemies = []
        self.turn_order = []
        self.current_turn = 0
        self.player_actions = []
        self.action_points = 3
        self.combat_active = False
        
    def add_enemy(self, name, health=100, speed=5):
        enemy = {
            'name': name,
            'health': health,
            'max_health': health,
            'speed': speed,
            'attack': 20,
            'defense': 5,
            'is_player': False
        }
        self.enemies.append(enemy)
        
    def start_combat(self, player):
        """Initialize combat encounter"""
        self.combat_active = True
        # Create turn order based on speed
        all_units = [player] + self.enemies
        self.turn_order = sorted(all_units, 
                                key=lambda x: x.get('speed', 5), 
                                reverse=True)
        self.current_turn = 0
        self.action_points = 3
        
    def get_current_unit(self):
        """Get whose turn it is"""
        if self.turn_order:
            return self.turn_order[self.current_turn % len(self.turn_order)]
        return None
        
    def execute_action(self, action_type, source, target):
        """Execute a combat action"""
        if action_type == 'attack':
            damage = max(1, source['attack'] - target.get('defense', 0))
            target['health'] -= damage
            return f"{source.get('name', 'Player')} deals {damage} damage!"
            
        elif action_type == 'defend':
            source['defense'] = source.get('defense', 5) + 10
            return f"{source.get('name', 'Player')} raises defense!"
            
        elif action_type == 'heal':
            heal_amount = 30
            source['health'] = min(source['max_health'], 
                                  source['health'] + heal_amount)
            return f"{source.get('name', 'Player')} heals {heal_amount} HP!"
        
        return "Unknown action"
    
    def enemy_turn(self, enemy, player):
        """AI for enemy turns"""
        # Simple AI: attack if healthy, heal if low
        if enemy['health'] < enemy['max_health'] * 0.3:
            return self.execute_action('heal', enemy, enemy)
        else:
            return self.execute_action('attack', enemy, player)
    
    def next_turn(self):
        """Move to next turn"""
        self.current_turn += 1
        current = self.get_current_unit()
        
        if current and current.get('is_player', True):
            self.action_points = 3
        
        # Remove defeated enemies
        self.enemies = [e for e in self.enemies if e['health'] > 0]
        self.turn_order = [u for u in self.turn_order if u['health'] > 0]
        
        # Check if combat is over
        if not self.enemies:
            self.combat_active = False
            return "Victory!"
        elif not any(u.get('is_player', True) for u in self.turn_order):
            self.combat_active = False
            return "Defeat!"
            
        return None
    
    def update_combat(self, player_rect):
        """Update turn-based combat system"""
        if not self.combat_active:
            # Check if should start combat (example: player near enemy)
            for enemy in self.enemies:
                enemy_rect = pygame.Rect(enemy.get('x', 0), enemy.get('y', 0), 40, 40)
                if player_rect.colliderect(enemy_rect):
                    # Mock player data for turn-based combat
                    player = {
                        'name': 'Player',
                        'health': 100,
                        'max_health': 100,
                        'speed': 10,
                        'attack': 25,
                        'defense': 10,
                        'is_player': True
                    }
                    self.start_combat(player)
                    break
        else:
            # Handle ongoing combat
            current = self.get_current_unit()
            if current and not current.get('is_player', True):
                # AI turn - automatically execute
                player = next((u for u in self.turn_order if u.get('is_player', True)), None)
                if player:
                    self.enemy_turn(current, player)
                    self.next_turn()
    
    def draw_combat(self, screen):
        """Draw turn-based combat interface"""
        if not self.combat_active:
            return
            
        # Create font for drawing
        font = pygame.font.Font(None, 24)
            
        # Draw turn order
        y_offset = 20
        for i, unit in enumerate(self.turn_order):
            color = (255, 255, 0) if i == self.current_turn % len(self.turn_order) else (200, 200, 200)
            name = unit.get('name', 'Player')
            health = unit['health']
            max_health = unit['max_health']
            
            text = font.render(f"{name}: {health}/{max_health} HP", True, color)
            screen.blit(text, (600, y_offset))
            y_offset += 30
        
        # Draw action points
        current = self.get_current_unit()
        if current and current.get('is_player', True):
            ap_text = font.render(f"Action Points: {self.action_points}", True, (255, 255, 255))
            screen.blit(ap_text, (20, 500))
            
            # Draw action menu
            actions = ['Attack (1 AP)', 'Defend (1 AP)', 'Heal (2 AP)', 'End Turn']
            for i, action in enumerate(actions):
                color = (255, 255, 255) if i < 3 and self.action_points > 0 else (100, 100, 100)
                action_text = font.render(f"{i+1}. {action}", True, color)
                screen.blit(action_text, (20, 530 + i * 25))`
    }
  },
  
  {
    id: 'inventory',
    title: 'Inventory System',
    description: 'How players manage items and equipment',
    optionA: {
      title: 'Grid-based Inventory',
      description: 'Visual grid with drag-and-drop functionality',
      features: ['Limited slots', 'Item stacking', 'Visual organization', 'Quick slots'],
      pythonCode: `# Grid-based Inventory System
class InventorySystem:
    def __init__(self, rows=5, cols=8):
        self.rows = rows
        self.cols = cols
        self.grid = [[None for _ in range(cols)] for _ in range(rows)]
        self.selected_item = None
        self.quick_slots = [None] * 5  # 5 quick access slots
        
    def add_item(self, item):
        """Add item to first available slot"""
        # Check if item can stack with existing
        if item.get('stackable', False):
            for row in range(self.rows):
                for col in range(self.cols):
                    slot = self.grid[row][col]
                    if slot and slot['id'] == item['id']:
                        if slot['quantity'] < slot.get('max_stack', 99):
                            slot['quantity'] += 1
                            return True
        
        # Find empty slot
        for row in range(self.rows):
            for col in range(self.cols):
                if self.grid[row][col] is None:
                    self.grid[row][col] = {
                        'id': item['id'],
                        'name': item['name'],
                        'icon': item.get('icon', '?'),
                        'quantity': 1,
                        'stackable': item.get('stackable', False),
                        'max_stack': item.get('max_stack', 99),
                        'type': item.get('type', 'misc')
                    }
                    return True
        return False  # Inventory full
    
    def remove_item(self, row, col):
        """Remove item from specific slot"""
        if 0 <= row < self.rows and 0 <= col < self.cols:
            item = self.grid[row][col]
            if item:
                if item.get('quantity', 1) > 1:
                    item['quantity'] -= 1
                else:
                    self.grid[row][col] = None
                return item
        return None
    
    def move_item(self, from_pos, to_pos):
        """Move item between slots"""
        from_row, from_col = from_pos
        to_row, to_col = to_pos
        
        # Validate positions
        if not (0 <= from_row < self.rows and 0 <= from_col < self.cols):
            return False
        if not (0 <= to_row < self.rows and 0 <= to_col < self.cols):
            return False
            
        # Swap items
        self.grid[to_row][to_col], self.grid[from_row][from_col] = \
            self.grid[from_row][from_col], self.grid[to_row][to_col]
        return True
    
    def set_quick_slot(self, slot_index, row, col):
        """Assign item to quick access slot"""
        if 0 <= slot_index < len(self.quick_slots):
            if 0 <= row < self.rows and 0 <= col < self.cols:
                self.quick_slots[slot_index] = (row, col)
                return True
        return False
    
    def use_quick_slot(self, slot_index):
        """Use item from quick slot"""
        if 0 <= slot_index < len(self.quick_slots):
            if self.quick_slots[slot_index]:
                row, col = self.quick_slots[slot_index]
                return self.grid[row][col]
        return None
    
    def draw_inventory(self, screen, x, y, cell_size=40):
        """Draw inventory grid"""
        # Draw grid background
        width = self.cols * cell_size
        height = self.rows * cell_size
        pygame.draw.rect(screen, (50, 50, 50), (x, y, width, height))
        
        # Draw grid cells and items
        for row in range(self.rows):
            for col in range(self.cols):
                cell_x = x + col * cell_size
                cell_y = y + row * cell_size
                
                # Draw cell border
                pygame.draw.rect(screen, (100, 100, 100), 
                               (cell_x, cell_y, cell_size, cell_size), 2)
                
                # Draw item if present
                item = self.grid[row][col]
                if item:
                    # Draw item icon/text
                    font = pygame.font.Font(None, 24)
                    text = font.render(item['icon'], True, (255, 255, 255))
                    text_rect = text.get_rect(center=(cell_x + cell_size//2, 
                                                     cell_y + cell_size//2))
                    screen.blit(text, text_rect)
                    
                    # Draw quantity if stackable
                    if item.get('quantity', 1) > 1:
                        qty_font = pygame.font.Font(None, 16)
                        qty_text = qty_font.render(str(item['quantity']), 
                                                  True, (255, 255, 0))
                        screen.blit(qty_text, (cell_x + 2, cell_y + 2))
        
        # Draw quick slots
        quick_y = y + height + 10
        for i, slot in enumerate(self.quick_slots):
            slot_x = x + i * (cell_size + 5)
            pygame.draw.rect(screen, (80, 80, 80),
                           (slot_x, quick_y, cell_size, cell_size))
            pygame.draw.rect(screen, (150, 150, 0),
                           (slot_x, quick_y, cell_size, cell_size), 2)
            
            # Draw quick slot number
            font = pygame.font.Font(None, 16)
            num_text = font.render(str(i+1), True, (255, 255, 255))
            screen.blit(num_text, (slot_x + 2, quick_y + 2))
            
            # Draw item in quick slot
            if slot:
                row, col = slot
                item = self.grid[row][col]
                if item:
                    icon_font = pygame.font.Font(None, 20)
                    icon_text = icon_font.render(item['icon'], True, (255, 255, 255))
                    icon_rect = icon_text.get_rect(center=(slot_x + cell_size//2,
                                                          quick_y + cell_size//2))
                    screen.blit(icon_text, icon_rect)`
    },
    optionB: {
      title: 'List-based Inventory',
      description: 'Organized categories with unlimited storage',
      features: ['Item categories', 'Unlimited items', 'Search & filter', 'Auto-sorting'],
      pythonCode: `# List-based Inventory System  
class InventorySystem:
    def __init__(self):
        self.items = []
        self.categories = {
            'weapons': [],
            'armor': [],
            'consumables': [],
            'materials': [],
            'quest': [],
            'misc': []
        }
        self.quick_bar = []  # Quick access items
        self.max_quick_bar = 8
        self.current_category = 'all'
        self.sort_by = 'name'  # name, quantity, type
        
    def add_item(self, item):
        """Add item to inventory"""
        # Check if item already exists
        existing = next((i for i in self.items if i['id'] == item['id']), None)
        
        if existing and existing.get('stackable', False):
            existing['quantity'] += item.get('quantity', 1)
        else:
            new_item = {
                'id': item['id'],
                'name': item['name'],
                'category': item.get('category', 'misc'),
                'quantity': item.get('quantity', 1),
                'stackable': item.get('stackable', False),
                'description': item.get('description', ''),
                'value': item.get('value', 0),
                'icon': item.get('icon', '?')
            }
            self.items.append(new_item)
            
            # Add to category list
            category = new_item['category']
            if category in self.categories:
                self.categories[category].append(new_item)
        
        # Auto-sort after adding
        self.sort_inventory()
        return True
    
    def remove_item(self, item_id, quantity=1):
        """Remove item from inventory"""
        item = next((i for i in self.items if i['id'] == item_id), None)
        
        if item:
            if item.get('quantity', 1) > quantity:
                item['quantity'] -= quantity
            else:
                self.items.remove(item)
                # Remove from category
                category = item.get('category', 'misc')
                if category in self.categories and item in self.categories[category]:
                    self.categories[category].remove(item)
                # Remove from quick bar if present
                if item in self.quick_bar:
                    self.quick_bar.remove(item)
            return True
        return False
    
    def get_items_by_category(self, category):
        """Get all items in a category"""
        if category == 'all':
            return self.items
        return self.categories.get(category, [])
    
    def search_items(self, search_term):
        """Search items by name or description"""
        search_term = search_term.lower()
        return [item for item in self.items 
                if search_term in item['name'].lower() or 
                   search_term in item.get('description', '').lower()]
    
    def sort_inventory(self):
        """Sort inventory by current sort method"""
        if self.sort_by == 'name':
            self.items.sort(key=lambda x: x['name'])
        elif self.sort_by == 'quantity':
            self.items.sort(key=lambda x: x.get('quantity', 1), reverse=True)
        elif self.sort_by == 'type':
            self.items.sort(key=lambda x: x.get('category', 'misc'))
        elif self.sort_by == 'value':
            self.items.sort(key=lambda x: x.get('value', 0), reverse=True)
    
    def add_to_quick_bar(self, item_id):
        """Add item to quick access bar"""
        if len(self.quick_bar) < self.max_quick_bar:
            item = next((i for i in self.items if i['id'] == item_id), None)
            if item and item not in self.quick_bar:
                self.quick_bar.append(item)
                return True
        return False
    
    def use_quick_bar_item(self, index):
        """Use item from quick bar"""
        if 0 <= index < len(self.quick_bar):
            return self.quick_bar[index]
        return None
    
    def get_total_value(self):
        """Calculate total inventory value"""
        return sum(item.get('value', 0) * item.get('quantity', 1) 
                  for item in self.items)
    
    def draw_inventory_list(self, screen, x, y, width=300, height=400):
        """Draw list-based inventory"""
        # Draw background
        pygame.draw.rect(screen, (40, 40, 40), (x, y, width, height))
        pygame.draw.rect(screen, (100, 100, 100), (x, y, width, height), 2)
        
        # Draw category tabs
        categories = ['all'] + list(self.categories.keys())
        tab_width = width // len(categories)
        font = pygame.font.Font(None, 16)
        
        for i, cat in enumerate(categories):
            tab_x = x + i * tab_width
            tab_color = (80, 80, 80) if cat == self.current_category else (60, 60, 60)
            pygame.draw.rect(screen, tab_color, (tab_x, y, tab_width, 25))
            pygame.draw.rect(screen, (100, 100, 100), (tab_x, y, tab_width, 25), 1)
            
            text = font.render(cat.capitalize()[:5], True, (255, 255, 255))
            text_rect = text.get_rect(center=(tab_x + tab_width//2, y + 12))
            screen.blit(text, text_rect)
        
        # Draw item list
        items_to_show = self.get_items_by_category(self.current_category)
        item_y = y + 30
        item_height = 30
        max_items = (height - 30) // item_height
        
        item_font = pygame.font.Font(None, 18)
        for i, item in enumerate(items_to_show[:max_items]):
            # Alternating row colors
            row_color = (50, 50, 50) if i % 2 == 0 else (45, 45, 45)
            pygame.draw.rect(screen, row_color, 
                           (x + 5, item_y, width - 10, item_height - 2))
            
            # Draw item icon
            icon_text = item_font.render(item['icon'], True, (255, 255, 255))
            screen.blit(icon_text, (x + 10, item_y + 5))
            
            # Draw item name
            name = item['name'][:20]  # Truncate long names
            name_text = item_font.render(name, True, (255, 255, 255))
            screen.blit(name_text, (x + 35, item_y + 5))
            
            # Draw quantity
            if item.get('quantity', 1) > 1:
                qty_text = item_font.render(f"x{item['quantity']}", 
                                           True, (255, 255, 0))
                screen.blit(qty_text, (x + width - 50, item_y + 5))
            
            item_y += item_height
        
        # Draw quick bar
        quick_y = y + height + 10
        for i in range(self.max_quick_bar):
            slot_x = x + i * 35
            slot_color = (60, 60, 60)
            pygame.draw.rect(screen, slot_color, (slot_x, quick_y, 32, 32))
            pygame.draw.rect(screen, (150, 150, 0), (slot_x, quick_y, 32, 32), 2)
            
            # Draw slot number
            num_text = font.render(str(i+1), True, (200, 200, 200))
            screen.blit(num_text, (slot_x + 2, quick_y + 2))
            
            # Draw item in slot
            if i < len(self.quick_bar):
                item = self.quick_bar[i]
                icon_text = item_font.render(item['icon'], True, (255, 255, 255))
                icon_rect = icon_text.get_rect(center=(slot_x + 16, quick_y + 16))
                screen.blit(icon_text, icon_rect)`
    }
  },
  
  {
    id: 'movement',
    title: 'Movement System',
    description: 'How characters move around the game world',
    optionA: {
      title: 'Smooth Movement',
      description: 'Physics-based movement with acceleration',
      features: ['Velocity & acceleration', 'Smooth animations', 'Momentum', 'Air control'],
      pythonCode: `# Smooth Movement System
class MovementSystem:
    def __init__(self, entity):
        self.entity = entity
        self.velocity = pygame.Vector2(0, 0)
        self.acceleration = pygame.Vector2(0, 0)
        self.position = pygame.Vector2(entity.x, entity.y)
        
        # Movement parameters
        self.max_speed = 5
        self.acceleration_rate = 0.5
        self.friction = 0.9
        self.air_friction = 0.95
        self.jump_power = -12
        self.gravity = 0.5
        self.max_fall_speed = 15
        
        # State tracking
        self.on_ground = False
        self.facing_right = True
        self.is_jumping = False
        self.double_jump_available = True
        
    def apply_force(self, force_x, force_y):
        """Apply external force to entity"""
        self.acceleration.x += force_x
        self.acceleration.y += force_y
    
    def handle_input(self):
        """Process movement input"""
        keys = pygame.key.get_pressed()
        
        # Horizontal movement
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            self.acceleration.x = -self.acceleration_rate
            self.facing_right = False
        elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            self.acceleration.x = self.acceleration_rate
            self.facing_right = True
        else:
            # Apply friction when no input
            self.acceleration.x = 0
            if self.on_ground:
                self.velocity.x *= self.friction
            else:
                self.velocity.x *= self.air_friction
        
        # Jumping
        if keys[pygame.K_SPACE] or keys[pygame.K_w]:
            if self.on_ground:
                self.jump()
            elif self.double_jump_available and not self.on_ground:
                self.double_jump()
    
    def jump(self):
        """Perform a jump"""
        self.velocity.y = self.jump_power
        self.is_jumping = True
        self.on_ground = False
        self.double_jump_available = True
    
    def double_jump(self):
        """Perform a double jump"""
        self.velocity.y = self.jump_power * 0.8  # Slightly weaker
        self.double_jump_available = False
    
    def apply_gravity(self):
        """Apply gravity to vertical movement"""
        if not self.on_ground:
            self.velocity.y += self.gravity
            # Terminal velocity
            if self.velocity.y > self.max_fall_speed:
                self.velocity.y = self.max_fall_speed
    
    def update_position(self, platforms=[]):
        """Update position based on velocity"""
        # Apply acceleration to velocity
        self.velocity += self.acceleration
        
        # Limit horizontal speed
        if abs(self.velocity.x) > self.max_speed:
            self.velocity.x = self.max_speed if self.velocity.x > 0 else -self.max_speed
        
        # Apply gravity
        self.apply_gravity()
        
        # Update position
        self.position += self.velocity
        
        # Check ground collision
        self.check_platform_collision(platforms)
        
        # Update entity position
        self.entity.x = int(self.position.x)
        self.entity.y = int(self.position.y)
        
        # Reset acceleration for next frame
        self.acceleration = pygame.Vector2(0, 0)
    
    def check_platform_collision(self, platforms):
        """Check collision with platforms"""
        entity_rect = pygame.Rect(self.position.x, self.position.y, 
                                 self.entity.width, self.entity.height)
        
        self.on_ground = False
        
        for platform in platforms:
            if entity_rect.colliderect(platform):
                # Landing on top of platform
                if self.velocity.y > 0 and self.position.y < platform.centery:
                    self.position.y = platform.top - self.entity.height
                    self.velocity.y = 0
                    self.on_ground = True
                    self.double_jump_available = True
                    self.is_jumping = False
                
                # Hitting bottom of platform
                elif self.velocity.y < 0 and self.position.y > platform.centery:
                    self.position.y = platform.bottom
                    self.velocity.y = 0
                
                # Side collisions
                else:
                    if self.velocity.x > 0:  # Moving right
                        self.position.x = platform.left - self.entity.width
                    elif self.velocity.x < 0:  # Moving left
                        self.position.x = platform.right
                    self.velocity.x = 0
    
    def dash(self, direction):
        """Perform a dash move"""
        dash_power = 15
        if direction == 'right':
            self.velocity.x = dash_power
        elif direction == 'left':
            self.velocity.x = -dash_power
        elif direction == 'up':
            self.velocity.y = -dash_power
        elif direction == 'down' and not self.on_ground:
            self.velocity.y = dash_power
    
    def get_movement_state(self):
        """Get current movement state for animation"""
        if not self.on_ground:
            if self.velocity.y < 0:
                return 'jumping'
            else:
                return 'falling'
        elif abs(self.velocity.x) > 0.5:
            return 'running'
        else:
            return 'idle'
    
    def draw_debug_info(self, screen, font):
        """Draw movement debug information"""
        debug_info = [
            f"Pos: ({int(self.position.x)}, {int(self.position.y)})",
            f"Vel: ({self.velocity.x:.1f}, {self.velocity.y:.1f})",
            f"On Ground: {self.on_ground}",
            f"State: {self.get_movement_state()}",
            f"Facing: {'Right' if self.facing_right else 'Left'}"
        ]
        
        y_offset = 10
        for info in debug_info:
            text = font.render(info, True, (255, 255, 255))
            screen.blit(text, (10, y_offset))
            y_offset += 20`
    },
    optionB: {
      title: 'Grid Movement',
      description: 'Tile-based movement like classic RPGs',
      features: ['Tile snapping', 'Cardinal directions', 'Instant movement', 'Grid pathfinding'],
      pythonCode: `# Grid Movement System
class MovementSystem:
    def __init__(self, entity, tile_size=32):
        self.entity = entity
        self.tile_size = tile_size
        self.grid_x = entity.x // tile_size
        self.grid_y = entity.y // tile_size
        
        # Movement parameters
        self.move_speed = 4  # Tiles per second
        self.move_cooldown = 0
        self.move_delay = 15  # Frames between moves
        
        # Animation
        self.is_moving = False
        self.move_progress = 0
        self.move_from = (self.grid_x, self.grid_y)
        self.move_to = (self.grid_x, self.grid_y)
        self.facing = 'down'  # up, down, left, right
        
        # Grid tracking
        self.blocked_tiles = set()
        self.interactive_tiles = {}
        
    def set_grid_position(self, grid_x, grid_y):
        """Set position on grid"""
        self.grid_x = grid_x
        self.grid_y = grid_y
        self.entity.x = grid_x * self.tile_size
        self.entity.y = grid_y * self.tile_size
    
    def add_blocked_tile(self, grid_x, grid_y):
        """Mark a tile as blocked"""
        self.blocked_tiles.add((grid_x, grid_y))
    
    def add_interactive_tile(self, grid_x, grid_y, interaction):
        """Add an interactive tile (door, chest, etc)"""
        self.interactive_tiles[(grid_x, grid_y)] = interaction
    
    def can_move_to(self, grid_x, grid_y):
        """Check if tile is walkable"""
        # Check bounds (example map size)
        if grid_x < 0 or grid_x >= 25 or grid_y < 0 or grid_y >= 19:
            return False
        
        # Check if tile is blocked
        if (grid_x, grid_y) in self.blocked_tiles:
            return False
        
        return True
    
    def handle_input(self):
        """Process grid movement input"""
        if self.is_moving or self.move_cooldown > 0:
            return
        
        keys = pygame.key.get_pressed()
        new_x, new_y = self.grid_x, self.grid_y
        
        # Determine movement direction
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            new_y -= 1
            self.facing = 'up'
        elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
            new_y += 1
            self.facing = 'down'
        elif keys[pygame.K_LEFT] or keys[pygame.K_a]:
            new_x -= 1
            self.facing = 'left'
        elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            new_x += 1
            self.facing = 'right'
        else:
            return
        
        # Try to move
        if self.can_move_to(new_x, new_y):
            self.start_move(new_x, new_y)
        else:
            # Just change facing direction if blocked
            self.move_cooldown = self.move_delay // 2
    
    def start_move(self, target_x, target_y):
        """Begin movement to target tile"""
        self.is_moving = True
        self.move_progress = 0
        self.move_from = (self.grid_x, self.grid_y)
        self.move_to = (target_x, target_y)
    
    def update_position(self, platforms=None):
        """Update smooth movement between tiles
        
        Args:
            platforms: List of platform rectangles (unused in grid movement)
        """
        if self.move_cooldown > 0:
            self.move_cooldown -= 1
        
        if self.is_moving:
            # Smooth movement animation
            self.move_progress += 1.0 / self.move_delay
            
            if self.move_progress >= 1.0:
                # Movement complete
                self.grid_x = self.move_to[0]
                self.grid_y = self.move_to[1]
                self.entity.x = self.grid_x * self.tile_size
                self.entity.y = self.grid_y * self.tile_size
                
                self.is_moving = False
                self.move_cooldown = self.move_delay
                
                # Check for tile interactions
                self.check_tile_interaction()
            else:
                # Interpolate position
                from_x = self.move_from[0] * self.tile_size
                from_y = self.move_from[1] * self.tile_size
                to_x = self.move_to[0] * self.tile_size
                to_y = self.move_to[1] * self.tile_size
                
                # Smooth easing
                t = self.ease_in_out(self.move_progress)
                self.entity.x = int(from_x + (to_x - from_x) * t)
                self.entity.y = int(from_y + (to_y - from_y) * t)
    
    def ease_in_out(self, t):
        """Smooth easing function for movement"""
        if t < 0.5:
            return 2 * t * t
        return -1 + (4 - 2 * t) * t
    
    def check_tile_interaction(self):
        """Check if current tile has interaction"""
        current_tile = (self.grid_x, self.grid_y)
        if current_tile in self.interactive_tiles:
            interaction = self.interactive_tiles[current_tile]
            return interaction
        return None
    
    def find_path(self, target_x, target_y):
        """Simple A* pathfinding to target"""
        from queue import PriorityQueue
        
        start = (self.grid_x, self.grid_y)
        goal = (target_x, target_y)
        
        frontier = PriorityQueue()
        frontier.put((0, start))
        came_from = {start: None}
        cost_so_far = {start: 0}
        
        while not frontier.empty():
            current = frontier.get()[1]
            
            if current == goal:
                break
            
            # Check all 4 directions
            for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                next_pos = (current[0] + dx, current[1] + dy)
                
                if not self.can_move_to(next_pos[0], next_pos[1]):
                    continue
                
                new_cost = cost_so_far[current] + 1
                
                if next_pos not in cost_so_far or new_cost < cost_so_far[next_pos]:
                    cost_so_far[next_pos] = new_cost
                    priority = new_cost + self.heuristic(goal, next_pos)
                    frontier.put((priority, next_pos))
                    came_from[next_pos] = current
        
        # Reconstruct path
        if goal not in came_from:
            return []  # No path found
        
        path = []
        current = goal
        while current != start:
            path.append(current)
            current = came_from[current]
        path.reverse()
        return path
    
    def heuristic(self, a, b):
        """Manhattan distance heuristic"""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])
    
    def draw_grid(self, screen, camera_x=0, camera_y=0):
        """Draw grid lines for debugging"""
        # Draw grid
        for x in range(0, 800, self.tile_size):
            pygame.draw.line(screen, (50, 50, 50), 
                           (x - camera_x, 0), 
                           (x - camera_x, 600), 1)
        for y in range(0, 600, self.tile_size):
            pygame.draw.line(screen, (50, 50, 50), 
                           (0, y - camera_y), 
                           (800, y - camera_y), 1)
        
        # Draw blocked tiles
        for (bx, by) in self.blocked_tiles:
            rect = pygame.Rect(bx * self.tile_size - camera_x,
                              by * self.tile_size - camera_y,
                              self.tile_size, self.tile_size)
            pygame.draw.rect(screen, (100, 0, 0), rect, 2)
        
        # Draw interactive tiles
        for (ix, iy) in self.interactive_tiles:
            rect = pygame.Rect(ix * self.tile_size - camera_x,
                              iy * self.tile_size - camera_y,
                              self.tile_size, self.tile_size)
            pygame.draw.rect(screen, (0, 100, 200), rect, 2)`
    }
  },
  
  {
    id: 'progression',
    title: 'Character Progression',
    description: 'How players become stronger over time',
    optionA: {
      title: 'Level-based System',
      description: 'Traditional XP and level ups with skill trees',
      features: ['Experience points', 'Level ups', 'Skill trees', 'Stat growth'],
      pythonCode: `# Level-based Progression System
class ProgressionSystem:
    def __init__(self, player):
        self.player = player
        
        # Core stats
        self.level = 1
        self.experience = 0
        self.exp_to_next_level = 100
        self.skill_points = 0
        
        # Player stats
        self.stats = {
            'max_health': 100,
            'max_mana': 50,
            'strength': 10,
            'defense': 5,
            'speed': 5,
            'intelligence': 5
        }
        
        # Skill tree
        self.skills = {
            'combat': {
                'power_strike': {'level': 0, 'max': 5, 'cost': 1, 
                               'effect': 'Damage +20% per level'},
                'defensive_stance': {'level': 0, 'max': 3, 'cost': 1,
                                   'effect': 'Defense +15% per level'},
                'berserker': {'level': 0, 'max': 1, 'cost': 3,
                            'effect': 'Double damage, half defense'}
            },
            'magic': {
                'fireball': {'level': 0, 'max': 5, 'cost': 1,
                           'effect': 'Fire damage spell'},
                'heal': {'level': 0, 'max': 3, 'cost': 1,
                       'effect': 'Restore health'},
                'teleport': {'level': 0, 'max': 1, 'cost': 2,
                           'effect': 'Instant movement'}
            },
            'utility': {
                'sprint': {'level': 0, 'max': 3, 'cost': 1,
                         'effect': 'Speed +25% per level'},
                'treasure_hunter': {'level': 0, 'max': 5, 'cost': 1,
                                  'effect': 'Better loot chance'},
                'regeneration': {'level': 0, 'max': 3, 'cost': 2,
                               'effect': 'Passive health regen'}
            }
        }
        
        # Achievements/milestones
        self.achievements = []
        self.total_enemies_defeated = 0
        self.total_damage_dealt = 0
        
    def gain_experience(self, amount):
        """Add experience points"""
        self.experience += amount
        level_ups = 0
        
        # Check for level up
        while self.experience >= self.exp_to_next_level:
            self.experience -= self.exp_to_next_level
            self.level_up()
            level_ups += 1
        
        return level_ups
    
    def level_up(self):
        """Handle level up"""
        self.level += 1
        self.skill_points += 2  # Grant skill points
        
        # Increase exp requirement (exponential growth)
        self.exp_to_next_level = int(100 * (1.5 ** (self.level - 1)))
        
        # Boost base stats
        self.stats['max_health'] += 20
        self.stats['max_mana'] += 10
        self.stats['strength'] += 2
        self.stats['defense'] += 1
        self.stats['speed'] += 1
        self.stats['intelligence'] += 1
        
        # Restore health/mana on level up
        self.player.health = self.stats['max_health']
        self.player.mana = self.stats['max_mana']
        
        # Check for milestone achievements
        self.check_achievements()
        
        return f"Level Up! Now level {self.level}"
    
    def learn_skill(self, category, skill_name):
        """Learn or upgrade a skill"""
        if category not in self.skills:
            return False
        
        skill = self.skills[category].get(skill_name)
        if not skill:
            return False
        
        # Check if can learn
        if skill['level'] >= skill['max']:
            return False  # Max level reached
        
        if self.skill_points < skill['cost']:
            return False  # Not enough points
        
        # Learn the skill
        skill['level'] += 1
        self.skill_points -= skill['cost']
        
        # Apply skill effects
        self.apply_skill_effects(category, skill_name)
        return True
    
    def apply_skill_effects(self, category, skill_name):
        """Apply passive skill effects"""
        skill = self.skills[category][skill_name]
        level = skill['level']
        
        if category == 'combat':
            if skill_name == 'power_strike':
                self.player.damage_multiplier = 1 + (0.2 * level)
            elif skill_name == 'defensive_stance':
                self.stats['defense'] = int(self.stats['defense'] * (1 + 0.15 * level))
        
        elif category == 'utility':
            if skill_name == 'sprint':
                self.stats['speed'] = int(self.stats['speed'] * (1 + 0.25 * level))
            elif skill_name == 'regeneration':
                self.player.regen_rate = 2 * level  # HP per second
    
    def get_skill_damage(self, skill_name):
        """Calculate damage for active skills"""
        base_damages = {
            'fireball': 50,
            'power_strike': 30
        }
        
        base = base_damages.get(skill_name, 0)
        
        # Find skill level
        for category in self.skills:
            if skill_name in self.skills[category]:
                level = self.skills[category][skill_name]['level']
                return int(base * (1 + 0.3 * level))
        
        return base
    
    def check_achievements(self):
        """Check and unlock achievements"""
        new_achievements = []
        
        if self.level >= 10 and 'Decimator' not in self.achievements:
            self.achievements.append('Decimator')
            new_achievements.append('Decimator: Reached level 10!')
            self.skill_points += 3  # Bonus points
        
        if self.level >= 25 and 'Quarter Master' not in self.achievements:
            self.achievements.append('Quarter Master')
            new_achievements.append('Quarter Master: Reached level 25!')
            self.stats['max_health'] += 100  # Bonus health
        
        if self.total_enemies_defeated >= 100 and 'Centurion' not in self.achievements:
            self.achievements.append('Centurion')
            new_achievements.append('Centurion: Defeated 100 enemies!')
        
        return new_achievements
    
    def get_exp_percentage(self):
        """Get progress to next level as percentage"""
        return (self.experience / self.exp_to_next_level) * 100
    
    def draw_level_ui(self, screen, x, y):
        """Draw level and XP bar"""
        font = pygame.font.Font(None, 24)
        small_font = pygame.font.Font(None, 18)
        
        # Draw level
        level_text = font.render(f"Level {self.level}", True, (255, 255, 255))
        screen.blit(level_text, (x, y))
        
        # Draw XP bar
        bar_width = 200
        bar_height = 20
        bar_x = x
        bar_y = y + 25
        
        # Background
        pygame.draw.rect(screen, (50, 50, 50), 
                       (bar_x, bar_y, bar_width, bar_height))
        
        # Fill based on XP
        fill_width = int(bar_width * (self.experience / self.exp_to_next_level))
        pygame.draw.rect(screen, (100, 200, 100),
                       (bar_x, bar_y, fill_width, bar_height))
        
        # Border
        pygame.draw.rect(screen, (150, 150, 150),
                       (bar_x, bar_y, bar_width, bar_height), 2)
        
        # XP text
        xp_text = small_font.render(f"{self.experience}/{self.exp_to_next_level} XP",
                                   True, (255, 255, 255))
        text_rect = xp_text.get_rect(center=(bar_x + bar_width//2, 
                                            bar_y + bar_height//2))
        screen.blit(xp_text, text_rect)
        
        # Skill points
        if self.skill_points > 0:
            sp_text = font.render(f"Skill Points: {self.skill_points}",
                                True, (255, 255, 0))
            screen.blit(sp_text, (x, bar_y + bar_height + 5))`
    },
    optionB: {
      title: 'Item-based Progression',
      description: 'Power through equipment and collectibles',
      features: ['Equipment tiers', 'Power-ups', 'Collectible upgrades', 'No level cap'],
      pythonCode: `# Item-based Progression System
class ProgressionSystem:
    def __init__(self, player):
        self.player = player
        
        # Equipment slots
        self.equipment = {
            'weapon': None,
            'armor': None,
            'accessory1': None,
            'accessory2': None,
            'special': None
        }
        
        # Collected permanent upgrades
        self.power_ups = {
            'health_crystals': 0,  # Each adds +20 max HP
            'mana_crystals': 0,    # Each adds +10 max mana
            'speed_boots': 0,      # Each adds +1 speed
            'power_gems': 0,       # Each adds +5 damage
            'shield_fragments': 0  # Each adds +2 defense
        }
        
        # Temporary buffs from consumables
        self.active_buffs = []
        
        # Collection tracking
        self.total_items_collected = 0
        self.legendary_items = []
        self.set_bonuses = {}
        
    def equip_item(self, item, slot=None):
        """Equip an item"""
        # Auto-detect slot if not specified
        if not slot:
            slot = item.get('slot', 'accessory1')
        
        if slot not in self.equipment:
            return False
        
        # Unequip current item
        old_item = self.equipment[slot]
        if old_item:
            self.remove_item_stats(old_item)
        
        # Equip new item
        self.equipment[slot] = item
        self.apply_item_stats(item)
        
        # Check for set bonuses
        self.check_set_bonuses()
        
        self.total_items_collected += 1
        return old_item  # Return unequipped item
    
    def apply_item_stats(self, item):
        """Apply item stat bonuses"""
        if not item:
            return
        
        # Apply basic stats
        self.player.max_health += item.get('health', 0)
        self.player.damage += item.get('damage', 0)
        self.player.defense += item.get('defense', 0)
        self.player.speed += item.get('speed', 0)
        
        # Apply special effects
        if 'effect' in item:
            self.apply_special_effect(item['effect'])
        
        # Track legendary items
        if item.get('rarity') == 'legendary':
            self.legendary_items.append(item['name'])
    
    def remove_item_stats(self, item):
        """Remove item stat bonuses"""
        if not item:
            return
        
        self.player.max_health -= item.get('health', 0)
        self.player.damage -= item.get('damage', 0)
        self.player.defense -= item.get('defense', 0)
        self.player.speed -= item.get('speed', 0)
        
        if item.get('rarity') == 'legendary' and item['name'] in self.legendary_items:
            self.legendary_items.remove(item['name'])
    
    def collect_power_up(self, power_up_type):
        """Collect a permanent upgrade"""
        if power_up_type not in self.power_ups:
            return False
        
        self.power_ups[power_up_type] += 1
        
        # Apply immediate effects
        if power_up_type == 'health_crystals':
            self.player.max_health += 20
            self.player.health += 20  # Heal on pickup
            return "Max Health increased by 20!"
        
        elif power_up_type == 'mana_crystals':
            self.player.max_mana += 10
            self.player.mana += 10
            return "Max Mana increased by 10!"
        
        elif power_up_type == 'speed_boots':
            self.player.speed += 1
            return "Movement speed increased!"
        
        elif power_up_type == 'power_gems':
            self.player.damage += 5
            return "Attack power increased by 5!"
        
        elif power_up_type == 'shield_fragments':
            self.player.defense += 2
            return "Defense increased by 2!"
        
        return "Power up collected!"
    
    def use_consumable(self, consumable):
        """Use a temporary buff item"""
        buff = {
            'name': consumable['name'],
            'effect': consumable['effect'],
            'duration': consumable.get('duration', 300),  # 5 seconds default
            'stats': consumable.get('stats', {})
        }
        
        # Apply buff stats
        for stat, value in buff['stats'].items():
            if hasattr(self.player, stat):
                setattr(self.player, stat, 
                       getattr(self.player, stat) + value)
        
        self.active_buffs.append(buff)
        return f"Used {consumable['name']}!"
    
    def update_buffs(self):
        """Update temporary buff durations"""
        expired_buffs = []
        
        for buff in self.active_buffs:
            buff['duration'] -= 1
            
            if buff['duration'] <= 0:
                expired_buffs.append(buff)
                # Remove buff stats
                for stat, value in buff['stats'].items():
                    if hasattr(self.player, stat):
                        setattr(self.player, stat,
                               getattr(self.player, stat) - value)
        
        # Remove expired buffs
        for buff in expired_buffs:
            self.active_buffs.remove(buff)
    
    def check_set_bonuses(self):
        """Check for equipment set bonuses"""
        # Count items from each set
        sets = {}
        for item in self.equipment.values():
            if item and 'set' in item:
                set_name = item['set']
                sets[set_name] = sets.get(set_name, 0) + 1
        
        # Apply set bonuses
        for set_name, count in sets.items():
            if set_name == 'warrior' and count >= 2:
                if 'warrior_2pc' not in self.set_bonuses:
                    self.player.damage += 10
                    self.set_bonuses['warrior_2pc'] = True
                
                if count >= 4 and 'warrior_4pc' not in self.set_bonuses:
                    self.player.defense += 15
                    self.player.max_health += 50
                    self.set_bonuses['warrior_4pc'] = True
            
            elif set_name == 'mage' and count >= 2:
                if 'mage_2pc' not in self.set_bonuses:
                    self.player.max_mana += 30
                    self.set_bonuses['mage_2pc'] = True
    
    def get_total_power(self):
        """Calculate total power level"""
        power = 0
        
        # Base stats contribution
        power += self.player.max_health // 10
        power += self.player.damage * 2
        power += self.player.defense * 3
        power += self.player.speed * 5
        
        # Equipment contribution
        for item in self.equipment.values():
            if item:
                rarity_multiplier = {
                    'common': 1,
                    'rare': 2,
                    'epic': 3,
                    'legendary': 5
                }.get(item.get('rarity', 'common'), 1)
                
                power += item.get('power', 10) * rarity_multiplier
        
        # Power-ups contribution
        for upgrade, count in self.power_ups.items():
            power += count * 15
        
        return power
    
    def generate_random_item(self, level=1):
        """Generate a random equipment piece"""
        import random
        
        rarities = ['common', 'rare', 'epic', 'legendary']
        rarity_weights = [60, 25, 12, 3]
        rarity = random.choices(rarities, rarity_weights)[0]
        
        slots = ['weapon', 'armor', 'accessory1', 'accessory2']
        slot = random.choice(slots)
        
        # Base stats based on rarity
        stat_multiplier = {
            'common': 1,
            'rare': 1.5,
            'epic': 2,
            'legendary': 3
        }[rarity]
        
        item = {
            'name': f"{rarity.capitalize()} {slot.capitalize()}",
            'slot': slot,
            'rarity': rarity,
            'level': level,
            'power': int(10 * level * stat_multiplier)
        }
        
        # Add random stats
        if slot == 'weapon':
            item['damage'] = int(5 * level * stat_multiplier)
        elif slot == 'armor':
            item['defense'] = int(3 * level * stat_multiplier)
            item['health'] = int(20 * level * stat_multiplier)
        else:  # accessory
            stat_type = random.choice(['speed', 'health', 'damage'])
            item[stat_type] = int(2 * level * stat_multiplier)
        
        # Add special effects for higher rarities
        if rarity in ['epic', 'legendary']:
            effects = ['lifesteal', 'thorns', 'dodge', 'crit']
            item['effect'] = random.choice(effects)
        
        return item
    
    def draw_equipment_ui(self, screen, x, y):
        """Draw equipment and power level"""
        font = pygame.font.Font(None, 20)
        
        # Draw power level
        power = self.get_total_power()
        power_text = font.render(f"Power Level: {power}", True, (255, 215, 0))
        screen.blit(power_text, (x, y))
        
        # Draw equipment slots
        y_offset = y + 30
        for slot, item in self.equipment.items():
            if item:
                color = {
                    'common': (200, 200, 200),
                    'rare': (100, 150, 255),
                    'epic': (200, 100, 255),
                    'legendary': (255, 200, 0)
                }.get(item.get('rarity', 'common'), (255, 255, 255))
                
                text = font.render(f"{slot}: {item['name']}", True, color)
            else:
                text = font.render(f"{slot}: Empty", True, (100, 100, 100))
            
            screen.blit(text, (x, y_offset))
            y_offset += 25
        
        # Draw active buffs
        if self.active_buffs:
            y_offset += 10
            buff_text = font.render("Active Buffs:", True, (255, 255, 255))
            screen.blit(buff_text, (x, y_offset))
            y_offset += 20
            
            for buff in self.active_buffs:
                remaining = buff['duration'] // 60  # Convert to seconds
                buff_info = font.render(f"  {buff['name']} ({remaining}s)",
                                       True, (100, 255, 100))
                screen.blit(buff_info, (x, y_offset))
                y_offset += 20`
    }
  },
  
  {
    id: 'mapgen',
    title: 'Map Generation',
    description: 'How game worlds are created',
    optionA: {
      title: 'Procedural Generation',
      description: 'Random worlds that are different every time',
      features: ['Infinite worlds', 'Random dungeons', 'Roguelike elements', 'Seed-based'],
      pythonCode: `# Procedural Map Generation System
import random
import noise

class MapGenerationSystem:
    def __init__(self, width=100, height=100, seed=None):
        self.width = width
        self.height = height
        self.seed = seed or random.randint(0, 999999)
        random.seed(self.seed)
        
        # Map data
        self.tiles = [[0 for _ in range(width)] for _ in range(height)]
        self.rooms = []
        self.corridors = []
        self.spawn_point = (0, 0)
        self.exit_point = (0, 0)
        
        # Tile types
        self.TILE_TYPES = {
            0: 'empty',
            1: 'floor',
            2: 'wall',
            3: 'door',
            4: 'chest',
            5: 'enemy_spawn',
            6: 'trap',
            7: 'treasure',
            8: 'stairs_up',
            9: 'stairs_down'
        }
    
    def generate_dungeon(self, room_count=10):
        """Generate a dungeon with rooms and corridors"""
        self.clear_map()
        
        # Generate rooms
        for _ in range(room_count):
            room = self.create_room()
            if room and not self.room_overlaps(room):
                self.carve_room(room)
                self.rooms.append(room)
        
        # Connect rooms with corridors
        for i in range(len(self.rooms) - 1):
            self.create_corridor(self.rooms[i], self.rooms[i + 1])
        
        # Add features
        self.add_doors()
        self.add_treasures()
        self.add_enemies()
        self.place_stairs()
        
        return self.tiles
    
    def create_room(self):
        """Create a random room"""
        min_size, max_size = 5, 15
        width = random.randint(min_size, max_size)
        height = random.randint(min_size, max_size)
        x = random.randint(1, self.width - width - 1)
        y = random.randint(1, self.height - height - 1)
        
        return {'x': x, 'y': y, 'width': width, 'height': height}
    
    def room_overlaps(self, room):
        """Check if room overlaps with existing rooms"""
        for other in self.rooms:
            if (room['x'] < other['x'] + other['width'] + 2 and
                room['x'] + room['width'] + 2 > other['x'] and
                room['y'] < other['y'] + other['height'] + 2 and
                room['y'] + room['height'] + 2 > other['y']):
                return True
        return False
    
    def carve_room(self, room):
        """Carve out a room in the map"""
        for y in range(room['y'], room['y'] + room['height']):
            for x in range(room['x'], room['x'] + room['width']):
                if 0 <= x < self.width and 0 <= y < self.height:
                    # Walls on edges, floor inside
                    if (x == room['x'] or x == room['x'] + room['width'] - 1 or
                        y == room['y'] or y == room['y'] + room['height'] - 1):
                        self.tiles[y][x] = 2  # Wall
                    else:
                        self.tiles[y][x] = 1  # Floor
    
    def create_corridor(self, room1, room2):
        """Create corridor between two rooms"""
        # Get center points
        x1 = room1['x'] + room1['width'] // 2
        y1 = room1['y'] + room1['height'] // 2
        x2 = room2['x'] + room2['width'] // 2
        y2 = room2['y'] + room2['height'] // 2
        
        # Randomly choose horizontal-first or vertical-first
        if random.random() < 0.5:
            # Horizontal then vertical
            self.carve_h_corridor(x1, x2, y1)
            self.carve_v_corridor(y1, y2, x2)
        else:
            # Vertical then horizontal
            self.carve_v_corridor(y1, y2, x1)
            self.carve_h_corridor(x1, x2, y2)
    
    def carve_h_corridor(self, x1, x2, y):
        """Carve horizontal corridor"""
        for x in range(min(x1, x2), max(x1, x2) + 1):
            if 0 <= x < self.width and 0 <= y < self.height:
                if self.tiles[y][x] == 0:  # Only carve through empty
                    self.tiles[y][x] = 1  # Floor
                # Add walls around corridor
                if y - 1 >= 0 and self.tiles[y-1][x] == 0:
                    self.tiles[y-1][x] = 2
                if y + 1 < self.height and self.tiles[y+1][x] == 0:
                    self.tiles[y+1][x] = 2
    
    def carve_v_corridor(self, y1, y2, x):
        """Carve vertical corridor"""
        for y in range(min(y1, y2), max(y1, y2) + 1):
            if 0 <= x < self.width and 0 <= y < self.height:
                if self.tiles[y][x] == 0:  # Only carve through empty
                    self.tiles[y][x] = 1  # Floor
                # Add walls around corridor
                if x - 1 >= 0 and self.tiles[y][x-1] == 0:
                    self.tiles[y][x-1] = 2
                if x + 1 < self.width and self.tiles[y][x+1] == 0:
                    self.tiles[y][x+1] = 2
    
    def add_doors(self):
        """Add doors at room entrances"""
        for room in self.rooms:
            # Find potential door locations (walls adjacent to corridors)
            door_spots = []
            
            # Check room edges
            for x in range(room['x'], room['x'] + room['width']):
                # Top and bottom edges
                if self.is_valid_door(x, room['y']):
                    door_spots.append((x, room['y']))
                if self.is_valid_door(x, room['y'] + room['height'] - 1):
                    door_spots.append((x, room['y'] + room['height'] - 1))
            
            # Add 1-2 doors per room
            if door_spots:
                num_doors = min(2, len(door_spots))
                for _ in range(num_doors):
                    if door_spots:
                        dx, dy = random.choice(door_spots)
                        self.tiles[dy][dx] = 3  # Door
                        door_spots.remove((dx, dy))
    
    def is_valid_door(self, x, y):
        """Check if position is valid for a door"""
        if not (0 <= x < self.width and 0 <= y < self.height):
            return False
        
        # Must be a wall
        if self.tiles[y][x] != 2:
            return False
        
        # Check if connects to corridor
        adjacent = [
            (x-1, y), (x+1, y), (x, y-1), (x, y+1)
        ]
        
        floor_count = 0
        for ax, ay in adjacent:
            if 0 <= ax < self.width and 0 <= ay < self.height:
                if self.tiles[ay][ax] == 1:  # Floor
                    floor_count += 1
        
        return floor_count >= 2  # Connects two floor tiles
    
    def add_treasures(self):
        """Add treasure chests to rooms"""
        for room in self.rooms:
            if random.random() < 0.3:  # 30% chance per room
                # Place in random spot in room
                tx = random.randint(room['x'] + 1, room['x'] + room['width'] - 2)
                ty = random.randint(room['y'] + 1, room['y'] + room['height'] - 2)
                
                if self.tiles[ty][tx] == 1:  # Only on floor
                    self.tiles[ty][tx] = 4  # Chest
    
    def add_enemies(self):
        """Add enemy spawn points"""
        for room in self.rooms[1:]:  # Skip first room (spawn room)
            # Number of enemies based on room size
            room_area = room['width'] * room['height']
            num_enemies = random.randint(1, max(1, room_area // 20))
            
            for _ in range(num_enemies):
                ex = random.randint(room['x'] + 1, room['x'] + room['width'] - 2)
                ey = random.randint(room['y'] + 1, room['y'] + room['height'] - 2)
                
                if self.tiles[ey][ex] == 1:  # Only on floor
                    self.tiles[ey][ex] = 5  # Enemy spawn
    
    def place_stairs(self):
        """Place entrance and exit stairs"""
        if self.rooms:
            # Entrance in first room
            first_room = self.rooms[0]
            self.spawn_point = (
                first_room['x'] + first_room['width'] // 2,
                first_room['y'] + first_room['height'] // 2
            )
            self.tiles[self.spawn_point[1]][self.spawn_point[0]] = 8  # Stairs up
            
            # Exit in last room
            last_room = self.rooms[-1]
            self.exit_point = (
                last_room['x'] + last_room['width'] // 2,
                last_room['y'] + last_room['height'] // 2
            )
            self.tiles[self.exit_point[1]][self.exit_point[0]] = 9  # Stairs down
    
    def generate_cave(self, smoothing=5):
        """Generate cave-like map using cellular automata"""
        # Initialize with random noise
        for y in range(self.height):
            for x in range(self.width):
                self.tiles[y][x] = 2 if random.random() < 0.45 else 1
        
        # Apply cellular automata smoothing
        for _ in range(smoothing):
            new_tiles = [[0 for _ in range(self.width)] for _ in range(self.height)]
            
            for y in range(self.height):
                for x in range(self.width):
                    wall_count = self.count_walls_around(x, y)
                    
                    if wall_count > 4:
                        new_tiles[y][x] = 2  # Wall
                    elif wall_count < 4:
                        new_tiles[y][x] = 1  # Floor
                    else:
                        new_tiles[y][x] = self.tiles[y][x]
            
            self.tiles = new_tiles
        
        # Ensure borders are walls
        for x in range(self.width):
            self.tiles[0][x] = 2
            self.tiles[self.height-1][x] = 2
        for y in range(self.height):
            self.tiles[y][0] = 2
            self.tiles[y][self.width-1] = 2
    
    def count_walls_around(self, x, y):
        """Count walls in 3x3 area around position"""
        wall_count = 0
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                nx, ny = x + dx, y + dy
                
                # Out of bounds counts as wall
                if nx < 0 or nx >= self.width or ny < 0 or ny >= self.height:
                    wall_count += 1
                elif self.tiles[ny][nx] == 2:
                    wall_count += 1
        
        return wall_count
    
    def generate_overworld(self):
        """Generate overworld map using Perlin noise"""
        scale = 20.0  # Adjust for different terrain features
        
        for y in range(self.height):
            for x in range(self.width):
                # Get Perlin noise value
                value = noise.pnoise2(x/scale, y/scale, 
                                     octaves=4, persistence=0.5, 
                                     lacunarity=2.0, repeatx=self.width,
                                     repeaty=self.height, base=self.seed)
                
                # Map noise to terrain types
                if value < -0.3:
                    self.tiles[y][x] = 'water'
                elif value < -0.1:
                    self.tiles[y][x] = 'sand'
                elif value < 0.1:
                    self.tiles[y][x] = 'grass'
                elif value < 0.3:
                    self.tiles[y][x] = 'forest'
                else:
                    self.tiles[y][x] = 'mountain'
        
        return self.tiles
    
    def clear_map(self):
        """Clear the map"""
        self.tiles = [[0 for _ in range(self.width)] for _ in range(self.height)]
        self.rooms = []
        self.corridors = []
    
    def draw_minimap(self, screen, x, y, scale=2):
        """Draw a minimap of the dungeon"""
        colors = {
            0: (0, 0, 0),        # Empty
            1: (100, 100, 100),  # Floor
            2: (50, 50, 50),     # Wall
            3: (139, 69, 19),    # Door
            4: (255, 215, 0),    # Chest
            5: (255, 0, 0),      # Enemy
            8: (0, 255, 0),      # Stairs up
            9: (0, 0, 255),      # Stairs down
        }
        
        for ty in range(self.height):
            for tx in range(self.width):
                tile = self.tiles[ty][tx]
                color = colors.get(tile, (0, 0, 0))
                
                rect = pygame.Rect(x + tx * scale, y + ty * scale, scale, scale)
                pygame.draw.rect(screen, color, rect)`
    },
    optionB: {
      title: 'Designed Levels',
      description: 'Handcrafted stages with intentional design',
      features: ['Consistent layout', 'Puzzle placement', 'Narrative flow', 'Secret areas'],
      pythonCode: `# Designed Level System
class MapGenerationSystem:
    def __init__(self):
        self.current_level = 0
        self.levels = []
        self.tile_size = 32
        
        # Tile legend for level design
        self.TILE_LEGEND = {
            '#': 'wall',
            '.': 'floor',
            '@': 'player_spawn',
            'E': 'enemy',
            'C': 'chest',
            'D': 'door',
            'K': 'key',
            'S': 'secret',
            'X': 'exit',
            'T': 'trap',
            'H': 'health',
            'P': 'powerup',
            '~': 'water',
            '^': 'spikes',
            'B': 'boss',
            'L': 'locked_door',
            'V': 'save_point'
        }
        
        # Level metadata
        self.level_info = {}
        
        # Define all levels
        self.define_levels()
    
    def define_levels(self):
        """Define all handcrafted levels"""
        # Level 1: Tutorial
        self.levels.append({
            'name': 'Tutorial Dungeon',
            'theme': 'castle',
            'music': 'dungeon_theme.ogg',
            'layout': [
                "####################",
                "#@.................#",
                "#..................#",
                "#...###....###.....#",
                "#...#C#....#H#.....#",
                "#...###....###.....#",
                "#..................#",
                "#......#DD#........#",
                "#......#..#........#",
                "#......#..#........#",
                "#..................#",
                "#........E.........#",
                "#..................#",
                "#..................#",
                "#........X.........#",
                "####################"
            ],
            'objectives': [
                'Learn to move with arrow keys',
                'Collect the chest',
                'Defeat the enemy',
                'Find the exit'
            ],
            'secrets': [(10, 4)],  # Hidden chest location
            'dialog': {
                'intro': "Welcome, hero! Use arrow keys to move.",
                'chest': "You found treasure! Press SPACE to open.",
                'enemy': "Combat! Press X to attack.",
                'exit': "Well done! Proceed to the next level."
            }
        })
        
        # Level 2: Puzzle Room
        self.levels.append({
            'name': 'Puzzle Chamber',
            'theme': 'temple',
            'music': 'puzzle_theme.ogg',
            'layout': [
                "########################",
                "#@...#.....#...........#",
                "#....#.....L...........#",
                "#....#.....#...........#",
                "###D###...###..........#",
                "#............#.........#",
                "#............#.....K...#",
                "#.....T......#.........#",
                "#............###L###...#",
                "#..................#...#",
                "#..................#...#",
                "#..................D...#",
                "#..................#...#",
                "#.....C......S.....#...#",
                "#..................#.X.#",
                "########################"
            ],
            'objectives': [
                'Find the key',
                'Unlock the doors',
                'Avoid the traps',
                'Discover the secret'
            ],
            'secrets': [(13, 13)],
            'puzzle_logic': {
                'switches': [(5, 7), (10, 10)],
                'doors_affected': [(11, 4), (11, 8)]
            }
        })
        
        # Level 3: Boss Arena
        self.levels.append({
            'name': 'Boss Arena',
            'theme': 'arena',
            'music': 'boss_battle.ogg',
            'layout': [
                "##########################",
                "#........................#",
                "#...@....................#",
                "#........................#",
                "#...######....######.....#",
                "#...#....#....#....#.....#",
                "#...#....#....#....#.....#",
                "#...#....#....#....#.....#",
                "#...######....######.....#",
                "#........................#",
                "#.........B..............#",
                "#........................#",
                "#..H..................H..#",
                "#........................#",
                "#........................#",
                "#..........X.............#",
                "##########################"
            ],
            'objectives': [
                'Defeat the boss',
                'Use the arena layout strategically',
                'Manage your health'
            ],
            'boss_config': {
                'health': 300,
                'phases': 3,
                'attack_patterns': ['sweep', 'projectile', 'summon']
            }
        })
    
    def load_level(self, level_index):
        """Load a specific level"""
        if 0 <= level_index < len(self.levels):
            self.current_level = level_index
            level_data = self.levels[level_index]
            
            # Convert ASCII layout to tile map
            tile_map = []
            spawn_point = None
            enemies = []
            items = []
            
            for y, row in enumerate(level_data['layout']):
                tile_row = []
                for x, char in enumerate(row):
                    tile_type = self.TILE_LEGEND.get(char, 'floor')
                    tile_row.append(tile_type)
                    
                    # Track special tiles
                    if char == '@':
                        spawn_point = (x * self.tile_size, y * self.tile_size)
                    elif char == 'E':
                        enemies.append({'x': x, 'y': y, 'type': 'basic'})
                    elif char == 'B':
                        enemies.append({'x': x, 'y': y, 'type': 'boss'})
                    elif char in ['C', 'K', 'H', 'P']:
                        items.append({'x': x, 'y': y, 'type': tile_type})
                
                tile_map.append(tile_row)
            
            return {
                'map': tile_map,
                'spawn': spawn_point,
                'enemies': enemies,
                'items': items,
                'metadata': level_data
            }
        return None
    
    def create_custom_level(self, width, height, name="Custom Level"):
        """Create a blank level for custom design"""
        custom_level = {
            'name': name,
            'theme': 'custom',
            'layout': [],
            'objectives': [],
            'width': width,
            'height': height
        }
        
        # Create empty layout
        for y in range(height):
            if y == 0 or y == height - 1:
                # Top and bottom walls
                custom_level['layout'].append('#' * width)
            else:
                # Side walls with empty space
                row = '#' + '.' * (width - 2) + '#'
                custom_level['layout'].append(row)
        
        return custom_level
    
    def add_checkpoint(self, level_index, x, y):
        """Add a checkpoint/save point to level"""
        if 0 <= level_index < len(self.levels):
            if 'checkpoints' not in self.levels[level_index]:
                self.levels[level_index]['checkpoints'] = []
            
            self.levels[level_index]['checkpoints'].append({
                'x': x, 
                'y': y,
                'activated': False
            })
    
    def trigger_event(self, level_index, event_type, x, y):
        """Trigger scripted events in levels"""
        events = {
            'dialog': self.show_dialog,
            'cutscene': self.play_cutscene,
            'spawn_enemies': self.spawn_wave,
            'unlock_door': self.unlock_door,
            'secret_found': self.reveal_secret
        }
        
        if event_type in events:
            return events[event_type](level_index, x, y)
    
    def show_dialog(self, level_index, x, y):
        """Show dialog at specific location"""
        if 0 <= level_index < len(self.levels):
            level = self.levels[level_index]
            
            # Check for dialog triggers
            for trigger_type in ['intro', 'chest', 'enemy', 'exit']:
                if trigger_type in level.get('dialog', {}):
                    # Check if player is at trigger location
                    return level['dialog'][trigger_type]
        return None
    
    def reveal_secret(self, level_index, x, y):
        """Reveal secret area"""
        if 0 <= level_index < len(self.levels):
            level = self.levels[level_index]
            
            for secret_x, secret_y in level.get('secrets', []):
                if abs(x - secret_x) < 2 and abs(y - secret_y) < 2:
                    # Reveal secret tiles
                    return {
                        'type': 'secret_revealed',
                        'message': 'You discovered a secret!',
                        'reward': 'bonus_treasure'
                    }
        return None
    
    def get_level_progress(self):
        """Get completion percentage for current level"""
        if 0 <= self.current_level < len(self.levels):
            level = self.levels[self.current_level]
            objectives = level.get('objectives', [])
            completed = 0
            
            # Track completed objectives (simplified)
            # In real implementation, track actual game state
            
            if objectives:
                return (completed / len(objectives)) * 100
        return 0
    
    def draw_level_editor_grid(self, screen, x, y, selected_tile='#'):
        """Draw grid for level editor"""
        if self.current_level < len(self.levels):
            level = self.levels[self.current_level]
            
            for row_idx, row in enumerate(level['layout']):
                for col_idx, tile in enumerate(row):
                    tile_x = x + col_idx * self.tile_size
                    tile_y = y + row_idx * self.tile_size
                    
                    # Draw tile
                    color = self.get_tile_color(tile)
                    pygame.draw.rect(screen, color,
                                   (tile_x, tile_y, self.tile_size, self.tile_size))
                    
                    # Draw grid lines
                    pygame.draw.rect(screen, (100, 100, 100),
                                   (tile_x, tile_y, self.tile_size, self.tile_size), 1)
    
    def get_tile_color(self, tile_char):
        """Get color for tile type"""
        colors = {
            '#': (50, 50, 50),    # Wall
            '.': (200, 200, 200), # Floor
            '@': (0, 255, 0),     # Spawn
            'E': (255, 0, 0),     # Enemy
            'C': (255, 215, 0),   # Chest
            'D': (139, 69, 19),   # Door
            'K': (255, 255, 0),   # Key
            'X': (0, 0, 255),     # Exit
            '~': (0, 150, 255),   # Water
            '^': (150, 150, 150), # Spikes
            'B': (128, 0, 128),   # Boss
        }
        return colors.get(tile_char, (100, 100, 100))`
    }
  }
];

// LocalStorage management functions
export function getUserComponentChoices(): ComponentChoice[] {
  const stored = localStorage.getItem('gameComponentChoices');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing component choices:', e);
      return [];
    }
  }
  return [];
}

export function saveComponentChoice(componentId: string, choice: 'A' | 'B'): void {
  const choices = getUserComponentChoices();
  const existingIndex = choices.findIndex(c => c.component === componentId);
  
  if (existingIndex >= 0) {
    choices[existingIndex].choice = choice;
  } else {
    choices.push({ component: componentId, choice });
  }
  
  localStorage.setItem('gameComponentChoices', JSON.stringify(choices));
}

export function getComponentChoice(componentId: string): 'A' | 'B' | null {
  const choices = getUserComponentChoices();
  const choice = choices.find(c => c.component === componentId);
  return choice ? choice.choice : null;
}

// Generate a complete game template based on component choices
export function generateGameTemplate(
  gameType: string,
  componentChoices?: ComponentChoice[]
): string {
  const choices = componentChoices || getUserComponentChoices();
  
  // Track which systems are selected
  const selectedSystems = new Set<string>();
  
  // Start with base template
  let template = `# PyGame Academy - ${gameType} Game
# Generated with your custom component choices
import pygame
import random
import math

# Initialize Pygame
pygame.init()

# Game settings
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
GRAY = (128, 128, 128)

`;

  // Add chosen components
  for (const choice of choices) {
    const component = gameComponents.find(c => c.id === choice.component);
    if (component) {
      selectedSystems.add(component.id);
      const selectedOption = choice.choice === 'A' ? component.optionA : component.optionB;
      template += `\n# ${component.title} - ${selectedOption.title}\n`;
      template += selectedOption.pythonCode + '\n';
    }
  }

  // Add default movement if no movement system selected
  if (!selectedSystems.has('movement')) {
    template += `\n# Default Movement (no movement system selected)\n`;
    template += `class BasicMovement:
    def __init__(self, entity):
        self.entity = entity
        self.speed = 5
        
    def handle_input(self):
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            self.entity.x -= self.speed
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            self.entity.x += self.speed
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            self.entity.y -= self.speed
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            self.entity.y += self.speed
            
        # Keep player on screen
        self.entity.x = max(0, min(SCREEN_WIDTH - self.entity.width, self.entity.x))
        self.entity.y = max(0, min(SCREEN_HEIGHT - self.entity.height, self.entity.y))
    
    def update_position(self, platforms=[]):
        pass  # Basic movement doesn't need platform collision\n`;
  }

  // Add main game class that uses the components
  template += `
# Main Game Class
class Game:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("${gameType} Adventure")
        self.clock = pygame.time.Clock()
        self.running = True
        
        # Initialize player
        self.player = type('Player', (), {
            'x': SCREEN_WIDTH // 2, 'y': SCREEN_HEIGHT // 2,
            'width': 30, 'height': 40,
            'health': 100, 'max_health': 100,
            'damage': 10, 'defense': 5,
            'speed': 5,
            'mana': 50, 'max_mana': 50,
            'is_player': True,
            'damage_multiplier': 1.0,
            'regen_rate': 0
        })()
        
        # Initialize only selected systems`;
        
  // Add system initialization based on what was selected
  if (selectedSystems.has('combat')) {
    template += `\n        self.combat_system = CombatSystem()\n        # Add some initial enemies\n        self.combat_system.add_enemy(400, 300, 50)`;
  }
  
  if (selectedSystems.has('inventory')) {
    template += `\n        self.inventory_system = InventorySystem()\n        # Add some starter items\n        self.inventory_system.add_item({'id': 'potion', 'name': 'Health Potion', 'icon': '♥', 'stackable': True})`;
  }
  
  if (selectedSystems.has('movement')) {
    template += `\n        self.movement_system = MovementSystem(self.player)`;
  } else {
    template += `\n        self.movement_system = BasicMovement(self.player)  # Default movement`;
  }
  
  if (selectedSystems.has('progression')) {
    template += `\n        self.progression_system = ProgressionSystem(self.player)`;
  }
  
  if (selectedSystems.has('mapgen')) {
    template += `\n        self.map_system = MapGenerationSystem()\n        self.map_system.generate_dungeon()`;
  }
  
  template += `
        
        # Game state
        self.font = pygame.font.Font(None, 24)
        self.platforms = []  # For movement collision
        self.show_inventory = False  # Track inventory UI visibility
        `;
  
  // Only add platform creation if no map system
  if (!selectedSystems.has('mapgen')) {
    template += `
        # Create default platforms since no map system selected
        # Ground platform
        self.platforms.append(pygame.Rect(0, SCREEN_HEIGHT - 40, SCREEN_WIDTH, 40))
        # Some floating platforms
        self.platforms.append(pygame.Rect(200, 400, 150, 20))
        self.platforms.append(pygame.Rect(450, 300, 150, 20))
        self.platforms.append(pygame.Rect(100, 200, 150, 20))`;
  }
  
  template += `
    
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            # Handle other events based on systems
            elif event.type == pygame.KEYDOWN:
                # ESC to quit
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                
                # Inventory controls - only if inventory system exists
                if hasattr(self, 'inventory_system'):
                    # Toggle inventory visibility with I
                    if event.key == pygame.K_i:
                        self.show_inventory = not self.show_inventory
                    
                    # Quick slot items (1-5 keys)
                    if pygame.K_1 <= event.key <= pygame.K_5:
                        slot_index = event.key - pygame.K_1
                        item = self.inventory_system.use_quick_slot(slot_index)
                        if item:
                            print(f"Used {item['name']}")
                
                # Combat controls - only if combat system exists
                if hasattr(self, 'combat_system') and event.key == pygame.K_SPACE:
                    # Fire projectile in direction player is facing
                    direction = (1, 0)  # Default right
                    self.combat_system.fire_projectile(self.player.x + self.player.width, 
                                                      self.player.y + self.player.height // 2, 
                                                      direction)
    
    def update(self):
        # Update movement (always present - either custom or basic)
        self.movement_system.handle_input()
        self.movement_system.update_position(self.platforms)
        
        # Update combat if present
        if hasattr(self, 'combat_system'):
            player_rect = pygame.Rect(self.player.x, self.player.y,
                                    self.player.width, self.player.height)
            self.combat_system.update_combat(player_rect)
        
        # Update progression if present
        if hasattr(self, 'progression_system'):
            self.progression_system.update_buffs()
        
        # Basic health regeneration if no progression system
        if not hasattr(self, 'progression_system'):
            # Slowly regenerate health
            if self.player.health < self.player.max_health:
                self.player.health = min(self.player.max_health, 
                                        self.player.health + 0.01)
    
    def draw(self):
        # Draw background
        if hasattr(self, 'map_system'):
            # Dark background for dungeon feel
            self.screen.fill(BLACK)
            # Draw minimap if map system exists
            self.map_system.draw_minimap(self.screen, 600, 20, 2)
        else:
            # Simple gradient background if no map system
            self.screen.fill((50, 50, 80))  # Dark blue
            # Draw platforms
            for platform in self.platforms:
                pygame.draw.rect(self.screen, GRAY, platform)
                pygame.draw.rect(self.screen, WHITE, platform, 2)
        
        # Draw player (always visible)
        pygame.draw.rect(self.screen, RED,
                       (self.player.x, self.player.y,
                        self.player.width, self.player.height))
        # Player outline
        pygame.draw.rect(self.screen, WHITE,
                       (self.player.x, self.player.y,
                        self.player.width, self.player.height), 2)
        
        # Draw combat elements if present
        if hasattr(self, 'combat_system'):
            self.combat_system.draw_combat(self.screen)
        
        # Draw inventory if present and open
        if hasattr(self, 'inventory_system') and hasattr(self, 'show_inventory'):
            if self.show_inventory:
                self.inventory_system.draw_inventory(self.screen, 250, 150)
        
        # Draw UI elements
        self.draw_ui()
        
        pygame.display.flip()
    
    def draw_ui(self):
        # Always draw health bar
        bar_width = 200
        bar_height = 20
        health_percent = max(0, self.player.health / self.player.max_health)
        
        # Health bar background
        pygame.draw.rect(self.screen, (100, 0, 0), (10, 10, bar_width, bar_height))
        # Health bar fill
        pygame.draw.rect(self.screen, (0, 255, 0),
                       (10, 10, int(bar_width * health_percent), bar_height))
        # Health bar border
        pygame.draw.rect(self.screen, WHITE, (10, 10, bar_width, bar_height), 2)
        # Health text
        health_text = self.font.render(f"HP: {int(self.player.health)}/{self.player.max_health}",
                                      True, WHITE)
        self.screen.blit(health_text, (15, 12))
        
        # Draw progression UI if present
        if hasattr(self, 'progression_system'):
            self.progression_system.draw_level_ui(self.screen, 10, 40)
        
        # Draw control hints based on available systems
        hints = []
        hints.append("Arrow Keys/WASD: Move")
        
        if hasattr(self, 'combat_system'):
            hints.append("Space: Attack")
        
        if hasattr(self, 'inventory_system'):
            hints.append("I: Inventory")
            hints.append("1-5: Quick items")
        
        hints.append("ESC: Quit")
        
        # Draw hints at bottom
        hint_y = SCREEN_HEIGHT - 30
        hint_text = self.font.render(" | ".join(hints), True, WHITE)
        self.screen.blit(hint_text, (10, hint_y))
        
        # Draw game title at top right
        title_text = self.font.render("${gameType} Adventure", True, YELLOW)
        title_rect = title_text.get_rect(right=SCREEN_WIDTH - 10, top=10)
        self.screen.blit(title_text, title_rect)
    
    def run(self):
        while self.running:
            self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(FPS)
        
        pygame.quit()

# Start the game
if __name__ == "__main__":
    game = Game()
    game.run()
`;

  return template;
}

// Get a summary of chosen components
export function getComponentSummary(): {[key: string]: string} {
  const choices = getUserComponentChoices();
  const summary: {[key: string]: string} = {};
  
  for (const choice of choices) {
    const component = gameComponents.find(c => c.id === choice.component);
    if (component) {
      const selectedOption = choice.choice === 'A' ? component.optionA : component.optionB;
      summary[component.title] = selectedOption.title;
    }
  }
  
  return summary;
}

// Reset all component choices
export function resetComponentChoices(): void {
  localStorage.removeItem('gameComponentChoices');
}