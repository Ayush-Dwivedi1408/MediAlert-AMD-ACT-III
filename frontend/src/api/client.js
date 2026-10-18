const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_KEY  = import.meta.env.VITE_API_KEY  || "dev-secret";

const headers = () => ({
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
});

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
if (!res.ok) {
     const err = await res.json().catch(() => ({ detail: "Network error" }));
     let message = "Request failed";
     if (Array.isArray(err.detail)) {
       message = err.detail
         .map(d => `${d.loc?.[d.loc.length - 1] ?? "field"}: ${d.msg}`)
         .join("; ");
     } else if (typeof err.detail === "string") {
       message = err.detail;
     }
     throw new Error(message);
    }
    return res.json();
  }

// ── ADMIN REQUEST (Bearer token instead of X-API-Key) ──────────────────────
function adminHeaders() {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function adminRequest(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: adminHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Network error" }));
    let message = "Request failed";
    if (Array.isArray(err.detail)) {
      message = err.detail
        .map(d => `${d.loc?.[d.loc.length - 1] ?? "field"}: ${d.msg}`)
        .join("; ");
    } else if (typeof err.detail === "string") {
      message = err.detail;
    }
    throw new Error(message);
  }
  return res.json();
}

// ── PATIENTS ──────────────────────────────────────────────────────────────────
export const api = {
  patients: {
    create:     (data) => request("POST", "/patients/", data),
    get:        (id)   => request("GET",  `/patients/${id}`),
    update:     (id, data) => request("PUT", `/patients/${id}`, data),
    summary:    (id)   => request("GET",  `/patients/${id}/summary`),
    healthCard: (id)   => request("GET",  `/patients/${id}/health-card`),
    aiSummary:  (id)   => request("GET",  `/patients/${id}/summary-v2`),
    list:       ()     => request("GET",  "/patients/"),
    auditHistory: (id) => request("GET", `/patients/${id}/audit-history`),
    lookupId:   (data) => request("POST", "/patients/lookup-id", data),
    verifyPin:  (id, pin) => request("POST", `/patients/${id}/verify-pin`, { pin }),
    setPin:     (id, pin, confirmPin) => request("POST", `/patients/${id}/set-pin`, { pin, confirm_pin: confirmPin }),
    requestOtp: (patientId, purpose) => request("POST", "/patients/otp/request", { patient_id: patientId, purpose }),
    verifyOtp:  (patientId, code, purpose) => request("POST", "/patients/otp/verify", { patient_id: patientId, code, purpose }),
    resetPin:   (id, code, newPin, confirmPin) => request("POST", `/patients/${id}/reset-pin`, { code, new_pin: newPin, confirm_pin: confirmPin }),
    // SOS emergency alert — WhatsApp Business API + SMS fallback, sent
    // server-side (never a wa.me deep link on the patient's own WhatsApp).
    sendSOSAlert: (id, { latitude, longitude } = {}) =>
      request("POST", `/patients/${id}/sos-alert`, { latitude, longitude }),
  },

  // ── VISITS ─────────────────────────────────────────────────────────────────
  visits: {
    create:     (data)      => request("POST", "/visits/", data),
    get:        (id)        => request("GET",  `/visits/${id}`),
    forPatient: (patientId) => request("GET",  `/visits/patient/${patientId}/detail`),
    list:       ()          => request("GET",  "/visits/"),
  },

  // ── SYMPTOMS ───────────────────────────────────────────────────────────────
  symptoms: {
    list: () => request("GET", "/symptoms/list"),
    mentalHealth: {
      questions: (type, lang = "en") => request("GET",  `/symptoms/mental-health/questions/${type}?lang=${lang}`),
      submit:    (data)              => request("POST", "/symptoms/mental-health/screen", data),
      history:   (patientId)        => request("GET",  `/symptoms/mental-health/history/${patientId}`),
    },
  },

  // ── ALERTS ─────────────────────────────────────────────────────────────────
  alerts: {
    forPatient: (patientId, unreadOnly = false) =>
      request("GET", `/alerts/patient/${patientId}?unread_only=${unreadOnly}`),
    markRead:    (patientId) => request("POST", `/alerts/patient/${patientId}/mark-read`),
    resolve:     (alertId)   => request("POST", `/alerts/${alertId}/resolve`),
    updateStatus:(alertId, status) => request("POST", `/alerts/${alertId}/status`, { status }),
    list:        ()          => request("GET",  "/alerts/"),
  },

  // ── ANALYTICS & FOLLOW-UP ──────────────────────────────────────────────────
  analytics: {
    overview:         () => request("GET", "/data/analytics/overview"),
    riskDistribution: () => request("GET", "/data/analytics/risk-distribution"),
    deterioration:    (patientId) => request("GET", `/data/deterioration/${patientId}`),
  },

  followup: {
    create:       (data)    => request("POST", "/data/followup", data),
    forVisit:     (visitId) => request("GET",  `/data/followup/visit/${visitId}`),
    intelligence: (visitId) => request("GET",  `/data/followup/visit/${visitId}/intelligence`),
  },

  // ── INSIGHTS (patient-facing dashboard: health score, trends, symptom
  // progress, mental wellness proxy, follow-up tracker) ──────────────────────
  insights: {
    get: (patientId) => request("GET", `/data/insights/${patientId}`),
  },
    // ── ISSUES (Support Center) ─────────────────────────────────────────────────
  issues: {
    report:     (data)      => request("POST", "/issues/", data),
    forPatient: (patientId) => request("GET",  `/issues/patient/${patientId}`),
    get:        (id)        => request("GET",  `/issues/${id}`),
    satisfaction: (id, data) => request("POST", `/issues/${id}/satisfaction`, data),
  },
 
  // ── NOTIFICATIONS (patient-facing) ──────────────────────────────────────────
  notifications: {
    forPatient:  (patientId) => request("GET",  `/notifications/patient/${patientId}`),
    unreadCount: (patientId) => request("GET",  `/notifications/patient/${patientId}/unread-count`),
    markRead:    (id)        => request("POST", `/notifications/${id}/read`),
    markAllRead: (patientId) => request("POST", `/notifications/patient/${patientId}/mark-all-read`),
  },
  feedback: {
    submit:     (data)      => request("POST", "/feedback/", data),
    forPatient: (patientId) => request("GET",  `/feedback/patient/${patientId}`),
  },

  // ── ADMIN (role-based auth — separate token from the patient X-API-Key) ────
  admin: {
    login:      (email, password) => adminRequest("POST", "/admin/login", { email, password }),
    logout:     ()                 => adminRequest("POST", "/admin/logout", {}),
    me:         ()                 => adminRequest("GET",  "/admin/me"),
    mfa: {
      verifyLogin: (pendingToken, code) => adminRequest("POST", "/admin/mfa/verify-login", { pending_token: pendingToken, code }),
      setup:       ()     => adminRequest("POST", "/admin/mfa/setup", {}),
      enable:      (code) => adminRequest("POST", "/admin/mfa/enable", { code }),
      disable:     (password) => adminRequest("POST", "/admin/mfa/disable", { password }),
    },
    // Forgot password (dev-mode OTP — see routers/admin_auth.py).
    forgotPassword: {
      request: (email) => adminRequest("POST", "/admin/forgot-password/request", { email }),
      reset:   (email, code, newPassword, confirmPassword) =>
        adminRequest("POST", "/admin/forgot-password/reset", {
          email, code, new_password: newPassword, confirm_password: confirmPassword,
        }),
    },
    // Emergency Notification Logs (SOS audit trail — WhatsApp/SMS attempts)
    emergencyLogs: {
      list: ()                  => adminRequest("GET", "/admin/emergency-logs/"),
      get:  (notificationId)    => adminRequest("GET", `/admin/emergency-logs/${notificationId}`),
    },
    listAdmins: ()                 => adminRequest("GET",  "/admin/admins/"),
    getAdmin:   (id)               => adminRequest("GET",  `/admin/admins/${id}`),
    createAdmin:(data)             => adminRequest("POST", "/admin/admins/", data),
    updateAdmin:(id, data)         => adminRequest("PUT",  `/admin/admins/${id}`, data),
    listPatients: (status = "active", search = "") => adminRequest("GET", `/admin/patients/?status=${status}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
    getPatient:      (patientId)          => adminRequest("GET",  `/admin/patients/${patientId}`),
    createPatient:   (data)               => adminRequest("POST", "/admin/patients/", data),
    editPatient:     (patientId, data)    => adminRequest("PUT",  `/admin/patients/${patientId}`, data),
    archivePatient:  (patientId, reason)  => adminRequest("POST", `/admin/patients/${patientId}/archive`, { reason }),
    restorePatient:  (patientId, reason)  => adminRequest("POST", `/admin/patients/${patientId}/restore`, reason ? { reason } : {}),
    permanentlyDeletePatient: (patientId, reason, password) => adminRequest("DELETE", `/admin/patients/${patientId}`, { reason, password }),
    auditForPatient: (patientId) => adminRequest("GET", `/admin/audit/patient/${patientId}`),
    dashboardOverview: () => adminRequest("GET", "/admin/dashboard/overview"),
    issues: {
      list:         (params = {}) => adminRequest("GET", `/admin/issues/?${new URLSearchParams(params)}`),
      get:          (id)          => adminRequest("GET", `/admin/issues/${id}`),
      assign:       (id, data)    => adminRequest("POST", `/admin/issues/${id}/assign`, data),
      accept:       (id)          => adminRequest("POST", `/admin/issues/${id}/accept`, {}),
      investigate:  (id, data)    => adminRequest("POST", `/admin/issues/${id}/investigate`, data || {}),
      respond:      (id, data)    => adminRequest("POST", `/admin/issues/${id}/respond`, data),
      reject:       (id, data)    => adminRequest("POST", `/admin/issues/${id}/reject`, data),
      addNote:      (id, data)    => adminRequest("POST", `/admin/issues/${id}/notes`, data),
      updateStatus: (id, data)    => adminRequest("POST", `/admin/issues/${id}/status`, data),
      close:        (id)          => adminRequest("POST", `/admin/issues/${id}/close`, {}),
    },
    notifications: {
      list:        ()   => adminRequest("GET",  "/admin/notifications/"),
      unreadCount: ()   => adminRequest("GET",  "/admin/notifications/unread-count"),
      markRead:    (id) => adminRequest("POST", `/admin/notifications/${id}/read`),
      markAllRead: ()   => adminRequest("POST", "/admin/notifications/mark-all-read"),
    },
    feedback: {
    list:      () => adminRequest("GET", "/admin/feedback/"),
    analytics: () => adminRequest("GET", "/admin/feedback/analytics"),
  },
    activity: {
      list: (params = {}) => adminRequest("GET", `/admin/activity/?${new URLSearchParams(params)}`),
    },
  },
};

export default api;
