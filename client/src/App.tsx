import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useInputBridge } from "@/hooks/use-input-bridge";
import { InputPromptDialog } from "@/components/input-prompt-dialog";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LessonPage from "@/pages/lesson";
import ProjectBuilder from "@/pages/project-builder";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/lesson/:lessonId" component={LessonPage} />
      <Route path="/project-builder" component={ProjectBuilder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const inputBridge = useInputBridge();

  // Register the global __getInput function for Python to call
  useEffect(() => {
    window.__getInput = inputBridge.open;
    return () => {
      // Cleanup on unmount
      delete window.__getInput;
    };
  }, [inputBridge.open]);

  return (
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
