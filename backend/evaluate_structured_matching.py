"""
Evaluates the STRUCTURED MATCHING LAYER ONLY (symptom_matching.py) against
TEST_CASES. This does NOT call Groq — no network access to the Groq API is
available in this evaluation environment, so these numbers describe Stage
2/3 of the pipeline (normalization + structured scoring/ranking), not the
full Groq-inclusive system. Groq could still narrow, re-rank, or (per the
"broaden" prompt fix) keep the full candidate set — the numbers here are the
INPUT Groq receives, not necessarily MediAlert's final displayed output.

Metric definitions (explicit, per evaluation brief Part 6):
- Top-1 Accuracy: expected_disease is the #1 ranked candidate / total scored cases
- Top-5 Accuracy: expected_disease appears anywhere in the top 5 candidates / total scored cases
- Precision (per case, then averaged): 1 / len(returned candidates) if expected_disease
  is present in returned candidates, else 0. This is a SINGLE-LABEL precision —
  it treats every OTHER returned candidate as a "miss" even though, clinically,
  several returned diseases can be legitimately relevant differentials, not
  errors. This metric measures retrieval precision against one constructed
  label, NOT clinical correctness — stated explicitly per Part 5's instruction
  to separate rule-matching performance from clinical accuracy.
- Recall (per case): 1 if expected_disease appears anywhere in returned
  candidates, else 0. Averaged across scored cases.
- False Positive (per case): count of returned candidates that are NOT the
  expected_disease (same single-label caveat as Precision above).
- False Negative (per case): 1 if expected_disease was never returned at all.

Only cases with a defined expected_disease (category="strong") are used for
Top-1/Top-5/Precision/Recall — 5 cases. This sample is SMALL. Per Part 6's
own instruction ("do not claim a metric is meaningful if the test dataset is
too small"), these numbers are illustrative/diagnostic, not a statistically
powered claim of system accuracy, and are reported as such.
"""

import sys
sys.path.insert(0, ".")

from app.services.symptom_matching import normalize_freetext, score_diseases
from app.data.test_cases import TEST_CASES


def run_case(case):
    freetext_symptoms = normalize_freetext(case["freetext"])
    candidates = score_diseases(case["selected_symptoms"], freetext_symptoms)
    top5 = candidates[:5]
    return {
        "id": case["id"],
        "category": case["category"],
        "expected": case["expected_disease"],
        "normalized_freetext": freetext_symptoms,
        "candidates": [c["name"] for c in candidates],
        "top5": [c["name"] for c in top5],
        "top5_scores": [(c["name"], c["match_score"]) for c in top5],
    }


def main():
    results = [run_case(c) for c in TEST_CASES]

    print("=" * 78)
    print("FULL PER-CASE RESULTS")
    print("=" * 78)
    for r in results:
        print(f"\n[{r['id']}] category={r['category']} expected={r['expected']}")
        if r["normalized_freetext"]:
            print(f"  Normalized free text -> {r['normalized_freetext']}")
        print(f"  Top 5 candidates -> {r['top5_scores']}")

    # ── Strong-case metrics (the only cases with a single defined expected_disease) ──
    strong = [r for r in results if r["category"] == "strong"]
    n = len(strong)
    top1_hits = sum(1 for r in strong if r["top5"] and r["top5"][0] == r["expected"])
    top5_hits = sum(1 for r in strong if r["expected"] in r["top5"])

    precisions, recalls, fp_counts, fn_count = [], [], [], 0
    for r in strong:
        hit = r["expected"] in r["top5"]
        recalls.append(1 if hit else 0)
        if not hit:
            fn_count += 1
        if r["top5"]:
            precisions.append(1 / len(r["top5"]) if hit else 0)
        else:
            precisions.append(0)
        fp_counts.append(len(r["top5"]) - (1 if hit else 0))

    print("\n" + "=" * 78)
    print(f"STRONG-CASE METRICS (n={n} — SMALL SAMPLE, illustrative only)")
    print("=" * 78)
    print(f"Top-1 Accuracy: {top1_hits}/{n} = {top1_hits/n:.2%}")
    print(f"Top-5 Accuracy: {top5_hits}/{n} = {top5_hits/n:.2%}")
    print(f"Mean Precision (single-label definition): {sum(precisions)/n:.3f}")
    print(f"Mean Recall: {sum(recalls)/n:.3f}")
    print(f"Total False Negatives: {fn_count}")
    print(f"Total False Positives (other candidates returned alongside expected): {sum(fp_counts)}")

    # ── No-match cases ──
    nomatch = [r for r in results if r["category"] == "no_match"]
    print("\n" + "=" * 78)
    print(f"NO-MATCH CASES (n={len(nomatch)})")
    print("=" * 78)
    for r in nomatch:
        status = "✅ correctly empty" if not r["candidates"] else f"⚠️ returned {r['candidates']}"
        print(f"  [{r['id']}] {status}")

    # ── Unsupported-condition cases ──
    unsupported = [r for r in results if r["category"] == "unsupported"]
    print("\n" + "=" * 78)
    print(f"UNSUPPORTED-CONDITION CASES (n={len(unsupported)})")
    print("=" * 78)
    excluded_names = {"heart attack", "aids", "chronic cholestasis"}
    for r in unsupported:
        leaked = [c for c in r["candidates"] if c.lower() in excluded_names]
        status = "✅ no excluded name leaked" if not leaked else f"🔴 LEAKED: {leaked}"
        print(f"  [{r['id']}] candidates={r['candidates']} -> {status}")

    # ── NL variation consistency ──
    print("\n" + "=" * 78)
    print("NATURAL-LANGUAGE VARIATION CONSISTENCY")
    print("=" * 78)
    groups = {}
    for c, r in zip(TEST_CASES, results):
        if c["category"] == "nl_variation":
            groups.setdefault(c["variation_group"], []).append(r)
    for group_name, group_results in groups.items():
        print(f"\n  Group: {group_name}")
        for r in group_results:
            print(f"    [{r['id']}] freetext_normalized -> {r['normalized_freetext']}")
        candidate_sets = [set(r["candidates"]) for r in group_results]
        consistent = all(s == candidate_sets[0] for s in candidate_sets)
        print(f"    -> {'✅ Consistent across phrasing' if consistent else '⚠️ INCONSISTENT across phrasing'}")

    # ── Overlapping cases (descriptive only, no single right answer) ──
    overlap = [r for r in results if r["category"] == "overlapping"]
    print("\n" + "=" * 78)
    print(f"OVERLAPPING CASES (n={len(overlap)}, descriptive — no single expected answer)")
    print("=" * 78)
    for r in overlap:
        print(f"  [{r['id']}] returned {len(r['candidates'])} candidates: {r['top5']}")

    # ── Weak cases ──
    weak = [r for r in results if r["category"] == "weak"]
    print("\n" + "=" * 78)
    print(f"WEAK CASES (n={len(weak)}, descriptive)")
    print("=" * 78)
    for r in weak:
        print(f"  [{r['id']}] returned {len(r['candidates'])} candidates: {r['top5']}")

    print("\n" + "=" * 78)
    print(f"DATASET SUMMARY: {len(TEST_CASES)} total cases across "
          f"{len(set(c['category'] for c in TEST_CASES))} categories")
    print("=" * 78)


if __name__ == "__main__":
    main()
