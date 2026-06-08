"""
make_call.py — CLI utility to dispatch an outbound call.
Usage: python make_call.py --to +919988776655 [--tenant default]
"""
import argparse
import asyncio
import json
import os
import random
from dotenv import load_dotenv
from livekit import api

load_dotenv()


async def main():
    parser = argparse.ArgumentParser(description="Dispatch an outbound AI call.")
    parser.add_argument("--to", required=True, help="Phone number with country code e.g. +91...")
    parser.add_argument("--tenant", default="default", help="Tenant ID")
    args = parser.parse_args()

    phone = args.to.strip()
    if not phone.startswith("+"):
        print("Error: Phone must start with '+' and include country code.")
        return

    url    = os.getenv("LIVEKIT_URL")
    key    = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    if not (url and key and secret):
        print("Error: LiveKit credentials missing.")
        return

    lk = api.LiveKitAPI(url=url, api_key=key, api_secret=secret)
    room_name = f"call-{phone.replace('+', '')}-{random.randint(1000, 9999)}"

    print(f"Dispatching call to {phone}...")
    print(f"Room: {room_name}")

    try:
        dispatch = await lk.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="outbound-caller",
                room=room_name,
                metadata=json.dumps({"phone_number": phone, "tenant_id": args.tenant}),
            )
        )
        print(f"\n✅ Call Dispatched!")
        print(f"Dispatch ID: {dispatch.id}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
