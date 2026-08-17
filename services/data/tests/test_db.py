"""Unit tests for database schema constraints and structure.

Parses the schema migration file to verify constraint definitions, indexes,
partitions, and column specifications.
Reference: Technical Bible Section 5.1 & Section 12.1.
"""

import os
import re

import pytest

SCHEMA_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "infra",
        "db",
        "migrations",
        "001_initial_schema.sql",
    )
)


@pytest.fixture(scope="module")
def schema_content() -> str:
    """Fixture to read the SQL initial schema content."""
    assert os.path.exists(SCHEMA_PATH), f"Schema file not found at {SCHEMA_PATH}"
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return f.read()


def test_schema_has_users_table(schema_content: str) -> None:
    """Ensure the users table is created before referenced."""
    pattern = r"CREATE TABLE\s+(IF NOT EXISTS\s+)?users\s*\("
    assert re.search(pattern, schema_content, re.IGNORECASE) is not None


def test_schema_has_colleges_table_and_constraints(schema_content: str) -> None:
    """Ensure colleges table exists with valid college type checks."""
    table_pattern = r"CREATE TABLE\s+(IF NOT EXISTS\s+)?colleges\s*\("
    assert re.search(table_pattern, schema_content, re.IGNORECASE) is not None

    constraint_pattern = (
        r"CONSTRAINT\s+valid_type\s+CHECK\s*\(\s*type\s+IN\s*\("
        r"\s*'IIT'\s*,\s*'NIT'\s*,\s*'IIIT'\s*,\s*'GFTI'\s*,\s*'DEEMED'\s*,"
        r"\s*'STATE'\s*,\s*'PRIVATE'\s*\)\s*\)"
    )
    assert re.search(constraint_pattern, schema_content, re.IGNORECASE) is not None


def test_schema_has_exam_cutoffs_rank_constraint(schema_content: str) -> None:
    """Ensure exam_cutoffs table exists and closing_rank >= opening_rank is enforced."""
    table_pattern = r"CREATE TABLE\s+(IF NOT EXISTS\s+)?exam_cutoffs\s*\("
    assert re.search(table_pattern, schema_content, re.IGNORECASE) is not None

    constraint_pattern = r"CONSTRAINT\s+chk_closing_rank_gte_opening\s+CHECK\s*\(\s*closing_rank\s*>=\s*opening_rank\s*\)"
    assert re.search(constraint_pattern, schema_content, re.IGNORECASE) is not None


def test_schema_has_student_profiles_ssn_constraint(schema_content: str) -> None:
    """Ensure student_profiles enforces no sensitive data (ssn) check constraint."""
    table_pattern = r"CREATE TABLE\s+(IF NOT EXISTS\s+)?student_profiles\s*\("
    assert re.search(table_pattern, schema_content, re.IGNORECASE) is not None

    # Verify no ssn constraint in preferences column
    constraint_pattern = r"CONSTRAINT\s+no_sensitive_data\s+CHECK\s*\(\s*preferences::text\s+NOT\s+LIKE\s+'%\"ssn\"%'\s*\)"
    assert re.search(constraint_pattern, schema_content, re.IGNORECASE) is not None


def test_schema_has_partitioning_defined(schema_content: str) -> None:
    """Ensure partitioned tables are declared with correct syntax and partitions exist."""
    # Check cutoffs partition declarations
    partition_by_pattern = r"PARTITION BY LIST\s*\(\s*year\s*\)"
    assert re.search(partition_by_pattern, schema_content, re.IGNORECASE) is not None

    partitions = ["2026", "2025", "2024", "2023", "2022", "default"]
    for part in partitions:
        part_pattern = rf"CREATE TABLE\s+(IF NOT EXISTS\s+)?exam_cutoffs_{part}\s+PARTITION OF\s+exam_cutoffs"
        assert re.search(part_pattern, schema_content, re.IGNORECASE) is not None


def test_schema_has_indexes_defined(schema_content: str) -> None:
    """Ensure required indexes for performance optimization are declared."""
    idx_prediction = r"CREATE INDEX\s+(IF NOT EXISTS\s+)?idx_cutoffs_prediction\s+ON\s+exam_cutoffs\s*\(\s*exam_type\s*,\s*year\s*,\s*category\s*,\s*closing_rank\s*\)"
    idx_college = r"CREATE INDEX\s+(IF NOT EXISTS\s+)?idx_cutoffs_college\s+ON\s+exam_cutoffs\s*\(\s*college_code\s*,\s*branch_code\s*,\s*year\s*\)"

    assert re.search(idx_prediction, schema_content, re.IGNORECASE) is not None
    assert re.search(idx_college, schema_content, re.IGNORECASE) is not None
