from sqlalchemy.orm import Session
from app.models.notification import Notification


def notify_patient(db: Session, patient_id: str, event_type: str, message: str, link: str = None):
    n = Notification(patient_id=patient_id, admin_id=None, event_type=event_type, message=message, link=link)
    db.add(n)
    return n


def notify_admin(db: Session, admin_id: str, event_type: str, message: str, link: str = None):
    n = Notification(patient_id=None, admin_id=admin_id, event_type=event_type, message=message, link=link)
    db.add(n)
    return n


def notify_all_admins(db: Session, event_type: str, message: str, link: str = None):
    """Used for events like a new issue being reported, where any admin could pick it up."""
    from app.models.admin import Admin
    admins = db.query(Admin).filter(Admin.is_active == 1).all()
    for a in admins:
        notify_admin(db, a.id, event_type, message, link)


def notify_all_super_admins(db: Session, event_type: str, message: str, link: str = None):
    """Used for events only Super Admins need to know about, e.g. a new admin being added."""
    from app.models.admin import Admin
    admins = db.query(Admin).filter(Admin.is_active == 1, Admin.role == "super_admin").all()
    for a in admins:
        notify_admin(db, a.id, event_type, message, link)
