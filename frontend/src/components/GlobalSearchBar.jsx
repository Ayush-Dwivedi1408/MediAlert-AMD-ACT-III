import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function GlobalSearchBar() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    navigate(`/admin/patients?q=${encodeURIComponent(value.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: 360 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search Patient ID, Name, Mobile, Disease, Blood Group…"
        style={{
          width: "100%", padding: "8px 14px", borderRadius: 10,
          border: "1px solid var(--border)", background: "var(--input-bg)",
          color: "var(--text)", fontSize: 12, outline: "none",
        }}
      />
    </form>
  );
}
