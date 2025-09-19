import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useInputBridge } from "@/hooks/use-input-bridge";
import { InputPromptDialog } from "@/components/input-prompt-dialog";
import { AppErrorBoundary, PageErrorBoundary } from "@/components/error-boundary";
import { globalErrorHandler } from "@/lib/global-error-handler";
import DebugToggle from "@/components/debug-toggle";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LessonPage from "@/pages/lesson";
import ProjectBuilderEnhanced from "@/pages/project-builder-enhanced";
import Gallery from "@/pages/gallery";
import ProjectViewer from "@/pages/project-viewer";
import SplashScreen from "@/components/splash-screen";
import PixelPresence from "@/components/pixel-presence";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
        <PageErrorBoundary context="Home Page">
          <Home />
        </PageErrorBoundary>
      )} />
      <Route path="/lesson/:lessonId" component={() => (
        <PageErrorBoundary context="Lesson Page">
          <LessonPage />
        </PageErrorBoundary>
      )} />
      <Route path="/project-builder" component={() => (
        <PageErrorBoundary context="Project Builder">
          <ProjectBuilderEnhanced />
        </PageErrorBoundary>
      )} />
      <Route path="/projects" component={() => (
        <PageErrorBoundary context="Project Builder">
          <ProjectBuilderEnhanced />
        </PageErrorBoundary>
      )} />
      <Route path="/gallery" component={() => (
        <PageErrorBoundary context="Gallery">
          <Gallery />
        </PageErrorBoundary>
      )} />
      <Route path="/gallery/:id" component={() => (
        <PageErrorBoundary context="Project Viewer">
          <ProjectViewer />
        </PageErrorBoundary>
      )} />
      <Route component={() => (
        <PageErrorBoundary context="Not Found Page">
          <NotFound />
        </PageErrorBoundary>
      )} />
    </Switch>
  );
}

function App() {
  const inputBridge = useInputBridge();
  const [location, setLocation] = useLocation();
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash screen on first visit or if it hasn't been shown today
    const lastShown = localStorage.getItem("splashScreenLastShown");
    if (!lastShown) return true;
    
    const lastShownDate = new Date(lastShown);
    const today = new Date();
    const daysSinceLastShown = Math.floor(
      (today.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Show splash once per day
    return daysSinceLastShown >= 1;
  });

  // Initialize global error handling and setup
  useEffect(() => {
    // Ensure global error handler is initialized
    globalErrorHandler.initialize();
    
    // Register the global __getInput function for Python to call
    window.__getInput = inputBridge.open;
    
    return () => {
      // Cleanup on unmount
      window.__getInput = window.__getInput || (() => Promise.resolve(null));
    };
  }, [inputBridge.open]);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {showSplash ? (
            <SplashScreen onComplete={() => setShowSplash(false)} />
          ) : (
            <>
              <Toaster />
              <Router />
              <PixelPresence 
                onNavigate={setLocation}
                currentPath={location}
              />
              <InputPromptDialog
                isOpen={inputBridge.isOpen}
                prompt={inputBridge.prompt}
                onSubmit={inputBridge.handleSubmit}
                onCancel={inputBridge.handleCancel}
              />
              <DebugToggle showInProduction={false} showErrorBadge={true} />
            </>
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
