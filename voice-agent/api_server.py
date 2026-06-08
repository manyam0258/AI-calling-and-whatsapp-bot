"""
api_server.py — FastAPI REST API for the Voice Agent microservice.

This server is called by the Next.js frontend via /api/voice/* proxy routes.
All endpoints require a valid X-API-Key header (VOICE_AGENT_API_KEY env var).

Endpoints:
  POST  /voice/calls/dispatch     — trigger an outbound call
  GET   /voice/calls              — list call logs (paginated)
  GET   /voice/calls/active       — active calls status
  GET   /voice/calls/{id}         — call detail + transcript
  GET   /voice/analytics          — aggregated stats
  GET   /voice/config             — read agent config
  PUT   /voice/config             — update agent config
  GET   /voice/health             — liveness check
"""

import asyncio
import json
import logging
import os
import random
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api-server")

app = FastAPI(title="Voice Agent API", version="1.0.0")

# ── CORS (Next.js dev on :3000, prod on same origin) ─────────────────────────
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────
API_KEY = os.getenv("VOICE_AGENT_API_KEY", "")

def require_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    if not API_KEY or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ── Config helpers ────────────────────────────────────────────────────────────
CONFIG_FILE = "config.json"
CONFIGS_DIR = "configs"

def read_config(tenant_id: str = "default") -> dict:
    path = f"{CONFIGS_DIR}/{tenant_id}.json"
    if not os.path.exists(path):
        path = f"{CONFIGS_DIR}/default.json"
    if not os.path.exists(path):
        path = CONFIG_FILE
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}

def write_config(data: dict, tenant_id: str = "default"):
    os.makedirs(CONFIGS_DIR, exist_ok=True)
    path = f"{CONFIGS_DIR}/{tenant_id}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ── Models ────────────────────────────────────────────────────────────────────

class DispatchCallRequest(BaseModel):
    phone_number: str
    tenant_id: Optional[str] = "default"
    metadata: Optional[dict] = {}

class ConfigUpdateRequest(BaseModel):
    config: dict
    tenant_id: Optional[str] = "default"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/voice/health")
def health():
    return {"status": "ok"}


@app.post("/voice/calls/dispatch")
async def dispatch_call(
    body: DispatchCallRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    require_api_key(x_api_key)

    phone = body.phone_number.strip()
    if not phone.startswith("+"):
        raise HTTPException(400, "Phone number must include country code, e.g. +91...")

    lk_url    = os.getenv("LIVEKIT_URL")
    lk_key    = os.getenv("LIVEKIT_API_KEY")
    lk_secret = os.getenv("LIVEKIT_API_SECRET")
    if not (lk_url and lk_key and lk_secret):
        raise HTTPException(500, "LiveKit credentials not configured")

    try:
        from livekit import api as lkapi
        lk = lkapi.LiveKitAPI(url=lk_url, api_key=lk_key, api_secret=lk_secret)
        room_name = f"call-{phone.replace('+', '')}-{random.randint(1000, 9999)}"
        meta = json.dumps({
            "phone_number": phone,
            "tenant_id": body.tenant_id,
            **(body.metadata or {}),
        })
        dispatch = await lk.agent_dispatch.create_dispatch(
            lkapi.CreateAgentDispatchRequest(
                agent_name="outbound-caller",
                room=room_name,
                metadata=meta,
            )
        )
        await lk.aclose()
        logger.info(f"[DISPATCH] {phone} → room {room_name}, dispatch {dispatch.id}")
        return {"success": True, "dispatch_id": dispatch.id, "room_name": room_name}
    except Exception as e:
        logger.error(f"[DISPATCH] Failed: {e}")
        raise HTTPException(500, str(e))


@app.get("/voice/calls")
def list_calls(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: Optional[str] = Query(None),
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    require_api_key(x_api_key)
    try:
        sb = db.get_supabase()
        if not sb:
            return {"calls": [], "total": 0}
        q = sb.table("call_logs").select("*", count="exact").order("created_at", desc=True)
        if tenant_id:
            q = q.eq("tenant_id", tenant_id)
        result = q.range(offset, offset + limit - 1).execute()
        return {"calls": result.data, "total": result.count}
    except Exception as e:
        logger.error(f"[CALLS] {e}")
        raise HTTPException(500, str(e))


@app.get("/voice/calls/active")
def active_calls(
    tenant_id: Optional[str] = Query(None),
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    require_api_key(x_api_key)
    try:
        sb = db.get_supabase()
        if not sb:
            return {"active_calls": []}
        q = sb.table("active_calls").select("*").eq("status", "active")
        if tenant_id:
            q = q.eq("tenant_id", tenant_id)
        result = q.execute()
        return {"active_calls": result.data}
    except Exception as e:
        logger.error(f"[ACTIVE] {e}")
        raise HTTPException(500, str(e))


@app.get("/voice/calls/{call_id}")
def get_call(
    call_id: str,
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    require_api_key(x_api_key)
    try:
        sb = db.get_supabase()
        if not sb:
            raise HTTPException(503, "Database not configured")
        result = sb.table("call_logs").select("*").eq("id", call_id).single().execute()
        if not result.data:
            raise HTTPException(404, "Call not found")
        # Also pull transcript lines
        transcripts = (
            sb.table("call_transcripts")
            .select("role, content, created_at")
            .eq("call_room_id", result.data.get("room_id", ""))
            .order("created_at")
            .execute()
        )
        return {**result.data, "transcript_lines": transcripts.data or []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CALL-DETAIL] {e}")
        raise HTTPException(500, str(e))


@app.get("/voice/analytics")
def analytics(
    tenant_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    require_api_key(x_api_key)
    try:
        sb = db.get_supabase()
        if not sb:
            return {"error": "Database not configured"}

        q = sb.table("call_logs").select(
            "duration_seconds, was_booked, sentiment, estimated_cost_usd, call_date, call_hour, call_day_of_week, created_at"
        )
        if tenant_id:
            q = q.eq("tenant_id", tenant_id)
        rows = q.order("created_at", desc=True).limit(1000).execute().data or []

        total = len(rows)
        booked = sum(1 for r in rows if r.get("was_booked"))
        durations = [r["duration_seconds"] for r in rows if r.get("duration_seconds")]
        avg_dur = round(sum(durations) / len(durations)) if durations else 0
        total_cost = round(sum(r.get("estimated_cost_usd") or 0 for r in rows), 4)

        sentiments: dict = {}
        for r in rows:
            s = r.get("sentiment", "unknown") or "unknown"
            sentiments[s] = sentiments.get(s, 0) + 1

        # Calls per day (last 30 days)
        calls_by_date: dict = {}
        for r in rows:
            d = (r.get("call_date") or r.get("created_at", "")[:10])
            if d:
                calls_by_date[d] = calls_by_date.get(d, 0) + 1

        return {
            "total_calls": total,
            "total_bookings": booked,
            "booking_rate": round((booked / total * 100), 1) if total else 0,
            "avg_duration_seconds": avg_dur,
            "total_cost_usd": total_cost,
            "sentiment_breakdown": sentiments,
            "calls_by_date": calls_by_date,
        }
    except Exception as e:
        logger.error(f"[ANALYTICS] {e}")
        raise HTTPException(500, str(e))


@app.get("/voice/config")
def get_config(
    tenant_id: str = Query("default"),
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    require_api_key(x_api_key)
    config = read_config(tenant_id)
    # Mask secrets in response
    safe = {k: ("***" if any(s in k for s in ["key", "secret", "password", "token"]) else v)
            for k, v in config.items()}
    return {"config": safe, "tenant_id": tenant_id}


@app.put("/voice/config")
def update_config(
    body: ConfigUpdateRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    require_api_key(x_api_key)
    try:
        # Merge with existing (don't overwrite masked fields with ***)
        existing = read_config(body.tenant_id)
        merged = {**existing}
        for k, v in body.config.items():
            if v != "***":  # skip masked placeholders
                merged[k] = v
        write_config(merged, body.tenant_id)
        return {"success": True, "tenant_id": body.tenant_id}
    except Exception as e:
        logger.error(f"[CONFIG-UPDATE] {e}")
        raise HTTPException(500, str(e))


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api_server:app", host="0.0.0.0", port=8001, reload=False)
