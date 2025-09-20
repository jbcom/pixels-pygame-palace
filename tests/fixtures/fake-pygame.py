"""
Fake Pygame Module for Testing
Provides mock implementations of pygame functionality
"""

class FakeSurface:
    def __init__(self, size):
        self.width, self.height = size
        self.pixels = [[0 for _ in range(self.width)] for _ in range(self.height)]
    
    def fill(self, color):
        pass
    
    def blit(self, source, dest):
        pass
    
    def get_rect(self):
        return FakeRect(0, 0, self.width, self.height)

class FakeRect:
    def __init__(self, x, y, width, height):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.left = x
        self.top = y
        self.right = x + width
        self.bottom = y + height
    
    def colliderect(self, other):
        return False

class FakeDisplay:
    def set_mode(self, size):
        return FakeSurface(size)
    
    def set_caption(self, title):
        pass
    
    def flip(self):
        pass
    
    def update(self):
        pass

class FakeClock:
    def tick(self, fps):
        return 16  # Simulates 60 FPS
    
    def get_fps(self):
        return 60.0

class FakeEvent:
    def __init__(self):
        self.type = None
        self.key = None
    
    @staticmethod
    def get():
        return []
    
    @staticmethod
    def poll():
        return FakeEvent()

class FakeKey:
    K_SPACE = 32
    K_LEFT = 276
    K_RIGHT = 277
    K_UP = 273
    K_DOWN = 274
    K_a = 97
    K_d = 100
    K_w = 119
    K_s = 115
    
    @staticmethod
    def get_pressed():
        return [False] * 512

class FakeMixer:
    class Sound:
        def __init__(self, path):
            self.path = path
        
        def play(self):
            pass
        
        def stop(self):
            pass
    
    @staticmethod
    def init():
        pass

class FakePygame:
    def __init__(self):
        self.display = FakeDisplay()
        self.time = FakeClock()
        self.event = FakeEvent()
        self.key = FakeKey()
        self.mixer = FakeMixer()
        
        # Event types
        self.QUIT = 12
        self.KEYDOWN = 2
        self.KEYUP = 3
        
        # Colors
        self.Color = lambda *args: args[0] if len(args) == 1 else args
        
    def init(self):
        pass
    
    def quit(self):
        pass
    
    def Rect(self, x, y, width, height):
        return FakeRect(x, y, width, height)
    
    def Surface(self, size):
        return FakeSurface(size)

# Create singleton instance
pygame = FakePygame()