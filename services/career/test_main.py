import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set env variables before importing app
os.environ["DATABASE_URL"] = "sqlite:///./test_career.db"
os.environ["NEO4J_URI"] = "bolt://localhost:7687"
os.environ["NEO4J_USER"] = "neo4j"
os.environ["NEO4J_PASSWORD"] = "admitos_dev"

from services.career.db import Base, get_db, SessionLocal
from services.career.models import Scholarship
from services.career.scholarship_service import find_scholarships
from services.career.seed import load_seed_data, seed_sql_scholarships
from services.career.main import app

test_engine = create_engine("sqlite:///./test_career.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    data = load_seed_data()
    seed_sql_scholarships(db, data["scholarships"])
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_career.db"):
        try:
            os.remove("./test_career.db")
        except Exception:
            pass

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_find_scholarships_by_gender(db_session):
    res = find_scholarships(db_session, gender="F")
    assert len(res) > 0
    for s in res:
        if s.eligible_genders:
            assert "F" in [g.upper() for g in s.eligible_genders]

def test_find_scholarships_by_income(db_session):
    res_5l = find_scholarships(db_session, income=500000.0)
    res_7l = find_scholarships(db_session, income=700000.0)
    assert len(res_5l) >= len(res_7l)

def test_find_scholarships_by_state(db_session):
    res_mh = find_scholarships(db_session, state="MH")
    assert len(res_mh) > 0
    for s in res_mh:
        if s.eligible_states:
            assert "MH" in [st.upper() for st in s.eligible_states]

@patch("services.career.main.get_neo4j_session")
def test_get_branch_endpoint(mock_get_sess):
    mock_session = MagicMock()
    mock_session.__enter__.return_value = mock_session
    mock_get_sess.return_value = iter([mock_session])
    mock_node = {
        "code": "CS",
        "name": "Computer Science"
    }
    mock_res1 = MagicMock()
    mock_res1.single.return_value = {"b": mock_node}
    mock_job = {
        "title": "Software Engineer", "domain": "IT", "percentage": 0.7,
        "min_sal": 800000, "max_sal": 1200000, "med_sal": 1000000,
        "companies": ["Google"], "skills": ["Python"]
    }
    mock_session.run.side_effect = [mock_res1, [mock_job], [{"name": "Algorithms"}], [{"name": "M.Tech CS"}]]
    resp = client.get("/v1/career/branch/CS")
    assert resp.status_code == 200
    assert resp.json()["code"] == "CS"
    assert resp.json()["name"] == "Computer Science"

@patch("services.career.main.get_neo4j_session")
def test_compare_branches_endpoint(mock_get_sess):
    mock_session = MagicMock()
    mock_session.__enter__.return_value = mock_session
    mock_get_sess.return_value = iter([mock_session])
    mock_node_cs = {"code": "CS", "name": "Computer Science"}
    mock_node_ec = {"code": "EC", "name": "Electronics"}
    mock_res_cs = MagicMock()
    mock_res_cs.single.return_value = {"b": mock_node_cs}
    mock_res_ec = MagicMock()
    mock_res_ec.single.return_value = {"b": mock_node_ec}
    mock_session.run.side_effect = [
        mock_res_cs, [], [], [],
        mock_res_ec, [], [], []
    ]
    resp = client.get("/v1/career/compare?b1=CS&b2=EC")
    assert resp.status_code == 200
    assert resp.json()["b1"]["code"] == "CS"
    assert resp.json()["b2"]["code"] == "EC"

@patch("services.career.main.get_neo4j_session")
def test_career_paths_endpoint(mock_get_sess):
    mock_session = MagicMock()
    mock_session.__enter__.return_value = mock_session
    mock_get_sess.return_value = iter([mock_session])
    mock_node = {"code": "CS", "name": "Computer Science"}
    mock_res = MagicMock()
    mock_res.single.return_value = {"b": mock_node}
    mock_session.run.side_effect = [mock_res, [], [], []]
    resp = client.post("/v1/career/paths", json={"branch_code": "CS"})
    assert resp.status_code == 200
    assert resp.json()["branch_code"] == "CS"

def test_scholarships_endpoint():
    resp = client.get("/v1/career/scholarships?gender=F&income=500000")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for s in data:
        if s["eligible_genders"]:
            assert "F" in [g.upper() for g in s["eligible_genders"]]
        if s["max_family_income"]:
            assert s["max_family_income"] >= 500000
