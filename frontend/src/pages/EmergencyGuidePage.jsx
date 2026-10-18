import { useNavigate } from "react-router-dom";
import { emergencyTopics, EMERGENCY_NUMBER } from "../data/emergencyKnowledgeData";
import EmergencyGuideLayout from "../components/EmergencyGuideLayout";

export default function EmergencyGuidePage() {
  const navigate = useNavigate();

  return (
    <EmergencyGuideLayout>
      <div style={{
        background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
        borderRadius: 14, padding: 18, marginBottom: 24, textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>In a life-threatening emergency, call</div>
        <a href={`tel:${EMERGENCY_NUMBER}`} style={{ fontSize: 32, fontWeight: 900, color: "#EF4444" }}>
          {EMERGENCY_NUMBER}
        </a>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>India's national emergency helpline (police, fire, medical)</div>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Emergency Knowledge Base</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        Quick first-aid guidance for common emergencies. Select a topic below.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {emergencyTopics.map((topic) => (
          <div
            key={topic.slug}
            onClick={() => navigate(`/emergency-guide/${topic.slug}`)}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
              padding: 20, cursor: "pointer", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>{topic.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{topic.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{topic.summary}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
        This content is for general awareness only and is not a substitute for professional medical
        training or emergency services. Compiled with reference to WHO Basic Emergency Care guidance,
        ICMR/NCDC Standard Treatment Guidelines, the National Poisons Information Centre (AIIMS New
        Delhi), and first-aid principles taught under the NMC (National Medical Commission) framework.
        Source details are listed on each topic page.
      </div>
    </EmergencyGuideLayout>
  );
}
