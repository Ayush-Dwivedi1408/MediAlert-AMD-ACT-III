"""
Smart Health Card — QR Code Generator
Encodes critical patient data into a QR code.
In emergency: scan QR → get blood group, allergies, medications, emergency contact.
"""

import json
import base64
from io import BytesIO

try:
    import qrcode
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False


def generate_health_card_data(patient: dict) -> dict:
    """
    Build the full health card payload -- shown on the patient's own screen.
    This is more detailed than the QR payload (see generate_qr_payload below).
    """
    return {
        "id": patient.get("id"),
        "name": patient.get("name"),
        "age": patient.get("age"),
        "gender": patient.get("gender"),
        "blood_group": patient.get("blood_group", "Unknown"),
        "allergies": patient.get("allergies", "None"),
        "chronic_conditions": patient.get("known_conditions", "None"),
        "current_medications": patient.get("current_medications", "None"),
        "mobile_number": patient.get("mobile_number", ""),
        "date_of_birth": patient.get("date_of_birth", ""),
        "emergency_contact": patient.get("emergency_contact", "Not provided"),
        "emergency_contact_phone": patient.get("emergency_contact_phone", ""),
        # Mental health status is intentionally included here (on-screen, patient-facing)
        # but deliberately EXCLUDED from the QR payload below -- a QR code can be
        # scanned by any bystander or first responder, not just the patient, so a
        # sensitive field like this shouldn't be embedded in a physically scannable code.
        "mental_health_status": patient.get("mental_health_status", ""),
        "mental_health_crisis": patient.get("mental_health_crisis", False),
        "version": "MediAlert-v1",
    }


def generate_qr_payload(patient: dict) -> dict:
    """
    Slimmer payload actually encoded into the scannable QR code.
    Deliberately excludes mental_health_status/crisis -- see note above.
    """
    return {
        "id": patient.get("id"),
        "name": patient.get("name"),
        "age": patient.get("age"),
        "gender": patient.get("gender"),
        "blood_group": patient.get("blood_group", "Unknown"),
        "allergies": patient.get("allergies", "None"),
        "chronic_conditions": patient.get("known_conditions", "None"),
        "current_medications": patient.get("current_medications", "None"),
        "mobile_number": patient.get("mobile_number", ""),
        "date_of_birth": patient.get("date_of_birth", ""),
        "emergency_contact": patient.get("emergency_contact", "Not provided"),
        "emergency_contact_phone": patient.get("emergency_contact_phone", ""),
        "version": "MediAlert-v1",
    }


def generate_qr_base64(data: dict) -> str:
    """
    Generate QR code as base64 PNG string.
    Returns base64 string or empty string if qrcode not installed.
    """
    if not QR_AVAILABLE:
        return ""

    payload = json.dumps(data, ensure_ascii=False)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.read()).decode("utf-8")


def generate_health_card(patient: dict) -> dict:
    """
    Full health card generation.
    Returns full card data (on-screen) + QR code base64 (encodes the slimmer,
    mental-health-excluded payload).
    """
    card_data = generate_health_card_data(patient)
    qr_payload = generate_qr_payload(patient)
    qr_base64 = generate_qr_base64(qr_payload)

    return {
        "card_data": card_data,
        "qr_base64": qr_base64,
        "qr_available": QR_AVAILABLE,
        "instructions": "In emergency: Scan QR code to access patient's critical medical information instantly.",
    }
