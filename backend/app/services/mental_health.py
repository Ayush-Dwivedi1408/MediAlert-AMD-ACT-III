"""
Mental Health Screening Service
Implements PHQ-9 (depression) and GAD-7 (anxiety) — real validated clinical tools.
Published by Pfizer Inc. PHQ-9, Spitzer et al. GAD-7.
"""

PHQ9_QUESTIONS = [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself — or that you are a failure",
    "Trouble concentrating on things",
    "Moving or speaking slowly / being fidgety or restless",
    "Thoughts that you would be better off dead or of hurting yourself",
]

PHQ9_QUESTIONS_HI = [
    "चीजें करने में कम रुचि या आनंद",
    "उदास, निराश या निराशाजनक महसूस करना",
    "सोने में परेशानी या बहुत ज्यादा सोना",
    "थकान या कम ऊर्जा महसूस करना",
    "खराब भूख या ज्यादा खाना",
    "खुद के बारे में बुरा महसूस करना",
    "चीजों पर ध्यान केंद्रित करने में परेशानी",
    "धीरे चलना / बोलना या बेचैन रहना",
    "खुद को नुकसान पहुंचाने के विचार",
]

GAD7_QUESTIONS = [
    "Feeling nervous, anxious, or on edge",
    "Not being able to stop or control worrying",
    "Worrying too much about different things",
    "Trouble relaxing",
    "Being so restless that it's hard to sit still",
    "Becoming easily annoyed or irritable",
    "Feeling afraid as if something awful might happen",
]

GAD7_QUESTIONS_HI = [
    "घबराहट, चिंता या बेचैनी महसूस करना",
    "चिंता को रोकने में असमर्थ",
    "अलग-अलग चीजों के बारे में बहुत ज्यादा चिंता",
    "आराम करने में परेशानी",
    "इतनी बेचैनी कि बैठना मुश्किल हो",
    "आसानी से चिड़चिड़ा हो जाना",
    "कुछ बुरा होने का डर",
]

SCORE_OPTIONS = [
    {"value": 0, "label": "Not at all", "label_hi": "बिल्कुल नहीं"},
    {"value": 1, "label": "Several days", "label_hi": "कुछ दिन"},
    {"value": 2, "label": "More than half the days", "label_hi": "आधे से ज्यादा दिन"},
    {"value": 3, "label": "Nearly every day", "label_hi": "लगभग हर दिन"},
]


def score_phq9(answers: list) -> dict:
    """
    Score PHQ-9 answers (list of 0-3 values).
    Returns severity, recommendations, and crisis flag.
    """
    if len(answers) != 9:
        raise ValueError("PHQ-9 requires exactly 9 answers")

    total = sum(answers)
    crisis_flag = answers[8] > 0  # Question 9: self-harm thoughts

    if total <= 4:
        severity = "None / Minimal"
        severity_hi = "कोई नहीं / न्यूनतम"
        recommendations = ["Maintain healthy lifestyle", "Regular exercise", "Social connection"]
        follow_up = "No"
    elif total <= 9:
        severity = "Mild Depression"
        severity_hi = "हल्का अवसाद"
        recommendations = ["Consider counseling", "Regular physical activity", "Sleep hygiene", "Talk to someone you trust"]
        follow_up = "In 2 weeks"
    elif total <= 14:
        severity = "Moderate Depression"
        severity_hi = "मध्यम अवसाद"
        recommendations = ["Recommend counseling or therapy", "Consider doctor consultation", "Avoid isolation", "Crisis helpline: iCall 9152987821"]
        follow_up = "Within 1 week"
    elif total <= 19:
        severity = "Moderately Severe Depression"
        severity_hi = "मध्यम-गंभीर अवसाद"
        recommendations = ["Strongly recommend professional help", "Consider medication evaluation by psychiatrist", "Crisis helpline: iCall 9152987821", "Vandrevala Foundation: 1860-2662-345"]
        follow_up = "Urgent"
    else:
        severity = "Severe Depression"
        severity_hi = "गंभीर अवसाद"
        recommendations = ["Immediate psychiatric evaluation needed", "Do not leave person alone", "Crisis helpline: iCall 9152987821", "NIMHANS: 080-46110007"]
        follow_up = "Immediate"

    return {
        "screening_type": "PHQ9",
        "total_score": total,
        "severity": severity,
        "severity_hi": severity_hi,
        "recommendations": recommendations,
        "follow_up_recommended": follow_up,
        "crisis_flag": crisis_flag,
        "crisis_message": "⚠️ Question 9 indicates thoughts of self-harm. Please seek immediate help." if crisis_flag else None,
        "sos_recommended": crisis_flag or total >= 15,  # crisis flag OR Moderately Severe/Severe Depression
        "score_breakdown": [{"question": PHQ9_QUESTIONS[i], "score": answers[i]} for i in range(9)],
    }


def score_gad7(answers: list) -> dict:
    """
    Score GAD-7 answers (list of 0-3 values).
    Returns severity and recommendations.
    """
    if len(answers) != 7:
        raise ValueError("GAD-7 requires exactly 7 answers")

    total = sum(answers)

    if total <= 4:
        severity = "Minimal Anxiety"
        severity_hi = "न्यूनतम चिंता"
        recommendations = ["Practice relaxation techniques", "Regular exercise"]
        follow_up = "No"
    elif total <= 9:
        severity = "Mild Anxiety"
        severity_hi = "हल्की चिंता"
        recommendations = ["Try breathing exercises", "Limit caffeine", "Consider mindfulness or meditation"]
        follow_up = "Monitor"
    elif total <= 14:
        severity = "Moderate Anxiety"
        severity_hi = "मध्यम चिंता"
        recommendations = ["Recommend counseling", "Doctor consultation advised", "iCall helpline: 9152987821"]
        follow_up = "Within 1 week"
    else:
        severity = "Severe Anxiety"
        severity_hi = "गंभीर चिंता"
        recommendations = ["Immediate professional evaluation", "Consider medication", "iCall: 9152987821", "Vandrevala: 1860-2662-345"]
        follow_up = "Urgent"

    return {
        "screening_type": "GAD7",
        "total_score": total,
        "severity": severity,
        "severity_hi": severity_hi,
        "recommendations": recommendations,
        "follow_up_recommended": follow_up,
        "crisis_flag": False,  # GAD-7 has no self-harm item
        "crisis_message": None,
        "sos_recommended": total >= 15,  # Severe Anxiety
        "score_breakdown": [{"question": GAD7_QUESTIONS[i], "score": answers[i]} for i in range(7)],
    }


def get_questions(screening_type: str, lang: str = "en") -> list:
    if screening_type == "PHQ9":
        questions = PHQ9_QUESTIONS_HI if lang == "hi" else PHQ9_QUESTIONS
    else:
        questions = GAD7_QUESTIONS_HI if lang == "hi" else GAD7_QUESTIONS
    return [{"index": i, "question": q, "options": SCORE_OPTIONS} for i, q in enumerate(questions)]
