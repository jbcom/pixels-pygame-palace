import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  RefreshCw,
  Download,
  Clock,
  Wifi,
  Server,
  HardDrive,
  Zap,
  HelpCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { useHealthMonitor, useCriticalSystemChecks, usePerformanceHealth } from "@/hooks/use-health-monitor";
import { useState } from "react";

interface SystemHealthIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export default function SystemHealthIndicator({ 
  compact = false, 
  showDetails = false,
  className 
}: SystemHealthIndicatorProps) {
  const { 
    health, 
    isHealthy, 
    hasWarnings, 
    hasCriticalIssues,
    runHealthCheck,
    exportHealthReport,
    lastCheck
  } = useHealthMonitor();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await runHealthCheck();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusInfo = () => {
    if (hasCriticalIssues) {
      return {
        icon: <XCircle className="h-4 w-4" />,
        text: 'System Issues',
        variant: 'destructive' as const,
        color: 'text-red-600'
      };
    }

    if (hasWarnings) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        text: 'Minor Issues',
        variant: 'secondary' as const,
        color: 'text-yellow-600'
      };
    }

    if (isHealthy) {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        text: 'All Systems OK',
        variant: 'secondary' as const,
        color: 'text-green-600'
      };
    }

    return {
      icon: <HelpCircle className="h-4 w-4" />,
      text: 'Status Unknown',
      variant: 'outline' as const,
      color: 'text-gray-600'
    };
  };

  const statusInfo = getStatusInfo();

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={statusInfo.variant} 
            className={`flex items-center gap-1 cursor-pointer ${className}`}
            data-testid="system-health-compact"
          >
            <span className={statusInfo.color}>{statusInfo.icon}</span>
            <span>{statusInfo.text}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">System Health Status</p>
            {health && (
              <div className="text-sm space-y-1">
                <p>Overall: {health.overall.toUpperCase()}</p>
                <p>Checks: {Object.keys(health.checks).length}</p>
                {lastCheck && (
                  <p>Last check: {lastCheck.toLocaleTimeString()}</p>
                )}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!showDetails) {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid="system-health-basic">
        <Badge variant={statusInfo.variant} className="flex items-center gap-1">
          <span className={statusInfo.color}>{statusInfo.icon}</span>
          <span>{statusInfo.text}</span>
        </Badge>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="button-refresh-health"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>

        {lastCheck && (
          <span className="text-xs text-muted-foreground">
            Updated: {lastCheck.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <SystemHealthDetails />
    </motion.div>
  );
}

function SystemHealthDetails() {
  const { 
    health, 
    runHealthCheck, 
    exportHealthReport,
    uptime 
  } = useHealthMonitor();
  
  const { 
    criticalIssues, 
    requiredSystemStatus, 
    hasSystemFailures 
  } = useCriticalSystemChecks();
  
  const { 
    metrics, 
    issues: performanceIssues, 
    recommendations 
  } = usePerformanceHealth();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await runHealthCheck();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getCheckIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSystemIcon = (name: string) => {
    switch (name) {
      case 'pyodide':
        return <Server className="h-4 w-4" />;
      case 'pygame':
        return <Activity className="h-4 w-4" />;
      case 'api':
        return <Wifi className="h-4 w-4" />;
      case 'memory':
        return <HardDrive className="h-4 w-4" />;
      case 'performance':
        return <Zap className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (!health) {
    return (
      <Card data-testid="system-health-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Loading system status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="system-health-details">
      {/* Critical Issues Alert */}
      {hasSystemFailures && (
        <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <div className="space-y-2">
              <p className="font-medium">Critical system issues detected!</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                {criticalIssues.map((issue, index) => (
                  <li key={index}>{issue.name}: {issue.message}</li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="mt-2"
                data-testid="button-retry-critical"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry System Check
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Health Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health Status
              </CardTitle>
              <CardDescription>
                Overall status: <span className="font-medium capitalize">{health.overall}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-detailed"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportHealthReport}
                data-testid="button-export-health"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* System Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Uptime:</span>
              <span className="ml-2 font-mono">{formatUptime(uptime)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Last Check:</span>
              <span className="ml-2">{health.lastCheck.toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Core System Checks */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Core Systems
            </h4>
            <div className="grid gap-2">
              {requiredSystemStatus?.map((check) => (
                <div 
                  key={check.name} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {getSystemIcon(check.name)}
                    <span className="font-medium capitalize">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.result && (
                      <>
                        {getCheckIcon(check.result.status)}
                        <span className="text-sm text-muted-foreground">
                          {check.result.responseTime && `${Math.round(check.result.responseTime)}ms`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          {metrics.performance && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>API Response Time</span>
                    <span>{metrics.performance.apiResponseTime}ms</span>
                  </div>
                  <Progress 
                    value={Math.min(metrics.performance.apiResponseTime / 50, 100)} 
                    className="h-2"
                  />
                </div>
                
                {metrics.memory && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>{metrics.memory.percentage}%</span>
                    </div>
                    <Progress 
                      value={metrics.memory.percentage} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance Issues & Recommendations */}
          {performanceIssues.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Performance recommendations:</p>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    {recommendations.map((recommendation, index) => (
                      <li key={index}>{recommendation}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* All Health Checks */}
          <div>
            <h4 className="font-medium mb-3">All Health Checks</h4>
            <div className="grid gap-2">
              {Object.entries(health.checks).map(([name, result]) => (
                <div 
                  key={name}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {getSystemIcon(name)}
                    <span className="font-medium capitalize">{name}</span>
                    <span className="text-sm text-muted-foreground">
                      {result.message}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getCheckIcon(result.status)}
                    {result.responseTime && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {Math.round(result.responseTime)}ms
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}