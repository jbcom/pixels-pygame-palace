import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppErrorBoundary, PageErrorBoundary } from "@/components/error-boundary";
import { globalErrorHandler } from "@/lib/global-error-handler";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LessonPage from "@/pages/lesson";
import PixelPresence from "@/components/pixel-presence";
import UniversalWizard from "@/components/universal-wizard";

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
      <Route path="/wizard" component={() => (
        <PageErrorBoundary context="Universal Wizard">
          <UniversalWizard />
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
  const [location, setLocation] = useLocation();

  // Initialize global error handling
  useEffect(() => {
    // Ensure global error handler is initialized
    globalErrorHandler.initialize();
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <>
            <Toaster />
            <Router />
            <PixelPresence 
              onNavigate={setLocation}
              currentPath={location}
            />
          </>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;