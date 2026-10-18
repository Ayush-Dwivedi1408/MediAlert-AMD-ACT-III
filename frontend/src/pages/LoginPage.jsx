import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import { api } from "../api/client";
import { translations } from "../i18n";

const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91 (India)", digits: 10 },
  { code: "+1",  label: "🇺🇸 +1 (US/Canada)", digits: 10 },
  { code: "+44", label: "🇬🇧 +44 (UK)", digits: 10 },
  { code: "+61", label: "🇦🇺 +61 (Australia)", digits: 9 },
  { code: "+971",label: "🇦🇪 +971 (UAE)", digits: 9 },
  { code: "+880",label: "🇧🇩 +880 (Bangladesh)", digits: 10 },
  { code: "+92", label: "🇵🇰 +92 (Pakistan)", digits: 10 },
  { code: "+94", label: "🇱🇰 +94 (Sri Lanka)", digits: 9 },
];

const PREFERRED_LANGUAGES = ["English", "Hindi"];

function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export default function LoginPage() {
  const { lang, setPatient, dark } = useStore();
  const T = translations[lang].login;
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const timedOut = searchParams.get("reason") === "timeout";
  const [mode, setMode] = useState("new");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", gender: "Male",
    visit_date: new Date().toISOString().slice(0, 16),
    allergies: "", known_conditions: "", current_medications: "",
    emergency_contact: "", emergency_contact_phone: "",
    mobile_country_code: "+91", mobile_number: "",
    date_of_birth: "", blood_group: "",
    guardian_name: "", guardian_phone: "",
    preferred_language: "English",
    consent_given: false,
    pin: "", confirm_pin: "",
  });

  // ── Returning Patient: login method (PIN or OTP) ──
  const [loginMethod, setLoginMethod] = useState("pin"); // "pin" | "otp"
  const [loginPin, setLoginPin] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otpRequesting, setOtpRequesting] = useState(false);

  // ── Forgot Patient ID or PIN ──
  const [forgotMode, setForgotMode] = useState(null); // null | "choose" | "id" | "pin"
  const [forgotForm, setForgotForm] = useState({
    name: "", mobile_country_code: "+91", mobile_number: "", date_of_birth: "",
  });
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [foundId, setFoundId] = useState("");

  // Forgot PIN sub-flow: step 1 request OTP, step 2 enter code + new PIN
  const [forgotPinId, setForgotPinId] = useState("");
  const [forgotPinStep, setForgotPinStep] = useState(1);
  const [forgotPinOtp, setForgotPinOtp] = useState("");
  const [forgotPinDevOtp, setForgotPinDevOtp] = useState("");
  const [forgotPinNew, setForgotPinNew] = useState("");
  const [forgotPinConfirm, setForgotPinConfirm] = useState("");
  const [forgotPinError, setForgotPinError] = useState("");
  const [forgotPinLoading, setForgotPinLoading] = useState(false);
  const [forgotPinSuccess, setForgotPinSuccess] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setForgot(k, v) { setForgotForm(f => ({ ...f, [k]: v })); }

  const computedAge = useMemo(() => calculateAge(form.date_of_birth), [form.date_of_birth]);
  const effectiveAge = computedAge;
  const isMinor = effectiveAge !== null && effectiveAge < 18;

  const selectedCountry = COUNTRY_CODES.find(c => c.code === form.mobile_country_code) || COUNTRY_CODES[0];
  const mobileDigitsOnly = (form.mobile_number || "").replace(/\D/g, "");
  const mobileValid = mobileDigitsOnly.length === 0 || mobileDigitsOnly.length === selectedCountry.digits;

  const forgotSelectedCountry = COUNTRY_CODES.find(c => c.code === forgotForm.mobile_country_code) || COUNTRY_CODES[0];

  function handleContinue() {
    if (!form.name) { setError("Name is required"); return; }
    if (effectiveAge === null) { setError("Please enter Date of Birth"); return; }
    if (!form.mobile_number) {
      setError("Mobile number is required");
      return;
    }
    if (!mobileValid) {
      setError(`Mobile number should be ${selectedCountry.digits} digits for ${selectedCountry.code}`);
      return;
    }
    if (isMinor && (!form.guardian_name || !form.guardian_phone)) {
      setError("Parent/Guardian name and phone are required for patients under 18");
      return;
    }
    if (!/^\d{4,6}$/.test(form.pin)) {
      setError("Please set a 4-6 digit PIN");
      return;
    }
    if (form.pin !== form.confirm_pin) {
      setError("PINs do not match");
      return;
    }
    setError("");
    setStep(2);
  }

  async function handleRegister() {
    if (!form.consent_given) {
      setError("Please provide consent to store medical information to continue");
      return;
    }

    setLoading(true); setError("");
    try {
      const fullMobile = form.mobile_number ? `${form.mobile_country_code} ${form.mobile_number}` : null;
      const patient = await api.patients.create({
        name: form.name,
        age: effectiveAge,
        gender: form.gender,
        allergies: form.allergies,
        known_conditions: form.known_conditions,
        current_medications: form.current_medications,
        blood_group: form.blood_group || null,
        emergency_contact: form.emergency_contact || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        mobile_number: fullMobile,
        date_of_birth: form.date_of_birth || null,
        guardian_name: isMinor ? form.guardian_name : null,
        guardian_phone: isMinor ? form.guardian_phone : null,
        preferred_language: form.preferred_language,
        consent_given: form.consent_given,
        pin: form.pin,
        confirm_pin: form.confirm_pin,
      });
      sessionStorage.setItem(`medialert_new_registration_${patient.id}`, "1");
      const { pin: _pin, confirm_pin: _confirmPin, ...formWithoutPin } = form;
      setPatient({ ...patient, ...formWithoutPin, age: effectiveAge, mobile_number: fullMobile, has_pin: true });
      nav("/dashboard");
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function completeLogin(patientId) {
    const summary = await api.patients.summary(patientId);
    setPatient({ ...summary.patient, id: summary.patient.id || patientId });
    nav("/dashboard");
  }

  async function handlePinLogin() {
    if (!searchId.trim()) { setError("Enter a Patient ID"); return; }
    if (!loginPin.trim()) { setError("Enter your PIN"); return; }
    setLoading(true); setError("");
    try {
      await api.patients.verifyPin(searchId.trim(), loginPin.trim());
      await completeLogin(searchId.trim());
    } catch (e) {
      setError(e.message || "Incorrect PIN. Please try again.");
    }
    setLoading(false);
  }

  async function handleRequestLoginOtp() {
    if (!searchId.trim()) { setError("Enter a Patient ID"); return; }
    setOtpRequesting(true); setError("");
    try {
      const res = await api.patients.requestOtp(searchId.trim(), "login");
      setDevOtp(res.dev_otp || "");
      setOtpSent(true);
    } catch (e) {
      setError(e.message || "Could not send OTP. Please try again.");
    }
    setOtpRequesting(false);
  }

  async function handleOtpLogin() {
    if (!otpCode.trim()) { setError("Enter the OTP code"); return; }
    setLoading(true); setError("");
    try {
      await api.patients.verifyOtp(searchId.trim(), otpCode.trim(), "login");
      await completeLogin(searchId.trim());
    } catch (e) {
      setError(e.message || "Incorrect or expired code. Please try again.");
    }
    setLoading(false);
  }

  function openForgotChoice() {
    setForgotMode("choose");
    setForgotError("");
    setFoundId("");
  }

  function openForgotId() {
    setForgotForm({ name: "", mobile_country_code: "+91", mobile_number: "", date_of_birth: "" });
    setForgotError("");
    setFoundId("");
    setForgotMode("id");
  }

  function openForgotPin() {
    setForgotPinId(searchId || "");
    setForgotPinStep(1);
    setForgotPinOtp("");
    setForgotPinDevOtp("");
    setForgotPinNew("");
    setForgotPinConfirm("");
    setForgotPinError("");
    setForgotPinSuccess(false);
    setForgotMode("pin");
  }

  function closeForgot() {
    setForgotMode(null);
    setForgotError("");
    setFoundId("");
    setForgotPinError("");
  }

  async function handleForgotSubmit() {
    setForgotError("");
    setFoundId("");
    if (!forgotForm.name.trim() || !forgotForm.mobile_number.trim() || !forgotForm.date_of_birth) {
      setForgotError("Please fill in your name, mobile number, and date of birth.");
      return;
    }
    setForgotLoading(true);
    try {
      const fullMobile = `${forgotForm.mobile_country_code} ${forgotForm.mobile_number}`;
      const result = await api.patients.lookupId({
        name: forgotForm.name.trim(),
        mobile_number: fullMobile,
        date_of_birth: forgotForm.date_of_birth,
      });
      setFoundId(result.id);
    } catch (e) {
      setForgotError(e.message || "No matching patient record found.");
    } finally {
      setForgotLoading(false);
    }
  }

  function useFoundId() {
    setSearchId(foundId);
    closeForgot();
  }

  async function handleForgotPinRequestOtp() {
    setForgotPinError("");
    if (!forgotPinId.trim()) {
      setForgotPinError("Enter your Patient ID");
      return;
    }
    setForgotPinLoading(true);
    try {
      const res = await api.patients.requestOtp(forgotPinId.trim(), "reset_pin");
      setForgotPinDevOtp(res.dev_otp || "");
      setForgotPinStep(2);
    } catch (e) {
      setForgotPinError(e.message || "Could not send OTP. Please try again.");
    } finally {
      setForgotPinLoading(false);
    }
  }

  async function handleForgotPinSubmit() {
    setForgotPinError("");
    if (!forgotPinOtp.trim()) { setForgotPinError("Enter the OTP code"); return; }
    if (!/^\d{4,6}$/.test(forgotPinNew)) { setForgotPinError("New PIN must be 4-6 digits"); return; }
    if (forgotPinNew !== forgotPinConfirm) { setForgotPinError("PINs do not match"); return; }
    setForgotPinLoading(true);
    try {
      await api.patients.resetPin(forgotPinId.trim(), forgotPinOtp.trim(), forgotPinNew, forgotPinConfirm);
      setForgotPinSuccess(true);
    } catch (e) {
      setForgotPinError(e.message || "Could not reset PIN. Please try again.");
    } finally {
      setForgotPinLoading(false);
    }
  }

  function finishForgotPin() {
    setSearchId(forgotPinId);
    setLoginMethod("pin");
    setLoginPin("");
    closeForgot();
  }

  const s = {
    page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)" },
    box: { width: "100%", maxWidth: 560 },
    logo: { textAlign: "center", marginBottom: 32 },
    logoName: { fontSize: 36, fontWeight: 800, color: "var(--accent)", letterSpacing: "-1px" },
    logoSub: { fontSize: 13, color: "var(--muted)", letterSpacing: "2px", textTransform: "uppercase" },
    heading: { textAlign: "center", fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 20 },
    card: { background: "var(--surface)", borderRadius: 20, border: "1px solid var(--border)", padding: 32 },
    toggle: { display: "flex", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 28 },
    toggleBtn: (a) => ({ flex: 1, padding: "11px 0", border: "none", cursor: "pointer", fontWeight: a ? 700 : 400, fontSize: 14, background: a ? "var(--accent)" : "transparent", color: a ? "#fff" : "var(--muted)", transition: "all 0.2s" }),
    label: { display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" },
    required: { color: "#dc2626", fontWeight: 800 },
    input: { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
    inputError: { borderColor: "#dc2626" },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
    mobileRow: { display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 },
    field: { marginBottom: 14 },
    section: { fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", margin: "20px 0 12px", borderTop: "1px solid var(--border)", paddingTop: 16 },
    btn: { width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 15, background: "var(--accent)", color: "#fff", marginTop: 8, transition: "opacity 0.2s" },
    secondaryBtn: { width: "100%", padding: "13px", borderRadius: 12, border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "transparent", color: "var(--text)", marginTop: 8 },
    btnRow: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 },
    error: { background: "#dc262615", border: "1px solid #dc262644", color: "#dc2626", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 },
    hint: { fontSize: 11, color: "var(--muted)", marginTop: 4 },
    minorNotice: { background: "#2563eb15", border: "1px solid #2563eb44", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--text)" },
    consentRow: { display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, marginBottom: 4 },
    consentText: { fontSize: 12, color: "var(--text)", lineHeight: 1.5 },
    stepLabel: { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
    stepDot: (active) => ({ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: active ? "var(--accent)" : "var(--border)", color: active ? "#fff" : "var(--muted)" }),
    linkBtn: { background: "none", border: "none", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" },
    forgotWrap: { marginTop: 10, textAlign: "right" },
    forgotPanel: { marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" },
    forgotTitle: { fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 },
    forgotSubtitle: { fontSize: 12, color: "var(--muted)", marginBottom: 16 },
    successBox: { background: "#16a34a15", border: "1px solid #16a34a44", borderRadius: 10, padding: "14px 16px", marginBottom: 14 },
    successLabel: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 },
    successId: { fontSize: 18, fontWeight: 800, color: "#16a34a", letterSpacing: "0.5px" },
    methodRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    methodOption: (active) => ({
      display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 10,
      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
      background: active ? "var(--accent)15" : "var(--input-bg)",
      color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
    }),
    radio: { width: 15, height: 15, cursor: "pointer", accentColor: "var(--accent)" },
    devOtpBanner: {
      background: "#f59e0b15", border: "1px solid #f59e0b44", borderRadius: 10,
      padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--text)",
    },
  };

  return (
    <div style={s.page}>
      <div style={s.box}>
        <div style={s.logo}>
          <div style={s.logoName}>🏥 MediAlert</div>
          <div style={s.logoSub}>AI Clinical Decision Support System</div>
        </div>

        <div style={s.heading}>{mode === "new" ? T.title : T.login_heading}</div>

        {timedOut && (
          <div style={{
            background: "#f59e0b12", border: "1px solid #f59e0b44", borderRadius: 10,
            padding: "10px 14px", fontSize: 12, color: "var(--text)", marginBottom: 16, textAlign: "center",
          }}>
            ⏰ You were logged out due to inactivity. Please sign in again.
          </div>
        )}

        <div style={s.card}>
          <div style={s.toggle}>
            <button style={s.toggleBtn(mode === "new")} onClick={() => { setMode("new"); setStep(1); setError(""); closeForgot(); }}>{T.new}</button>
            <button style={s.toggleBtn(mode === "returning")} onClick={() => { setMode("returning"); setError(""); }}>{T.returning}</button>
          </div>

          {error && <div style={s.error}>{error}</div>}

          {mode === "new" ? (
            <>
              <div style={s.stepLabel}>
                <span style={s.stepDot(step === 1)}>1</span>
                <span>Patient Identity</span>
                <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={s.stepDot(step === 2)}>2</span>
                <span>Medical Information</span>
              </div>

              {step === 1 && (
                <>
                  <div style={s.row}>
                    <div>
                      <label style={s.label}>{T.name} <span style={s.required}>*</span></label>
                      <input style={s.input} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Priya Sharma" />
                    </div>
                    <div>
                      <label style={s.label}>{T.gender} <span style={s.required}>*</span></label>
                      <select style={s.input} value={form.gender} onChange={e => set("gender", e.target.value)}>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div style={s.row}>
                    <div>
                      <label style={s.label}>Date of Birth <span style={s.required}>*</span></label>
                      <input
                        style={s.input}
                        type="date"
                        value={form.date_of_birth || ""}
                        onChange={e => set("date_of_birth", e.target.value)}
                      />
                      {computedAge !== null && <div style={s.hint}>Age: {computedAge} years</div>}
                    </div>
                    <div>
                      <label style={s.label}>{T.preferred_language}</label>
                      <select style={s.input} value={form.preferred_language} onChange={e => set("preferred_language", e.target.value)}>
                        {PREFERRED_LANGUAGES.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>Mobile Number <span style={s.required}>*</span></label>
                    <div style={s.mobileRow}>
                      <select style={s.input} value={form.mobile_country_code} onChange={e => set("mobile_country_code", e.target.value)}>
                        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <input
                        style={{ ...s.input, ...(form.mobile_number && !mobileValid ? s.inputError : {}) }}
                        type="tel"
                        placeholder={`${selectedCountry.digits}-digit number`}
                        value={form.mobile_number}
                        onChange={e => set("mobile_number", e.target.value.replace(/[^\d]/g, ""))}
                      />
                    </div>
                    {form.mobile_number && !mobileValid && (
                      <div style={{ ...s.hint, color: "#dc2626" }}>Should be {selectedCountry.digits} digits for {selectedCountry.code}</div>
                    )}
                  </div>

                  <div style={s.row}>
                    <div>
                      <label style={s.label}>Set a PIN (4-6 digits) <span style={s.required}>*</span></label>
                      <input
                        style={s.input}
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••"
                        value={form.pin}
                        onChange={e => set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                      <div style={s.hint}>Used to log back in — don't share it with anyone.</div>
                    </div>
                    <div>
                      <label style={s.label}>Confirm PIN <span style={s.required}>*</span></label>
                      <input
                        style={s.input}
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••"
                        value={form.confirm_pin}
                        onChange={e => set("confirm_pin", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </div>
                  </div>

                  {isMinor && (
                    <>
                      <div style={s.minorNotice}>👨‍👩‍👧 {T.minor_notice}</div>
                      <div style={s.row}>
                        <div>
                          <label style={s.label}>{T.guardian_name}</label>
                          <input style={s.input} value={form.guardian_name} onChange={e => set("guardian_name", e.target.value)} placeholder="Parent/Guardian full name" />
                        </div>
                        <div>
                          <label style={s.label}>{T.guardian_phone}</label>
                          <input style={s.input} type="tel" value={form.guardian_phone} onChange={e => set("guardian_phone", e.target.value)} placeholder="+91 98765 43210" />
                        </div>
                      </div>
                    </>
                  )}

                  <div style={s.row}>
                    <div>
                      <label style={s.label}>{T.emergency_contact}</label>
                      <input style={s.input} value={form.emergency_contact} onChange={e => set("emergency_contact", e.target.value)} placeholder="Contact name" />
                    </div>
                    <div>
                      <label style={s.label}>{T.emergency_phone}</label>
                      <input style={s.input} value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} placeholder="+91 98765 43210" />
                    </div>
                  </div>

                  <button style={s.btn} onClick={handleContinue}>
                    {lang === "hi" ? "जारी रखें" : "Continue"}
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={s.row}>
                    <div>
                      <label style={s.label}>{T.blood_group}</label>
                      <select style={s.input} value={form.blood_group} onChange={e => set("blood_group", e.target.value)}>
                        <option value="">Select Blood Group (Optional)</option>
                        {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div />
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>{T.allergies}</label>
                    <input style={s.input} value={form.allergies} onChange={e => set("allergies", e.target.value)} placeholder="e.g. Penicillin, Peanuts (or None)" />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{T.conditions}</label>
                    <input style={s.input} value={form.known_conditions} onChange={e => set("known_conditions", e.target.value)} placeholder="e.g. Asthma, Diabetes (or None)" />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{T.medications}</label>
                    <input style={s.input} value={form.current_medications} onChange={e => set("current_medications", e.target.value)} placeholder="e.g. Metformin 500mg (or None)" />
                  </div>

                  <div style={s.consentRow}>
                    <input type="checkbox" checked={form.consent_given} onChange={e => set("consent_given", e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, cursor: "pointer" }} />
                    <label style={s.consentText} onClick={() => set("consent_given", !form.consent_given)}>{T.consent_text}</label>
                  </div>

                  <div style={s.btnRow}>
                    <button style={s.secondaryBtn} onClick={() => { setStep(1); setError(""); }}>
                      {lang === "hi" ? "वापस" : "Back"}
                    </button>
                    <button style={{ ...s.btn, marginTop: 0, opacity: form.consent_given ? 1 : 0.6 }} onClick={handleRegister} disabled={loading}>
                      {loading ? "Registering..." : T.submit}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div style={s.field}>
                <label style={s.label}>{T.search_id}</label>
                <input
                  style={s.input}
                  value={searchId}
                  onChange={e => { setSearchId(e.target.value); setOtpSent(false); setError(""); }}
                  placeholder="PAT-XXXX-XXXX"
                  onKeyDown={e => e.key === "Enter" && loginMethod === "pin" && handlePinLogin()}
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>Choose login method</label>
                <div style={s.methodRow}>
                  <label style={s.methodOption(loginMethod === "pin")} onClick={() => { setLoginMethod("pin"); setError(""); }}>
                    <input type="radio" checked={loginMethod === "pin"} onChange={() => {}} style={s.radio} />
                    Patient PIN
                  </label>
                  <label style={s.methodOption(loginMethod === "otp")} onClick={() => { setLoginMethod("otp"); setError(""); setOtpSent(false); }}>
                    <input type="radio" checked={loginMethod === "otp"} onChange={() => {}} style={s.radio} />
                    OTP to registered mobile
                  </label>
                </div>
              </div>

              {loginMethod === "pin" ? (
                <>
                  <div style={s.field}>
                    <label style={s.label}>PIN</label>
                    <input
                      style={s.input}
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••"
                      value={loginPin}
                      onChange={e => setLoginPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={e => e.key === "Enter" && handlePinLogin()}
                    />
                  </div>
                  <button style={s.btn} onClick={handlePinLogin} disabled={loading}>
                    {loading ? "Loading..." : T.load}
                  </button>
                </>
              ) : (
                <>
                  {!otpSent ? (
                    <button style={s.btn} onClick={handleRequestLoginOtp} disabled={otpRequesting}>
                      {otpRequesting ? "Sending..." : "Send OTP"}
                    </button>
                  ) : (
                    <>
                      {devOtp && (
                        <div style={s.devOtpBanner}>
                          🧪 Dev mode — your OTP is <strong>{devOtp}</strong> (SMS delivery not yet configured)
                        </div>
                      )}
                      <div style={s.field}>
                        <label style={s.label}>Enter OTP</label>
                        <input
                          style={s.input}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={e => e.key === "Enter" && handleOtpLogin()}
                        />
                      </div>
                      <div style={s.btnRow}>
                        <button style={s.secondaryBtn} onClick={handleRequestLoginOtp} disabled={otpRequesting}>
                          {otpRequesting ? "Resending..." : "Resend"}
                        </button>
                        <button style={{ ...s.btn, marginTop: 0 }} onClick={handleOtpLogin} disabled={loading}>
                          {loading ? "Verifying..." : "Verify & Login"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              <div style={s.forgotWrap}>
                <button style={s.linkBtn} onClick={() => (forgotMode ? closeForgot() : openForgotChoice())}>
                  {forgotMode ? T.forgot_id_back : "Forgot Patient ID or PIN?"}
                </button>
              </div>

              {forgotMode === "choose" && (
                <div style={s.forgotPanel}>
                  <div style={s.forgotTitle}>What did you forget?</div>
                  <div style={s.btnRow}>
                    <button style={s.secondaryBtn} onClick={openForgotId}>Patient ID</button>
                    <button style={{ ...s.secondaryBtn, marginTop: 0 }} onClick={openForgotPin}>PIN</button>
                  </div>
                </div>
              )}

              {forgotMode === "id" && (
                <div style={s.forgotPanel}>
                  <div style={s.forgotTitle}>{T.forgot_id_title}</div>
                  <div style={s.forgotSubtitle}>{T.forgot_id_subtitle}</div>

                  {forgotError && <div style={s.error}>{forgotError}</div>}

                  {foundId ? (
                    <>
                      <div style={s.successBox}>
                        <div style={s.successLabel}>{T.forgot_id_found_prefix}</div>
                        <div style={s.successId}>{foundId}</div>
                      </div>
                      <button style={s.btn} onClick={useFoundId}>{T.forgot_id_use}</button>
                    </>
                  ) : (
                    <>
                      <div style={s.field}>
                        <label style={s.label}>{T.forgot_id_name}</label>
                        <input style={s.input} value={forgotForm.name} onChange={e => setForgot("name", e.target.value)} placeholder="e.g. Priya Sharma" />
                      </div>

                      <div style={s.field}>
                        <label style={s.label}>{T.forgot_id_mobile}</label>
                        <div style={s.mobileRow}>
                          <select style={s.input} value={forgotForm.mobile_country_code} onChange={e => setForgot("mobile_country_code", e.target.value)}>
                            {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                          </select>
                          <input
                            style={s.input}
                            type="tel"
                            placeholder={`${forgotSelectedCountry.digits}-digit number`}
                            value={forgotForm.mobile_number}
                            onChange={e => setForgot("mobile_number", e.target.value.replace(/[^\d]/g, ""))}
                          />
                        </div>
                      </div>

                      <div style={s.field}>
                        <label style={s.label}>{T.forgot_id_dob}</label>
                        <input
                          style={s.input}
                          type="date"
                          value={forgotForm.date_of_birth}
                          onChange={e => setForgot("date_of_birth", e.target.value)}
                        />
                      </div>

                      <button style={s.btn} onClick={handleForgotSubmit} disabled={forgotLoading}>
                        {forgotLoading ? "Searching..." : T.forgot_id_submit}
                      </button>
                    </>
                  )}
                </div>
              )}

              {forgotMode === "pin" && (
                <div style={s.forgotPanel}>
                  <div style={s.forgotTitle}>Reset Your PIN</div>
                  <div style={s.forgotSubtitle}>We'll send a verification code to your registered mobile number.</div>

                  {forgotPinError && <div style={s.error}>{forgotPinError}</div>}

                  {forgotPinSuccess ? (
                    <>
                      <div style={s.successBox}>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>Your PIN has been reset successfully.</div>
                      </div>
                      <button style={s.btn} onClick={finishForgotPin}>Continue to Login</button>
                    </>
                  ) : forgotPinStep === 1 ? (
                    <>
                      <div style={s.field}>
                        <label style={s.label}>Patient ID</label>
                        <input
                          style={s.input}
                          value={forgotPinId}
                          onChange={e => setForgotPinId(e.target.value)}
                          placeholder="PAT-XXXX-XXXX"
                        />
                      </div>
                      <button style={s.btn} onClick={handleForgotPinRequestOtp} disabled={forgotPinLoading}>
                        {forgotPinLoading ? "Sending..." : "Send OTP"}
                      </button>
                    </>
                  ) : (
                    <>
                      {forgotPinDevOtp && (
                        <div style={s.devOtpBanner}>
                          🧪 Dev mode — your OTP is <strong>{forgotPinDevOtp}</strong> (SMS delivery not yet configured)
                        </div>
                      )}
                      <div style={s.field}>
                        <label style={s.label}>Enter OTP</label>
                        <input
                          style={s.input}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          value={forgotPinOtp}
                          onChange={e => setForgotPinOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        />
                      </div>
                      <div style={s.row}>
                        <div>
                          <label style={s.label}>New PIN</label>
                          <input
                            style={s.input}
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••"
                            value={forgotPinNew}
                            onChange={e => setForgotPinNew(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          />
                        </div>
                        <div>
                          <label style={s.label}>Confirm New PIN</label>
                          <input
                            style={s.input}
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="••••"
                            value={forgotPinConfirm}
                            onChange={e => setForgotPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          />
                        </div>
                      </div>
                      <button style={s.btn} onClick={handleForgotPinSubmit} disabled={forgotPinLoading}>
                        {forgotPinLoading ? "Saving..." : "Reset PIN"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
