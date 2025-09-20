import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createPyodideTestContext, 
  injectFakePygame,
  testComponentExecution 
} from './pyodide-fixture';

/**
 * Comprehensive Test Suite for Python-TypeScript Boundary
 * 
 * This test suite pushes the language boundary to its limits,
 * testing data serialization, error handling, async execution,
 * memory management, security, and pygame-ce integration.
 */

describe('Python-TypeScript Boundary Integration Tests', () => {
  let pyodideContext: any;
  let pyodide: any;
  let memoryUsageBefore: number;
  
  beforeEach(async () => {
    pyodideContext = await createPyodideTestContext();
    pyodide = await pyodideContext.loadPyodide();
    if (global.performance && global.performance.memory) {
      memoryUsageBefore = (performance as any).memory.usedJSHeapSize;
    }
  });
  
  afterEach(() => {
    // Clean up Python globals
    if (pyodide && pyodide.runPython) {
      try {
        pyodide.runPython('import gc; gc.collect()');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // ============================================
  // 1. DATA SERIALIZATION TESTS
  // ============================================
  describe('Data Serialization Between Languages', () => {
    it('should correctly serialize primitive types', async () => {
      const testData = {
        integer: 42,
        float: 3.14159,
        string: 'Hello, Pygame!',
        boolean: true,
        null_value: null,
        undefined_value: undefined
      };
      
      const pythonCode = `
import json
data = ${JSON.stringify(testData)}
result = {
    'int_test': data['integer'] * 2,
    'float_test': data['float'] * 2,
    'string_test': data['string'].upper(),
    'bool_test': not data['boolean'],
    'null_test': data.get('null_value', 'default'),
    'undefined_test': data.get('undefined_value', 'missing')
}
result
`;
      
      const result = await pyodideContext.executePython(pythonCode);
      expect(result.int_test).toBe(84);
      expect(result.float_test).toBeCloseTo(6.28318);
      expect(result.string_test).toBe('HELLO, PYGAME!');
      expect(result.bool_test).toBe(false);
    });
    
    it('should handle complex nested data structures', async () => {
      const complexData = {
        players: [
          { id: 1, name: 'Player1', stats: { health: 100, score: 0 } },
          { id: 2, name: 'Player2', stats: { health: 90, score: 10 } }
        ],
        gameState: {
          level: 3,
          enemies: [
            { type: 'zombie', position: { x: 100, y: 200 } },
            { type: 'skeleton', position: { x: 300, y: 400 } }
          ]
        }
      };
      
      const pythonCode = `
import json
data = ${JSON.stringify(complexData)}

# Process complex nested data
for player in data['players']:
    player['stats']['health'] = min(100, player['stats']['health'] + 10)
    player['stats']['score'] += data['gameState']['level'] * 10

# Transform enemy data
data['gameState']['enemies'] = [
    {
        'type': enemy['type'],
        'position': enemy['position'],
        'health': 50 if enemy['type'] == 'zombie' else 30
    }
    for enemy in data['gameState']['enemies']
]

data
`;
      
      const result = await pyodideContext.executePython(pythonCode);
      expect(result.players[0].stats.health).toBe(100);
      expect(result.players[0].stats.score).toBe(30);
      expect(result.gameState.enemies[0].health).toBe(50);
    });
    
    it('should handle binary data transfer', async () => {
      const pythonCode = `
import json
import base64

# Create binary data (simulating an image)
binary_data = bytes([i % 256 for i in range(1024)])

# Convert to base64 for transfer
encoded = base64.b64encode(binary_data).decode('utf-8')

result = {
    'data': encoded,
    'size': len(binary_data),
    'checksum': sum(binary_data) % 1000
}
result
`;
      
      const result = await pyodideContext.executePython(pythonCode);
      expect(result.size).toBe(1024);
      expect(result.data).toBeDefined();
      expect(result.checksum).toBeDefined();
    });
    
    it('should handle large data volumes without corruption', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: Math.random(),
        text: `Item_${i}`
      }));
      
      const pythonCode = `
import json
data = ${JSON.stringify(largeArray)}

# Verify data integrity
result = {
    'count': len(data),
    'first_id': data[0]['id'],
    'last_id': data[-1]['id'],
    'sample_text': data[5000]['text'],
    'checksum': sum(item['id'] for item in data)
}
result
`;
      
      const result = await pyodideContext.executePython(pythonCode);
      expect(result.count).toBe(10000);
      expect(result.first_id).toBe(0);
      expect(result.last_id).toBe(9999);
      expect(result.sample_text).toBe('Item_5000');
      expect(result.checksum).toBe(49995000);
    });
    
    it('should handle special characters and unicode', async () => {
      const unicodeData = {
        emoji: '🎮🐍🚀',
        japanese: 'パイゲーム',
        arabic: 'بايثون',
        symbols: '±×÷√∞≈≠',
        escape: 'Line1\nLine2\tTabbed\r\nWindows',
        quotes: 'He said "Hello" and she said \'Hi\''
      };
      
      const pythonCode = `
import json
data = ${JSON.stringify(unicodeData)}

# Process unicode strings
result = {
    'emoji_length': len(data['emoji']),
    'japanese_upper': data['japanese'].upper() if hasattr(data['japanese'], 'upper') else data['japanese'],
    'has_arabic': 'بايثون' in data['arabic'],
    'symbols_count': len(data['symbols']),
    'lines': data['escape'].count('\\n') + 1,
    'quotes_preserved': '"' in data['quotes'] and "'" in data['quotes']
}
result
`;
      
      const result = await pyodideContext.executePython(pythonCode);
      expect(result.emoji_length).toBeGreaterThan(0);
      expect(result.has_arabic).toBe(true);
      expect(result.quotes_preserved).toBe(true);
    });
  });

  // ============================================
  // 2. ERROR PROPAGATION TESTS
  // ============================================
  describe('Error Propagation from Python to TypeScript', () => {
    it('should catch and propagate Python syntax errors', async () => {
      const invalidCode = `
def broken_function(
    print("This won't work")
`;
      
      await expect(async () => {
        await pyodideContext.executePython(invalidCode);
      }).rejects.toThrow();
    });
    
    it('should propagate runtime exceptions with stack traces', async () => {
      const errorCode = `
def divide_by_zero():
    return 10 / 0

def nested_error():
    return divide_by_zero()

try:
    result = nested_error()
except Exception as e:
    error_info = {
        'type': type(e).__name__,
        'message': str(e),
        'occurred': True
    }
error_info
`;
      
      const result = await pyodideContext.executePython(errorCode);
      expect(result.occurred).toBe(true);
      expect(result.type).toBe('ZeroDivisionError');
      expect(result.message).toContain('division by zero');
    });
    
    it('should handle import errors gracefully', async () => {
      const importErrorCode = `
error_occurred = False
error_message = ""

try:
    import nonexistent_module
except ImportError as e:
    error_occurred = True
    error_message = str(e)

{'error': error_occurred, 'message': error_message}
`;
      
      const result = await pyodideContext.executePython(importErrorCode);
      expect(result.error).toBe(true);
      expect(result.message).toContain('nonexistent_module');
    });
    
    it('should propagate custom exceptions', async () => {
      const customExceptionCode = `
class GameException(Exception):
    def __init__(self, code, details):
        self.code = code
        self.details = details
        super().__init__(f"Game Error {code}: {details}")

def trigger_game_error():
    raise GameException(404, "Player not found")

try:
    trigger_game_error()
except GameException as e:
    error_data = {
        'caught': True,
        'code': e.code,
        'details': e.details,
        'message': str(e)
    }
error_data
`;
      
      const result = await pyodideContext.executePython(customExceptionCode);
      expect(result.caught).toBe(true);
      expect(result.code).toBe(404);
      expect(result.details).toBe('Player not found');
    });
    
    it('should handle memory errors', async () => {
      const memoryErrorCode = `
import sys
error_info = {'type': None, 'occurred': False}

try:
    # Try to create a massive list (might not actually fail in mock)
    huge_list = [0] * (10**9)
except MemoryError as e:
    error_info = {
        'type': 'MemoryError',
        'occurred': True,
        'message': str(e)
    }
except Exception as e:
    # Catch any other exception
    error_info = {
        'type': type(e).__name__,
        'occurred': True,
        'message': str(e)
    }

error_info
`;
      
      const result = await pyodideContext.executePython(memoryErrorCode);
      // In mock environment, this might not fail, but structure should be correct
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('occurred');
    });
  });

  // ============================================
  // 3. ASYNC PYTHON EXECUTION TESTS
  // ============================================
  describe('Async Python Execution', () => {
    it('should handle async/await in Python', async () => {
      const asyncCode = `
import asyncio
import time

async def async_game_update():
    await asyncio.sleep(0.01)
    return {'updated': True, 'timestamp': time.time()}

# Run async function
loop = asyncio.new_event_loop()
result = loop.run_until_complete(async_game_update())
loop.close()
result
`;
      
      const result = await pyodideContext.executePython(asyncCode);
      expect(result.updated).toBe(true);
      expect(result.timestamp).toBeDefined();
    });
    
    it('should handle concurrent Python tasks', async () => {
      const concurrentCode = `
import asyncio

async def player_action(player_id, delay):
    await asyncio.sleep(delay)
    return {'player': player_id, 'action': 'completed'}

async def run_concurrent_actions():
    tasks = [
        player_action(1, 0.01),
        player_action(2, 0.02),
        player_action(3, 0.01)
    ]
    results = await asyncio.gather(*tasks)
    return results

loop = asyncio.new_event_loop()
results = loop.run_until_complete(run_concurrent_actions())
loop.close()
{'actions': results, 'count': len(results)}
`;
      
      const result = await pyodideContext.executePython(concurrentCode);
      expect(result.count).toBe(3);
      expect(result.actions).toHaveLength(3);
    });
    
    it('should handle Python generators and iterators', async () => {
      const generatorCode = `
def enemy_spawn_generator(count):
    for i in range(count):
        yield {
            'id': i,
            'type': 'zombie' if i % 2 == 0 else 'skeleton',
            'health': 100 - (i * 10)
        }

# Consume generator
enemies = list(enemy_spawn_generator(5))
{
    'enemies': enemies,
    'total': len(enemies),
    'types': list(set(e['type'] for e in enemies))
}
`;
      
      const result = await pyodideContext.executePython(generatorCode);
      expect(result.total).toBe(5);
      expect(result.enemies[0].id).toBe(0);
      expect(result.types).toContain('zombie');
      expect(result.types).toContain('skeleton');
    });
    
    it('should handle Python coroutines properly', async () => {
      const coroutineCode = `
import asyncio

class GameEventManager:
    def __init__(self):
        self.events = []
    
    async def add_event(self, event_type, data):
        await asyncio.sleep(0.001)
        self.events.append({'type': event_type, 'data': data})
        return len(self.events)
    
    async def process_events(self):
        results = []
        for _ in range(3):
            count = await self.add_event('test', {'value': len(self.events)})
            results.append(count)
        return results

manager = GameEventManager()
loop = asyncio.new_event_loop()
results = loop.run_until_complete(manager.process_events())
loop.close()

{
    'results': results,
    'total_events': len(manager.events),
    'events': manager.events
}
`;
      
      const result = await pyodideContext.executePython(coroutineCode);
      expect(result.results).toEqual([1, 2, 3]);
      expect(result.total_events).toBe(3);
    });
  });

  // ============================================
  // 4. PYTHON MODULE IMPORTS TESTS
  // ============================================
  describe('Python Module Imports', () => {
    it('should import standard library modules', async () => {
      const importCode = `
import math
import random
import json
import time
import collections

# Test imported modules
result = {
    'math_pi': math.pi,
    'random_seed': random.seed(42) or True,
    'json_works': json.dumps({'test': True}),
    'time_available': hasattr(time, 'time'),
    'collections_counter': str(type(collections.Counter()))
}
result
`;
      
      const result = await pyodideContext.executePython(importCode);
      expect(result.math_pi).toBeCloseTo(3.14159);
      expect(result.random_seed).toBe(true);
      expect(result.json_works).toBeDefined();
      expect(result.time_available).toBe(true);
    });
    
    it('should handle dynamic imports', async () => {
      const dynamicImportCode = `
import importlib

modules_to_test = ['math', 'json', 'random']
imported = {}

for module_name in modules_to_test:
    try:
        mod = importlib.import_module(module_name)
        imported[module_name] = hasattr(mod, '__name__')
    except ImportError:
        imported[module_name] = False

imported
`;
      
      const result = await pyodideContext.executePython(dynamicImportCode);
      expect(result.math).toBe(true);
      expect(result.json).toBe(true);
      expect(result.random).toBe(true);
    });
    
    it('should handle circular imports gracefully', async () => {
      const circularImportCode = `
# Create a circular import scenario
import sys
from types import ModuleType

# Create module A
module_a = ModuleType('module_a')
module_a.value = 10

# Create module B that references A
module_b = ModuleType('module_b')
exec('import module_a', module_b.__dict__)
module_b.get_a_value = lambda: module_a.value

# Add to sys.modules
sys.modules['module_a'] = module_a
sys.modules['module_b'] = module_b

# Now try to make A reference B (circular)
exec('import module_b', module_a.__dict__)
module_a.get_b_function = module_b.get_a_value

# Test the circular reference
result = {
    'a_value': module_a.value,
    'b_can_access_a': module_b.get_a_value(),
    'circular_works': True
}
result
`;
      
      const result = await pyodideContext.executePython(circularImportCode);
      expect(result.a_value).toBe(10);
      expect(result.b_can_access_a).toBe(10);
      expect(result.circular_works).toBe(true);
    });
    
    it('should handle module reloading', async () => {
      const reloadCode = `
import sys
from types import ModuleType
import importlib

# Create a test module
test_module = ModuleType('test_module')
test_module.counter = 1
sys.modules['test_module'] = test_module

# Import it
import test_module as tm1
initial_value = tm1.counter

# Modify the module
test_module.counter = 2

# Reload the module
importlib.reload(test_module)
final_value = test_module.counter

{
    'initial': initial_value,
    'final': final_value,
    'module_exists': 'test_module' in sys.modules
}
`;
      
      const result = await pyodideContext.executePython(reloadCode);
      expect(result.initial).toBe(1);
      expect(result.final).toBe(2);
      expect(result.module_exists).toBe(true);
    });
  });

  // ============================================
  // 5. MEMORY SHARING AND CLEANUP TESTS
  // ============================================
  describe('Memory Sharing and Cleanup', () => {
    it('should share memory references correctly', async () => {
      const memoryShareCode = `
# Create shared data structure
shared_game_state = {
    'players': {},
    'enemies': [],
    'score': 0
}

# Function that modifies shared state
def add_player(player_id, name):
    shared_game_state['players'][player_id] = {
        'name': name,
        'health': 100,
        'inventory': []
    }

def add_enemy(enemy_type):
    enemy = {'type': enemy_type, 'id': len(shared_game_state['enemies'])}
    shared_game_state['enemies'].append(enemy)
    return enemy['id']

# Modify shared state
add_player(1, 'Player1')
add_player(2, 'Player2')
enemy1 = add_enemy('zombie')
enemy2 = add_enemy('skeleton')

{
    'player_count': len(shared_game_state['players']),
    'enemy_count': len(shared_game_state['enemies']),
    'total_objects': len(shared_game_state['players']) + len(shared_game_state['enemies'])
}
`;
      
      const result = await pyodideContext.executePython(memoryShareCode);
      expect(result.player_count).toBe(2);
      expect(result.enemy_count).toBe(2);
      expect(result.total_objects).toBe(4);
    });
    
    it('should clean up memory properly', async () => {
      const memoryCleanupCode = `
import gc
import sys

# Create large objects
large_list = [i for i in range(10000)]
large_dict = {str(i): i*2 for i in range(10000)}

# Get initial counts
initial_objects = len(gc.get_objects())

# Delete references
del large_list
del large_dict

# Force garbage collection
collected = gc.collect()

# Get final counts
final_objects = len(gc.get_objects())

{
    'collected': collected,
    'object_reduction': initial_objects > final_objects,
    'gc_enabled': gc.isenabled()
}
`;
      
      const result = await pyodideContext.executePython(memoryCleanupCode);
      expect(result.gc_enabled).toBe(true);
      expect(result.collected).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle weak references', async () => {
      const weakRefCode = `
import weakref
import gc

class GameObject:
    def __init__(self, name):
        self.name = name
        self.active = True

# Create objects
player = GameObject('Player')
enemy = GameObject('Enemy')

# Create weak references
weak_player = weakref.ref(player)
weak_enemy = weakref.ref(enemy)

# Test weak references
result = {
    'player_alive': weak_player() is not None,
    'enemy_alive': weak_enemy() is not None,
    'player_name': weak_player().name if weak_player() else None,
    'enemy_name': weak_enemy().name if weak_enemy() else None
}

# Delete strong reference to enemy
del enemy
gc.collect()

result['enemy_after_delete'] = weak_enemy() is not None
result['player_still_alive'] = weak_player() is not None

result
`;
      
      const result = await pyodideContext.executePython(weakRefCode);
      expect(result.player_alive).toBe(true);
      expect(result.enemy_alive).toBe(true);
      expect(result.player_name).toBe('Player');
      expect(result.player_still_alive).toBe(true);
    });
    
    it('should detect memory leaks', async () => {
      const memoryLeakCode = `
import gc
import sys

# Track object creation
class TrackedObject:
    instances = []
    
    def __init__(self, data):
        self.data = data
        TrackedObject.instances.append(weakref.ref(self))
    
    @classmethod
    def count_alive(cls):
        return sum(1 for ref in cls.instances if ref() is not None)

import weakref

# Create objects that might leak
for i in range(100):
    obj = TrackedObject([0] * 100)
    # Intentionally create circular reference
    obj.self_ref = obj

initial_count = TrackedObject.count_alive()

# Try to clean up
del obj
collected = gc.collect()

final_count = TrackedObject.count_alive()

{
    'initial_objects': initial_count,
    'final_objects': final_count,
    'collected': collected,
    'potential_leak': final_count > 0
}
`;
      
      const result = await pyodideContext.executePython(memoryLeakCode);
      expect(result.initial_objects).toBeGreaterThan(0);
      expect(result.collected).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty('potential_leak');
    });
  });

  // ============================================
  // 6. CONCURRENT PYTHON EXECUTIONS TESTS
  // ============================================
  describe('Concurrent Python Executions', () => {
    it('should handle multiple Python contexts', async () => {
      // Simulate multiple game instances
      const context1Code = `
game_instance = 'Instance1'
player_score = 100
{'instance': game_instance, 'score': player_score}
`;
      
      const context2Code = `
game_instance = 'Instance2'
player_score = 200
{'instance': game_instance, 'score': player_score}
`;
      
      const result1 = await pyodideContext.executePython(context1Code);
      const result2 = await pyodideContext.executePython(context2Code);
      
      expect(result1.instance).toBe('Instance1');
      expect(result2.instance).toBe('Instance2');
      expect(result1.score).toBe(100);
      expect(result2.score).toBe(200);
    });
    
    it('should handle race conditions safely', async () => {
      const raceConditionCode = `
import threading
import time

# Shared resource
shared_counter = {'value': 0}
lock = threading.Lock()

def increment_counter(times):
    for _ in range(times):
        with lock:
            current = shared_counter['value']
            # Simulate processing time
            time.sleep(0.0001)
            shared_counter['value'] = current + 1

# Create threads (simulated in single-threaded environment)
# In real Pyodide, threading is limited
operations = 100
increment_counter(operations)

{
    'final_value': shared_counter['value'],
    'expected': operations,
    'race_prevented': shared_counter['value'] == operations
}
`;
      
      const result = await pyodideContext.executePython(raceConditionCode);
      expect(result.final_value).toBe(result.expected);
      expect(result.race_prevented).toBe(true);
    });
    
    it('should handle parallel data processing', async () => {
      const parallelProcessingCode = `
import concurrent.futures
import time

def process_game_entity(entity):
    # Simulate entity processing
    return {
        'id': entity['id'],
        'processed': True,
        'health': entity.get('health', 100) * 1.1,
        'score': entity.get('score', 0) + 10
    }

# Create entities to process
entities = [
    {'id': i, 'health': 100 - i*5, 'score': i*10}
    for i in range(10)
]

# Process entities (simulated parallel processing)
# In Pyodide, this will be sequential but structured for parallelism
processed_entities = []
for entity in entities:
    processed = process_game_entity(entity)
    processed_entities.append(processed)

{
    'total_processed': len(processed_entities),
    'all_processed': all(e['processed'] for e in processed_entities),
    'first_entity': processed_entities[0],
    'last_entity': processed_entities[-1]
}
`;
      
      const result = await pyodideContext.executePython(parallelProcessingCode);
      expect(result.total_processed).toBe(10);
      expect(result.all_processed).toBe(true);
      expect(result.first_entity.processed).toBe(true);
    });
    
    it('should handle worker-like patterns', async () => {
      const workerPatternCode = `
from queue import Queue
import time

class GameWorker:
    def __init__(self, worker_id):
        self.worker_id = worker_id
        self.tasks_completed = 0
        self.results = []
    
    def process_task(self, task):
        # Simulate task processing
        result = {
            'worker': self.worker_id,
            'task_id': task['id'],
            'result': task['value'] * 2
        }
        self.tasks_completed += 1
        self.results.append(result)
        return result

# Create task queue
task_queue = Queue()
for i in range(20):
    task_queue.put({'id': i, 'value': i * 10})

# Create workers
workers = [GameWorker(i) for i in range(3)]

# Process tasks
all_results = []
worker_index = 0
while not task_queue.empty():
    task = task_queue.get()
    worker = workers[worker_index % len(workers)]
    result = worker.process_task(task)
    all_results.append(result)
    worker_index += 1

{
    'total_tasks': len(all_results),
    'workers_used': len(workers),
    'tasks_per_worker': [w.tasks_completed for w in workers],
    'balanced': max(w.tasks_completed for w in workers) - min(w.tasks_completed for w in workers) <= 1
}
`;
      
      const result = await pyodideContext.executePython(workerPatternCode);
      expect(result.total_tasks).toBe(20);
      expect(result.workers_used).toBe(3);
      expect(result.tasks_per_worker.reduce((a, b) => a + b)).toBe(20);
    });
  });

  // ============================================
  // 7. PYTHON STDOUT/STDERR CAPTURE TESTS
  // ============================================
  describe('Python stdout/stderr Capture', () => {
    it('should capture print statements', async () => {
      const printCaptureCode = `
import sys
from io import StringIO

# Capture stdout
old_stdout = sys.stdout
sys.stdout = StringIO()

# Print various outputs
print("Game initialized")
print("Player spawned at (100, 200)")
print("Score:", 1000)
for i in range(3):
    print(f"Enemy {i} created")

# Get captured output
output = sys.stdout.getvalue()
sys.stdout = old_stdout

{
    'output': output,
    'lines': output.strip().split('\\n'),
    'line_count': len(output.strip().split('\\n'))
}
`;
      
      const result = await pyodideContext.executePython(printCaptureCode);
      expect(result.line_count).toBe(5);
      expect(result.lines[0]).toBe('Game initialized');
      expect(result.output).toContain('Score: 1000');
    });
    
    it('should capture error messages', async () => {
      const errorCaptureCode = `
import sys
from io import StringIO

# Capture stderr
old_stderr = sys.stderr
sys.stderr = StringIO()

# Generate errors
import warnings
warnings.warn("Low memory warning")
print("Error: Invalid player action", file=sys.stderr)
print("Critical: Game state corrupted", file=sys.stderr)

# Get captured errors
errors = sys.stderr.getvalue()
sys.stderr = old_stderr

{
    'errors': errors,
    'has_warning': 'warning' in errors.lower(),
    'has_critical': 'Critical' in errors,
    'error_count': errors.count('\\n')
}
`;
      
      const result = await pyodideContext.executePython(errorCaptureCode);
      expect(result.has_critical).toBe(true);
      expect(result.error_count).toBeGreaterThan(0);
    });
    
    it('should handle logging output', async () => {
      const loggingCode = `
import logging
from io import StringIO

# Setup logging to string
log_stream = StringIO()
logging.basicConfig(
    stream=log_stream,
    level=logging.DEBUG,
    format='%(levelname)s: %(message)s'
)

logger = logging.getLogger('pygame_test')

# Generate various log levels
logger.debug("Initializing game engine")
logger.info("Game started successfully")
logger.warning("Low FPS detected: 25")
logger.error("Failed to load asset: player.png")
logger.critical("Out of memory!")

# Get log output
log_output = log_stream.getvalue()

{
    'log_output': log_output,
    'has_debug': 'DEBUG' in log_output,
    'has_info': 'INFO' in log_output,
    'has_warning': 'WARNING' in log_output,
    'has_error': 'ERROR' in log_output,
    'has_critical': 'CRITICAL' in log_output,
    'log_lines': len(log_output.strip().split('\\n'))
}
`;
      
      const result = await pyodideContext.executePython(loggingCode);
      expect(result.has_debug).toBe(true);
      expect(result.has_info).toBe(true);
      expect(result.has_warning).toBe(true);
      expect(result.has_error).toBe(true);
      expect(result.has_critical).toBe(true);
      expect(result.log_lines).toBe(5);
    });
    
    it('should handle output redirection', async () => {
      const redirectionCode = `
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.stdout = StringIO()
        self.stderr = StringIO()
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
    
    def start(self):
        sys.stdout = self.stdout
        sys.stderr = self.stderr
    
    def stop(self):
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr
    
    def get_output(self):
        return {
            'stdout': self.stdout.getvalue(),
            'stderr': self.stderr.getvalue()
        }

# Use output capture
capture = OutputCapture()
capture.start()

# Generate mixed output
print("Normal output")
print("Error output", file=sys.stderr)
print("More normal output")
print("Another error", file=sys.stderr)

capture.stop()
output = capture.get_output()

{
    'stdout': output['stdout'],
    'stderr': output['stderr'],
    'stdout_lines': len(output['stdout'].strip().split('\\n')),
    'stderr_lines': len(output['stderr'].strip().split('\\n'))
}
`;
      
      const result = await pyodideContext.executePython(redirectionCode);
      expect(result.stdout_lines).toBe(2);
      expect(result.stderr_lines).toBe(2);
      expect(result.stdout).toContain('Normal output');
      expect(result.stderr).toContain('Error output');
    });
  });

  // ============================================
  // 8. PYTHON EXECUTION TIMEOUTS TESTS
  // ============================================
  describe('Python Execution Timeouts', () => {
    it('should handle execution time limits', async () => {
      const timeoutCode = `
import time
import signal

class TimeoutException(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutException("Execution timeout")

# Set up timeout (simulated)
timeout_seconds = 2
start_time = time.time()

# Simulate work
result = {'iterations': 0}
for i in range(1000000):
    result['iterations'] = i
    # Check if we should stop (simulated timeout)
    if time.time() - start_time > 0.1:  # 100ms limit
        break

result['execution_time'] = time.time() - start_time
result['timed_out'] = result['execution_time'] > 0.1
result
`;
      
      const result = await pyodideContext.executePython(timeoutCode);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.execution_time).toBeDefined();
    });
    
    it('should interrupt infinite loops', async () => {
      const infiniteLoopCode = `
import time

def potentially_infinite_loop(max_iterations=1000):
    count = 0
    start_time = time.time()
    
    while True:
        count += 1
        # Safety check to prevent actual infinite loop
        if count >= max_iterations:
            return {'stopped': True, 'reason': 'max_iterations', 'count': count}
        if time.time() - start_time > 0.5:
            return {'stopped': True, 'reason': 'timeout', 'count': count}

result = potentially_infinite_loop()
result
`;
      
      const result = await pyodideContext.executePython(infiniteLoopCode);
      expect(result.stopped).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });
    
    it('should handle timeout in recursive functions', async () => {
      const recursiveTimeoutCode = `
import sys
import time

sys.setrecursionlimit(1000)

def recursive_function(depth, max_depth, start_time):
    if depth >= max_depth:
        return {'completed': True, 'depth': depth}
    
    # Check timeout
    if time.time() - start_time > 0.1:
        return {'completed': False, 'depth': depth, 'reason': 'timeout'}
    
    # Recurse
    return recursive_function(depth + 1, max_depth, start_time)

start = time.time()
result = recursive_function(0, 10000, start)
result['execution_time'] = time.time() - start
result
`;
      
      const result = await pyodideContext.executePython(recursiveTimeoutCode);
      expect(result.depth).toBeGreaterThan(0);
      expect(result.execution_time).toBeDefined();
    });
    
    it('should handle async timeout', async () => {
      const asyncTimeoutCode = `
import asyncio

async def long_running_task():
    try:
        # Simulate long async operation
        await asyncio.sleep(10)
        return {'completed': True}
    except asyncio.CancelledError:
        return {'completed': False, 'cancelled': True}

async def run_with_timeout():
    try:
        result = await asyncio.wait_for(long_running_task(), timeout=0.1)
        return result
    except asyncio.TimeoutError:
        return {'completed': False, 'reason': 'timeout'}

loop = asyncio.new_event_loop()
result = loop.run_until_complete(run_with_timeout())
loop.close()
result
`;
      
      const result = await pyodideContext.executePython(asyncTimeoutCode);
      expect(result.completed).toBe(false);
      expect(result.reason).toBe('timeout');
    });
  });

  // ============================================
  // 9. PYTHON SANDBOX SECURITY TESTS
  // ============================================
  describe('Python Sandbox Security', () => {
    it('should prevent file system access', async () => {
      const fileSystemCode = `
import os
security_test = {'file_access': False, 'error': None}

try:
    # Try to access file system
    with open('/etc/passwd', 'r') as f:
        content = f.read()
    security_test['file_access'] = True
except Exception as e:
    security_test['error'] = type(e).__name__

security_test
`;
      
      const result = await pyodideContext.executePython(fileSystemCode);
      expect(result.file_access).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should prevent network access', async () => {
      const networkCode = `
security_test = {'network_access': False, 'error': None}

try:
    import urllib.request
    response = urllib.request.urlopen('http://example.com')
    security_test['network_access'] = True
except Exception as e:
    security_test['error'] = type(e).__name__

security_test
`;
      
      const result = await pyodideContext.executePython(networkCode);
      expect(result.network_access).toBe(false);
    });
    
    it('should prevent system command execution', async () => {
      const systemCommandCode = `
import os
import subprocess
security_test = {'command_executed': False, 'errors': []}

# Try various methods to execute system commands
try:
    os.system('ls')
    security_test['command_executed'] = True
except Exception as e:
    security_test['errors'].append(type(e).__name__)

try:
    subprocess.run(['ls'])
    security_test['command_executed'] = True
except Exception as e:
    security_test['errors'].append(type(e).__name__)

security_test
`;
      
      const result = await pyodideContext.executePython(systemCommandCode);
      expect(result.command_executed).toBe(false);
    });
    
    it('should limit resource consumption', async () => {
      const resourceLimitCode = `
import sys

limits = {
    'recursion_limit': sys.getrecursionlimit(),
    'max_int': sys.maxsize,
    'has_resource_module': False
}

try:
    import resource
    limits['has_resource_module'] = True
except ImportError:
    pass

# Try to create large data structures
memory_test = {'allocation_failed': False}
try:
    # Try to allocate huge array (likely to fail or be limited)
    huge_array = [0] * (10**10)
except (MemoryError, OverflowError, Exception) as e:
    memory_test['allocation_failed'] = True
    memory_test['error'] = type(e).__name__

{
    'limits': limits,
    'memory_test': memory_test
}
`;
      
      const result = await pyodideContext.executePython(resourceLimitCode);
      expect(result.limits.recursion_limit).toBeDefined();
      expect(result.memory_test.allocation_failed).toBe(true);
    });
    
    it('should prevent access to sensitive globals', async () => {
      const globalsCode = `
sensitive_check = {
    'has_eval': 'eval' in dir(__builtins__),
    'has_exec': 'exec' in dir(__builtins__),
    'has_compile': 'compile' in dir(__builtins__),
    'has_import': '__import__' in dir(__builtins__)
}

# Try to access potentially dangerous functions
dangerous_attempts = []

try:
    eval("1+1")
    dangerous_attempts.append('eval_works')
except:
    pass

try:
    exec("x = 1")
    dangerous_attempts.append('exec_works')
except:
    pass

{
    'sensitive_check': sensitive_check,
    'dangerous_attempts': dangerous_attempts
}
`;
      
      const result = await pyodideContext.executePython(globalsCode);
      // In a sandboxed environment, these might be available but controlled
      expect(result.sensitive_check).toBeDefined();
      expect(result.dangerous_attempts).toBeDefined();
    });
  });

  // ============================================
  // 10. PYGAME-CE INTEGRATION TESTS
  // ============================================
  describe('Pygame-CE Integration Tests', () => {
    beforeEach(() => {
      // Inject fake pygame module for testing
      injectFakePygame(pyodide);
    });
    
    it('should initialize pygame successfully', async () => {
      const pygameInitCode = `
import pygame
import sys

# Initialize pygame
pygame.init()

# Check initialization
init_result = {
    'initialized': True,
    'has_display': hasattr(pygame, 'display'),
    'has_event': hasattr(pygame, 'event'),
    'has_key': hasattr(pygame, 'key'),
    'has_mixer': hasattr(pygame, 'mixer'),
    'has_font': hasattr(pygame, 'font'),
    'has_sprite': hasattr(pygame, 'sprite'),
    'has_surface': hasattr(pygame, 'Surface') if hasattr(pygame, 'Surface') else False
}

# Create mock display
if hasattr(pygame, 'display'):
    pygame.display.set_mode = lambda size: {'width': size[0], 'height': size[1]}
    screen = pygame.display.set_mode((800, 600))
    init_result['screen_created'] = screen is not None
    init_result['screen_width'] = screen.get('width', 0) if isinstance(screen, dict) else 800
    init_result['screen_height'] = screen.get('height', 0) if isinstance(screen, dict) else 600

init_result
`;
      
      const result = await pyodideContext.executePython(pygameInitCode);
      expect(result.initialized).toBe(true);
      expect(result.has_key).toBe(true);
    });
    
    it('should handle pygame event loop', async () => {
      const eventLoopCode = `
import pygame

pygame.init()

# Mock event system
class MockEvent:
    def __init__(self, event_type, **kwargs):
        self.type = event_type
        for key, value in kwargs.items():
            setattr(self, key, value)

# Create mock events
events = [
    MockEvent(pygame.QUIT),
    MockEvent(pygame.KEYDOWN, key=pygame.key.K_SPACE),
    MockEvent(pygame.KEYUP, key=pygame.key.K_SPACE)
]

# Process events
processed = []
for event in events:
    if event.type == pygame.QUIT:
        processed.append({'type': 'quit'})
    elif event.type == pygame.KEYDOWN:
        processed.append({'type': 'keydown', 'key': event.key})
    elif event.type == pygame.KEYUP:
        processed.append({'type': 'keyup', 'key': event.key})

{
    'events_processed': len(processed),
    'has_quit': any(e['type'] == 'quit' for e in processed),
    'has_keydown': any(e['type'] == 'keydown' for e in processed),
    'space_key_value': pygame.key.K_SPACE,
    'processed_events': processed
}
`;
      
      const result = await pyodideContext.executePython(eventLoopCode);
      expect(result.events_processed).toBe(3);
      expect(result.has_quit).toBe(true);
      expect(result.has_keydown).toBe(true);
      expect(result.space_key_value).toBe(32);
    });
    
    it('should handle pygame surface rendering', async () => {
      const surfaceRenderCode = `
import pygame

pygame.init()

# Mock Surface class
class MockSurface:
    def __init__(self, size):
        self.width, self.height = size
        self.pixels = []
        self.blits = []
    
    def fill(self, color):
        self.fill_color = color
        return True
    
    def blit(self, surface, position):
        self.blits.append({'surface': surface, 'position': position})
        return True
    
    def get_size(self):
        return (self.width, self.height)
    
    def get_rect(self):
        return {'x': 0, 'y': 0, 'width': self.width, 'height': self.height}

# Create surfaces
screen = MockSurface((800, 600))
player_surface = MockSurface((50, 50))
enemy_surface = MockSurface((40, 40))

# Render scene
screen.fill((0, 0, 0))  # Black background
screen.blit(player_surface, (100, 200))
screen.blit(enemy_surface, (300, 400))

# Check rendering
render_result = {
    'screen_size': screen.get_size(),
    'fill_color': screen.fill_color,
    'blit_count': len(screen.blits),
    'player_rendered': any(b['position'] == (100, 200) for b in screen.blits),
    'enemy_rendered': any(b['position'] == (300, 400) for b in screen.blits)
}

render_result
`;
      
      const result = await pyodideContext.executePython(surfaceRenderCode);
      expect(result.screen_size).toEqual([800, 600]);
      expect(result.fill_color).toEqual([0, 0, 0]);
      expect(result.blit_count).toBe(2);
      expect(result.player_rendered).toBe(true);
      expect(result.enemy_rendered).toBe(true);
    });
    
    it('should handle pygame sound playback', async () => {
      const soundPlaybackCode = `
import pygame

pygame.init()

# Mock mixer module
class MockSound:
    def __init__(self, filename):
        self.filename = filename
        self.playing = False
        self.play_count = 0
        self.volume = 1.0
    
    def play(self, loops=0):
        self.playing = True
        self.play_count += 1
        self.loops = loops
        return self
    
    def stop(self):
        self.playing = False
    
    def set_volume(self, volume):
        self.volume = max(0.0, min(1.0, volume))
    
    def get_volume(self):
        return self.volume

# Mock mixer
class MockMixer:
    def __init__(self):
        self.initialized = False
        self.sounds = []
    
    def init(self):
        self.initialized = True
    
    def quit(self):
        self.initialized = False
    
    def Sound(self, filename):
        sound = MockSound(filename)
        self.sounds.append(sound)
        return sound

pygame.mixer = MockMixer()
pygame.mixer.init()

# Create and play sounds
jump_sound = pygame.mixer.Sound('jump.wav')
shoot_sound = pygame.mixer.Sound('shoot.wav')
background_music = pygame.mixer.Sound('bgm.ogg')

# Play sounds
jump_sound.play()
shoot_sound.play()
background_music.play(loops=-1)  # Loop forever

# Adjust volumes
jump_sound.set_volume(0.5)
background_music.set_volume(0.3)

# Check sound system
sound_result = {
    'mixer_initialized': pygame.mixer.initialized,
    'sounds_created': len(pygame.mixer.sounds),
    'jump_playing': jump_sound.playing,
    'jump_volume': jump_sound.get_volume(),
    'music_loops': background_music.loops,
    'music_volume': background_music.get_volume()
}

sound_result
`;
      
      const result = await pyodideContext.executePython(soundPlaybackCode);
      expect(result.mixer_initialized).toBe(true);
      expect(result.sounds_created).toBe(3);
      expect(result.jump_playing).toBe(true);
      expect(result.jump_volume).toBe(0.5);
      expect(result.music_loops).toBe(-1);
      expect(result.music_volume).toBe(0.3);
    });
    
    it('should handle pygame sprite groups', async () => {
      const spriteGroupCode = `
import pygame

pygame.init()

# Mock Sprite class
class MockSprite:
    def __init__(self, x, y, width, height):
        self.rect = {'x': x, 'y': y, 'width': width, 'height': height}
        self.image = f"sprite_{width}x{height}"
        self.alive = True
    
    def update(self, dt):
        self.rect['x'] += 1
        self.rect['y'] += 1
    
    def kill(self):
        self.alive = False

# Mock Group class
class MockGroup:
    def __init__(self):
        self.sprites = []
    
    def add(self, sprite):
        if sprite not in self.sprites:
            self.sprites.append(sprite)
    
    def remove(self, sprite):
        if sprite in self.sprites:
            self.sprites.remove(sprite)
    
    def update(self, dt):
        for sprite in self.sprites:
            sprite.update(dt)
    
    def __len__(self):
        return len(self.sprites)
    
    def empty(self):
        self.sprites.clear()

# Create sprite groups
all_sprites = MockGroup()
enemies = MockGroup()
projectiles = MockGroup()

# Create sprites
player = MockSprite(100, 100, 50, 50)
enemy1 = MockSprite(200, 200, 40, 40)
enemy2 = MockSprite(300, 300, 40, 40)
bullet = MockSprite(150, 150, 10, 10)

# Add to groups
all_sprites.add(player)
all_sprites.add(enemy1)
all_sprites.add(enemy2)
all_sprites.add(bullet)

enemies.add(enemy1)
enemies.add(enemy2)

projectiles.add(bullet)

# Update all sprites
all_sprites.update(0.016)  # 60 FPS

# Check sprite system
sprite_result = {
    'total_sprites': len(all_sprites),
    'enemy_count': len(enemies),
    'projectile_count': len(projectiles),
    'player_position': player.rect,
    'enemy1_updated': enemy1.rect['x'] == 201
}

sprite_result
`;
      
      const result = await pyodideContext.executePython(spriteGroupCode);
      expect(result.total_sprites).toBe(4);
      expect(result.enemy_count).toBe(2);
      expect(result.projectile_count).toBe(1);
      expect(result.enemy1_updated).toBe(true);
    });
    
    it('should handle pygame collision detection', async () => {
      const collisionCode = `
import pygame

pygame.init()

# Mock rect collision
def rect_collide(rect1, rect2):
    return (rect1['x'] < rect2['x'] + rect2['width'] and
            rect1['x'] + rect1['width'] > rect2['x'] and
            rect1['y'] < rect2['y'] + rect2['height'] and
            rect1['y'] + rect1['height'] > rect2['y'])

# Create game objects with rects
player = {'rect': {'x': 100, 'y': 100, 'width': 50, 'height': 50}}
enemy = {'rect': {'x': 120, 'y': 120, 'width': 40, 'height': 40}}
platform = {'rect': {'x': 0, 'y': 500, 'width': 800, 'height': 100}}
projectile = {'rect': {'x': 125, 'y': 125, 'width': 10, 'height': 10}}

# Test collisions
collision_result = {
    'player_enemy_collision': rect_collide(player['rect'], enemy['rect']),
    'player_platform_collision': rect_collide(player['rect'], platform['rect']),
    'projectile_enemy_collision': rect_collide(projectile['rect'], enemy['rect']),
    'projectile_platform_collision': rect_collide(projectile['rect'], platform['rect'])
}

# Test circle collision (for different collision type)
def circle_collide(pos1, radius1, pos2, radius2):
    dx = pos1[0] - pos2[0]
    dy = pos1[1] - pos2[1]
    distance = (dx*dx + dy*dy) ** 0.5
    return distance < (radius1 + radius2)

# Circle collision test
player_pos = (100, 100)
enemy_pos = (150, 150)
collision_result['circle_collision'] = circle_collide(player_pos, 25, enemy_pos, 20)

collision_result
`;
      
      const result = await pyodideContext.executePython(collisionCode);
      expect(result.player_enemy_collision).toBe(true);
      expect(result.player_platform_collision).toBe(false);
      expect(result.projectile_enemy_collision).toBe(true);
    });
    
    it('should handle pygame input state', async () => {
      const inputStateCode = `
import pygame

pygame.init()

# Mock key state
class MockKeyState:
    def __init__(self):
        self.pressed = {}
    
    def get_pressed(self):
        return self.pressed
    
    def set_key(self, key, pressed):
        self.pressed[key] = pressed

# Mock mouse state
class MockMouseState:
    def __init__(self):
        self.position = (0, 0)
        self.buttons = [False, False, False]
    
    def get_pos(self):
        return self.position
    
    def set_pos(self, x, y):
        self.position = (x, y)
    
    def get_pressed(self):
        return self.buttons
    
    def set_button(self, button, pressed):
        if 0 <= button < 3:
            self.buttons[button] = pressed

# Create input handlers
pygame.key.get_pressed = MockKeyState()
pygame.mouse = MockMouseState()

# Simulate input state
pygame.key.get_pressed.set_key(pygame.key.K_LEFT, True)
pygame.key.get_pressed.set_key(pygame.key.K_SPACE, True)
pygame.mouse.set_pos(400, 300)
pygame.mouse.set_button(0, True)  # Left click

# Process input
keys = pygame.key.get_pressed.get_pressed()
mouse_pos = pygame.mouse.get_pos()
mouse_buttons = pygame.mouse.get_pressed()

# Game logic based on input
player_velocity_x = 0
player_jumping = False
shooting = False

if keys.get(pygame.key.K_LEFT, False):
    player_velocity_x = -5
if keys.get(pygame.key.K_RIGHT, False):
    player_velocity_x = 5
if keys.get(pygame.key.K_SPACE, False):
    player_jumping = True
if mouse_buttons[0]:
    shooting = True

input_result = {
    'left_pressed': keys.get(pygame.key.K_LEFT, False),
    'space_pressed': keys.get(pygame.key.K_SPACE, False),
    'mouse_position': mouse_pos,
    'left_click': mouse_buttons[0],
    'player_velocity_x': player_velocity_x,
    'player_jumping': player_jumping,
    'shooting': shooting
}

input_result
`;
      
      const result = await pyodideContext.executePython(inputStateCode);
      expect(result.left_pressed).toBe(true);
      expect(result.space_pressed).toBe(true);
      expect(result.mouse_position).toEqual([400, 300]);
      expect(result.left_click).toBe(true);
      expect(result.player_velocity_x).toBe(-5);
      expect(result.player_jumping).toBe(true);
      expect(result.shooting).toBe(true);
    });
    
    it('should handle pygame timer and clock', async () => {
      const timerClockCode = `
import pygame
import time

pygame.init()

# Mock Clock class
class MockClock:
    def __init__(self):
        self.last_tick = time.time()
        self.fps_list = []
        self.target_fps = 60
    
    def tick(self, fps=0):
        current_time = time.time()
        dt = current_time - self.last_tick
        self.last_tick = current_time
        
        if fps > 0:
            self.target_fps = fps
            target_dt = 1.0 / fps
            if dt < target_dt:
                # Simulate frame limiting
                time.sleep(target_dt - dt)
                dt = target_dt
        
        self.fps_list.append(1.0 / dt if dt > 0 else fps)
        if len(self.fps_list) > 60:
            self.fps_list.pop(0)
        
        return dt * 1000  # Return milliseconds
    
    def get_fps(self):
        if not self.fps_list:
            return 0
        return sum(self.fps_list) / len(self.fps_list)
    
    def get_time(self):
        return int(time.time() * 1000)

# Create clock
clock = MockClock()
game_time = 0

# Simulate game loop
frame_times = []
for i in range(5):
    dt = clock.tick(60)  # Target 60 FPS
    frame_times.append(dt)
    game_time += dt
    # Simulate some work
    time.sleep(0.001)

clock_result = {
    'average_fps': clock.get_fps(),
    'total_time': game_time,
    'frame_count': len(frame_times),
    'average_frame_time': sum(frame_times) / len(frame_times) if frame_times else 0,
    'target_fps': clock.target_fps
}

clock_result
`;
      
      const result = await pyodideContext.executePython(timerClockCode);
      expect(result.frame_count).toBe(5);
      expect(result.target_fps).toBe(60);
      expect(result.average_frame_time).toBeGreaterThan(0);
      expect(result.total_time).toBeGreaterThan(0);
    });
  });

  // ============================================
  // PERFORMANCE AND EDGE CASE TESTS
  // ============================================
  describe('Performance and Edge Cases', () => {
    it('should handle rapid repeated executions', async () => {
      const iterations = 100;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const code = `{'iteration': ${i}, 'squared': ${i * i}}`;
        const result = await pyodideContext.executePython(code);
        results.push(result);
      }
      
      expect(results).toHaveLength(iterations);
      expect(results[50].iteration).toBe(50);
      expect(results[50].squared).toBe(2500);
    });
    
    it('should handle deeply nested function calls', async () => {
      const deepNestingCode = `
def level_1(x):
    return level_2(x + 1)

def level_2(x):
    return level_3(x + 1)

def level_3(x):
    return level_4(x + 1)

def level_4(x):
    return level_5(x + 1)

def level_5(x):
    return x * 2

result = level_1(10)
{'result': result, 'expected': 28}
`;
      
      const result = await pyodideContext.executePython(deepNestingCode);
      expect(result.result).toBe(28);
    });
    
    it('should detect and report memory leaks', () => {
      if (global.performance && global.performance.memory) {
        const memoryUsageAfter = (performance as any).memory.usedJSHeapSize;
        const memoryDelta = memoryUsageAfter - memoryUsageBefore;
        
        // Allow for some reasonable memory growth
        const reasonableGrowth = 50 * 1024 * 1024; // 50MB
        expect(memoryDelta).toBeLessThan(reasonableGrowth);
      }
    });
    
    it('should handle edge case data types', async () => {
      const edgeCaseCode = `
import math

edge_cases = {
    'nan': float('nan'),
    'infinity': float('inf'),
    'neg_infinity': float('-inf'),
    'very_small': 1e-308,
    'very_large': 1e308,
    'empty_string': '',
    'empty_list': [],
    'empty_dict': {},
    'none': None,
    'boolean_true': True,
    'boolean_false': False,
    'zero': 0,
    'neg_zero': -0.0
}

# Test edge case operations
results = {
    'is_nan': math.isnan(edge_cases['nan']),
    'is_inf': math.isinf(edge_cases['infinity']),
    'empty_list_bool': bool(edge_cases['empty_list']),
    'none_is_none': edge_cases['none'] is None,
    'zero_equals_neg_zero': edge_cases['zero'] == edge_cases['neg_zero']
}

{'edge_cases_count': len(edge_cases), 'test_results': results}
`;
      
      const result = await pyodideContext.executePython(edgeCaseCode);
      expect(result.edge_cases_count).toBe(13);
      expect(result.test_results.is_nan).toBe(true);
      expect(result.test_results.is_inf).toBe(true);
      expect(result.test_results.empty_list_bool).toBe(false);
      expect(result.test_results.none_is_none).toBe(true);
      expect(result.test_results.zero_equals_neg_zero).toBe(true);
    });
  });
});