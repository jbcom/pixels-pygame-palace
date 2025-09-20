import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LessonsPage from '@/pages/lessons';
import type { Lesson, UserProgress } from '@shared/schema';

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/lessons', vi.fn()]
}));

// Mock Pixel images
vi.mock('@assets/pixel/Pixel_happy_excited_expression_22a41625.png', () => ({ 
  default: '/mock/pixel-happy.png' 
}));
vi.mock('@assets/pixel/Pixel_teaching_explaining_expression_27e09763.png', () => ({ 
  default: '/mock/pixel-teaching.png' 
}));
vi.mock('@assets/pixel/Pixel_celebrating_victory_expression_24b7a377.png', () => ({ 
  default: '/mock/pixel-celebrating.png' 
}));
vi.mock('@assets/pixel/Pixel_encouraging_supportive_expression_cf958090.png', () => ({ 
  default: '/mock/pixel-encouraging.png' 
}));
vi.mock('@assets/pixel/Pixel_welcoming_waving_expression_279ffdd2.png', () => ({ 
  default: '/mock/pixel-welcoming.png' 
}));

// Mock Header component
vi.mock('@/components/header', () => ({
  default: () => <div data-testid="header">Header</div>
}));

const mockLessons: Lesson[] = [
  {
    id: 'python-basics',
    title: 'Python Basics',
    description: 'Learn the fundamentals of Python programming',
    difficulty: 'beginner',
    estimatedTime: 30,
    objectives: ['Variables', 'Data types', 'Basic operations'],
    steps: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 'control-flow',
    title: 'Control Flow',
    description: 'Master if statements and conditional logic',
    difficulty: 'beginner',
    estimatedTime: 45,
    objectives: ['If statements', 'Else clauses', 'Elif conditions'],
    steps: [],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  },
  {
    id: 'loops-iteration',
    title: 'Loops and Iteration',
    description: 'Learn about for and while loops',
    difficulty: 'intermediate',
    estimatedTime: 60,
    objectives: ['For loops', 'While loops', 'Break and continue'],
    steps: [],
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03')
  }
];

const mockProgress: UserProgress[] = [
  {
    id: '1',
    userId: 'user-1',
    lessonId: 'python-basics',
    progress: 100,
    completed: true,
    completedAt: new Date('2024-01-05'),
    lastStepId: 'step-final',
    score: 95,
    timeSpent: 1800
  },
  {
    id: '2',
    userId: 'user-1',
    lessonId: 'control-flow',
    progress: 50,
    completed: false,
    lastStepId: 'step-3',
    score: 0,
    timeSpent: 900
  }
];

describe('LessonsPage Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const renderWithQuery = (component: React.ReactElement, embedded = false) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render lessons page', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('lessons-page')).toBeInTheDocument();
      });
    });

    it('should display page title', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/Your Learning Journey/i)).toBeInTheDocument();
      });
    });

    it('should display Pixel mascot', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('pixel-mascot-lessons')).toBeInTheDocument();
      });
    });

    it('should render header when not embedded', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage embedded={false} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });
    });

    it('should not render header when embedded', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage embedded={true} />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('header')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching lessons', () => {
      renderWithQuery(<LessonsPage />);
      
      expect(screen.getByText(/Loading your learning journey/i)).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Lesson Display', () => {
    it('should display all lessons', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Python Basics')).toBeInTheDocument();
        expect(screen.getByText('Control Flow')).toBeInTheDocument();
        expect(screen.getByText('Loops and Iteration')).toBeInTheDocument();
      });
    });

    it('should display lesson descriptions', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Learn the fundamentals of Python programming')).toBeInTheDocument();
        expect(screen.getByText('Master if statements and conditional logic')).toBeInTheDocument();
      });
    });

    it('should display estimated time', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('30 min')).toBeInTheDocument();
        expect(screen.getByText('45 min')).toBeInTheDocument();
        expect(screen.getByText('60 min')).toBeInTheDocument();
      });
    });

    it('should display difficulty badges', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getAllByText('Beginner')).toHaveLength(2);
        expect(screen.getByText('Intermediate')).toBeInTheDocument();
      });
    });

    it('should display lesson objectives', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Variables')).toBeInTheDocument();
        expect(screen.getByText('Data types')).toBeInTheDocument();
        expect(screen.getByText('If statements')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Display', () => {
    it('should show progress bar for lessons in progress', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const progressBars = screen.getAllByTestId(/progress-bar-/);
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it('should show completed status for finished lessons', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('completed-python-basics')).toBeInTheDocument();
      });
    });

    it('should apply correct styling for completed lessons', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const completedCard = screen.getByTestId('lesson-card-python-basics');
        expect(completedCard).toHaveClass('from-green-50');
      });
    });

    it('should apply correct styling for in-progress lessons', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const progressCard = screen.getByTestId('lesson-card-control-flow');
        expect(progressCard).toHaveClass('from-purple-50');
      });
    });

    it('should display progress percentage', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to lesson when card is clicked', async () => {
      const setLocation = vi.fn();
      vi.mocked(await import('wouter')).useLocation.mockReturnValue(['/lessons', setLocation]);
      
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const lessonCard = screen.getByTestId('lesson-card-python-basics');
        fireEvent.click(lessonCard);
      });
      
      expect(setLocation).toHaveBeenCalledWith('/lesson/python-basics');
    });

    it('should have start/continue button on each lesson', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('btn-continue-control-flow')).toHaveTextContent('Continue');
        expect(screen.getByTestId('btn-start-loops-iteration')).toHaveTextContent('Start');
      });
    });
  });

  describe('Pixel Messages', () => {
    it('should display encouraging messages for each lesson', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/Start your Python adventure here/)).toBeInTheDocument();
        expect(screen.getByText(/Let's make smart programs that can think/)).toBeInTheDocument();
      });
    });
  });

  describe('Overall Progress', () => {
    it('should calculate and display overall progress', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const overallProgress = screen.getByTestId('overall-progress');
        expect(overallProgress).toBeInTheDocument();
      });
    });

    it('should show lesson count summary', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/1 of 3 lessons completed/)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adjust layout for mobile', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const container = screen.getByTestId('lessons-container');
        expect(container).toHaveClass('grid-cols-1');
      });
    });

    it('should adjust layout for tablet', async () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
      
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const container = screen.getByTestId('lessons-container');
        expect(container).toHaveClass('md:grid-cols-2');
      });
    });

    it('should adjust layout for desktop', async () => {
      global.innerWidth = 1280;
      global.dispatchEvent(new Event('resize'));
      
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const container = screen.getByTestId('lessons-container');
        expect(container).toHaveClass('lg:grid-cols-3');
      });
    });
  });

  describe('Animations', () => {
    it('should animate lesson cards on mount', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const cards = screen.getAllByTestId(/lesson-card-/);
        cards.forEach(card => {
          expect(card.parentElement).toHaveAttribute('style');
        });
      });
    });

    it('should have hover effects on lesson cards', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const card = screen.getByTestId('lesson-card-python-basics');
        expect(card).toHaveClass('hover:shadow-lg');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty lessons array gracefully', async () => {
      queryClient.setQueryData(['/api/lessons'], []);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/No lessons available/i)).toBeInTheDocument();
      });
    });

    it('should handle missing progress data', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], undefined);
      
      expect(() => {
        renderWithQuery(<LessonsPage />);
      }).not.toThrow();
    });

    it('should handle API errors gracefully', async () => {
      queryClient.setQueryData(['/api/lessons'], undefined);
      queryClient.setQueryError(['/api/lessons'], new Error('Failed to fetch'));
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/Error loading lessons/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent(/Your Learning Journey/);
      });
    });

    it('should have proper ARIA labels', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Lesson progress/i)).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const firstCard = screen.getByTestId('lesson-card-python-basics');
        firstCard.focus();
        expect(firstCard).toHaveFocus();
      });
    });

    it('should announce progress to screen readers', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      queryClient.setQueryData(['/api/progress'], mockProgress);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const progressElement = screen.getByRole('progressbar');
        expect(progressElement).toHaveAttribute('aria-valuenow');
        expect(progressElement).toHaveAttribute('aria-valuemin', '0');
        expect(progressElement).toHaveAttribute('aria-valuemax', '100');
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('should show filter options', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('filter-difficulty')).toBeInTheDocument();
      });
    });

    it('should filter lessons by difficulty', async () => {
      queryClient.setQueryData(['/api/lessons'], mockLessons);
      
      renderWithQuery(<LessonsPage />);
      
      await waitFor(() => {
        const filter = screen.getByTestId('filter-difficulty');
        fireEvent.change(filter, { target: { value: 'beginner' } });
      });
      
      await waitFor(() => {
        expect(screen.getByText('Python Basics')).toBeInTheDocument();
        expect(screen.getByText('Control Flow')).toBeInTheDocument();
        expect(screen.queryByText('Loops and Iteration')).not.toBeInTheDocument();
      });
    });
  });
});