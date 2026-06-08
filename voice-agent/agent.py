"""
agent.py — LiveKit outbound calling agent worker.
Runs as a background process (via supervisord in Docker).
Based on voice-agent2/agent.py with multi-tenant support added.
"""
import os
import db
import json
import logging
import certifi
import pytz
import re
import asyncio
import time
from collections import defaultdict
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Annotated

os.environ["SSL_CERT_FILE"] = certifi.where()

import sentry_sdk
_sentry_dsn = os.environ.get("SENTRY_DSN", "")
if _sentry_dsn:
    from sentry_sdk.integrations.asyncio import AsyncioIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.1,
        integrations=[AsyncioIntegration()],
        environment=os.environ.get("ENVIRONMENT", "production"),
    )

logging.getLogger("hpack").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

load_dotenv()
logger = logging.getLogger("outbound-agent")
logging.basicConfig(level=logging.INFO)

from livekit import api
from livekit.agents import (
    Agent, AgentSession, JobContext, RoomInputOptions, WorkerOptions, cli, llm,
)
from livekit.plugins import openai, sarvam, silero

CONFIG_FILE = "config.json"

# ── Rate limiting ─────────────────────────────────────────────────────────────
_call_timestamps: dict = defaultdict(list)
RATE_LIMIT_CALLS  = 5
RATE_LIMIT_WINDOW = 3600

def is_rate_limited(phone: str) -> bool:
    if phone in ("unknown", "demo"):
        return False
    now = time.time()
    _call_timestamps[phone] = [t for t in _call_timestamps[phone] if now - t < RATE_LIMIT_WINDOW]
    if len(_call_timestamps[phone]) >= RATE_LIMIT_CALLS:
        return True
    _call_timestamps[phone].append(now)
    return False


def get_live_config(phone_number: str | None = None, tenant_id: str = "default"):
    """Load config — tries per-tenant file first, then per-phone, then default."""
    config = {}
    paths = [
        f"configs/{tenant_id}.json",
        f"configs/default.json",
        CONFIG_FILE,
    ]
    if phone_number and phone_number != "unknown":
        clean = phone_number.replace("+", "").replace(" ", "")
        paths.insert(0, f"configs/{clean}.json")

    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    config = json.load(f)
                    logger.info(f"[CONFIG] Loaded: {path}")
                    break
            except Exception as e:
                logger.error(f"[CONFIG] Failed to read {path}: {e}")

    return {
        "agent_instructions":        config.get("agent_instructions", ""),
        "stt_min_endpointing_delay": config.get("stt_min_endpointing_delay", 0.05),
        "llm_model":                 config.get("llm_model", "gpt-4o-mini"),
        "llm_provider":              config.get("llm_provider", "openai"),
        "tts_voice":                 config.get("tts_voice", "kavya"),
        "tts_language":              config.get("tts_language", "hi-IN"),
        "tts_provider":              config.get("tts_provider", "sarvam"),
        "stt_provider":              config.get("stt_provider", "sarvam"),
        "stt_language":              config.get("stt_language", "unknown"),
        "lang_preset":               config.get("lang_preset", "multilingual"),
        "max_turns":                 config.get("max_turns", 25),
        **config,
    }


def count_tokens(text: str) -> int:
    try:
        import tiktoken
        enc = tiktoken.encoding_for_model("gpt-4o")
        return len(enc.encode(text))
    except Exception:
        return len(text.split())


def get_ist_time_context() -> str:
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    return (
        f"\n\n[SYSTEM CONTEXT]\n"
        f"Today: {now.strftime('%A, %b %d')}, {now.strftime('%I:%M %p')} IST. "
        f"Use ISO dates. All times in IST.]"
    )


LANGUAGE_PRESETS = {
    "hinglish":     {"tts_language": "hi-IN", "tts_voice": "kavya", "instruction": "Speak natural Hinglish."},
    "hindi":        {"tts_language": "hi-IN", "tts_voice": "kavya", "instruction": "Speak pure Hindi."},
    "english":      {"tts_language": "en-IN", "tts_voice": "kavya", "instruction": "Speak Indian English, warm and professional."},
    "telugu":       {"tts_language": "te-IN", "tts_voice": "kavya", "instruction": "Speak polite Telugu."},
    "multilingual": {"tts_language": "hi-IN", "tts_voice": "kavya", "instruction": "Detect caller language and reply in same."},
}

def get_language_instruction(lang_preset: str) -> str:
    preset = LANGUAGE_PRESETS.get(lang_preset, LANGUAGE_PRESETS["multilingual"])
    return f"\n\n[LANGUAGE DIRECTIVE]\n{preset['instruction']}"


from notify import (
    notify_booking_request, notify_call_no_booking, notify_agent_error,
)


class AgentTools(llm.ToolContext):

    def __init__(self, caller_phone: str, caller_name: str = "", tenant_id: str = "default"):
        super().__init__(tools=[])
        self.caller_phone  = caller_phone
        self.caller_name   = caller_name
        self.tenant_id     = tenant_id
        self.booking_intent: dict | None = None
        self.sip_domain    = os.getenv("VOBIZ_SIP_DOMAIN")
        self.ctx_api       = None
        self.room_name     = None
        self._sip_identity = None

    @llm.function_tool(description="Transfer this call to a human agent.")
    async def transfer_call(self) -> str:
        destination = os.getenv("DEFAULT_TRANSFER_NUMBER")
        if destination and self.sip_domain and "@" not in destination:
            clean_dest  = destination.replace("tel:", "").replace("sip:", "")
            destination = f"sip:{clean_dest}@{self.sip_domain}"
        if destination and not destination.startswith("sip:"):
            destination = f"sip:{destination}"
        try:
            if self.ctx_api and self.room_name and destination and self._sip_identity:
                await self.ctx_api.sip.transfer_sip_participant(
                    api.TransferSIPParticipantRequest(
                        room_name=self.room_name,
                        participant_identity=self._sip_identity,
                        transfer_to=destination,
                        play_dialtone=False,
                    )
                )
                return "Transfer initiated successfully."
            return "Unable to transfer right now."
        except Exception as e:
            logger.error(f"Transfer failed: {e}")
            return "Unable to transfer right now."

    @llm.function_tool(description="End the call after booking is confirmed or caller says bye.")
    async def end_call(self) -> str:
        try:
            if self.ctx_api and self.room_name and self._sip_identity:
                await self.ctx_api.sip.transfer_sip_participant(
                    api.TransferSIPParticipantRequest(
                        room_name=self.room_name,
                        participant_identity=self._sip_identity,
                        transfer_to="tel:+00000000",
                        play_dialtone=False,
                    )
                )
        except Exception as e:
            logger.warning(f"[END-CALL] SIP hangup failed: {e}")
        return "Thank you for calling. Have a great day!"

    @llm.function_tool(description="Save the caller's requested appointment time and contact details so the team can confirm it manually.")
    async def save_booking_intent(
        self,
        start_time:   Annotated[str, "ISO 8601 datetime e.g. '2026-03-01T10:00:00+05:30'"],
        caller_name:  Annotated[str, "Full name of the caller"],
        caller_phone: Annotated[str, "Phone number"] = "",
        notes:        Annotated[str, "Include email here"] = "",
    ) -> str:
        final_phone = caller_phone or self.caller_phone
        clean_notes = notes.strip().rstrip('.')
        self.booking_intent = {
            "start_time": start_time, "caller_name": caller_name,
            "caller_phone": final_phone, "notes": clean_notes,
        }
        self.caller_name = caller_name
        return (
            f"Got it — I've noted {start_time} for {caller_name}. "
            f"Our team will confirm this with you shortly."
        )

    @llm.function_tool(description="Check if the business is currently open.")
    async def get_business_hours(self) -> str:
        ist = pytz.timezone("Asia/Kolkata")
        now = datetime.now(ist)
        hours = {
            0: ("Monday","10:00","19:00"), 1: ("Tuesday","10:00","19:00"),
            2: ("Wednesday","10:00","19:00"), 3: ("Thursday","10:00","19:00"),
            4: ("Friday","10:00","19:00"), 5: ("Saturday","10:00","17:00"),
            6: ("Sunday", None, None),
        }
        day_name, open_t, close_t = hours[now.weekday()]
        current_time = now.strftime("%H:%M")
        if open_t is None:
            return "We are closed on Sundays."
        if open_t <= current_time <= close_t:
            return f"We are OPEN. Today ({day_name}): {open_t}–{close_t} IST."
        return f"We are CLOSED. Today ({day_name}): {open_t}–{close_t} IST."


class OutboundAssistant(Agent):

    def __init__(self, agent_tools: AgentTools, first_line: str = "", live_config: dict | None = None):
        tools = llm.find_function_tools(agent_tools)
        self._first_line  = first_line
        self._live_config = live_config or {}
        base_instructions = self._live_config.get("agent_instructions", "")
        final_instructions = base_instructions + get_ist_time_context() + get_language_instruction(
            self._live_config.get("lang_preset", "multilingual")
        )
        super().__init__(instructions=final_instructions, tools=tools)

    async def on_enter(self):
        greeting = self._live_config.get("first_line", self._first_line or "Hello! How can I help you today?")
        await self.session.generate_reply(instructions=f"Say exactly: '{greeting}'")


agent_is_speaking = False

async def entrypoint(ctx: JobContext):
    global agent_is_speaking
    await ctx.connect()
    logger.info(f"[ROOM] Connected: {ctx.room.name}")

    phone_number = None
    caller_name  = ""
    tenant_id    = "default"

    metadata = ctx.job.metadata or ""
    if metadata:
        try:
            meta = json.loads(metadata)
            phone_number = meta.get("phone_number") or meta.get("phone")
            tenant_id    = meta.get("tenant_id", "default")
        except Exception:
            pass

    active_identity = "unknown"
    for identity, participant in ctx.room.remote_participants.items():
        active_identity = identity
        if participant.name and participant.name not in ("", "Caller"):
            caller_name = participant.name
        attr = participant.attributes or {}
        phone_number = (phone_number or attr.get("sip.phoneNumber") or attr.get("phoneNumber"))
        if not phone_number and "+" in identity:
            m = re.search(r"\+\d{7,15}", identity)
            if m: phone_number = m.group()

    if not phone_number and ctx.room.name:
        m = re.search(r"\+?\d{10,15}", ctx.room.name)
        if m: phone_number = m.group()

    caller_phone = ''.join(filter(str.isdigit, str(phone_number or "")))
    if not caller_phone:
        caller_phone = "unknown"
    elif phone_number and "+" in str(phone_number):
        caller_phone = f"+{caller_phone}"

    logger.info(f"[CALL-START] Phone: {caller_phone} | Tenant: {tenant_id}")

    if is_rate_limited(caller_phone):
        logger.warning(f"[RATE-LIMIT] Blocked {caller_phone}")
        return

    live_config = get_live_config(caller_phone, tenant_id)

    # Override env vars from config
    for key in ["LIVEKIT_URL","LIVEKIT_API_KEY","LIVEKIT_API_SECRET","OPENAI_API_KEY",
                "SARVAM_API_KEY","TELEGRAM_BOT_TOKEN","SUPABASE_URL","SUPABASE_KEY"]:
        val = live_config.get(key.lower(), "")
        if val:
            os.environ[key] = val

    agent_tools = AgentTools(caller_phone=caller_phone, caller_name=caller_name, tenant_id=tenant_id)
    agent_tools._sip_identity = (
        f"sip_{caller_phone.replace('+', '')}" if caller_phone != "unknown" else "inbound_caller"
    )
    agent_tools.ctx_api   = ctx.api
    agent_tools.room_name = ctx.room.name

    # Build LLM
    llm_provider = live_config.get("llm_provider", "openai")
    llm_model    = live_config.get("llm_model", "gpt-4o-mini")
    if llm_provider == "groq":
        agent_llm = openai.LLM.with_groq(model=llm_model or "llama-3.3-70b-versatile", max_completion_tokens=120)
    elif llm_provider == "claude":
        agent_llm = openai.LLM(model=llm_model or "claude-haiku-3-5-latest",
                                base_url="https://api.anthropic.com/v1/",
                                api_key=os.environ.get("ANTHROPIC_API_KEY",""),
                                max_completion_tokens=120)
    else:
        agent_llm = openai.LLM(model=llm_model, max_completion_tokens=120)

    # Build STT
    stt_provider = live_config.get("stt_provider", "sarvam")
    stt_language = live_config.get("stt_language", "unknown")
    if stt_provider == "deepgram":
        try:
            from livekit.plugins import deepgram
            agent_stt = deepgram.STT(model="nova-2-general", language="multi", interim_results=False)
        except ImportError:
            agent_stt = sarvam.STT(language=stt_language, model="saaras:v3", mode="translate",
                                   flush_signal=True, sample_rate=16000)
    else:
        agent_stt = sarvam.STT(language=stt_language, model="saaras:v3", mode="translate",
                               flush_signal=True, sample_rate=16000)

    # Build TTS
    tts_provider = live_config.get("tts_provider", "sarvam")
    tts_voice    = live_config.get("tts_voice", "kavya")
    tts_language = live_config.get("tts_language", "hi-IN")
    if tts_provider == "elevenlabs":
        try:
            from livekit.plugins import elevenlabs
            agent_tts = elevenlabs.TTS(model="eleven_turbo_v2_5",
                                       voice_id=live_config.get("elevenlabs_voice_id", "21m00Tcm4TlvDq8ikWAM"))
        except ImportError:
            agent_tts = sarvam.TTS(target_language_code=tts_language, model="bulbul:v3",
                                   speaker=tts_voice, speech_sample_rate=24000)
    else:
        agent_tts = sarvam.TTS(target_language_code=tts_language, model="bulbul:v3",
                               speaker=tts_voice, speech_sample_rate=24000)

    agent = OutboundAssistant(agent_tools=agent_tools, first_line=live_config.get("first_line",""), live_config=live_config)

    try:
        from livekit.agents import noise_cancellation as nc
        _noise_cancel = nc.BVC()
    except Exception:
        _noise_cancel = None

    room_input = RoomInputOptions(close_on_disconnect=False)
    if _noise_cancel:
        try:
            room_input = RoomInputOptions(close_on_disconnect=False, noise_cancellation=_noise_cancel)
        except Exception:
            pass

    session = AgentSession(
        stt=agent_stt, llm=agent_llm, tts=agent_tts,
        turn_detection="stt",
        min_endpointing_delay=float(live_config.get("stt_min_endpointing_delay", 0.3)),
        allow_interruptions=True,
    )
    await session.start(room=ctx.room, agent=agent, room_input_options=room_input)

    call_start_time = datetime.now()
    turn_count = 0
    interrupt_count = 0
    max_turns = live_config.get("max_turns", 25)
    egress_id = None

    # Start recording
    try:
        rec_api = api.LiveKitAPI(url=os.environ["LIVEKIT_URL"],
                                  api_key=os.environ["LIVEKIT_API_KEY"],
                                  api_secret=os.environ["LIVEKIT_API_SECRET"])
        egress_resp = await rec_api.egress.start_room_composite_egress(
            api.RoomCompositeEgressRequest(
                room_name=ctx.room.name, audio_only=True,
                file_outputs=[api.EncodedFileOutput(
                    file_type=api.EncodedFileType.OGG,
                    filepath=f"recordings/{ctx.room.name}.ogg",
                    s3=api.S3Upload(
                        access_key=os.environ["SUPABASE_S3_ACCESS_KEY"],
                        secret=os.environ["SUPABASE_S3_SECRET_KEY"],
                        bucket="call-recordings",
                        region=os.environ.get("SUPABASE_S3_REGION", "ap-south-1"),
                        endpoint=os.environ["SUPABASE_S3_ENDPOINT"],
                        force_path_style=True,
                    )
                )]
            )
        )
        egress_id = egress_resp.egress_id
        await rec_api.aclose()
    except Exception as e:
        logger.warning(f"[RECORDING] Failed to start: {e}")

    FILLER_WORDS = {"okay","ok","uh","hmm","yeah","yes","no","um","ah","oh","right","sure","haan","ji","ha"}

    @session.on("agent_speech_started")
    def _agent_speech_started(ev):
        global agent_is_speaking
        agent_is_speaking = True

    @session.on("agent_speech_finished")
    def _agent_speech_finished(ev):
        global agent_is_speaking
        agent_is_speaking = False

    @session.on("agent_speech_interrupted")
    def _on_interrupted(ev):
        nonlocal interrupt_count
        interrupt_count += 1

    @session.on("user_speech_committed")
    def on_user_speech_committed(ev):
        nonlocal turn_count
        global agent_is_speaking
        transcript = ev.user_transcript.strip()
        if agent_is_speaking or not transcript or len(transcript) < 3:
            return
        if transcript.lower().rstrip(".") in FILLER_WORDS:
            return
        turn_count += 1
        if turn_count >= max_turns:
            asyncio.create_task(session.generate_reply(
                instructions="Politely wrap up and say a warm goodbye."
            ))

    async def shutdown_hook(shutdown_ctx: JobContext):
        duration = int((datetime.now() - call_start_time).total_seconds())
        booking_status_msg = "No booking request"

        if agent_tools.booking_intent:
            intent = agent_tools.booking_intent
            notify_booking_request(
                caller_name=intent["caller_name"] or "Unknown", caller_phone=intent["caller_phone"],
                requested_time_iso=intent["start_time"], notes=intent["notes"],
            )
            booking_status_msg = f"Booking Request Captured: {intent['start_time']}"
        else:
            notify_call_no_booking(
                caller_name=agent_tools.caller_name, caller_phone=agent_tools.caller_phone,
                call_summary="Caller did not schedule.", tts_voice=tts_voice, duration_seconds=duration,
            )

        # Build transcript
        transcript_text = ""
        try:
            msgs = agent.chat_ctx.messages
            if callable(msgs): msgs = msgs()
            lines = []
            for msg in msgs:
                if getattr(msg, "role", None) in ("user", "assistant"):
                    content = getattr(msg, "content", "")
                    if isinstance(content, list):
                        content = " ".join(str(c) for c in content if isinstance(c, str))
                    lines.append(f"[{msg.role.upper()}] {content}")
            transcript_text = "\n".join(lines)
        except Exception as e:
            transcript_text = "unavailable"

        # Sentiment
        sentiment = "unknown"
        if transcript_text and transcript_text != "unavailable":
            try:
                import openai as _oai
                _client = _oai.AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
                resp = await _client.chat.completions.create(
                    model="gpt-4o-mini", max_tokens=5,
                    messages=[{"role":"user","content":
                        f"Classify: positive, neutral, negative, or frustrated.\n\n{transcript_text[:800]}"}]
                )
                sentiment = resp.choices[0].message.content.strip().lower()
            except Exception:
                pass

        # Cost
        estimated_cost = round(
            (duration / 60) * 0.002 + (duration / 60) * 0.006 +
            (len(transcript_text) / 1000) * 0.003 + (len(transcript_text) / 4000) * 0.0001, 5
        )

        # Stop recording
        recording_url = ""
        if egress_id:
            try:
                stop_api = api.LiveKitAPI(url=os.environ["LIVEKIT_URL"],
                                          api_key=os.environ["LIVEKIT_API_KEY"],
                                          api_secret=os.environ["LIVEKIT_API_SECRET"])
                await stop_api.egress.stop_egress(api.StopEgressRequest(egress_id=egress_id))
                await stop_api.aclose()
                recording_url = (f"{os.environ.get('SUPABASE_URL','')}/storage/v1/object/public/"
                                 f"call-recordings/recordings/{ctx.room.name}.ogg")
            except Exception as e:
                logger.warning(f"[RECORDING] Stop failed: {e}")

        # n8n webhook
        _n8n_url = os.getenv("N8N_WEBHOOK_URL")
        if _n8n_url:
            try:
                import httpx
                await asyncio.get_event_loop().run_in_executor(None, lambda: httpx.post(_n8n_url, json={
                    "event": "call_completed", "phone": ''.join(filter(str.isdigit, str(caller_phone))),
                    "tenant_id": tenant_id, "caller_name": agent_tools.caller_name,
                    "duration": duration, "booked": bool(agent_tools.booking_intent),
                    "sentiment": sentiment, "summary": booking_status_msg,
                    "recording_url": recording_url,
                }, timeout=5.0))
            except Exception:
                pass

        ist = pytz.timezone("Asia/Kolkata")
        call_dt = call_start_time.astimezone(ist)

        db.save_call_log(
            phone=''.join(filter(str.isdigit, str(caller_phone))),
            duration=duration,
            transcript=transcript_text,
            summary=booking_status_msg,
            recording_url=recording_url,
            caller_name=agent_tools.caller_name or "",
            sentiment=sentiment,
            estimated_cost_usd=estimated_cost,
            call_date=call_dt.date().isoformat(),
            call_hour=call_dt.hour,
            call_day_of_week=call_dt.strftime("%A"),
            was_booked=bool(agent_tools.booking_intent),
            interrupt_count=interrupt_count,
            tenant_id=tenant_id,
        )

    ctx.add_shutdown_callback(shutdown_hook)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="outbound-caller"))
