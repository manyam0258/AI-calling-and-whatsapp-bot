"""
notify.py — Telegram notification helpers.
"""
import logging
import os
import httpx
from datetime import datetime
import pytz

logger = logging.getLogger("notify")


def _send_telegram(message: str):
    token   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        logger.debug("Telegram not configured — skipping notification")
        return
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        httpx.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}, timeout=5.0)
    except Exception as e:
        logger.warning(f"Telegram notification failed: {e}")


def notify_booking_request(
    caller_name: str, caller_phone: str, requested_time_iso: str, notes: str = "",
):
    """Sent when a caller asks for an appointment/callback. No external calendar
    is touched — this just alerts the team to confirm the request manually."""
    ist = pytz.timezone("Asia/Kolkata")
    try:
        dt = datetime.fromisoformat(requested_time_iso)
        dt_ist = dt.astimezone(ist)
        time_str = dt_ist.strftime("%d %b %Y at %I:%M %p IST")
    except Exception:
        time_str = requested_time_iso

    msg = (
        f"📅 *Booking Request — Needs Confirmation*\n"
        f"👤 {caller_name} ({caller_phone})\n"
        f"🕒 Requested: {time_str}\n"
        f"📝 {notes[:100] if notes else 'No notes'}\n"
        f"_Please confirm with the caller directly._"
    )
    _send_telegram(msg)


def notify_call_no_booking(
    caller_name: str, caller_phone: str, call_summary: str = "",
    tts_voice: str = "", duration_seconds: int = 0,
):
    mins = duration_seconds // 60
    secs = duration_seconds % 60
    name = caller_name or "Unknown"
    _send_telegram(
        f"📞 *Call Ended — No Booking*\n"
        f"👤 {name} ({caller_phone})\n"
        f"⏱ {mins}m {secs}s\n"
        f"📋 {call_summary[:120] if call_summary else 'No summary'}"
    )


def notify_agent_error(error: str, context: str = ""):
    _send_telegram(f"🚨 *Agent Error*\n{context}\n```{error[:300]}```")
