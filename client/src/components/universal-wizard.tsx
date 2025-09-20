import { useEffect, useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import PixelMenu from './pixel-menu';
import { 
  UniversalWizardProps, 
  DeviceState, 
  UIState 
} from './wizard-types';
import { detectDevice, getLayoutMode } from './wizard-utils';
import { useWizardDialogue, DialogueText, getDialogueHelpers } from './wizard-dialogue-engine';
import WizardOptionHandler, { ContinueButton } from './wizard-option-handler';
import { 
  PhonePortraitLayout, 
  PhoneLandscapeLayout, 
  DesktopLayout,
  useLayoutEdgeSwipe 
} from './wizard-layout-manager';
import WizardCodeRunner from './wizard-code-runner';
import PygameWysiwygEditor from './pygame-wysiwyg-editor';
import AssetBrowserWizard from './asset-browser-wizard';
import { GameAsset } from '@/lib/asset-library/asset-types';
import { assetManager } from '@/lib/asset-library/asset-manager';
import { ICON_SIZES, STYLES } from './wizard-constants';

export default function UniversalWizard({ 
  className = '', 
  assetMode = 'curated',
  editorLocked = true 
}: UniversalWizardProps) {
  // Core dialogue state management using custom hook
  const {
    wizardData,
    dialogueState,
    sessionActions,
    isLoading,
    navigateToNode,
    handleOptionSelect,
    advance,
    setSessionActions
  } = useWizardDialogue();

  // Device state management
  const [deviceState, setDeviceState] = useState<DeviceState>(detectDevice());
  
  // UI state management
  const [uiState, setUiState] = useState<UIState>({
    pixelMenuOpen: false,
    embeddedComponent: 'none',
    pixelState: 'center-stage',
    wysiwygEditorOpen: false,
    assetBrowserOpen: false,
    assetBrowserType: 'all',
    selectedGameType: undefined
  });
  
  // Selected assets state
  const [selectedAssets, setSelectedAssets] = useState<GameAsset[]>([]);

  // Responsive detection
  useEffect(() => {
    const checkDevice = () => {
      const newDeviceState = detectDevice();
      console.log('Device detection:', newDeviceState);
      setDeviceState(newDeviceState);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);
    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  // Get dialogue helper functions
  const dialogueHelpers = getDialogueHelpers(dialogueState);

  // Handle action for current node
  useEffect(() => {
    const { currentNode } = dialogueState;
    if (!currentNode) return;
    
    // Check if the current node has an action that should open the editor
    if (currentNode.action === 'openWYSIWYGEditor') {
      setUiState(prev => ({ ...prev, wysiwygEditorOpen: true }));
      setSessionActions(prev => ({ ...prev, unlockedEditor: true }));
    } else if (currentNode.action === 'openEditor') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'editor' }));
    } else if (currentNode.action === 'openLessons') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'lessons' }));
    } else if (currentNode.action === 'showAssets') {
      // Open asset browser with specific type if provided
      const assetType = currentNode.params?.type || 'all';
      const gameType = currentNode.params?.gameType || dialogueState.currentNode?.params?.gameType;
      setUiState(prev => ({ 
        ...prev, 
        assetBrowserOpen: true,
        assetBrowserType: assetType,
        selectedGameType: gameType
      }));
    }
  }, [dialogueState.currentNode]);

  // Wrap handleOptionSelect to handle actions
  const handleOptionSelectWithAction = useCallback((option: any) => {
    // Check if option has an action
    if (option.action === 'openWYSIWYGEditor') {
      setUiState(prev => ({ ...prev, wysiwygEditorOpen: true }));
      setSessionActions(prev => ({ ...prev, unlockedEditor: true }));
    } else if (option.action === 'openEditor') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'editor' }));
    } else if (option.action === 'openLessons') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'lessons' }));
    } else if (option.action === 'showAssets') {
      // Open asset browser with specific type if provided
      const assetType = option.actionParams?.type || 'all';
      const gameType = option.actionParams?.gameType || dialogueState.currentNode?.params?.gameType;
      setUiState(prev => ({ 
        ...prev, 
        assetBrowserOpen: true,
        assetBrowserType: assetType,
        selectedGameType: gameType
      }));
    }
    
    // Call the original handler
    handleOptionSelect(option);
  }, [handleOptionSelect, dialogueState.currentNode]);

  // Render dialogue content for desktop/tablet
  const renderDialogue = useCallback(() => {
    const { currentNode } = dialogueState;
    if (!currentNode) return null;

    const displayText = dialogueHelpers.getCurrentText();
    const showOptions = dialogueHelpers.shouldShowOptions();
    const showContinue = dialogueHelpers.shouldShowContinue();

    return (
      <div className="space-y-4">
        {displayText && (
          <DialogueText
            text={displayText}
            nodeId={dialogueState.currentNodeId}
            dialogueStep={dialogueState.dialogueStep}
          />
        )}

        {showOptions && currentNode.options && currentNode.options.length > 0 && (
          <WizardOptionHandler
            options={currentNode.options}
            onOptionSelect={handleOptionSelectWithAction}
            isMobile={deviceState.isMobile}
          />
        )}

        {showContinue && (
          <ContinueButton
            onClick={advance}
            isMobile={deviceState.isMobile}
          />
        )}
      </div>
    );
  }, [dialogueState, dialogueHelpers, handleOptionSelect, advance, deviceState.isMobile]);

  // Pixel Menu action handlers
  const handlePixelMenuAction = useCallback((action: string) => {
    setUiState(prev => ({ ...prev, pixelMenuOpen: false }));
    
    switch (action) {
      case 'changeGame':
        navigateToNode('gamePath');
        break;
      case 'switchLesson':
        navigateToNode('learnPath');
        break;
      case 'exportGame':
        // TODO: Implement export functionality
        console.log('Export game');
        break;
      case 'viewProgress':
        // TODO: Implement progress view
        console.log('View progress');
        break;
      case 'returnCurrent':
        // Just close the menu
        break;
    }
  }, [navigateToNode]);

  // Edge swipe handlers for mobile
  const edgeSwipeHandlers = useLayoutEdgeSwipe(() => {
    setUiState(prev => ({ ...prev, pixelMenuOpen: true }));
  });

  // Handle embedded component changes
  const handleEmbeddedComponentChange = useCallback((component: UIState['embeddedComponent']) => {
    setUiState(prev => ({ ...prev, embeddedComponent: component }));
  }, []);

  // Handle asset selection from browser
  const handleAssetSelection = useCallback((assets: GameAsset | GameAsset[]) => {
    const assetsArray = Array.isArray(assets) ? assets : [assets];
    setSelectedAssets(assetsArray);
    
    // Store selected assets in session for later use
    assetsArray.forEach(asset => {
      if (asset.type === 'sprite') {
        const spriteAsset = asset as any;
        if (spriteAsset.category === 'characters') {
          assetManager.selectPlayerSprite(asset.id);
        } else if (spriteAsset.category === 'enemies') {
          assetManager.addEnemySprite(asset.id);
        } else if (spriteAsset.category === 'items') {
          assetManager.addItemSprite(asset.id);
        }
      } else if (asset.type === 'background') {
        assetManager.selectBackground(asset.id);
      } else if (asset.type === 'music') {
        assetManager.selectMusic(asset.id);
      } else if (asset.type === 'sound') {
        assetManager.addSound(asset.id);
      }
    });
    
    // Close browser and continue dialogue
    setUiState(prev => ({ ...prev, assetBrowserOpen: false }));
    advance();
  }, [advance]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen ${STYLES.GRADIENT_BG} flex items-center justify-center`}>
        <div className="text-center">
          <Sparkles className={`${ICON_SIZES.EXTRA_LARGE} text-purple-600 animate-spin mx-auto mb-4`} />
          <p className="text-lg text-gray-700 dark:text-gray-300">Loading adventure...</p>
        </div>
      </div>
    );
  }

  // Determine layout mode
  const layoutMode = getLayoutMode(deviceState);
  console.log('Using layout mode:', layoutMode);

  // Common props for layouts
  const layoutProps = {
    currentNode: dialogueState.currentNode,
    dialogueStep: dialogueState.dialogueStep,
    onAdvance: advance,
    onOptionSelect: handleOptionSelectWithAction,
    onOpenMenu: () => setUiState(prev => ({ ...prev, pixelMenuOpen: true }))
  };

  // Show WYSIWYG editor if it's open
  if (uiState.wysiwygEditorOpen) {
    return (
      <PygameWysiwygEditor
        onClose={() => setUiState(prev => ({ ...prev, wysiwygEditorOpen: false }))}
      />
    );
  }

  // Show asset browser if it's open
  if (uiState.assetBrowserOpen) {
    return (
      <AssetBrowserWizard
        assetType={uiState.assetBrowserType === 'all' ? undefined : uiState.assetBrowserType}
        gameType={uiState.selectedGameType}
        onSelect={handleAssetSelection}
        onClose={() => setUiState(prev => ({ ...prev, assetBrowserOpen: false }))}
        showPixelSuggestions={true}
      />
    );
  }

  // Render phone portrait layout
  if (layoutMode === 'phone-portrait') {
    return (
      <>
        <PixelMenu
          isOpen={uiState.pixelMenuOpen}
          onClose={() => setUiState(prev => ({ ...prev, pixelMenuOpen: false }))}
          onChangeGame={() => handlePixelMenuAction('changeGame')}
          onSwitchLesson={() => handlePixelMenuAction('switchLesson')}
          onExportGame={() => handlePixelMenuAction('exportGame')}
          onViewProgress={() => handlePixelMenuAction('viewProgress')}
          onReturnCurrent={() => handlePixelMenuAction('returnCurrent')}
          sessionActions={[]}
        />
        <PhonePortraitLayout 
          {...layoutProps}
          edgeSwipeHandlers={edgeSwipeHandlers.handlers}
        />
        {uiState.embeddedComponent !== 'none' && (
          <WizardCodeRunner
            type={uiState.embeddedComponent}
            onClose={() => handleEmbeddedComponentChange('none')}
          />
        )}
      </>
    );
  }

  // Render phone landscape layout
  if (layoutMode === 'phone-landscape') {
    return (
      <>
        <PixelMenu
          isOpen={uiState.pixelMenuOpen}
          onClose={() => setUiState(prev => ({ ...prev, pixelMenuOpen: false }))}
          onChangeGame={() => handlePixelMenuAction('changeGame')}
          onSwitchLesson={() => handlePixelMenuAction('switchLesson')}
          onExportGame={() => handlePixelMenuAction('exportGame')}
          onViewProgress={() => handlePixelMenuAction('viewProgress')}
          onReturnCurrent={() => handlePixelMenuAction('returnCurrent')}
          sessionActions={[]}
        />
        <PhoneLandscapeLayout 
          {...layoutProps}
          edgeSwipeHandlers={edgeSwipeHandlers.handlers}
        />
        {uiState.embeddedComponent !== 'none' && (
          <WizardCodeRunner
            type={uiState.embeddedComponent}
            onClose={() => handleEmbeddedComponentChange('none')}
          />
        )}
      </>
    );
  }

  // Desktop and tablet layout
  return (
    <DesktopLayout
      {...layoutProps}
      deviceState={deviceState}
      uiState={uiState}
      onPixelMenuAction={handlePixelMenuAction}
      renderDialogue={renderDialogue}
    />
  );
}