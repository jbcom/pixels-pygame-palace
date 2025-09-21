"""
Event Bus - Decoupled communication system for the ECS architecture.

The EventBus allows systems and entities to communicate without direct references,
promoting loose coupling and modular design.
"""

from typing import Dict, List, Callable, Any, Optional, Type
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
import uuid
import logging

logger = logging.getLogger(__name__)


class EventPriority(Enum):
    """Event handling priority levels."""
    IMMEDIATE = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3


@dataclass
class Event:
    """Base event class for all game events."""
    
    event_type: str
    data: Dict[str, Any]
    source_entity_id: Optional[str] = None
    timestamp: float = 0.0
    priority: EventPriority = EventPriority.NORMAL
    
    def __post_init__(self):
        if not self.timestamp:
            import time
            self.timestamp = time.time()


@dataclass
class EventSubscription:
    """Event subscription information."""
    
    subscriber_id: str
    callback: Callable[[Event], None]
    priority: EventPriority
    filter_func: Optional[Callable[[Event], bool]] = None
    once: bool = False  # Remove after first event


class EventBus:
    """
    Central event bus for decoupled communication.
    
    The EventBus implements the observer pattern, allowing systems and entities
    to publish and subscribe to events without knowing about each other.
    """
    
    def __init__(self):
        """Initialize event bus."""
        # Event type -> list of subscriptions
        self._subscriptions: Dict[str, List[EventSubscription]] = defaultdict(list)
        
        # Queued events for next frame processing
        self._event_queue: List[Event] = []
        
        # Immediate events processed right away
        self._immediate_events: List[Event] = []
        
        # Event statistics
        self._events_published = 0
        self._events_processed = 0
        
        # Global event filters
        self._global_filters: List[Callable[[Event], bool]] = []
    
    def subscribe(self, event_type: str, callback: Callable[[Event], None],
                 priority: EventPriority = EventPriority.NORMAL,
                 filter_func: Optional[Callable[[Event], bool]] = None,
                 once: bool = False) -> str:
        """
        Subscribe to events of a specific type.
        
        Args:
            event_type: Type of event to listen for
            callback: Function to call when event occurs
            priority: Processing priority
            filter_func: Optional filter for events
            once: If True, unsubscribe after first event
            
        Returns:
            Subscription ID for later unsubscription
        """
        subscription_id = str(uuid.uuid4())
        
        subscription = EventSubscription(
            subscriber_id=subscription_id,
            callback=callback,
            priority=priority,
            filter_func=filter_func,
            once=once
        )
        
        self._subscriptions[event_type].append(subscription)
        
        # Sort by priority
        self._subscriptions[event_type].sort(key=lambda s: s.priority.value)
        
        logger.debug(f"Subscribed {subscription_id} to {event_type}")
        return subscription_id
    
    def unsubscribe(self, subscription_id: str):
        """
        Unsubscribe from events.
        
        Args:
            subscription_id: ID returned from subscribe()
        """
        for event_type, subscriptions in self._subscriptions.items():
            self._subscriptions[event_type] = [
                sub for sub in subscriptions 
                if sub.subscriber_id != subscription_id
            ]
        
        logger.debug(f"Unsubscribed {subscription_id}")
    
    def publish(self, event_type: str, data: Dict[str, Any] = None,
               source_entity_id: Optional[str] = None,
               priority: EventPriority = EventPriority.NORMAL,
               immediate: bool = False):
        """
        Publish an event.
        
        Args:
            event_type: Type of event
            data: Event data dictionary
            source_entity_id: ID of entity that triggered event
            priority: Event priority
            immediate: If True, process immediately
        """
        event = Event(
            event_type=event_type,
            data=data or {},
            source_entity_id=source_entity_id,
            priority=priority
        )
        
        # Apply global filters
        for filter_func in self._global_filters:
            if not filter_func(event):
                return  # Event filtered out
        
        if immediate or priority == EventPriority.IMMEDIATE:
            self._immediate_events.append(event)
            self._process_immediate_events()
        else:
            self._event_queue.append(event)
        
        self._events_published += 1
        logger.debug(f"Published event {event_type}")
    
    def publish_event(self, event: Event, immediate: bool = False):
        """
        Publish a pre-constructed event.
        
        Args:
            event: Event to publish
            immediate: If True, process immediately
        """
        # Apply global filters
        for filter_func in self._global_filters:
            if not filter_func(event):
                return  # Event filtered out
        
        if immediate or event.priority == EventPriority.IMMEDIATE:
            self._immediate_events.append(event)
            self._process_immediate_events()
        else:
            self._event_queue.append(event)
        
        self._events_published += 1
    
    def process_events(self):
        """
        Process all queued events.
        
        This should be called once per frame to handle deferred events.
        """
        # Sort events by priority
        self._event_queue.sort(key=lambda e: e.priority.value)
        
        events_to_process = self._event_queue.copy()
        self._event_queue.clear()
        
        for event in events_to_process:
            self._process_event(event)
        
        # Process any immediate events that were triggered
        self._process_immediate_events()
    
    def _process_immediate_events(self):
        """Process immediate events right away."""
        while self._immediate_events:
            event = self._immediate_events.pop(0)
            self._process_event(event)
    
    def _process_event(self, event: Event):
        """
        Process a single event.
        
        Args:
            event: Event to process
        """
        subscriptions = self._subscriptions.get(event.event_type, [])
        one_time_subscriptions = []
        
        for subscription in subscriptions:
            try:
                # Apply subscription filter
                if subscription.filter_func and not subscription.filter_func(event):
                    continue
                
                # Call subscriber
                subscription.callback(event)
                
                # Mark one-time subscriptions for removal
                if subscription.once:
                    one_time_subscriptions.append(subscription.subscriber_id)
                
            except Exception as e:
                logger.error(f"Error processing event {event.event_type}: {e}", 
                           exc_info=True)
        
        # Remove one-time subscriptions
        for sub_id in one_time_subscriptions:
            self.unsubscribe(sub_id)
        
        self._events_processed += 1
    
    def add_global_filter(self, filter_func: Callable[[Event], bool]):
        """
        Add a global event filter.
        
        Args:
            filter_func: Function that returns True to allow event
        """
        self._global_filters.append(filter_func)
    
    def remove_global_filter(self, filter_func: Callable[[Event], bool]):
        """
        Remove a global event filter.
        
        Args:
            filter_func: Filter function to remove
        """
        if filter_func in self._global_filters:
            self._global_filters.remove(filter_func)
    
    def clear_subscriptions(self, event_type: Optional[str] = None):
        """
        Clear subscriptions.
        
        Args:
            event_type: Specific event type to clear, or None for all
        """
        if event_type:
            self._subscriptions[event_type].clear()
        else:
            self._subscriptions.clear()
    
    def get_subscription_count(self, event_type: str) -> int:
        """
        Get number of subscribers for an event type.
        
        Args:
            event_type: Event type to check
            
        Returns:
            Number of subscribers
        """
        return len(self._subscriptions.get(event_type, []))
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get event bus statistics.
        
        Returns:
            Statistics dictionary
        """
        total_subscriptions = sum(len(subs) for subs in self._subscriptions.values())
        
        return {
            'events_published': self._events_published,
            'events_processed': self._events_processed,
            'queued_events': len(self._event_queue),
            'total_subscriptions': total_subscriptions,
            'event_types': list(self._subscriptions.keys())
        }
    
    def reset_stats(self):
        """Reset event statistics."""
        self._events_published = 0
        self._events_processed = 0


# Common game events

class GameEvents:
    """Standard game event types."""
    
    # Entity events
    ENTITY_CREATED = "entity_created"
    ENTITY_DESTROYED = "entity_destroyed"
    ENTITY_MOVED = "entity_moved"
    
    # Player events
    PLAYER_MOVED = "player_moved"
    PLAYER_JUMPED = "player_jumped"
    PLAYER_LANDED = "player_landed"
    PLAYER_DAMAGED = "player_damaged"
    PLAYER_DIED = "player_died"
    PLAYER_RESPAWNED = "player_respawned"
    
    # Collision events
    COLLISION_STARTED = "collision_started"
    COLLISION_ENDED = "collision_ended"
    TRIGGER_ENTERED = "trigger_entered"
    TRIGGER_EXITED = "trigger_exited"
    
    # Game state events
    GAME_STARTED = "game_started"
    GAME_PAUSED = "game_paused"
    GAME_RESUMED = "game_resumed"
    GAME_OVER = "game_over"
    LEVEL_STARTED = "level_started"
    LEVEL_COMPLETED = "level_completed"
    
    # UI events
    BUTTON_CLICKED = "button_clicked"
    MENU_OPENED = "menu_opened"
    MENU_CLOSED = "menu_closed"
    
    # Audio events
    SOUND_PLAY = "sound_play"
    SOUND_STOP = "sound_stop"
    MUSIC_CHANGED = "music_changed"
    
    # Animation events
    ANIMATION_STARTED = "animation_started"
    ANIMATION_FINISHED = "animation_finished"
    ANIMATION_LOOP = "animation_loop"


# Global event bus instance
event_bus = EventBus()