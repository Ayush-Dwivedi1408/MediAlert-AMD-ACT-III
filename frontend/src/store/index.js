import { create } from "zustand";

export const useStore = create((set, get) => ({
  // ─── Patient ──────────────────────────────────────────────────────────────
  patient: null,
  setPatient: (patient) => set({ patient }),
  clearPatient: () => set({ patient: null, currentVisit: null, results: null }),

  // ─── Current visit flow ───────────────────────────────────────────────────
  currentVisit: null,
  setCurrentVisit: (visit) => set({ currentVisit: visit }),

  results: null,
  setResults: (results) => set({ results }),

  // ─── Alerts ───────────────────────────────────────────────────────────────
  unreadAlerts: 0,
  setUnreadAlerts: (count) => set({ unreadAlerts: count }),
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),

  // ─── UI ───────────────────────────────────────────────────────────────────
  dark: true,
  toggleDark: () => set((s) => ({ dark: !s.dark })),

  lang: "en",
  toggleLang: () => set((s) => ({ lang: s.lang === "en" ? "hi" : "en" })),

  // ─── Offline queue ────────────────────────────────────────────────────────
  offlineQueue: [],
  addToOfflineQueue: (item) =>
    set((s) => ({ offlineQueue: [...s.offlineQueue, { ...item, queued_at: Date.now() }] })),
  clearOfflineQueue: () => set({ offlineQueue: [] }),
  isOnline: navigator.onLine,
  setOnline: (val) => set({ isOnline: val }),

  // ─── Admin auth ───────────────────────────────────────────────────────────
  adminToken: localStorage.getItem("admin_token") || null,
  adminUser: JSON.parse(localStorage.getItem("admin_user") || "null"),
  setAdmin: (token, adminUser) => {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_user", JSON.stringify(adminUser));
    set({ adminToken: token, adminUser });
  },
  clearAdmin: () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    set({ adminToken: null, adminUser: null });
  },
}));
