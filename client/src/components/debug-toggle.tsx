import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bug, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDebug } from "@/hooks/use-debug";
import DebugPanel from "./debug-panel";

interface DebugToggleProps {
  /** Whether to show the debug toggle in production */
  showInProduction?: boolean;
  /** Position of the debug toggle */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Whether to show error count badge */
  showErrorBadge?: boolean;
}

export default function DebugToggle({ 
  showInProduction = false,
  position = 'bottom-right',
  showErrorBadge = true
}: DebugToggleProps) {
  const { 
    isDebugMode, 
    isDebugPanelOpen, 
    openDebugPanel, 
    closeDebugPanel,
    errors,
    hasRecentErrors,
    getSystemHealth,
    shortcuts
  } = useDebug();

  // Don't show in production unless explicitly enabled
  if (!import.meta.env.DEV && !showInProduction && !isDebugMode) {
    return null;
  }

  const systemHealth = getSystemHealth();
  const recentErrorCount = errors.filter(error => 
    Date.now() - new Date(error.timestamp).getTime() < 5 * 60 * 1000
  ).length;

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  const getHealthColor = () => {
    if (!systemHealth.isHealthy) return 'bg-red-500';
    if (recentErrorCount > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <>
      <div className={`fixed ${getPositionClasses()} z-40`}>
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="flex flex-col items-end gap-2"
          >
            {/* Debug toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={openDebugPanel}
                  size="sm"
                  variant={isDebugMode ? "default" : "secondary"}
                  className="relative shadow-lg"
                  data-testid="button-debug-toggle"
                >
                  <Bug className="h-4 w-4" />
                  
                  {/* Health indicator */}
                  <div 
                    className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getHealthColor()}`}
                    data-testid="indicator-system-health"
                  />
                  
                  {/* Error count badge */}
                  {showErrorBadge && hasRecentErrors && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      data-testid="badge-error-count"
                    >
                      {recentErrorCount > 9 ? '9+' : recentErrorCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">Debug Panel</p>
                  <p className="text-sm">System Status: {systemHealth.isHealthy ? 'Healthy' : 'Issues Detected'}</p>
                  {hasRecentErrors && (
                    <p className="text-sm text-red-300">
                      {recentErrorCount} recent error{recentErrorCount !== 1 ? 's' : ''}
                    </p>
                  )}
                  <p className="text-xs opacity-75">
                    Shortcut: {shortcuts.togglePanel}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* Performance indicator */}
            {isDebugMode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-black/80 text-white px-2 py-1 rounded text-xs font-mono"
                data-testid="indicator-performance"
              >
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  <span>Debug Active</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Debug Panel */}
      <DebugPanel 
        isOpen={isDebugPanelOpen} 
        onClose={closeDebugPanel}
      />
    </>
  );
}