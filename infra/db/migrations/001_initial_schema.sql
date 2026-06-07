-- Migrations: 001_initial_schema.sql
-- Description: Create PostgreSQL tables for ADMIT OS: users, colleges, exam_cutoffs, student_profiles, notification_log.
-- References: Technical Bible Section 5.1, Section 12.1

-- Create users table (PII stored only here for DPDP Act 2023 compliance)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- College master table
CREATE TABLE IF NOT EXISTS colleges (
    college_code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(10) NOT NULL,  -- IIT, NIT, IIIT, GFTI, DEEMED, STATE, PRIVATE
    state VARCHAR(30) NOT NULL,
    city VARCHAR(50) NOT NULL,
    nirf_rank_engineering INTEGER,
    nirf_rank_overall INTEGER,
    naac_grade VARCHAR(5),
    established_year SMALLINT,
    total_intake INTEGER,
    hostel_available BOOLEAN,
    website_url TEXT,
    official_admission_url TEXT,
    last_verified TIMESTAMPTZ,
    CONSTRAINT valid_type CHECK (type IN ('IIT', 'NIT', 'IIIT', 'GFTI', 'DEEMED', 'STATE', 'PRIVATE'))
);

-- Core exam and counseling data, partitioned by year
CREATE TABLE IF NOT EXISTS exam_cutoffs (
    id BIGSERIAL,
    exam_type VARCHAR(20) NOT NULL,  -- JEE_MAIN, JEE_ADVANCED, NEET, MHT_CET, etc.
    counseling_body VARCHAR(20) NOT NULL,  -- JOSAA, MCC, DTE_MH, etc.
    year SMALLINT NOT NULL,
    round_number SMALLINT NOT NULL,
    college_code VARCHAR(20) NOT NULL,
    branch_code VARCHAR(10) NOT NULL,
    category VARCHAR(15) NOT NULL,
    quota VARCHAR(10) NOT NULL,
    opening_rank INTEGER,
    closing_rank INTEGER,
    total_seats SMALLINT,
    allotted_seats SMALLINT,
    data_confidence VARCHAR(6) NOT NULL CHECK (data_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
    source_url TEXT NOT NULL,
    source_document_hash VARCHAR(64),
    sme_verified BOOLEAN DEFAULT FALSE,
    sme_reviewer_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, year),
    UNIQUE(exam_type, counseling_body, year, round_number, college_code, branch_code, category, quota),
    CONSTRAINT chk_closing_rank_gte_opening CHECK (closing_rank >= opening_rank)
) PARTITION BY LIST (year);

-- Partitions for exam_cutoffs by year
CREATE TABLE IF NOT EXISTS exam_cutoffs_2026 PARTITION OF exam_cutoffs FOR VALUES IN (2026);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2025 PARTITION OF exam_cutoffs FOR VALUES IN (2025);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2024 PARTITION OF exam_cutoffs FOR VALUES IN (2024);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2023 PARTITION OF exam_cutoffs FOR VALUES IN (2023);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2022 PARTITION OF exam_cutoffs FOR VALUES IN (2022);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2021 PARTITION OF exam_cutoffs FOR VALUES IN (2021);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2020 PARTITION OF exam_cutoffs FOR VALUES IN (2020);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2019 PARTITION OF exam_cutoffs FOR VALUES IN (2019);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2018 PARTITION OF exam_cutoffs FOR VALUES IN (2018);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2017 PARTITION OF exam_cutoffs FOR VALUES IN (2017);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2016 PARTITION OF exam_cutoffs FOR VALUES IN (2016);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2015 PARTITION OF exam_cutoffs FOR VALUES IN (2015);
CREATE TABLE IF NOT EXISTS exam_cutoffs_2014 PARTITION OF exam_cutoffs FOR VALUES IN (2014);
CREATE TABLE IF NOT EXISTS exam_cutoffs_default PARTITION OF exam_cutoffs DEFAULT;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cutoffs_prediction ON exam_cutoffs(exam_type, year, category, closing_rank);
CREATE INDEX IF NOT EXISTS idx_cutoffs_college ON exam_cutoffs(college_code, branch_code, year);

-- Student profiles (privacy-first design)
CREATE TABLE IF NOT EXISTS student_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id),
    primary_exam VARCHAR(20),
    exam_year SMALLINT,
    rank INTEGER,
    percentile NUMERIC(7,4),
    category VARCHAR(15),
    home_state VARCHAR(30),
    gender VARCHAR(10),
    preferences JSONB,  -- branch weights, location preferences
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- NO NAME, EMAIL, PHONE in this table — those are in users table
    -- This table contains only exam-related data
    CONSTRAINT no_sensitive_data CHECK (preferences::text NOT LIKE '%"ssn"%')
);

-- All notifications dispatched and their status
CREATE TABLE IF NOT EXISTS notification_log (
    id BIGSERIAL,
    user_id BIGINT REFERENCES users(id),
    channel VARCHAR(10) NOT NULL,  -- PUSH, EMAIL, SMS, WHATSAPP
    template_id VARCHAR(50) NOT NULL,
    variables JSONB,
    status VARCHAR(15) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    error_message TEXT,
    exam_relevance VARCHAR(20),  -- which exam this notification is about
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitions for notification_log
CREATE TABLE IF NOT EXISTS notification_log_default PARTITION OF notification_log DEFAULT;

-- SME Review Queue for validation fallbacks / anomalies
CREATE TABLE IF NOT EXISTS sme_review_queue (
    id BIGSERIAL PRIMARY KEY,
    exam_type VARCHAR(20) NOT NULL,
    counseling_body VARCHAR(20) NOT NULL,
    year SMALLINT NOT NULL,
    round_number SMALLINT NOT NULL,
    college_code VARCHAR(20) NOT NULL,
    branch_code VARCHAR(10) NOT NULL,
    category VARCHAR(15) NOT NULL,
    quota VARCHAR(10) NOT NULL,
    opening_rank INTEGER,
    closing_rank INTEGER,
    total_seats SMALLINT,
    allotted_seats SMALLINT,
    source_url TEXT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    reviewer_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
