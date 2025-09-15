import { useState, useEffect, useCallback, useRef } from "react";
import { performanceMonitor, type PerformanceMetric, type PerformanceStats } from "@/lib/performance-monitor";

/**
 * Hook for monitoring component performance
 */
export function usePerformanceMonitor(componentName: string) {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    // Subscribe to performance updates
    const unsubscribe = performanceMonitor.subscribe(setStats);
    
    // Get initial stats
    setStats(performanceMonitor.getStats());
    
    return unsubscribe;
  }, []);

  // Track component renders
  useEffect(() => {
    renderCount.current++;
    renderStartTime.current = performance.now();
    
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      if (renderTime > 16) { // Only track renders slower than 1 frame (16ms at 60fps)
        performanceMonitor.endMetric(
          performanceMonitor.startMetric('component', `${componentName} render #${renderCount.current}`, {
            renderCount: renderCount.current
          }),
          'completed'
        );
      }
    };
  });

  const measureRender = useCallback(<T,>(renderFn: () => T): T => {
    return performanceMonitor.measureComponent(componentName, renderFn);
  }, [componentName]);

  const measureAsync = useCallback(<T,>(name: string, asyncFn: () => Promise<T>): Promise<T> => {
    return performanceMonitor.measureAsync('component', `${componentName}: ${name}`, asyncFn);
  }, [componentName]);

  const startTimer = useCallback((label: string) => {
    return performanceMonitor.time(`${componentName}: ${label}`, 'component');
  }, [componentName]);

  return {
    stats,
    measureRender,
    measureAsync,
    startTimer,
    renderCount: renderCount.current,
    isMonitoring: performanceMonitor.isMonitoringEnabled()
  };
}

/**
 * Hook for monitoring API performance
 */
export function useApiPerformance() {
  const [apiStats, setApiStats] = useState<PerformanceMetric[]>([]);

  useEffect(() => {
    const updateStats = () => {
      const stats = performanceMonitor.getMetrics({ type: 'api', limit: 20 });
      setApiStats(stats);
    };

    updateStats();
    const unsubscribe = performanceMonitor.subscribe(updateStats);
    
    return unsubscribe;
  }, []);

  const measureApiCall = useCallback(async <T,>(
    url: string,
    apiFn: () => Promise<T>
  ): Promise<T> => {
    return performanceMonitor.measureAsync('api', `API: ${url}`, apiFn, { url });
  }, []);

  const getAverageResponseTime = useCallback(() => {
    if (apiStats.length === 0) return 0;
    const completedCalls = apiStats.filter(stat => stat.status === 'completed' && stat.duration);
    if (completedCalls.length === 0) return 0;
    
    return completedCalls.reduce((sum, stat) => sum + stat.duration!, 0) / completedCalls.length;
  }, [apiStats]);

  const getFailureRate = useCallback(() => {
    if (apiStats.length === 0) return 0;
    const failures = apiStats.filter(stat => stat.status === 'failed');
    return (failures.length / apiStats.length) * 100;
  }, [apiStats]);

  return {
    apiStats,
    measureApiCall,
    averageResponseTime: getAverageResponseTime(),
    failureRate: getFailureRate(),
    isMonitoring: performanceMonitor.isMonitoringEnabled()
  };
}

/**
 * Hook for monitoring Python code execution performance
 */
export function usePythonPerformance() {
  const [pythonStats, setPythonStats] = useState<PerformanceMetric[]>([]);

  useEffect(() => {
    const updateStats = () => {
      const stats = performanceMonitor.getMetrics({ type: 'python', limit: 20 });
      setPythonStats(stats);
    };

    updateStats();
    const unsubscribe = performanceMonitor.subscribe(updateStats);
    
    return unsubscribe;
  }, []);

  const measurePythonExecution = useCallback(<T,>(
    code: string,
    executeFn: () => T
  ): T => {
    return performanceMonitor.measurePythonExecution(code, executeFn);
  }, []);

  const measurePythonExecutionAsync = useCallback(<T,>(
    code: string,
    executeFn: () => Promise<T>
  ): Promise<T> => {
    return performanceMonitor.measurePythonExecutionAsync(code, executeFn);
  }, []);

  const getAverageExecutionTime = useCallback(() => {
    if (pythonStats.length === 0) return 0;
    const completedExecutions = pythonStats.filter(stat => stat.status === 'completed' && stat.duration);
    if (completedExecutions.length === 0) return 0;
    
    return completedExecutions.reduce((sum, stat) => sum + stat.duration!, 0) / completedExecutions.length;
  }, [pythonStats]);

  const getSuccessRate = useCallback(() => {
    if (pythonStats.length === 0) return 100;
    const successes = pythonStats.filter(stat => stat.status === 'completed');
    return (successes.length / pythonStats.length) * 100;
  }, [pythonStats]);

  const getSlowExecutions = useCallback((threshold = 5000) => {
    return pythonStats.filter(stat => 
      stat.status === 'completed' && 
      stat.duration && 
      stat.duration > threshold
    );
  }, [pythonStats]);

  return {
    pythonStats,
    measurePythonExecution,
    measurePythonExecutionAsync,
    averageExecutionTime: getAverageExecutionTime(),
    successRate: getSuccessRate(),
    slowExecutions: getSlowExecutions(),
    isMonitoring: performanceMonitor.isMonitoringEnabled()
  };
}

/**
 * Hook for system health monitoring
 */
export function useSystemHealth() {
  const [healthStatus, setHealthStatus] = useState({
    isHealthy: true,
    issues: [] as string[],
    recommendations: [] as string[]
  });
  const [memoryUsage, setMemoryUsage] = useState<{ used: number; total: number; percentage: number } | null>(null);

  useEffect(() => {
    const updateHealth = () => {
      setHealthStatus(performanceMonitor.getHealthStatus());
      setMemoryUsage(performanceMonitor.getMemoryUsage());
    };

    updateHealth();
    const interval = setInterval(updateHealth, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkHealth = useCallback(() => {
    setHealthStatus(performanceMonitor.getHealthStatus());
    setMemoryUsage(performanceMonitor.getMemoryUsage());
  }, []);

  return {
    healthStatus,
    memoryUsage,
    checkHealth,
    isMonitoring: performanceMonitor.isMonitoringEnabled()
  };
}

/**
 * Hook for performance debugging in development
 */
export function usePerformanceDebug(enabled = import.meta.env.DEV) {
  const [isEnabled, setIsEnabled] = useState(enabled && performanceMonitor.isMonitoringEnabled());

  const enableMonitoring = useCallback(() => {
    performanceMonitor.setEnabled(true);
    setIsEnabled(true);
  }, []);

  const disableMonitoring = useCallback(() => {
    performanceMonitor.setEnabled(false);
    setIsEnabled(false);
  }, []);

  const clearMetrics = useCallback(() => {
    performanceMonitor.clearMetrics();
  }, []);

  const exportMetrics = useCallback(() => {
    const data = performanceMonitor.exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const getSlowOperations = useCallback((threshold = 1000) => {
    return performanceMonitor.getSlowOperations(threshold);
  }, []);

  const getAllMetrics = useCallback(() => {
    return performanceMonitor.getMetrics();
  }, []);

  return {
    isEnabled,
    enableMonitoring,
    disableMonitoring,
    clearMetrics,
    exportMetrics,
    getSlowOperations,
    getAllMetrics
  };
}