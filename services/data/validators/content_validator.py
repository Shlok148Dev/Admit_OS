"""
Content Validation Agent — services/data/validators/content_validator.py

Implements ContentValidationAgent with 4 required checks:
1. Schema verification
2. Range verification (closing >= opening)
3. 3-sigma historical plausibility check
4. Cross-source validation (multi-source agreement matching confidence tiering)

Pushes low-confidence or anomalous rows to `sme_review_queue`.
DPDP compliance: No student PII is validated or processed here. Only aggregate cutoff statistics.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from services.prediction.database import SMEReviewQueue

logger = logging.getLogger("content_validator")

class ContentValidationAgent:
    """Agent responsible for checking incoming exam cutoff records before ingestion."""

    def __init__(self, db_session: Optional[Session] = None) -> None:
        self.db = db_session

    def validate_schema(self, record: Dict[str, Any]) -> List[str]:
        """Verify presence of fields, correct data types, and range of metadata."""
        errors: List[str] = []
        required_fields = [
            "exam_type", "counseling_body", "year", "round_number",
            "college_code", "branch_code", "category", "quota",
            "opening_rank", "closing_rank", "source_url"
        ]
        
        # 1. Required keys check
        for field in required_fields:
            if field not in record or record[field] is None:
                errors.append(f"Missing required field: '{field}'")
                
        if errors:
            return errors

        # 2. Type validation
        if not isinstance(record["exam_type"], str) or record["exam_type"] not in ["JEE_MAIN", "JEE_ADVANCED", "NEET", "MHT_CET"]:
            errors.append(f"Invalid exam_type: {record.get('exam_type')}")
            
        if not isinstance(record["counseling_body"], str) or not record["counseling_body"]:
            errors.append("counseling_body must be a non-empty string")
            
        if not isinstance(record["year"], int) or not (2000 <= record["year"] <= 2100):
            errors.append(f"Invalid year: {record.get('year')}")
            
        if not isinstance(record["round_number"], int) or record["round_number"] <= 0:
            errors.append(f"Invalid round_number: {record.get('round_number')}")
            
        if not isinstance(record["college_code"], str) or not record["college_code"]:
            errors.append("college_code must be a non-empty string")
            
        if not isinstance(record["branch_code"], str) or not record["branch_code"]:
            errors.append("branch_code must be a non-empty string")
            
        if not isinstance(record["category"], str) or not record["category"]:
            errors.append("category must be a non-empty string")
            
        if not isinstance(record["quota"], str) or not record["quota"]:
            errors.append("quota must be a non-empty string")

        if not isinstance(record["opening_rank"], int) or record["opening_rank"] <= 0:
            errors.append(f"opening_rank must be a positive integer, got: {record.get('opening_rank')}")

        if not isinstance(record["closing_rank"], int) or record["closing_rank"] <= 0:
            errors.append(f"closing_rank must be a positive integer, got: {record.get('closing_rank')}")
            
        if not isinstance(record["source_url"], str) or not record["source_url"].startswith("http"):
            errors.append("source_url must be a valid http/https URL")

        return errors

    def validate_range(self, record: Dict[str, Any]) -> List[str]:
        """Verify closing_rank >= opening_rank."""
        errors: List[str] = []
        op = record.get("opening_rank")
        cl = record.get("closing_rank")
        if isinstance(op, int) and isinstance(cl, int):
            if cl < op:
                errors.append(f"Range check failed: closing_rank ({cl}) is less than opening_rank ({op})")
        return errors

    def validate_historical_plausibility(
        self, record: Dict[str, Any], historical_ranks: List[int]
    ) -> List[str]:
        """
        Check historical plausibility using 3-sigma anomaly detection.
        Fallback to 50% deviation check if standard deviation is zero or data points are sparse.
        """
        anomalies: List[str] = []
        if not historical_ranks:
            return anomalies

        cl = record.get("closing_rank")
        if not isinstance(cl, int):
            return anomalies

        n = len(historical_ranks)
        mean = sum(historical_ranks) / n

        if n < 3:
            # Sparse data fallback: 50% deviation check
            max_dev = mean * 0.50
            if abs(cl - mean) > max_dev:
                anomalies.append(
                    f"Historical anomaly (sparse data): closing_rank {cl} deviates by more than 50% from mean {mean:.2f}"
                )
            return anomalies

        variance = sum((x - mean) ** 2 for x in historical_ranks) / n
        std_dev = math.sqrt(variance)

        if std_dev == 0:
            # Fallback if historical ranks are all identical
            if cl != int(mean):
                anomalies.append(
                    f"Historical anomaly (zero variance): closing_rank {cl} differs from static history mean {mean:.2f}"
                )
            return anomalies

        sigma_distance = abs(cl - mean) / std_dev
        if sigma_distance > 3.0:
            anomalies.append(
                f"Historical anomaly (3-sigma): closing_rank {cl} deviates by {sigma_distance:.2f} sigma from mean {mean:.2f} (std_dev: {std_dev:.2f})"
            )

        return anomalies

    def validate_cross_source(self, cross_source_values: List[int]) -> tuple[str, List[str]]:
        """
        Validate agreement across multiple scraped values.
        Agreement required:
          - 3/3 matching values: HIGH confidence
          - 2/3 matching values: MEDIUM confidence
          - Else: LOW confidence
        Returns:
          (confidence_tier, errors)
        """
        errors: List[str] = []
        if not cross_source_values:
            return "HIGH", []

        # Count frequencies of values
        freqs: Dict[int, int] = {}
        for val in cross_source_values:
            freqs[val] = freqs.get(val, 0) + 1

        most_common_count = max(freqs.values())
        total_sources = len(cross_source_values)

        if total_sources >= 3:
            if most_common_count == total_sources:
                return "HIGH", []
            elif most_common_count >= 2:
                # Triggers review but accepted at MEDIUM confidence
                return "MEDIUM", ["Minor cross-source disagreement (2/3 matching)"]
            else:
                return "LOW", ["Major cross-source disagreement (no majority matching)"]
        elif total_sources == 2:
            if most_common_count == 2:
                return "HIGH", []
            else:
                return "LOW", ["Cross-source disagreement between 2 sources"]
        else:
            # Single source
            return "MEDIUM", ["Only 1 source available"]

    def process_and_validate(
        self,
        record: Dict[str, Any],
        historical_ranks: Optional[List[int]] = None,
        cross_source_values: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Run all validation checks on the record.
        Saves low-confidence or anomalous records to the sme_review_queue.
        """
        # 1. Schema Check
        schema_errors = self.validate_schema(record)
        if schema_errors:
            self._push_to_sme_queue(record, f"Schema errors: {', '.join(schema_errors)}")
            return {
                "is_valid": False,
                "confidence": "LOW",
                "errors": schema_errors,
                "anomalies": []
            }

        # 2. Range Check
        range_errors = self.validate_range(record)
        
        # 3. Historical 3-sigma check
        anomalies = self.validate_historical_plausibility(record, historical_ranks or [])

        # 4. Cross-source check
        confidence, cross_errors = self.validate_cross_source(cross_source_values or [])

        all_errors = range_errors + cross_errors
        is_valid = len(range_errors) == 0

        # Triggers for SME Review Queue:
        # - Any range error
        # - Any historical anomaly
        # - Low confidence tier
        # - High -> Medium downgrade (cross_errors present)
        should_review = (
            not is_valid or 
            len(anomalies) > 0 or 
            confidence == "LOW" or 
            len(cross_errors) > 0
        )

        if should_review:
            reasons = []
            if range_errors:
                reasons.append("Range check failed")
            if anomalies:
                reasons.extend(anomalies)
            if cross_errors:
                reasons.extend(cross_errors)
            if confidence == "LOW":
                reasons.append("Low confidence data")
            
            self._push_to_sme_queue(record, "; ".join(reasons))

        return {
            "is_valid": is_valid and (confidence != "LOW"),
            "confidence": confidence,
            "errors": all_errors,
            "anomalies": anomalies
        }

    def _push_to_sme_queue(self, record: Dict[str, Any], reason: str) -> None:
        """Push low confidence or anomalous row to sme_review_queue."""
        if not self.db:
            logger.warning("No DB session provided. Skipping push to sme_review_queue for: %s", reason)
            return

        try:
            queue_item = SMEReviewQueue(
                exam_type=record["exam_type"],
                counseling_body=record["counseling_body"],
                year=record["year"],
                round_number=record["round_number"],
                college_code=record["college_code"],
                branch_code=record["branch_code"],
                category=record["category"],
                quota=record["quota"],
                opening_rank=record.get("opening_rank"),
                closing_rank=record.get("closing_rank"),
                total_seats=record.get("total_seats"),
                allotted_seats=record.get("allotted_seats"),
                source_url=record["source_url"],
                reason=reason[:255],  # Ensure fits in VARCHAR(255)
                resolved=False
            )
            self.db.add(queue_item)
            self.db.commit()
            logger.info("Successfully pushed anomalous record to sme_review_queue. Reason: %s", reason)
        except Exception as e:
            if self.db:
                self.db.rollback()
            logger.error("Failed to push to sme_review_queue: %s", e, exc_info=True)
