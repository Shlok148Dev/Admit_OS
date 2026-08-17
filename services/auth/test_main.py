import os
import pytest
from fastapi.testclient import TestClient

# Set DATABASE_URL to a local SQLite file for tests
test_db_path = "test_auth.db"
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path}"

# Import app AFTER setting env var
from services.auth.main import app
from services.auth.db import Base, engine

# Ensure tables are created for testing
Base.metadata.create_all(bind=engine)

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def cleanup_db():
    # Clean up BEFORE test run to avoid stale email state
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass
    # Recreate tables fresh
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    # Clean up AFTER test run
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "auth-service"}


def test_auth_lifecycle():
    # 1. Register
    response = client.post(
        "/v1/auth/register",
        json={"email": "student@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 201
    assert "registered" in response.json()["message"]

    # 2. Login
    response = client.post(
        "/v1/auth/login",
        json={"email": "student@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    refresh_token = data["refresh_token"]

    # 3. Refresh
    response = client.post("/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    new_refresh_token = data["refresh_token"]

    # 4. Logout
    response = client.post("/v1/auth/logout", json={"refresh_token": new_refresh_token})
    assert response.status_code == 200
    assert response.json() == {"message": "Successfully logged out"}
