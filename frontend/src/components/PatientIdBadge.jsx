import { useState, useEffect, useRef } from "react";

export default function PatientIdBadge({ patient }) {
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showFirstTimeTip, setShowFirstTimeTip] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!patient?.id) return;
    const flagKey = `medialert_new_registration_${patient.id}`;
    if (sessionStorage.getItem(flagKey)) {
      setShowFirstTimeTip(true);
      sessionStorage.removeItem(flagKey);
    }
  }, [patient?.id]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowInfo(false);
      }
    }
    if (showInfo) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInfo]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(patient.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.createElement("textarea");
      el.value = patient.id;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  if (!patient) return null;

  const s = {
    wrap: { position: "relative", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 },
    badge: {
      display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)",
      background: "var(--stat-bg)", padding: "6px 12px", borderRadius: 10, border: "1px solid var(--border)",
      whiteSpace: "nowrap", maxWidth: 260,
    },
    name: {
      maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      color: "var(--text)", fontWeight: 600,
    },
    sep: { opacity: 0.5, flexShrink: 0 },
    id: { flexShrink: 0, fontVariantNumeric: "tabular-nums" },
    iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "var(--muted)", fontSize: 13, borderRadius: 6, flexShrink: 0 },
    toast: { position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#22C55E", color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 8, whiteSpace: "nowrap", zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" },
    popover: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 260, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" },
    popoverTitle: { fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 8 },
    popoverText: { fontSize: 12, color: "var(--muted)", lineHeight: 1.6 },
    tipBanner: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 280, background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", borderRadius: 14, padding: "14px 16px", zIndex: 201, boxShadow: "0 10px 30px rgba(59,130,246,0.35)" },
    tipTitle: { fontSize: 13, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 },
    tipText: { fontSize: 12, lineHeight: 1.6, opacity: 0.95 },
    tipClose: { position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 14, opacity: 0.8 },
  };

  return (
    <div style={s.wrap} ref={popoverRef}>
      <span style={s.badge} title={`${patient.name} · ${patient.id}`}>
        <span style={s.name}>{patient.name}</span>
        <span style={s.sep}>·</span>
        <span style={s.id}>{patient.id}</span>
        <button style={s.iconBtn} onClick={handleCopy} title="Copy Patient ID" aria-label="Copy Patient ID">📋</button>
        <button style={s.iconBtn} onClick={() => setShowInfo(v => !v)} title="Why is this important?" aria-label="Why is this important?">ⓘ</button>
      </span>

      {copied && <div style={s.toast}>✅ Patient ID copied</div>}

      {showInfo && !showFirstTimeTip && (
        <div style={s.popover}>
          <div style={s.popoverTitle}>Why is this important?</div>
          <div style={s.popoverText}>
            Keep this Patient ID safe. It is required to:
            <br />• Retrieve your medical history on a future visit
            <br />• Let hospital staff look up your records quickly
            <br />• Recover access if you switch devices
            <br /><br />Keep it somewhere you can find again.
          </div>
        </div>
      )}

      {showFirstTimeTip && (
        <div style={s.tipBanner}>
          <button style={s.tipClose} onClick={() => setShowFirstTimeTip(false)} aria-label="Dismiss">✕</button>
          <div style={s.tipTitle}>💡 Save your Patient ID</div>
          <div style={s.tipText}>
            <strong>{patient.id}</strong> is how you'll access your records next time. Copy it now and store it somewhere safe -- you won't see this reminder again.
          </div>
        </div>
      )}
    </div>
  );
}
