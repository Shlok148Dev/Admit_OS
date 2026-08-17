import os
import json
from unittest.mock import patch
from fastapi.testclient import TestClient

from services.counseling.config import Settings
from services.counseling.rag.chat import (
    _detect_query_style,
    _build_system_prompt,
)
from services.counseling.main import app


def test_query_style_detection():
    """Test 1: Verify query style detection categorizes questions correctly."""
    assert _detect_query_style("Hi ARIA, how are you?") == "GREETING"
    assert (
        _detect_query_style("What is the cutoff for CSE at NIT Trichy?")
        == "CUTOFF_CHANCES"
    )
    assert (
        _detect_query_style("Can you explain the float vs freeze rules?") == "RULES_QA"
    )
    assert (
        _detect_query_style("Which is better between IIT Bombay and IIT Delhi?")
        == "COMPARISON"
    )
    assert _detect_query_style("Random question about campus life.") == "GENERAL"


def test_senior_counselor_prompt_formatting():
    """Test 2: Verify senior counselor prompt includes query style and category."""
    student_ctx = {"rank": 1500, "category": "OBC_NCL", "home_state": "KA"}
    prompt = _build_system_prompt(
        exam_type="JEE_MAIN",
        student_context=student_ctx,
        retrieved=[],
        query_style="COMPARISON",
    )
    assert "Detected Query Style: COMPARISON" in prompt
    assert "Rank: 1500" in prompt
    assert "Category: OBC_NCL" in prompt
    assert "Home State: KA" in prompt
    assert "official senior AI admissions counselor" in prompt


def test_config_loading_and_fallback():
    """Test 3: Verify settings initialization does not crash and handles environment values."""
    with patch.dict(
        os.environ, {"REDIS_HOST": "test-redis-host", "ANTHROPIC_API_KEY": "test-key"}
    ):
        settings = Settings()
        assert settings.REDIS_HOST == "test-redis-host"
        assert settings.ANTHROPIC_API_KEY == "test-key"


@patch("services.counseling.main.redis_client")
def test_redis_history_chat_flow(mock_redis):
    """Test 4: Verify chat endpoint loads history from and saves history to Redis."""
    # Set up mock Redis
    mock_redis.get.return_value = json.dumps(
        [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi, how can I help?"},
        ]
    )

    # Mock ARIAChatEngine to prevent calling real APIs
    with patch("services.counseling.main._chat_engine.chat") as mock_chat:
        from services.counseling.schemas import ChatResponse

        mock_chat.return_value = ChatResponse(
            answer="Float means upgrading.",
            confidence="HIGH",
            sources=["rules.txt"],
            warning=None,
        )

        client = TestClient(app)
        req_body = {
            "session_id": "test-session-123",
            "query": "What is float?",
            "history": [],
            "exam_type": "JEE_MAIN",
            "student_context": {
                "user_id": 1,
                "rank": 5000,
                "category": "GENERAL",
                "home_state": "MH",
            },
        }

        response = client.post("/v1/counsel/chat", json=req_body)
        assert response.status_code == 200

        # Verify redis.get was called with correct key
        mock_redis.get.assert_called_with("chat_history:test-session-123")

        # Verify redis.setex was called to save the updated history
        mock_redis.setex.assert_called()
        args, kwargs = mock_redis.setex.call_args
        assert args[0] == "chat_history:test-session-123"
        saved_history = json.loads(args[2])
        assert len(saved_history) == 4
        assert saved_history[-2]["content"] == "What is float?"
        assert saved_history[-1]["content"] == "Float means upgrading."
