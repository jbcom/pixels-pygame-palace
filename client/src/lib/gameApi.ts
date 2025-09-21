// API service for connecting to the Python Flask backend

const FLASK_API_BASE = 'http://localhost:5001/api';

export interface GameProject {
  id: string;
  name: string;
  description: string;
  gameType: string;
  components: any[];
  code: string;
  created_at: number;
  updated_at: number;
}

export interface CompileResponse {
  success: boolean;
  code?: string;
  message?: string;
  error?: string;
}

export interface ExecuteResponse {
  success: boolean;
  session_id?: string;
  message?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class GameAPI {
  private baseUrl = FLASK_API_BASE;

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('Flask backend health check failed:', error);
      return false;
    }
  }

  // Compile game from components
  async compileGame(components: any[], gameType: string = 'platformer'): Promise<CompileResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          components,
          gameType
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to compile game:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compile game'
      };
    }
  }

  // Execute game code
  async executeGame(code: string): Promise<ExecuteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to execute game:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute game'
      };
    }
  }

  // Stream game output using SSE
  streamGameOutput(sessionId: string, onFrame: (frame: string) => void, onEnd: () => void): EventSource {
    const eventSource = new EventSource(`${this.baseUrl}/game-stream/${sessionId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'frame') {
          onFrame(data.data); // Base64 encoded frame
        } else if (data.type === 'end') {
          onEnd();
          eventSource.close();
        } else if (data.error) {
          console.error('Stream error:', data.error);
          eventSource.close();
        }
      } catch (error) {
        console.error('Failed to parse stream data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
      onEnd();
    };

    return eventSource;
  }

  // Save project
  async saveProject(project: Partial<GameProject>): Promise<ApiResponse<GameProject>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
      });

      const data = await response.json();
      return {
        success: data.success,
        data: data.project,
        error: data.error
      };
    } catch (error) {
      console.error('Failed to save project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save project'
      };
    }
  }

  // Load all projects
  async loadProjects(): Promise<ApiResponse<GameProject[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects`);
      const data = await response.json();
      
      return {
        success: data.success,
        data: data.projects,
        error: data.error
      };
    } catch (error) {
      console.error('Failed to load projects:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load projects'
      };
    }
  }

  // Load specific project
  async loadProject(projectId: string): Promise<ApiResponse<GameProject>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${projectId}`);
      const data = await response.json();
      
      return {
        success: data.success,
        data: data.project,
        error: data.error
      };
    } catch (error) {
      console.error('Failed to load project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load project'
      };
    }
  }

  // Update project
  async updateProject(projectId: string, updates: Partial<GameProject>): Promise<ApiResponse<GameProject>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      return {
        success: data.success,
        data: data.project,
        error: data.error
      };
    } catch (error) {
      console.error('Failed to update project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project'
      };
    }
  }

  // Delete project
  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      return {
        success: data.success,
        error: data.error
      };
    } catch (error) {
      console.error('Failed to delete project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project'
      };
    }
  }

  // Send input to running game
  async sendGameInput(sessionId: string, input: any): Promise<void> {
    // This would be implemented using WebSocket connection
    // For now, we'll use a simple POST request
    try {
      await fetch(`${this.baseUrl}/game-input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          input
        }),
      });
    } catch (error) {
      console.error('Failed to send game input:', error);
    }
  }

  // Stop running game
  async stopGame(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/stop-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId
        }),
      });
    } catch (error) {
      console.error('Failed to stop game:', error);
    }
  }
}

// Export singleton instance
export const gameApi = new GameAPI();