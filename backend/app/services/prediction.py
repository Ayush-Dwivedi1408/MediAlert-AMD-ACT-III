"""
Disease Prediction Service
Hybrid pipeline: structured symptom matching scores the supported disease
candidates first. AMD Token Factory is the preferred LLM provider; Groq is
used as a fallback. Model output is validated against the pre-filtered
candidate set before it is returned to the application.
"""

import os
import re
import json
import httpx
from typing import List, Optional
from dotenv import load_dotenv

from app.data.disease_symptoms import DISEASE_SYMPTOMS
from app.services.symptom_matching import normalize_freetext, score_diseases

load_dotenv()

AMD_API_KEY = os.getenv("AMD_API_KEY", "").strip()
AMD_BASE_URL = os.getenv(
    "AMD_BASE_URL", "https://developer.amd.com.cn/radeon/api/v1"
).strip().rstrip("/")
AMD_MODEL = os.getenv("AMD_MODEL", "DeepSeek-V4-Flash").strip()
AMD_URL = f"{AMD_BASE_URL}/chat/completions"

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

# The official supported-disease list has one source of truth.
CANDIDATE_DISEASES = list(DISEASE_SYMPTOMS.keys())

print(f"AMD configured: {bool(AMD_API_KEY)}")
print(f"Groq fallback configured: {bool(GROQ_API_KEY)}")


async def _groq_request(prompt: str, max_tokens: int = 2000) -> str:
    """Make a request to Groq API and return raw text response."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type":  "application/json",
            },
            json={
                "model":            GROQ_MODEL,
                "messages":         [{"role": "user", "content": prompt}],
                "max_tokens":       max_tokens,
                "temperature":      0.3,
                # gpt-oss models spend part of max_tokens on hidden reasoning
                # before writing the final answer. "low" keeps that reasoning
                # overhead small so short-answer calls (e.g. the health
                # summary) don't get cut off before any content is written.
                "reasoning_effort": "low",
            },
            timeout=30,
        )
        data = response.json()
        print(f"Groq response status: {response.status_code}")

        if response.status_code != 200:
            raise ValueError(f"Groq API error {response.status_code}: {data}")

        choice        = data["choices"][0]
        content       = (choice.get("message", {}).get("content") or "").strip()
        finish_reason = choice.get("finish_reason")

        if not content:
            # Defensive fallback: some gpt-oss responses can put text in a
            # separate "reasoning" field if it never reached a final answer.
            reasoning = (choice.get("message", {}).get("reasoning") or "").strip()
            print(f"⚠️ Empty content, finish_reason={finish_reason}, "
                  f"reasoning_len={len(reasoning)}")
            if reasoning:
                content = reasoning

        if not content:
            raise ValueError("Groq returned an empty response")
        return content


async def _amd_request(prompt: str, max_tokens: int = 2000) -> str:
    """Call AMD Token Factory through its OpenAI-compatible chat endpoint."""
    if not AMD_API_KEY:
        raise ValueError("AMD_API_KEY not configured")

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            AMD_URL,
            headers={
                "Authorization": f"Bearer {AMD_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": AMD_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": 0.3,
                "stream": False,
            },
        )

        if response.status_code != 200:
            # Do not log response bodies; they may contain provider details.
            raise ValueError(f"AMD API returned HTTP {response.status_code}")

        data = response.json()
        choices = data.get("choices") or []
        content = (
            choices[0].get("message", {}).get("content", "")
            if choices else ""
        )
        if not isinstance(content, str) or not content.strip():
            raise ValueError("AMD returned an empty response")
        return content.strip()


async def _llm_request(prompt: str, max_tokens: int = 2000) -> str:
    """Prefer AMD Token Factory; use Groq if AMD is missing or fails."""
    if AMD_API_KEY:
        try:
            content = await _amd_request(prompt, max_tokens=max_tokens)
            print("AI provider: AMD Token Factory")
            return content
        except Exception as exc:
            print(f"AMD request failed; attempting Groq fallback ({type(exc).__name__})")

    if GROQ_API_KEY:
        content = await _groq_request(prompt, max_tokens=max_tokens)
        print("AI provider: Groq fallback")
        return content

    raise RuntimeError("No AI provider is configured or available")


def _no_match_response() -> dict:
    """Deterministic no-match shape — used both when the structured matching
    layer finds zero candidates (Groq isn't even called in that case) and
    as the fallback if Groq itself returns nothing usable from the
    candidates it was given."""
    return {
        "diseases": [],
        "message": ("No supported condition closely matches the symptoms provided. "
                     "Please consult a qualified doctor or healthcare professional for proper evaluation."),
        "first_aid": [],
        "drug_interactions": [],
        "allergy_warnings": [],
        "when_to_hospital": "Please consult a doctor for an in-person evaluation of your symptoms.",
        "health_literacy": {"simple_summary": "", "key_warning_signs": []},
    }


async def predict_diseases(
    symptoms: List[str],
    symptoms_freetext: Optional[str] = None,
    current_disease: Optional[str] = "",
    current_medications: Optional[str] = "",
    allergies: Optional[str] = "",
    age: Optional[int] = None,
    gender: Optional[str] = None,
    vitals_summary: Optional[str] = "",
    # NEW — expanded clinical context (Symptom Assessment module)
    symptom_severity_score: Optional[int] = None,
    symptom_frequency: Optional[str] = None,
    associated_symptoms: Optional[List[str]] = None,
    recent_surgery_hospitalization: Optional[str] = None,
    family_medical_history: Optional[str] = None,
    lifestyle: Optional[dict] = None,
    exposure_history: Optional[dict] = None,
    existing_conditions: Optional[str] = None,
) -> dict:

    if not AMD_API_KEY and not GROQ_API_KEY:
        return _fallback_response("No AI provider is configured.")

    # ── Structured matching layer — runs BEFORE Groq ever sees this request.
    # Combines checkbox-selected symptoms with anything normalized out of the
    # patient's free-text description, then scores all 38 supported diseases
    # by real symptom overlap. This is the actual "source of truth" — Groq
    # below only ranks/narrows/explains whatever this layer already found.
    freetext_symptoms = normalize_freetext(symptoms_freetext)
    candidates = score_diseases(symptoms, freetext_symptoms)

    if not candidates:
        # Deterministic no-match: nothing in the structured data plausibly
        # fits, so there's no need to spend a Groq call finding that out —
        # this also guarantees the no-match case never depends on the LLM
        # correctly following the "return empty" instruction.
        print("ℹ️ No candidate diseases matched structured symptom scoring — skipping Groq call.")
        return _no_match_response()

    symptom_str     = ", ".join([s.replace("_", " ") for s in symptoms])
    patient_context = ""
    if age:            patient_context += f"Patient age: {age}. "
    if gender:         patient_context += f"Gender: {gender}. "
    if vitals_summary: patient_context += f"Vitals: {vitals_summary}. "

    extra_context = []
    if symptom_severity_score is not None:
        extra_context.append(f"Self-reported symptom severity: {symptom_severity_score}/10")
    if symptom_frequency:
        extra_context.append(f"Symptom frequency: {symptom_frequency}")
    if associated_symptoms:
        extra_context.append(f"Associated symptoms: {', '.join(s.replace('_',' ') for s in associated_symptoms)}")
    if recent_surgery_hospitalization:
        extra_context.append(f"Recent surgery/hospitalization: {recent_surgery_hospitalization}")
    if family_medical_history:
        extra_context.append(f"Family medical history: {family_medical_history}")
    if existing_conditions:
        extra_context.append(f"Existing medical conditions (reported at this visit): {existing_conditions}")
    if lifestyle:
        lifestyle_bits = [f"{k.replace('_',' ')}: {v}" for k, v in lifestyle.items() if v]
        if lifestyle_bits:
            extra_context.append("Lifestyle — " + "; ".join(lifestyle_bits))
    if exposure_history:
        exposure_bits = [f"{k.replace('_',' ')}: {v}" for k, v in exposure_history.items() if v]
        if exposure_bits:
            extra_context.append("Exposure history — " + "; ".join(exposure_bits))

    extra_context_str = ("\n" + "\n".join(extra_context)) if extra_context else ""
    freetext_line = f'\nPatient\'s own description (in their words): "{symptoms_freetext}"' if symptoms_freetext else ""

    candidate_lines = []
    for c in candidates:
        line = f"- {c['name']} (symptom overlap: {c['match_score']*100:.0f}%): matched [{', '.join(c['matched_symptoms'])}]"
        if c["missing_symptoms"]:
            line += f", not present [{', '.join(c['missing_symptoms'])}]"
        candidate_lines.append(line)
    candidates_str = "\n".join(candidate_lines)

    prompt = f"""You are an emergency medicine clinical decision support assistant.

Patient context: {patient_context}
Presenting symptoms: {symptom_str}{freetext_line}
Current diagnosed condition: {current_disease or "None"}
Current medications: {current_medications or "None"}
Known allergies: {allergies or "None"}{extra_context_str}

A structured symptom-matching system has already scored the application's official
supported-condition list against these symptoms and identified the following candidates,
based on real symptom overlap:
{candidates_str}

You MUST select "name" values ONLY from the candidates listed above — do not introduce
any other condition, even one from the wider medical literature, even if you believe it
fits better. This is meant to be a BROAD list of conditions worth considering, not a
single best guess — include every candidate that is at least plausibly related to the
patient's symptoms, ranked most-to-least likely, not just the one you find most probable.
Only exclude a candidate if it is clearly inconsistent with the patient's full context
(e.g. contradicted by age, gender, or reported history), and only return an empty
diseases array if NONE of the candidates genuinely fit despite the symptom overlap.

Respond ONLY with valid JSON, no markdown, no explanation, no code fences, just the raw JSON object:

{{
  "diseases": [
    {{
      "name": "Disease Name (must exactly match one of the candidates above)",
      "probability": 78,
      "match_score": 0.78,
      "description": "One sentence clinical description",
      "contributing_symptoms": ["symptom one", "symptom two"],
      "why_predicted": "Plain language explanation of why these symptoms point to this condition"
    }}
  ],
  "message": "",
  "first_aid": [
    {{
      "disease": "Disease Name",
      "immediate_steps": ["Step 1", "Step 2", "Step 3"],
      "what_to_avoid": ["Thing to avoid"],
      "recovery_timeline": "Expected recovery timeline"
    }}
  ],
  "drug_interactions": [],
  "allergy_warnings": [],
  "when_to_hospital": "Clear guidance on when emergency care is needed",
  "health_literacy": {{
    "simple_summary": "Explain in simple language a non-medical person can understand",
    "key_warning_signs": ["Sign to watch for 1", "Sign to watch for 2"]
  }}
}}

Select up to 5 relevant conditions only from the candidates above, ranked most-relevant first.
Do not generate conditions outside the candidate list. If none of the candidates reasonably
match the full patient context, return an empty "diseases" array and set "message" to a short
note recommending the patient consult a doctor. contributing_symptoms must only use symptoms
from the presented list."""

    try:
        raw    = await _llm_request(prompt, max_tokens=2000)
        clean  = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)

        # ── Hard validation — Groq is NEVER the final authority on names.
        # Every returned disease must exactly match a name from the
        # candidate list this specific request was given; anything else is
        # dropped and logged rather than silently reaching the UI.
        valid_names = {c["name"] for c in candidates}
        raw_diseases = result.get("diseases", [])
        validated, rejected = [], []
        for d in raw_diseases:
            name = d.get("name", "")
            if name in valid_names:
                validated.append(d)
            else:
                rejected.append(name)
        if rejected:
            print(f"⚠️ Rejected disease name(s) from Groq not in the candidate list given: {rejected}")

        result["diseases"] = validated[:5]  # hard cap regardless of what Groq returned

        if not result["diseases"] and not result.get("message"):
            result["message"] = _no_match_response()["message"]

        print(f"✅ Prediction successful: {len(result['diseases'])} diseases "
              f"(from {len(candidates)} structured candidates)")
        return result

    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        print(f"❌ Raw response: {raw[:200]}")
        return _fallback_response(f"JSON parse error: {e}")
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return _fallback_response(str(e))



def _fallback_response(reason: str = "") -> dict:
    return {
        "diseases":          [],
        "first_aid":         [],
        "drug_interactions": [],
        "allergy_warnings":  [],
        "when_to_hospital":  "AI prediction unavailable. Please consult a doctor immediately.",
        "health_literacy":   {
            "simple_summary":    f"Could not generate AI analysis. {reason}",
            "key_warning_signs": [],
        },
    }


# ── Factual-consistency check for AI summaries ───────────────────────────────
# Per the ICMR AI ethics guidance ("Trustworthiness" — results should be
# explainable/traceable, not exaggerated or altered) and the internal medical
# validation audit: an LLM summarizing structured data can still paraphrase a
# number incorrectly (e.g. "SpO2 88%" -> "90%") even when the prompt itself is
# well-grounded. This is a lightweight, NON-BLOCKING sanity check — it does
# not prove the summary is medically accurate, it only catches the narrow,
# common failure mode of a number appearing in the summary that doesn't trace
# back to anything in the source data actually given to the model. Any
# mismatch is logged for developer review rather than silently displayed
# as-is; the summary itself is still returned either way so this never breaks
# the feature, it only adds visibility.
def _extract_numbers(text: str) -> set:
    # Decimal group requires at least one digit after the dot (\.\d+)? rather
    # than \.?\d* — otherwise a sentence-ending period gets swallowed as if
    # it were part of the number (e.g. "...was 19." read as the number "19.").
    tokens = re.findall(r"\d+(?:\.\d+)?", text or "")
    # Normalize to float so "88" and "88.0" compare equal — source data often
    # stores vitals as floats while the LLM tends to write plain integers.
    return {float(t) for t in tokens}


def _format_num(n: float) -> str:
    return str(int(n)) if n == int(n) else str(n)


def _check_numeric_consistency(summary: str, source_facts_text: str) -> list:
    """Returns the sorted list of numbers present in the generated summary
    but not found anywhere in the structured source facts that were fed to
    the model. An empty list means every number in the summary is traceable
    to source data."""
    summary_nums = _extract_numbers(summary)
    source_nums  = _extract_numbers(source_facts_text)
    unverified   = summary_nums - source_nums
    return [_format_num(n) for n in sorted(unverified)]



async def summarize_health_record(
    visits: list,
    patient_name: str,
    patient_data: dict = None,
    followups_by_visit: dict = None,  # {visit_id: [followup_dicts]}
    mental_health_screenings: list = None,  # list of screening dicts, most recent first
) -> str:
    """Generate AI health summary including follow-up visits AND mental health screenings."""

    if not AMD_API_KEY and not GROQ_API_KEY:
        return "AI summary unavailable — no AI provider configured."
    if not visits and not mental_health_screenings:
        return "No visit history available to summarise."

    def _get(obj, *keys):
        for k in keys:
            val = getattr(obj, k, None) if not isinstance(obj, dict) else obj.get(k)
            if val is not None:
                return val
        return None

    visit_lines = []
    for i, v in enumerate(visits[-5:], 1):
        symptoms = _get(v, "symptoms") or []
        sym_str  = ", ".join(s.replace("_", " ") for s in symptoms) if isinstance(symptoms, list) else str(symptoms)
        diseases = []
        preds = _get(v, "predicted_diseases")
        if isinstance(preds, list):
            diseases = [d.get("name", "") if isinstance(d, dict) else str(d) for d in preds]

        line = (
            f"Visit {i} ({_get(v, 'visit_date', 'created_at') or 'Unknown'}): "
            f"Risk {_get(v, 'risk_score')}/100, Triage {_get(v, 'triage_level')}, "
            f"Symptoms: {sym_str or 'none'}, "
            f"SpO2 {_get(v, 'spo2')}%, Pulse {_get(v, 'pulse')} bpm, "
            f"Temp {_get(v, 'temperature')}F, BP {_get(v, 'blood_pressure')}, "
            f"RR {_get(v, 'respiratory_rate')}/min, NEWS2 {_get(v, 'news2_score')}, "
            f"Predicted: {', '.join(diseases) or 'none'}"
        )
        visit_lines.append(line)

        # Include follow-ups for this visit
        if followups_by_visit:
            visit_id = _get(v, "id")
            fups = followups_by_visit.get(str(visit_id) if visit_id else None, []) or                    followups_by_visit.get(visit_id, [])
            for j, fu in enumerate(fups, 1):
                fu_symptoms_resolved = fu.get("symptoms_improved", []) or []
                fu_symptoms_new      = fu.get("symptoms_worsened", []) or []
                fu_line = (
                    f"  → Follow-up Day {fu.get('day_number', '?')} "
                    f"({fu.get('followup_date', 'unknown date')}): "
                    f"Status: {fu.get('recovery_status', 'unknown')}, "
                    f"Risk: {fu.get('current_risk_score', '?')}/100, "
                    f"Resolved: {', '.join(fu_symptoms_resolved) or 'none'}, "
                    f"New symptoms: {', '.join(fu_symptoms_new) or 'none'}"
                )
                if fu.get("pulse") or fu.get("spo2"):
                    fu_line += f", Vitals: Pulse {fu.get('pulse', '?')} bpm, SpO2 {fu.get('spo2', '?')}%, Temp {fu.get('temperature', '?')}F"
                if fu.get("notes"):
                    fu_line += f", Notes: {fu['notes']}"
                visit_lines.append(fu_line)

    pat_ctx = ""
    if patient_data:
        pat_ctx = (
            f"Blood group: {patient_data.get('blood_group') or 'Unknown'}. "
            f"Allergies: {patient_data.get('allergies') or 'None'}. "
            f"Conditions: {patient_data.get('known_conditions') or 'None'}. "
            f"Medications: {patient_data.get('current_medications') or 'None'}."
        )

    total_followups = sum(
        len(v) for v in (followups_by_visit or {}).values()
    )

    # ── Mental health screenings ─────────────────────────────────────────────
    mh_lines = []
    mh_crisis_present = False
    if mental_health_screenings:
        for mh in mental_health_screenings[:5]:
            label = "Depression (PHQ-9)" if mh.get("screening_type") == "PHQ9" else "Anxiety (GAD-7)"
            date_str = mh.get("screened_at") or "unknown date"
            line = f"{label} screening ({date_str}): Score {mh.get('total_score')}, Severity: {mh.get('severity')}"
            if mh.get("crisis_flag"):
                line += " -- CRISIS FLAG RAISED (self-harm indicator)"
                mh_crisis_present = True
            mh_lines.append(line)

    mh_section = ""
    if mh_lines:
        mh_section = f"\n\nMental health screening history ({len(mh_lines)} entries):\n{chr(10).join(mh_lines)}"

    # The structured facts actually given to the model — used both to build
    # the prompt below AND as the source-of-truth for the post-generation
    # numeric consistency check, so the check always compares against
    # exactly what the model saw, nothing more or less.
    source_facts_text = (
        pat_ctx + "\n" +
        (chr(10).join(visit_lines) if visit_lines else "") +
        mh_section
    )

    prompt = f"""You are a clinical AI assistant. Write a comprehensive health summary for a patient covering BOTH physical and mental health.

Patient: the patient described in the following records (name omitted)
{pat_ctx}

Complete physical medical history ({len(visit_lines)} entries including {len(visits)} visit(s) and {total_followups} follow-up check-in(s)):
{chr(10).join(visit_lines) if visit_lines else "No physical visits recorded."}
{mh_section}

Write a 5-7 sentence plain-language health summary that:
1. Identifies the overall PHYSICAL health trend across visits AND follow-up check-ins (improving, stable, or worsening) -- skip this if there is no physical visit history
2. Highlights the most concerning symptoms or vitals from ALL visits including follow-ups
3. Notes patterns such as recurring symptoms, rising/falling risk score, or check-in trends
4. Mentions any resolved symptoms from follow-up visits and what new symptoms appeared
5. If mental health screening data is present, summarize the MENTAL HEALTH trend (depression/anxiety severity, whether it is improving or worsening across screenings) as its own point, integrated naturally alongside the physical summary -- do not treat it as a footnote
6. {"Given a crisis flag was raised in the mental health history, gently but clearly note that professional mental health support should be sought without delay" if mh_crisis_present else "Gives one clear, actionable recommendation for the patient or caregiver covering both physical and mental wellbeing"}

Use simple language a patient's family member can understand.
Do NOT use bullet points or headers. Write flowing prose only.
Respond with ONLY the summary text, nothing else."""

    try:
        # Keep the summary token budget sufficient for a concise 5-7 sentence
        # summary. Provider-specific request details are handled by _llm_request.
        text = await _llm_request(prompt, max_tokens=1200)
        if text:
            unverified_numbers = _check_numeric_consistency(text, source_facts_text)
            if unverified_numbers:
                print(f"⚠️ AI summary contains number(s) not traceable to source data — "
                      f"review for accuracy: {unverified_numbers}")
            else:
                print("✅ AI summary numeric consistency check passed — "
                      "every number in the summary traces back to source data")
            print("✅ AI summary with follow-ups generated successfully")
            return text
        return "Summary could not be generated — empty response."
    except Exception as e:
        print(f"AI summary generation failed ({type(e).__name__})")
        return "AI summary unavailable. Please try again later or consult a healthcare professional."

