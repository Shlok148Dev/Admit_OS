import logging
import re
from datetime import datetime
from typing import List
import jwt
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from services.notification.config import settings
from services.notification.db import get_db, init_db
from services.notification.cache import get_cached, set_cached
from services.notification.models import (
    User,
    StudentProfile,
    NotificationLog,
    NotificationTemplate,
    CounselingSchedule,
    NotificationSubscription,
    NotificationPreference,
    DeviceToken,
)
from services.notification.schemas import (
    PreferenceUpdate,
    SubscribeRequest,
    SubscribeResponse,
    NotificationFeedItem,
    UpcomingEventResponse,
    MessageResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("notification_service.main")

app = FastAPI(title="ADMIT OS Notification Microservice", version="1.0.0")

security = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or token type",
            )
        return int(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def get_current_user(
    user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active or user.deleted_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )
    return user


def render_text(template: str, variables: dict) -> str:
    if not template:
        return ""
    if not variables:
        return template

    def replacer(match):
        key = match.group(1)
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{([^{}]+)\}", replacer, template)


def seed_initial_data(db: Session) -> None:
    # Seed templates
    templates = [
        {
            "template_key": "round_result_live",
            "channel": "PUSH",
            "title_template": "Round {round_number} Seat Allotment is Live!",
            "body_template": "Congratulations! You have been allotted {college_name} for {branch_name} in Round {round_number}.",
            "exam_type": None,
            "priority": "CRITICAL",
        },
        {
            "template_key": "deadline_warning_6h",
            "channel": "SMS",
            "title_template": "URGENT: Counseling Deadline approaching",
            "body_template": "Only 6 hours left to accept your seat and upload documents for Round {round_number}. Action required immediately!",
            "exam_type": None,
            "priority": "HIGH",
        },
        {
            "template_key": "new_data_available",
            "channel": "EMAIL",
            "title_template": "New Cutoff Data Available for {exam_type}",
            "body_template": "Verified cutoff data is now available for {exam_type} {year} Round {round_number}. Click here to update your prediction radar.",
            "exam_type": None,
            "priority": "NORMAL",
        },
        {
            "template_key": "document_checklist",
            "channel": "EMAIL",
            "title_template": "Your Required Documents Checklist for {exam_type}",
            "body_template": "Based on your allotment in {college_name}, here is your mandatory document checklist: {checklist}.",
            "exam_type": None,
            "priority": "HIGH",
        },
    ]
    for t_data in templates:
        existing = (
            db.query(NotificationTemplate)
            .filter(NotificationTemplate.template_key == t_data["template_key"])
            .first()
        )
        if not existing:
            db.add(NotificationTemplate(**t_data))
            logger.info(f"Seeded notification template: {t_data['template_key']}")

    # Seed JoSAA 2025 schedules
    schedules = [
        {
            "event_name": "JoSAA 2025 Registration and Choice Filling Starts",
            "exam_type": "JEE_MAIN",
            "round_number": None,
            "event_date": datetime(2025, 6, 10, 10, 0, 0),
            "action_required": True,
            "official_url": "https://josaa.nic.in",
        },
        {
            "event_name": "JoSAA 2025 Mock Allotment 1",
            "exam_type": "JEE_MAIN",
            "round_number": None,
            "event_date": datetime(2025, 6, 15, 14, 0, 0),
            "action_required": False,
            "official_url": "https://josaa.nic.in",
        },
        {
            "event_name": "JoSAA 2025 Round 1 Seat Allotment",
            "exam_type": "JEE_MAIN",
            "round_number": 1,
            "event_date": datetime(2025, 6, 20, 10, 0, 0),
            "action_required": True,
            "official_url": "https://josaa.nic.in",
        },
        {
            "event_name": "JoSAA 2025 Round 2 Seat Allotment",
            "exam_type": "JEE_MAIN",
            "round_number": 2,
            "event_date": datetime(2025, 6, 27, 17, 0, 0),
            "action_required": True,
            "official_url": "https://josaa.nic.in",
        },
        {
            "event_name": "JoSAA 2025 Round 3 Seat Allotment",
            "exam_type": "JEE_MAIN",
            "round_number": 3,
            "event_date": datetime(2025, 7, 4, 17, 0, 0),
            "action_required": True,
            "official_url": "https://josaa.nic.in",
        },
        {
            "event_name": "JoSAA 2025 Round 4 Seat Allotment",
            "exam_type": "JEE_MAIN",
            "round_number": 4,
            "event_date": datetime(2025, 7, 10, 17, 0, 0),
            "action_required": True,
            "official_url": "https://josaa.nic.in",
        },
        {
            "event_name": "JoSAA 2025 Round 5 Seat Allotment",
            "exam_type": "JEE_MAIN",
            "round_number": 5,
            "event_date": datetime(2025, 7, 17, 17, 0, 0),
            "action_required": True,
            "official_url": "https://josaa.nic.in",
        },
    ]
    for s_data in schedules:
        existing = (
            db.query(CounselingSchedule)
            .filter(
                CounselingSchedule.event_name == s_data["event_name"],
                CounselingSchedule.exam_type == s_data["exam_type"],
            )
            .first()
        )
        if not existing:
            db.add(CounselingSchedule(**s_data))
            logger.info(f"Seeded counseling schedule event: {s_data['event_name']}")

    db.commit()


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    db = next(get_db())
    try:
        seed_initial_data(db)
    finally:
        db.close()


@app.get("/health")
def health_check() -> dict:
    return {"status": "healthy", "service": "notification-service"}


@app.get("/v1/notifications/feed", response_model=List[NotificationFeedItem])
def get_notification_feed(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    # Fetch user preferences
    prefs = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )
    disabled_channels = []
    if prefs and prefs.channels:
        disabled_channels = [
            ch for ch, enabled in prefs.channels.items() if not enabled
        ]

    # Fetch student profile for candidate filtering
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == current_user.id)
        .first()
    )

    # Query notifications specifically for this user or broadcast notifications (user_id is Null)
    query = db.query(NotificationLog).filter(
        (NotificationLog.user_id == current_user.id)
        | (NotificationLog.user_id.is_(None))
    )

    # Filter out disabled channels
    if disabled_channels:
        query = query.filter(~NotificationLog.channel.in_(disabled_channels))

    logs = query.all()

    # Filter logs based on student profile exam, category, and home state
    filtered_logs = []
    for log in logs:
        # Filter by exam relevance if present
        if log.exam_relevance and profile and profile.primary_exam:
            if log.exam_relevance != profile.primary_exam:
                continue

        # Filter by category and home state if stored in variables and profile exists
        if log.variables and profile:
            target_cat = log.variables.get("category")
            if target_cat and target_cat != profile.category:
                continue

            target_state = log.variables.get("home_state")
            if target_state and target_state != profile.home_state:
                continue

        filtered_logs.append(log)

    feed_items = []
    for log in filtered_logs:
        # Load the template to render it
        tpl = (
            db.query(NotificationTemplate)
            .filter(NotificationTemplate.template_key == log.template_id)
            .first()
        )

        if tpl:
            title = render_text(tpl.title_template, log.variables or {})
            body = render_text(tpl.body_template, log.variables or {})
        else:
            title = f"Alert: {log.template_id}"
            body = str(log.variables or "")

        feed_items.append(
            NotificationFeedItem(
                id=log.id,
                channel=log.channel,
                template_id=log.template_id,
                variables=log.variables,
                status=log.status,
                sent_at=log.sent_at,
                created_at=log.created_at,
                exam_relevance=log.exam_relevance,
                title=title,
                body=body,
            )
        )

    return feed_items


@app.post("/v1/notifications/preferences", response_model=MessageResponse)
def update_preferences(
    payload: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == current_user.id)
        .first()
    )
    if not pref:
        pref = NotificationPreference(
            user_id=current_user.id, channels=payload.channels
        )
        db.add(pref)
    else:
        pref.channels = payload.channels
    db.commit()
    return MessageResponse(message="Notification preferences updated successfully.")


@app.get("/v1/notifications/upcoming", response_model=List[UpcomingEventResponse])
def get_upcoming_notifications(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == current_user.id)
        .first()
    )

    exam_type = profile.primary_exam if (profile and profile.primary_exam) else "ALL"
    cache_key = f"events:{exam_type}"
    cached = get_cached(cache_key)
    if cached:
        return [UpcomingEventResponse(**item) for item in cached]

    query = db.query(CounselingSchedule)

    # Filter events by candidate's registered exam type
    if profile and profile.primary_exam:
        exams = [profile.primary_exam]
        if profile.primary_exam == "JEE_MAIN":
            exams.append("JEE_ADVANCED")
        elif profile.primary_exam == "JEE_ADVANCED":
            exams.append("JEE_MAIN")
        query = query.filter(CounselingSchedule.exam_type.in_(exams))

    events = query.all()

    now = datetime.utcnow()
    results = []
    for event in events:
        event_date_naive = (
            event.event_date.replace(tzinfo=None)
            if event.event_date.tzinfo
            else event.event_date
        )
        countdown = (event_date_naive - now).days
        results.append(
            UpcomingEventResponse(
                id=event.id,
                event_name=event.event_name,
                exam_type=event.exam_type,
                round_number=event.round_number,
                event_date=event.event_date,
                action_required=event.action_required,
                official_url=event.official_url,
                countdown_days=countdown,
            )
        )

    set_cached(cache_key, [r.model_dump() for r in results], ttl=1800)  # 30 minutes TTL
    return results


def _register_device_token(db: Session, user_id: int, token: str, platform: str) -> int:
    existing = db.query(DeviceToken).filter(DeviceToken.token == token).first()
    if existing:
        existing.user_id = user_id
        existing.platform = platform
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
        db.commit()
        return int(existing.id)
    new_token = DeviceToken(
        user_id=user_id, token=token, platform=platform, is_active=True
    )
    db.add(new_token)
    db.commit()
    db.refresh(new_token)
    return int(new_token.id)


@app.post("/v1/notifications/subscribe", response_model=SubscribeResponse)
def subscribe_to_updates(
    payload: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub_id = None
    msg_parts = []
    if payload.device_token and payload.platform:
        sub_id = _register_device_token(
            db, current_user.id, payload.device_token, payload.platform
        )
        msg_parts.append("device registered")
    if payload.exam_type or payload.college_code:
        sub = NotificationSubscription(
            user_id=current_user.id,
            exam_type=payload.exam_type,
            college_code=payload.college_code,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        sub_id = sub.id
        msg_parts.append("topic subscription created")
    msg = (
        f"Successfully subscribed: {', '.join(msg_parts)}."
        if msg_parts
        else "Successfully subscribed to updates."
    )
    return SubscribeResponse(message=msg, subscription_id=sub_id)
