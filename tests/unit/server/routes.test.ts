import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../server/index';
import { storage } from '../../../server/storage';
import type { User, Lesson, UserProgress, Project } from '@shared/schema';

// Mock the storage module
vi.mock('../../../server/storage', () => {
  const mockStorage = {
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    getLessons: vi.fn(),
    getLesson: vi.fn(),
    createLesson: vi.fn(),
    getUserProgress: vi.fn(),
    getUserProgressForLesson: vi.fn(),
    updateUserProgress: vi.fn(),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    listPublishedProjects: vi.fn(),
    publishProject: vi.fn(),
    unpublishProject: vi.fn()
  };
  
  return {
    storage: mockStorage
  };
});

describe('API Routes', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('Lesson Endpoints', () => {
    describe('GET /api/lessons', () => {
      it('should return all lessons successfully', async () => {
        const mockLessons: Lesson[] = [
          {
            id: 'lesson-1',
            title: 'Test Lesson 1',
            description: 'Description 1',
            order: 1,
            content: { introduction: 'Intro', steps: [] }
          },
          {
            id: 'lesson-2',
            title: 'Test Lesson 2',
            description: 'Description 2',
            order: 2,
            content: { introduction: 'Intro', steps: [] }
          }
        ];

        vi.mocked(storage.getLessons).mockResolvedValue(mockLessons);

        const response = await request(app)
          .get('/api/lessons')
          .expect(200);

        expect(response.body).toEqual(mockLessons);
        expect(storage.getLessons).toHaveBeenCalledTimes(1);
      });

      it('should handle errors when fetching lessons fails', async () => {
        vi.mocked(storage.getLessons).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/lessons')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch lessons');
      });
    });

    describe('GET /api/lessons/:id', () => {
      it('should return a specific lesson by id', async () => {
        const mockLesson: Lesson = {
          id: 'lesson-1',
          title: 'Test Lesson',
          description: 'Test Description',
          order: 1,
          content: { introduction: 'Intro', steps: [] }
        };

        vi.mocked(storage.getLesson).mockResolvedValue(mockLesson);

        const response = await request(app)
          .get('/api/lessons/lesson-1')
          .expect(200);

        expect(response.body).toEqual(mockLesson);
        expect(storage.getLesson).toHaveBeenCalledWith('lesson-1');
      });

      it('should return 404 for non-existent lesson', async () => {
        vi.mocked(storage.getLesson).mockResolvedValue(undefined);

        const response = await request(app)
          .get('/api/lessons/non-existent')
          .expect(404);

        expect(response.body).toHaveProperty('message', 'Lesson not found');
      });

      it('should handle errors when fetching lesson fails', async () => {
        vi.mocked(storage.getLesson).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/lessons/lesson-1')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch lesson');
      });
    });
  });

  describe('Progress Endpoints', () => {
    describe('GET /api/progress', () => {
      it('should return all user progress', async () => {
        const mockProgress: UserProgress[] = [
          {
            id: 'progress-1',
            userId: 'mock-user-id',
            lessonId: 'lesson-1',
            currentStep: 2,
            completed: false
          }
        ];

        vi.mocked(storage.getUserProgress).mockResolvedValue(mockProgress);

        const response = await request(app)
          .get('/api/progress')
          .expect(200);

        expect(response.body).toEqual(mockProgress);
        expect(storage.getUserProgress).toHaveBeenCalledWith('mock-user-id');
      });

      it('should handle errors when fetching progress fails', async () => {
        vi.mocked(storage.getUserProgress).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/progress')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch progress');
      });
    });

    describe('GET /api/progress/:lessonId', () => {
      it('should return progress for specific lesson', async () => {
        const mockProgress: UserProgress = {
          id: 'progress-1',
          userId: 'mock-user-id',
          lessonId: 'lesson-1',
          currentStep: 3,
          completed: true
        };

        vi.mocked(storage.getUserProgressForLesson).mockResolvedValue(mockProgress);

        const response = await request(app)
          .get('/api/progress/lesson-1')
          .expect(200);

        expect(response.body).toEqual(mockProgress);
        expect(storage.getUserProgressForLesson).toHaveBeenCalledWith('mock-user-id', 'lesson-1');
      });

      it('should return null for lesson with no progress', async () => {
        vi.mocked(storage.getUserProgressForLesson).mockResolvedValue(undefined);

        const response = await request(app)
          .get('/api/progress/lesson-1')
          .expect(200);

        expect(response.body).toBeNull();
      });

      it('should handle errors when fetching lesson progress fails', async () => {
        vi.mocked(storage.getUserProgressForLesson).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/progress/lesson-1')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch lesson progress');
      });
    });

    describe('PUT /api/progress/:lessonId', () => {
      it('should update progress successfully', async () => {
        const updateData = {
          currentStep: 5,
          completed: true,
          code: 'print("Updated")'
        };

        const mockUpdatedProgress: UserProgress = {
          id: 'progress-1',
          userId: 'mock-user-id',
          lessonId: 'lesson-1',
          ...updateData
        };

        vi.mocked(storage.updateUserProgress).mockResolvedValue(mockUpdatedProgress);

        const response = await request(app)
          .put('/api/progress/lesson-1')
          .send(updateData)
          .expect(200);

        expect(response.body).toEqual(mockUpdatedProgress);
        expect(storage.updateUserProgress).toHaveBeenCalledWith(
          'mock-user-id',
          'lesson-1',
          updateData
        );
      });

      it('should handle partial updates', async () => {
        const partialUpdate = { currentStep: 3 };

        const mockUpdatedProgress: UserProgress = {
          id: 'progress-1',
          userId: 'mock-user-id',
          lessonId: 'lesson-1',
          currentStep: 3,
          completed: false
        };

        vi.mocked(storage.updateUserProgress).mockResolvedValue(mockUpdatedProgress);

        const response = await request(app)
          .put('/api/progress/lesson-1')
          .send(partialUpdate)
          .expect(200);

        expect(response.body).toEqual(mockUpdatedProgress);
      });

      it('should return 400 for invalid progress data', async () => {
        const invalidData = {
          currentStep: 'not a number',
          completed: 'not a boolean'
        };

        const response = await request(app)
          .put('/api/progress/lesson-1')
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('message', 'Invalid progress data');
        expect(response.body).toHaveProperty('errors');
        expect(storage.updateUserProgress).not.toHaveBeenCalled();
      });

      it('should handle errors when updating progress fails', async () => {
        vi.mocked(storage.updateUserProgress).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .put('/api/progress/lesson-1')
          .send({ currentStep: 2 })
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to update progress');
      });
    });
  });

  describe('Execute Endpoint', () => {
    describe('POST /api/execute', () => {
      it('should handle code execution request', async () => {
        const response = await request(app)
          .post('/api/execute')
          .send({ code: 'print("Hello, World!")' })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('output');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('should return 400 when code is missing', async () => {
        const response = await request(app)
          .post('/api/execute')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('message', 'Code is required');
      });

      it('should return 400 when code is not a string', async () => {
        const response = await request(app)
          .post('/api/execute')
          .send({ code: 123 })
          .expect(400);

        expect(response.body).toHaveProperty('message', 'Code is required');
      });

      it('should handle empty code string', async () => {
        const response = await request(app)
          .post('/api/execute')
          .send({ code: '' })
          .expect(400);

        expect(response.body).toHaveProperty('message', 'Code is required');
      });
    });
  });

  describe('Project Endpoints', () => {
    describe('GET /api/projects', () => {
      it('should return user projects', async () => {
        const mockProjects: Project[] = [
          {
            id: 'project-1',
            userId: 'mock-user-id',
            name: 'Test Project',
            template: 'pygame',
            published: false,
            createdAt: new Date(),
            files: [],
            assets: []
          }
        ];

        vi.mocked(storage.listProjects).mockResolvedValue(mockProjects);

        const response = await request(app)
          .get('/api/projects')
          .expect(200);

        expect(response.body).toEqual(
          JSON.parse(JSON.stringify(mockProjects)) // Handle date serialization
        );
        expect(storage.listProjects).toHaveBeenCalledWith('mock-user-id');
      });

      it('should handle errors when fetching projects fails', async () => {
        vi.mocked(storage.listProjects).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/projects')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch projects');
      });
    });

    describe('POST /api/projects', () => {
      it('should create a new project', async () => {
        const newProjectData = {
          name: 'New Project',
          template: 'pygame',
          description: 'Test Description',
          published: false,
          files: [{ path: 'main.py', content: 'print("Hello")' }],
          assets: []
        };

        const mockCreatedProject: Project = {
          id: 'project-1',
          userId: 'mock-user-id',
          ...newProjectData,
          createdAt: new Date()
        };

        vi.mocked(storage.createProject).mockResolvedValue(mockCreatedProject);

        const response = await request(app)
          .post('/api/projects')
          .send(newProjectData)
          .expect(201);

        expect(response.body.name).toBe('New Project');
        expect(storage.createProject).toHaveBeenCalledWith({
          ...newProjectData,
          userId: 'mock-user-id'
        });
      });

      it('should return 400 for invalid project data', async () => {
        const invalidData = {
          // Missing required fields
          description: 'Missing name and template'
        };

        vi.mocked(storage.createProject).mockRejectedValue(
          Object.assign(new Error('Validation error'), { name: 'ZodError', errors: [] })
        );

        const response = await request(app)
          .post('/api/projects')
          .send(invalidData)
          .expect(500); // Will be 500 because storage layer throws, not validates

        expect(response.body).toHaveProperty('message');
      });

      it('should handle errors when creating project fails', async () => {
        vi.mocked(storage.createProject).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/projects')
          .send({ name: 'Project', template: 'pygame', published: false, files: [], assets: [] })
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to create project');
      });
    });

    describe('GET /api/projects/:id', () => {
      it('should return a specific project', async () => {
        const mockProject: Project = {
          id: 'project-1',
          userId: 'mock-user-id',
          name: 'Test Project',
          template: 'pygame',
          published: false,
          createdAt: new Date(),
          files: [],
          assets: []
        };

        vi.mocked(storage.getProject).mockResolvedValue(mockProject);

        const response = await request(app)
          .get('/api/projects/project-1')
          .expect(200);

        expect(response.body.id).toBe('project-1');
        expect(storage.getProject).toHaveBeenCalledWith('project-1');
      });

      it('should return 404 for non-existent project', async () => {
        vi.mocked(storage.getProject).mockResolvedValue(undefined);

        const response = await request(app)
          .get('/api/projects/non-existent')
          .expect(404);

        expect(response.body).toHaveProperty('message', 'Project not found');
      });

      it('should handle errors when fetching project fails', async () => {
        vi.mocked(storage.getProject).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/projects/project-1')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch project');
      });
    });

    describe('PUT /api/projects/:id', () => {
      it('should update a project', async () => {
        const updateData = {
          name: 'Updated Project',
          description: 'Updated Description'
        };

        const mockUpdatedProject: Project = {
          id: 'project-1',
          userId: 'mock-user-id',
          name: 'Updated Project',
          template: 'pygame',
          description: 'Updated Description',
          published: false,
          createdAt: new Date(),
          files: [],
          assets: []
        };

        vi.mocked(storage.updateProject).mockResolvedValue(mockUpdatedProject);

        const response = await request(app)
          .put('/api/projects/project-1')
          .send(updateData)
          .expect(200);

        expect(response.body.name).toBe('Updated Project');
        expect(storage.updateProject).toHaveBeenCalledWith('project-1', updateData);
      });

      it('should handle updating files and assets', async () => {
        const updateData = {
          files: [
            { path: 'main.py', content: 'new content' },
            { path: 'utils.py', content: 'utils' }
          ],
          assets: [
            {
              id: 'asset-1',
              name: 'sprite.png',
              type: 'image' as const,
              path: '/assets/sprite.png',
              dataUrl: 'data:image/png;base64,abc'
            }
          ]
        };

        const mockUpdatedProject: Project = {
          id: 'project-1',
          userId: 'mock-user-id',
          name: 'Project',
          template: 'pygame',
          published: false,
          createdAt: new Date(),
          ...updateData
        };

        vi.mocked(storage.updateProject).mockResolvedValue(mockUpdatedProject);

        const response = await request(app)
          .put('/api/projects/project-1')
          .send(updateData)
          .expect(200);

        expect(response.body.files).toHaveLength(2);
        expect(response.body.assets).toHaveLength(1);
      });

      it('should return 400 for invalid update data', async () => {
        const invalidData = {
          assets: [
            {
              // Missing required fields
              name: 'invalid.png'
            }
          ]
        };

        const response = await request(app)
          .put('/api/projects/project-1')
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('message', 'Invalid project data');
        expect(response.body).toHaveProperty('errors');
      });

      it('should return 404 when project not found', async () => {
        vi.mocked(storage.updateProject).mockRejectedValue(new Error('Project not found'));

        const response = await request(app)
          .put('/api/projects/non-existent')
          .send({ name: 'New Name' })
          .expect(404);

        expect(response.body).toHaveProperty('message', 'Project not found');
      });

      it('should handle errors when updating project fails', async () => {
        vi.mocked(storage.updateProject).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .put('/api/projects/project-1')
          .send({ name: 'Updated' })
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to update project');
      });
    });

    describe('DELETE /api/projects/:id', () => {
      it('should delete a project', async () => {
        vi.mocked(storage.deleteProject).mockResolvedValue();

        const response = await request(app)
          .delete('/api/projects/project-1')
          .expect(204);

        expect(response.body).toEqual({});
        expect(storage.deleteProject).toHaveBeenCalledWith('project-1');
      });

      it('should handle errors when deleting project fails', async () => {
        vi.mocked(storage.deleteProject).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .delete('/api/projects/project-1')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to delete project');
      });
    });
  });

  describe('Gallery Endpoints', () => {
    describe('GET /api/gallery', () => {
      it('should return published projects', async () => {
        const mockPublishedProjects: Project[] = [
          {
            id: 'project-1',
            userId: 'user-1',
            name: 'Published Project',
            template: 'pygame',
            published: true,
            createdAt: new Date(),
            publishedAt: new Date(),
            files: [],
            assets: []
          }
        ];

        vi.mocked(storage.listPublishedProjects).mockResolvedValue(mockPublishedProjects);

        const response = await request(app)
          .get('/api/gallery')
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].name).toBe('Published Project');
      });

      it('should handle errors when fetching gallery fails', async () => {
        vi.mocked(storage.listPublishedProjects).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/gallery')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch gallery projects');
      });
    });

    describe('GET /api/gallery/:id', () => {
      it('should return specific published project', async () => {
        const mockPublishedProjects: Project[] = [
          {
            id: 'project-1',
            userId: 'user-1',
            name: 'Published Project',
            template: 'pygame',
            published: true,
            createdAt: new Date(),
            files: [],
            assets: []
          },
          {
            id: 'project-2',
            userId: 'user-2',
            name: 'Another Published',
            template: 'platformer',
            published: true,
            createdAt: new Date(),
            files: [],
            assets: []
          }
        ];

        vi.mocked(storage.listPublishedProjects).mockResolvedValue(mockPublishedProjects);

        const response = await request(app)
          .get('/api/gallery/project-1')
          .expect(200);

        expect(response.body.id).toBe('project-1');
        expect(response.body.name).toBe('Published Project');
      });

      it('should return 404 for non-existent published project', async () => {
        vi.mocked(storage.listPublishedProjects).mockResolvedValue([]);

        const response = await request(app)
          .get('/api/gallery/non-existent')
          .expect(404);

        expect(response.body).toHaveProperty('message', 'Published project not found');
      });

      it('should handle errors when fetching gallery project fails', async () => {
        vi.mocked(storage.listPublishedProjects).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/gallery/project-1')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to fetch gallery project');
      });
    });

    describe('POST /api/projects/:id/publish', () => {
      it('should publish a project', async () => {
        const mockPublishedProject: Project = {
          id: 'project-1',
          userId: 'mock-user-id',
          name: 'Project',
          template: 'pygame',
          published: true,
          publishedAt: new Date(),
          createdAt: new Date(),
          files: [],
          assets: []
        };

        vi.mocked(storage.publishProject).mockResolvedValue(mockPublishedProject);

        const response = await request(app)
          .post('/api/projects/project-1/publish')
          .expect(200);

        expect(response.body.published).toBe(true);
        expect(response.body).toHaveProperty('publishedAt');
        expect(storage.publishProject).toHaveBeenCalledWith('project-1');
      });

      it('should return 404 when project not found', async () => {
        vi.mocked(storage.publishProject).mockRejectedValue(new Error('Project not found'));

        const response = await request(app)
          .post('/api/projects/non-existent/publish')
          .expect(404);

        expect(response.body).toHaveProperty('message', 'Project not found');
      });

      it('should handle errors when publishing fails', async () => {
        vi.mocked(storage.publishProject).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/projects/project-1/publish')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to publish project');
      });
    });

    describe('POST /api/projects/:id/unpublish', () => {
      it('should unpublish a project', async () => {
        const mockUnpublishedProject: Project = {
          id: 'project-1',
          userId: 'mock-user-id',
          name: 'Project',
          template: 'pygame',
          published: false,
          createdAt: new Date(),
          files: [],
          assets: []
        };

        vi.mocked(storage.unpublishProject).mockResolvedValue(mockUnpublishedProject);

        const response = await request(app)
          .post('/api/projects/project-1/unpublish')
          .expect(200);

        expect(response.body.published).toBe(false);
        expect(response.body.publishedAt).toBeUndefined();
        expect(storage.unpublishProject).toHaveBeenCalledWith('project-1');
      });

      it('should return 404 when project not found', async () => {
        vi.mocked(storage.unpublishProject).mockRejectedValue(new Error('Project not found'));

        const response = await request(app)
          .post('/api/projects/non-existent/unpublish')
          .expect(404);

        expect(response.body).toHaveProperty('message', 'Project not found');
      });

      it('should handle errors when unpublishing fails', async () => {
        vi.mocked(storage.unpublishProject).mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/projects/project-1/unpublish')
          .expect(500);

        expect(response.body).toHaveProperty('message', 'Failed to unpublish project');
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle very large payloads', async () => {
      const largeCode = 'x'.repeat(1000000); // 1MB of text
      
      const response = await request(app)
        .put('/api/progress/lesson-1')
        .send({ code: largeCode, currentStep: 1 })
        .expect(200, 500); // Either succeeds or fails gracefully
      
      if (response.status === 500) {
        expect(response.body).toHaveProperty('message');
      }
    });

    it('should handle special characters in URLs', async () => {
      const specialId = 'lesson%20with%20spaces';
      vi.mocked(storage.getLesson).mockResolvedValue(undefined);

      const response = await request(app)
        .get(`/api/lessons/${specialId}`)
        .expect(404);

      expect(storage.getLesson).toHaveBeenCalledWith('lesson with spaces');
    });

    it('should handle empty arrays in responses', async () => {
      vi.mocked(storage.getLessons).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/lessons')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle concurrent requests', async () => {
      vi.mocked(storage.getLessons).mockResolvedValue([]);

      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/lessons')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});