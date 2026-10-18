import { useParams, useNavigate, Link } from "react-router-dom";
import { getTopicBySlug, EMERGENCY_NUMBER } from "../data/emergencyKnowledgeData";
import EmergencyGuideLayout from "../components/EmergencyGuideLayout";

function Section({ title, icon, items, tone }) {
  const toneColors = {
    default: { bg: "var(--surface)", border: "var(--border)" },
    good: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)" },
    bad: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)" },
  };
  const c = toneColors[tone] || toneColors.default;

  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{icon} {title}</div>
      <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function EmergencyGuideDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const topic = getTopicBySlug(slug);

  if (!topic) {
    return (
      <EmergencyGuideLayout>
        <p style={{ color: "var(--muted)" }}>Topic not found.</p>
        <Link to="/emergency-guide" style={{ color: "var(--accent)", fontSize: 13 }}>← Back to Emergency Guide</Link>
      </EmergencyGuideLayout>
    );
  }

  return (
    <EmergencyGuideLayout>
      <button onClick={() => navigate("/emergency-guide")} style={{
        border: "none", background: "transparent", color: "var(--accent)", fontSize: 13,
        cursor: "pointer", marginBottom: 16, padding: 0,
      }}>
        ← Back to Emergency Guide
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 48 }}>{topic.icon}</div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{topic.title}</h2>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{topic.summary}</div>
        </div>
      </div>

      <div style={{
        background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
        borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex",
        alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <span style={{ fontSize: 13 }}>In doubt or symptoms worsening — call immediately:</span>
        <a href={`tel:${EMERGENCY_NUMBER}`} style={{ fontSize: 20, fontWeight: 900, color: "#EF4444" }}>
          {EMERGENCY_NUMBER}
        </a>
      </div>

      <Section title="Recognize the Symptoms" icon="🔍" items={topic.symptoms} />
      <Section title="Immediate Steps" icon="🩹" items={topic.steps} />
      <Section title="Do" icon="✅" items={topic.dos} tone="good" />
      <Section title="Don't" icon="🚫" items={topic.donts} tone="bad" />

      <div style={{
        background: "var(--stat-bg)", borderRadius: 10, padding: "12px 16px",
        fontSize: 11, color: "var(--muted)", lineHeight: 1.6, marginTop: 8,
      }}>
        <strong>Source: </strong>{topic.source} This information is for general awareness and does not
        replace professional first-aid training or emergency medical care.
      </div>
    </EmergencyGuideLayout>
  );
}
