interface GameObject {
  type: string;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface SimulationResult {
  fps: number;
  objects: GameObject[];
}

// Mock Surface class for pygame.image.load() compatibility
class MockSurface {
  public width: number;
  public height: number;
  public size: [number, number];

  constructor(width = 100, height = 100) {
    this.width = width;
    this.height = height;
    this.size = [width, height];
  }

  get_width() { return this.width; }
  get_height() { return this.height; }
  get_size() { return this.size; }
  get_rect() {
    return {
      x: 0, y: 0, width: this.width, height: this.height,
      left: 0, top: 0, right: this.width, bottom: this.height
    };
  }
  convert() { return this; }
  convert_alpha() { return this; }
}

// Mock Sound class for pygame.mixer.Sound() compatibility
class MockSound {
  private volume: number = 1.0;

  play() { /* Silent mock */ }
  stop() { /* Silent mock */ }
  set_volume(vol: number) { this.volume = vol; }
  get_volume() { return this.volume; }
}

// Main pygame shim object that mimics pygame module structure
export const pygameShim = {
  // Core pygame functions
  init() { return true; },
  quit() { /* Silent mock */ },
  
  // Display module
  display: {
    set_mode(size: [number, number] = [800, 600]) {
      return new MockSurface(size[0], size[1]);
    },
    set_caption(title: string) { /* Silent mock */ },
    flip() { /* Silent mock */ },
    update() { /* Silent mock */ }
  },

  // Image module
  image: {
    load(filename: string) {
      // Return a mock surface for any image load
      return new MockSurface(64, 64); // Default sprite size
    }
  },

  // Mixer module for sounds
  mixer: {
    init() { return true; },
    quit() { /* Silent mock */ },
    Sound(file: string) {
      return new MockSound();
    }
  },

  // Draw module
  draw: {
    circle(surface: any, color: any, pos: [number, number], radius: number) { /* Silent mock */ },
    rect(surface: any, color: any, rect: any) { /* Silent mock */ },
    line(surface: any, color: any, start: [number, number], end: [number, number]) { /* Silent mock */ }
  },

  // Event module
  event: {
    get() { return []; },
    pump() { /* Silent mock */ }
  },

  // Key module
  key: {
    get_pressed() { return []; }
  },

  // Transform module
  transform: {
    scale(surface: MockSurface, size: [number, number]) {
      return new MockSurface(size[0], size[1]);
    }
  },

  // Common color constants
  Color: {
    RED: [255, 0, 0],
    GREEN: [0, 255, 0],
    BLUE: [0, 0, 255],
    WHITE: [255, 255, 255],
    BLACK: [0, 0, 0],
    YELLOW: [255, 255, 0]
  }
};

// Function to register pygame shim in Pyodide
export function registerPygameShim(pyodide: any) {
  try {
    // Create a minimal pygame module that can be imported
    pyodide.runPython(`
import sys
from pyodide.ffi import create_proxy

# Create a mock pygame module structure
class MockPygame:
    def __init__(self):
        self.QUIT = 12
        self.KEYDOWN = 2
        self.MOUSEBUTTONDOWN = 5
    
    def init(self):
        return True
    
    def quit(self):
        pass

class MockDisplay:
    def set_mode(self, size=(800, 600)):
        return MockSurface(size[0], size[1])
    
    def set_caption(self, title):
        pass
    
    def flip(self):
        pass
    
    def update(self):
        pass

class MockSurface:
    def __init__(self, width=800, height=600):
        self.width = width
        self.height = height
        self.size = (width, height)
    
    def get_width(self):
        return self.width
    
    def get_height(self):
        return self.height
    
    def get_size(self):
        return self.size
    
    def get_rect(self):
        return MockRect(0, 0, self.width, self.height)
    
    def convert(self):
        return self
    
    def convert_alpha(self):
        return self

class MockRect:
    def __init__(self, x=0, y=0, width=100, height=100):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.left = x
        self.top = y
        self.right = x + width
        self.bottom = y + height

class MockImage:
    def load(self, filename):
        return MockSurface(64, 64)

class MockSound:
    def __init__(self, file=None):
        self.volume = 1.0
    
    def play(self):
        pass
    
    def stop(self):
        pass
    
    def set_volume(self, vol):
        self.volume = vol
    
    def get_volume(self):
        return self.volume

class MockMixer:
    def init(self):
        return True
    
    def quit(self):
        pass
    
    def Sound(self, file):
        return MockSound(file)

class MockDraw:
    def circle(self, surface, color, pos, radius):
        pass
    
    def rect(self, surface, color, rect):
        pass
    
    def line(self, surface, color, start, end):
        pass

class MockEvent:
    def get(self):
        return []
    
    def pump(self):
        pass

class MockKey:
    def get_pressed(self):
        return []

class MockTransform:
    def scale(self, surface, size):
        return MockSurface(size[0], size[1])

# Create the pygame module structure
pygame = MockPygame()
pygame.display = MockDisplay()
pygame.image = MockImage()
pygame.mixer = MockMixer()
pygame.draw = MockDraw()
pygame.event = MockEvent()
pygame.key = MockKey()
pygame.transform = MockTransform()

# Add to sys.modules so it can be imported
sys.modules['pygame'] = pygame
`);
    
    console.log("Pygame shim registered successfully");
    return true;
  } catch (error) {
    console.warn("Failed to register pygame shim:", error);
    return false;
  }
}

export function simulatePygame(code: string): SimulationResult {
  const result: SimulationResult = {
    fps: 60,
    objects: []
  };

  // Simple simulation based on code analysis
  try {
    // Extract basic pygame drawing commands from code
    const lines = code.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for circle drawing
      if (trimmed.includes('pygame.draw.circle') || trimmed.includes('draw.circle')) {
        const match = trimmed.match(/circle\([^,]+,\s*([^,]+),\s*\(([^,]+),\s*([^)]+)\),\s*([^)]+)/);
        if (match) {
          const x = parseFloat(match[2]) || 400;
          const y = parseFloat(match[3]) || 300;
          const radius = parseFloat(match[4]) || 25;
          
          result.objects.push({
            type: 'circle',
            x: x,
            y: y,
            color: getColorFromCode(line, '#0066FF'),
            size: radius
          });
        } else {
          // Default circle if we can't parse exactly
          result.objects.push({
            type: 'circle',
            x: 400,
            y: 300,
            color: '#0066FF',
            size: 25
          });
        }
      }
      
      // Look for rectangle drawing
      if (trimmed.includes('pygame.draw.rect') || trimmed.includes('draw.rect')) {
        result.objects.push({
          type: 'rect',
          x: 300,
          y: 200,
          color: '#FF0000',
          size: 50
        });
      }
    }
    
    // If movement variables are present, simulate animation
    if (code.includes('speed') || code.includes('velocity')) {
      result.objects = result.objects.map(obj => ({
        ...obj,
        x: obj.x + (Math.sin(Date.now() / 1000) * 50),
        y: obj.y + (Math.cos(Date.now() / 1000) * 30)
      }));
    }
    
  } catch (error) {
    console.warn('Error simulating pygame code:', error);
  }

  return result;
}

function getColorFromCode(line: string, defaultColor: string): string {
  // Simple color detection
  if (line.includes('BLUE') || line.includes('(0, 100, 255)')) return '#0066FF';
  if (line.includes('RED') || line.includes('(255, 0, 0)')) return '#FF0000';
  if (line.includes('GREEN') || line.includes('(0, 255, 0)')) return '#00FF00';
  if (line.includes('WHITE') || line.includes('(255, 255, 255)')) return '#FFFFFF';
  if (line.includes('BLACK') || line.includes('(0, 0, 0)')) return '#000000';
  if (line.includes('YELLOW') || line.includes('(255, 255, 0)')) return '#FFFF00';
  
  return defaultColor;
}
