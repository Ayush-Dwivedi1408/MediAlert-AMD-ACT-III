"""
Emergency Alert Delivery Service
Sends SOS alerts via the WhatsApp Business (Cloud) API, falling back to SMS
if WhatsApp delivery isn't possible. This never uses the patient's own
WhatsApp account — there is no wa.me deep link here. This is a server-side
send through a business messaging account; the patient's own device/app is
never opened or involved.

DEV MODE: no WhatsApp Business API or SMS provider credentials are
configured yet. Both send functions detect that, print a clear "[DEV MODE]"
line to the backend console showing exactly what would have been sent and
to whom, and return success=False with dev_mode=True. This lets the real
request -> WhatsApp attempt -> SMS fallback flow run and be observed
end-to-end right now, without silently faking a success. Set the env vars
below once real credentials are ready and the two "real" branches take
over automatically — nothing else in this file, or in the caller, changes.
"""

import os
import httpx

WHATSAPP_BUSINESS_TOKEN    = os.getenv("WHATSAPP_BUSINESS_TOKEN", "")
WHATSAPP_BUSINESS_PHONE_ID = os.getenv("WHATSAPP_BUSINESS_PHONE_ID", "")
WHATSAPP_API_URL           = "https://graph.facebook.com/v19.0"

SMS_PROVIDER_API_KEY = os.getenv("SMS_PROVIDER_API_KEY", "")
SMS_PROVIDER_FROM    = os.getenv("SMS_PROVIDER_FROM", "")
# Swap this for your chosen provider's real endpoint (Twilio, MSG91, etc.)
SMS_PROVIDER_API_URL = os.getenv("SMS_PROVIDER_API_URL", "")


async def send_whatsapp_business_alert(phone: str, message: str) -> dict:
    """Sends via the Meta WhatsApp Business (Cloud) API — a business
    messaging account, never the patient's own WhatsApp app."""
    if not (WHATSAPP_BUSINESS_TOKEN and WHATSAPP_BUSINESS_PHONE_ID):
        print(f"[DEV MODE] Would send WhatsApp Business alert to {phone}:\n{message}\n")
        return {
            "channel": "whatsapp",
            "success": False,
            "dev_mode": True,
            "detail": "WhatsApp Business API not configured — set WHATSAPP_BUSINESS_TOKEN "
                      "and WHATSAPP_BUSINESS_PHONE_ID in .env to enable real delivery.",
        }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{WHATSAPP_API_URL}/{WHATSAPP_BUSINESS_PHONE_ID}/messages",
                headers={
                    "Authorization": f"Bearer {WHATSAPP_BUSINESS_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": phone,
                    "type": "text",
                    "text": {"body": message},
                },
                timeout=15,
            )
        if resp.status_code == 200:
            return {"channel": "whatsapp", "success": True, "dev_mode": False, "detail": "Sent via WhatsApp Business API"}
        return {
            "channel": "whatsapp", "success": False, "dev_mode": False,
            "detail": f"WhatsApp Business API error {resp.status_code}: {resp.text[:200]}",
        }
    except Exception as e:
        return {"channel": "whatsapp", "success": False, "dev_mode": False, "detail": f"WhatsApp send failed: {e}"}


async def send_sms_alert(phone: str, message: str) -> dict:
    """SMS fallback — swap in a real provider (Twilio, MSG91, etc.) at the
    marked spot once SMS_PROVIDER_* env vars are set."""
    if not (SMS_PROVIDER_API_KEY and SMS_PROVIDER_API_URL):
        print(f"[DEV MODE] Would send SMS alert to {phone}:\n{message}\n")
        return {
            "channel": "sms",
            "success": False,
            "dev_mode": True,
            "detail": "SMS provider not configured — set SMS_PROVIDER_API_KEY, SMS_PROVIDER_FROM, "
                      "and SMS_PROVIDER_API_URL in .env to enable real delivery.",
        }

    try:
        async with httpx.AsyncClient() as client:
            # NOTE: this request body is a placeholder — replace with your
            # chosen SMS provider's actual request format once you pick one.
            resp = await client.post(
                SMS_PROVIDER_API_URL,
                headers={"Authorization": f"Bearer {SMS_PROVIDER_API_KEY}"},
                json={"from": SMS_PROVIDER_FROM, "to": phone, "text": message},
                timeout=15,
            )
        if resp.status_code in (200, 201):
            return {"channel": "sms", "success": True, "dev_mode": False, "detail": "Sent via SMS"}
        return {
            "channel": "sms", "success": False, "dev_mode": False,
            "detail": f"SMS provider error {resp.status_code}: {resp.text[:200]}",
        }
    except Exception as e:
        return {"channel": "sms", "success": False, "dev_mode": False, "detail": f"SMS send failed: {e}"}


async def send_emergency_alert(phone: str, message: str) -> dict:
    """Tries WhatsApp Business API first; falls back to SMS only if the
    WhatsApp attempt didn't succeed. Returns the attempt log for both
    channels so the caller (and, in dev mode, the UI) can show exactly
    what happened at each step."""
    whatsapp_result = await send_whatsapp_business_alert(phone, message)
    if whatsapp_result["success"]:
        return {"delivered_via": "whatsapp", "attempts": [whatsapp_result]}

    sms_result = await send_sms_alert(phone, message)
    return {
        "delivered_via": "sms" if sms_result["success"] else None,
        "attempts": [whatsapp_result, sms_result],
    }
