import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Gamepad2,
  BookOpen,
  Palette,
  Settings,
  Navigation,
  Clock,
  RotateCcw,
  Play,
  ChevronRight,
  History
} from "lucide-react";
import { sessionHistory, SessionEvent, SessionState } from "@/lib/session-history";
import { cn } from "@/lib/utils";

interface SessionPlaybackProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToEvent?: (event: SessionEvent) => void;
  onRevertToEvent?: (event: SessionEvent) => void;
}

export default function SessionPlayback({
  isOpen,
  onClose,
  onJumpToEvent,
  onRevertToEvent
}: SessionPlaybackProps) {
  const [sessionState, setSessionState] = useState<SessionState>({ events: [], currentPosition: -1 });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = sessionHistory.subscribe(setSessionState);
    return unsubscribe;
  }, []);

  const getEventIcon = (type: SessionEvent['type']) => {
    switch (type) {
      case 'choice':
        return Gamepad2;
      case 'lesson':
        return BookOpen;
      case 'editor':
        return Palette;
      case 'component':
        return Settings;
      case 'navigation':
        return Navigation;
      default:
        return Clock;
    }
  };

  const getEventColor = (type: SessionEvent['type']) => {
    switch (type) {
      case 'choice':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900/20';
      case 'lesson':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'editor':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'component':
        return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
      case 'navigation':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getEventEmoji = (type: SessionEvent['type']) => {
    switch (type) {
      case 'choice':
        return '🎮';
      case 'lesson':
        return '📚';
      case 'editor':
        return '🎨';
      case 'component':
        return '⚙️';
      case 'navigation':
        return '🗺️';
      default:
        return '⏰';
    }
  };

  const handleEventClick = (event: SessionEvent) => {
    setSelectedEventId(event.id);
  };

  const handleJumpToEvent = () => {
    const event = sessionState.events.find(e => e.id === selectedEventId);
    if (event && onJumpToEvent) {
      onJumpToEvent(event);
      onClose();
    }
  };

  const handleRevertToEvent = () => {
    const event = sessionState.events.find(e => e.id === selectedEventId);
    if (event && onRevertToEvent) {
      onRevertToEvent(event);
      onClose();
    }
  };

  const selectedEvent = sessionState.events.find(e => e.id === selectedEventId);
  const progressPercent = sessionState.events.length > 0 
    ? ((sessionState.currentPosition + 1) / sessionState.events.length) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <History className="w-6 h-6 text-purple-600" />
            Your Journey with Pixel
          </DialogTitle>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Progress</span>
                <span>{sessionState.events.length} events</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Timeline */}
          <div className="flex-1 border-r">
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="space-y-2">
                  {sessionState.events.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No events recorded yet</p>
                      <p className="text-sm mt-2">Start exploring to build your journey!</p>
                    </div>
                  ) : (
                    sessionState.events.map((event, index) => {
                      const Icon = getEventIcon(event.type);
                      const isSelected = event.id === selectedEventId;
                      const isHovered = event.id === hoveredEventId;
                      const isCurrent = index === sessionState.currentPosition;
                      const isFuture = index > sessionState.currentPosition;

                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="relative"
                        >
                          {/* Connection line */}
                          {index < sessionState.events.length - 1 && (
                            <div 
                              className={cn(
                                "absolute left-6 top-12 w-0.5 h-[calc(100%+8px)]",
                                isFuture ? "bg-gray-200 dark:bg-gray-800" : "bg-purple-300 dark:bg-purple-700"
                              )}
                            />
                          )}

                          <button
                            onClick={() => handleEventClick(event)}
                            onMouseEnter={() => setHoveredEventId(event.id)}
                            onMouseLeave={() => setHoveredEventId(null)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg transition-all relative",
                              isSelected && "bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500",
                              !isSelected && isHovered && "bg-gray-50 dark:bg-gray-900/50",
                              isCurrent && !isSelected && "bg-blue-50 dark:bg-blue-900/10"
                            )}
                            data-testid={`event-${event.id}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative",
                                getEventColor(event.type),
                                isFuture && "opacity-50"
                              )}>
                                <Icon className="w-5 h-5" />
                                {isCurrent && (
                                  <motion.div
                                    className="absolute inset-0 rounded-full ring-2 ring-purple-500 ring-offset-2"
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                )}
                              </div>

                              {/* Content */}
                              <div className={cn("flex-1", isFuture && "opacity-50")}>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{getEventEmoji(event.type)}</span>
                                  <p className="font-medium">{event.description}</p>
                                  {isCurrent && (
                                    <Badge variant="secondary" className="ml-auto">
                                      Current
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {format(event.timestamp, "h:mm a · MMM d")}
                                </p>
                                {event.data && event.data.label && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {event.data.label}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Details Panel */}
          <div className="w-96 p-6">
            {selectedEvent ? (
              <motion.div
                key={selectedEvent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">Event Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg">{getEventEmoji(selectedEvent.type)}</span>
                        <Badge variant="secondary" className="capitalize">
                          {selectedEvent.type}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-medium">{format(selectedEvent.timestamp, "PPpp")}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Description</p>
                      <p className="font-medium">{selectedEvent.description}</p>
                    </div>
                    {selectedEvent.data && Object.keys(selectedEvent.data).length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Additional Data</p>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(selectedEvent.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto space-y-2">
                  {selectedEvent.canRevert && (
                    <Button
                      onClick={handleRevertToEvent}
                      variant="destructive"
                      className="w-full"
                      data-testid="revert-button"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Revert to Here
                    </Button>
                  )}
                  <Button
                    onClick={handleJumpToEvent}
                    className="w-full"
                    data-testid="jump-button"
                  >
                    {selectedEvent.type === 'lesson' ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Replay This Lesson
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-4 h-4 mr-2" />
                        Jump to This Point
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Clock className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium">Select an Event</p>
                <p className="text-sm mt-2">Click on any event in the timeline to see details and actions</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}