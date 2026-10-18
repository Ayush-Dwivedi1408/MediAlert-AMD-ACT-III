import { useState } from "react";
import { useStore } from "../store";
import { api } from "../api/client";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function EditPatientModal({ onClose, onSaved }) {
  const { patient, setPatient } = useStore();

  const [form, setForm] = useState({
    // Verified at registration — not editable here (see VerifiedField below),
    // but still carried in the payload since PUT /patients/{id} replaces the
    // full record and expects every field.
    name:                    patient?.name                    || "",
    age:                     patient?.age                     || "",
    blood_group:             patient?.blood_group             || "",
    date_of_birth:           patient?.date_of_birth           || "",

    gender:                  patient?.gender                  || "Male",
    allergies:               patient?.allergies               || "",
    known_conditions:        patient?.known_conditions        || "",
    current_medications:     patient?.current_medications     || "",
    emergency_contact:       patient?.emergency_contact       || "",
    emergency_contact_phone: patient?.emergency_contact_phone || "",
    mobile_number:           patient?.mobile_number           || "",
    guardian_name:           patient?.guardian_name           || "",
    guardian_phone:          patient?.guardian_phone          || "",
  });
  const [loading, setLoading] = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);

  function handleChange(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patients.update(patient.id, {
        ...form,
        age: parseInt(form.age),
      });
      // Update Zustand store with fresh data
      if (typeof setPatient === "function") {
        setPatient({ ...patient, ...form, age: parseInt(form.age) });
      }
      setSaved(true);
      setTimeout(() => {
        if (typeof onSaved === "function") onSaved(updated);
        onClose();
      }, 1200);
    } catch (e) {
      setError(e.message || "Failed to save. Please try again.");
    }
    setLoading(false);
  }

  const s = {
    overlay: { position: "fixed", inset: 0, background: "#00000090", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
    modal:   { background: "var(--surface)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #00000070", border: "1px solid var(--border)" },
    h2:      { fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--text)" },
    sub:     { fontSize: 12, color: "var(--muted)", marginBottom: 22 },
    section: { fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "1px solid var(--border)", paddingBottom: 5, marginBottom: 14, marginTop: 20 },
    label:   { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" },
    reportedNote: { fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--muted)", fontStyle: "italic", fontSize: 10.5 },
    input:   { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--stat-bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
    grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
    btnPrimary: { height: 42, padding: "0 24px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: "var(--accent)", color: "#fff" },
    btnSecondary: { height: 42, padding: "0 24px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "transparent", color: "var(--text)" },
    bloodBtn:(sel) => ({
      padding: "8px 14px", borderRadius: 10, border: "2px solid",
      borderColor: sel ? "#EF4444" : "var(--border)",
      background:  sel ? "#EF444415" : "transparent",
      color:       sel ? "#EF4444"   : "var(--text)",
      cursor: "pointer", fontSize: 13, fontWeight: sel ? 800 : 400,
      transition: "all 0.15s",
    }),
    verifiedBox: {
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)",
      background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
    },
    verifiedBadge: {
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700,
      color: "#22C55E", background: "#22C55E15", padding: "2px 8px", borderRadius: 20, flexShrink: 0,
      whiteSpace: "nowrap",
    },
    verifiedNote: { fontSize: 11, color: "var(--muted)", marginTop: 4, marginBottom: 6, lineHeight: 1.5 },
  };

  function VerifiedField({ label, value }) {
    return (
      <div>
        <label style={s.label}>{label}</label>
        <div style={s.verifiedBox}>
          <span>{value || "—"}</span>
          <span style={s.verifiedBadge}>✓ Verified</span>
        </div>
      </div>
    );
  }

  if (saved) return (
    <div style={s.overlay}>
      <div style={{ ...s.modal, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Profile Updated!</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Your health card and records are now up to date.</div>
      </div>
    </div>
  );

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={s.h2}>✏️ Edit Patient Profile</div>
            <div style={s.sub}>Changes reflect instantly on your Health Card and PDF reports</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 10, padding: "4px 12px", cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>✕</button>
        </div>

        {error && (
          <div style={{ background: "#EF444410", border: "1px solid #EF444433", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>
            ⚠ {error}
          </div>
        )}

        {/* Basic Info — Name/Age/DOB are verified at registration and locked here */}
        <div style={s.section}>Basic Information</div>
        <div style={s.verifiedNote}>
          These details were verified when this record was created. Contact support if they need to be corrected.
        </div>
        <div style={s.grid2}>
          <VerifiedField label="Full Name" value={form.name} />
          <VerifiedField label="Age" value={form.age} />
          <div>
            <label style={s.label}>Gender</label>
            <select style={s.input} value={form.gender} onChange={e => handleChange("gender", e.target.value)}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        {/* Patient Contact */}
        <div style={s.section}>Patient Contact 📱</div>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>Mobile Number</label>
            <input style={s.input} value={form.mobile_number} onChange={e => handleChange("mobile_number", e.target.value)} placeholder="e.g. 9876543210" type="tel" />
          </div>
          <VerifiedField label="Date of Birth" value={form.date_of_birth} />
        </div>

        {parseInt(form.age) < 18 && (
          <>
            <div style={s.section}>Parent / Guardian Details 👨‍👩‍👧</div>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Guardian Name</label>
                <input style={s.input} value={form.guardian_name} onChange={e => handleChange("guardian_name", e.target.value)} placeholder="Parent/Guardian full name" />
              </div>
              <div>
                <label style={s.label}>Guardian Phone</label>
                <input style={s.input} value={form.guardian_phone} onChange={e => handleChange("guardian_phone", e.target.value)} placeholder="e.g. 9876543210" type="tel" />
              </div>
            </div>
          </>
        )}

        {/* Blood Group — verified, locked */}
        <div style={s.section}>Blood Group 🩸</div>
        <div style={s.verifiedBox}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🩸</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: form.blood_group ? "#EF4444" : "var(--text)" }}>
              {form.blood_group || "Unknown"}
            </span>
          </span>
          <span style={s.verifiedBadge}>✓ Verified</span>
        </div>
        <div style={s.verifiedNote}>Contact support if your blood group needs to be corrected.</div>

        {/* Medical History */}
        <div style={s.section}>Medical History</div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Known Allergies</label>
          <input style={s.input} value={form.allergies} onChange={e => handleChange("allergies", e.target.value)} placeholder="e.g. Penicillin, Lactose, Peanuts — or None" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>
            Known Conditions <span style={s.reportedNote}>(Patient reported)</span>
          </label>
          <input style={s.input} value={form.known_conditions} onChange={e => handleChange("known_conditions", e.target.value)} placeholder="e.g. Diabetes, Hypertension — or None" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>
            Current Medications <span style={s.reportedNote}>(Patient reported)</span>
          </label>
          <input style={s.input} value={form.current_medications} onChange={e => handleChange("current_medications", e.target.value)} placeholder="e.g. Metformin 500mg, Aspirin — or None" />
        </div>

        {/* Emergency Contact */}
        <div style={s.section}>Emergency Contact 📞</div>
        <div style={s.grid2}>
          <div>
            <label style={s.label}>Contact Name</label>
            <input style={s.input} value={form.emergency_contact} onChange={e => handleChange("emergency_contact", e.target.value)} placeholder="e.g. Mom, Dad, Spouse" />
          </div>
          <div>
            <label style={s.label}>Contact Phone Number</label>
            <input style={s.input} value={form.emergency_contact_phone} onChange={e => handleChange("emergency_contact_phone", e.target.value)} placeholder="e.g. 9876543210" type="tel" />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button style={{ ...s.btnPrimary, flex: 1 }} onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "💾 Save Profile"}
          </button>
          <button style={s.btnSecondary} onClick={onClose}>Cancel</button>
        </div>

        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 12 }}>
          This information is stored securely and used only for emergency medical purposes.
        </div>
      </div>
    </div>
  );
}
