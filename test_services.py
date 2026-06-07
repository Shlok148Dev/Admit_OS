import os
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

# Configure environment for testing — must match service default keys
# to avoid JWT secret mismatch when settings singleton is cached
os.environ["DATABASE_URL"] = "sqlite:///./test_admitos.db"
os.environ["ENVIRONMENT"] = "development"
os.environ["JWT_SECRET"] = "super-secret-access-key-12345"
os.environ["JWT_REFRESH_SECRET"] = "super-secret-refresh-key-54321"

from services.auth.main import app as auth_app
from services.user.main import app as user_app
from services.auth.db import Base, engine, SessionLocal
from services.user.db import engine as user_engine, Base as UserBase
from services.auth.models import User, RefreshToken
from services.user.models import StudentProfile, PredictionHistory


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    # Fully dispose connections and wipe the shared SQLite file
    engine.dispose()
    user_engine.dispose()
    for dbf in ["./test_admitos.db", "test_admitos.db"]:
        if os.path.exists(dbf):
            try:
                os.remove(dbf)
            except Exception:
                pass

    # Create all tables for both services (both write to same SQLite file)
    Base.metadata.create_all(bind=engine)
    UserBase.metadata.create_all(bind=user_engine)
    yield
    engine.dispose()
    user_engine.dispose()
    for dbf in ["./test_admitos.db", "test_admitos.db"]:
        if os.path.exists(dbf):
            try:
                os.remove(dbf)
            except Exception:
                pass


auth_client = TestClient(auth_app)
user_client = TestClient(user_app)

def test_register_login_refresh_flow():
    # 1. Register User
    reg_data = {"email": "services_test_student@example.com", "password": "securepassword123", "name": "Admit Aspirant", "phone": "9876543210"}
    resp = auth_client.post("/v1/auth/register", json=reg_data)
    print("Register Status Code:", resp.status_code)
    print("Register Response Body:", resp.text)
    assert resp.status_code == 201
    assert "verify your email" in resp.json()["message"]

    # Manually verify the user in db for login (or via verification token)
    db = SessionLocal()
    db_user = db.query(User).filter(User.email == "services_test_student@example.com").first()
    db_user.is_verified = True
    db.commit()
    db.close()

    # 2. Login User
    login_data = {"email": "services_test_student@example.com", "password": "securepassword123"}
    resp = auth_client.post("/v1/auth/login", json=login_data)
    assert resp.status_code == 200
    tokens = resp.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    # 3. Refresh Token
    refresh_resp = auth_client.post("/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    
    return tokens["access_token"]

def test_sso_endpoints():
    # Google SSO
    resp = auth_client.post("/v1/auth/google-sso", json={"token": "mock-google-token"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    # Apple SSO
    resp = auth_client.post("/v1/auth/apple-sso", json={"token": "mock-apple-token"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()

def test_user_profile_operations():
    """Test user profile CRUD via user service endpoints."""
    import jwt as pyjwt
    from datetime import timedelta
    from services.user.db import SessionLocal as UserSessionLocal
    from services.user.models import User as UserServiceUser

    # Directly seed a user into user service's DB (avoids cross-service session issues)
    user_db = UserSessionLocal()
    test_user = UserServiceUser(
        email="services_test_profile@example.com",
        name="Profile User",
        hashed_password="doesnotmatter",
        is_verified=True,
        is_active=True,
    )
    user_db.add(test_user)
    user_db.commit()
    user_db.refresh(test_user)
    user_id = test_user.id
    user_db.close()

    # Mint a valid JWT using the user service's JWT_SECRET
    from services.user.config import settings as user_settings
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=15),
    }
    access_token = pyjwt.encode(payload, user_settings.JWT_SECRET, algorithm="HS256")
    headers = {"Authorization": f"Bearer {access_token}"}

    # 1. Get Profile
    get_resp = user_client.get("/v1/profile/me", headers=headers)
    assert get_resp.status_code == 200, f"Expected 200, got {get_resp.status_code}: {get_resp.text}"
    assert get_resp.json()["email"] == "services_test_profile@example.com"

    # 2. Update Profile
    update_resp = user_client.patch(
        "/v1/profile/me",
        json={"name": "Updated Name", "phone": "1112223333"},
        headers=headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Name"

    # 3. Post Exam Details (student_profile)
    exam_data = {
        "primary_exam": "JEE_MAIN",
        "exam_year": 2026,
        "rank": 4500,
        "percentile": 99.54,
        "category": "GENERAL",
        "home_state": "MH",
        "gender": "M",
        "preferences": {"CS": 0.8, "EC": 0.2}
    }
    exam_resp = user_client.post("/v1/profile/exam-details", json=exam_data, headers=headers)
    assert exam_resp.status_code == 200
    assert exam_resp.json()["rank"] == 4500

    # 4. Soft-delete Profile
    del_resp = user_client.delete("/v1/profile/me", headers=headers)
    assert del_resp.status_code == 200
    assert "permanently deleted" in del_resp.json()["message"]

    # Verify soft-deleted user cannot query profile anymore
    get_again = user_client.get("/v1/profile/me", headers=headers)
    assert get_again.status_code == 401
