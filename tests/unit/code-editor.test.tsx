import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor from '@/components/code-editor';

// Mock Monaco Editor
const mockMonacoEditor = {
  create: vi.fn(),
  onDidChangeModelContent: vi.fn(),
  getValue: vi.fn(() => 'test code'),
  setValue: vi.fn(),
  dispose: vi.fn(),
  addCommand: vi.fn(),
  updateOptions: vi.fn(),
  focus: vi.fn(),
  getModel: vi.fn(() => ({
    getValue: vi.fn(() => 'test code')
  }))
};

// Setup global Monaco mock
(global as any).monaco = {
  editor: {
    create: vi.fn(() => mockMonacoEditor)
  },
  KeyMod: {
    CtrlCmd: 2048
  },
  KeyCode: {
    Enter: 3
  }
};

describe('CodeEditor Component', () => {
  const defaultProps = {
    code: 'print("Hello World")',
    onChange: vi.fn(),
    onExecute: vi.fn(),
    output: '',
    error: '',
    isExecuting: false,
    gradingResult: null,
    currentStep: undefined
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Monaco script loading state
    delete (window as any).require;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render editor container', () => {
      render(<CodeEditor {...defaultProps} />);
      
      expect(screen.getByTestId('code-editor-container')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    });

    it('should render control buttons', () => {
      render(<CodeEditor {...defaultProps} />);
      
      expect(screen.getByTestId('run-code-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reset-code-btn')).toBeInTheDocument();
    });

    it('should render input field', () => {
      render(<CodeEditor {...defaultProps} />);
      
      expect(screen.getByTestId('code-input')).toBeInTheDocument();
      expect(screen.getByLabelText(/Input values/i)).toBeInTheDocument();
    });

    it('should render output section', () => {
      render(<CodeEditor {...defaultProps} />);
      
      expect(screen.getByTestId('output-section')).toBeInTheDocument();
      expect(screen.getByText(/Output/i)).toBeInTheDocument();
    });
  });

  describe('Monaco Editor Loading', () => {
    it('should load Monaco Editor script', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      
      render(<CodeEditor {...defaultProps} />);
      
      await waitFor(() => {
        expect(createElementSpy).toHaveBeenCalledWith('script');
      });
      
      const scriptElement = Array.from(document.scripts).find(
        script => script.src.includes('monaco-editor')
      );
      expect(scriptElement).toBeDefined();
    });

    it('should initialize Monaco Editor after script loads', async () => {
      // Setup require mock
      (window as any).require = {
        config: vi.fn(),
        call: vi.fn((context: any, deps: string[], callback: Function) => {
          callback();
        })
      };
      
      render(<CodeEditor {...defaultProps} />);
      
      // Trigger script load
      const script = document.querySelector('script[src*="monaco"]') as HTMLScriptElement;
      if (script?.onload) {
        (script.onload as any)(new Event('load'));
      }
      
      await waitFor(() => {
        expect(global.monaco.editor.create).toHaveBeenCalled();
      });
    });

    it('should configure Monaco with correct options', async () => {
      (window as any).require = {
        config: vi.fn(),
        call: vi.fn((context: any, deps: string[], callback: Function) => {
          callback();
        })
      };
      
      render(<CodeEditor {...defaultProps} />);
      
      const script = document.querySelector('script[src*="monaco"]') as HTMLScriptElement;
      if (script?.onload) {
        (script.onload as any)(new Event('load'));
      }
      
      await waitFor(() => {
        expect(global.monaco.editor.create).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({
            value: defaultProps.code,
            language: 'python',
            theme: 'vs-dark',
            fontSize: 18,
            minimap: { enabled: false }
          })
        );
      });
    });
  });

  describe('Code Editing', () => {
    it('should call onChange when code changes', async () => {
      (window as any).require = {
        config: vi.fn(),
        call: vi.fn((context: any, deps: string[], callback: Function) => {
          callback();
        })
      };
      
      // Setup mock to trigger onChange
      let changeCallback: Function | null = null;
      mockMonacoEditor.onDidChangeModelContent = vi.fn((cb) => {
        changeCallback = cb;
      });
      mockMonacoEditor.getValue = vi.fn(() => 'new code');
      
      render(<CodeEditor {...defaultProps} />);
      
      const script = document.querySelector('script[src*="monaco"]') as HTMLScriptElement;
      if (script?.onload) {
        (script.onload as any)(new Event('load'));
      }
      
      await waitFor(() => {
        expect(mockMonacoEditor.onDidChangeModelContent).toHaveBeenCalled();
      });
      
      // Trigger change
      if (changeCallback) {
        changeCallback();
      }
      
      expect(defaultProps.onChange).toHaveBeenCalledWith('new code');
    });

    it('should update editor when code prop changes', () => {
      const { rerender } = render(<CodeEditor {...defaultProps} />);
      
      const newCode = 'print("Updated code")';
      rerender(<CodeEditor {...defaultProps} code={newCode} />);
      
      // Monaco should be updated with new code
      expect(mockMonacoEditor.setValue).toHaveBeenCalledWith(newCode);
    });
  });

  describe('Code Execution', () => {
    it('should execute code when Run button is clicked', () => {
      render(<CodeEditor {...defaultProps} />);
      
      const runButton = screen.getByTestId('run-code-btn');
      fireEvent.click(runButton);
      
      expect(defaultProps.onExecute).toHaveBeenCalledWith('', false);
    });

    it('should pass input values when executing', async () => {
      render(<CodeEditor {...defaultProps} />);
      
      const input = screen.getByTestId('code-input');
      await userEvent.type(input, '5\n10');
      
      const runButton = screen.getByTestId('run-code-btn');
      fireEvent.click(runButton);
      
      expect(defaultProps.onExecute).toHaveBeenCalledWith('5\n10', false);
    });

    it('should disable Run button while executing', () => {
      render(<CodeEditor {...defaultProps} isExecuting={true} />);
      
      const runButton = screen.getByTestId('run-code-btn');
      expect(runButton).toBeDisabled();
    });

    it('should show loading state while executing', () => {
      render(<CodeEditor {...defaultProps} isExecuting={true} />);
      
      expect(screen.getByTestId('executing-spinner')).toBeInTheDocument();
    });

    it('should handle keyboard shortcut for execution (Ctrl+Enter)', async () => {
      (window as any).require = {
        config: vi.fn(),
        call: vi.fn((context: any, deps: string[], callback: Function) => {
          callback();
        })
      };
      
      let commandHandler: Function | null = null;
      mockMonacoEditor.addCommand = vi.fn((keyCode, handler) => {
        commandHandler = handler;
      });
      
      render(<CodeEditor {...defaultProps} />);
      
      const script = document.querySelector('script[src*="monaco"]') as HTMLScriptElement;
      if (script?.onload) {
        (script.onload as any)(new Event('load'));
      }
      
      await waitFor(() => {
        expect(mockMonacoEditor.addCommand).toHaveBeenCalled();
      });
      
      // Trigger the keyboard shortcut
      if (commandHandler) {
        commandHandler();
      }
      
      expect(defaultProps.onExecute).toHaveBeenCalled();
    });
  });

  describe('Output Display', () => {
    it('should display output when available', () => {
      const output = 'Hello World\n42';
      render(<CodeEditor {...defaultProps} output={output} />);
      
      const outputDisplay = screen.getByTestId('code-output');
      expect(outputDisplay).toHaveTextContent(output);
    });

    it('should display error when available', () => {
      const error = 'SyntaxError: invalid syntax';
      render(<CodeEditor {...defaultProps} error={error} />);
      
      const errorDisplay = screen.getByTestId('code-error');
      expect(errorDisplay).toHaveTextContent(error);
      expect(errorDisplay).toHaveClass('text-red-500');
    });

    it('should show both output and error when both present', () => {
      render(<CodeEditor {...defaultProps} output="Output" error="Error" />);
      
      expect(screen.getByTestId('code-output')).toHaveTextContent('Output');
      expect(screen.getByTestId('code-error')).toHaveTextContent('Error');
    });

    it('should show placeholder when no output', () => {
      render(<CodeEditor {...defaultProps} />);
      
      const outputDisplay = screen.getByTestId('code-output');
      expect(outputDisplay).toHaveTextContent('Run your code to see output here');
    });
  });

  describe('Grading Results', () => {
    it('should display passed grading result', () => {
      const gradingResult = {
        passed: true,
        feedback: 'Great job!',
        expectedOutput: '42',
        actualOutput: '42'
      };
      
      render(<CodeEditor {...defaultProps} gradingResult={gradingResult} />);
      
      const gradingDisplay = screen.getByTestId('grading-result');
      expect(gradingDisplay).toBeInTheDocument();
      expect(gradingDisplay).toHaveClass('border-green-500');
      expect(screen.getByText('Great job!')).toBeInTheDocument();
    });

    it('should display failed grading result', () => {
      const gradingResult = {
        passed: false,
        feedback: 'Try again!',
        expectedOutput: '42',
        actualOutput: '0'
      };
      
      render(<CodeEditor {...defaultProps} gradingResult={gradingResult} />);
      
      const gradingDisplay = screen.getByTestId('grading-result');
      expect(gradingDisplay).toHaveClass('border-red-500');
      expect(screen.getByText('Try again!')).toBeInTheDocument();
    });

    it('should show expected vs actual output', () => {
      const gradingResult = {
        passed: false,
        feedback: 'Not quite',
        expectedOutput: 'Hello World',
        actualOutput: 'Hello'
      };
      
      render(<CodeEditor {...defaultProps} gradingResult={gradingResult} />);
      
      expect(screen.getByText(/Expected:/)).toBeInTheDocument();
      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText(/Actual:/)).toBeInTheDocument();
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  describe('Current Step Display', () => {
    it('should display current step information', () => {
      const currentStep = {
        id: 'step-1',
        title: 'Variables',
        description: 'Learn about variables in Python',
        tests: [
          {
            input: '5',
            expectedOutput: '10',
            description: 'Double the input'
          }
        ]
      };
      
      render(<CodeEditor {...defaultProps} currentStep={currentStep} />);
      
      expect(screen.getByText('Variables')).toBeInTheDocument();
      expect(screen.getByText('Learn about variables in Python')).toBeInTheDocument();
    });

    it('should display test cases', () => {
      const currentStep = {
        id: 'step-1',
        title: 'Test',
        description: 'Test description',
        tests: [
          {
            input: '5',
            expectedOutput: '25',
            description: 'Square the number'
          },
          {
            input: '10',
            expectedOutput: '100',
            description: 'Square another number'
          }
        ]
      };
      
      render(<CodeEditor {...defaultProps} currentStep={currentStep} />);
      
      expect(screen.getByText('Square the number')).toBeInTheDocument();
      expect(screen.getByText('Square another number')).toBeInTheDocument();
    });

    it('should run auto-grading when test button is clicked', () => {
      const currentStep = {
        id: 'step-1',
        title: 'Test',
        description: 'Test',
        tests: [{
          input: '5',
          expectedOutput: '25',
          description: 'Test'
        }]
      };
      
      render(<CodeEditor {...defaultProps} currentStep={currentStep} />);
      
      const testButton = screen.getByTestId('run-tests-btn');
      fireEvent.click(testButton);
      
      expect(defaultProps.onExecute).toHaveBeenCalledWith(undefined, true);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset code when Reset button is clicked', () => {
      render(<CodeEditor {...defaultProps} />);
      
      const resetButton = screen.getByTestId('reset-code-btn');
      fireEvent.click(resetButton);
      
      expect(mockMonacoEditor.setValue).toHaveBeenCalledWith('');
      expect(defaultProps.onChange).toHaveBeenCalledWith('');
    });

    it('should clear input when resetting', async () => {
      render(<CodeEditor {...defaultProps} />);
      
      const input = screen.getByTestId('code-input');
      await userEvent.type(input, 'test input');
      
      const resetButton = screen.getByTestId('reset-code-btn');
      fireEvent.click(resetButton);
      
      expect(input).toHaveValue('');
    });
  });

  describe('Input Handling', () => {
    it('should update input values', async () => {
      render(<CodeEditor {...defaultProps} />);
      
      const input = screen.getByTestId('code-input');
      await userEvent.type(input, 'test input');
      
      expect(input).toHaveValue('test input');
    });

    it('should support multiline input', async () => {
      render(<CodeEditor {...defaultProps} />);
      
      const input = screen.getByTestId('code-input');
      await userEvent.type(input, 'line1{Enter}line2{Enter}line3');
      
      expect(input).toHaveValue('line1\nline2\nline3');
    });

    it('should show input hint', () => {
      render(<CodeEditor {...defaultProps} />);
      
      expect(screen.getByText(/separate multiple inputs/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<CodeEditor {...defaultProps} />);
      
      expect(screen.getByLabelText(/Input values/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Run/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<CodeEditor {...defaultProps} />);
      
      await userEvent.tab();
      expect(screen.getByTestId('code-input')).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByTestId('run-code-btn')).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByTestId('reset-code-btn')).toHaveFocus();
    });

    it('should announce execution status to screen readers', () => {
      render(<CodeEditor {...defaultProps} isExecuting={true} />);
      
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent(/Executing/i);
    });
  });

  describe('Error Handling', () => {
    it('should handle Monaco loading errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate script loading error
      render(<CodeEditor {...defaultProps} />);
      
      const script = document.querySelector('script[src*="monaco"]') as HTMLScriptElement;
      if (script?.onerror) {
        (script.onerror as any)(new Error('Failed to load'));
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading Monaco editor:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle editor creation errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      global.monaco.editor.create = vi.fn(() => {
        throw new Error('Failed to create editor');
      });
      
      (window as any).require = {
        config: vi.fn(),
        call: vi.fn((context: any, deps: string[], callback: Function) => {
          callback();
        })
      };
      
      render(<CodeEditor {...defaultProps} />);
      
      const script = document.querySelector('script[src*="monaco"]') as HTMLScriptElement;
      if (script?.onload) {
        (script.onload as any)(new Event('load'));
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error creating Monaco editor:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should dispose Monaco editor on unmount', async () => {
      (window as any).require = {
        config: vi.fn(),
        call: vi.fn((context: any, deps: string[], callback: Function) => {
          callback();
        })
      };
      
      const { unmount } = render(<CodeEditor {...defaultProps} />);
      
      const script = document.querySelector('script[src*="monaco"]') as HTMLScriptElement;
      if (script?.onload) {
        (script.onload as any)(new Event('load'));
      }
      
      await waitFor(() => {
        expect(global.monaco.editor.create).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockMonacoEditor.dispose).toHaveBeenCalled();
    });
  });
});