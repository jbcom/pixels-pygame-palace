import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import EnhancedGameCanvas from '@/components/enhanced-game-canvas';
import type { Scene, Entity } from '@shared/schema';

// Mock react-dnd
vi.mock('react-dnd', () => ({
  DndProvider: ({ children }: any) => children,
  useDrop: vi.fn(() => [{ isOver: false }, vi.fn()])
}));

describe('EnhancedGameCanvas Component', () => {
  const mockScene: Scene = {
    id: 'test-scene',
    name: 'Test Scene',
    entities: [],
    backgroundColor: '#1a1a2e',
    width: 800,
    height: 600,
    gridSize: 20,
    isMainScene: true
  };

  const mockEntities: Entity[] = [
    {
      id: 'entity-1',
      name: 'Player',
      type: 'player',
      position: { x: 100, y: 100 },
      size: { width: 40, height: 40 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      layer: 1,
      visible: true,
      locked: false,
      properties: { color: '#FF0000' }
    },
    {
      id: 'entity-2',
      name: 'Enemy',
      type: 'enemy',
      position: { x: 200, y: 200 },
      size: { width: 30, height: 30 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      layer: 1,
      visible: true,
      locked: false,
      properties: { color: '#00FF00' }
    }
  ];

  const defaultProps = {
    scene: mockScene,
    entities: mockEntities,
    selectedEntities: [],
    onSelectEntity: vi.fn(),
    onUpdateEntity: vi.fn(),
    onAddEntity: vi.fn(),
    onDeleteEntity: vi.fn(),
    selectedTool: 'select' as const,
    showGrid: true,
    showRulers: false,
    showGuides: false,
    gridSnap: true,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    isPlaying: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render canvas container', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('enhanced-game-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('canvas-viewport')).toBeInTheDocument();
    });

    it('should render entities', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('entity-entity-1')).toBeInTheDocument();
      expect(screen.getByTestId('entity-entity-2')).toBeInTheDocument();
    });

    it('should apply scene background color', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      const viewport = screen.getByTestId('canvas-viewport');
      expect(viewport).toHaveStyle({ backgroundColor: mockScene.backgroundColor });
    });

    it('should set canvas dimensions from scene', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      const viewport = screen.getByTestId('canvas-viewport');
      expect(viewport).toHaveStyle({ width: `${mockScene.width}px` });
      expect(viewport).toHaveStyle({ height: `${mockScene.height}px` });
    });
  });

  describe('Grid Display', () => {
    it('should show grid when showGrid is true', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} showGrid={true} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('canvas-grid')).toBeInTheDocument();
    });

    it('should hide grid when showGrid is false', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} showGrid={false} />
        </DndProvider>
      );
      
      expect(screen.queryByTestId('canvas-grid')).not.toBeInTheDocument();
    });

    it('should use grid size from scene', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      const grid = screen.getByTestId('canvas-grid');
      expect(grid).toHaveStyle({ 
        backgroundSize: `${mockScene.gridSize}px ${mockScene.gridSize}px` 
      });
    });
  });

  describe('Entity Selection', () => {
    it('should select entity on click', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.click(entity);
      
      expect(defaultProps.onSelectEntity).toHaveBeenCalledWith('entity-1', false);
    });

    it('should multi-select with Ctrl key', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.click(entity, { ctrlKey: true });
      
      expect(defaultProps.onSelectEntity).toHaveBeenCalledWith('entity-1', true);
    });

    it('should multi-select with Shift key', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.click(entity, { shiftKey: true });
      
      expect(defaultProps.onSelectEntity).toHaveBeenCalledWith('entity-1', true);
    });

    it('should show selection highlight', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedEntities={['entity-1']} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      expect(entity).toHaveClass('selected');
    });

    it('should show selection bounds for multiple entities', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedEntities={['entity-1', 'entity-2']} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('selection-bounds')).toBeInTheDocument();
    });
  });

  describe('Entity Movement', () => {
    it('should start dragging on mousedown when tool is move', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="move" selectedEntities={['entity-1']} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.mouseDown(entity, { clientX: 100, clientY: 100 });
      
      expect(screen.getByTestId('entity-entity-1')).toHaveClass('dragging');
    });

    it('should update entity position on drag', async () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="move" selectedEntities={['entity-1']} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      
      fireEvent.mouseDown(entity, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(window);
      
      await waitFor(() => {
        expect(defaultProps.onUpdateEntity).toHaveBeenCalledWith(
          'entity-1',
          expect.objectContaining({
            position: expect.any(Object)
          })
        );
      });
    });

    it('should snap to grid when gridSnap is enabled', async () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="move" selectedEntities={['entity-1']} gridSnap={true} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      
      fireEvent.mouseDown(entity, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(window, { clientX: 112, clientY: 112 });
      fireEvent.mouseUp(window);
      
      await waitFor(() => {
        expect(defaultProps.onUpdateEntity).toHaveBeenCalledWith(
          'entity-1',
          expect.objectContaining({
            position: { x: 120, y: 120 } // Snapped to nearest grid point
          })
        );
      });
    });
  });

  describe('Transform Handles', () => {
    it('should show transform handles when entity is selected', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedEntities={['entity-1']} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('handle-nw')).toBeInTheDocument();
      expect(screen.getByTestId('handle-ne')).toBeInTheDocument();
      expect(screen.getByTestId('handle-sw')).toBeInTheDocument();
      expect(screen.getByTestId('handle-se')).toBeInTheDocument();
    });

    it('should resize entity using corner handles', async () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedEntities={['entity-1']} selectedTool="scale" />
        </DndProvider>
      );
      
      const handle = screen.getByTestId('handle-se');
      
      fireEvent.mouseDown(handle, { clientX: 140, clientY: 140 });
      fireEvent.mouseMove(window, { clientX: 160, clientY: 160 });
      fireEvent.mouseUp(window);
      
      await waitFor(() => {
        expect(defaultProps.onUpdateEntity).toHaveBeenCalledWith(
          'entity-1',
          expect.objectContaining({
            size: expect.any(Object)
          })
        );
      });
    });

    it('should rotate entity using rotate handle', async () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedEntities={['entity-1']} selectedTool="rotate" />
        </DndProvider>
      );
      
      const handle = screen.getByTestId('handle-rotate');
      
      fireEvent.mouseDown(handle, { clientX: 120, clientY: 80 });
      fireEvent.mouseMove(window, { clientX: 140, clientY: 80 });
      fireEvent.mouseUp(window);
      
      await waitFor(() => {
        expect(defaultProps.onUpdateEntity).toHaveBeenCalledWith(
          'entity-1',
          expect.objectContaining({
            rotation: expect.any(Number)
          })
        );
      });
    });
  });

  describe('Tool Behavior', () => {
    it('should delete entity when delete tool is active', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="delete" />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.click(entity);
      
      expect(defaultProps.onDeleteEntity).toHaveBeenCalledWith('entity-1');
    });

    it('should duplicate entity when duplicate tool is active', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="duplicate" />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.click(entity);
      
      expect(defaultProps.onAddEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Player Copy',
          position: expect.objectContaining({
            x: 110,
            y: 110
          })
        })
      );
    });
  });

  describe('Zoom and Pan', () => {
    it('should apply zoom transform', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} zoom={2} />
        </DndProvider>
      );
      
      const viewport = screen.getByTestId('canvas-viewport');
      expect(viewport).toHaveStyle({ transform: 'scale(2) translate(0px, 0px)' });
    });

    it('should apply pan offset', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} panOffset={{ x: 50, y: 50 }} />
        </DndProvider>
      );
      
      const viewport = screen.getByTestId('canvas-viewport');
      expect(viewport).toHaveStyle({ transform: 'scale(1) translate(50px, 50px)' });
    });

    it('should handle mouse wheel for zooming', () => {
      const onZoomChange = vi.fn();
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} onZoomChange={onZoomChange} />
        </DndProvider>
      );
      
      const canvas = screen.getByTestId('enhanced-game-canvas');
      fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true });
      
      expect(onZoomChange).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('Drag and Drop', () => {
    it('should accept dropped assets', async () => {
      const { useDrop } = vi.mocked(await import('react-dnd'));
      
      let dropHandlers: any = {};
      useDrop.mockImplementation((spec: any) => {
        dropHandlers = spec;
        return [{ isOver: false }, vi.fn()];
      });
      
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      // Simulate drop
      if (dropHandlers.drop) {
        dropHandlers.drop({ type: 'asset', id: 'asset-1', path: '/assets/sprite.png' }, { getItem: () => ({}) });
      }
      
      expect(defaultProps.onAddEntity).toHaveBeenCalled();
    });

    it('should show drop indicator when hovering', async () => {
      const { useDrop } = vi.mocked(await import('react-dnd'));
      
      useDrop.mockImplementation(() => [{ isOver: true }, vi.fn()]);
      
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('drop-indicator')).toBeInTheDocument();
    });
  });

  describe('Play Mode', () => {
    it('should disable interactions when playing', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} isPlaying={true} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.click(entity);
      
      expect(defaultProps.onSelectEntity).not.toHaveBeenCalled();
    });

    it('should show play mode indicator', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} isPlaying={true} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('play-mode-indicator')).toBeInTheDocument();
    });
  });

  describe('Rulers and Guides', () => {
    it('should show rulers when enabled', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} showRulers={true} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('ruler-horizontal')).toBeInTheDocument();
      expect(screen.getByTestId('ruler-vertical')).toBeInTheDocument();
    });

    it('should show guides when enabled', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} showGuides={true} />
        </DndProvider>
      );
      
      expect(screen.getByTestId('guides-container')).toBeInTheDocument();
    });
  });

  describe('Selection Box', () => {
    it('should create selection box on drag in empty area', async () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="select" />
        </DndProvider>
      );
      
      const canvas = screen.getByTestId('canvas-viewport');
      
      fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
      fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });
      
      await waitFor(() => {
        expect(screen.getByTestId('selection-box')).toBeInTheDocument();
      });
      
      fireEvent.mouseUp(window);
    });

    it('should select entities within selection box', async () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="select" />
        </DndProvider>
      );
      
      const canvas = screen.getByTestId('canvas-viewport');
      
      fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
      fireEvent.mouseMove(window, { clientX: 250, clientY: 250 });
      fireEvent.mouseUp(window);
      
      await waitFor(() => {
        // Both entities should be selected
        expect(defaultProps.onSelectEntity).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} />
        </DndProvider>
      );
      
      expect(screen.getByRole('application')).toBeInTheDocument();
      expect(screen.getByLabelText(/Game canvas/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedEntities={['entity-1']} />
        </DndProvider>
      );
      
      const canvas = screen.getByTestId('enhanced-game-canvas');
      canvas.focus();
      
      // Arrow keys to move
      fireEvent.keyDown(canvas, { key: 'ArrowRight' });
      expect(defaultProps.onUpdateEntity).toHaveBeenCalled();
      
      // Delete key
      fireEvent.keyDown(canvas, { key: 'Delete' });
      expect(defaultProps.onDeleteEntity).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should throttle mouse move events', () => {
      vi.useFakeTimers();
      
      render(
        <DndProvider backend={HTML5Backend}>
          <EnhancedGameCanvas {...defaultProps} selectedTool="move" selectedEntities={['entity-1']} />
        </DndProvider>
      );
      
      const entity = screen.getByTestId('entity-entity-1');
      fireEvent.mouseDown(entity, { clientX: 100, clientY: 100 });
      
      // Rapid mouse moves
      for (let i = 0; i < 100; i++) {
        fireEvent.mouseMove(window, { clientX: 100 + i, clientY: 100 + i });
      }
      
      vi.advanceTimersByTime(100);
      
      // Should be throttled, not called 100 times
      expect(defaultProps.onUpdateEntity).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });
  });
});