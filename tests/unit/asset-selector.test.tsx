import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssetSelector from '@/components/asset-selector';

// Mock asset library
vi.mock('@/lib/curated-assets', () => ({
  getCuratedAssets: vi.fn(() => ({
    platformer: {
      title: {
        backgrounds: [
          { id: 'bg-1', path: '/assets/platformer/bg1.png', name: 'Forest' },
          { id: 'bg-2', path: '/assets/platformer/bg2.png', name: 'Desert' }
        ],
        sprites: [
          { id: 'sprite-1', path: '/assets/platformer/player.png', name: 'Player' }
        ]
      }
    },
    rpg: {
      character: {
        sprites: [
          { id: 'char-1', path: '/assets/rpg/warrior.png', name: 'Warrior' },
          { id: 'char-2', path: '/assets/rpg/mage.png', name: 'Mage' }
        ],
        portraits: [
          { id: 'port-1', path: '/assets/rpg/warrior-portrait.png', name: 'Warrior Portrait' }
        ]
      }
    },
    generic: {
      menu: {
        backgrounds: [
          { id: 'menu-bg-1', path: '/assets/generic/menu-bg.png', name: 'Menu Background' }
        ],
        buttons: [
          { id: 'btn-1', path: '/assets/generic/button.png', name: 'Button' }
        ]
      }
    }
  }))
}));

describe('AssetSelector Component Tests', () => {
  const defaultProps = {
    type: 'platformer',
    scene: 'title',
    onSelect: vi.fn(),
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render asset selector with correct type and scene', () => {
      render(<AssetSelector {...defaultProps} />);

      expect(screen.getByTestId('asset-selector')).toBeInTheDocument();
      expect(screen.getByText(/Choose assets for/i)).toBeInTheDocument();
    });

    it('should display category tabs', () => {
      render(<AssetSelector {...defaultProps} />);

      expect(screen.getByTestId('tab-backgrounds')).toBeInTheDocument();
      expect(screen.getByTestId('tab-sprites')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<AssetSelector {...defaultProps} />);

      const closeButton = screen.getByTestId('close-asset-selector');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Asset Display', () => {
    it('should display assets for selected category', async () => {
      render(<AssetSelector {...defaultProps} />);

      // Should show platformer title assets
      await waitFor(() => {
        expect(screen.getByText('Forest')).toBeInTheDocument();
        expect(screen.getByText('Desert')).toBeInTheDocument();
      });
    });

    it('should switch between asset categories', async () => {
      render(<AssetSelector {...defaultProps} />);

      // Click sprites tab
      const spritesTab = screen.getByTestId('tab-sprites');
      fireEvent.click(spritesTab);

      await waitFor(() => {
        expect(screen.getByText('Player')).toBeInTheDocument();
      });
    });

    it('should display RPG character assets when type is rpg', () => {
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, type: 'rpg', scene: 'character' }} />
        </BrowserRouter>
      );

      expect(screen.getByText('Warrior')).toBeInTheDocument();
      expect(screen.getByText('Mage')).toBeInTheDocument();
    });

    it('should display generic menu assets when type is generic', () => {
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, type: 'generic', scene: 'menu' }} />
        </BrowserRouter>
      );

      expect(screen.getByText('Menu Background')).toBeInTheDocument();
      expect(screen.getByText('Button')).toBeInTheDocument();
    });
  });

  describe('Asset Selection', () => {
    it('should call onSelect when an asset is clicked', async () => {
      const onSelect = vi.fn();
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, onSelect }} />
        </BrowserRouter>
      );

      const assetItem = screen.getByText('Forest').closest('[data-testid^="asset-item-"]');
      if (assetItem) {
        fireEvent.click(assetItem);
      }

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
          id: 'bg-1',
          path: '/assets/platformer/bg1.png',
          name: 'Forest'
        }));
      });
    });

    it('should highlight selected assets', async () => {
      render(<AssetSelector {...defaultProps} />);

      const assetItem = screen.getByText('Forest').closest('[data-testid^="asset-item-"]');
      if (assetItem) {
        fireEvent.click(assetItem);
        
        await waitFor(() => {
          expect(assetItem).toHaveClass('selected');
        });
      }
    });

    it('should allow multiple asset selection', async () => {
      const onSelect = vi.fn();
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, onSelect, multiple: true }} />
        </BrowserRouter>
      );

      const forest = screen.getByText('Forest').closest('[data-testid^="asset-item-"]');
      const desert = screen.getByText('Desert').closest('[data-testid^="asset-item-"]');

      if (forest) fireEvent.click(forest);
      if (desert) fireEvent.click(desert);

      expect(onSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Search and Filtering', () => {
    it('should render search input', () => {
      render(<AssetSelector {...defaultProps} />);

      const searchInput = screen.getByTestId('asset-search');
      expect(searchInput).toBeInTheDocument();
    });

    it('should filter assets based on search', async () => {
      render(<AssetSelector {...defaultProps} />);

      const searchInput = screen.getByTestId('asset-search');
      await userEvent.type(searchInput, 'Forest');

      await waitFor(() => {
        expect(screen.getByText('Forest')).toBeInTheDocument();
        expect(screen.queryByText('Desert')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      render(<AssetSelector {...defaultProps} />);

      const searchInput = screen.getByTestId('asset-search');
      await userEvent.type(searchInput, 'NonexistentAsset');

      await waitFor(() => {
        expect(screen.getByText(/No assets found/i)).toBeInTheDocument();
      });
    });

    it('should clear search when clear button is clicked', async () => {
      render(<AssetSelector {...defaultProps} />);

      const searchInput = screen.getByTestId('asset-search');
      await userEvent.type(searchInput, 'Forest');

      const clearButton = screen.getByTestId('clear-search');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
        expect(screen.getByText('Desert')).toBeInTheDocument();
      });
    });
  });

  describe('Preview Modal', () => {
    it('should open preview modal when preview button is clicked', async () => {
      render(<AssetSelector {...defaultProps} />);

      const previewButton = screen.getAllByTestId(/preview-asset-/)[0];
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByTestId('asset-preview-modal')).toBeInTheDocument();
      });
    });

    it('should display asset details in preview', async () => {
      render(<AssetSelector {...defaultProps} />);

      const previewButton = screen.getAllByTestId(/preview-asset-/)[0];
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByTestId('preview-image')).toBeInTheDocument();
        expect(screen.getByTestId('preview-name')).toBeInTheDocument();
        expect(screen.getByTestId('preview-path')).toBeInTheDocument();
      });
    });

    it('should close preview modal', async () => {
      render(<AssetSelector {...defaultProps} />);

      const previewButton = screen.getAllByTestId(/preview-asset-/)[0];
      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByTestId('asset-preview-modal')).toBeInTheDocument();
      });

      const closePreview = screen.getByTestId('close-preview');
      fireEvent.click(closePreview);

      await waitFor(() => {
        expect(screen.queryByTestId('asset-preview-modal')).not.toBeInTheDocument();
      });
    });

    it('should select asset from preview modal', async () => {
      const onSelect = vi.fn();
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, onSelect }} />
        </BrowserRouter>
      );

      const previewButton = screen.getAllByTestId(/preview-asset-/)[0];
      fireEvent.click(previewButton);

      await waitFor(() => {
        const selectFromPreview = screen.getByTestId('select-from-preview');
        fireEvent.click(selectFromPreview);
      });

      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe('Batch Operations', () => {
    it('should show batch action buttons when multiple assets selected', async () => {
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, multiple: true }} />
        </BrowserRouter>
      );

      const assets = screen.getAllByTestId(/asset-item-/);
      fireEvent.click(assets[0]);
      fireEvent.click(assets[1]);

      await waitFor(() => {
        expect(screen.getByTestId('batch-select-all')).toBeInTheDocument();
        expect(screen.getByTestId('batch-clear-all')).toBeInTheDocument();
      });
    });

    it('should select all assets when select all is clicked', async () => {
      const onSelect = vi.fn();
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, onSelect, multiple: true }} />
        </BrowserRouter>
      );

      const selectAllButton = screen.getByTestId('batch-select-all');
      fireEvent.click(selectAllButton);

      await waitFor(() => {
        const selectedAssets = screen.getAllByTestId(/asset-item-.*selected/);
        expect(selectedAssets.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should support drag and drop for asset organization', async () => {
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, enableDragDrop: true }} />
        </BrowserRouter>
      );

      const draggableAsset = screen.getAllByTestId(/asset-item-/)[0];
      expect(draggableAsset).toHaveAttribute('draggable', 'true');
    });

    it('should handle drag start and end events', async () => {
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, enableDragDrop: true }} />
        </BrowserRouter>
      );

      const draggableAsset = screen.getAllByTestId(/asset-item-/)[0];
      
      const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
      fireEvent(draggableAsset, dragStartEvent);

      await waitFor(() => {
        expect(draggableAsset).toHaveClass('dragging');
      });

      const dragEndEvent = new DragEvent('dragend', { bubbles: true });
      fireEvent(draggableAsset, dragEndEvent);

      await waitFor(() => {
        expect(draggableAsset).not.toHaveClass('dragging');
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while assets are loading', async () => {
      vi.mock('@/lib/curated-assets', () => ({
        getCuratedAssets: vi.fn(() => new Promise(() => {})) // Never resolves
      }));

      render(<AssetSelector {...defaultProps} />);

      expect(screen.getByTestId('assets-loading')).toBeInTheDocument();
    });

    it('should show error state when assets fail to load', async () => {
      vi.mock('@/lib/curated-assets', () => ({
        getCuratedAssets: vi.fn(() => {
          throw new Error('Failed to load assets');
        })
      }));

      render(<AssetSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load assets/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<AssetSelector {...defaultProps} />);

      expect(screen.getByLabelText(/Search assets/i)).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<AssetSelector {...defaultProps} />);

      // Tab to search
      await userEvent.tab();
      expect(screen.getByTestId('asset-search')).toHaveFocus();

      // Tab to first asset
      await userEvent.tab();
      await userEvent.tab();
      
      // Press Enter to select
      await userEvent.keyboard('{Enter}');
      expect(defaultProps.onSelect).toHaveBeenCalled();
    });

    it('should announce selection changes to screen readers', async () => {
      render(<AssetSelector {...defaultProps} />);

      const asset = screen.getAllByTestId(/asset-item-/)[0];
      fireEvent.click(asset);

      await waitFor(() => {
        const announcement = screen.getByRole('status');
        expect(announcement).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adjust grid layout for mobile', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<AssetSelector {...defaultProps} />);

      const grid = screen.getByTestId('assets-grid');
      expect(grid).toHaveClass('grid-cols-2');
    });

    it('should show mobile-friendly controls', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<AssetSelector {...defaultProps} />);

      expect(screen.getByTestId('mobile-filter-button')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should handle close callback', () => {
      const onClose = vi.fn();
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, onClose }} />
        </BrowserRouter>
      );

      const closeButton = screen.getByTestId('close-asset-selector');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should pass selected asset data in correct format', async () => {
      const onSelect = vi.fn();
      render(
        <BrowserRouter>
          <AssetSelector {...{ ...defaultProps, onSelect }} />
        </BrowserRouter>
      );

      const asset = screen.getByText('Forest').closest('[data-testid^="asset-item-"]');
      if (asset) {
        fireEvent.click(asset);
      }

      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(String),
            path: expect.any(String),
            name: expect.any(String)
          })
        );
      });
    });
  });
});