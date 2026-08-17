"""Unit tests for PDFExtractor column normalization and adaptive extraction fallbacks."""

from unittest.mock import MagicMock, patch

from services.data.extractors.pdf_extractor import (
    PDFExtractor,
    normalise_header,
    map_row_to_record,
)


def test_normalise_header() -> None:
    """Test that various header synonyms map to normalized keys."""
    assert normalise_header("Opening Rank") == "opening_rank"
    assert normalise_header("Rank From") == "opening_rank"
    assert normalise_header("Merit No From") == "opening_rank"
    assert normalise_header("Closing Rank") == "closing_rank"
    assert normalise_header("CR") == "closing_rank"
    assert normalise_header("Institute Code") == "college_code"
    assert normalise_header("arbitrary") == "arbitrary"


def test_map_row_to_record() -> None:
    """Test row key mapping and rank type casting."""
    row = {
        "Rank From": "1,250",
        "CR": " 2,450 ",
        "Institute": "NIT_TRICHY",
        "Quota": "OS",
    }
    expected = {
        "opening_rank": 1250,
        "closing_rank": 2450,
        "college_code": "NIT_TRICHY",
        "quota": "OS",
    }
    result = map_row_to_record(row)
    assert result == expected


def test_parse_text_with_regex() -> None:
    """Test regex parsing on a multiline raw text block."""
    extractor = PDFExtractor()
    sample_text = (
        "102 CS OPEN OS 1250 2345 Gender-Neutral\n"
        "203 ME SC HS 4500 8900 Female-only\n"
        "Invalid line format"
    )
    records = extractor.parse_text_with_regex(sample_text)
    assert len(records) == 2
    assert records[0]["college_code"] == "102"
    assert records[0]["branch_code"] == "CS"
    assert records[0]["category"] == "OPEN"
    assert records[0]["quota"] == "OS"
    assert records[0]["opening_rank"] == 1250
    assert records[0]["closing_rank"] == 2345
    assert records[0]["gender"] == "Gender-Neutral"

    assert records[1]["college_code"] == "203"
    assert records[1]["branch_code"] == "ME"
    assert records[1]["category"] == "SC"
    assert records[1]["quota"] == "HS"
    assert records[1]["opening_rank"] == 4500
    assert records[1]["closing_rank"] == 8900
    assert records[1]["gender"] == "Female-only"


@patch("services.data.extractors.pdf_extractor.pdfplumber.open")
def test_extract_pdfplumber_success(mock_open: MagicMock) -> None:
    """Test successful extraction using pdfplumber."""
    extractor = PDFExtractor()
    mock_pdf = MagicMock()
    mock_page = MagicMock()
    mock_page.extract_table.return_value = [
        ["College Code", "OR", "CR"],
        ["NIT_K", "100", "200"],
    ]
    mock_pdf.pages = [mock_page]
    mock_open.return_value.__enter__.return_value = mock_pdf

    res = extractor.extract("dummy.pdf")
    assert len(res) == 1
    assert res[0]["college_code"] == "NIT_K"
    assert res[0]["opening_rank"] == 100
    assert res[0]["closing_rank"] == 200


@patch("services.data.extractors.pdf_extractor.PDFExtractor.extract_with_pdfplumber")
@patch("services.data.extractors.pdf_extractor.PDFExtractor.extract_with_camelot")
@patch("services.data.extractors.pdf_extractor.PDFExtractor.extract_text_fallback")
def test_extract_fallback_logic(
    mock_fallback: MagicMock,
    mock_camelot: MagicMock,
    mock_pdfplumber: MagicMock,
) -> None:
    """Test that extract falls back to camelot and then to text regex."""
    extractor = PDFExtractor()

    # 1. pdfplumber succeeds, camelot not called
    mock_pdfplumber.return_value = [{"college_code": "PLUMBER"}]
    res = extractor.extract("dummy.pdf")
    assert res == [{"college_code": "PLUMBER"}]
    mock_camelot.assert_not_called()

    # 2. pdfplumber fails (empty), camelot succeeds, regex fallback not called
    mock_pdfplumber.return_value = []
    mock_camelot.return_value = [{"college_code": "CAMELOT"}]
    res = extractor.extract("dummy.pdf")
    assert res == [{"college_code": "CAMELOT"}]
    mock_fallback.assert_not_called()

    # 3. Both structure extractors fail, fallback called
    mock_pdfplumber.return_value = []
    mock_camelot.return_value = []
    mock_fallback.return_value = [{"college_code": "REGEX"}]
    res = extractor.extract("dummy.pdf")
    assert res == [{"college_code": "REGEX"}]
