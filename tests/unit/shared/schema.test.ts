import { describe, it, expect } from 'vitest';
import type {
  User,
  Lesson,
  UserProgress,
  Project,
  InsertUser,
  InsertLesson,
  InsertUserProgress,
  InsertProject,
  GameConfig,
  Scene,
  Entity,
  EntityBehavior,
  ProjectAsset,
  ProjectFile
} from '../../../shared/schema';

describe('Schema Type Definitions', () => {
  describe('User Types', () => {
    it('should correctly type User interface', () => {
      const user: User = {
        id: 'user-123',
        username: 'testuser'
      };
      
      expect(user.id).toBe('user-123');
      expect(user.username).toBe('testuser');
    });

    it('should correctly type InsertUser without id', () => {
      const insertUser: InsertUser = {
        username: 'newuser'
      };
      
      expect(insertUser.username).toBe('newuser');
      // @ts-expect-error - id should not exist on InsertUser
      expect(insertUser.id).toBeUndefined();
    });
  });

  describe('Lesson Types', () => {
    it('should correctly type complete Lesson interface', () => {
      const lesson: Lesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        description: 'Test Description',
        order: 1,
        intro: 'Introduction text',
        learningObjectives: ['Objective 1', 'Objective 2'],
        goalDescription: 'Goal description',
        previewCode: 'print("Hello")',
        content: {
          introduction: 'Lesson intro',
          steps: [
            {
              id: 'step-1',
              title: 'Step Title',
              description: 'Step Description',
              initialCode: '# Start here',
              solution: 'print("Solution")',
              hints: ['Hint 1', 'Hint 2'],
              tests: [
                {
                  input: 'test input',
                  expectedOutput: 'test output',
                  description: 'Test description',
                  mode: 'output',
                  astRules: {
                    requiredFunctions: ['print'],
                    requiredConstructs: [
                      { type: 'function_call', name: 'print', minCount: 1 }
                    ],
                    forbiddenConstructs: [
                      { type: 'import', name: 'os' }
                    ]
                  },
                  runtimeRules: {
                    outputContains: ['Hello'],
                    outputMatches: 'Hello.*World',
                    variableExists: ['x', 'y'],
                    functionCalled: ['print'],
                    acceptsUserInput: true,
                    outputIncludesInput: false
                  }
                }
              ],
              validation: {
                type: 'output',
                expected: 'Expected output'
              }
            }
          ]
        },
        prerequisites: ['prerequisite-1'],
        difficulty: 'Beginner',
        estimatedTime: 30
      };
      
      expect(lesson.id).toBe('lesson-1');
      expect(lesson.content.steps).toHaveLength(1);
      expect(lesson.content.steps[0].tests?.[0].mode).toBe('output');
    });

    it('should correctly type minimal Lesson interface', () => {
      const minimalLesson: Lesson = {
        id: 'lesson-min',
        title: 'Minimal',
        description: 'Desc',
        order: 0,
        content: {
          introduction: 'Intro',
          steps: []
        }
      };
      
      expect(minimalLesson.intro).toBeUndefined();
      expect(minimalLesson.prerequisites).toBeUndefined();
      expect(minimalLesson.content.steps).toEqual([]);
    });

    it('should correctly type InsertLesson without id', () => {
      const insertLesson: InsertLesson = {
        title: 'New Lesson',
        description: 'Description',
        order: 1,
        content: {
          introduction: 'Intro',
          steps: []
        }
      };
      
      // @ts-expect-error - id should not exist on InsertLesson
      expect(insertLesson.id).toBeUndefined();
      expect(insertLesson.title).toBe('New Lesson');
    });

    it('should correctly type step test configurations', () => {
      const step: Lesson['content']['steps'][0] = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Description',
        initialCode: '',
        solution: '',
        hints: [],
        tests: [
          {
            mode: 'output',
            expectedOutput: 'output'
          },
          {
            mode: 'rules',
            expectedOutput: 'output',
            astRules: {
              requiredFunctions: ['print', 'input'],
              requiredConstructs: [
                { type: 'variable_assignment', minCount: 2 },
                { type: 'function_call', name: 'print', minCount: 1, maxCount: 5 }
              ]
            }
          }
        ]
      };
      
      expect(step.tests).toHaveLength(2);
      expect(step.tests![0].mode).toBe('output');
      expect(step.tests![1].astRules?.requiredFunctions).toContain('print');
    });
  });

  describe('UserProgress Types', () => {
    it('should correctly type UserProgress interface', () => {
      const progress: UserProgress = {
        id: 'progress-1',
        userId: 'user-1',
        lessonId: 'lesson-1',
        currentStep: 3,
        completed: false,
        code: 'print("Progress")'
      };
      
      expect(progress.currentStep).toBe(3);
      expect(progress.completed).toBe(false);
      expect(progress.code).toBe('print("Progress")');
    });

    it('should allow undefined code in UserProgress', () => {
      const progress: UserProgress = {
        id: 'progress-2',
        userId: 'user-2',
        lessonId: 'lesson-2',
        currentStep: 0,
        completed: false
      };
      
      expect(progress.code).toBeUndefined();
    });

    it('should correctly type InsertUserProgress without id', () => {
      const insertProgress: InsertUserProgress = {
        userId: 'user-1',
        lessonId: 'lesson-1',
        currentStep: 1,
        completed: false
      };
      
      // @ts-expect-error - id should not exist on InsertUserProgress
      expect(insertProgress.id).toBeUndefined();
      expect(insertProgress.userId).toBe('user-1');
    });
  });

  describe('Project Types', () => {
    it('should correctly type complete Project interface', () => {
      const project: Project = {
        id: 'project-1',
        userId: 'user-1',
        name: 'Test Project',
        template: 'pygame',
        description: 'Project Description',
        published: true,
        createdAt: new Date('2024-01-01'),
        publishedAt: new Date('2024-01-02'),
        thumbnailDataUrl: 'data:image/png;base64,abc',
        files: [
          {
            path: 'main.py',
            content: 'print("Hello")'
          }
        ],
        assets: [
          {
            id: 'asset-1',
            name: 'sprite.png',
            type: 'image',
            path: '/assets/sprite.png',
            dataUrl: 'data:image/png;base64,xyz'
          }
        ]
      };
      
      expect(project.published).toBe(true);
      expect(project.publishedAt).toBeDefined();
      expect(project.files).toHaveLength(1);
      expect(project.assets).toHaveLength(1);
      expect(project.assets[0].type).toBe('image');
    });

    it('should correctly type minimal Project interface', () => {
      const minimalProject: Project = {
        id: 'project-min',
        userId: 'user-1',
        name: 'Minimal',
        template: 'basic',
        published: false,
        createdAt: new Date(),
        files: [],
        assets: []
      };
      
      expect(minimalProject.description).toBeUndefined();
      expect(minimalProject.publishedAt).toBeUndefined();
      expect(minimalProject.thumbnailDataUrl).toBeUndefined();
    });

    it('should correctly type InsertProject without generated fields', () => {
      const insertProject: InsertProject = {
        userId: 'user-1',
        name: 'New Project',
        template: 'pygame',
        published: false,
        files: [],
        assets: []
      };
      
      // @ts-expect-error - id should not exist on InsertProject
      expect(insertProject.id).toBeUndefined();
      // @ts-expect-error - createdAt should not exist on InsertProject
      expect(insertProject.createdAt).toBeUndefined();
      // @ts-expect-error - publishedAt should not exist on InsertProject
      expect(insertProject.publishedAt).toBeUndefined();
    });

    it('should correctly type ProjectAsset', () => {
      const asset: ProjectAsset = {
        id: 'asset-1',
        name: 'sound.mp3',
        type: 'sound',
        path: '/assets/sound.mp3',
        dataUrl: 'data:audio/mp3;base64,abc'
      };
      
      expect(asset.type).toBe('sound');
      expect(['image', 'sound', 'other']).toContain(asset.type);
    });

    it('should correctly type ProjectFile', () => {
      const file: ProjectFile = {
        path: 'utils/helper.py',
        content: 'def helper(): pass'
      };
      
      expect(file.path).toBe('utils/helper.py');
      expect(file.content).toContain('def helper');
    });
  });

  describe('Game Configuration Types', () => {
    it('should correctly type GameConfig interface', () => {
      const gameConfig: GameConfig = {
        id: 'game-1',
        name: 'Test Game',
        version: 1,
        scenes: [],
        componentChoices: [],
        assets: [],
        settings: {
          fps: 60,
          width: 800,
          height: 600,
          backgroundColor: '#000000',
          physics: {
            gravity: { x: 0, y: 10 },
            friction: 0.5,
            bounce: 0.3
          },
          controls: {
            keyboard: true,
            mouse: true,
            touch: false
          },
          audio: {
            masterVolume: 1.0,
            musicVolume: 0.8,
            sfxVolume: 0.9
          }
        }
      };
      
      expect(gameConfig.version).toBe(1);
      expect(gameConfig.settings.fps).toBe(60);
      expect(gameConfig.settings.physics?.gravity.y).toBe(10);
    });

    it('should correctly type Scene interface', () => {
      const scene: Scene = {
        id: 'scene-1',
        name: 'Main Scene',
        entities: [],
        backgroundColor: '#FFFFFF',
        backgroundImage: 'bg.png',
        width: 1024,
        height: 768,
        gridSize: 32,
        isMainScene: true,
        music: 'theme.mp3',
        transition: {
          type: 'fade',
          duration: 1000,
          color: '#000000'
        },
        camera: {
          x: 0,
          y: 0,
          zoom: 1,
          followEntity: 'player-1',
          bounds: { minX: 0, minY: 0, maxX: 2048, maxY: 1536 }
        }
      };
      
      expect(scene.isMainScene).toBe(true);
      expect(scene.transition?.type).toBe('fade');
      expect(scene.camera?.followEntity).toBe('player-1');
    });

    it('should correctly type Entity interface', () => {
      const entity: Entity = {
        id: 'entity-1',
        type: 'player',
        name: 'Player 1',
        position: { x: 100, y: 200 },
        size: { width: 32, height: 48 },
        rotation: 45,
        scale: { x: 1.5, y: 1.5 },
        sprite: 'player.png',
        assetPath: '/assets/player.png',
        properties: {
          health: 100,
          speed: 5
        },
        behaviors: [
          {
            id: 'behavior-1',
            type: 'move',
            parameters: { speed: 5, direction: 'horizontal' },
            trigger: {
              type: 'onKeyPress',
              params: { key: 'ArrowRight' }
            },
            enabled: true
          }
        ],
        layer: 2,
        locked: false,
        visible: true,
        collisionShape: {
          type: 'rectangle',
          width: 30,
          height: 46,
          offsetX: 1,
          offsetY: 1
        },
        physics: {
          mass: 1,
          friction: 0.1,
          bounce: 0,
          isStatic: false,
          isSensor: false,
          velocity: { x: 0, y: 0 },
          acceleration: { x: 0, y: 0 }
        }
      };
      
      expect(entity.type).toBe('player');
      expect(entity.behaviors).toHaveLength(1);
      expect(entity.behaviors![0].type).toBe('move');
      expect(entity.physics?.mass).toBe(1);
    });

    it('should correctly type EntityBehavior interface', () => {
      const behavior: EntityBehavior = {
        id: 'behavior-1',
        type: 'patrol',
        parameters: {
          path: ['point1', 'point2', 'point3'],
          speed: 3,
          loop: true
        },
        trigger: {
          type: 'always'
        },
        enabled: true
      };
      
      expect(behavior.type).toBe('patrol');
      expect(behavior.trigger?.type).toBe('always');
      expect(behavior.enabled).toBe(true);
    });

    it('should correctly type trigger configurations', () => {
      const triggers: EntityBehavior['trigger'][] = [
        { type: 'always' },
        { type: 'onClick', params: { button: 'left' } },
        { type: 'onCollision', params: { tag: 'enemy' } },
        { type: 'onKeyPress', params: { key: 'Space' } },
        { type: 'onTimer', params: { interval: 1000 } },
        { type: 'onEvent', params: { eventName: 'levelComplete' } }
      ];
      
      triggers.forEach(trigger => {
        expect(trigger).toHaveProperty('type');
        expect(['always', 'onClick', 'onCollision', 'onKeyPress', 'onTimer', 'onEvent'])
          .toContain(trigger?.type);
      });
    });
  });

  describe('Type Compatibility', () => {
    it('should maintain type compatibility between Insert and full types', () => {
      const insertUser: InsertUser = { username: 'test' };
      const fullUser: User = { ...insertUser, id: 'generated-id' };
      
      expect(fullUser.username).toBe(insertUser.username);
      expect(fullUser.id).toBeDefined();
    });

    it('should allow partial updates with correct types', () => {
      const partialProgress: Partial<UserProgress> = {
        currentStep: 5,
        completed: true
      };
      
      expect(partialProgress.currentStep).toBe(5);
      expect(partialProgress.userId).toBeUndefined();
    });

    it('should correctly type optional fields', () => {
      const lesson: Lesson = {
        id: '1',
        title: 'Title',
        description: 'Desc',
        order: 1,
        content: { introduction: 'Intro', steps: [] }
      };
      
      // Optional fields can be undefined
      expect(lesson.intro).toBeUndefined();
      expect(lesson.learningObjectives).toBeUndefined();
      expect(lesson.prerequisites).toBeUndefined();
      expect(lesson.difficulty).toBeUndefined();
      expect(lesson.estimatedTime).toBeUndefined();
    });
  });

  describe('Complex Nested Types', () => {
    it('should correctly handle deeply nested structures', () => {
      const lesson: Lesson = {
        id: 'complex-lesson',
        title: 'Complex',
        description: 'Complex lesson with nested structures',
        order: 1,
        content: {
          introduction: 'Intro',
          steps: [
            {
              id: 'step-1',
              title: 'Step',
              description: 'Desc',
              initialCode: '',
              solution: '',
              hints: [],
              tests: [
                {
                  mode: 'rules',
                  expectedOutput: 'output',
                  astRules: {
                    requiredConstructs: [
                      { type: 'if_statement', minCount: 1 },
                      { type: 'loop', minCount: 2 },
                      { type: 'function_call', name: 'print', minCount: 1 }
                    ]
                  },
                  runtimeRules: {
                    outputContains: ['result'],
                    variableExists: ['counter']
                  }
                }
              ]
            }
          ]
        }
      };
      
      const step = lesson.content.steps[0];
      const test = step.tests![0];
      const constructs = test.astRules?.requiredConstructs;
      
      expect(constructs).toHaveLength(3);
      expect(constructs?.find(c => c.type === 'loop')?.minCount).toBe(2);
    });

    it('should handle arrays of complex types', () => {
      const project: Project = {
        id: 'proj-1',
        userId: 'user-1',
        name: 'Project',
        template: 'template',
        published: false,
        createdAt: new Date(),
        files: [
          { path: 'file1.py', content: 'content1' },
          { path: 'file2.py', content: 'content2' },
          { path: 'dir/file3.py', content: 'content3' }
        ],
        assets: [
          { id: '1', name: 'img.png', type: 'image', path: '/img.png', dataUrl: 'data:' },
          { id: '2', name: 'snd.mp3', type: 'sound', path: '/snd.mp3', dataUrl: 'data:' },
          { id: '3', name: 'data.json', type: 'other', path: '/data.json', dataUrl: 'data:' }
        ]
      };
      
      expect(project.files).toHaveLength(3);
      expect(project.assets).toHaveLength(3);
      
      const assetTypes = project.assets.map(a => a.type);
      expect(assetTypes).toEqual(['image', 'sound', 'other']);
    });
  });
});