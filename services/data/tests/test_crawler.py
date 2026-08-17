"""Unit tests for WebCrawlerAgent hash-diffing and event publishing logic.

Reference: Technical Bible Section 10.1.
"""

from typing import Any, Dict
from unittest.mock import MagicMock

import pytest

from services.data.crawler.web_crawler import WebCrawlerAgent


@pytest.fixture
def crawler() -> WebCrawlerAgent:
    """Fixture to instantiate the WebCrawlerAgent."""
    return WebCrawlerAgent(crawler_id="test_josaa_crawler")


def test_calculate_hash_returns_correct_sha256(crawler: WebCrawlerAgent) -> None:
    """Test that SHA-256 is correctly calculated for a given string."""
    content = "<html><body>Test Content</body></html>"
    expected = "d4cfae5a684cf07c146121e41c3d16ecc271a3880f923219b020ec26404db160"
    assert crawler.calculate_hash(content) == expected


def test_check_and_process_page_no_change(crawler: WebCrawlerAgent) -> None:
    """Test that check_and_process_page returns None and does not publish if hash is unchanged."""
    crawler.fetch_page = MagicMock(return_value="<html>Same Content</html>")  # type: ignore[method-assign]
    crawler.publish_to_kafka = MagicMock()  # type: ignore[method-assign]

    prev_hash = crawler.calculate_hash("<html>Same Content</html>")
    result = crawler.check_and_process_page(
        "http://example.com/josaa", "JEE_MAIN", prev_hash
    )

    assert result is None
    crawler.publish_to_kafka.assert_not_called()


def test_check_and_process_page_with_change(crawler: WebCrawlerAgent) -> None:
    """Test that check_and_process_page publishes event and returns new hash on content change."""
    crawler.fetch_page = MagicMock(return_value="<html>New Content</html>")  # type: ignore[method-assign]
    crawler.publish_to_kafka = MagicMock()  # type: ignore[method-assign]

    prev_hash = crawler.calculate_hash("<html>Old Content</html>")
    result = crawler.check_and_process_page(
        "http://example.com/josaa", "JEE_MAIN", prev_hash
    )

    new_hash = crawler.calculate_hash("<html>New Content</html>")
    assert result == new_hash

    crawler.publish_to_kafka.assert_called_once()
    args, _ = crawler.publish_to_kafka.call_args
    topic: str = args[0]
    payload: Dict[str, Any] = args[1]

    assert topic == "data.raw.documents"
    assert payload["crawler_id"] == "test_josaa_crawler"
    assert payload["source_url"] == "http://example.com/josaa"
    assert payload["document_hash"] == new_hash
    assert payload["exam_type"] == "JEE_MAIN"
    assert "timestamp" in payload


def test_fetch_page_failure_raises_exception(crawler: WebCrawlerAgent) -> None:
    """Test that fetch_page raises an exception if the HTTP fetch fails."""

    def mock_fail(url: str) -> str:
        raise ValueError("Network timeout")

    crawler.fetch_page = MagicMock(side_effect=mock_fail)  # type: ignore[method-assign]

    with pytest.raises(ValueError, match="Network timeout"):
        crawler.check_and_process_page("http://example.com/josaa", "JEE_MAIN", None)
