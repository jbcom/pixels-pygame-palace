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
    
    // Initialize with comprehensive fundamentals curriculum
    this.initializeLessons();
  }

  private initializeLessons() {
    const fundamentalsCurriculum: Lesson[] = [
      // LESSON 1: Python Basics
      {
        id: "lesson-1",
        title: "Python Basics",
        description: "Variables, data types, print, and input",
        order: 1,
        intro: "🐍 Welcome to Python programming! In this lesson, you'll learn the fundamental building blocks: variables, data types, and how to interact with users. These are the core concepts that every programmer needs to master.",
        learningObjectives: [
          "Create and use variables to store different types of data",
          "Work with strings, numbers, and booleans",
          "Use print() to display messages and information",
          "Get user input with input() function",
          "Convert between different data types"
        ],
        goalDescription: "Master the basics of Python by creating an interactive program that collects and displays user information!",
        previewCode: "name = input('Enter your name: ')\nage = int(input('Enter your age: '))\nprint(f'Hello {name}, you are {age} years old!')",
        content: {
          introduction: "Python is a powerful and beginner-friendly programming language. Let's start with the fundamentals that every Python programmer needs to know!",
          steps: [
            {
              id: "step-1",
              title: "Your First Python Message",
              description: "Let's start by displaying messages on screen. The print() function is used to show text output.",
              initialCode: "# Type exactly what's shown in the expected output\n# Use the print() function to display text\n",
              solution: "print('Hello, World!')\nprint('Welcome to Python programming!')",
              hints: ["Use print() function to display text", "Put text inside quotes", "Each print() goes on a separate line"],
              tests: [
                {
                  expectedOutput: "Hello, World!\nWelcome to Python programming!",
                  description: "Should display the welcome messages"
                }
              ]
            },
            {
              id: "step-2", 
              title: "Creating Variables",
              description: "Variables store data that your program can use later. Let's create variables for different types of information.",
              initialCode: "# Create these variables with the exact values shown:\n# name = 'Python'\n# version = 3.12\n# is_fun = True\n# Then print each variable\n",
              solution: "name = 'Python'\nversion = 3.12\nis_fun = True\n\nprint(name)\nprint(version)\nprint(is_fun)",
              hints: ["Variables store values using =", "Strings use quotes", "Numbers don't need quotes", "Boolean values are True or False"],
              tests: [
                {
                  expectedOutput: "Python\n3.12\nTrue",
                  description: "Should create and display the variables"
                }
              ]
            },
            {
              id: "step-3",
              title: "Getting User Input", 
              description: "Make your program interactive by getting input from users. The input() function asks users to type something.",
              initialCode: "# Ask the user for their name and store it in a variable\n# Then greet them with a personalized message\n",
              solution: "name = input('What is your name? ')\nprint('Nice to meet you, ' + name + '!')",
              hints: ["Use input() to get text from user", "Store the result in a variable", "Use + to combine strings"],
              tests: [
                {
                  input: "Alex",
                  expectedOutput: "What is your name? Nice to meet you, Alex!",
                  description: "Should ask for name and greet user"
                }
              ]
            },
            {
              id: "step-4",
              title: "Working with Numbers",
              description: "Learn to work with numeric input and convert between data types using int() and float().",
              initialCode: "# Ask for the user's age and convert it to an integer\n# Then display their age\n",
              solution: "age_input = input('How old are you? ')\nage = int(age_input)\nprint('You are ' + str(age) + ' years old')",
              hints: ["Use int() to convert strings to integers", "Use str() to convert numbers back to strings", "Input always returns a string"],
              tests: [
                {
                  input: "25",
                  expectedOutput: "How old are you? You are 25 years old",
                  description: "Should get age and convert to integer"
                }
              ]
            },
            {
              id: "step-5",
              title: "String Formatting",
              description: "Use f-strings to create formatted output that combines text and variables in a cleaner way.",
              initialCode: "# Get the user's name and favorite number\n# Display a message using f-string formatting\n",
              solution: "name = input('Enter your name: ')\nnumber = input('Enter your favorite number: ')\nprint(f'Hi {name}, your favorite number is {number}!')",
              hints: ["f-strings start with f before the quote", "Use {variable_name} inside the string", "f-strings automatically convert types"],
              tests: [
                {
                  input: "Sam\n7",
                  expectedOutput: "Enter your name: Enter your favorite number: Hi Sam, your favorite number is 7!",
                  description: "Should use f-string formatting"
                }
              ]
            }
          ]
        },
        prerequisites: [],
        difficulty: "Beginner",
        estimatedTime: 25
      },

      // LESSON 2: Control Flow  
      {
        id: "lesson-2",
        title: "Control Flow",
        description: "if/else statements and comparison operators",
        order: 2,
        intro: "🔀 Time to make your programs smart! Control flow lets your code make decisions and respond differently based on conditions. You'll learn if/else statements and comparison operators.",
        learningObjectives: [
          "Use if statements to make decisions in code",
          "Compare values with ==, !=, <, >, <=, >=",
          "Combine conditions with and, or, not",
          "Handle multiple conditions with elif",
          "Create programs that respond to user input"
        ],
        goalDescription: "Build intelligent programs that can make decisions and respond differently based on user input and conditions!",
        previewCode: "age = int(input('Enter age: '))\nif age >= 18:\n    print('You can vote!')\nelse:\n    print('Not old enough to vote yet')",
        content: {
          introduction: "Control flow allows your programs to make decisions. Instead of running the same code every time, you can create programs that respond intelligently to different situations!",
          steps: [
            {
              id: "step-1",
              title: "Your First if Statement",
              description: "Use an if statement to check a condition and only run code when the condition is true.",
              initialCode: "# Create a variable called score and set it to 85\n# Use an if statement to check if score is greater than 80\n# If true, print 'Great job!'\n",
              solution: "score = 85\nif score > 80:\n    print('Great job!')",
              hints: ["Use if followed by a condition and colon :", "Indent the code inside the if block", "Use > to check if one number is greater than another"],
              tests: [
                {
                  expectedOutput: "Great job!",
                  description: "Should print congratulations for high score"
                }
              ]
            },
            {
              id: "step-2",
              title: "Adding an else Statement", 
              description: "Use else to handle what happens when the if condition is false.",
              initialCode: "# Ask the user for their age\n# If age is 18 or older, print 'You are an adult'\n# Otherwise, print 'You are a minor'\n",
              solution: "age = int(input('Enter your age: '))\nif age >= 18:\n    print('You are an adult')\nelse:\n    print('You are a minor')",
              hints: ["Use >= for greater than or equal to", "else doesn't need a condition", "Make sure indentation matches"],
              tests: [
                {
                  input: "20",
                  expectedOutput: "Enter your age: You are an adult",
                  description: "Should classify adult correctly"
                }
              ]
            },
            {
              id: "step-3",
              title: "Multiple Conditions with elif",
              description: "Use elif (else if) to handle multiple different conditions in sequence.",
              initialCode: "# Ask for a test score (0-100)\n# Print grade: 90+ = A, 80+ = B, 70+ = C, below 70 = F\n",
              solution: "score = int(input('Enter your test score: '))\nif score >= 90:\n    print('Grade: A')\nelif score >= 80:\n    print('Grade: B')\nelif score >= 70:\n    print('Grade: C')\nelse:\n    print('Grade: F')",
              hints: ["elif checks a condition if previous if/elif was false", "Conditions are checked in order", "Only the first true condition runs"],
              tests: [
                {
                  input: "87",
                  expectedOutput: "Enter your test score: Grade: B",
                  description: "Should assign correct grade"
                }
              ]
            },
            {
              id: "step-4",
              title: "Comparison Operators",
              description: "Practice using different comparison operators to compare values: ==, !=, <, <=, >, >=",
              initialCode: "# Ask user for two numbers\n# Compare them and print whether first equals, is greater, or less than second\n",
              solution: "num1 = int(input('Enter first number: '))\nnum2 = int(input('Enter second number: '))\nif num1 == num2:\n    print('Numbers are equal')\nelif num1 > num2:\n    print('First number is greater')\nelse:\n    print('Second number is greater')",
              hints: ["Use == to check equality (not =)", "Use != for not equal", "< and > compare which is bigger"],
              tests: [
                {
                  input: "15\n10",
                  expectedOutput: "Enter first number: Enter second number: First number is greater",
                  description: "Should compare numbers correctly"
                }
              ]
            },
            {
              id: "step-5",
              title: "Logical Operators",
              description: "Combine multiple conditions using and, or, and not operators.",
              initialCode: "# Ask for age and whether they have a license (yes/no)\n# They can drive if age >= 16 AND they have a license\n",
              solution: "age = int(input('Enter your age: '))\nlicense = input('Do you have a license? (yes/no): ')\nif age >= 16 and license == 'yes':\n    print('You can drive!')\nelse:\n    print('You cannot drive yet')",
              hints: ["and requires both conditions to be true", "or requires at least one condition to be true", "not reverses a condition"],
              tests: [
                {
                  input: "17\nyes",
                  expectedOutput: "Enter your age: Do you have a license? (yes/no): You can drive!",
                  description: "Should check both age and license"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1"],
        difficulty: "Beginner",
        estimatedTime: 30
      },

      // LESSON 3: Loops
      {
        id: "lesson-3", 
        title: "Loops",
        description: "for loops, while loops, and iteration",
        order: 3,
        intro: "🔄 Ready to make your code more efficient? Loops let you repeat code multiple times without writing it over and over. You'll master for loops and while loops!",
        learningObjectives: [
          "Use for loops to repeat code a specific number of times",
          "Iterate over ranges and sequences with for loops", 
          "Create while loops that run until a condition changes",
          "Use break and continue to control loop flow",
          "Build programs that process multiple items"
        ],
        goalDescription: "Master the power of repetition by creating programs that can process lists of data and repeat tasks efficiently!",
        previewCode: "for i in range(5):\n    print(f'Countdown: {5-i}')\nprint('Blast off!')",
        content: {
          introduction: "Loops are one of the most powerful features in programming. Instead of copying and pasting code, loops let you repeat actions efficiently and process lots of data quickly!",
          steps: [
            {
              id: "step-1",
              title: "Your First for Loop",
              description: "Use a for loop with range() to repeat code a specific number of times.",
              initialCode: "# Use a for loop to print the numbers 1 through 5\n# Use range(1, 6) to get numbers 1 to 5\n",
              solution: "for i in range(1, 6):\n    print(i)",
              hints: ["for creates a loop", "range(1, 6) gives numbers 1, 2, 3, 4, 5", "Don't forget the colon : and indentation"],
              tests: [
                {
                  expectedOutput: "1\n2\n3\n4\n5",
                  description: "Should print numbers 1 through 5"
                }
              ]
            },
            {
              id: "step-2",
              title: "Looping with Messages",
              description: "Combine loops with variables to create repeated messages with changing content.",
              initialCode: "# Use a for loop to print 'Hello' 3 times, numbered\n# Output should be: Hello 1, Hello 2, Hello 3\n",
              solution: "for i in range(1, 4):\n    print(f'Hello {i}')",
              hints: ["Use f-strings to include the loop variable", "range(1, 4) gives 1, 2, 3", "Loop variable i changes each iteration"],
              tests: [
                {
                  expectedOutput: "Hello 1\nHello 2\nHello 3",
                  description: "Should print numbered hellos"
                }
              ]
            },
            {
              id: "step-3", 
              title: "While Loops",
              description: "Use while loops to repeat code as long as a condition is true.",
              initialCode: "# Create a countdown from 5 to 1 using a while loop\n# Start with count = 5, print each number, then subtract 1\n",
              solution: "count = 5\nwhile count > 0:\n    print(count)\n    count = count - 1",
              hints: ["while loops continue as long as condition is true", "Don't forget to change the variable inside the loop", "count = count - 1 reduces count by 1"],
              tests: [
                {
                  expectedOutput: "5\n4\n3\n2\n1", 
                  description: "Should count down from 5 to 1"
                }
              ]
            },
            {
              id: "step-4",
              title: "Processing User Input",
              description: "Use loops to keep asking for user input until they enter a specific value.",
              initialCode: "# Keep asking user for a password until they enter 'secret'\n# Print 'Access granted!' when correct\n",
              solution: "password = ''\nwhile password != 'secret':\n    password = input('Enter password: ')\nprint('Access granted!')",
              hints: ["Initialize password to empty string", "Loop continues until password equals 'secret'", "Input updates password each time"],
              tests: [
                {
                  input: "wrong\nsecret", 
                  expectedOutput: "Enter password: Enter password: Access granted!",
                  description: "Should keep asking until correct password"
                }
              ]
            },
            {
              id: "step-5",
              title: "Break and Continue",
              description: "Use break to exit loops early and continue to skip to the next iteration.",
              initialCode: "# Print numbers 1-10 but skip number 5 using continue\n# Stop completely if you reach 8 using break\n",
              solution: "for i in range(1, 11):\n    if i == 5:\n        continue\n    if i == 8:\n        break\n    print(i)",
              hints: ["continue skips the rest of the current loop iteration", "break exits the loop completely", "Check conditions before printing"],
              tests: [
                {
                  expectedOutput: "1\n2\n3\n4\n6\n7",
                  description: "Should skip 5 and stop before 8"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2"],
        difficulty: "Beginner", 
        estimatedTime: 35
      },

      // LESSON 4: Data Structures
      {
        id: "lesson-4",
        title: "Data Structures", 
        description: "Lists, dictionaries, and tuples",
        order: 4,
        intro: "📦 Time to organize your data! Learn to work with lists (ordered collections), dictionaries (key-value pairs), and tuples (unchangeable sequences). These are essential for storing and organizing information.",
        learningObjectives: [
          "Create and manipulate lists to store multiple items",
          "Access and modify list elements using indexes",
          "Use dictionaries to store key-value pairs", 
          "Work with tuples for unchangeable data",
          "Apply common methods like append, remove, and keys()"
        ],
        goalDescription: "Master Python's built-in data structures to organize and manipulate collections of information efficiently!",
        previewCode: "scores = [85, 92, 78, 96]\nplayer = {'name': 'Alex', 'level': 5}\nprint(f'{player[\"name\"]} scored {max(scores)}')",
        content: {
          introduction: "Data structures help you organize and store multiple pieces of information together. They're essential for building real programs that handle lots of data!",
          steps: [
            {
              id: "step-1",
              title: "Creating and Using Lists",
              description: "Lists store multiple items in order. Create a list and access its elements using indexes.",
              initialCode: "# Create a list called fruits with: apple, banana, orange\n# Print the first fruit (index 0)\n# Print the last fruit\n",
              solution: "fruits = ['apple', 'banana', 'orange']\nprint(fruits[0])\nprint(fruits[-1])",
              hints: ["Lists use square brackets []", "Index 0 is the first item", "Index -1 is the last item"],
              tests: [
                {
                  expectedOutput: "apple\norange",
                  description: "Should create list and access first/last items"
                }
              ]
            },
            {
              id: "step-2",
              title: "Modifying Lists",
              description: "Learn to add, remove, and change items in lists using methods like append() and remove().",
              initialCode: "# Start with colors = ['red', 'blue']\n# Add 'green' to the end\n# Remove 'red'\n# Print the final list\n",
              solution: "colors = ['red', 'blue']\ncolors.append('green')\ncolors.remove('red')\nprint(colors)",
              hints: ["append() adds to the end", "remove() deletes the first matching item", "Lists can be changed after creation"],
              tests: [
                {
                  expectedOutput: "['blue', 'green']",
                  description: "Should modify the list correctly"
                }
              ]
            },
            {
              id: "step-3",
              title: "Working with Dictionaries", 
              description: "Dictionaries store key-value pairs. Perfect for storing related information about something.",
              initialCode: "# Create a dictionary called student with keys: name, age, grade\n# Values: 'Sarah', 16, 'A'\n# Print the student's name and grade\n",
              solution: "student = {'name': 'Sarah', 'age': 16, 'grade': 'A'}\nprint(student['name'])\nprint(student['grade'])",
              hints: ["Dictionaries use curly braces {}", "Use key: value pairs", "Access values with dictionary[key]"],
              tests: [
                {
                  expectedOutput: "Sarah\nA", 
                  description: "Should create dictionary and access values"
                }
              ]
            },
            {
              id: "step-4",
              title: "Dictionary Methods",
              description: "Use dictionary methods to get keys, values, and add new items safely.",
              initialCode: "# Create inventory = {'apples': 10, 'bananas': 5}\n# Add 'oranges': 8 to the dictionary\n# Print all the keys\n",
              solution: "inventory = {'apples': 10, 'bananas': 5}\ninventory['oranges'] = 8\nprint(list(inventory.keys()))",
              hints: ["Add items with dict[new_key] = value", "keys() returns all dictionary keys", "Use list() to convert keys to a list"],
              tests: [
                {
                  expectedOutput: "['apples', 'bananas', 'oranges']",
                  description: "Should add item and show keys"
                }
              ]
            },
            {
              id: "step-5", 
              title: "Combining Data Structures",
              description: "Use lists and dictionaries together to represent more complex data.",
              initialCode: "# Create a list of dictionaries for 2 players\n# Each player has name and score\n# Print both players' information\n",
              solution: "players = [\n    {'name': 'Alex', 'score': 150},\n    {'name': 'Jordan', 'score': 200}\n]\nprint(f\"{players[0]['name']}: {players[0]['score']}\")\nprint(f\"{players[1]['name']}: {players[1]['score']}\")",
              hints: ["Lists can contain dictionaries", "Access with list_name[index]['key']", "Each dictionary represents one player"],
              tests: [
                {
                  expectedOutput: "Alex: 150\nJordan: 200",
                  description: "Should create and display player data"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2", "lesson-3"],
        difficulty: "Intermediate",
        estimatedTime: 40
      },

      // LESSON 5: Functions
      {
        id: "lesson-5",
        title: "Functions",
        description: "Defining functions, parameters, and return values", 
        order: 5,
        intro: "🔧 Functions are like tools in your programming toolbox! Learn to create reusable code blocks that can accept inputs (parameters) and give back outputs (return values). This makes your code organized and efficient.",
        learningObjectives: [
          "Define functions using the def keyword",
          "Pass data to functions using parameters",
          "Return values from functions back to the caller",
          "Understand scope and variable visibility",
          "Create modular, reusable code"
        ],
        goalDescription: "Build a toolkit of custom functions that make your programs more organized, reusable, and easier to maintain!",
        previewCode: "def calculate_score(points, bonus):\n    total = points + bonus\n    return total\n\nresult = calculate_score(100, 25)\nprint(f'Final score: {result}')",
        content: {
          introduction: "Functions let you package code into reusable blocks. Instead of writing the same code over and over, you can create a function once and use it many times!",
          steps: [
            {
              id: "step-1",
              title: "Your First Function",
              description: "Create a simple function that prints a greeting message when called.",
              initialCode: "# Define a function called greet that prints 'Hello, welcome!'\n# Then call the function to run it\n",
              solution: "def greet():\n    print('Hello, welcome!')\n\ngreet()",
              hints: ["Use def to define a function", "Function names are followed by ()", "Don't forget the colon : and indentation", "Call functions by writing their name with ()"],
              tests: [
                {
                  expectedOutput: "Hello, welcome!",
                  description: "Should define and call the greet function"
                }
              ]
            },
            {
              id: "step-2", 
              title: "Functions with Parameters",
              description: "Create functions that accept input values (parameters) to make them more flexible.",
              initialCode: "# Define a function called say_hello that takes a name parameter\n# It should print 'Hello, [name]!'\n# Call it with your name\n",
              solution: "def say_hello(name):\n    print(f'Hello, {name}!')\n\nsay_hello('Python')",
              hints: ["Parameters go inside the parentheses", "Use the parameter like a variable inside the function", "Pass values when calling the function"],
              tests: [
                {
                  expectedOutput: "Hello, Python!",
                  description: "Should greet with the provided name"
                }
              ]
            },
            {
              id: "step-3",
              title: "Functions that Return Values",
              description: "Use the return statement to send values back from functions.",
              initialCode: "# Define a function called add_numbers that takes two parameters\n# Return the sum of the two numbers\n# Call it with 5 and 3, store result, and print it\n",
              solution: "def add_numbers(a, b):\n    return a + b\n\nresult = add_numbers(5, 3)\nprint(result)",
              hints: ["Use return to send a value back", "Store the returned value in a variable", "Functions can return any type of data"],
              tests: [
                {
                  expectedOutput: "8",
                  description: "Should return the sum of two numbers"
                }
              ]
            },
            {
              id: "step-4",
              title: "Multiple Parameters and Logic",
              description: "Create functions with multiple parameters and conditional logic inside.",
              initialCode: "# Define get_grade function that takes a score parameter\n# Return 'A' for 90+, 'B' for 80+, 'C' for 70+, 'F' otherwise\n# Test it with score 85\n",
              solution: "def get_grade(score):\n    if score >= 90:\n        return 'A'\n    elif score >= 80:\n        return 'B' \n    elif score >= 70:\n        return 'C'\n    else:\n        return 'F'\n\ngrade = get_grade(85)\nprint(grade)",
              hints: ["Functions can contain if/elif/else statements", "Return stops function execution immediately", "Test with different values to verify logic"],
              tests: [
                {
                  expectedOutput: "B",
                  description: "Should return correct grade for score"
                }
              ]
            },
            {
              id: "step-5",
              title: "Building a Calculator",
              description: "Create multiple functions that work together to build a simple calculator.",
              initialCode: "# Define functions: multiply(a, b) and divide(a, b)\n# Use them to calculate: 12 * 4, then divide that result by 3\n# Print the final result\n",
              solution: "def multiply(a, b):\n    return a * b\n\ndef divide(a, b):\n    return a / b\n\nresult1 = multiply(12, 4)\nfinal_result = divide(result1, 3)\nprint(int(final_result))",
              hints: ["Define each function separately", "Use the result of one function in another", "Functions make complex calculations easier to read"],
              tests: [
                {
                  expectedOutput: "16",
                  description: "Should calculate (12 * 4) / 3 = 16"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2", "lesson-3", "lesson-4"],
        difficulty: "Intermediate",
        estimatedTime: 45
      },

      // LESSON 6: Object-Oriented Programming  
      {
        id: "lesson-6",
        title: "Object-Oriented Programming",
        description: "Classes, objects, and methods",
        order: 6,
        intro: "🏗️ Ready to build with blueprints? Object-oriented programming lets you create classes (blueprints) and objects (instances). Perfect for modeling real-world things in your programs!",
        learningObjectives: [
          "Define classes as blueprints for objects",
          "Create objects from classes using constructors", 
          "Add methods (functions) to classes",
          "Use attributes to store object data",
          "Understand the difference between classes and objects"
        ],
        goalDescription: "Master object-oriented programming by creating classes and objects that represent real-world entities with their own data and behaviors!",
        previewCode: "class Player:\n    def __init__(self, name):\n        self.name = name\n        self.score = 0\n    \n    def add_points(self, points):\n        self.score += points\n\nplayer1 = Player('Alex')\nplayer1.add_points(100)",
        content: {
          introduction: "Object-oriented programming helps you organize code by creating classes (blueprints) and objects (actual instances). It's like having a recipe (class) that you can use to bake multiple cakes (objects)!",
          steps: [
            {
              id: "step-1",
              title: "Creating Your First Class",
              description: "Define a simple class with attributes. Classes are templates for creating objects.",
              initialCode: "# Create a class called Dog\n# Add an __init__ method that takes name parameter\n# Store the name in self.name\n# Create a dog object and print its name\n",
              solution: "class Dog:\n    def __init__(self, name):\n        self.name = name\n\nmy_dog = Dog('Buddy')\nprint(my_dog.name)",
              hints: ["class keyword defines a class", "__init__ is the constructor method", "self refers to the object being created", "Access attributes with object.attribute"],
              tests: [
                {
                  expectedOutput: "Buddy",
                  description: "Should create Dog class and print name"
                }
              ]
            },
            {
              id: "step-2",
              title: "Adding Methods to Classes",
              description: "Methods are functions that belong to a class. They define what objects can do.",
              initialCode: "# Create a Car class with __init__(brand, color)\n# Add a method called start_engine that prints '[brand] engine started!'\n# Create a car and call the method\n",
              solution: "class Car:\n    def __init__(self, brand, color):\n        self.brand = brand\n        self.color = color\n    \n    def start_engine(self):\n        print(f'{self.brand} engine started!')\n\nmy_car = Car('Toyota', 'blue')\nmy_car.start_engine()",
              hints: ["Methods are functions inside classes", "All methods need self as first parameter", "Access object attributes with self.attribute", "Call methods with object.method()"],
              tests: [
                {
                  expectedOutput: "Toyota engine started!",
                  description: "Should create car and start engine"
                }
              ]
            },
            {
              id: "step-3",
              title: "Working with Object Data",
              description: "Objects can store data in attributes and have methods that modify that data.",
              initialCode: "# Create a BankAccount class with __init__(balance)\n# Add deposit(amount) method that adds to balance\n# Add get_balance() method that returns current balance\n# Test with initial balance 100, deposit 50, print balance\n",
              solution: "class BankAccount:\n    def __init__(self, balance):\n        self.balance = balance\n    \n    def deposit(self, amount):\n        self.balance += amount\n    \n    def get_balance(self):\n        return self.balance\n\naccount = BankAccount(100)\naccount.deposit(50)\nprint(account.get_balance())",
              hints: ["Methods can modify object attributes", "Use self.attribute to access/modify data", "Methods can return values like functions"],
              tests: [
                {
                  expectedOutput: "150",
                  description: "Should handle deposits correctly"
                }
              ]
            },
            {
              id: "step-4",
              title: "Multiple Objects",
              description: "Create multiple objects from the same class. Each object has its own separate data.",
              initialCode: "# Create a Student class with __init__(name, grade)\n# Add study() method that increases grade by 1\n# Create two students with different names and grades\n# Make one student study, then print both grades\n",
              solution: "class Student:\n    def __init__(self, name, grade):\n        self.name = name\n        self.grade = grade\n    \n    def study(self):\n        self.grade += 1\n\nstudent1 = Student('Alice', 85)\nstudent2 = Student('Bob', 78)\nstudent1.study()\nprint(student1.grade)\nprint(student2.grade)",
              hints: ["Each object has its own separate attributes", "Changes to one object don't affect others", "Create multiple objects by calling the class multiple times"],
              tests: [
                {
                  expectedOutput: "86\n78",
                  description: "Should show independent object data"
                }
              ]
            },
            {
              id: "step-5",
              title: "Building a Game Character",
              description: "Create a more complex class that represents a game character with health, attacks, and special abilities.",
              initialCode: "# Create a Warrior class with __init__(name, health, attack_power)\n# Add attack() method that returns 'attacks for [attack_power] damage!'\n# Add take_damage(damage) that reduces health\n# Create warrior, make them attack, take 10 damage, print health\n",
              solution: "class Warrior:\n    def __init__(self, name, health, attack_power):\n        self.name = name\n        self.health = health\n        self.attack_power = attack_power\n    \n    def attack(self):\n        return f'attacks for {self.attack_power} damage!'\n    \n    def take_damage(self, damage):\n        self.health -= damage\n\nwarrior = Warrior('Thor', 100, 25)\nprint(warrior.attack())\nwarrior.take_damage(10)\nprint(warrior.health)",
              hints: ["Classes can have multiple attributes and methods", "Methods can return strings or modify attributes", "Objects represent complex entities with behaviors"],
              tests: [
                {
                  expectedOutput: "attacks for 25 damage!\n90",
                  description: "Should create warrior and handle combat"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5"],
        difficulty: "Intermediate", 
        estimatedTime: 50
      },

      // LESSON 7: Error Handling
      {
        id: "lesson-7",
        title: "Error Handling",
        description: "try/except blocks and debugging techniques",
        order: 7,
        intro: "🛡️ Even the best programmers make mistakes! Learn to handle errors gracefully with try/except blocks and develop debugging skills to find and fix problems in your code.",
        learningObjectives: [
          "Use try/except blocks to catch and handle errors",
          "Handle specific types of errors appropriately", 
          "Use finally blocks for cleanup code",
          "Apply debugging techniques to find problems",
          "Write defensive code that fails gracefully"
        ],
        goalDescription: "Build robust programs that can handle unexpected situations and errors without crashing, making your code reliable and user-friendly!",
        previewCode: "try:\n    age = int(input('Enter age: '))\n    print(f'You are {age} years old')\nexcept ValueError:\n    print('Please enter a valid number')",
        content: {
          introduction: "Errors are a normal part of programming. Instead of letting your program crash, you can handle errors gracefully and provide helpful feedback to users!",
          steps: [
            {
              id: "step-1",
              title: "Basic Try/Except",
              description: "Use try/except to catch errors and prevent your program from crashing.",
              initialCode: "# Try to convert user input to integer\n# If it fails, print 'Invalid number entered'\n# Test with input that will cause an error\n",
              solution: "try:\n    number = int(input('Enter a number: '))\n    print(f'You entered: {number}')\nexcept ValueError:\n    print('Invalid number entered')",
              hints: ["Put risky code in try block", "except catches specific error types", "ValueError happens when converting invalid strings to numbers"],
              tests: [
                {
                  input: "abc",
                  expectedOutput: "Enter a number: Invalid number entered",
                  description: "Should handle invalid input gracefully"
                }
              ]
            },
            {
              id: "step-2",
              title: "Handling Division by Zero",
              description: "Catch ZeroDivisionError when dividing by zero and provide a helpful message.",
              initialCode: "# Ask for two numbers and divide first by second\n# Handle the case when second number is zero\n# Print appropriate error message\n",
              solution: "try:\n    num1 = int(input('Enter first number: '))\n    num2 = int(input('Enter second number: '))\n    result = num1 / num2\n    print(f'Result: {result}')\nexcept ZeroDivisionError:\n    print('Cannot divide by zero!')",
              hints: ["ZeroDivisionError occurs when dividing by zero", "Handle multiple inputs in one try block", "Provide clear error messages for users"],
              tests: [
                {
                  input: "10\n0",
                  expectedOutput: "Enter first number: Enter second number: Cannot divide by zero!",
                  description: "Should handle division by zero"
                }
              ]
            },
            {
              id: "step-3",
              title: "Multiple Exception Types", 
              description: "Handle different types of errors with multiple except blocks.",
              initialCode: "# Try to access a list element by index from user input\n# Handle both ValueError (invalid index) and IndexError (index out of range)\n# Use list: ['apple', 'banana', 'orange']\n",
              solution: "fruits = ['apple', 'banana', 'orange']\ntry:\n    index = int(input('Enter index (0-2): '))\n    print(f'Fruit: {fruits[index]}')\nexcept ValueError:\n    print('Please enter a valid number')\nexcept IndexError:\n    print('Index out of range')",
              hints: ["Multiple except blocks handle different error types", "IndexError occurs when accessing invalid list positions", "Order matters - most specific exceptions first"],
              tests: [
                {
                  input: "5",
                  expectedOutput: "Enter index (0-2): Index out of range",
                  description: "Should handle index out of range"
                }
              ]
            },
            {
              id: "step-4",
              title: "Finally Blocks",
              description: "Use finally blocks to run code regardless of whether an error occurred.",
              initialCode: "# Try to open and read a 'file' (simulate with variable)\n# Use finally to print 'Operation completed'\n# Handle any potential errors\n",
              solution: "try:\n    filename = 'data.txt'\n    # Simulate file operation\n    if filename == 'missing.txt':\n        raise FileNotFoundError('File not found')\n    print('File processed successfully')\nexcept FileNotFoundError:\n    print('Could not find the file')\nfinally:\n    print('Operation completed')",
              hints: ["finally block always runs", "Use raise to simulate errors for testing", "finally is useful for cleanup operations"],
              tests: [
                {
                  expectedOutput: "File processed successfully\nOperation completed",
                  description: "Should run finally block after success"
                }
              ]
            },
            {
              id: "step-5",
              title: "Building Error-Safe Input Function",
              description: "Create a function that safely gets numeric input from users with error handling.",
              initialCode: "# Create get_number() function that keeps asking until valid number entered\n# Return the valid number\n# Test it by calling the function\n",
              solution: "def get_number():\n    while True:\n        try:\n            number = int(input('Enter a number: '))\n            return number\n        except ValueError:\n            print('Invalid input. Please try again.')\n\nresult = get_number()\nprint(f'You entered: {result}')",
              hints: ["Use while True loop to keep trying", "return exits the function when successful", "Combine loops with try/except for robust input"],
              tests: [
                {
                  input: "abc\n42",
                  expectedOutput: "Enter a number: Invalid input. Please try again.\nEnter a number: You entered: 42",
                  description: "Should retry until valid input"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5"],
        difficulty: "Intermediate",
        estimatedTime: 40
      },

      // LESSON 8: File Operations
      {
        id: "lesson-8", 
        title: "File Operations",
        description: "Reading and writing files (simulated)",
        order: 8,
        intro: "📁 Programs often need to save and load data! Learn to work with files to store information permanently. We'll simulate file operations to learn the concepts safely.",
        learningObjectives: [
          "Understand file paths and file types",
          "Simulate reading data from files",
          "Simulate writing data to files", 
          "Work with different file formats (text, CSV)",
          "Handle file-related errors appropriately"
        ],
        goalDescription: "Master file operations by building programs that can save and load data, making your applications remember information between runs!",
        previewCode: "# Simulated file operations\ndata = 'player_scores.txt contains: Alice:100, Bob:85'\nscores = parse_scores(data)\nprint(f'Alice scored {scores[\"Alice\"]}')",
        content: {
          introduction: "Files let programs save data permanently and share information. We'll simulate file operations to learn these important concepts safely in your browser!",
          steps: [
            {
              id: "step-1",
              title: "Simulated File Reading",
              description: "Learn file reading concepts by working with simulated file data.",
              initialCode: "# Simulate reading a file containing 'Hello from file!'\n# Store the content in a variable and print it\nfile_content = 'Hello from file!'\n",
              solution: "file_content = 'Hello from file!'\nprint(file_content)",
              hints: ["In real programs, you'd use open() to read files", "File content is usually stored as strings", "Always close files after reading (or use 'with' statement)"],
              tests: [
                {
                  expectedOutput: "Hello from file!",
                  description: "Should display simulated file content"
                }
              ]
            },
            {
              id: "step-2", 
              title: "Processing File Lines",
              description: "Work with multi-line file content by splitting into individual lines.",
              initialCode: "# Simulate a file with multiple lines of data\n# Split the content by newlines and print each line numbered\nfile_data = 'Line 1\\nLine 2\\nLine 3'\n",
              solution: "file_data = 'Line 1\\nLine 2\\nLine 3'\nlines = file_data.split('\\n')\nfor i, line in enumerate(lines, 1):\n    print(f'{i}: {line}')",
              hints: ["Use split('\\n') to separate lines", "enumerate() gives you both index and value", "Start counting from 1 with enumerate(lines, 1)"],
              tests: [
                {
                  expectedOutput: "1: Line 1\n2: Line 2\n3: Line 3", 
                  description: "Should process and number each line"
                }
              ]
            },
            {
              id: "step-3",
              title: "Working with CSV Data",
              description: "Parse comma-separated values (CSV) format, commonly used for storing structured data.",
              initialCode: "# Simulate CSV file: 'name,age,city\\nAlice,25,NYC\\nBob,30,LA'\n# Parse it and print each person's information\n",
              solution: "csv_data = 'name,age,city\\nAlice,25,NYC\\nBob,30,LA'\nlines = csv_data.split('\\n')\nheaders = lines[0].split(',')\nfor i in range(1, len(lines)):\n    values = lines[i].split(',')\n    print(f'{values[0]} is {values[1]} years old from {values[2]}')",
              hints: ["First line often contains headers", "Use split(',') to separate CSV values", "Process data lines starting from index 1"],
              tests: [
                {
                  expectedOutput: "Alice is 25 years old from NYC\nBob is 30 years old from LA",
                  description: "Should parse and display CSV data"
                }
              ]
            },
            {
              id: "step-4",
              title: "Simulated File Writing",
              description: "Learn file writing concepts by building content that would be saved to a file.",
              initialCode: "# Create a shopping list and format it for saving\n# Items: milk, bread, eggs\n# Format as 'Shopping List:\\nitem1\\nitem2\\nitem3'\n",
              solution: "shopping_items = ['milk', 'bread', 'eggs']\nfile_content = 'Shopping List:\\n'\nfor item in shopping_items:\n    file_content += item + '\\n'\nprint(file_content.strip())",
              hints: ["Build strings by concatenating", "Add \\n for new lines", "strip() removes extra newlines at the end"],
              tests: [
                {
                  expectedOutput: "Shopping List:\nmilk\nbread\neggs",
                  description: "Should format shopping list for file"
                }
              ]
            },
            {
              id: "step-5",
              title: "Data Persistence Simulation",
              description: "Create a system that simulates saving and loading user scores.",
              initialCode: "# Create save_score function that formats 'player:score' \n# Create load_scores function that parses score data\n# Test with player 'Alex' and score 150\n",
              solution: "def save_score(player, score):\n    return f'{player}:{score}'\n\ndef load_scores(score_data):\n    scores = {}\n    for line in score_data.split('\\n'):\n        if ':' in line:\n            player, score = line.split(':')\n            scores[player] = int(score)\n    return scores\n\n# Test the functions\nsaved_data = save_score('Alex', 150)\nprint(f'Saved: {saved_data}')\nloaded = load_scores('Alex:150\\nJordan:200')\nprint(f'Alex scored: {loaded[\"Alex\"]}')",
              hints: ["Use : as delimiter for player:score format", "split(':') separates key and value", "Convert score strings back to integers"],
              tests: [
                {
                  expectedOutput: "Saved: Alex:150\nAlex scored: 150",
                  description: "Should save and load score data"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5", "lesson-7"],
        difficulty: "Intermediate",
        estimatedTime: 35
      },

      // LESSON 9: Introduction to Pygame
      {
        id: "lesson-9",
        title: "Introduction to Pygame", 
        description: "Basic game window and event handling",
        order: 9,
        intro: "🎮 Ready to make games? Pygame is a Python library for creating games and graphics. Learn to create windows, handle events, and draw basic shapes - the foundation of game development!",
        learningObjectives: [
          "Understand what Pygame is and how it works",
          "Create a basic game window",
          "Handle keyboard and mouse events", 
          "Draw shapes and colors on screen",
          "Create a simple game loop"
        ],
        goalDescription: "Take your first steps into game development by creating an interactive Pygame window that responds to user input!",
        previewCode: "import pygame\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\npygame.display.set_caption('My First Game')\n# Game loop would go here",
        content: {
          introduction: "Pygame transforms your Python knowledge into interactive games! You'll learn to create windows, handle user input, and draw graphics - everything needed to build games!",
          steps: [
            {
              id: "step-1",
              title: "Understanding Pygame Concepts",
              description: "Learn the basic concepts of game programming: windows, surfaces, and the game loop.",
              initialCode: "# Print an explanation of key Pygame concepts\n# Explain what a game window, surface, and game loop are\n",
              solution: "print('Pygame Concepts:')\nprint('1. Game Window: The main display where everything appears')\nprint('2. Surface: Objects that can be drawn on (like canvas)')\nprint('3. Game Loop: Continuous cycle that updates and redraws')\nprint('4. Events: User inputs like key presses and mouse clicks')",
              hints: ["Games need a window to display content", "Surface objects hold graphics and images", "Game loops run continuously until game ends"],
              tests: [
                {
                  expectedOutput: "Pygame Concepts:\n1. Game Window: The main display where everything appears\n2. Surface: Objects that can be drawn on (like canvas)\n3. Game Loop: Continuous cycle that updates and redraws\n4. Events: User inputs like key presses and mouse clicks",
                  description: "Should explain Pygame concepts"
                }
              ]
            },
            {
              id: "step-2",
              title: "Simulated Window Creation",
              description: "Understand the code needed to create a Pygame window (we'll simulate since Pygame isn't available in browser).",
              initialCode: "# Simulate creating a Pygame window\n# Print the steps needed to initialize Pygame and create a window\n",
              solution: "print('Creating Pygame Window:')\nprint('import pygame')\nprint('pygame.init()')\nprint('screen = pygame.display.set_mode((800, 600))')\nprint('pygame.display.set_caption(\"My Game\")')\nprint('Window created: 800x600 pixels')",
              hints: ["pygame.init() must be called first", "set_mode() creates the window with width/height", "set_caption() sets the window title"],
              tests: [
                {
                  expectedOutput: "Creating Pygame Window:\nimport pygame\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\npygame.display.set_caption(\"My Game\")\nWindow created: 800x600 pixels",
                  description: "Should show window creation steps"
                }
              ]
            },
            {
              id: "step-3",
              title: "Color Systems and RGB",
              description: "Learn how computers represent colors using RGB (Red, Green, Blue) values.",
              initialCode: "# Define color constants using RGB tuples\n# Create RED, GREEN, BLUE, WHITE, BLACK colors\n# Print each color with its RGB values\n",
              solution: "RED = (255, 0, 0)\nGREEN = (0, 255, 0)\nBLUE = (0, 0, 255)\nWHITE = (255, 255, 255)\nBLACK = (0, 0, 0)\n\nprint(f'RED: {RED}')\nprint(f'GREEN: {GREEN}')\nprint(f'BLUE: {BLUE}')\nprint(f'WHITE: {WHITE}')\nprint(f'BLACK: {BLACK}')",
              hints: ["RGB values range from 0 to 255", "Each color is (red, green, blue) tuple", "WHITE is all colors at max, BLACK is all at zero"],
              tests: [
                {
                  expectedOutput: "RED: (255, 0, 0)\nGREEN: (0, 255, 0)\nBLUE: (0, 0, 255)\nWHITE: (255, 255, 255)\nBLACK: (0, 0, 0)",
                  description: "Should define and display RGB colors"
                }
              ]
            },
            {
              id: "step-4", 
              title: "Event Handling Concepts",
              description: "Understand how games respond to user input through event handling.",
              initialCode: "# Create a function that processes different game events\n# Handle QUIT, KEYDOWN, and MOUSEBUTTONDOWN events\n# Print what each event type means\n",
              solution: "def handle_event(event_type):\n    if event_type == 'QUIT':\n        return 'User closed the window'\n    elif event_type == 'KEYDOWN':\n        return 'User pressed a key'\n    elif event_type == 'MOUSEBUTTONDOWN':\n        return 'User clicked the mouse'\n    else:\n        return 'Unknown event'\n\nprint(handle_event('QUIT'))\nprint(handle_event('KEYDOWN'))\nprint(handle_event('MOUSEBUTTONDOWN'))",
              hints: ["Events represent user actions", "QUIT happens when closing window", "Games must handle events to be interactive"],
              tests: [
                {
                  expectedOutput: "User closed the window\nUser pressed a key\nUser clicked the mouse",
                  description: "Should explain different event types"
                }
              ]
            },
            {
              id: "step-5",
              title: "Game Loop Structure",
              description: "Learn the essential structure of a game loop that powers all games.",
              initialCode: "# Simulate a game loop with frame counter\n# Print the steps that happen in each frame for 3 frames\n# Include: handle events, update game, draw everything\n",
              solution: "def game_loop_frame(frame_number):\n    print(f'Frame {frame_number}:')\n    print('  1. Handle events (user input)')\n    print('  2. Update game logic (move objects)')\n    print('  3. Draw everything on screen')\n    print('  4. Display updated screen')\n    print()\n\nfor frame in range(1, 4):\n    game_loop_frame(frame)",
              hints: ["Game loops repeat continuously", "Each frame: input → update → draw → display", "Games typically run 30-60 frames per second"],
              tests: [
                {
                  expectedOutput: "Frame 1:\n  1. Handle events (user input)\n  2. Update game logic (move objects)\n  3. Draw everything on screen\n  4. Display updated screen\n\nFrame 2:\n  1. Handle events (user input)\n  2. Update game logic (move objects)\n  3. Draw everything on screen\n  4. Display updated screen\n\nFrame 3:\n  1. Handle events (user input)\n  2. Update game logic (move objects)\n  3. Draw everything on screen\n  4. Display updated screen\n",
                  description: "Should simulate game loop frames"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5", "lesson-6"],
        difficulty: "Intermediate",
        estimatedTime: 30
      },

      // LESSON 10: Building Your First Game
      {
        id: "lesson-10",
        title: "Building Your First Game",
        description: "Combine all concepts to create a complete text-based game",
        order: 10,
        intro: "🏆 Time for the grand finale! Combine everything you've learned to build a complete text-based adventure game. Use classes, functions, loops, error handling, and all your Python skills!",
        learningObjectives: [
          "Integrate multiple programming concepts into one project",
          "Design and implement a complete game system",
          "Apply object-oriented programming to game entities",
          "Use error handling to create robust gameplay",
          "Create an engaging user experience with text"
        ],
        goalDescription: "Build your very first complete game! A text-based adventure that showcases all the Python skills you've mastered throughout this course.",
        previewCode: "class Player:\n    def __init__(self, name):\n        self.name = name\n        self.health = 100\n        self.inventory = []\n\ngame = AdventureGame()\ngame.start()",
        content: {
          introduction: "Congratulations on reaching the final lesson! Now you'll combine everything you've learned - variables, functions, classes, loops, and error handling - to build a complete game!",
          steps: [
            {
              id: "step-1",
              title: "Game Design Planning",
              description: "Plan your game by defining the core components and how they'll work together.",
              initialCode: "# Create a game design plan\n# Print the game title, objective, and main features\n",
              solution: "print('=== TREASURE HUNTER GAME ===')\nprint('\\nObjective: Find the hidden treasure!')\nprint('\\nGame Features:')\nprint('- Player with health and inventory')\nprint('- Multiple rooms to explore')\nprint('- Items to collect and use')\nprint('- Challenges and obstacles')\nprint('- Victory condition: Find the treasure!')",
              hints: ["Good games start with clear objectives", "Plan your features before coding", "Think about what makes games fun"],
              tests: [
                {
                  expectedOutput: "=== TREASURE HUNTER GAME ===\n\nObjective: Find the hidden treasure!\n\nGame Features:\n- Player with health and inventory\n- Multiple rooms to explore\n- Items to collect and use\n- Challenges and obstacles\n- Victory condition: Find the treasure!",
                  description: "Should display game design plan"
                }
              ]
            },
            {
              id: "step-2",
              title: "Creating the Player Class",
              description: "Build a Player class that manages health, inventory, and player actions.",
              initialCode: "# Create Player class with name, health=100, inventory=[]\n# Add take_damage(amount) and add_item(item) methods\n# Create a player and test the methods\n",
              solution: "class Player:\n    def __init__(self, name):\n        self.name = name\n        self.health = 100\n        self.inventory = []\n    \n    def take_damage(self, amount):\n        self.health -= amount\n        if self.health <= 0:\n            return 'Game Over!'\n        return f'Health: {self.health}'\n    \n    def add_item(self, item):\n        self.inventory.append(item)\n        return f'Added {item} to inventory'\n\nplayer = Player('Hero')\nprint(player.add_item('sword'))\nprint(player.take_damage(20))",
              hints: ["Classes bundle data and methods together", "Methods can return status messages", "Track important game state like health"],
              tests: [
                {
                  expectedOutput: "Added sword to inventory\nHealth: 80",
                  description: "Should create player and test methods"
                }
              ]
            },
            {
              id: "step-3",
              title: "Building Game Rooms",
              description: "Create a Room class to represent different locations in your game world.",
              initialCode: "# Create Room class with name, description, items=[]\n# Add enter() method that returns room description\n# Add get_item(item_name) method to take items\n# Test with a room containing 'key'\n",
              solution: "class Room:\n    def __init__(self, name, description, items=None):\n        self.name = name\n        self.description = description\n        self.items = items or []\n    \n    def enter(self):\n        return f'You enter {self.name}. {self.description}'\n    \n    def get_item(self, item_name):\n        if item_name in self.items:\n            self.items.remove(item_name)\n            return f'You found a {item_name}!'\n        return 'Item not found here.'\n\nforest = Room('Dark Forest', 'Trees surround you.', ['key'])\nprint(forest.enter())\nprint(forest.get_item('key'))",
              hints: ["Rooms contain descriptions and items", "Methods can modify object state", "Use default parameter values for optional data"],
              tests: [
                {
                  expectedOutput: "You enter Dark Forest. Trees surround you.\nYou found a key!",
                  description: "Should create room and handle item collection"
                }
              ]
            },
            {
              id: "step-4",
              title: "Game Logic and Input Handling",
              description: "Create the main game logic that handles user commands and game flow.",
              initialCode: "# Create process_command function that takes command and player\n# Handle commands: 'health', 'inventory', 'quit'\n# Return appropriate response for each command\n# Test with different commands\n",
              solution: "def process_command(command, player):\n    if command == 'health':\n        return f'Health: {player.health}/100'\n    elif command == 'inventory':\n        if player.inventory:\n            return f'Inventory: {', '.join(player.inventory)}'\n        return 'Inventory is empty'\n    elif command == 'quit':\n        return 'Thanks for playing!'\n    else:\n        return 'Unknown command'\n\nclass Player:\n    def __init__(self, name):\n        self.name = name\n        self.health = 100\n        self.inventory = ['sword']\n\nplayer = Player('Hero')\nprint(process_command('health', player))\nprint(process_command('inventory', player))\nprint(process_command('quit', player))",
              hints: ["Command processing is the heart of text games", "Functions can take objects as parameters", "Handle edge cases like empty inventory"],
              tests: [
                {
                  expectedOutput: "Health: 100/100\nInventory: sword\nThanks for playing!",
                  description: "Should process different game commands"
                }
              ]
            },
            {
              id: "step-5",
              title: "Complete Game Integration",
              description: "Bring everything together in a complete game that demonstrates all your Python skills!",
              initialCode: "# Create a simple game that combines Player, commands, and win condition\n# Player starts with 100 health and empty inventory\n# Simulate finding treasure to win the game\n# Show victory message when treasure is found\n",
              solution: "class TreasureGame:\n    def __init__(self):\n        self.player = Player('Adventurer')\n        self.game_over = False\n    \n    def find_treasure(self):\n        self.player.add_item('treasure')\n        return 'Congratulations! You found the treasure and won the game!'\n    \n    def get_status(self):\n        return f'Player: {self.player.name}, Health: {self.player.health}, Items: {len(self.player.inventory)}'\n\nclass Player:\n    def __init__(self, name):\n        self.name = name\n        self.health = 100\n        self.inventory = []\n    \n    def add_item(self, item):\n        self.inventory.append(item)\n\ngame = TreasureGame()\nprint(game.get_status())\nprint(game.find_treasure())\nprint(game.get_status())",
              hints: ["Games coordinate multiple classes", "Track game state with boolean flags", "Victory conditions end the game"],
              tests: [
                {
                  expectedOutput: "Player: Adventurer, Health: 100, Items: 0\nCongratulations! You found the treasure and won the game!\nPlayer: Adventurer, Health: 100, Items: 1",
                  description: "Should run complete game with victory"
                }
              ]
            }
          ]
        },
        prerequisites: ["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5", "lesson-6", "lesson-7", "lesson-8"],
        difficulty: "Advanced",
        estimatedTime: 60
      }
    ];

    // Add lessons to storage
    fundamentalsCurriculum.forEach(lesson => {
      this.lessons.set(lesson.id, lesson);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      ...userData,
    };
    this.users.set(id, user);
    return user;
  }

  async getLessons(): Promise<Lesson[]> {
    return Array.from(this.lessons.values()).sort((a, b) => a.order - b.order);
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    return this.lessons.get(id);
  }

  async createLesson(lessonData: InsertLesson): Promise<Lesson> {
    const id = randomUUID();
    const lesson: Lesson = {
      id,
      ...lessonData,
    };
    this.lessons.set(id, lesson);
    return lesson;
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    const userProgressList: UserProgress[] = [];
    for (const progress of this.userProgress.values()) {
      if (progress.userId === userId) {
        userProgressList.push(progress);
      }
    }
    return userProgressList;
  }

  async getUserProgressForLesson(userId: string, lessonId: string): Promise<UserProgress | undefined> {
    for (const progress of this.userProgress.values()) {
      if (progress.userId === userId && progress.lessonId === lessonId) {
        return progress;
      }
    }
    return undefined;
  }

  async updateUserProgress(
    userId: string,
    lessonId: string,
    progressUpdate: Partial<UserProgress>
  ): Promise<UserProgress> {
    const existingProgress = await this.getUserProgressForLesson(userId, lessonId);
    
    if (existingProgress) {
      const updated: UserProgress = {
        ...existingProgress,
        ...progressUpdate,
      };
      this.userProgress.set(existingProgress.id, updated);
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
        ...progressUpdate,
      };
      this.userProgress.set(id, newProgress);
      return newProgress;
    }
  }
}

// Export a singleton storage instance
export const storage = new MemStorage();