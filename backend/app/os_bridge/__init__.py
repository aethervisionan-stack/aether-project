"""Hands-free OS agent bridges — accessibility + system API contracts."""

from app.os_bridge.confirmation import (
    CONFIRM_PHRASES,
    ConfirmationEngine,
    PendingAction,
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
from app.os_bridge.listener import NotificationListenerEngine
from app.os_bridge.mock import MockOsBridgeBundle, get_os_bridge

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
    "SystemControlBridge",
    "TelephonyBridge",
    "get_os_bridge",
    "is_confirmation_utterance",
    "is_rejection_utterance",
]
