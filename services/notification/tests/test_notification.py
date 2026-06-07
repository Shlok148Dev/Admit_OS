import os
from datetime import datetime, timedelta
import pytest
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup test environment variables BEFORE imports
os.environ["DATABASE_URL"] = "sqlite:///./test_notification.db"
os.environ["ENVIRONMENT"] = "testing"
os.environ["JWT_SECRET"] = "test-secret-key-12345"

from services.notification.db import Base, get_db
from services.notification.main import app, render_text
from services.notification.models import (
    User, StudentProfile, NotificationLog, NotificationTemplate,
    CounselingSchedule, NotificationSubscription, NotificationPreference
)
from services.notification.kafka_consumer import GroundTruthConsumer

TEST_DATABASE_URL = "sqlite:///./test_notification.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def generate_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=15)
    }
    return jwt.encode(payload, "test-secret-key-12345", algorithm="HS256")

@pytest.fixture(scope="module")
def db_session():
    # Remove old test db
    if os.path.exists("./test_notification.db"):
        try:
            os.remove("./test_notification.db")
        except Exception:
            pass

    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed templates for tests
    templates = [
        NotificationTemplate(
            template_key="round_result_live",
            channel="PUSH",
            title_template="Round {round_number} Seat Allotment is Live!",
            body_template="Congratulations! You have been allotted {college_name} for {branch_name} in Round {round_number}.",
            exam_type=None,
            priority="CRITICAL"
        ),
        NotificationTemplate(
            template_key="deadline_warning_6h",
            channel="SMS",
            title_template="URGENT: Counseling Deadline approaching",
            body_template="Only 6 hours left to accept your seat and upload documents for Round {round_number}. Action required immediately!",
            exam_type=None,
            priority="HIGH"
        ),
        NotificationTemplate(
            template_key="new_data_available",
            channel="EMAIL",
            title_template="New Cutoff Data Available for {exam_type}",
            body_template="Verified cutoff data is now available for {exam_type} {year} Round {round_number}.",
            exam_type=None,
            priority="NORMAL"
        )
    ]
    db.add_all(templates)

    # Seed schedules for tests
    schedules = [
        CounselingSchedule(
            event_name="JoSAA 2025 Round 1 Seat Allotment",
            exam_type="JEE_MAIN",
            round_number=1,
            event_date=datetime.utcnow() + timedelta(days=5),
            action_required=True,
            official_url="https://josaa.nic.in"
        ),
        CounselingSchedule(
            event_name="NEET 2025 Round 1 Seat Allotment",
            exam_type="NEET",
            round_number=1,
            event_date=datetime.utcnow() + timedelta(days=10),
            action_required=True,
            official_url="https://mcc.nic.in"
        )
    ]
    db.add_all(schedules)
    db.commit()
    db.close()

    yield TestingSessionLocal

    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_notification.db"):
        try:
            os.remove("./test_notification.db")
        except Exception:
            pass

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db_session):
    db = TestingSessionLocal()
    # Create user
    user = User(
        email="student_test@example.com",
        name="Test Aspirant",
        is_verified=True,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create profile
    profile = StudentProfile(
        user_id=user.id,
        primary_exam="JEE_MAIN",
        exam_year=2026,
        rank=5200,
        category="OBC_NCL",
        home_state="MH"
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    token = generate_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    yield {"user": user, "profile": profile, "token": token, "headers": headers}

    # Teardown
    db.delete(profile)
    # Clean preferences and logs associated with user
    db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).delete()
    db.query(NotificationLog).filter(NotificationLog.user_id == user.id).delete()
    db.query(NotificationSubscription).filter(NotificationSubscription.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    db.close()

# 1. Variables Substitution Test
def test_variables_substitution():
    template = "Welcome {name}! Your rank is {rank}."
    variables = {"name": "Aman", "rank": "1200"}
    rendered = render_text(template, variables)
    assert rendered == "Welcome Aman! Your rank is 1200."

    # Missing variable should remain untouched without crashing
    rendered_missing = render_text(template, {"name": "Aman"})
    assert rendered_missing == "Welcome Aman! Your rank is {rank}."

# 2. Preferences Endpoint Test
def test_preferences_endpoint(client, test_user):
    payload = {"channels": {"PUSH": True, "EMAIL": False, "SMS": True, "WHATSAPP": False}}
    resp = client.post("/v1/notifications/preferences", json=payload, headers=test_user["headers"])
    assert resp.status_code == 200
    assert "updated successfully" in resp.json()["message"]

    # Verify database update
    db = TestingSessionLocal()
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == test_user["user"].id
    ).first()
    assert pref is not None
    assert pref.channels["EMAIL"] is False
    assert pref.channels["SMS"] is True
    db.close()

# 3. Subscribe Endpoint Test
def test_subscribe_endpoint(client, test_user):
    payload = {"exam_type": "JEE_MAIN", "college_code": "NIT_TRICHY"}
    resp = client.post("/v1/notifications/subscribe", json=payload, headers=test_user["headers"])
    assert resp.status_code == 200
    assert "Successfully subscribed" in resp.json()["message"]

    # Verify subscription in database
    db = TestingSessionLocal()
    sub = db.query(NotificationSubscription).filter(
        NotificationSubscription.user_id == test_user["user"].id,
        NotificationSubscription.college_code == "NIT_TRICHY"
    ).first()
    assert sub is not None
    db.close()

# 4. Upcoming Endpoint (Countdown & Exam Filter) Test
def test_upcoming_endpoint(client, test_user):
    resp = client.get("/v1/notifications/upcoming", headers=test_user["headers"])
    assert resp.status_code == 200
    events = resp.json()
    
    # User's primary exam is JEE_MAIN, so it should return only JEE_MAIN events (JoSAA)
    # The NEET event should be filtered out.
    assert len(events) > 0
    for event in events:
        assert event["exam_type"] in ["JEE_MAIN", "JEE_ADVANCED"]
        assert "JoSAA 2025" in event["event_name"]
        # Assert action links and countdown days are present
        assert "official_url" in event
        assert "countdown_days" in event

# 5. Feed Endpoint (Render & Filter) Test
def test_feed_endpoint(client, test_user):
    db = TestingSessionLocal()

    # Create user preferences: enable PUSH, disable SMS
    pref = NotificationPreference(
        user_id=test_user["user"].id,
        channels={"PUSH": True, "SMS": False, "EMAIL": True}
    )
    db.add(pref)

    # Log 1: PUSH channel (enabled), correct exam_relevance, correct variables
    log1 = NotificationLog(
        user_id=test_user["user"].id,
        channel="PUSH",
        template_id="round_result_live",
        variables={"round_number": "1", "college_name": "NIT Trichy", "branch_name": "CSE"},
        exam_relevance="JEE_MAIN",
        status="PENDING",
        created_at=datetime.utcnow()
    )
    # Log 2: SMS channel (disabled by preferences)
    log2 = NotificationLog(
        user_id=test_user["user"].id,
        channel="SMS",
        template_id="deadline_warning_6h",
        variables={"round_number": "1"},
        exam_relevance="JEE_MAIN",
        status="PENDING",
        created_at=datetime.utcnow()
    )
    # Log 3: Different exam relevance (NEET vs user's JEE_MAIN)
    log3 = NotificationLog(
        user_id=test_user["user"].id,
        channel="PUSH",
        template_id="round_result_live",
        variables={"round_number": "1", "college_name": "AIIMS", "branch_name": "MBBS"},
        exam_relevance="NEET",
        status="PENDING",
        created_at=datetime.utcnow()
    )
    # Log 4: Different Category (SC vs user's OBC_NCL)
    log4 = NotificationLog(
        user_id=test_user["user"].id,
        channel="PUSH",
        template_id="round_result_live",
        variables={"round_number": "1", "college_name": "NIT Trichy", "branch_name": "CSE", "category": "SC"},
        exam_relevance="JEE_MAIN",
        status="PENDING",
        created_at=datetime.utcnow()
    )

    db.add_all([log1, log2, log3, log4])
    db.commit()
    db.close()

    # Call feed
    resp = client.get("/v1/notifications/feed", headers=test_user["headers"])
    assert resp.status_code == 200
    feed = resp.json()

    # Assertions:
    # - Only log1 should pass all filters (log2 has disabled channel SMS, log3 has NEET exam relevance, log4 has category SC which doesn't match OBC_NCL)
    assert len(feed) == 1
    assert feed[0]["template_id"] == "round_result_live"
    assert feed[0]["channel"] == "PUSH"
    
    # Test variables substitution in feed
    assert "Round 1 Seat Allotment is Live" in feed[0]["title"]
    assert "allotted NIT Trichy for CSE" in feed[0]["body"]

# 6. Kafka Consumer Subscriptions & Priority Routing Test
def test_kafka_consumer(db_session, test_user):
    test_user_id = test_user["user"].id

    db = TestingSessionLocal()
    
    # Create another mock user subscribed to NEET
    other_user = User(email="neet_student@example.com", name="NEET Student", is_verified=True, is_active=True)
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    other_user_id = other_user.id

    other_profile = StudentProfile(
        user_id=other_user_id,
        primary_exam="NEET",
        exam_year=2026,
        rank=12000,
        category="GENERAL",
        home_state="KA"
    )
    db.add(other_profile)
    db.commit()
    db.refresh(other_profile)

    # Subscribe test_user to updates for NEET as well
    sub = NotificationSubscription(user_id=test_user_id, exam_type="NEET")
    db.add(sub)
    db.commit()

    db.close()

    # Initialize consumer with test db Session maker
    consumer = GroundTruthConsumer(TestingSessionLocal)

    # Simulate cutoff data Kafka message for NEET Round 2
    message_value = '{ "data_type": "cutoff", "exam": "NEET", "year": 2025, "round": 2 }'
    consumer.process_message(message_value)

    db = TestingSessionLocal()
    # Check that notifications are queued for both other_user (primary exam NEET) and test_user (subscribed to NEET)
    logs_test_user = db.query(NotificationLog).filter(
        NotificationLog.user_id == test_user_id,
        NotificationLog.template_id == "new_data_available"
    ).all()
    
    logs_other_user = db.query(NotificationLog).filter(
        NotificationLog.user_id == other_user_id,
        NotificationLog.template_id == "new_data_available"
    ).all()

    # Both should have received the notification
    assert len(logs_test_user) == 1
    assert len(logs_other_user) == 1

    # Verify variables matching
    assert logs_test_user[0].variables["exam_type"] == "NEET"
    assert logs_test_user[0].variables["round_number"] == "2"

    # Verify priority routing mapping:
    # "new_data_available" priority is NORMAL, so status must be QUEUED_NORMAL
    assert logs_test_user[0].status == "QUEUED_NORMAL"

    # Let's test CRITICAL priority routing
    # We alter template priority to CRITICAL for test
    template = db.query(NotificationTemplate).filter(NotificationTemplate.template_key == "new_data_available").first()
    template.priority = "CRITICAL"
    db.commit()

    # Clear logs and run process_message again
    db.query(NotificationLog).filter(NotificationLog.template_id == "new_data_available").delete()
    db.commit()

    consumer.process_message(message_value)

    logs_after = db.query(NotificationLog).filter(
        NotificationLog.user_id == test_user_id,
        NotificationLog.template_id == "new_data_available"
    ).all()
    
    # Critical should be SENT immediately
    assert logs_after[0].status == "SENT"
    assert logs_after[0].sent_at is not None

    # Let's test HIGH priority routing
    template.priority = "HIGH"
    db.commit()
    db.query(NotificationLog).filter(NotificationLog.template_id == "new_data_available").delete()
    db.commit()

    consumer.process_message(message_value)

    logs_after_high = db.query(NotificationLog).filter(
        NotificationLog.user_id == test_user_id,
        NotificationLog.template_id == "new_data_available"
    ).all()

    # High should be QUEUED_HIGH
    assert logs_after_high[0].status == "QUEUED_HIGH"

    # Cleanup extra user
    db.delete(other_profile)
    db.query(NotificationLog).filter(NotificationLog.user_id == other_user_id).delete()
    db.delete(other_user)
    db.commit()
    db.close()


# 7. Device Token Registration Test
def test_device_token_registration(client, test_user) -> None:
    payload = {
        "device_token": "fcm-token-12345-abcde",
        "platform": "android"
    }
    resp = client.post("/v1/notifications/subscribe", json=payload, headers=test_user["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert "device registered" in data["message"]
    
    # Check db
    db = TestingSessionLocal()
    from services.notification.models import DeviceToken
    dt = db.query(DeviceToken).filter(DeviceToken.token == "fcm-token-12345-abcde").first()
    assert dt is not None
    assert dt.user_id == test_user["user"].id
    assert dt.platform == "android"
    db.close()


# 8. Senders and Push Dispatch Integration Test
def test_senders_and_dispatch(db_session, test_user) -> None:
    from unittest.mock import patch
    from services.notification.push.fcm_sender import FCMSender
    from services.notification.push.apns_sender import APNsSender

    # Force stub mode for both senders (no real Firebase/APNs credentials in CI)
    with patch("services.notification.push.fcm_sender.HAS_FIREBASE", False):
        fcm = FCMSender()
        assert fcm.send_to_token("token", "title", "body") == "mock_msg_id"
        assert len(fcm.send_batch(["token1", "token2"], "title", "body")) == 2

    apns = APNsSender()
    assert apns.send_to_token("token", "title", "body") is True
    assert len(apns.send_batch(["token1", "token2"], "title", "body")) == 2
