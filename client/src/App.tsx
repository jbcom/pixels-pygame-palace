import { Switch, Route } from "wouter";
import { useEffect } from "react";
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
import ProjectBuilder from "@/pages/project-builder";
import Gallery from "@/pages/gallery";
import ProjectViewer from "@/pages/project-viewer";

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
          <ProjectBuilder />
        </PageErrorBoundary>
      )} />
      <Route path="/projects" component={() => (
        <PageErrorBoundary context="Project Builder">
          <ProjectBuilder />
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

  // Initialize global error handling and setup
  useEffect(() => {
    // Ensure global error handler is initialized
    globalErrorHandler.initialize();
    
    // Register the global __getInput function for Python to call
    window.__getInput = inputBridge.open;
    
    return () => {
      // Cleanup on unmount
      delete window.__getInput;
    };
  }, [inputBridge.open]);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
          <InputPromptDialog
            isOpen={inputBridge.isOpen}
            prompt={inputBridge.prompt}
            onSubmit={inputBridge.handleSubmit}
            onCancel={inputBridge.handleCancel}
          />
          <DebugToggle showInProduction={false} showErrorBadge={true} />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
