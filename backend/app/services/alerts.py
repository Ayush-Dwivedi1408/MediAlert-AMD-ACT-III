"""
Real-Time Alert Generation Service
Fires alerts when vitals cross dangerous thresholds.
Stores them in DB. Shows unread count in dashboard.
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.alert import Alert

ALERT_RULES = [
    {
        "type": "SPO2_CRITICAL",
        "vital": "spo2",
        "condition": lambda v: v < 90,
        "severity": "CRITICAL",
        "title": "🚨 Critical: Oxygen Level Dangerously Low",
        "message": "SpO2 is {value}% — below 90% is life-threatening. Seek emergency care immediately.",
        "threshold": 90,
    },
    {
        "type": "SPO2_LOW",
        "vital": "spo2",
        "condition": lambda v: 90 <= v < 94,
        "severity": "HIGH",
        "title": "⚠️ Warning: Low Oxygen Level",
        "message": "SpO2 is {value}% — below normal range. Visit emergency room now.",
        "threshold": 94,
    },
    {
        "type": "PULSE_CRITICAL_HIGH",
        "vital": "pulse",
        "condition": lambda v: v > 130,
        "severity": "CRITICAL",
        "title": "🚨 Critical: Heart Rate Dangerously High",
        "message": "Pulse is {value} bpm — dangerously high. Call ambulance immediately.",
        "threshold": 130,
    },
    {
        "type": "PULSE_CRITICAL_LOW",
        "vital": "pulse",
        "condition": lambda v: v < 40,
        "severity": "CRITICAL",
        "title": "🚨 Critical: Heart Rate Dangerously Low",
        "message": "Pulse is {value} bpm — dangerously low. Call ambulance immediately.",
        "threshold": 40,
    },
    {
        "type": "PULSE_HIGH",
        "vital": "pulse",
        "condition": lambda v: 110 <= v <= 130,
        "severity": "HIGH",
        "title": "⚠️ Warning: Elevated Heart Rate",
        "message": "Pulse is {value} bpm — elevated. Visit emergency room.",
        "threshold": 110,
    },
    {
        "type": "TEMP_CRITICAL",
        "vital": "temperature",
        "condition": lambda v: v >= 104,
        "severity": "CRITICAL",
        "title": "🚨 Critical: Dangerously High Fever",
        "message": "Temperature is {value}°F — dangerously high. Seek emergency care immediately.",
        "threshold": 104,
    },
    {
        "type": "TEMP_HIGH",
        "vital": "temperature",
        "condition": lambda v: 102 <= v < 104,
        "severity": "HIGH",
        "title": "⚠️ Warning: High Fever",
        "message": "Temperature is {value}°F — high fever. Visit doctor urgently.",
        "threshold": 102,
    },
    {
        "type": "RR_CRITICAL",
        "vital": "respiratory_rate",
        "condition": lambda v: v > 25 or v < 8,
        "severity": "CRITICAL",
        "title": "🚨 Critical: Abnormal Breathing Rate",
        "message": "Respiratory rate is {value}/min — critically abnormal. Emergency care needed.",
        "threshold": 25,
    },
]


def generate_alerts(
    db: Session,
    patient_id: str,
    visit_id: int,
    spo2: Optional[float] = None,
    pulse: Optional[float] = None,
    temperature: Optional[float] = None,
    respiratory_rate: Optional[float] = None,
) -> List[Alert]:
    """
    Check all vitals against alert rules.
    Create and store any triggered alerts.
    Returns list of created alerts.
    """
    vitals = {
        "spo2": spo2,
        "pulse": pulse,
        "temperature": temperature,
        "respiratory_rate": respiratory_rate,
    }

    created_alerts = []

    for rule in ALERT_RULES:
        vital_value = vitals.get(rule["vital"])
        if vital_value is None:
            continue
        if rule["condition"](vital_value):
            alert = Alert(
                patient_id=patient_id,
                visit_id=visit_id,
                alert_type=rule["type"],
                severity=rule["severity"],
                title=rule["title"],
                message=rule["message"].format(value=round(vital_value, 1)),
                value=vital_value,
                threshold=rule["threshold"],
            )
            db.add(alert)
            created_alerts.append(alert)

    if created_alerts:
        db.commit()
        for a in created_alerts:
            db.refresh(a)

    return created_alerts


def get_unread_count(db: Session, patient_id: str) -> int:
    return db.query(Alert).filter(
        Alert.patient_id == patient_id,
        Alert.is_read == False
    ).count()


def mark_all_read(db: Session, patient_id: str):
    db.query(Alert).filter(
        Alert.patient_id == patient_id,
        Alert.is_read == False
    ).update({"is_read": True})
    db.commit()


def get_patient_alerts(db: Session, patient_id: str, unread_only: bool = False) -> List[Alert]:
    q = db.query(Alert).filter(Alert.patient_id == patient_id)
    if unread_only:
        q = q.filter(Alert.is_read == False)
    return q.order_by(Alert.created_at.desc()).all()
