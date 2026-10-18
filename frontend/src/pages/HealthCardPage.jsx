import { useState, useEffect, useRef } from "react";
import { useStore } from "../store";
import { api } from "../api/client";
import { triggerSOS } from "../utils/sos";
import QRCode from "qrcode";

export default function HealthCardPage() {
  const { patient } = useStore();
  const [cardData,   setCardData]   = useState(null);
  const [qrDataUrl,  setQrDataUrl]  = useState("");
  const [loading,    setLoading]    = useState(true);
  const [sosLoading, setSosLoading] = useState(false);
  const [confirmSOS, setConfirmSOS] = useState(false);
  const [sosResult,  setSosResult]  = useState(null); // result of the last send attempt
  const [sosError,   setSosError]   = useState("");
  const [lastVisit,  setLastVisit]  = useState(null);
  const loadedRef = useRef(false);

  // ── Only load ONCE — never re-trigger from state changes ──────────────────
  useEffect(() => {
    if (patient && !loadedRef.current) {
      loadedRef.current = true;
      loadCard();
    }
  }, []);

  async function loadCard() {
    setLoading(true);
    try {
      const fresh = await api.patients.get(patient.id);

      let visits = [];
      try {
        visits = await api.visits.forPatient(patient.id);
        if (Array.isArray(visits) && visits.length > 0) {
          setLastVisit(visits[visits.length - 1]);
        }
      } catch (e) { console.warn("Could not fetch visits:", e); }

      const card = {
        id:                      fresh.id                      || patient.id,
        name:                    fresh.name                    || patient.name,
        age:                     fresh.age                     || patient.age,
        gender:                  fresh.gender                  || patient.gender,
        blood_group:             fresh.blood_group             || "",
        allergies:               fresh.allergies               || "None",
        known_conditions:        fresh.known_conditions        || "None",
        current_medications:     fresh.current_medications     || "None",
        emergency_contact:       fresh.emergency_contact       || "",
        emergency_contact_phone: fresh.emergency_contact_phone || "",
        mobile_number:           fresh.mobile_number           || "",
        date_of_birth:           fresh.date_of_birth           || "",
        guardian_name:           fresh.guardian_name           || "",
        guardian_phone:          fresh.guardian_phone          || "",
        mental_health_status:    fresh.mental_health_status    || "",
        mental_health_crisis:    fresh.mental_health_crisis    || false,
      };
      setCardData(card);

      const lv = visits[visits.length - 1] || {};
      const qrPayload = JSON.stringify({
        platform:          "MediAlert v2.0",
        patient_id:        card.id,
        name:              card.name,
        age:               card.age,
        gender:            card.gender,
        blood_group:       card.blood_group || "Unknown",
        allergies:         card.allergies,
        conditions:        card.known_conditions,
        medications:       card.current_medications,
        emergency_contact: card.emergency_contact,
        emergency_phone:   card.emergency_contact_phone,
        mobile_number:     card.mobile_number    || "",
        date_of_birth:     card.date_of_birth    || "",
        guardian_name:     card.guardian_name    || "",
        guardian_phone:    card.guardian_phone   || "",
        last_visit: {
          date:        lv.visit_date     ? new Date(lv.visit_date).toLocaleDateString() : null,
          triage:      lv.triage_level   || null,
          risk_score:  lv.risk_score     || null,
          symptoms:    Array.isArray(lv.symptoms) ? lv.symptoms.join(", ") : null,
          pulse:       lv.pulse          || null,
          spo2:        lv.spo2           || null,
          bp:          lv.blood_pressure || null,
          temperature: lv.temperature    || null,
        },
        profile_url:  `http://localhost:5173/patient/${patient.id}`,
        generated_at: new Date().toISOString(),
      });

      const url = await QRCode.toDataURL(qrPayload, {
        width: 260, margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(url);

    } catch (e) {
      console.error("Health card error:", e);
      setCardData({
        id:                      patient.id,
        name:                    patient.name,
        age:                     patient.age,
        gender:                  patient.gender,
        blood_group:             patient.blood_group           || "",
        allergies:               patient.allergies             || "None",
        known_conditions:        patient.known_conditions      || "None",
        current_medications:     patient.current_medications   || "None",
        emergency_contact:       patient.emergency_contact     || "",
        emergency_contact_phone: patient.emergency_contact_phone || "",
        mobile_number:           patient.mobile_number         || "",
        date_of_birth:           patient.date_of_birth         || "",
        guardian_name:           patient.guardian_name         || "",
        guardian_phone:          patient.guardian_phone        || "",
      });
    }
    setLoading(false);
  }

  async function handleRefresh() {
    loadedRef.current = false;
    loadedRef.current = true;
    setLoading(true);
    await loadCard();
  }

  function printCard() {
    const lv = lastVisit || {};
    const pw = window.open("", "_blank");
    pw.document.write(`
      <html><head><title>MediAlert Health Card — ${cardData?.name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; padding: 24px; background: #f5f7fa; }
        .card { border: 3px solid #2563eb; border-radius: 16px; padding: 24px; max-width: 460px; background: #fff; }
        .header { background: linear-gradient(135deg,#1e3a8a,#2563eb); color: #fff; padding: 14px 18px; border-radius: 10px; margin-bottom: 18px; }
        .sec { font-size: 10px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 14px 0 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lbl { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .val { font-size: 13px; font-weight: 700; color: #1a202c; margin-top: 2px; }
        .vitals { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; margin-top: 6px; }
        .vbox { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center; }
        .qr { text-align: center; padding: 14px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin: 14px 0; }
        .sos { background: #dc2626; color: #fff; padding: 10px; border-radius: 8px; font-weight: 800; font-size: 14px; text-align: center; margin-top: 12px; }
        .footer { font-size: 9px; color: #94a3b8; text-align: center; margin-top: 8px; }
        .allergy { background: #fff5f5; border: 1px solid #fc8181; border-radius: 8px; padding: 8px 12px; margin: 8px 0; }
      </style></head>
      <body><div class="card">
        <div class="header">
          <div style="font-size:18px;font-weight:800">🏥 MediAlert Smart Health Card</div>
          <div style="font-size:11px;opacity:0.85;margin-top:3px">Emergency Medical Information · Scan QR for full record</div>
        </div>
        <div class="sec">Patient Identity</div>
        <div class="grid2">
          <div><div class="lbl">Patient ID</div><div class="val">${cardData?.id || "—"}</div></div>
          <div><div class="lbl">Full Name</div><div class="val">${cardData?.name || "—"}</div></div>
          <div><div class="lbl">Age</div><div class="val">${cardData?.age || "—"} years</div></div>
          <div><div class="lbl">Gender</div><div class="val">${cardData?.gender || "—"}</div></div>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div><div class="lbl">Mobile Number</div><div class="val">${cardData?.mobile_number || "—"}</div></div>
          <div><div class="lbl">Date of Birth</div><div class="val">${cardData?.date_of_birth || "—"}</div></div>
        </div>
        ${cardData?.guardian_name ? `
        <div class="grid2" style="margin-top:8px">
          <div><div class="lbl">Guardian Name</div><div class="val">${cardData.guardian_name}</div></div>
          <div><div class="lbl">Guardian Phone</div><div class="val">${cardData.guardian_phone || "—"}</div></div>
        </div>` : ""}

        <div class="sec">Medical Information</div>
        <div style="margin:10px 0">
          <div class="lbl">Blood Group</div>
          <div style="font-size:20px;font-weight:900;color:#dc2626">${cardData?.blood_group || "Not recorded"}</div>
        </div>
        ${cardData?.allergies && cardData.allergies !== "None" ? `<div class="allergy"><div class="lbl" style="color:#dc2626">⚠ Known Allergies</div><div class="val" style="color:#dc2626">${cardData.allergies}</div></div>` : ""}
        <div style="margin-bottom:6px"><div class="lbl">Known Conditions</div><div class="val">${cardData?.known_conditions || "None"}</div></div>
        <div style="margin-bottom:6px"><div class="lbl">Current Medications</div><div class="val">${cardData?.current_medications || "None"}</div></div>

        ${cardData?.mental_health_status ? `
        <div class="sec">Mental Health Status</div>
        <div style="margin-bottom:6px;${cardData.mental_health_crisis ? "padding:8px 12px;border:1px solid #dc2626;border-radius:6px;" : ""}">
          <div class="val" style="${cardData.mental_health_crisis ? "color:#dc2626" : ""}">${cardData.mental_health_status}${cardData.mental_health_crisis ? " ⚠ Requires urgent support" : ""}</div>
        </div>` : ""}

        <div class="sec">Emergency Contacts</div>
        <div class="grid2">
          <div><div class="lbl">Contact Name</div><div class="val">${cardData?.emergency_contact || "Not provided"}</div></div>
          <div><div class="lbl">Contact Phone</div><div class="val">${cardData?.emergency_contact_phone || "—"}</div></div>
        </div>

        ${lv.visit_date ? `
        <div class="sec">Latest Vitals — ${new Date(lv.visit_date).toLocaleDateString()}</div>
        <div class="grid2">
          <div><div class="lbl">Triage</div><div class="val" style="color:#dc2626">${lv.triage_level || "—"}</div></div>
          <div><div class="lbl">Risk Score</div><div class="val">${lv.risk_score ? Math.round(lv.risk_score) + "/100" : "—"}</div></div>
        </div>
        <div class="vitals">
          <div class="vbox"><div style="font-size:12px;font-weight:800">${lv.pulse ? lv.pulse + " bpm" : "—"}</div><div class="lbl">Pulse</div></div>
          <div class="vbox"><div style="font-size:12px;font-weight:800">${lv.spo2 ? lv.spo2 + "%" : "—"}</div><div class="lbl">SpO2</div></div>
          <div class="vbox"><div style="font-size:12px;font-weight:800">${lv.temperature ? lv.temperature + "°F" : "—"}</div><div class="lbl">Temp</div></div>
          <div class="vbox"><div style="font-size:12px;font-weight:800">${lv.blood_pressure || "—"}</div><div class="lbl">BP</div></div>
          <div class="vbox"><div style="font-size:12px;font-weight:800">${lv.respiratory_rate ? lv.respiratory_rate + "/min" : "—"}</div><div class="lbl">Resp</div></div>
          <div class="vbox"><div style="font-size:12px;font-weight:800">${lv.news2_score || "—"}</div><div class="lbl">NEWS2</div></div>
        </div>` : ""}
        ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" width="200"/><div style="font-size:10px;color:#64748b;margin-top:6px">Scan for detailed patient record & full history</div></div>` : ""}
        <div class="sos">🆘 EMERGENCY: Call 102 / 108</div>
        <div class="footer">Generated by MediAlert · ${new Date().toLocaleString()}</div>
      </div></body></html>
    `);
    pw.document.close();
    pw.print();
  }

  async function handleSOS() {
    setConfirmSOS(false);
    setSosLoading(true);
    setSosResult(null);
    setSosError("");
    try {
      const result = await triggerSOS(patient);
      setSosResult(result);
    } catch (e) {
      setSosError(e.message || "Failed to send emergency alert");
    }
    setSosLoading(false);
  }

  const s = {
    h1:   { fontSize: 26, fontWeight: 800, marginBottom: 6, color: "var(--text)" },
    sub:  { color: "var(--muted)", fontSize: 13, marginBottom: 24 },
    card: { background: "var(--surface)", borderRadius: 16, border: "2px solid var(--accent)", padding: 28, marginBottom: 16, maxWidth: 560 },
    hdr:  { background: "linear-gradient(135deg,#1e3a8a,#2563eb)", color: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 20 },
    sec:  { fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "1px solid var(--border)", paddingBottom: 5, marginBottom: 10, marginTop: 20 },
    g2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    lbl:  { fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 },
    val:  { fontSize: 14, fontWeight: 700, color: "var(--text)" },
    qrBox:{ textAlign: "center", padding: "24px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", margin: "20px 0" },
    sos:  { padding: "14px 28px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 900, fontSize: 16, background: "#EF4444", color: "#fff", width: "100%", marginTop: 16, letterSpacing: "1px", boxShadow: "0 4px 20px #EF444440" },
    vg:   { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 8 },
    vb:   (w) => ({ background: w ? "#2d151522" : "var(--stat-bg)", border: `1px solid ${w ? "#c53030" : "var(--border)"}`, borderRadius: 10, padding: "10px 6px", textAlign: "center" }),
    btnPrimary: { padding: "13px 22px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: "var(--accent)", color: "#fff", width: "100%", marginBottom: 10 },
    btnSecondary: { padding: "13px 22px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "transparent", color: "var(--text)", width: "100%", marginBottom: 10 },
  };

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center", color: "var(--muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
      Loading health card...
    </div>
  );

  if (!cardData) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
      Unable to load. <button onClick={handleRefresh} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Try again</button>
    </div>
  );

  const lv = lastVisit || {};
  const hasBloodGroup       = cardData.blood_group && cardData.blood_group !== "";
  const hasEmergencyContact = cardData.emergency_contact && cardData.emergency_contact !== "";
  const hasEmergencyPhone   = cardData.emergency_contact_phone && cardData.emergency_contact_phone !== "";

  return (
    <div>
      <div style={s.h1}>🪪 Smart Health Card</div>
      <div style={s.sub}>In an emergency, scan the QR code for instant access to your complete medical record</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div style={s.card}>
          <div style={s.hdr}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>🏥 MediAlert Smart Health Card</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>Emergency Medical Information</div>
          </div>

          {/* ── Identity ─────────────────────────────────────────────── */}
          <div style={{ ...s.sec, marginTop: 0 }}>Patient Identity</div>
          <div style={s.g2}>
            {[["Patient ID", cardData.id], ["Full Name", cardData.name], ["Age", cardData.age + " years"], ["Gender", cardData.gender]].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={s.lbl}>{k}</div>
                <div style={s.val}>{v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={s.g2}>
            <div style={{ marginBottom: 10 }}>
              <div style={s.lbl}>Mobile Number</div>
              <div style={s.val}>{cardData.mobile_number || "—"}</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={s.lbl}>Date of Birth</div>
              <div style={s.val}>{cardData.date_of_birth || "—"}</div>
            </div>
          </div>
          {cardData.guardian_name && (
            <div style={s.g2}>
              <div style={{ marginBottom: 10 }}>
                <div style={s.lbl}>Guardian Name</div>
                <div style={s.val}>{cardData.guardian_name}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.lbl}>Guardian Phone</div>
                <div style={s.val}>{cardData.guardian_phone || "—"}</div>
              </div>
            </div>
          )}

          {/* ── Medical Information ──────────────────────────────────── */}
          <div style={s.sec}>Medical Information</div>
          <div style={{ background: hasBloodGroup ? "#dc262210" : "#64748b10", border: `1px solid ${hasBloodGroup ? "#dc262244" : "#64748b33"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28 }}>🩸</div>
            <div>
              <div style={s.lbl}>Blood Group</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: hasBloodGroup ? "#dc2626" : "#64748b" }}>
                {hasBloodGroup ? cardData.blood_group : "Not recorded"}
              </div>
              {!hasBloodGroup && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>Update in patient profile to show here</div>}
            </div>
          </div>

          {cardData.allergies && cardData.allergies !== "None" ? (
            <div style={{ background: "#fff5f5", border: "1px solid #fc818155", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
              <div style={{ ...s.lbl, color: "#dc2626" }}>⚠ Known Allergies</div>
              <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 14 }}>{cardData.allergies}</div>
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}><div style={s.lbl}>Known Allergies</div><div style={{ ...s.val, color: "#16a34a" }}>None</div></div>
          )}

          {[["Known Conditions", cardData.known_conditions], ["Current Medications", cardData.current_medications]].map(([k, v]) => (
            <div key={k} style={{ marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              <div style={s.lbl}>{k}</div><div style={s.val}>{v || "None"}</div>
            </div>
          ))}

          {/* ── Mental Health ─────────────────────────────────────────── */}
          {cardData.mental_health_status && (
            <>
              <div style={s.sec}>Mental Health</div>
              <div style={{
                marginBottom: 14, padding: "8px 12px", borderRadius: 8,
                background: cardData.mental_health_crisis ? "#dc262618" : "var(--stat-bg)",
                border: cardData.mental_health_crisis ? "1px solid #dc262644" : "none",
              }}>
                <div style={{ ...s.val, color: cardData.mental_health_crisis ? "#dc2626" : undefined }}>
                  {cardData.mental_health_status}
                  {cardData.mental_health_crisis && "  ⚠ Requires urgent support"}
                </div>
              </div>
            </>
          )}

          {/* ── Emergency Contacts ────────────────────────────────────── */}
          <div style={s.sec}>Emergency Contacts</div>
          <div style={s.g2}>
            <div>
              <div style={s.lbl}>Contact Name</div>
              <div style={{ ...s.val, color: hasEmergencyContact ? "var(--text)" : "#64748b" }}>
                {hasEmergencyContact ? cardData.emergency_contact : "Not provided"}
              </div>
            </div>
            <div>
              <div style={s.lbl}>Contact Phone</div>
              <div style={{ ...s.val, color: hasEmergencyPhone ? "var(--accent)" : "#64748b" }}>
                {hasEmergencyPhone ? cardData.emergency_contact_phone : "—"}
              </div>
            </div>
          </div>

          {/* ── Latest Vitals ─────────────────────────────────────────── */}
          {lv.visit_date && (
            <>
              <div style={s.sec}>Latest Vitals — {new Date(lv.visit_date).toLocaleDateString()}</div>
              <div style={s.g2}>
                <div><div style={s.lbl}>Triage</div><div style={{ ...s.val, color: lv.triage_level === "P1" ? "#dc2626" : lv.triage_level === "P2" ? "#ea580c" : "#16a34a" }}>{lv.triage_level || "—"}</div></div>
                <div><div style={s.lbl}>Risk Score</div><div style={s.val}>{lv.risk_score ? Math.round(lv.risk_score) + "/100" : "—"}</div></div>
              </div>
              <div style={s.vg}>
                {[
                  { label: "Pulse",    value: lv.pulse         ? lv.pulse + " bpm"          : "—", warn: lv.pulse && (lv.pulse < 50 || lv.pulse > 120) },
                  { label: "SpO2",     value: lv.spo2          ? lv.spo2 + "%"               : "—", warn: lv.spo2 && lv.spo2 < 90 },
                  { label: "Temp",     value: lv.temperature   ? lv.temperature + "°F"       : "—", warn: lv.temperature && (lv.temperature < 95 || lv.temperature > 103) },
                  { label: "BP",       value: lv.blood_pressure || "—",                              warn: false },
                  { label: "Resp Rate",value: lv.respiratory_rate ? lv.respiratory_rate + "/min" : "—", warn: lv.respiratory_rate && lv.respiratory_rate < 8 },
                  { label: "NEWS2",    value: lv.news2_score   ? lv.news2_score + "/20"      : "—", warn: lv.news2_score && lv.news2_score >= 7 },
                ].map((v, i) => (
                  <div key={i} style={s.vb(v.warn)}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: v.warn ? "#fc8181" : "var(--text)" }}>{v.value}</div>
                    <div style={{ fontSize: 9, color: v.warn ? "#fc8181" : "var(--muted)", marginTop: 2 }}>{v.warn && "⚠ "}{v.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── QR Code ───────────────────────────────────────────────── */}
          {qrDataUrl && (
            <div style={s.qrBox}>
              <img src={qrDataUrl} alt="QR" width={220} height={220} />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, fontWeight: 600 }}>Scan for detailed patient record & full history</div>
            </div>
          )}

          {/* ── SOS with confirmation ─────────────────────────────────── */}
          {!confirmSOS ? (
            <button style={s.sos} onClick={() => { setConfirmSOS(true); setSosResult(null); setSosError(""); }} disabled={sosLoading}>
              {sosLoading ? "Sending SOS..." : "🆘 SOS — Send Emergency Alert"}
            </button>
          ) : (
            <div style={{ marginTop: 16, background: "#EF444412", border: "2px solid #EF4444", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444", marginBottom: 6 }}>Send emergency alert?</div>
              <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 14, lineHeight: 1.6 }}>
                This will immediately alert your emergency contact with the patient's critical vitals, GPS location and secure medical profile. WhatsApp will be used first, with SMS as a fallback.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...s.btnSecondary, marginBottom: 0 }} onClick={() => setConfirmSOS(false)}>Cancel</button>
                <button style={{ ...s.sos, marginTop: 0 }} onClick={handleSOS}>Confirm & Send</button>
              </div>
            </div>
          )}

          {/* ── SOS result / dev-mode feedback ────────────────────────── */}
          {sosError && (
            <div style={{ marginTop: 14, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>
              {sosError}
            </div>
          )}
          {sosResult && (
            <div style={{
              marginTop: 14, borderRadius: 10, padding: "12px 14px", fontSize: 12, lineHeight: 1.6,
              background: sosResult.delivered_via ? "rgba(34,197,94,0.1)" : "#f59e0b12",
              border: `1px solid ${sosResult.delivered_via ? "rgba(34,197,94,0.3)" : "#f59e0b44"}`,
              color: sosResult.delivered_via ? "#22C55E" : "var(--text)",
            }}>
              {sosResult.delivered_via === "whatsapp" && "✅ Alert sent via WhatsApp Business."}
              {sosResult.delivered_via === "sms" && "✅ WhatsApp wasn't available — alert sent via SMS instead."}
              {!sosResult.delivered_via && (
                <>
                  ⚠️ DEV MODE — WhatsApp Business API and SMS aren't configured with real credentials yet,
                  so no message actually went out. Both channels were attempted (see the backend console
                  for exactly what would have been sent). Once real credentials are added, this will work
                  automatically with no other changes needed.
                </>
              )}
            </div>
          )}
        </div>

        <div>
          {(!hasBloodGroup || !hasEmergencyContact || !hasEmergencyPhone) && (
            <div style={{ background: "#d9780610", border: "1px solid #d9780633", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#d97806", marginBottom: 10 }}>⚠ Incomplete Medical Profile</div>
              {!hasBloodGroup    && <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 6 }}>🩸 <strong>Blood Group not recorded</strong> — Update your patient profile</div>}
              {!hasEmergencyContact && <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 6 }}>📞 <strong>Emergency contact name missing</strong> — Add in patient profile</div>}
              {!hasEmergencyPhone   && <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 6 }}>📱 <strong>Emergency phone number missing</strong> — Add in patient profile</div>}
            </div>
          )}

          <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>How to Use This Card</div>
            {[
              { icon: "🏥", title: "In hospital",    desc: "Show to doctors — they scan the QR for your complete medical profile instantly." },
              { icon: "🚨", title: "In an accident", desc: "First responders get blood group, allergies and emergency contact in seconds." },
              { icon: "💊", title: "At pharmacy",    desc: "Pharmacists see medications and allergies to avoid dangerous interactions." },
              { icon: "🆘", title: "SOS Button",     desc: "Sends your critical vitals, GPS location and medical profile to your emergency contact via WhatsApp Business, with SMS as a fallback, once confirmed." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 20, minWidth: 28 }}>{icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button style={s.btnPrimary} onClick={printCard}>🖨️ Print Health Card</button>
          <button style={s.btnSecondary} onClick={handleRefresh}>🔄 Refresh Card Data</button>
        </div>
      </div>
    </div>
  );
}
