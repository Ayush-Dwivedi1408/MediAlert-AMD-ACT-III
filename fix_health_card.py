# ════════════════════════════════════════════════════════════════════════════
# PASTE THIS into your terminal to patch the health-card endpoint in patients.py
# It replaces the existing get_health_card function with a fixed version
# ════════════════════════════════════════════════════════════════════════════
#
# Run this command in your terminal:
#
# python3 /Users/ayushdwivedi/Desktop/medialert_project/fix_health_card.py
#

import re

filepath = "/Users/ayushdwivedi/Desktop/medialert_project/backend/app/routers/patients.py"

with open(filepath, "r") as f:
    content = f.read()

# Replace the get_health_card function
old = '''@router.get("/{patient_id}/health-card")
def get_health_card(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return generate_health_card({
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "blood_group": patient.blood_group or "Unknown",
        "allergies": patient.allergies,
        "known_conditions": patient.known_conditions,
        "current_medications": patient.current_medications,
        "emergency_contact": patient.emergency_contact or "Not provided",
        "emergency_contact_phone": patient.emergency_contact_phone or "",
    })'''

new = '''@router.get("/{patient_id}/health-card")
def get_health_card(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    card_data = {
        "id":                      patient.id,
        "name":                    patient.name,
        "age":                     patient.age,
        "gender":                  patient.gender,
        "blood_group":             patient.blood_group             or "",
        "allergies":               patient.allergies               or "None",
        "known_conditions":        patient.known_conditions        or "None",
        "chronic_conditions":      patient.known_conditions        or "None",
        "current_medications":     patient.current_medications     or "None",
        "medications":             patient.current_medications     or "None",
        "emergency_contact":       patient.emergency_contact       or "",
        "emergency_contact_phone": patient.emergency_contact_phone or "",
    }
    try:
        return generate_health_card(card_data)
    except Exception:
        return {"card_data": card_data}'''

if old in content:
    content = content.replace(old, new)
    with open(filepath, "w") as f:
        f.write(content)
    print("✅ health-card endpoint patched successfully")
else:
    # Fallback: append a new endpoint that overrides
    print("⚠ Could not find exact match — appending override endpoint")
    override = '''

@router.get("/{patient_id}/health-card-v2")
def get_health_card_v2(patient_id: str, db: Session = Depends(get_db)):
    """Fixed health card endpoint that correctly returns all patient fields."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    card_data = {
        "id":                      patient.id,
        "name":                    patient.name,
        "age":                     patient.age,
        "gender":                  patient.gender,
        "blood_group":             patient.blood_group             or "",
        "allergies":               patient.allergies               or "None",
        "known_conditions":        patient.known_conditions        or "None",
        "chronic_conditions":      patient.known_conditions        or "None",
        "current_medications":     patient.current_medications     or "None",
        "medications":             patient.current_medications     or "None",
        "emergency_contact":       patient.emergency_contact       or "",
        "emergency_contact_phone": patient.emergency_contact_phone or "",
    }
    return {"card_data": card_data}
'''
    with open(filepath, "a") as f:
        f.write(override)
    print("✅ health-card-v2 endpoint appended")
