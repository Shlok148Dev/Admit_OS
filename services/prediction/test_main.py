from fastapi.testclient import TestClient
from services.prediction.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "prediction-service"}


def test_predict_college():
    payload = {
        "exam": "JEE_MAIN",
        "rank": 2000,
        "percentile": 99.8,
        "category": "GENERAL",
        "home_state": "MH",
        "gender": "M",
        "year": 2025,
        "filters": {
            "branches": ["CS"],
            "college_types": ["NIT"],
            "states": ["MH", "TN"],
            "max_fees_per_year": 200000,
        },
    }
    response = client.post("/v1/predict/college", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert len(data["predictions"]) > 0
    assert data["predictions"][0]["college_code"] == "NIT_TRICHY"
    assert "metadata" in data
    assert data["metadata"]["model_version"] == "cutoff_pred_v2.3.1"
