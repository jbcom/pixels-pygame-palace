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
import PixelMinimizeAnimation from './pixel-minimize-animation';
import PixelMinimized from './pixel-minimized';
import { GameAsset } from '@/lib/asset-library/asset-types';
import { assetManager } from '@/lib/asset-library/asset-manager';
import { ICON_SIZES, STYLES } from './wizard-constants';

interface ExtendedWizardProps extends UniversalWizardProps {
  flowType?: 'default' | 'game-dev';
}

export default function UniversalWizard({ 
  className = '', 
  assetMode = 'curated',
  editorLocked = true,
  flowType = 'default' 
}: ExtendedWizardProps) {
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
  } = useWizardDialogue({ flowType });

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
    selectedGameType: undefined,
    isMinimizing: false,
    minimizeMessage: undefined,
    previewMode: undefined,
    viewMode: undefined
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
  const dialogueHelpers = getDialogueHelpers(dialogueState, sessionActions);

  // Handle action for current node
  useEffect(() => {
    const { currentNode } = dialogueState;
    if (!currentNode) return;
    
    // Check if the current node has an action
    if (currentNode.action === 'openWYSIWYGEditor') {
      // Minimize when opening editor
      const message = "You've got this! I'm here if you need me!";
      setUiState(prev => ({ 
        ...prev, 
        wysiwygEditorOpen: true,
        isMinimizing: true,
        minimizeMessage: message
      }));
      setSessionActions(prev => ({ ...prev, unlockedEditor: true }));
    } else if (currentNode.action === 'openEditor') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'code-editor' }));
    } else if (currentNode.action === 'openLessons') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'code-editor' }));
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
    } else if (currentNode.action === 'minimizePixel') {
      // Get the minimize message from node params or use default
      const message = currentNode.params?.message || "I'll be right here if you need me!";
      setUiState(prev => ({ 
        ...prev, 
        isMinimizing: true,
        minimizeMessage: message
      }));
    } else if (currentNode.action === 'showTitlePreset' || currentNode.action === 'previewScene') {
      // Preview the title screen
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'title'
      }));
    } else if (currentNode.action === 'loadGameplayPreset' || currentNode.action === 'launchPlaytest') {
      // Preview gameplay
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'gameplay'
      }));
    } else if (currentNode.action === 'showEndingPreset' || currentNode.action === 'previewEnding') {
      // Preview ending
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'ending'
      }));
    } else if (currentNode.action === 'assembleFullGame' || currentNode.action === 'previewFullGame') {
      // Assemble and preview full game
      setSessionActions(prev => ({ ...prev, gameAssembled: true }));
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'full'
      }));
    }
  }, [dialogueState.currentNode, setSessionActions]);

  // Wrap handleOptionSelect to handle actions
  const handleOptionSelectWithAction = useCallback((option: any) => {
    // Check if option has an action
    if (option.action === 'openWYSIWYGEditor') {
      // Different messages based on context
      const message = "You've got this! I'm here if you need me!";
      setUiState(prev => ({ 
        ...prev, 
        wysiwygEditorOpen: true,
        isMinimizing: true,
        minimizeMessage: message
      }));
      setSessionActions(prev => ({ ...prev, unlockedEditor: true }));
    } else if (option.action === 'openEditor') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'code-editor' }));
    } else if (option.action === 'openLessons') {
      setUiState(prev => ({ ...prev, embeddedComponent: 'code-editor' }));
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
    } else if (option.action === 'minimizePixel') {
      // Handle minimize from option
      const message = option.actionParams?.message || "Have fun creating! Click me if you need help!";
      setUiState(prev => ({ 
        ...prev, 
        isMinimizing: true,
        minimizeMessage: message
      }));
    } else if (option.action === 'buildGame') {
      // When entering game builder
      const message = "Have fun creating! Click me if you need help!";
      setUiState(prev => ({ 
        ...prev, 
        isMinimizing: true,
        minimizeMessage: message
      }));
    } else if (option.action === 'showTitlePreset' || option.action === 'cycleTitlePreset') {
      // Show title screen preview for selected game type
      const gameType = sessionActions.gameType || 'platformer';
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'title'
      }));
    } else if (option.action === 'applyTitlePreset') {
      // Save the title preset choice
      setSessionActions(prev => ({ ...prev, titlePresetApplied: true }));
    } else if (option.action === 'loadGameplayPreset') {
      // Load gameplay mechanics for the game type
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'gameplay'
      }));
    } else if (option.action === 'launchPlaytest' || option.action === 'extendPlaytest') {
      // Launch gameplay testing mode
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'playtest'
      }));
    } else if (option.action === 'saveGameplay') {
      // Save gameplay configuration
      setSessionActions(prev => ({ ...prev, gameplayConfigured: true }));
    } else if (option.action === 'showEndingPreset' || option.action === 'cycleEndingPreset') {
      // Show ending screen preview
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'ending'
      }));
    } else if (option.action === 'applyEndingPreset') {
      // Save ending configuration
      setSessionActions(prev => ({ ...prev, endingConfigured: true }));
    } else if (option.action === 'assembleFullGame') {
      // Compile all components into complete game
      setSessionActions(prev => ({ ...prev, gameAssembled: true }));
    } else if (option.action === 'launchFullGame') {
      // Launch the complete game
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: 'full'
      }));
    } else if (option.action === 'viewGeneratedCode') {
      // Show the generated Python code
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'code-editor',
        viewMode: 'generated'
      }));
    } else if (option.action === 'tweakDifficulty') {
      // Adjust game difficulty settings  
      console.log('Adjusting difficulty');
    } else if (option.action === 'previewScene' || option.action === 'previewGameplay' || option.action === 'previewEnding' || option.action === 'previewFullGame') {
      // Handle various preview actions
      const previewType = option.action.replace('preview', '').toLowerCase();
      setUiState(prev => ({ 
        ...prev, 
        embeddedComponent: 'pygame-runner',
        previewMode: previewType
      }));
    }
    
    // Check for lesson completion
    if (option.text && (option.text.includes('complete') || option.text.includes('finished'))) {
      const message = "Great job! I'll watch from here while you practice!";
      setUiState(prev => ({ 
        ...prev, 
        isMinimizing: true,
        minimizeMessage: message
      }));
    }
    
    // Call the original handler
    handleOptionSelect(option);
  }, [handleOptionSelect, dialogueState.currentNode, setSessionActions]);

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
  }, [dialogueState, dialogueHelpers, handleOptionSelectWithAction, advance, deviceState.isMobile]);

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

  // Handle minimize animation complete
  const handleMinimizeComplete = useCallback(() => {
    setUiState(prev => ({ 
      ...prev, 
      pixelState: 'minimized',
      isMinimizing: false 
    }));
  }, []);

  // Handle restore from minimized state
  const handleRestorePixel = useCallback(() => {
    setUiState(prev => ({ 
      ...prev, 
      pixelState: 'center-stage',
      minimizeMessage: undefined,
      wysiwygEditorOpen: false,
      assetBrowserOpen: false,
      embeddedComponent: 'none'
    }));
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
    sessionActions: sessionActions,
    onAdvance: advance,
    onOptionSelect: handleOptionSelectWithAction,
    onOpenMenu: () => setUiState(prev => ({ ...prev, pixelMenuOpen: true }))
  };

  // Show minimize animation if minimizing
  if (uiState.isMinimizing) {
    return (
      <PixelMinimizeAnimation
        message={uiState.minimizeMessage}
        onAnimationComplete={handleMinimizeComplete}
        isMobile={deviceState.isMobile}
      />
    );
  }

  // Show minimized Pixel if in minimized state
  if (uiState.pixelState === 'minimized') {
    return (
      <>
        <PixelMinimized
          onRestore={handleRestorePixel}
          sessionActions={sessionActions}
          isMobile={deviceState.isMobile}
          currentLesson={sessionActions.currentProject || undefined}
          currentGame={sessionActions.gameType || undefined}
        />
        {uiState.wysiwygEditorOpen && (
          <PygameWysiwygEditor
            onClose={() => setUiState(prev => ({ ...prev, wysiwygEditorOpen: false }))}
          />
        )}
        {uiState.assetBrowserOpen && (
          <AssetBrowserWizard
            assetType={uiState.assetBrowserType === 'all' ? undefined : uiState.assetBrowserType}
            gameType={uiState.selectedGameType}
            onSelect={handleAssetSelection}
            onClose={() => setUiState(prev => ({ ...prev, assetBrowserOpen: false }))}
            showPixelSuggestions={true}
          />
        )}
      </>
    );
  }

  // Show WYSIWYG editor if it's open (when not minimized)
  if (uiState.wysiwygEditorOpen && uiState.pixelState === 'center-stage') {
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