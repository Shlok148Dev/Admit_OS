import base64
from fastapi.testclient import TestClient
from services.prediction.main import app


def test_detailed_health_and_degraded_mode():
    client = TestClient(app)

    # 1. Test detailed health check
    response = client.get("/v1/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "degraded_mode" in data
    assert "hit_rate" in data
    assert "latency_ms" in data
    assert "total_requests" in data
    assert "cache_hits" in data

    # 2. Toggle degraded mode (requires basic auth)
    auth_header = {
        "Authorization": "Basic "
        + base64.b64encode(b"admin:admin_secure_pass123").decode("utf-8")
    }

    # Enable degraded mode
    response = client.post("/v1/admin/degraded-mode?enabled=true", headers=auth_header)
    assert response.status_code == 200
    assert response.json() == {"degraded_mode": True}

    # Check detailed health reports degraded
    response = client.get("/v1/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert data["degraded_mode"] is True
    assert data["status"] == "degraded"

    # Disable degraded mode
    response = client.post("/v1/admin/degraded-mode?enabled=false", headers=auth_header)
    assert response.status_code == 200
    assert response.json() == {"degraded_mode": False}

    # Check detailed health reports healthy (assuming redis is healthy)
    response = client.get("/v1/health/detailed")
    assert response.status_code == 200
    data = response.json()
    assert data["degraded_mode"] is False
