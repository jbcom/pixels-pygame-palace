// Test page for the Pygame Component System
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import CodeEditor from "@/components/code-editor";
import { 
  Gamepad2, Play, CheckCircle, XCircle, Code2, 
  Zap, Heart, Target, Globe 
} from 'lucide-react';

import { pygameComponents, allComponents, getComponentById } from '@/lib/pygame-components';
import { generatePygameScene, generateTestScene } from '@/lib/scene-generator';
import { runComponentTests } from '@/lib/test-pygame-components';

export default function ComponentTestPage() {
  const [selectedComponents, setSelectedComponents] = useState<Array<{
    componentId: string;
    variant: 'A' | 'B';
  }>>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [testResults, setTestResults] = useState<boolean | null>(null);

  useEffect(() => {
    // Run tests on mount
    const results = runComponentTests();
    setTestResults(results);
  }, []);

  const handleAddComponent = (componentId: string, variant: 'A' | 'B') => {
    setSelectedComponents(prev => [...prev, { componentId, variant }]);
  };

  const handleGenerateCode = () => {
    const code = generatePygameScene({
      sceneConfig: {
        name: 'Test Game',
        width: 800,
        height: 600,
        fps: 60,
        backgroundColor: '#1a1a2e'
      },
      selectedComponents: selectedComponents.map(sel => ({
        componentId: sel.componentId,
        variant: sel.variant,
        assets: {},
        parameters: {}
      }))
    });
    setGeneratedCode(code);
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'movement': return <Zap className="h-4 w-4" />;
      case 'combat': return <Target className="h-4 w-4" />;
      case 'ui': return <Heart className="h-4 w-4" />;
      case 'world': return <Globe className="h-4 w-4" />;
      default: return <Gamepad2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6" />
            Pygame Component System Test
          </CardTitle>
          <CardDescription>
            Testing the new component library architecture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span>System Status:</span>
            {testResults === null ? (
              <Badge variant="secondary">Testing...</Badge>
            ) : testResults ? (
              <Badge className="bg-green-500 hover:bg-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                All Tests Passed
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-4 w-4 mr-1" />
                Some Tests Failed
              </Badge>
            )}
            <Button 
              onClick={() => setTestResults(runComponentTests())}
              variant="outline"
              size="sm"
            >
              Re-run Tests
            </Button>
            <Button
              onClick={() => setGeneratedCode(generateTestScene())}
              variant="outline"
              size="sm"
            >
              <Code2 className="h-4 w-4 mr-1" />
              Generate Test Scene
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Components</CardTitle>
            <CardDescription>
              {allComponents.length} components across {Object.keys(pygameComponents).length} categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="movement">
              <TabsList className="grid grid-cols-4 w-full">
                {Object.keys(pygameComponents).map(category => (
                  <TabsTrigger key={category} value={category}>
                    <span className="flex items-center gap-1">
                      {getCategoryIcon(category)}
                      {category}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(pygameComponents).map(([category, components]) => (
                <TabsContent key={category} value={category} className="space-y-4">
                  {components.map(component => (
                    <div key={component.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-2">{component.name}</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => handleAddComponent(component.id, 'A')}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {component.variants.A.name}
                        </Button>
                        <Button
                          onClick={() => handleAddComponent(component.id, 'B')}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {component.variants.B.name}
                        </Button>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p>A: {component.variants.A.description}</p>
                        <p>B: {component.variants.B.description}</p>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected Components</CardTitle>
            <CardDescription>
              Build your game by selecting components
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedComponents.length === 0 ? (
              <p className="text-muted-foreground">No components selected yet</p>
            ) : (
              <div className="space-y-2">
                {selectedComponents.map((sel, idx) => {
                  const component = getComponentById(sel.componentId);
                  if (!component) return null;
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(component.category)}
                        <span>{component.name}</span>
                        <Badge variant="secondary">
                          {component.variants[sel.variant].name}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedComponents(prev => prev.filter((_, i) => i !== idx));
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button 
                onClick={handleGenerateCode}
                disabled={selectedComponents.length === 0}
              >
                <Play className="h-4 w-4 mr-1" />
                Generate Game Code
              </Button>
              <Button
                onClick={() => setSelectedComponents([])}
                variant="outline"
                disabled={selectedComponents.length === 0}
              >
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {generatedCode && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Generated Pygame Code</CardTitle>
            <CardDescription>
              Complete game script ready to run
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-auto">
              <CodeEditor
                value={generatedCode}
                onChange={() => {}}
                readOnly
                theme="dark"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Add missing import for Plus icon
import { Plus } from 'lucide-react';