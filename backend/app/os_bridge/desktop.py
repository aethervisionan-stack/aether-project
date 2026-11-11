"""Native desktop OS bridge — Windows Win32 automation (ctypes)."""

from __future__ import annotations

import base64
import ctypes
import platform
import struct
import subprocess
import sys
import time
import uuid
from ctypes import wintypes
from typing import Any

from app.os_bridge.contracts import (
    AccessibilityBridge,
    BridgeResult,
    MediaAction,
    NotificationEvent,
    OsBridgeBundle,
    SoundMode,
    SystemControlBridge,
)
from app.os_bridge.mock import (
    MockAccessibilityBridge,
    MockCalendarBridge,
    MockMessagingBridge,
    MockTelephonyBridge,
)

VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
VK_MEDIA_STOP = 0xB2
VK_MEDIA_PLAY_PAUSE = 0xB3
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_WHEEL = 0x0800
SM_CXSCREEN = 0
SM_CYSCREEN = 1


def _ok(action: str, detail: str = "", *, mock: bool = False, **data: Any) -> BridgeResult:
    return BridgeResult(ok=True, action=action, detail=detail, data=dict(data), mock=mock)


def _fail(action: str, error: str, *, mock: bool = False) -> BridgeResult:
    return BridgeResult(ok=False, action=action, error=error, mock=mock)


def is_windows() -> bool:
    return sys.platform.startswith("win")


def _user32():
    return ctypes.windll.user32


def _kernel32():
    return ctypes.windll.kernel32


def _tap_vk(vk: int) -> None:
    user32 = _user32()
    user32.keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, 0)
    user32.keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)


class SYSTEM_POWER_STATUS(ctypes.Structure):
    _fields_ = [
        ("ACLineStatus", wintypes.BYTE),
        ("BatteryFlag", wintypes.BYTE),
        ("BatteryLifePercent", wintypes.BYTE),
        ("SystemStatusFlag", wintypes.BYTE),
        ("BatteryLifeTime", wintypes.DWORD),
        ("BatteryFullLifeTime", wintypes.DWORD),
    ]


class DesktopSystemControlBridge:
    def __init__(self) -> None:
        self.volume = 50
        self.sound_mode: SoundMode = "normal"
        self.playing = False
        self._alarms: dict[str, dict[str, Any]] = {}

    async def media(self, *, action: MediaAction) -> BridgeResult:
        if not is_windows():
            return _fail("media", "desktop media requires Windows")
        mapping = {
            "play": VK_MEDIA_PLAY_PAUSE,
            "pause": VK_MEDIA_PLAY_PAUSE,
            "next": VK_MEDIA_NEXT_TRACK,
            "previous": VK_MEDIA_PREV_TRACK,
            "stop": VK_MEDIA_STOP,
        }
        vk = mapping.get(action)
        if vk is None:
            return _fail("media", f"unknown media action: {action}")
        try:
            _tap_vk(vk)
            self.playing = action == "play"
            return _ok("media", f"Media {action}", action=action, playing=self.playing)
        except Exception as exc:  # noqa: BLE001
            return _fail("media", str(exc))

    async def battery(self) -> BridgeResult:
        if not is_windows():
            return _fail("battery", "desktop battery requires Windows")
        try:
            status = SYSTEM_POWER_STATUS()
            if not _kernel32().GetSystemPowerStatus(ctypes.byref(status)):
                return _fail("battery", "GetSystemPowerStatus failed")
            pct = int(status.BatteryLifePercent)
            if pct == 255:
                pct = -1
            return _ok(
                "battery",
                f"Battery {pct}%" if pct >= 0 else "Battery unknown",
                percent=pct,
                charging=int(status.ACLineStatus) == 1,
            )
        except Exception as exc:  # noqa: BLE001
            return _fail("battery", str(exc))

    async def set_volume(self, *, level: int) -> BridgeResult:
        if not is_windows():
            return _fail("set_volume", "desktop volume requires Windows")
        target = max(0, min(100, int(level)))
        try:
            for _ in range(50):
                _tap_vk(VK_VOLUME_DOWN)
            for _ in range(max(0, min(50, target // 2))):
                _tap_vk(VK_VOLUME_UP)
            self.volume = target
            return _ok("set_volume", f"Volume ~{self.volume}%", level=self.volume)
        except Exception as exc:  # noqa: BLE001
            return _fail("set_volume", str(exc))

    async def set_sound_mode(self, *, mode: SoundMode) -> BridgeResult:
        if not is_windows():
            return _fail("set_sound_mode", "desktop sound mode requires Windows")
        try:
            if mode in {"silent", "normal"}:
                _tap_vk(VK_VOLUME_MUTE)
            self.sound_mode = mode
            return _ok("set_sound_mode", f"Sound mode {mode}", mode=mode)
        except Exception as exc:  # noqa: BLE001
            return _fail("set_sound_mode", str(exc))

    async def set_timer(self, *, minutes: int, label: str = "") -> BridgeResult:
        return _ok(
            "set_timer",
            f"Timer {minutes} min" + (f" ({label})" if label else ""),
            minutes=minutes,
            label=label,
            timer_id=uuid.uuid4().hex[:8],
        )

    async def set_alarm(self, *, time_hhmm: str, label: str = "") -> BridgeResult:
        alarm_id = uuid.uuid4().hex[:8]
        self._alarms[alarm_id] = {"id": alarm_id, "time": time_hhmm, "label": label}
        return _ok(
            "set_alarm",
            f"Alarm at {time_hhmm}",
            time=time_hhmm,
            label=label,
            alarm_id=alarm_id,
        )

    async def delete_alarm(self, *, alarm_id: str) -> BridgeResult:
        entry = self._alarms.pop(alarm_id, None)
        if entry is None:
            return _fail("delete_alarm", f"unknown alarm: {alarm_id}")
        return _ok("delete_alarm", f"Deleted alarm {alarm_id}", alarm=entry)


class DesktopInputController:
    def click(self, *, x: int, y: int, button: str = "left") -> BridgeResult:
        if not is_windows():
            return _fail("mouse", "desktop mouse requires Windows")
        try:
            user32 = _user32()
            user32.SetCursorPos(int(x), int(y))
            down, up = (
                (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP)
                if button == "right"
                else (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP)
            )
            user32.mouse_event(down, 0, 0, 0, 0)
            user32.mouse_event(up, 0, 0, 0, 0)
            return _ok("mouse", f"Click {button} at {x},{y}", x=x, y=y, button=button)
        except Exception as exc:  # noqa: BLE001
            return _fail("mouse", str(exc))

    def move(self, *, x: int, y: int) -> BridgeResult:
        if not is_windows():
            return _fail("mouse", "desktop mouse requires Windows")
        try:
            _user32().SetCursorPos(int(x), int(y))
            return _ok("mouse", f"Move to {x},{y}", x=x, y=y)
        except Exception as exc:  # noqa: BLE001
            return _fail("mouse", str(exc))

    def scroll(self, *, delta: int) -> BridgeResult:
        if not is_windows():
            return _fail("mouse", "desktop mouse requires Windows")
        try:
            _user32().mouse_event(MOUSEEVENTF_WHEEL, 0, 0, int(delta) * 120, 0)
            return _ok("mouse", f"Scroll {delta}", delta=delta)
        except Exception as exc:  # noqa: BLE001
            return _fail("mouse", str(exc))

    def type_text(self, *, text: str) -> BridgeResult:
        if not is_windows():
            return _fail("keyboard", "desktop keyboard requires Windows")
        try:
            user32 = _user32()
            for ch in text:
                if ord(ch) >= 128 or not ch.isprintable():
                    continue
                vk = user32.VkKeyScanW(ord(ch))
                if vk == -1:
                    continue
                lo = vk & 0xFF
                shift = (vk >> 8) & 0xFF
                if shift & 1:
                    user32.keybd_event(0x10, 0, 0, 0)
                user32.keybd_event(lo, 0, 0, 0)
                user32.keybd_event(lo, 0, KEYEVENTF_KEYUP, 0)
                if shift & 1:
                    user32.keybd_event(0x10, 0, KEYEVENTF_KEYUP, 0)
            return _ok("keyboard", f"Typed {len(text)} chars", length=len(text))
        except Exception as exc:  # noqa: BLE001
            return _fail("keyboard", str(exc))

    def hotkey(self, *, keys: list[str]) -> BridgeResult:
        if not is_windows():
            return _fail("keyboard", "desktop keyboard requires Windows")
        name_to_vk = {
            "ctrl": 0x11,
            "control": 0x11,
            "alt": 0x12,
            "shift": 0x10,
            "win": 0x5B,
            "enter": 0x0D,
            "esc": 0x1B,
            "escape": 0x1B,
            "tab": 0x09,
            "space": 0x20,
        }
        try:
            user32 = _user32()
            vks: list[int] = []
            for key in keys:
                k = key.strip().lower()
                if k in name_to_vk:
                    vks.append(name_to_vk[k])
                elif len(k) == 1:
                    vks.append(user32.VkKeyScanW(ord(k)) & 0xFF)
                else:
                    return _fail("keyboard", f"unknown key: {key}")
            for vk in vks:
                user32.keybd_event(vk, 0, 0, 0)
            for vk in reversed(vks):
                user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
            return _ok("keyboard", f"Hotkey {'+'.join(keys)}", keys=keys)
        except Exception as exc:  # noqa: BLE001
            return _fail("keyboard", str(exc))


class DesktopCapture:
    def capture(self, *, max_width: int = 1280) -> BridgeResult:
        if not is_windows():
            return _fail("desktop_capture", "desktop capture requires Windows")
        try:
            user32 = _user32()
            gdi32 = ctypes.windll.gdi32
            width = int(user32.GetSystemMetrics(SM_CXSCREEN))
            height = int(user32.GetSystemMetrics(SM_CYSCREEN))
            if width <= 0 or height <= 0:
                return _fail("desktop_capture", "invalid screen metrics")
            out_w, out_h = width, height
            if max_width > 0 and width > max_width:
                out_w = max_width
                out_h = max(1, int(height * (max_width / float(width))))
            hdc_screen = user32.GetDC(0)
            hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
            hbmp = gdi32.CreateCompatibleBitmap(hdc_screen, out_w, out_h)
            gdi32.SelectObject(hdc_mem, hbmp)
            gdi32.SetStretchBltMode(hdc_mem, 3)
            gdi32.StretchBlt(hdc_mem, 0, 0, out_w, out_h, hdc_screen, 0, 0, width, height, 0x00CC0020)

            class BITMAPINFOHEADER(ctypes.Structure):
                _fields_ = [
                    ("biSize", wintypes.DWORD),
                    ("biWidth", wintypes.LONG),
                    ("biHeight", wintypes.LONG),
                    ("biPlanes", wintypes.WORD),
                    ("biBitCount", wintypes.WORD),
                    ("biCompression", wintypes.DWORD),
                    ("biSizeImage", wintypes.DWORD),
                    ("biXPelsPerMeter", wintypes.LONG),
                    ("biYPelsPerMeter", wintypes.LONG),
                    ("biClrUsed", wintypes.DWORD),
                    ("biClrImportant", wintypes.DWORD),
                ]

            bmi = BITMAPINFOHEADER()
            bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
            bmi.biWidth = out_w
            bmi.biHeight = -out_h
            bmi.biPlanes = 1
            bmi.biBitCount = 24
            row_stride = ((out_w * 3 + 3) // 4) * 4
            buf_size = row_stride * out_h
            buf = (ctypes.c_char * buf_size)()
            gdi32.GetDIBits(hdc_mem, hbmp, 0, out_h, buf, ctypes.byref(bmi), 0)
            file_header = struct.pack(
                "<2sIHHI",
                b"BM",
                14 + ctypes.sizeof(BITMAPINFOHEADER) + buf_size,
                0,
                0,
                14 + ctypes.sizeof(BITMAPINFOHEADER),
            )
            bmi.biHeight = out_h
            raw = bytes(buf)
            rows = [raw[y * row_stride : (y + 1) * row_stride] for y in range(out_h - 1, -1, -1)]
            bmp = file_header + bytes(bmi) + b"".join(rows)
            gdi32.DeleteObject(hbmp)
            gdi32.DeleteDC(hdc_mem)
            user32.ReleaseDC(0, hdc_screen)
            return _ok(
                "desktop_capture",
                f"Captured {out_w}x{out_h}",
                width=out_w,
                height=out_h,
                format="bmp",
                encoding="base64",
                image_base64=base64.b64encode(bmp).decode("ascii"),
                bytes=len(bmp),
            )
        except Exception as exc:  # noqa: BLE001
            return _fail("desktop_capture", str(exc))


class DesktopNotificationReader:
    def __init__(self, accessibility: AccessibilityBridge) -> None:
        self._accessibility = accessibility

    async def read(self, *, limit: int = 10) -> BridgeResult:
        events: list[dict[str, Any]] = []
        try:
            polled = await self._accessibility.poll_notifications()
            for ev in polled[: max(1, min(limit, 50))]:
                events.append(ev.to_dict() if hasattr(ev, "to_dict") else dict(ev))
        except Exception:  # noqa: BLE001
            pass
        if not events and is_windows():
            try:
                ps = (
                    "Get-WinEvent -LogName Application -MaxEvents 5 "
                    "| Select-Object Id,TimeCreated,Message | ConvertTo-Json -Compress"
                )
                completed = subprocess.run(
                    ["powershell", "-NoProfile", "-Command", ps],
                    capture_output=True,
                    text=True,
                    timeout=4,
                    check=False,
                )
                if completed.returncode == 0 and completed.stdout.strip():
                    events.append(
                        {
                            "source": "winevent_application_sample",
                            "raw": completed.stdout.strip()[:4000],
                        }
                    )
            except Exception as exc:  # noqa: BLE001
                return _fail("notification_read", str(exc))
        return _ok(
            "notification_read",
            f"{len(events)} notification(s)",
            notifications=events,
            count=len(events),
        )


class DesktopOsBridgeBundle(OsBridgeBundle):
    def __init__(self) -> None:
        system = DesktopSystemControlBridge()
        accessibility = MockAccessibilityBridge()
        super().__init__(
            messaging=MockMessagingBridge(),
            calendar=MockCalendarBridge(),
            telephony=MockTelephonyBridge(),
            system=system,
            accessibility=accessibility,
            platform="desktop",
        )
        self.input = DesktopInputController()
        self.capture = DesktopCapture()
        self.notifications = DesktopNotificationReader(accessibility)

    def status(self) -> dict[str, Any]:
        base = super().status()
        base.update(
            {
                "mock": False,
                "desktop_capture": True,
                "keyboard": True,
                "mouse": True,
                "notification_read": True,
                "os": platform.system(),
                "windows": is_windows(),
            }
        )
        return base


def build_desktop_bundle() -> DesktopOsBridgeBundle:
    return DesktopOsBridgeBundle()
