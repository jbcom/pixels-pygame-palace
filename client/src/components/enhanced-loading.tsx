import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Wifi,
  WifiOff,
  Download,
  Upload
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', message, className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} data-testid="loading-spinner">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}

interface SkeletonLoaderProps {
  type: 'lesson' | 'project' | 'gallery' | 'code-editor' | 'custom';
  count?: number;
  className?: string;
}

export function SkeletonLoader({ type, count = 1, className }: SkeletonLoaderProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'lesson':
        return (
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[160px]" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </CardContent>
          </Card>
        );

      case 'project':
        return (
          <Card className="w-full">
            <CardHeader>
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="space-y-2 mt-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        );

      case 'gallery':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'code-editor':
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-80 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        );

      case 'custom':
        return (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        );

      default:
        return <Skeleton className="h-20 w-full" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`} data-testid={`skeleton-${type}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          {renderSkeleton()}
        </motion.div>
      ))}
    </div>
  );
}

interface ProgressLoaderProps {
  progress: number;
  message: string;
  stage?: string;
  estimatedTime?: number;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressLoader({ 
  progress, 
  message, 
  stage, 
  estimatedTime,
  showPercentage = true,
  className 
}: ProgressLoaderProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressColor = () => {
    if (progress < 25) return 'bg-red-500';
    if (progress < 50) return 'bg-yellow-500';
    if (progress < 75) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`space-y-4 p-6 ${className}`}
      data-testid="progress-loader"
    >
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-lg font-medium">{message}</span>
        </div>
        {stage && (
          <p className="text-sm text-muted-foreground">{stage}</p>
        )}
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="w-full" />
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>
            {showPercentage && `${Math.round(progress)}% complete`}
          </span>
          <div className="flex gap-4">
            <span>Elapsed: {formatTime(elapsedTime)}</span>
            {estimatedTime && (
              <span>ETA: {formatTime(Math.max(0, estimatedTime - elapsedTime))}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface ConnectionStatusProps {
  isOnline: boolean;
  isConnecting?: boolean;
  lastSync?: Date;
  className?: string;
}

export function ConnectionStatus({ isOnline, isConnecting, lastSync, className }: ConnectionStatusProps) {
  const getStatusInfo = () => {
    if (isConnecting) {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: 'Connecting...',
        variant: 'secondary' as const,
        color: 'text-yellow-600'
      };
    }

    if (isOnline) {
      return {
        icon: <Wifi className="h-4 w-4" />,
        text: 'Online',
        variant: 'secondary' as const,
        color: 'text-green-600'
      };
    }

    return {
      icon: <WifiOff className="h-4 w-4" />,
      text: 'Offline',
      variant: 'destructive' as const,
      color: 'text-red-600'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="connection-status">
      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
        <span className={statusInfo.color}>{statusInfo.icon}</span>
        <span>{statusInfo.text}</span>
      </Badge>
      {lastSync && isOnline && (
        <span className="text-xs text-muted-foreground">
          Last sync: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

interface LoadingStateProps {
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  retryCount?: number;
  maxRetries?: number;
  loadingMessage?: string;
  children: React.ReactNode;
  skeletonType?: 'lesson' | 'project' | 'gallery' | 'code-editor' | 'custom';
  showRetryButton?: boolean;
}

export function LoadingState({ 
  isLoading, 
  error, 
  onRetry, 
  retryCount = 0,
  maxRetries = 3,
  loadingMessage = "Loading...",
  children,
  skeletonType = 'custom',
  showRetryButton = true
}: LoadingStateProps) {
  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <AlertDescription className="text-red-800 dark:text-red-200">
          <div className="space-y-3">
            <p className="font-medium">Something went wrong</p>
            <p className="text-sm">{error}</p>
            {onRetry && showRetryButton && retryCount < maxRetries && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onRetry}
                  data-testid="button-retry"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                {retryCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Attempt {retryCount + 1} of {maxRetries}
                  </span>
                )}
              </div>
            )}
            {retryCount >= maxRetries && (
              <p className="text-xs text-muted-foreground">
                Maximum retry attempts reached. Please refresh the page or contact support.
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <SkeletonLoader type={skeletonType} />;
  }

  return <>{children}</>;
}

interface DataTransferStatusProps {
  type: 'upload' | 'download';
  progress: number;
  speed?: number; // bytes per second
  fileName?: string;
  totalSize?: number;
  transferredSize?: number;
  className?: string;
}

export function DataTransferStatus({
  type,
  progress,
  speed,
  fileName,
  totalSize,
  transferredSize,
  className
}: DataTransferStatusProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const estimatedTimeRemaining = () => {
    if (!speed || !totalSize || !transferredSize) return null;
    const remaining = totalSize - transferredSize;
    const seconds = Math.ceil(remaining / speed);
    return `${seconds}s remaining`;
  };

  const icon = type === 'upload' ? 
    <Upload className="h-4 w-4 text-blue-600" /> : 
    <Download className="h-4 w-4 text-green-600" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-2 p-4 border rounded-lg bg-muted/50 ${className}`}
      data-testid={`${type}-status`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">
            {type === 'upload' ? 'Uploading' : 'Downloading'}
            {fileName && `: ${fileName}`}
          </span>
        </div>
        <span className="text-sm font-mono">{Math.round(progress)}%</span>
      </div>

      <Progress value={progress} className="w-full" />

      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <div className="flex gap-4">
          {totalSize && transferredSize && (
            <span>{formatBytes(transferredSize)} / {formatBytes(totalSize)}</span>
          )}
          {speed && <span>{formatSpeed(speed)}</span>}
        </div>
        {estimatedTimeRemaining() && (
          <span>{estimatedTimeRemaining()}</span>
        )}
      </div>
    </motion.div>
  );
}

interface AsyncOperationStatusProps {
  operation: string;
  status: 'idle' | 'running' | 'success' | 'error';
  duration?: number;
  error?: string;
  className?: string;
}

export function AsyncOperationStatus({
  operation,
  status,
  duration,
  error,
  className
}: AsyncOperationStatusProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'running':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin text-blue-600" />,
          text: `${operation}...`,
          bgColor: 'bg-blue-50 dark:bg-blue-950',
          textColor: 'text-blue-800 dark:text-blue-200'
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          text: `${operation} completed`,
          bgColor: 'bg-green-50 dark:bg-green-950',
          textColor: 'text-green-800 dark:text-green-200'
        };
      case 'error':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
          text: `${operation} failed`,
          bgColor: 'bg-red-50 dark:bg-red-950',
          textColor: 'text-red-800 dark:text-red-200'
        };
      case 'idle':
      default:
        return {
          icon: <Clock className="h-4 w-4 text-gray-600" />,
          text: operation,
          bgColor: 'bg-gray-50 dark:bg-gray-950',
          textColor: 'text-gray-800 dark:text-gray-200'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-2 p-2 rounded-md ${statusInfo.bgColor} ${statusInfo.textColor} ${className}`}
      data-testid={`async-status-${status}`}
    >
      {statusInfo.icon}
      <span className="text-sm font-medium">{statusInfo.text}</span>
      {duration && status === 'success' && (
        <span className="text-xs opacity-75">({duration}ms)</span>
      )}
      {error && status === 'error' && (
        <span className="text-xs opacity-75">- {error}</span>
      )}
    </motion.div>
  );
}