import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { gameComponents, type ComponentChoice } from '@/lib/game-building-blocks';
import { cn } from '@/lib/utils';
import { Check, Code, Zap, Shield, Heart, Star, Gamepad2, Target } from 'lucide-react';

interface ComponentSwitcherProps {
  selectedChoices: ComponentChoice[];
  onChoiceChange: (componentId: string, choice: 'A' | 'B') => void;
  gameType?: string;
}

const componentIcons: Record<string, any> = {
  combat: Shield,
  physics: Zap,
  collection: Star,
  progression: Target,
  graphics: Gamepad2,
  sound: Heart,
};

export default function ComponentSwitcher({ 
  selectedChoices, 
  onChoiceChange,
  gameType = 'all'
}: ComponentSwitcherProps) {
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  // Filter components based on game type if needed
  const filteredComponents = gameComponents.filter(comp => {
    // In a real app, you might filter based on game type
    // For now, show all components
    return true;
  });

  const getSelectedChoice = (componentId: string): 'A' | 'B' | null => {
    const choice = selectedChoices.find(c => c.component === componentId);
    return choice?.choice || null;
  };

  const toggleExpanded = (componentId: string) => {
    setExpandedComponent(expandedComponent === componentId ? null : componentId);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />
          Component Choices
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how your game mechanics work
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {filteredComponents.map((component) => {
            const IconComponent = componentIcons[component.id] || Code;
            const selectedChoice = getSelectedChoice(component.id);
            const isExpanded = expandedComponent === component.id;

            return (
              <Card 
                key={component.id} 
                className={cn(
                  "transition-all cursor-pointer",
                  selectedChoice && "ring-2 ring-primary"
                )}
                onClick={() => toggleExpanded(component.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{component.title}</CardTitle>
                    </div>
                    {selectedChoice && (
                      <Badge variant="default" className="ml-2">
                        Option {selectedChoice}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {component.description}
                  </CardDescription>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Option A */}
                      <Card 
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          selectedChoice === 'A' && "ring-2 ring-primary bg-primary/5"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChoiceChange(component.id, 'A');
                        }}
                        data-testid={`component-choice-${component.id}-A`}
                      >
                        <CardHeader className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold">
                              {component.optionA.title}
                            </span>
                            {selectedChoice === 'A' && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {component.optionA.description}
                          </p>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <div className="space-y-1">
                            {component.optionA.features.slice(0, 3).map((feature, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <div className="h-1 w-1 bg-muted-foreground rounded-full" />
                                <span className="text-xs text-muted-foreground">
                                  {feature}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Option B */}
                      <Card 
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          selectedChoice === 'B' && "ring-2 ring-primary bg-primary/5"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChoiceChange(component.id, 'B');
                        }}
                        data-testid={`component-choice-${component.id}-B`}
                      >
                        <CardHeader className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold">
                              {component.optionB.title}
                            </span>
                            {selectedChoice === 'B' && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {component.optionB.description}
                          </p>
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                          <div className="space-y-1">
                            {component.optionB.features.slice(0, 3).map((feature, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <div className="h-1 w-1 bg-muted-foreground rounded-full" />
                                <span className="text-xs text-muted-foreground">
                                  {feature}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Show code preview button if needed */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-3 w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Could open a dialog to show the Python code
                        console.log('Show code for', component.id, selectedChoice);
                      }}
                    >
                      <Code className="h-3 w-3 mr-1" />
                      View Code
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Summary of selected components */}
      <div className="p-4 border-t bg-muted/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Selected: {selectedChoices.length} components
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              // Reset all choices
              filteredComponents.forEach(comp => {
                onChoiceChange(comp.id, 'A');
              });
            }}
          >
            Reset All
          </Button>
        </div>
      </div>
    </div>
  );
}