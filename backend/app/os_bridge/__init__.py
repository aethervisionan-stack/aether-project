"""Hands-free OS agent bridges — accessibility + system API contracts."""

from app.os_bridge.confirmation import (
    CONFIRM_PHRASES,
    ConfirmationEngine,
    PendingAction,
    get_confirmation_engine,
    is_confirmation_utterance,
    is_rejection_utterance,
)
from app.os_bridge.contracts import (
    AccessibilityBridge,
    CalendarBridge,
    MessagingBridge,
    NotificationEvent,
    OsBridgeBundle,
    SystemControlBridge,
    TelephonyBridge,
)
from app.os_bridge.factory import get_os_bridge, reset_os_bridge_cache
from app.os_bridge.listener import NotificationListenerEngine
from app.os_bridge.mock import MockOsBridgeBundle
from app.os_bridge.scope import ScopeRegistry, get_scope_registry

__all__ = [
    "CONFIRM_PHRASES",
    "AccessibilityBridge",
    "CalendarBridge",
    "ConfirmationEngine",
    "MessagingBridge",
    "MockOsBridgeBundle",
    "NotificationEvent",
    "NotificationListenerEngine",
    "OsBridgeBundle",
    "PendingAction",
    "ScopeRegistry",
    "SystemControlBridge",
    "TelephonyBridge",
    "get_confirmation_engine",
    "get_os_bridge",
    "get_scope_registry",
    "is_confirmation_utterance",
    "is_rejection_utterance",
    "reset_os_bridge_cache",
]
