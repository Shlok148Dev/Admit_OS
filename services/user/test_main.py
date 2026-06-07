import os
import time
import pytest
import jwt
from datetime import datetime
from fastapi.testclient import TestClient

# Set DATABASE_URL to a local SQLite file for tests
test_db_path = "test_user.db"
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"

# Import app AFTER setting env var
from services.user.main import app
from services.user.db import Base, engine, SessionLocal
from services.user.models import User
from services.user.config import settings

# Ensure tables are created for testing
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_user_and_db():
    # Re-create all tables to ensure clean DB
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Insert test user
    db = SessionLocal()
    user = User(
        id=123,
        email="userprofile@example.com",
        name="Profile User",
        is_verified=True,
        is_active=True,
        tier="FREE",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.close()
    
    yield
    
    # Clean up the test database file
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass

@pytest.fixture
def auth_headers():
    # Generate mock JWT token
    token = jwt.encode(
        {"sub": "123", "type": "access", "exp": time.time() + 3600},
        settings.JWT_SECRET,
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "user-service"}

def test_get_profile(auth_headers):
    response = client.get("/v1/profile/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "userprofile@example.com"
    assert data["name"] == "Profile User"

def test_patch_profile(auth_headers):
    payload = {
        "name": "Updated Name",
        "phone": "1112223333"
    }
    response = client.patch("/v1/profile/me", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
    assert response.json()["phone"] == "1112223333"

def test_post_exam_details(auth_headers):
    payload = {
        "primary_exam": "NEET",
        "exam_year": 2025,
        "rank": 1500,
        "percentile": 99.85,
        "category": "OBC_NCL",
        "home_state": "KA",
        "gender": "F",
        "preferences": {
            "branch_priority": 0.5,
            "college_tier_priority": 0.5
        }
    }
    response = client.post("/v1/profile/exam-details", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["rank"] == 1500
    assert response.json()["primary_exam"] == "NEET"

def test_delete_profile(auth_headers):
    response = client.delete("/v1/profile/me", headers=auth_headers)
    assert response.status_code == 200
    assert "deleted" in response.json()["message"]

    # Verify soft-deleted user cannot query profile anymore
    get_again = client.get("/v1/profile/me", headers=auth_headers)
    assert get_again.status_code == 401
