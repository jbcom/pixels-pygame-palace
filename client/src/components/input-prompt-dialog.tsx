import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InputPromptDialogProps {
  isOpen: boolean;
  prompt: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputPromptDialog({ isOpen, prompt, onSubmit, onCancel }: InputPromptDialogProps) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  // Don't render Dialog when not open to prevent hook errors
  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(inputValue);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent 
        className="sm:max-w-md"
        onKeyDown={handleKeyDown}
        data-testid="dialog-input-prompt"
      >
        <DialogHeader>
          <DialogTitle>Input Required</DialogTitle>
          <DialogDescription data-testid="text-prompt">
            {prompt || "Please enter a value:"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            data-testid="input-user"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your response..."
            autoFocus
            className="w-full"
          />
          
          <DialogFooter className="flex space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              data-testid="button-cancel-input"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              data-testid="button-submit-input"
            >
              OK
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}