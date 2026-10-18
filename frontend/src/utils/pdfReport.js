import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generateMedicalReport({ patient, visit, results, severity, news2 }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ── Colour palette ───────────────────────────────────────────────────────
  const C = {
    primary:  [37,  99, 235],
    danger:   [220, 38,  38],
    warning:  [217,119,   6],
    success:  [22, 163,  74],
    purple:   [124, 58, 237],
    dark:     [15,  23,  42],
    grey:     [100,116, 139],
    lightbg:  [240,245, 255],
    white:    [255,255, 255],
  };

  const sevColor =
    severity?.severity === "CRITICAL" ? C.danger  :
    severity?.severity === "HIGH"     ? C.warning :
    severity?.severity === "MEDIUM"   ? [180,100,  0] :
                                        C.success;

  const W      = 210;
  const margin = 14;
  let y        = 0;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const setFont = (size, style = "normal", color = C.dark) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  };
  const fillRect = (x, yr, w, h, color) => {
    doc.setFillColor(...color);
    doc.rect(x, yr, w, h, "F");
  };
  const hline = (yr, color = [220,220,220]) => {
    doc.setDrawColor(...color);
    doc.line(margin, yr, W - margin, yr);
  };
  const sectionHeader = (label, yr) => {
    fillRect(margin, yr - 4, W - margin * 2, 9, C.lightbg);
    setFont(10, "bold", C.primary);
    doc.text(label, margin + 3, yr + 3);
    return yr + 10;
  };
  const kv = (key, val, x, yr, keyW = 42) => {
    setFont(8, "bold",   C.grey);
    doc.text(key + ":", x, yr);
    setFont(8, "normal", C.dark);
    doc.text(String(val != null && val !== "" ? val : "—"), x + keyW, yr);
  };
  const addPageIfNeeded = (needed = 30) => {
    if (y + needed > 278) { doc.addPage(); y = 18; }
  };

  const now      = new Date();
  const reportId = "RPT-" + Math.floor(Math.random() * 900000 + 100000);
  const lv       = visit || {};
  const res      = results || {};
  const pat      = patient || {};
  const riskScore = res.risk_score ?? lv.risk_score ?? 0;
  const isCrit   = riskScore >= 75 || (res.triage_level || lv.triage_level) === "P1";

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 1
  // ════════════════════════════════════════════════════════════════════════

  // ── Header band ──────────────────────────────────────────────────────────
  fillRect(0, 0, W, 34, C.primary);
  setFont(22, "bold", C.white);
  doc.text("MediAlert", margin, 14);
  setFont(9, "normal", [180,210,255]);
  doc.text("Emergency Decision Support Platform", margin, 21);
  doc.text("CONFIDENTIAL MEDICAL REPORT", margin, 27);
  setFont(8, "normal", [180,210,255]);
  doc.text(`Generated: ${now.toLocaleString()}`, W - margin, 21, { align: "right" });
  doc.text(`Report ID: ${reportId}`, W - margin, 27, { align: "right" });
  y = 38;

  // ── Emergency banner ─────────────────────────────────────────────────────
  if (isCrit) {
    fillRect(margin, y, W - margin * 2, 12, C.danger);
    setFont(10, "bold", C.white);
    doc.text("🚨  CRITICAL EMERGENCY — CALL AMBULANCE IMMEDIATELY (102 / 108)", margin + 4, y + 8);
    y += 16;
  } else if (severity) {
    fillRect(margin, y, W - margin * 2, 12, sevColor);
    setFont(9, "bold", C.white);
    doc.text(`${severity.emoji || ""} ${severity.label}   |   Action: ${severity.action}`, margin + 4, y + 8);
    y += 16;
  }

  // ── 1. Patient Information ────────────────────────────────────────────────
  y = sectionHeader("1.  PATIENT INFORMATION", y + 2);
  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ["Patient ID",         pat.id || pat.unique_id || "—",     "Full Name",          pat.name || "—"],
      ["Age",                pat.age ? pat.age + " years" : "—", "Gender",             pat.gender || "—"],
      ["Blood Group",        pat.blood_group || "Unknown",       "Known Allergies",    pat.allergies || "None"],
      ["Known Conditions",   pat.known_conditions || "None",     "Current Medications",pat.current_medications || "None"],
      ["Emergency Contact",  pat.emergency_contact || "—",       "Contact Phone",      pat.emergency_contact_phone || "—"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 42 },
      1: { cellWidth: 58 },
      2: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 42 },
      3: { cellWidth: 48 },
    },
    styles:  { fontSize: 8.5, cellPadding: 3.5 },
    theme:   "grid",
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── 2. Visit Details & Vitals ─────────────────────────────────────────────
  addPageIfNeeded(55);
  y = sectionHeader("2.  VISIT DETAILS & VITAL SIGNS", y);
  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ["Visit Date",  lv.visit_date ? new Date(lv.visit_date).toLocaleString() : now.toLocaleString(), "Triage Level", res.triage_level || lv.triage_level || "—"],
      ["Risk Score",  riskScore ? Math.round(riskScore) + " / 100" : "—",                             "NEWS2 Score",  news2?.score != null ? `${news2.score} / 20  (${news2.risk || ""})` : (lv.news2_score ? lv.news2_score + " / 20" : "—")],
      ["Pulse",       lv.pulse ? lv.pulse + " bpm" : "—",                                             "SpO2",         lv.spo2 ? lv.spo2 + "%" : "—"],
      ["Temperature", lv.temperature ? lv.temperature + " °F" : "—",                                  "Blood Pressure",lv.blood_pressure || "—"],
      ["Resp. Rate",  lv.respiratory_rate ? lv.respiratory_rate + " / min" : "—",                     "Risk Engine",  "MediAlert AI v2.0"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 42 },
      1: { cellWidth: 58 },
      2: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 42 },
      3: { cellWidth: 48 },
    },
    styles:  { fontSize: 8.5, cellPadding: 3.5 },
    theme:   "grid",
  });
  y = doc.lastAutoTable.finalY + 4;

  // Vital flags
  const vitalFlags = [];
  if (lv.spo2   != null && lv.spo2 < 90)                          vitalFlags.push(`⚠ SpO2 ${lv.spo2}% — critically low (normal ≥95%)`);
  if (lv.pulse  != null && (lv.pulse < 50 || lv.pulse > 120))     vitalFlags.push(`⚠ Pulse ${lv.pulse} bpm — outside normal range (50–100)`);
  if (lv.temperature != null && lv.temperature < 95)              vitalFlags.push(`⚠ Temperature ${lv.temperature}°F — hypothermia threshold (<95°F)`);
  if (lv.respiratory_rate != null && lv.respiratory_rate < 8)     vitalFlags.push(`⚠ Respiratory rate ${lv.respiratory_rate}/min — critically low (<8)`);

  if (vitalFlags.length > 0) {
    fillRect(margin, y, W - margin * 2, vitalFlags.length * 5 + 8, [255,245,245]);
    doc.setDrawColor(...C.danger);
    doc.rect(margin, y, W - margin * 2, vitalFlags.length * 5 + 8);
    setFont(8, "bold", C.danger);
    doc.text("ABNORMAL VITAL SIGNS:", margin + 3, y + 5);
    vitalFlags.forEach((flag, i) => {
      setFont(7.5, "normal", C.danger);
      doc.text(flag, margin + 5, y + 10 + i * 5);
    });
    y += vitalFlags.length * 5 + 12;
  }
  y += 4;

  // ── 3. Reported Symptoms ─────────────────────────────────────────────────
  addPageIfNeeded(30);
  y = sectionHeader("3.  REPORTED SYMPTOMS", y);
  const symptoms = Array.isArray(lv.symptoms)
    ? lv.symptoms
    : typeof lv.symptoms === "string"
      ? lv.symptoms.split(",").map(s => s.trim())
      : [];

  if (symptoms.length > 0) {
    const sympText = symptoms.map(s => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())).join("   •   ");
    const lines    = doc.splitTextToSize("• " + sympText, W - margin * 2 - 4);
    fillRect(margin, y, W - margin * 2, lines.length * 5 + 8, [255,250,250]);
    setFont(8.5, "normal", [100,20,20]);
    doc.text(lines, margin + 4, y + 5);
    y += lines.length * 5 + 14;
  } else {
    setFont(8.5, "normal", C.grey);
    doc.text("No symptoms recorded.", margin + 4, y + 4);
    y += 12;
  }

  // ── 4. AI Risk Assessment ─────────────────────────────────────────────────
  addPageIfNeeded(30);
  y = sectionHeader("4.  AI RISK ASSESSMENT", y);

  // Risk score bar
  const barW = W - margin * 2 - 50;
  kv("Risk Score", "", margin, y + 4);
  setFont(14, "bold", isCrit ? C.danger : riskScore >= 50 ? C.warning : C.success);
  doc.text(`${Math.round(riskScore)} / 100`, margin + 42, y + 5);
  setFont(8, "bold", C.grey);
  doc.text(`Triage: ${res.triage_level || lv.triage_level || "—"}`, margin + 75, y + 5);
  y += 9;
  fillRect(margin, y, barW, 7, [230,230,230]);
  fillRect(margin, y, barW * (riskScore / 100), 7, isCrit ? C.danger : riskScore >= 50 ? C.warning : C.success);
  setFont(7, "normal", C.grey);
  doc.text("LOW", margin, y + 12);
  doc.text("MODERATE", margin + barW * 0.3, y + 12);
  doc.text("HIGH", margin + barW * 0.6, y + 12);
  doc.text("CRITICAL", margin + barW * 0.85, y + 12);
  y += 18;

  // NEWS2 flags
  if (news2?.flags?.length > 0) {
    setFont(8, "bold", C.grey);
    doc.text("NEWS2 Flags:", margin, y);
    y += 5;
    const flagText = news2.flags.join("   |   ");
    const flines   = doc.splitTextToSize(flagText, W - margin * 2 - 4);
    setFont(7.5, "normal", C.dark);
    doc.text(flines, margin + 3, y);
    y += flines.length * 4.5 + 4;
  }

  // Risk triggers
  const triggers = severity?.contributing_vitals || severity?.contributing_symptoms || [];
  if (triggers.length > 0) {
    addPageIfNeeded(triggers.length * 6 + 10);
    setFont(8, "bold", C.grey);
    doc.text("Risk Triggers Identified:", margin, y);
    y += 5;
    triggers.forEach(t => {
      setFont(8, "normal", [150,50,50]);
      const tlines = doc.splitTextToSize(`⚡ ${t.reason || t}`, W - margin * 2 - 6);
      doc.text(tlines, margin + 3, y);
      y += tlines.length * 4.5 + 2;
    });
  }
  hline(y + 2); y += 8;

  // ── 5. AI Predicted Conditions ───────────────────────────────────────────
  const diseases = res.diseases || res.predicted_diseases || lv.predicted_diseases || [];
  if (diseases.length > 0) {
    addPageIfNeeded(40);
    y = sectionHeader("5.  AI PREDICTED CONDITIONS", y);
    autoTable(doc, {
      startY: y,
      head:   [["#", "Condition", "Probability", "Contributing Symptoms", "Clinical Description"]],
      body:   diseases.map((d, i) => [
        i + 1,
        d.name || "—",
        (d.probability || 0) + "%",
        (d.contributing_symptoms || []).slice(0, 3).map(s => s.replace(/_/g, " ")).join(", ") || "—",
        d.description || "—",
      ]),
      headStyles:   { fillColor: C.primary, textColor: C.white, fontSize: 8 },
      styles:       { fontSize: 7.5, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 }, 2: { cellWidth: 22 }, 3: { cellWidth: 55 }, 4: { cellWidth: 59 } },
      theme:        "striped",
    });
    y = doc.lastAutoTable.finalY + 8;

    // Why predicted (expanded explanation per disease)
    diseases.slice(0, 3).forEach(d => {
      if (!d.why_predicted) return;
      addPageIfNeeded(16);
      setFont(7.5, "bold", C.primary);
      doc.text(`${d.name} — AI Reasoning:`, margin, y);
      y += 4;
      const wlines = doc.splitTextToSize(d.why_predicted, W - margin * 2 - 4);
      setFont(7.5, "normal", C.grey);
      doc.text(wlines, margin + 3, y);
      y += wlines.length * 4 + 4;
    });
    hline(y); y += 8;
  }

  // ── 6. First Aid Instructions ────────────────────────────────────────────
  const firstAid = res.first_aid || [];
  if (firstAid.length > 0) {
    addPageIfNeeded(30);
    y = sectionHeader("6.  FIRST AID INSTRUCTIONS", y);
    firstAid.slice(0, 3).forEach(fa => {
      addPageIfNeeded(25);
      setFont(9, "bold", C.dark);
      doc.text(`For ${fa.disease}:`, margin, y);
      y += 5;
      (fa.immediate_steps || fa.steps || []).forEach((step, i) => {
        addPageIfNeeded(8);
        const slines = doc.splitTextToSize(`${i + 1}. ${step}`, W - margin * 2 - 8);
        setFont(8, "normal", C.dark);
        doc.text(slines, margin + 5, y);
        y += slines.length * 4.5 + 1;
      });
      if (fa.what_to_avoid?.length) {
        addPageIfNeeded(10);
        fillRect(margin, y, W - margin * 2, fa.what_to_avoid.length * 5 + 8, [255,245,245]);
        setFont(7.5, "bold", C.danger);
        doc.text("⛔ AVOID:", margin + 3, y + 5);
        fa.what_to_avoid.forEach((a, i) => {
          setFont(7.5, "normal", C.danger);
          doc.text("• " + a, margin + 16, y + 5 + (i + 1) * 4.5);
        });
        y += fa.what_to_avoid.length * 4.5 + 12;
      }
      if (fa.recovery_timeline) {
        setFont(7.5, "normal", C.grey);
        doc.text(`⏱ Recovery: ${fa.recovery_timeline}`, margin + 3, y);
        y += 5;
      }
      y += 4;
    });
    hline(y); y += 8;
  }

  // ── 7. When to Seek Hospital Care ────────────────────────────────────────
  if (res.when_to_hospital) {
    addPageIfNeeded(22);
    y = sectionHeader("7.  WHEN TO SEEK HOSPITAL CARE", y);
    fillRect(margin, y, W - margin * 2, 18, [255,251,235]);
    doc.setDrawColor(...C.warning);
    doc.rect(margin, y, W - margin * 2, 18);
    setFont(8, "bold", C.warning);
    doc.text("Clinical Guidance:", margin + 4, y + 6);
    const hlines = doc.splitTextToSize(res.when_to_hospital, W - margin * 2 - 8);
    setFont(8, "normal", C.dark);
    doc.text(hlines, margin + 4, y + 11);
    y += 22 + hlines.length * 3;
  }

  // ── 8. Plain Language Summary ─────────────────────────────────────────────
  const literacy = res.health_literacy || lv.health_literacy;
  if (literacy?.simple_summary) {
    addPageIfNeeded(28);
    y = sectionHeader("8.  PLAIN LANGUAGE SUMMARY (For Patient & Family)", y);
    fillRect(margin, y, W - margin * 2, 3, C.success);
    y += 5;
    const plines = doc.splitTextToSize(literacy.simple_summary, W - margin * 2 - 4);
    setFont(8.5, "normal", C.dark);
    doc.text(plines, margin + 3, y);
    y += plines.length * 5 + 6;

    if (literacy.key_warning_signs?.length > 0) {
      setFont(8, "bold", C.warning);
      doc.text("Watch out for:", margin + 3, y);
      y += 5;
      literacy.key_warning_signs.forEach(w => {
        addPageIfNeeded(6);
        setFont(8, "normal", [180,100,0]);
        doc.text("⚠ " + w, margin + 5, y);
        y += 5;
      });
    }
    hline(y + 2); y += 8;
  }

  // ── 9. Clinical Recommendations ──────────────────────────────────────────
  addPageIfNeeded(30);
  y = sectionHeader("9.  CLINICAL RECOMMENDATIONS", y);
  const recommendations = isCrit
    ? [
        "Call ambulance immediately — dial 102 or 108",
        "Do NOT give food or water to the patient",
        "Do NOT leave the patient alone at any time",
        "If unconscious: place in recovery position (on left side, head tilted back)",
        "Monitor breathing and pulse every 2 minutes",
        "Collect all current medications to hand over to paramedics",
        "Do NOT administer any medication unless directed by emergency services",
      ]
    : riskScore >= 50
    ? [
        "Seek medical attention within 2 hours — do not delay",
        "Monitor vitals (pulse, SpO2, BP) every 30 minutes",
        "Keep patient rested and calm; avoid any physical exertion",
        "Prepare medication list and medical history before seeing doctor",
        "If condition worsens: call ambulance immediately (102 / 108)",
      ]
    : [
        "Rest and monitor symptoms for the next 24–48 hours",
        "Stay well-hydrated (8+ glasses of water per day)",
        "Follow up with your GP within 48 hours if symptoms do not improve",
        "Avoid strenuous physical activity until cleared by a doctor",
        "Return to emergency care immediately if any red-flag symptoms appear",
      ];

  recommendations.forEach((r, i) => {
    addPageIfNeeded(7);
    fillRect(margin, y - 3, 4, 6, i === 0 && isCrit ? C.danger : C.success);
    setFont(8.5, "normal", C.dark);
    doc.text(`${i + 1}. ${r}`, margin + 6, y);
    y += 6;
  });
  y += 4;

  // ── 10. Drug Interactions & Allergy Warnings ──────────────────────────────
  const drugInts    = res.drug_interactions?.filter(Boolean) || [];
  const allergyWrns = res.allergy_warnings?.filter(Boolean)  || [];
  if (drugInts.length > 0 || allergyWrns.length > 0) {
    addPageIfNeeded(30);
    y = sectionHeader("10. DRUG INTERACTIONS & ALLERGY WARNINGS", y);
    if (allergyWrns.length > 0) {
      fillRect(margin, y, W - margin * 2, allergyWrns.length * 6 + 10, [255,245,245]);
      setFont(8, "bold", C.danger);
      doc.text("🚨 Allergy Alerts:", margin + 4, y + 6);
      allergyWrns.forEach((a, i) => {
        setFont(8, "normal", C.danger);
        doc.text("• " + a, margin + 6, y + 11 + i * 5);
      });
      y += allergyWrns.length * 6 + 14;
    }
    if (drugInts.length > 0) {
      addPageIfNeeded(drugInts.length * 6 + 14);
      fillRect(margin, y, W - margin * 2, drugInts.length * 6 + 10, [255,251,235]);
      setFont(8, "bold", C.warning);
      doc.text("💊 Drug Interaction Warnings:", margin + 4, y + 6);
      drugInts.forEach((d, i) => {
        setFont(8, "normal", [150,80,0]);
        doc.text("• " + d, margin + 6, y + 11 + i * 5);
      });
      y += drugInts.length * 6 + 14;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FOOTER on every page
  // ════════════════════════════════════════════════════════════════════════
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pH = doc.internal.pageSize.getHeight();
    fillRect(0, pH - 14, W, 14, C.primary);
    setFont(6.5, "normal", [180,210,255]);
    doc.text(
      "DISCLAIMER: This report is generated by MediAlert AI for informational purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional.",
      margin, pH - 8
    );
    setFont(7, "bold", [180,210,255]);
    doc.text(`Page ${p} of ${totalPages}  ·  ${reportId}  ·  MediAlert v2.0`, W - margin, pH - 4, { align: "right" });
    setFont(6.5, "normal", [180,210,255]);
    doc.text(`Generated: ${now.toLocaleString()}`, margin, pH - 4);
  }

  doc.save(`MediAlert_Report_${pat.name || "Patient"}_${now.toISOString().slice(0, 10)}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════
// FULL HISTORY EXPORT — all visits + all follow-up check-ins with vitals
// ════════════════════════════════════════════════════════════════════════
export function generateFullHistoryReport({ patient, visits, followUpsMap = {}, intelligenceMap = {} }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const C = {
    primary: [37, 99, 235], danger: [220, 38, 38], warning: [217, 119, 6],
    success: [22, 163, 74], purple: [124, 58, 237], dark: [15, 23, 42],
    grey: [100, 116, 139], lightbg: [240, 245, 255], white: [255, 255, 255],
  };
  const W = 210, margin = 14;
  let y = 0;
  const pat = patient || {};
  const now = new Date();
  const reportId = "HIST-" + Math.floor(Math.random() * 900000 + 100000);

  const setFont = (size, style = "normal", color = C.dark) => {
    doc.setFontSize(size); doc.setFont("helvetica", style); doc.setTextColor(...color);
  };
  const fillRect = (x, yr, w, h, color) => { doc.setFillColor(...color); doc.rect(x, yr, w, h, "F"); };
  const hline = (yr, color = [220, 220, 220]) => { doc.setDrawColor(...color); doc.line(margin, yr, W - margin, yr); };
  const sectionHeader = (label, yr, color = C.primary) => {
    fillRect(margin, yr - 4, W - margin * 2, 9, C.lightbg);
    setFont(10, "bold", color);
    doc.text(label, margin + 3, yr + 3);
    return yr + 10;
  };
  const addPageIfNeeded = (needed = 30) => { if (y + needed > 278) { doc.addPage(); y = 18; } };
  const fmt = s => (s || "").toString().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // ── Header band ─────────────────────────────────────────────────────────
  fillRect(0, 0, W, 34, C.primary);
  setFont(20, "bold", C.white);
  doc.text("MediAlert — Full Patient History", margin, 14);
  setFont(9, "normal", [180, 210, 255]);
  doc.text("Complete Visit & Follow-Up Record", margin, 21);
  doc.text(`Patient: ${pat.name || "—"}  ·  ID: ${pat.id || "—"}`, margin, 27);
  setFont(8, "normal", [180, 210, 255]);
  doc.text(`Generated: ${now.toLocaleString()}`, W - margin, 21, { align: "right" });
  doc.text(`Report ID: ${reportId}`, W - margin, 27, { align: "right" });
  y = 40;

  // ── Patient summary ────────────────────────────────────────────────────
  y = sectionHeader("PATIENT SUMMARY", y);
  autoTable(doc, {
    startY: y,
    body: [
      ["Age", pat.age ? pat.age + " years" : "—", "Gender", pat.gender || "—"],
      ["Blood Group", pat.blood_group || "Unknown", "Mobile", pat.mobile_number || "—"],
      ["Allergies", pat.allergies || "None", "Conditions", pat.known_conditions || "None"],
      ["Medications", pat.current_medications || "None", "Emergency Contact", `${pat.emergency_contact || "—"} (${pat.emergency_contact_phone || "—"})`],
      ["Total Visits", String(visits.length), "Report Generated", now.toLocaleDateString()],
    ],
    columnStyles: { 0: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 38 }, 1: { cellWidth: 58 }, 2: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 38 }, 3: { cellWidth: 48 } },
    styles: { fontSize: 8.5, cellPadding: 3.2 },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── Per-visit sections ──────────────────────────────────────────────────
  visits.forEach((visit, idx) => {
    addPageIfNeeded(60);
    const triageColor = visit.triage_level === "P1" ? C.danger : visit.triage_level === "P2" ? C.warning : C.success;
    y = sectionHeader(`VISIT ${idx + 1} — ${visit.visit_date ? new Date(visit.visit_date).toLocaleString() : "—"}`, y, triageColor);

    autoTable(doc, {
      startY: y,
      body: [
        ["Triage", visit.triage_level || "—", "Risk Score", visit.risk_score != null ? Math.round(visit.risk_score) + "/100" : "—"],
        ["NEWS2", visit.news2_score != null ? visit.news2_score + "/20" : "—", "Pulse / SpO2", `${visit.pulse ?? "—"} bpm / ${visit.spo2 ?? "—"}%`],
        ["Temp / BP", `${visit.temperature ?? "—"}°F / ${visit.blood_pressure || "—"}`, "Resp. Rate", visit.respiratory_rate != null ? visit.respiratory_rate + "/min" : "—"],
      ],
      columnStyles: { 0: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 38 }, 1: { cellWidth: 58 }, 2: { fontStyle: "bold", fillColor: C.lightbg, cellWidth: 38 }, 3: { cellWidth: 48 } },
      styles: { fontSize: 8, cellPadding: 3 },
      theme: "grid",
    });
    y = doc.lastAutoTable.finalY + 4;

    const symptoms = (visit.symptoms || []).map(fmt).join(", ") || "None recorded";
    setFont(8, "bold", C.grey); doc.text("Symptoms:", margin, y);
    setFont(8, "normal", C.dark);
    const symLines = doc.splitTextToSize(symptoms, W - margin * 2 - 25);
    doc.text(symLines, margin + 25, y);
    y += symLines.length * 4.5 + 4;

    const diseases = visit.predicted_diseases || [];
    if (diseases.length > 0) {
      addPageIfNeeded(20);
      setFont(8, "bold", C.grey); doc.text("AI Predicted Conditions:", margin, y); y += 4;
      diseases.slice(0, 5).forEach(d => {
        setFont(7.5, "normal", C.dark);
        doc.text(`• ${d.name} (${d.probability}%)`, margin + 3, y);
        y += 4;
      });
      y += 2;
    }

    // Follow-ups for this visit
    const followups = followUpsMap[visit.id] || [];
    const intel = intelligenceMap[visit.id];
    if (followups.length > 0) {
      addPageIfNeeded(20 + followups.length * 8);
      setFont(8.5, "bold", C.purple);
      doc.text(`Follow-Up Check-ins (${followups.length})`, margin, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [["Day", "Date", "Status", "Risk", "Resolved", "New", "Vitals"]],
        body: followups.map(f => [
          "Day " + f.day_number,
          f.followup_date ? new Date(f.followup_date).toLocaleDateString() : "—",
          f.recovery_status || "—",
          f.current_risk_score != null ? Math.round(f.current_risk_score) + "/100" : "—",
          (f.symptoms_improved || []).map(fmt).join(", ") || "—",
          (f.symptoms_worsened || []).map(fmt).join(", ") || "—",
          [f.pulse && f.pulse + " bpm", f.spo2 && f.spo2 + "%", f.temperature && f.temperature + "°F"].filter(Boolean).join(" / ") || "—",
        ]),
        headStyles: { fillColor: C.purple, textColor: C.white, fontSize: 7.5 },
        styles: { fontSize: 7, cellPadding: 2.5 },
        theme: "striped",
      });
      y = doc.lastAutoTable.finalY + 4;

      // Intelligence narratives (change summary / retriage) per follow-up
      if (intel?.followups?.length) {
        intel.followups.forEach(fa => {
          addPageIfNeeded(12);
          setFont(7.5, "italic", C.grey);
          const narrLines = doc.splitTextToSize(`Day ${fa.day_number}: ${fa.change_summary?.narrative || ""}`, W - margin * 2 - 4);
          doc.text(narrLines, margin + 2, y);
          y += narrLines.length * 3.8 + 1;
          if (fa.retriage?.triggered) {
            setFont(7.5, "bold", C.danger);
            doc.text(`⚠ AI RE-TRIAGE TRIGGERED: ${fa.retriage.reasons.join("; ")}`, margin + 2, y);
            y += 4.5;
          }
        });
        y += 2;
      }
      if (intel?.next_checkin) {
        setFont(7.5, "bold", intel.next_checkin.urgent ? C.danger : C.success);
        doc.text(`Next recommended check-in: ${intel.next_checkin.days === 0 ? "Immediate" : "Day " + intel.next_checkin.days} — ${intel.next_checkin.message}`, margin, y);
        y += 6;
      }
    }
    hline(y); y += 8;
  });

  // ── Footer on every page ─────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pH = doc.internal.pageSize.getHeight();
    fillRect(0, pH - 14, W, 14, C.primary);
    setFont(6.5, "normal", [180, 210, 255]);
    doc.text(
      "DISCLAIMER: This report is generated by MediAlert AI for informational purposes only. It is NOT a substitute for professional medical advice.",
      margin, pH - 8
    );
    setFont(7, "bold", [180, 210, 255]);
    doc.text(`Page ${p} of ${totalPages}  ·  ${reportId}  ·  MediAlert v2.0`, W - margin, pH - 4, { align: "right" });
  }

  doc.save(`MediAlert_FullHistory_${pat.name || "Patient"}_${now.toISOString().slice(0, 10)}.pdf`);
}
