import { type User, type InsertUser, type Lesson, type InsertLesson, type UserProgress, type InsertUserProgress } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getLessons(): Promise<Lesson[]>;
  getLesson(id: string): Promise<Lesson | undefined>;
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  
  getUserProgress(userId: string): Promise<UserProgress[]>;
  getUserProgressForLesson(userId: string, lessonId: string): Promise<UserProgress | undefined>;
  updateUserProgress(userId: string, lessonId: string, progress: Partial<UserProgress>): Promise<UserProgress>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private lessons: Map<string, Lesson>;
  private userProgress: Map<string, UserProgress>;

  constructor() {
    this.users = new Map();
    this.lessons = new Map();
    this.userProgress = new Map();
    
    // Initialize with sample lessons
    this.initializeLessons();
  }

  private initializeLessons() {
    const sampleLessons: Lesson[] = [
      {
        id: "lesson-1",
        title: "Python Basics",
        description: "Variables, data types, and your first Python program",
        order: 1,
        intro: "🎮 Welcome to Python programming! Every great game starts with the basics. In this lesson, you'll learn about variables (like player scores and lives), data types, and how to display information on screen.",
        learningObjectives: [
          "Create and use variables to store game data",
          "Work with different data types (strings, numbers, booleans)",
          "Use print() to display game messages",
          "Get player input with input()",
          "Convert between data types"
        ],
        goalDescription: "Create your first interactive Python program that asks for a player's name and greets them!",
        previewCode: "player_name = input('Enter your name: ')\nprint(f'Welcome to the game, {player_name}!')",
        content: {
          introduction: "Python is a powerful language perfect for game development. Let's start with the fundamentals that every game programmer needs to know!",
          steps: [
            {
              id: "step-1",
              title: "Your First Game Message",
              description: "Let's start by displaying a welcome message for players. Use print() to show text on screen.",
              initialCode: "# Welcome players to your game!\n# Use print() to display a message\n",
              solution: "print('Welcome to Python Game Academy!')\nprint('Get ready to learn programming through games!')",
              hints: ["Use print() function", "Put text in quotes", "You can use single or double quotes"],
              tests: [
                {
                  expectedOutput: "Welcome to Python Game Academy!\nGet ready to learn programming through games!",
                  description: "Should display welcome messages"
                }
              ]
            },
            {
              id: "step-2",
              title: "Game Variables",
              description: "Games need to track data like scores, lives, and player names. Let's create variables to store this information.",
              initialCode: "# Create variables for:\n# - player_score (set to 0)\n# - player_lives (set to 3)\n# - game_title (set to 'Adventure Quest')\n# Then print each variable\n",
              solution: "player_score = 0\nplayer_lives = 3\ngame_title = 'Adventure Quest'\n\nprint(player_score)\nprint(player_lives)\nprint(game_title)",
              hints: ["Use = to assign values", "Variable names can't have spaces", "Print each variable separately"],
              tests: [
                {
                  expectedOutput: "0\n3\nAdventure Quest",
                  description: "Should create and display game variables"
                }
              ]
            },
            {
              id: "step-3",
              title: "Player Input",
              description: "Make your game interactive! Ask the player for their name and create a personalized greeting.",
              initialCode: "# Ask for the player's name using input()\n# Store it in a variable called player_name\n# Then print a welcome message that includes their name\n",
              solution: "player_name = input('Enter your name: ')\nprint('Welcome to the game, ' + player_name + '!')\nprint('Your adventure begins now!')",
              hints: ["Use input() to get text from player", "Store the result in a variable", "Use + to combine strings"],
              validation: {
                type: "function",
                expected: "Uses input() and print() with player name"
              }
            },
            {
              id: "step-4",
              title: "Data Types for Games",
              description: "Games use different types of data. Let's practice with numbers (int, float), text (str), and true/false values (bool).",
              initialCode: "# Create these game variables with the right types:\n# health_points = 100 (integer)\n# speed = 5.5 (float)\n# player_name = 'Hero' (string)\n# is_playing = True (boolean)\n# Print the type of each variable using type()\n",
              solution: "health_points = 100\nspeed = 5.5\nplayer_name = 'Hero'\nis_playing = True\n\nprint(type(health_points))\nprint(type(speed))\nprint(type(player_name))\nprint(type(is_playing))",
              hints: ["True and False must be capitalized", "Use type() to check data types", "Floats have decimal points"],
              tests: [
                {
                  expectedOutput: "<class 'int'>\n<class 'float'>\n<class 'str'>\n<class 'bool'>",
                  description: "Should create variables of different types"
                }
              ]
            }
          ]
        },
        prerequisites: [],
        difficulty: "Beginner",
        estimatedTime: 20
      },
      {
        id: "lesson-2",
        title: "Drawing & Movement",
        description: "Learn to draw shapes and create movement",
        order: 2,
        intro: "Time to bring your games to life with colorful graphics! 🎨 You'll learn to draw shapes on the screen and make them move in response to game logic.",
        learningObjectives: [
          "Draw basic shapes like circles and rectangles",
          "Work with colors using RGB values",
          "Create a game loop for continuous rendering",
          "Implement smooth movement and animation"
        ],
        goalDescription: "Create beautiful moving graphics that will form the foundation of your games!",
        previewCode: "pygame.draw.circle(screen, BLUE, (400, 300), 25)\n# A blue circle that can move!",
        content: {
          introduction: "Now let's learn how to draw shapes on the screen and make them move!",
          steps: [
            {
              id: "step-1",
              title: "Draw a Circle",
              description: "Draw a blue circle on the screen",
              initialCode: "import pygame\nimport sys\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\npygame.display.set_caption('Drawing Shapes')\n\n# Define colors\nWHITE = (255, 255, 255)\nBLUE = (0, 100, 255)\n\n# Game loop\nrunning = True\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    screen.fill(WHITE)\n    \n    # Draw circle here\n    \n    pygame.display.flip()\n\npygame.quit()",
              solution: "import pygame\nimport sys\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\npygame.display.set_caption('Drawing Shapes')\n\nWHITE = (255, 255, 255)\nBLUE = (0, 100, 255)\n\nrunning = True\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    screen.fill(WHITE)\n    pygame.draw.circle(screen, BLUE, (400, 300), 25)\n    pygame.display.flip()\n\npygame.quit()",
              hints: ["Use pygame.draw.circle()", "The parameters are: surface, color, center_position, radius"]
            }
          ]
        }
      },
      {
        id: "lesson-3",
        title: "User Input & Events",
        description: "Handle keyboard and mouse input",
        order: 3,
        intro: "Make your games interactive! 🎮 Learn how to capture player input and respond to keyboard and mouse events to create engaging gameplay.",
        learningObjectives: [
          "Capture keyboard input with arrow keys",
          "Handle mouse clicks and movement",
          "Respond to game events in real-time",
          "Control game objects with user input"
        ],
        goalDescription: "Transform static graphics into interactive games that respond to player commands!",
        previewCode: "keys = pygame.key.get_pressed()\nif keys[pygame.K_LEFT]:\n    player_x -= speed",
        content: {
          introduction: "Learn how to make your games interactive by handling user input!",
          steps: [
            {
              id: "step-1",
              title: "Keyboard Movement",
              description: "Move a circle with arrow keys",
              initialCode: "import pygame\nimport sys\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\n\nWHITE = (255, 255, 255)\nBLUE = (0, 100, 255)\n\ncircle_x = 400\ncircle_y = 300\n\nrunning = True\nclock = pygame.time.Clock()\n\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    # Handle keyboard input here\n    \n    screen.fill(WHITE)\n    pygame.draw.circle(screen, BLUE, (circle_x, circle_y), 25)\n    pygame.display.flip()\n    clock.tick(60)\n\npygame.quit()",
              solution: "import pygame\nimport sys\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\n\nWHITE = (255, 255, 255)\nBLUE = (0, 100, 255)\n\ncircle_x = 400\ncircle_y = 300\nspeed = 5\n\nrunning = True\nclock = pygame.time.Clock()\n\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    keys = pygame.key.get_pressed()\n    if keys[pygame.K_LEFT]:\n        circle_x -= speed\n    if keys[pygame.K_RIGHT]:\n        circle_x += speed\n    if keys[pygame.K_UP]:\n        circle_y -= speed\n    if keys[pygame.K_DOWN]:\n        circle_y += speed\n    \n    screen.fill(WHITE)\n    pygame.draw.circle(screen, BLUE, (circle_x, circle_y), 25)\n    pygame.display.flip()\n    clock.tick(60)\n\npygame.quit()",
              hints: ["Use pygame.key.get_pressed() to check key states", "Use pygame.K_LEFT, pygame.K_RIGHT, etc. for arrow keys", "Update circle_x and circle_y based on key presses"]
            }
          ]
        }
      },
      {
        id: "lesson-4",
        title: "Sprites & Animation",
        description: "Work with sprites and create animations",
        order: 4,
        intro: "Master the art of animation! 🎯 Create bouncing balls, rotating objects, and smooth animations that make your games feel professional.",
        learningObjectives: [
          "Create objects that move independently",
          "Implement collision detection with walls",
          "Add physics-like bouncing behavior",
          "Manage multiple animated objects"
        ],
        goalDescription: "Build a bouncing ball animation with realistic physics that forms the basis for many game mechanics!",
        previewCode: "# Ball bounces off walls\nif ball_x <= 0 or ball_x >= WIDTH:\n    ball_speed_x = -ball_speed_x",
        content: {
          introduction: "Learn about sprites and how to create smooth animations in your games.",
          steps: [
            {
              id: "step-1",
              title: "Bouncing Ball",
              description: "Create a ball that bounces off the walls",
              initialCode: "import pygame\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\n\nWHITE = (255, 255, 255)\nRED = (255, 0, 0)\n\nball_x = 400\nball_y = 300\nball_speed_x = 5\nball_speed_y = 3\nball_radius = 20\n\nrunning = True\nclock = pygame.time.Clock()\n\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    # Update ball position\n    ball_x += ball_speed_x\n    ball_y += ball_speed_y\n    \n    # Add collision detection here\n    \n    screen.fill(WHITE)\n    pygame.draw.circle(screen, RED, (int(ball_x), int(ball_y)), ball_radius)\n    pygame.display.flip()\n    clock.tick(60)\n\npygame.quit()",
              solution: "import pygame\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\n\nWHITE = (255, 255, 255)\nRED = (255, 0, 0)\n\nball_x = 400\nball_y = 300\nball_speed_x = 5\nball_speed_y = 3\nball_radius = 20\n\nrunning = True\nclock = pygame.time.Clock()\n\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    ball_x += ball_speed_x\n    ball_y += ball_speed_y\n    \n    # Bounce off walls\n    if ball_x <= ball_radius or ball_x >= 800 - ball_radius:\n        ball_speed_x = -ball_speed_x\n    if ball_y <= ball_radius or ball_y >= 600 - ball_radius:\n        ball_speed_y = -ball_speed_y\n    \n    screen.fill(WHITE)\n    pygame.draw.circle(screen, RED, (int(ball_x), int(ball_y)), ball_radius)\n    pygame.display.flip()\n    clock.tick(60)\n\npygame.quit()",
              hints: ["Check if ball_x is at the screen edges", "Reverse ball_speed_x when hitting left/right walls", "Reverse ball_speed_y when hitting top/bottom walls"]
            }
          ]
        }
      },
      {
        id: "lesson-5",
        title: "Game Logic & Scoring",
        description: "Add game logic, scoring, and win conditions",
        order: 5,
        intro: "Create a complete game experience! 🏆 Add scoring systems, win/lose conditions, and game logic to make a fully playable Pong game.",
        learningObjectives: [
          "Implement a scoring system",
          "Create paddle controls and AI opponent",
          "Add collision detection between objects",
          "Design win/lose conditions"
        ],
        goalDescription: "Build a fully functional Pong game with scoring, AI opponent, and smooth gameplay!",
        previewCode: "# Score when ball passes paddle\nif ball_x < 0:\n    score_right += 1\n    reset_ball()",
        content: {
          introduction: "Learn how to add scoring systems and game logic to make a complete game experience.",
          steps: [
            {
              id: "step-1",
              title: "Simple Pong Game",
              description: "Create a basic Pong game with scoring",
              initialCode: "import pygame\nimport random\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\npygame.display.set_caption('Pong Game')\nfont = pygame.font.Font(None, 74)\n\nWHITE = (255, 255, 255)\nBLACK = (0, 0, 0)\n\n# Game variables\nball_x = 400\nball_y = 300\nball_speed_x = 5 * random.choice([-1, 1])\nball_speed_y = 5 * random.choice([-1, 1])\n\npaddle_height = 100\npaddle_width = 20\npaddle_speed = 8\n\nleft_paddle_y = 250\nright_paddle_y = 250\n\nscore_left = 0\nscore_right = 0\n\nrunning = True\nclock = pygame.time.Clock()\n\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    keys = pygame.key.get_pressed()\n    \n    # Player controls (left paddle)\n    if keys[pygame.K_w] and left_paddle_y > 0:\n        left_paddle_y -= paddle_speed\n    if keys[pygame.K_s] and left_paddle_y < 600 - paddle_height:\n        left_paddle_y += paddle_speed\n    \n    # AI for right paddle (simple)\n    if ball_y < right_paddle_y + paddle_height // 2:\n        right_paddle_y -= paddle_speed // 2\n    if ball_y > right_paddle_y + paddle_height // 2:\n        right_paddle_y += paddle_speed // 2\n    \n    # Ball movement\n    ball_x += ball_speed_x\n    ball_y += ball_speed_y\n    \n    # Ball collision with top/bottom\n    if ball_y <= 10 or ball_y >= 590:\n        ball_speed_y = -ball_speed_y\n    \n    # Add paddle collision and scoring logic here\n    \n    # Draw everything\n    screen.fill(BLACK)\n    \n    # Draw paddles\n    pygame.draw.rect(screen, WHITE, (50, left_paddle_y, paddle_width, paddle_height))\n    pygame.draw.rect(screen, WHITE, (730, right_paddle_y, paddle_width, paddle_height))\n    \n    # Draw ball\n    pygame.draw.circle(screen, WHITE, (int(ball_x), int(ball_y)), 10)\n    \n    # Draw center line\n    for i in range(0, 600, 20):\n        pygame.draw.rect(screen, WHITE, (395, i, 10, 10))\n    \n    # Draw scores\n    score_text = font.render(f\"{score_left}   {score_right}\", True, WHITE)\n    screen.blit(score_text, (350, 50))\n    \n    pygame.display.flip()\n    clock.tick(60)\n\npygame.quit()",
              solution: "import pygame\nimport random\n\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\npygame.display.set_caption('Pong Game')\nfont = pygame.font.Font(None, 74)\n\nWHITE = (255, 255, 255)\nBLACK = (0, 0, 0)\n\nball_x = 400\nball_y = 300\nball_speed_x = 5 * random.choice([-1, 1])\nball_speed_y = 5 * random.choice([-1, 1])\n\npaddle_height = 100\npaddle_width = 20\npaddle_speed = 8\n\nleft_paddle_y = 250\nright_paddle_y = 250\n\nscore_left = 0\nscore_right = 0\n\nrunning = True\nclock = pygame.time.Clock()\n\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n    \n    keys = pygame.key.get_pressed()\n    \n    if keys[pygame.K_w] and left_paddle_y > 0:\n        left_paddle_y -= paddle_speed\n    if keys[pygame.K_s] and left_paddle_y < 600 - paddle_height:\n        left_paddle_y += paddle_speed\n    \n    if ball_y < right_paddle_y + paddle_height // 2:\n        right_paddle_y -= paddle_speed // 2\n    if ball_y > right_paddle_y + paddle_height // 2:\n        right_paddle_y += paddle_speed // 2\n    \n    ball_x += ball_speed_x\n    ball_y += ball_speed_y\n    \n    if ball_y <= 10 or ball_y >= 590:\n        ball_speed_y = -ball_speed_y\n    \n    # Paddle collision\n    if (ball_x <= 70 and left_paddle_y <= ball_y <= left_paddle_y + paddle_height):\n        ball_speed_x = -ball_speed_x\n    if (ball_x >= 730 and right_paddle_y <= ball_y <= right_paddle_y + paddle_height):\n        ball_speed_x = -ball_speed_x\n    \n    # Scoring\n    if ball_x < 0:\n        score_right += 1\n        ball_x, ball_y = 400, 300\n        ball_speed_x = 5 * random.choice([-1, 1])\n    if ball_x > 800:\n        score_left += 1\n        ball_x, ball_y = 400, 300\n        ball_speed_x = 5 * random.choice([-1, 1])\n    \n    screen.fill(BLACK)\n    \n    pygame.draw.rect(screen, WHITE, (50, left_paddle_y, paddle_width, paddle_height))\n    pygame.draw.rect(screen, WHITE, (730, right_paddle_y, paddle_width, paddle_height))\n    \n    pygame.draw.circle(screen, WHITE, (int(ball_x), int(ball_y)), 10)\n    \n    for i in range(0, 600, 20):\n        pygame.draw.rect(screen, WHITE, (395, i, 10, 10))\n    \n    score_text = font.render(f\"{score_left}   {score_right}\", True, WHITE)\n    screen.blit(score_text, (350, 50))\n    \n    pygame.display.flip()\n    clock.tick(60)\n\npygame.quit()",
              hints: ["Check collision with paddle rectangles", "Reset ball position when it goes off screen", "Increment scores when ball passes paddles"]
            }
          ]
        }
      },
      {
        id: "final-project",
        title: "Final Project",
        description: "Build your own complete game",
        order: 6,
        intro: "Time to create your masterpiece! 🚀 Use everything you've learned to build your own unique game from scratch.",
        learningObjectives: [
          "Design your own game concept",
          "Implement complete game mechanics",
          "Add creative features and polish",
          "Debug and optimize your creation"
        ],
        goalDescription: "Create your own complete game like Snake, Breakout, or something entirely original!",
        previewCode: "# Your creativity unleashed!\n# Snake? Space Invaders? Racing?\n# The choice is yours!",
        content: {
          introduction: "Put everything together to create your own unique game!",
          steps: [
            {
              id: "step-1",
              title: "Plan Your Game",
              description: "Design and implement your own game concept",
              initialCode: "# Create your own game here!\n# Ideas: Snake game, Breakout, Space Invaders, or something original\n\nimport pygame\nimport random\n\npygame.init()\n\n# Your game code goes here...",
              solution: "# Example: Simple Snake Game\nimport pygame\nimport random\n\npygame.init()\n\nWIDTH, HEIGHT = 800, 600\nscreen = pygame.display.set_mode((WIDTH, HEIGHT))\npygame.display.set_caption('Snake Game')\n\nBLACK = (0, 0, 0)\nGREEN = (0, 255, 0)\nRED = (255, 0, 0)\n\nblock_size = 20\nspeed = 10\n\nclock = pygame.time.Clock()\nfont = pygame.font.Font(None, 35)\n\ndef snake_game():\n    game_over = False\n    game_close = False\n    \n    x1 = WIDTH // 2\n    y1 = HEIGHT // 2\n    \n    x1_change = 0\n    y1_change = 0\n    \n    snake_list = []\n    length_of_snake = 1\n    \n    foodx = round(random.randrange(0, WIDTH - block_size) / 20.0) * 20.0\n    foody = round(random.randrange(0, HEIGHT - block_size) / 20.0) * 20.0\n    \n    while not game_over:\n        \n        while game_close:\n            screen.fill(BLACK)\n            message = font.render(\"Game Over! Press Q-Quit or C-Play Again\", True, RED)\n            screen.blit(message, [WIDTH/6, HEIGHT/3])\n            pygame.display.update()\n            \n            for event in pygame.event.get():\n                if event.type == pygame.KEYDOWN:\n                    if event.key == pygame.K_q:\n                        game_over = True\n                        game_close = False\n                    if event.key == pygame.K_c:\n                        snake_game()\n        \n        for event in pygame.event.get():\n            if event.type == pygame.QUIT:\n                game_over = True\n            if event.type == pygame.KEYDOWN:\n                if event.key == pygame.K_LEFT:\n                    x1_change = -block_size\n                    y1_change = 0\n                elif event.key == pygame.K_RIGHT:\n                    x1_change = block_size\n                    y1_change = 0\n                elif event.key == pygame.K_UP:\n                    y1_change = -block_size\n                    x1_change = 0\n                elif event.key == pygame.K_DOWN:\n                    y1_change = block_size\n                    x1_change = 0\n        \n        if x1 >= WIDTH or x1 < 0 or y1 >= HEIGHT or y1 < 0:\n            game_close = True\n        x1 += x1_change\n        y1 += y1_change\n        screen.fill(BLACK)\n        pygame.draw.rect(screen, RED, [foodx, foody, block_size, block_size])\n        \n        snake_head = []\n        snake_head.append(x1)\n        snake_head.append(y1)\n        snake_list.append(snake_head)\n        if len(snake_list) > length_of_snake:\n            del snake_list[0]\n        \n        for x in snake_list[:-1]:\n            if x == snake_head:\n                game_close = True\n        \n        for x in snake_list:\n            pygame.draw.rect(screen, GREEN, [x[0], x[1], block_size, block_size])\n        \n        pygame.display.update()\n        \n        if x1 == foodx and y1 == foody:\n            foodx = round(random.randrange(0, WIDTH - block_size) / 20.0) * 20.0\n            foody = round(random.randrange(0, HEIGHT - block_size) / 20.0) * 20.0\n            length_of_snake += 1\n        \n        clock.tick(speed)\n    \n    pygame.quit()\n\nsnake_game()",
              hints: ["Think about what type of game you want to create", "Start with simple mechanics and build up", "Consider games like Snake, Pong, or Breakout as starting points"]
            }
          ]
        }
      }
    ];

    sampleLessons.forEach(lesson => {
      this.lessons.set(lesson.id, lesson);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getLessons(): Promise<Lesson[]> {
    return Array.from(this.lessons.values()).sort((a, b) => a.order - b.order);
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    return this.lessons.get(id);
  }

  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const id = randomUUID();
    const newLesson: Lesson = { 
      id,
      title: lesson.title,
      description: lesson.description,
      order: lesson.order,
      intro: lesson.intro ?? null,
      learningObjectives: lesson.learningObjectives ?? null,
      goalDescription: lesson.goalDescription ?? null,
      previewCode: lesson.previewCode ?? null,
      content: lesson.content
    };
    this.lessons.set(id, newLesson);
    return newLesson;
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return Array.from(this.userProgress.values()).filter(
      (progress) => progress.userId === userId
    );
  }

  async getUserProgressForLesson(userId: string, lessonId: string): Promise<UserProgress | undefined> {
    return Array.from(this.userProgress.values()).find(
      (progress) => progress.userId === userId && progress.lessonId === lessonId
    );
  }

  async updateUserProgress(userId: string, lessonId: string, progressUpdate: Partial<UserProgress>): Promise<UserProgress> {
    const existingKey = Array.from(this.userProgress.keys()).find(key => {
      const progress = this.userProgress.get(key);
      return progress?.userId === userId && progress?.lessonId === lessonId;
    });

    if (existingKey) {
      const existing = this.userProgress.get(existingKey)!;
      const updated = { ...existing, ...progressUpdate };
      this.userProgress.set(existingKey, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newProgress: UserProgress = {
        id,
        userId,
        lessonId,
        currentStep: 0,
        completed: false,
        code: null,
        ...progressUpdate
      };
      this.userProgress.set(id, newProgress);
      return newProgress;
    }
  }
}

export const storage = new MemStorage();
