from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.db.session import engine
from app.db.base import Base
from app.models import patient, visit, alert, followup, mental_health, admin, audit_log, issue, notification, feedback, admin_activity, patient_otp
from app.routers import patients, visits, symptoms, predict, alerts, admin_auth, admin_management, admin_patients, admin_audit, admin_dashboard, issues, admin_issues, notifications, admin_notifications, feedback, admin_feedback, admin_activity as admin_activity_router, admin_emergency_logs
from app.auth import verify_api_key

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MediAlert API",
    description="Emergency Decision Support Platform — AI-powered triage, severity detection, and health monitoring",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)

auth = [Depends(verify_api_key)]

app.include_router(patients.router,  prefix="/patients",  tags=["Patients"],  dependencies=auth)
app.include_router(visits.router,    prefix="/visits",    tags=["Visits"],    dependencies=auth)
app.include_router(symptoms.router,  prefix="/symptoms",  tags=["Symptoms"],  dependencies=auth)
app.include_router(alerts.router,    prefix="/alerts",    tags=["Alerts"],    dependencies=auth)
app.include_router(predict.router,   prefix="/data",      tags=["Analytics & Follow-up"], dependencies=auth)
app.include_router(admin_auth.router, prefix="/admin", tags=["Admin Auth"])
app.include_router(admin_management.router, prefix="/admin/admins", tags=["Admin Management"])
app.include_router(admin_patients.router, prefix="/admin/patients", tags=["Admin Patient Management"])
app.include_router(admin_audit.router, prefix="/admin/audit", tags=["Admin Audit"])
app.include_router(admin_dashboard.router, prefix="/admin/dashboard", tags=["Admin Dashboard"])
app.include_router(issues.router, prefix="/issues", tags=["Issues"], dependencies=auth)
app.include_router(admin_issues.router, prefix="/admin/issues", tags=["Admin Issue Management"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"], dependencies=auth)
app.include_router(admin_notifications.router, prefix="/admin/notifications", tags=["Admin Notifications"])
app.include_router(feedback.router, prefix="/feedback", tags=["Feedback"], dependencies=auth)
app.include_router(admin_feedback.router, prefix="/admin/feedback", tags=["Admin Feedback"])
app.include_router(admin_activity_router.router, prefix="/admin/activity", tags=["Admin Activity Log"])
app.include_router(admin_emergency_logs.router, prefix="/admin/emergency-logs", tags=["Admin Emergency Logs"])

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "MediAlert API v2.0"}
