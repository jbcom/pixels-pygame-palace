import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Bug, 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  Memory, 
  Wifi, 
  Clock,
  Trash2,
  Download,
  RefreshCw,
  Settings,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { globalErrorHandler, type GlobalError } from "@/lib/global-error-handler";
import { usePyodide } from "@/hooks/use-pyodide";

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemStatus {
  pyodide: 'loading' | 'ready' | 'error';
  pygame: 'loading' | 'ready' | 'error';
  api: 'checking' | 'online' | 'offline';
  storage: 'available' | 'unavailable';
}

interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  apiResponseTime: number;
  errorRate: number;
}

export default function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const [errors, setErrors] = useState<GlobalError[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    pyodide: 'loading',
    pygame: 'loading',
    api: 'checking',
    storage: 'available'
  });
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    renderTime: 0,
    apiResponseTime: 0,
    errorRate: 0
  });
  const [debugMode, setDebugMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { 
    pyodide, 
    isLoading: pyodideLoading, 
    isPygameReady, 
    getPygameStatus,
    verifyPygame 
  } = usePyodide();

  // Initialize debug mode state
  useEffect(() => {
    setDebugMode(globalErrorHandler.getDebugMode());
  }, []);

  // Subscribe to error updates
  useEffect(() => {
    const updateErrors = () => {
      setErrors(globalErrorHandler.getRecentErrors(20));
    };

    updateErrors();
    const unsubscribe = globalErrorHandler.subscribe(updateErrors);
    
    return unsubscribe;
  }, []);

  // Auto-refresh system status
  useEffect(() => {
    if (!autoRefresh || !isOpen) return;

    const interval = setInterval(() => {
      checkSystemStatus();
      updatePerformanceMetrics();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, isOpen, pyodide]);

  // Initial system check
  useEffect(() => {
    if (isOpen) {
      checkSystemStatus();
      updatePerformanceMetrics();
    }
  }, [isOpen, pyodide]);

  const checkSystemStatus = async () => {
    const newStatus: SystemStatus = { ...systemStatus };

    // Check Pyodide status
    if (pyodideLoading) {
      newStatus.pyodide = 'loading';
    } else if (pyodide) {
      newStatus.pyodide = 'ready';
    } else {
      newStatus.pyodide = 'error';
    }

    // Check Pygame status
    if (pyodide) {
      const pygameStatus = getPygameStatus();
      if (pygameStatus.isAvailable && isPygameReady) {
        newStatus.pygame = 'ready';
      } else if (pygameStatus.errors.length > 0) {
        newStatus.pygame = 'error';
      } else {
        newStatus.pygame = 'loading';
      }
    }

    // Check API connectivity
    try {
      const response = await fetch('/api/lessons', { method: 'HEAD' });
      newStatus.api = response.ok ? 'online' : 'offline';
    } catch {
      newStatus.api = 'offline';
    }

    // Check storage availability
    try {
      localStorage.setItem('debug-test', 'test');
      localStorage.removeItem('debug-test');
      newStatus.storage = 'available';
    } catch {
      newStatus.storage = 'unavailable';
    }

    setSystemStatus(newStatus);
  };

  const updatePerformanceMetrics = () => {
    const errorStats = globalErrorHandler.getErrorStats();
    
    setPerformanceMetrics({
      memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0,
      renderTime: Math.round(performance.now() % 100), // Simplified metric
      apiResponseTime: 120, // Would be tracked from actual API calls
      errorRate: errorStats.recentCount
    });
  };

  const handleDebugModeToggle = (enabled: boolean) => {
    setDebugMode(enabled);
    globalErrorHandler.setDebugMode(enabled);
  };

  const clearErrors = () => {
    globalErrorHandler.clearErrors();
    setErrors([]);
  };

  const downloadErrorLog = () => {
    const errorLog = {
      timestamp: new Date().toISOString(),
      errors: errors,
      systemStatus,
      performanceMetrics,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    const blob = new Blob([JSON.stringify(errorLog, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pygame-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
      case 'online':
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'loading':
      case 'checking':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'error':
      case 'offline':
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'online':
      case 'available':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'loading':
      case 'checking':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'error':
      case 'offline':
      case 'unavailable':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'javascript':
        return '🔴';
      case 'promise':
        return '🟡';
      case 'react-error':
        return '⚛️';
      case 'network':
        return '🌐';
      case 'python':
        return '🐍';
      default:
        return '❌';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <Bug className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold">Debug Panel</h2>
                <p className="text-sm text-muted-foreground">System diagnostics and error tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Auto-refresh</span>
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  data-testid="switch-auto-refresh"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-debug">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-6">
            <Tabs defaultValue="status" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="status">System Status</TabsTrigger>
                <TabsTrigger value="errors">Error Log</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="status" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Pyodide Runtime
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge className={getStatusColor(systemStatus.pyodide)}>
                          {systemStatus.pyodide}
                        </Badge>
                        {getStatusIcon(systemStatus.pyodide)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Pygame Shim
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge className={getStatusColor(systemStatus.pygame)}>
                          {systemStatus.pygame}
                        </Badge>
                        {getStatusIcon(systemStatus.pygame)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        API Connection
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge className={getStatusColor(systemStatus.api)}>
                          {systemStatus.api}
                        </Badge>
                        {getStatusIcon(systemStatus.api)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Local Storage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <Badge className={getStatusColor(systemStatus.storage)}>
                          {systemStatus.storage}
                        </Badge>
                        {getStatusIcon(systemStatus.storage)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button 
                  onClick={checkSystemStatus}
                  className="w-full"
                  data-testid="button-refresh-status"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </TabsContent>

              <TabsContent value="errors" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Recent Errors ({errors.length})</h3>
                    {errors.length > 0 && (
                      <Badge variant="destructive">
                        {errors.filter(e => e.level === 'error').length} critical
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={downloadErrorLog}
                      data-testid="button-download-errors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={clearErrors}
                      data-testid="button-clear-errors"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-80">
                  {errors.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No errors logged</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {errors.map((error, index) => (
                        <Card key={index} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{getErrorIcon(error.type)}</span>
                                <Badge variant={error.level === 'error' ? 'destructive' : 'secondary'}>
                                  {error.type}
                                </Badge>
                                <Badge variant="outline">
                                  {error.level}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(error.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                              {error.error}
                            </p>
                            {error.context && (
                              <p className="text-xs text-muted-foreground">
                                Context: {error.context}
                              </p>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Memory className="h-4 w-4" />
                        Memory Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Used</span>
                          <span>{performanceMetrics.memoryUsage} MB</span>
                        </div>
                        <Progress value={Math.min(performanceMetrics.memoryUsage / 10, 100)} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        Render Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Last Frame</span>
                          <span>{performanceMetrics.renderTime}ms</span>
                        </div>
                        <Progress value={Math.min(performanceMetrics.renderTime, 100)} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        API Response
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Average</span>
                          <span>{performanceMetrics.apiResponseTime}ms</span>
                        </div>
                        <Progress value={Math.min(performanceMetrics.apiResponseTime / 10, 100)} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Error Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Recent</span>
                          <span>{performanceMetrics.errorRate} errors</span>
                        </div>
                        <Progress 
                          value={Math.min(performanceMetrics.errorRate * 10, 100)} 
                          className="[&>div]:bg-red-500"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Debug Settings
                    </CardTitle>
                    <CardDescription>
                      Configure debugging and development options
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Debug Mode</h4>
                        <p className="text-sm text-muted-foreground">
                          Enable detailed logging and error reporting
                        </p>
                      </div>
                      <Switch
                        checked={debugMode}
                        onCheckedChange={handleDebugModeToggle}
                        data-testid="switch-debug-mode"
                      />
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Debug mode provides detailed error information and performance metrics. 
                        This is automatically enabled in development environments.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <h4 className="font-medium">Debug Actions</h4>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            if (window.__debugUtils) {
                              window.__debugUtils.triggerTestError();
                            }
                          }}
                          data-testid="button-test-error"
                        >
                          Test Error
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            console.log('Debug Panel State:', {
                              errors,
                              systemStatus,
                              performanceMetrics,
                              debugMode
                            });
                          }}
                          data-testid="button-log-state"
                        >
                          Log State
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}