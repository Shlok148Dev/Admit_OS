"""Layout-adaptive PDF Extractor — services/data/extractors/pdf_extractor.py.

Extracts tables from admission cutoff PDFs falling back from pdfplumber to Camelot to regex.
Ensures columns are normalised correctly.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List
import pdfplumber

logger = logging.getLogger("pdf_extractor")

HEADER_MAP: Dict[str, str] = {
    "opening_rank": "opening_rank",
    "opening rank": "opening_rank",
    "opening": "opening_rank",
    "rank from": "opening_rank",
    "merit no from": "opening_rank",
    "merit no (from)": "opening_rank",
    "or": "opening_rank",
    "closing_rank": "closing_rank",
    "closing rank": "closing_rank",
    "closing": "closing_rank",
    "rank to": "closing_rank",
    "merit no to": "closing_rank",
    "merit no (to)": "closing_rank",
    "cr": "closing_rank",
    "college_code": "college_code",
    "college code": "college_code",
    "inst code": "college_code",
    "institute code": "college_code",
    "college": "college_code",
    "institute": "college_code",
    "college_name": "college_name",
    "college name": "college_name",
    "institute name": "college_name",
    "branch_code": "branch_code",
    "branch code": "branch_code",
    "br code": "branch_code",
    "branch": "branch_code",
    "program code": "branch_code",
    "branch_name": "branch_name",
    "branch name": "branch_name",
    "program name": "branch_name",
    "program": "branch_name",
    "category": "category",
    "seat type": "category",
    "quota": "quota",
    "allotted quota": "quota",
    "gender": "gender",
}


def normalise_header(header: str) -> str:
    """Normalise a header name to a standard key if known."""
    clean = str(header).strip().lower().replace("_", " ").replace(".", "")
    return HEADER_MAP.get(clean, clean)


def map_row_to_record(row_data: Dict[str, Any]) -> Dict[str, Any]:
    """Map dynamic keys of a row to normalised keys."""
    record: Dict[str, Any] = {}
    for k, v in row_data.items():
        norm_key = normalise_header(k)
        if norm_key in ["opening_rank", "closing_rank"]:
            try:
                record[norm_key] = int(re.sub(r"[^0-9]", "", str(v)))
            except (ValueError, TypeError):
                record[norm_key] = 0
        else:
            record[norm_key] = str(v).strip() if v is not None else ""
    return record


class PDFExtractor:
    """Adaptive PDF extractor with pdfplumber -> Camelot -> regex fallback."""

    def extract_with_pdfplumber(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Attempt table extraction using pdfplumber."""
        records: List[Dict[str, Any]] = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    table = page.extract_table()
                    if not table or len(table) < 2:
                        continue
                    headers = [str(h or "") for h in table[0]]
                    for row in table[1:]:
                        if not row or all(c is None for c in row):
                            continue
                        row_dict = {
                            headers[i]: row[i]
                            for i in range(min(len(headers), len(row)))
                        }
                        records.append(map_row_to_record(row_dict))
        except Exception as e:
            logger.warning(f"pdfplumber extraction failed: {e}")
        return records

    def extract_with_camelot(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Attempt table extraction using camelot lattice/stream."""
        records: List[Dict[str, Any]] = []
        try:
            import camelot  # type: ignore[import]

            tables = camelot.read_pdf(pdf_path, pages="all", flavor="lattice")
            if not tables or len(tables) == 0:
                tables = camelot.read_pdf(pdf_path, pages="all", flavor="stream")
            for t in tables:
                df = t.df
                if df.empty or len(df) < 2:
                    continue
                headers = [str(h) for h in df.iloc[0]]
                for _, row in df.iloc[1:].iterrows():
                    row_dict = {
                        headers[i]: row.iloc[i]
                        for i in range(min(len(headers), len(row)))
                    }
                    records.append(map_row_to_record(row_dict))
        except Exception as e:
            logger.warning(f"Camelot extraction failed or not installed: {e}")
        return records

    def extract_text_fallback(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Fallback to raw text regex parsing when structure-based fails."""
        records: List[Dict[str, Any]] = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                full_text = ""
                for page in pdf.pages:
                    txt = page.extract_text()
                    if txt:
                        full_text += txt + "\n"
            records = self.parse_text_with_regex(full_text)
        except Exception as e:
            logger.error(f"Text fallback extraction failed: {e}")
        return records

    def parse_text_with_regex(self, text: str) -> List[Dict[str, Any]]:
        """Parse raw text line-by-line to extract columns."""
        records: List[Dict[str, Any]] = []
        lines = text.split("\n")
        # Match lines like: college branch category quota opening closing gender
        # e.g., "102 CS OPEN OS 1250 2345 Gender-Neutral"
        pattern = re.compile(
            r"^\s*([A-Za-z0-9_\-]+)\s+(.+?)\s+(OPEN|OBC[ \-NCL]*|SC|ST|EWS)\s+"
            r"([A-Z]{2})\s+(\d+)\s+(\d+)\s*(.*)$",
            re.IGNORECASE,
        )
        for line in lines:
            line_str = line.strip()
            match = pattern.match(line_str)
            if match:
                records.append(
                    {
                        "college_code": match.group(1),
                        "branch_code": match.group(2),
                        "category": match.group(3),
                        "quota": match.group(4),
                        "opening_rank": int(match.group(5)),
                        "closing_rank": int(match.group(6)),
                        "gender": match.group(7).strip(),
                    }
                )
        return records

    def extract(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Adaptive entry point with fallbacks."""
        logger.info(f"Extracting PDF: {pdf_path}")
        res = self.extract_with_pdfplumber(pdf_path)
        if res:
            logger.info(f"Successfully extracted {len(res)} rows via pdfplumber")
            return res

        res = self.extract_with_camelot(pdf_path)
        if res:
            logger.info(f"Successfully extracted {len(res)} rows via Camelot")
            return res

        logger.info("Structure extraction failed, falling back to regex")
        res = self.extract_text_fallback(pdf_path)
        logger.info(f"Regex extracted {len(res)} rows")
        return res
