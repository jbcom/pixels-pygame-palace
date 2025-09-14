import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// Monaco Editor types
declare global {
  interface Window {
    monaco: any;
  }
}

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onExecute: () => void;
  output: string;
  error: string;
  isExecuting: boolean;
}

export default function CodeEditor({ code, onChange, onExecute, output, error, isExecuting }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<any>(null);
  const scriptLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    // Prevent multiple script loads
    if (scriptLoadedRef.current || window.monaco) {
      return;
    }
    
    // Load Monaco Editor
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js";
    script.onload = () => {
      scriptLoadedRef.current = true;
      try {
        (window as any).require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs" } });
        (window as any).require(["vs/editor/editor.main"], () => {
          if (!editorRef.current || monacoEditorRef.current) {
            return;
          }
          try {
            monacoEditorRef.current = window.monaco.editor.create(editorRef.current, {
              value: code || "",
              language: "python",
              theme: "vs-dark",
              fontSize: 14,
              fontFamily: "JetBrains Mono, Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: "on",
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 3,
              renderLineHighlight: "line",
              selectOnLineNumbers: true,
              cursorBlinking: "solid",
              contextmenu: false,
              wordWrap: "off",
              quickSuggestions: false,
              parameterHints: { enabled: false },
              suggestOnTriggerCharacters: false,
              acceptSuggestionOnEnter: "off",
              tabCompletion: "off",
              snippetSuggestions: "none",
            });
          } catch (err) {
            console.error('Error creating Monaco editor:', err);
            return;
          }

          // Listen to changes with error handling
          monacoEditorRef.current.onDidChangeModelContent(() => {
            try {
              const value = monacoEditorRef.current?.getValue() || "";
              if (typeof onChange === 'function') {
                onChange(value);
              }
            } catch (err) {
              console.error('Error in Monaco editor onChange:', err);
            }
          });

          // Handle keyboard shortcuts with error handling
          try {
            monacoEditorRef.current.addCommand(
              window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter,
              () => {
                if (typeof onExecute === 'function') {
                  onExecute();
                }
              }
            );
          } catch (err) {
            console.error('Error adding keyboard shortcut:', err);
          }
        });
      } catch (err) {
        console.error('Error loading Monaco:', err);
      }
    };
    
    script.onerror = () => {
      console.error('Failed to load Monaco Editor script');
    };
    
    document.head.appendChild(script);

    return () => {
      if (monacoEditorRef.current) {
        try {
          monacoEditorRef.current.dispose();
          monacoEditorRef.current = null;
        } catch (err) {
          console.error('Error disposing Monaco editor:', err);
        }
      }
    };
  }, []); // Empty dependency array is intentional - we only want to load Monaco once

  useEffect(() => {
    try {
      if (monacoEditorRef.current && monacoEditorRef.current.getValue() !== code) {
        monacoEditorRef.current.setValue(code || "");
      }
    } catch (err) {
      console.error('Error updating Monaco editor value:', err);
    }
  }, [code]);

  const resetCode = () => {
    try {
      // This would reset to the initial code for the current step
      // For now, we'll just clear the editor
      if (typeof onChange === 'function') {
        onChange("");
      }
    } catch (err) {
      console.error('Error resetting code:', err);
    }
  };

  return (
    <div className="w-1/2 flex flex-col">
      <div className="bg-card border-b border-border p-4 flex items-center justify-between">
        <h3 className="font-medium">Code Editor</h3>
        <div className="flex items-center space-x-2">
          <Button
            onClick={onExecute}
            disabled={isExecuting}
            className="bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90 flex items-center space-x-2"
            data-testid="button-run-code"
          >
            <Play className="h-4 w-4" />
            <span>{isExecuting ? "Running..." : "Run Code"}</span>
          </Button>
          <Button
            onClick={resetCode}
            variant="outline"
            className="px-3 py-2"
            data-testid="button-reset-code"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <div
          ref={editorRef}
          className="flex-1 min-h-0"
          data-testid="code-editor"
        />
        
        {/* Console/Output Area */}
        <div className="bg-card border-t border-border">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Console Output</h4>
            </div>
          </div>
          <div className="p-4 h-32 bg-code-bg text-white font-mono text-sm overflow-auto">
            {error ? (
              <div className="text-destructive" data-testid="console-error">
                <div className="text-destructive">✗ Error:</div>
                <div className="mt-1 whitespace-pre-wrap">{error}</div>
              </div>
            ) : output ? (
              <div className="text-success" data-testid="console-output">
                <div className="text-success">✓ Success:</div>
                <div className="text-muted-foreground mt-1 whitespace-pre-wrap">{output}</div>
              </div>
            ) : (
              <div className="text-muted-foreground" data-testid="console-ready">
                Ready to run code... Press Ctrl+Enter or click Run Code
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
