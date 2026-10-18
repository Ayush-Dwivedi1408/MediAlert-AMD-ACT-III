from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.mental_health import MentalHealthScreening
from app.services.mental_health import score_phq9, score_gad7, get_questions
from pydantic import BaseModel
from typing import List

router = APIRouter()

ALL_SYMPTOMS = [
    "itching","skin_rash","nodal_skin_eruptions","continuous_sneezing","shivering","chills",
    "joint_pain","stomach_pain","acidity","ulcers_on_tongue","muscle_wasting","vomiting",
    "burning_micturition","spotting_urination","fatigue","weight_gain","anxiety",
    "cold_hands_and_feets","mood_swings","weight_loss","restlessness","lethargy",
    "patches_in_throat","irregular_sugar_level","cough","high_fever","sunken_eyes",
    "breathlessness","sweating","dehydration","indigestion","headache","yellowish_skin",
    "dark_urine","nausea","loss_of_appetite","pain_behind_the_eyes","back_pain",
    "constipation","abdominal_pain","diarrhoea","mild_fever","yellow_urine",
    "yellowing_of_eyes","acute_liver_failure","fluid_overload","swelling_of_stomach",
    "swelled_lymph_nodes","malaise","blurred_and_distorted_vision","phlegm",
    "throat_irritation","redness_of_eyes","sinus_pressure","runny_nose","congestion",
    "chest_pain","weakness_in_limbs","fast_heart_rate","pain_during_bowel_movements",
    "pain_in_anal_region","bloody_stool","irritation_in_anus","neck_pain","dizziness",
    "cramps","bruising","obesity","swollen_legs","swollen_blood_vessels",
    "puffy_face_and_eyes","enlarged_thyroid","brittle_nails","swollen_extremeties",
    "excessive_hunger","drying_and_tingling_lips","slurred_speech","knee_pain",
    "hip_joint_pain","muscle_weakness","stiff_neck","swelling_joints","movement_stiffness",
    "spinning_movements","loss_of_balance","unsteadiness","weakness_of_one_body_side",
    "loss_of_smell","bladder_discomfort","foul_smell_of_urine","continuous_feel_of_urine",
    "passage_of_gases","internal_itching","depression","irritability","muscle_pain",
    "altered_sensorium","red_spots_over_body","belly_pain","abnormal_menstruation",
    "dischromic_patches","watering_from_eyes","increased_appetite","polyuria",
    "family_history","mucoid_sputum","rusty_sputum","lack_of_concentration",
    "visual_disturbances","receiving_blood_transfusion","receiving_unsterile_injections",
    "coma","stomach_bleeding","distention_of_abdomen","history_of_alcohol_consumption",
    "blood_in_sputum","prominent_veins_on_calf","palpitations","painful_walking",
    "pus_filled_pimples","blackheads","scurring","skin_peeling","silver_like_dusting",
    "small_dents_in_nails","inflammatory_nails","blister","red_sore_around_nose",
    "yellow_crust_ooze","breathlessness","chest_pain","high_fever","low_spo2",
    "altered_consciousness","stiff_neck","severe_headache",
]

SYMPTOM_GROUPS = {
    "general": ["fatigue","high_fever","mild_fever","chills","shivering","sweating","weight_loss","weight_gain","malaise","lethargy","loss_of_appetite","dehydration","anxiety","mood_swings","restlessness","depression","irritability"],
    "risk_factors": ["obesity","family_history"],
    "respiratory": ["cough","breathlessness","phlegm","throat_irritation","runny_nose","congestion","sinus_pressure","blood_in_sputum","mucoid_sputum","rusty_sputum","continuous_sneezing"],
    "digestive": ["nausea","vomiting","diarrhoea","constipation","abdominal_pain","stomach_pain","indigestion","acidity","loss_of_appetite","belly_pain","stomach_bleeding","distention_of_abdomen","passage_of_gases","bloody_stool","pain_during_bowel_movements"],
    "cardiac": ["chest_pain","fast_heart_rate","palpitations","swollen_blood_vessels","prominent_veins_on_calf"],
    "neurological": ["headache","dizziness","altered_sensorium","lack_of_concentration","visual_disturbances","blurred_and_distorted_vision","slurred_speech","loss_of_balance","unsteadiness","spinning_movements","weakness_of_one_body_side","stiff_neck","loss_of_smell","coma","depression"],
    "musculoskeletal": ["joint_pain","muscle_pain","muscle_weakness","muscle_wasting","knee_pain","hip_joint_pain","neck_pain","back_pain","cramps","movement_stiffness","swelling_joints","painful_walking","weakness_in_limbs"],
    "skin": ["itching","skin_rash","nodal_skin_eruptions","yellowish_skin","redness_of_eyes","red_spots_over_body","blister","pus_filled_pimples","blackheads","skin_peeling","silver_like_dusting","small_dents_in_nails","inflammatory_nails","yellow_crust_ooze","bruising","dischromic_patches","patches_in_throat","ulcers_on_tongue"],
    "urinary": ["burning_micturition","spotting_urination","bladder_discomfort","foul_smell_of_urine","continuous_feel_of_urine","yellow_urine","dark_urine","polyuria"],
}


@router.get("/list")
def get_symptoms():
    return {"symptoms": sorted(list(set(ALL_SYMPTOMS))), "groups": SYMPTOM_GROUPS}


@router.get("/groups")
def get_symptom_groups():
    return {"groups": SYMPTOM_GROUPS}


class ScreeningSubmit(BaseModel):
    patient_id: str
    screening_type: str  # PHQ9 or GAD7
    answers: List[int]


@router.post("/mental-health/screen")
def submit_screening(data: ScreeningSubmit, db: Session = Depends(get_db)):
    if data.screening_type == "PHQ9":
        result = score_phq9(data.answers)
    elif data.screening_type == "GAD7":
        result = score_gad7(data.answers)
    else:
        return {"error": "Unknown screening type"}

    screening = MentalHealthScreening(
        patient_id=data.patient_id,
        screening_type=data.screening_type,
        answers=data.answers,
        total_score=result["total_score"],
        severity=result["severity"],
        recommendations=result["recommendations"],
        follow_up_recommended=result["follow_up_recommended"],
        crisis_flag=1 if result.get("crisis_flag") else 0,
        crisis_message=result.get("crisis_message"),
    )
    db.add(screening)
    db.commit()
    return result


@router.get("/mental-health/latest/{patient_id}")
def get_latest_screening(patient_id: str, db: Session = Depends(get_db)):
    """Compact latest-screening status -- used by the Health Card (no raw answers exposed)."""
    latest = (
        db.query(MentalHealthScreening)
        .filter(MentalHealthScreening.patient_id == patient_id)
        .order_by(MentalHealthScreening.screened_at.desc())
        .first()
    )
    if not latest:
        return {"has_screening": False}
    return {
        "has_screening": True,
        "screening_type": latest.screening_type,
        "severity": latest.severity,
        "screened_at": latest.screened_at.isoformat() if latest.screened_at else None,
        "crisis_flag": bool(latest.crisis_flag),
    }


@router.get("/mental-health/questions/{screening_type}")
def get_screening_questions(screening_type: str, lang: str = "en"):
    return {"questions": get_questions(screening_type, lang)}


@router.get("/mental-health/history/{patient_id}")
def get_screening_history(patient_id: str, db: Session = Depends(get_db)):
    screenings = db.query(MentalHealthScreening).filter(
        MentalHealthScreening.patient_id == patient_id
    ).order_by(MentalHealthScreening.screened_at.desc()).all()
    return {"screenings": screenings}
