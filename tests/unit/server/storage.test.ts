import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemStorage } from '../../../server/storage';
import type { User, Lesson, UserProgress, Project, InsertUser, InsertLesson, InsertUserProgress, InsertProject } from '@shared/schema';

describe('MemStorage', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe('User Operations', () => {
    describe('createUser', () => {
      it('should create a new user with generated id', async () => {
        const userData: InsertUser = {
          username: 'testuser'
        };

        const user = await storage.createUser(userData);
        
        expect(user).toHaveProperty('id');
        expect(user.username).toBe('testuser');
        expect(typeof user.id).toBe('string');
      });

      it('should create multiple users with unique ids', async () => {
        const user1 = await storage.createUser({ username: 'user1' });
        const user2 = await storage.createUser({ username: 'user2' });

        expect(user1.id).not.toBe(user2.id);
        expect(user1.username).toBe('user1');
        expect(user2.username).toBe('user2');
      });
    });

    describe('getUser', () => {
      it('should retrieve an existing user by id', async () => {
        const created = await storage.createUser({ username: 'testuser' });
        const retrieved = await storage.getUser(created.id);

        expect(retrieved).toEqual(created);
      });

      it('should return undefined for non-existent user', async () => {
        const user = await storage.getUser('non-existent-id');
        expect(user).toBeUndefined();
      });
    });

    describe('getUserByUsername', () => {
      it('should retrieve an existing user by username', async () => {
        const created = await storage.createUser({ username: 'uniqueuser' });
        const retrieved = await storage.getUserByUsername('uniqueuser');

        expect(retrieved).toEqual(created);
      });

      it('should return undefined for non-existent username', async () => {
        const user = await storage.getUserByUsername('non-existent-username');
        expect(user).toBeUndefined();
      });

      it('should handle case-sensitive usernames', async () => {
        await storage.createUser({ username: 'TestUser' });
        const lowerCase = await storage.getUserByUsername('testuser');
        const upperCase = await storage.getUserByUsername('TestUser');

        expect(lowerCase).toBeUndefined();
        expect(upperCase).toBeDefined();
        expect(upperCase?.username).toBe('TestUser');
      });
    });
  });

  describe('Lesson Operations', () => {
    describe('createLesson', () => {
      it('should create a new lesson with generated id', async () => {
        const lessonData: InsertLesson = {
          title: 'Test Lesson',
          description: 'Test Description',
          order: 1,
          content: {
            introduction: 'Intro',
            steps: []
          }
        };

        const lesson = await storage.createLesson(lessonData);
        
        expect(lesson).toHaveProperty('id');
        expect(lesson.title).toBe('Test Lesson');
        expect(typeof lesson.id).toBe('string');
      });
    });

    describe('getLessons', () => {
      it('should return all lessons sorted by order', async () => {
        const lessons = await storage.getLessons();
        
        expect(Array.isArray(lessons)).toBe(true);
        expect(lessons.length).toBeGreaterThan(0);
        
        // Check if lessons are sorted by order
        for (let i = 1; i < lessons.length; i++) {
          expect(lessons[i].order).toBeGreaterThanOrEqual(lessons[i - 1].order);
        }
      });

      it('should return initialized curriculum lessons', async () => {
        const lessons = await storage.getLessons();
        
        // Should have at least the initial curriculum lessons
        expect(lessons.length).toBeGreaterThanOrEqual(10);
        
        // Check first lesson is Python Basics
        const pythonBasics = lessons.find(l => l.id === 'python-basics');
        expect(pythonBasics).toBeDefined();
        expect(pythonBasics?.title).toBe('Python Basics');
      });
    });

    describe('getLesson', () => {
      it('should retrieve an existing lesson by id', async () => {
        const lesson = await storage.getLesson('python-basics');
        
        expect(lesson).toBeDefined();
        expect(lesson?.id).toBe('python-basics');
        expect(lesson?.title).toBe('Python Basics');
      });

      it('should return undefined for non-existent lesson', async () => {
        const lesson = await storage.getLesson('non-existent-lesson');
        expect(lesson).toBeUndefined();
      });

      it('should include all lesson properties', async () => {
        const lesson = await storage.getLesson('python-basics');
        
        expect(lesson).toHaveProperty('id');
        expect(lesson).toHaveProperty('title');
        expect(lesson).toHaveProperty('description');
        expect(lesson).toHaveProperty('order');
        expect(lesson).toHaveProperty('content');
        expect(lesson?.content).toHaveProperty('introduction');
        expect(lesson?.content).toHaveProperty('steps');
      });
    });
  });

  describe('UserProgress Operations', () => {
    let userId: string;
    let lessonId: string;

    beforeEach(async () => {
      const user = await storage.createUser({ username: 'progressuser' });
      userId = user.id;
      lessonId = 'python-basics';
    });

    describe('getUserProgress', () => {
      it('should return empty array for user with no progress', async () => {
        const progress = await storage.getUserProgress(userId);
        expect(progress).toEqual([]);
      });

      it('should return all progress records for user', async () => {
        await storage.updateUserProgress(userId, 'python-basics', { currentStep: 1 });
        await storage.updateUserProgress(userId, 'control-flow', { currentStep: 2 });
        
        const progress = await storage.getUserProgress(userId);
        
        expect(progress).toHaveLength(2);
        expect(progress.some(p => p.lessonId === 'python-basics')).toBe(true);
        expect(progress.some(p => p.lessonId === 'control-flow')).toBe(true);
      });
    });

    describe('getUserProgressForLesson', () => {
      it('should return undefined for lesson with no progress', async () => {
        const progress = await storage.getUserProgressForLesson(userId, lessonId);
        expect(progress).toBeUndefined();
      });

      it('should return progress for specific lesson', async () => {
        await storage.updateUserProgress(userId, lessonId, { 
          currentStep: 3, 
          completed: false 
        });
        
        const progress = await storage.getUserProgressForLesson(userId, lessonId);
        
        expect(progress).toBeDefined();
        expect(progress?.currentStep).toBe(3);
        expect(progress?.completed).toBe(false);
      });
    });

    describe('updateUserProgress', () => {
      it('should create new progress record if none exists', async () => {
        const progress = await storage.updateUserProgress(userId, lessonId, {
          currentStep: 1,
          completed: false,
          code: 'print("Hello")'
        });

        expect(progress).toHaveProperty('id');
        expect(progress.userId).toBe(userId);
        expect(progress.lessonId).toBe(lessonId);
        expect(progress.currentStep).toBe(1);
        expect(progress.completed).toBe(false);
        expect(progress.code).toBe('print("Hello")');
      });

      it('should update existing progress record', async () => {
        await storage.updateUserProgress(userId, lessonId, { currentStep: 1 });
        
        const updated = await storage.updateUserProgress(userId, lessonId, {
          currentStep: 2,
          completed: true,
          code: 'print("Updated")'
        });

        expect(updated.currentStep).toBe(2);
        expect(updated.completed).toBe(true);
        expect(updated.code).toBe('print("Updated")');
        
        // Verify only one record exists
        const allProgress = await storage.getUserProgress(userId);
        const lessonProgress = allProgress.filter(p => p.lessonId === lessonId);
        expect(lessonProgress).toHaveLength(1);
      });

      it('should handle partial updates', async () => {
        await storage.updateUserProgress(userId, lessonId, {
          currentStep: 1,
          completed: false,
          code: 'initial code'
        });

        // Update only currentStep
        await storage.updateUserProgress(userId, lessonId, { currentStep: 2 });
        let progress = await storage.getUserProgressForLesson(userId, lessonId);
        expect(progress?.currentStep).toBe(2);
        expect(progress?.completed).toBe(false);
        expect(progress?.code).toBe('initial code');

        // Update only completed status
        await storage.updateUserProgress(userId, lessonId, { completed: true });
        progress = await storage.getUserProgressForLesson(userId, lessonId);
        expect(progress?.currentStep).toBe(2);
        expect(progress?.completed).toBe(true);
        expect(progress?.code).toBe('initial code');
      });
    });
  });

  describe('Project Operations', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await storage.createUser({ username: 'projectuser' });
      userId = user.id;
    });

    describe('createProject', () => {
      it('should create a new project with generated id and timestamps', async () => {
        const projectData: InsertProject = {
          userId,
          name: 'Test Project',
          template: 'pygame',
          description: 'Test Description',
          published: false,
          files: [],
          assets: []
        };

        const project = await storage.createProject(projectData);
        
        expect(project).toHaveProperty('id');
        expect(project).toHaveProperty('createdAt');
        expect(project.name).toBe('Test Project');
        expect(project.template).toBe('pygame');
        expect(project.published).toBe(false);
        expect(project.publishedAt).toBeUndefined();
        expect(typeof project.id).toBe('string');
        expect(project.createdAt instanceof Date).toBe(true);
      });

      it('should handle projects with files and assets', async () => {
        const projectData: InsertProject = {
          userId,
          name: 'Complex Project',
          template: 'pygame',
          published: false,
          files: [
            { path: 'main.py', content: 'print("Hello")' },
            { path: 'utils.py', content: 'def helper(): pass' }
          ],
          assets: [
            {
              id: 'asset-1',
              name: 'sprite.png',
              type: 'image',
              path: '/assets/sprite.png',
              dataUrl: 'data:image/png;base64,abc123'
            }
          ]
        };

        const project = await storage.createProject(projectData);
        
        expect(project.files).toHaveLength(2);
        expect(project.files[0].path).toBe('main.py');
        expect(project.assets).toHaveLength(1);
        expect(project.assets[0].name).toBe('sprite.png');
      });
    });

    describe('listProjects', () => {
      it('should return empty array for user with no projects', async () => {
        const projects = await storage.listProjects(userId);
        expect(projects).toEqual([]);
      });

      it('should return all projects for a user', async () => {
        await storage.createProject({
          userId,
          name: 'Project 1',
          template: 'pygame',
          published: false,
          files: [],
          assets: []
        });
        
        await storage.createProject({
          userId,
          name: 'Project 2',
          template: 'platformer',
          published: false,
          files: [],
          assets: []
        });

        const projects = await storage.listProjects(userId);
        
        expect(projects).toHaveLength(2);
        expect(projects[0].name).toBe('Project 1');
        expect(projects[1].name).toBe('Project 2');
      });

      it('should not return projects from other users', async () => {
        const otherUser = await storage.createUser({ username: 'otheruser' });
        
        await storage.createProject({
          userId,
          name: 'My Project',
          template: 'pygame',
          published: false,
          files: [],
          assets: []
        });
        
        await storage.createProject({
          userId: otherUser.id,
          name: 'Other Project',
          template: 'pygame',
          published: false,
          files: [],
          assets: []
        });

        const myProjects = await storage.listProjects(userId);
        
        expect(myProjects).toHaveLength(1);
        expect(myProjects[0].name).toBe('My Project');
      });
    });

    describe('getProject', () => {
      it('should retrieve an existing project by id', async () => {
        const created = await storage.createProject({
          userId,
          name: 'Get Test Project',
          template: 'pygame',
          published: false,
          files: [],
          assets: []
        });

        const retrieved = await storage.getProject(created.id);
        
        expect(retrieved).toEqual(created);
      });

      it('should return undefined for non-existent project', async () => {
        const project = await storage.getProject('non-existent-id');
        expect(project).toBeUndefined();
      });
    });

    describe('updateProject', () => {
      it('should update project properties', async () => {
        const project = await storage.createProject({
          userId,
          name: 'Original Name',
          template: 'pygame',
          published: false,
          files: [],
          assets: []
        });

        const updated = await storage.updateProject(project.id, {
          name: 'Updated Name',
          description: 'New Description'
        });

        expect(updated.name).toBe('Updated Name');
        expect(updated.description).toBe('New Description');
        expect(updated.template).toBe('pygame'); // Unchanged
      });

      it('should throw error for non-existent project', async () => {
        await expect(
          storage.updateProject('non-existent-id', { name: 'New Name' })
        ).rejects.toThrow('Project not found');
      });

      it('should handle updating files and assets', async () => {
        const project = await storage.createProject({
          userId,
          name: 'Project',
          template: 'pygame',
          published: false,
          files: [{ path: 'old.py', content: 'old' }],
          assets: []
        });

        const updated = await storage.updateProject(project.id, {
          files: [
            { path: 'new.py', content: 'new' },
            { path: 'another.py', content: 'another' }
          ],
          assets: [
            {
              id: 'new-asset',
              name: 'image.png',
              type: 'image',
              path: '/assets/image.png',
              dataUrl: 'data:image/png;base64,xyz'
            }
          ]
        });

        expect(updated.files).toHaveLength(2);
        expect(updated.files[0].path).toBe('new.py');
        expect(updated.assets).toHaveLength(1);
        expect(updated.assets[0].name).toBe('image.png');
      });
    });

    describe('deleteProject', () => {
      it('should delete an existing project', async () => {
        const project = await storage.createProject({
          userId,
          name: 'To Delete',
          template: 'pygame',
          published: false,
          files: [],
          assets: []
        });

        await storage.deleteProject(project.id);
        
        const retrieved = await storage.getProject(project.id);
        expect(retrieved).toBeUndefined();
        
        const userProjects = await storage.listProjects(userId);
        expect(userProjects).toHaveLength(0);
      });

      it('should not throw error when deleting non-existent project', async () => {
        await expect(
          storage.deleteProject('non-existent-id')
        ).resolves.not.toThrow();
      });
    });

    describe('Gallery Operations', () => {
      describe('listPublishedProjects', () => {
        it('should return empty array when no projects are published', async () => {
          await storage.createProject({
            userId,
            name: 'Unpublished',
            template: 'pygame',
            published: false,
            files: [],
            assets: []
          });

          const published = await storage.listPublishedProjects();
          expect(published).toEqual([]);
        });

        it('should return only published projects', async () => {
          await storage.createProject({
            userId,
            name: 'Unpublished',
            template: 'pygame',
            published: false,
            files: [],
            assets: []
          });

          const publishedProject = await storage.createProject({
            userId,
            name: 'Published',
            template: 'pygame',
            published: true,
            files: [],
            assets: []
          });

          const published = await storage.listPublishedProjects();
          
          expect(published).toHaveLength(1);
          expect(published[0].name).toBe('Published');
          expect(published[0].published).toBe(true);
        });

        it('should include published projects from all users', async () => {
          const otherUser = await storage.createUser({ username: 'otheruser' });
          
          await storage.createProject({
            userId,
            name: 'User1 Published',
            template: 'pygame',
            published: true,
            files: [],
            assets: []
          });

          await storage.createProject({
            userId: otherUser.id,
            name: 'User2 Published',
            template: 'pygame',
            published: true,
            files: [],
            assets: []
          });

          const published = await storage.listPublishedProjects();
          
          expect(published).toHaveLength(2);
          expect(published.some(p => p.name === 'User1 Published')).toBe(true);
          expect(published.some(p => p.name === 'User2 Published')).toBe(true);
        });
      });

      describe('publishProject', () => {
        it('should publish an unpublished project', async () => {
          const project = await storage.createProject({
            userId,
            name: 'To Publish',
            template: 'pygame',
            published: false,
            files: [],
            assets: []
          });

          const published = await storage.publishProject(project.id);
          
          expect(published.published).toBe(true);
          expect(published.publishedAt).toBeDefined();
          expect(published.publishedAt instanceof Date).toBe(true);
        });

        it('should update publishedAt when republishing', async () => {
          const project = await storage.createProject({
            userId,
            name: 'Project',
            template: 'pygame',
            published: true,
            files: [],
            assets: []
          });

          const initialPublishedAt = project.publishedAt;
          
          // Wait a tiny bit to ensure different timestamp
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const republished = await storage.publishProject(project.id);
          
          expect(republished.published).toBe(true);
          expect(republished.publishedAt).toBeDefined();
          expect(republished.publishedAt?.getTime()).toBeGreaterThan(
            initialPublishedAt?.getTime() || 0
          );
        });

        it('should throw error for non-existent project', async () => {
          await expect(
            storage.publishProject('non-existent-id')
          ).rejects.toThrow('Project not found');
        });
      });

      describe('unpublishProject', () => {
        it('should unpublish a published project', async () => {
          const project = await storage.createProject({
            userId,
            name: 'To Unpublish',
            template: 'pygame',
            published: true,
            files: [],
            assets: []
          });

          const unpublished = await storage.unpublishProject(project.id);
          
          expect(unpublished.published).toBe(false);
          expect(unpublished.publishedAt).toBeUndefined();
        });

        it('should handle unpublishing already unpublished project', async () => {
          const project = await storage.createProject({
            userId,
            name: 'Already Unpublished',
            template: 'pygame',
            published: false,
            files: [],
            assets: []
          });

          const result = await storage.unpublishProject(project.id);
          
          expect(result.published).toBe(false);
          expect(result.publishedAt).toBeUndefined();
        });

        it('should throw error for non-existent project', async () => {
          await expect(
            storage.unpublishProject('non-existent-id')
          ).rejects.toThrow('Project not found');
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent operations on the same data', async () => {
      const userId = (await storage.createUser({ username: 'concurrent' })).id;
      
      // Simulate concurrent progress updates
      const promises = Array.from({ length: 5 }, (_, i) =>
        storage.updateUserProgress(userId, 'python-basics', {
          currentStep: i + 1
        })
      );

      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(5);
      
      // Final state should reflect last update
      const finalProgress = await storage.getUserProgressForLesson(userId, 'python-basics');
      expect(finalProgress?.currentStep).toBe(5);
    });

    it('should handle empty strings and edge values', async () => {
      const user = await storage.createUser({ username: '' });
      expect(user.username).toBe('');
      
      const project = await storage.createProject({
        userId: user.id,
        name: '',
        template: '',
        description: '',
        published: false,
        files: [],
        assets: []
      });
      
      expect(project.name).toBe('');
      expect(project.template).toBe('');
      expect(project.description).toBe('');
    });

    it('should maintain data isolation between instances', async () => {
      const storage1 = new MemStorage();
      const storage2 = new MemStorage();
      
      const user1 = await storage1.createUser({ username: 'user1' });
      const users2 = await storage2.getUserByUsername('user1');
      
      // Storage instances should be independent
      expect(users2).toBeUndefined();
    });
  });

  describe('Initialization', () => {
    it('should initialize with curriculum lessons', () => {
      const newStorage = new MemStorage();
      
      // Use async method to check lessons
      return newStorage.getLessons().then(lessons => {
        expect(lessons.length).toBeGreaterThanOrEqual(10);
        
        const expectedLessons = [
          'python-basics',
          'control-flow',
          'loops',
          'lists',
          'functions',
          'pygame-basics',
          'sprites-movement',
          'collision-detection',
          'game-states',
          'final-project'
        ];
        
        expectedLessons.forEach(lessonId => {
          const lesson = lessons.find(l => l.id === lessonId);
          expect(lesson).toBeDefined();
        });
      });
    });
  });
});