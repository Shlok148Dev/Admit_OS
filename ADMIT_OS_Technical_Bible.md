# ADMIT OS — Technical Bible
## Production-Grade Architecture, AI/ML Systems, and Engineering Specifications
### Version 1.0 | Classification: Internal Engineering Reference

---

## 1. SYSTEM OVERVIEW

ADMIT OS is a **real-time, AI-first, microservices-based platform** serving students in the post-competitive exam phase (JEE, NEET, MHT-CET, KCET, and 20+ other exams). It processes official counseling data, runs ML prediction models, and delivers personalized guidance via web and mobile applications.

**Scale targets at peak (JoSAA Round 1 results day):**
- 500,000 concurrent users
- 2M prediction requests/hour
- 50,000 notification events/second
- < 200ms P99 API response time for predictions
- 99.95% uptime SLA during counseling windows

**The absolute technical non-negotiable:** Zero tolerance for hallucinated counseling data. Every AI-generated response must be traceable to a verified source or explicitly marked as a model estimate with confidence bounds.

---

## 2. TECH STACK — COMPLETE SPECIFICATION

### 2.1 Core Languages

| Language | Version | Usage |
|----------|---------|-------|
| Python | 3.11+ | ML/AI services, data pipelines, backend services |
| TypeScript | 5.x | Frontend (web + mobile), API type contracts |
| Go | 1.22+ | High-throughput services: notification dispatch, prediction serving at scale |
| SQL | PostgreSQL dialect | All relational queries, analytics |

### 2.2 Backend & API Layer

| Component | Technology | Why |
|-----------|-----------|-----|
| Primary API framework | FastAPI 0.111+ | Async, auto-docs, Pydantic v2 validation |
| High-performance prediction serving | FastAPI + Gunicorn + Uvicorn workers | Async request handling for ML inference |
| Inter-service communication | gRPC (protobuf) | Low-latency ML service calls |
| Message broker | Apache Kafka 3.7 | Event-driven architecture, replay capability |
| API Gateway | Kong + Cloud Armor | Rate limiting, auth, DDoS, routing |
| GraphQL layer | Strawberry (Python) | Flexible frontend queries (college profiles, career graph) |
| WebSockets | FastAPI WebSocket | Live counseling round result updates |

### 2.3 Databases & Storage

| Store | Technology | Data Stored |
|-------|-----------|-------------|
| Primary relational DB | PostgreSQL 16 (Cloud SQL) | Student profiles, college data, cutoffs, counseling schedules |
| Graph DB | Neo4j 5.x (AuraDB) | Career graph: branch→skills→jobs→companies→salaries |
| Vector store | FAISS + Pinecone (hybrid) | RAG embeddings for counseling knowledge base |
| Cache | Redis 7.x (Memorystore) | Hot cutoff data, session tokens, rate limiting, prediction cache |
| Time-series | TimescaleDB (PostgreSQL extension) | Historical rank trends, model accuracy timelines |
| Object storage | Google Cloud Storage | PDF documents, model artifacts, multimedia, DVC datasets |
| Search | Elasticsearch 8.x | Full-text search across college profiles, FAQs, forum posts |
| Analytics warehouse | BigQuery | Event analytics, A/B test results, funnel analysis |
| Feature store | Vertex AI Feature Store | ML features with point-in-time correctness for training |

### 2.4 AI/ML Stack

| Layer | Technology |
|-------|-----------|
| ML framework | PyTorch 2.x (DL), scikit-learn (classical), XGBoost, LightGBM |
| LLM access | Anthropic Claude API (claude-sonnet-4-6), Vertex AI Gemini 1.5 Pro |
| Embeddings | Vertex AI text-embedding-004, sentence-transformers |
| RAG framework | LangChain 0.2+ with custom retrieval pipeline |
| RL framework | Stable Baselines 3 + custom Gym environment |
| Document AI | Google Document AI (form parser + table extractor), PaddleOCR |
| NLP | spaCy 3.7, Hugging Face Transformers, BERTopic |
| MLOps | MLflow (experiment tracking), Kubeflow Pipelines (orchestration), DVC (versioning) |
| Model serving | Vertex AI Model Registry + Prediction Endpoints, Triton Inference Server |
| Monitoring | Evidently AI (data drift + model performance), Arize AI |

### 2.5 Frontend Stack

**Web (Next.js App Router):**
```
Next.js 14 (App Router)
TypeScript 5.x
Tailwind CSS 3.x
shadcn/ui + Radix UI
React Query (TanStack v5) — server state
Zustand — client state
Framer Motion — animations
Recharts — data visualization (cutoff trend charts)
React Hook Form + Zod — forms
next-pwa — Progressive Web App capabilities
```

**Mobile (React Native):**
```
React Native 0.74
Expo SDK 51
NativeWind 4.x (Tailwind for RN)
Expo Router (file-based navigation)
MMKV — fast local storage
React Query — data fetching
React Native Reanimated 3 — animations
Notifee — local notifications
Firebase Cloud Messaging — push notifications
```

### 2.6 Infrastructure & DevOps

| Component | Technology |
|-----------|-----------|
| Container orchestration | GKE (Google Kubernetes Engine) Autopilot |
| Container registry | Artifact Registry (GCP) |
| CI/CD | GitHub Actions + Cloud Build |
| Infrastructure as Code | Terraform + Helm charts |
| Service mesh | Istio (mTLS, circuit breaking, observability) |
| Secrets management | Google Secret Manager |
| Monitoring | Cloud Monitoring + Grafana dashboards |
| Logging | Cloud Logging + structured logs (JSON) |
| Tracing | Cloud Trace + OpenTelemetry |
| Error tracking | Sentry |
| Uptime monitoring | Better Uptime + PagerDuty (on-call during counseling windows) |
| Load testing | k6 |
| Security scanning | Snyk (dependencies), Trivy (container images) |

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT CLIENTS                               │
│         iOS App │ Android App │ Web (PWA) │ Web (Desktop)       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / WebSocket
                    ┌──────▼───────┐
                    │  API Gateway  │  ← Kong + Cloud Armor
                    │  (Rate limit, │    (DDoS, WAF)
                    │   Auth, Route)│
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────────────┐
        │                  │                           │
  ┌─────▼──────┐   ┌───────▼──────┐          ┌───────▼──────┐
  │ Auth        │   │ Prediction   │          │ Counseling   │
  │ Service     │   │ Service      │          │ Service      │
  │ (JWT/OAuth) │   │ (FastAPI+    │          │ (AI Agent    │
  └─────────────┘   │  ML Models)  │          │  Orchestrator│
                    └───────┬──────┘          └──────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
     ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────────┐
     │ User         │ │ Notification │ │ Content         │
     │ Service      │ │ Service      │ │ Service         │
     └──────────────┘ └──────────────┘ └─────────────────┘
            │               │               │
     ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────────┐
     │ Career       │ │ Community   │ │ Analytics       │
     │ Service      │ │ Service     │ │ Service         │
     └──────────────┘ └──────────────┘ └─────────────────┘
                            │
                     ┌──────▼──────────────────────┐
                     │      DATA LAYER              │
                     │  PostgreSQL │ Neo4j │ Redis  │
                     │  FAISS │ Elasticsearch │ BQ  │
                     └─────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   KAFKA EVENT   │
                   │      BUS        │
                   └────────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
     ┌────────▼───┐ ┌───────▼───┐ ┌──────▼──────┐
     │ Data        │ │ ML        │ │ Ground Truth │
     │ Pipeline    │ │ Training  │ │ Ingestion    │
     │ (Airflow)   │ │ (Kubeflow)│ │ (Crawlers)   │
     └────────────┘ └───────────┘ └─────────────┘
```

### 3.2 Microservices — Detailed Specifications

#### 3.2.1 Prediction Service
```python
# Core prediction endpoint contract
POST /v1/predict/college
Request:
{
  "exam": "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "MHT_CET" | ...,
  "rank": int,
  "percentile": float | null,
  "category": "GENERAL" | "OBC_NCL" | "SC" | "ST" | "EWS" | "PwD",
  "home_state": "MH" | "KA" | ... (ISO state code),
  "gender": "M" | "F" | "OTHER",
  "year": int,  # counseling year
  "filters": {
    "branches": ["CS", "EC", "ME", ...] | null,
    "college_types": ["IIT", "NIT", "IIIT", "GFTI"] | null,
    "states": [...] | null,
    "max_fees_per_year": int | null
  }
}

Response:
{
  "predictions": [
    {
      "college_code": "NIT_TRICHY",
      "college_name": "NIT Tiruchirappalli",
      "branch_code": "CS",
      "branch_name": "Computer Science and Engineering",
      "quota": "OS",  # Other State
      "predicted_opening_rank": 1820,
      "predicted_closing_rank": 2104,
      "confidence_interval": {"p10": 1950, "p50": 2104, "p90": 2280},
      "admission_probability": 0.73,
      "historical_closing_ranks": {  # last 5 years
        "2024": 2089, "2023": 1987, "2022": 2201, "2021": 1876, "2020": 2045
      },
      "trend": "STABLE",  # RISING | FALLING | STABLE
      "data_confidence": "HIGH",  # HIGH | MEDIUM | LOW
      "data_source": "JoSAA Round 6 Final Allotment 2024",
      "source_url": "https://josaa.admissions.nic.in/...",
      "fees_per_year": 147150,
      "nirf_rank": 8
    }
  ],
  "metadata": {
    "model_version": "cutoff_pred_v2.3.1",
    "prediction_timestamp": "2025-07-15T14:23:41Z",
    "data_as_of": "2024-11-30",
    "total_predictions": 847,
    "disclaimer": "Predictions based on historical trends. Actual cutoffs may vary."
  }
}
```

#### 3.2.2 Counseling Service (AI Agent Orchestrator)
```python
# Multi-agent orchestration for choice filling
POST /v1/counsel/optimize-choices
Request:
{
  "session_id": "uuid",
  "student_profile": { ... },
  "preferences": {
    "branch_priority": 0.4,      # 0-1, must sum to 1
    "college_tier_priority": 0.3,
    "location_priority": 0.2,
    "fees_priority": 0.1
  },
  "candidate_colleges": [...],   # from predictor, student-selected
  "risk_appetite": "AGGRESSIVE" | "BALANCED" | "CONSERVATIVE"
}

# Internally, this orchestrates:
# 1. RLCounselingAgent: generates initial ordering
# 2. ComparisonAgent: verifies branch-vs-brand trade-offs
# 3. RAGKnowledgeAgent: checks for any counseling rules that affect ordering
# 4. OptimizationAgent: runs genetic algorithm for final ordering
# 5. ExplainabilityAgent: generates human-readable reasons for each position
```

### 3.3 Kafka Event Schema

All inter-service communication uses typed Avro schemas registered in Schema Registry.

**Key topics:**

```
Topic: data.raw.documents
  - crawler_id, source_url, document_hash, timestamp, exam_type

Topic: data.validated.ground_truth  
  - data_type, exam, year, round, payload, confidence, sme_reviewed, source_url

Topic: ml.models.deployed
  - model_name, version, metrics, deployment_timestamp, endpoint_url

Topic: notifications.pending
  - user_id, channel, template_id, variables, priority, scheduled_at

Topic: analytics.events
  - user_id (hashed), event_type, properties, timestamp, session_id
```

---

## 4. AI/ML SYSTEMS — DEEP SPECIFICATION

### 4.1 College Cutoff Prediction Engine

#### Architecture: Multi-Model Ensemble

```
Input Features (per college-branch-category-quota tuple):
├── Historical Features (10 years)
│   ├── Opening rank Y-1, Y-2, ..., Y-10
│   ├── Closing rank Y-1, Y-2, ..., Y-10
│   ├── Seat count Y-1, Y-2, ..., Y-10
│   └── Round-wise allotment counts
├── Exam Features
│   ├── Total qualified candidates (this year vs last)
│   ├── Category-wise qualified count
│   ├── Exam difficulty index (derived from score distribution)
│   └── Percentile-to-rank mapping curve shape
├── College Features
│   ├── NIRF rank (last 3 years)
│   ├── Placement median package (last 3 years)
│   ├── Branch reputation score (derived from placement data)
│   └── Fee structure (relative to category)
├── Market Features
│   ├── Industry demand index for branch (LinkedIn job posting trends)
│   ├── Google Trends for "[branch] salary" queries
│   └── Year-over-year preference shift signal

Model 1: XGBoost Regressor
  - Predicts closing rank point estimate
  - Features: all above
  - Target: closing_rank
  - Hyperparams: tuned via Optuna

Model 2: LightGBM Regressor  
  - Same features, different boosting strategy
  - Better on sparse features (new colleges with less history)

Model 3: LSTM (PyTorch)
  - Input: 10-year time series of closing ranks per tuple
  - Output: predicted closing rank + trend direction
  - Architecture: 2-layer LSTM, hidden=128, dropout=0.2

Ensemble: Weighted average (XGB: 0.4, LGBM: 0.35, LSTM: 0.25)
  - Weights determined by validation set performance per exam type
  - LSTM weight increases for colleges with 5+ years of data

Confidence Interval: Bootstrap resampling (1000 iterations)
  - P10, P50, P90 intervals
  - Wider intervals for: new colleges, volatile branches, first round predictions
```

**Training Pipeline (Kubeflow):**
```
Step 1: Data extraction from Feature Store (point-in-time correct)
Step 2: Feature engineering (lag features, rolling stats, encode categoricals)
Step 3: Train/val/test split (temporal: test = last counseling cycle)
Step 4: Hyperparameter tuning (Optuna, 100 trials per model)
Step 5: Ensemble weight optimization
Step 6: Evaluation: MAE, MAPE, rank-accuracy@500, calibration curve
Step 7: If metrics pass threshold → register in MLflow → deploy to Vertex AI
Step 8: A/B shadow mode for 7 days vs. current production model
Step 9: If shadow model outperforms → full promotion
```

**Retraining triggers:**
- New counseling round allotment data published → auto-retrain within 4 hours
- AccuracyMonitor detects drift (MAE increases >15% from baseline) → immediate retrain + alert
- Manual trigger by ML team

### 4.2 RL Counseling Optimization Agent

#### Environment Definition (Custom Gym)
```python
class CounselingEnv(gym.Env):
    """
    State: (student_rank, category, preferences, current_round, available_seats)
    Action: Ordering of choice list (permutation of N colleges/branches)
    Reward: weighted_score(allotted_seat, student_preferences)
            + upgrade_probability_bonus
            - risk_penalty (if overly aggressive)
    
    The agent learns:
    1. When to "gamble" on a reach option (high upgrade probability in later rounds)
    2. When to play it safe (low probability of upgrade, round is near-final)
    3. Category-specific strategies (OBC-NCL vs General behave differently)
    4. Exam-specific behaviors (JoSAA's 6 rounds vs CSAB's spot rounds)
    """
    
    def step(self, action):
        # Simulate counseling algorithm on historical data
        # Compute reward based on actual historical outcomes
        # Return next state (next round's situation)
        pass
    
    def reset(self):
        # Sample a historical student profile
        # Start from Round 1
        pass
```

**Training:**
- Algorithm: PPO (Proximal Policy Optimization) via Stable Baselines 3
- Training data: 5 years × ~500K JoSAA choice-filling outcomes (public data)
- Evaluation: Average preference score achieved vs. optimal (retrospective)
- Human reward function design: Product team + academic counselors define the weighted preference score formula

### 4.3 RAG Knowledge System

#### Architecture
```
Knowledge Base Sources (ingested, chunked, embedded):
├── JoSAA Official Brochures (2019–2025)
├── CSAB Special Round Brochures
├── MCC NEET-UG Counseling Brochures
├── DTE Maharashtra CET Brochure
├── KEA Karnataka Brochure
├── College Prospectuses (top 500 institutions)
├── AICTE/UGC Regulations on admission
├── RTI responses on counseling procedures
└── Curated FAQ database (human-authored, SME-verified)

Chunking Strategy:
- Semantic chunking (not fixed-size) using LangChain SemanticChunker
- Minimum chunk: 150 tokens, Maximum: 600 tokens
- Preserve table structures as special chunks with metadata

Embedding:
- Model: Vertex AI text-embedding-004 (768 dimensions)
- Store: Pinecone serverless (production) + FAISS (development)
- Metadata per chunk: source_doc, page_number, exam_type, year, confidence_flag

Retrieval:
- Hybrid search: dense (embedding cosine similarity) + sparse (BM25)
- Reciprocal Rank Fusion to merge results
- Top-K: 8 chunks retrieved, re-ranked with cross-encoder
- Query expansion: "What documents do I need for JoSAA reporting?" 
  → expanded to also search "document verification" + "original certificate" + "reporting center"

Generation:
- Model: Claude claude-sonnet-4-6 (Anthropic API)
- System prompt enforces: cite source chunk, include page reference, add "verify on official website" for time-sensitive info
- Guardrail: if no chunk exceeds similarity threshold 0.72 → respond with
  "I don't have verified information on this. Please check [official URL]"
  (NEVER hallucinate an answer)

Confidence tiers:
- HIGH (similarity > 0.85, source < 1 year old): Answer directly with citation
- MEDIUM (0.72–0.85, or source 1–2 years old): Answer with "as per [year] brochure, verify for current year"
- LOW (< 0.72): Decline to answer, link to official source
```

### 4.4 Career Knowledge Graph (Neo4j)

#### Schema
```cypher
// Nodes
(:College {name, nirf_rank, type, state, established})
(:Branch {name, code, category})
(:Skill {name, domain, level})
(:JobRole {title, seniority_level, domain})
(:Company {name, type, sector})
(:SalaryBand {min, max, median, year, source})
(:PGProgram {name, degree, country, ranking})
(:Certification {name, provider, validity})

// Relationships
(:Branch)-[:COMMONLY_LEADS_TO {percentage}]->(:JobRole)
(:Branch)-[:REQUIRES_CORE_SKILL]->(:Skill)
(:JobRole)-[:REQUIRES_SKILL {importance: 1-5}]->(:Skill)
(:Company)-[:HIRES_FOR]->(:JobRole)
(:College)-[:RECRUITER_VISITS {year}]->(:Company)
(:College)-[:BRANCH_PLACEMENT {median_ctc, year}]->(:Branch)
(:JobRole)-[:TYPICAL_SALARY_BAND {location}]->(:SalaryBand)
(:Branch)-[:FEEDS_INTO_PG]->(:PGProgram)
(:JobRole)-[:BENEFITS_FROM]->(:Certification)

// Example query: "What jobs can I get with Civil Engineering from NIT Trichy?"
MATCH (c:College {name: "NIT Tiruchirappalli"})
      -[:BRANCH_PLACEMENT]->(b:Branch {code: "CE"})
      <-[:COMMONLY_LEADS_TO]-(jr:JobRole)
      <-[:HIRES_FOR]-(co:Company)
RETURN jr.title, co.name, jr.domain
ORDER BY jr.employment_percentage DESC
```

**Data sources for graph population:**
- NIRF mandatory disclosure PDFs (placement data, automated extraction)
- LinkedIn Jobs API (job role → required skills)
- AmbitionBox salary data (web scraped, validated)
- Alumni survey data (opt-in, aggregated, anonymized)
- NASSCOM/industry reports (sector hiring trends)

### 4.5 MLOps & Model Lifecycle

```
Development → Staging → Production lifecycle:

1. EXPERIMENT TRACKING (MLflow)
   - Every training run: params, metrics, artifacts, data version
   - Experiment comparison dashboard
   - Model registry with stage labels: None → Staging → Production → Archived

2. DATA VERSIONING (DVC + GCS)
   - Every training dataset version tracked
   - Ability to reproduce any model from any historical data snapshot
   - Data lineage: raw → cleaned → features → training set

3. CONTINUOUS TRAINING (Kubeflow Pipelines)
   - Triggered by: new data event, scheduled (weekly), manual
   - Pipeline stages: data validation → feature engineering → training → evaluation → registration
   - Automated rollback if new model underperforms production by >5%

4. MODEL MONITORING (Evidently AI + Custom)
   - Data drift detection: input feature distribution shift
   - Prediction drift: output distribution shift
   - Model performance: accuracy vs. ground truth (post-round actuals)
   - Alert thresholds: warning at 10% drift, critical at 20%

5. A/B TESTING FRAMEWORK
   - Shadow mode: new model runs alongside production, results compared
   - Traffic splitting: 10% → 50% → 100% rollout with metric gates
   - Statistical significance: p < 0.01 required before full promotion

6. FEATURE STORE (Vertex AI)
   - Point-in-time correct feature serving (critical for training/serving parity)
   - Online serving (low latency) + Offline serving (batch training)
   - Feature groups: student_features, college_features, exam_features, market_features
```

---

## 5. DATA ARCHITECTURE

### 5.1 PostgreSQL Schema (Key Tables)

```sql
-- Core exam and counseling data
CREATE TABLE exam_cutoffs (
    id BIGSERIAL PRIMARY KEY,
    exam_type VARCHAR(20) NOT NULL,  -- JEE_MAIN, NEET, MHT_CET, etc.
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
    sme_reviewer_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exam_type, counseling_body, year, round_number, college_code, branch_code, category, quota)
);

-- Partitioned by year for query performance
CREATE TABLE exam_cutoffs_2024 PARTITION OF exam_cutoffs FOR VALUES IN (2024);
CREATE TABLE exam_cutoffs_2023 PARTITION OF exam_cutoffs FOR VALUES IN (2023);
-- ... back to 2014

-- Indexes for common query patterns
CREATE INDEX idx_cutoffs_prediction ON exam_cutoffs(exam_type, year, category, closing_rank);
CREATE INDEX idx_cutoffs_college ON exam_cutoffs(college_code, branch_code, year);

-- College master table
CREATE TABLE colleges (
    college_code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(10) NOT NULL,  -- IIT, NIT, IIIT, GFTI, DEEMED, STATE
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

-- Student profiles (privacy-first design)
CREATE TABLE student_profiles (
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
    CONSTRAINT no_sensitive_data CHECK (preferences NOT LIKE '%"ssn"%')
);

-- All notifications dispatched and their status
CREATE TABLE notification_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    channel VARCHAR(10) NOT NULL,  -- PUSH, EMAIL, SMS, WHATSAPP
    template_id VARCHAR(50) NOT NULL,
    variables JSONB,
    status VARCHAR(15) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    error_message TEXT,
    exam_relevance VARCHAR(20),  -- which exam this notification is about
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

### 5.2 Data Pipeline Architecture

```
Raw Data Layer (GCS):
  gs://admitos-raw/
  ├── josaa/{year}/round_{n}/
  │   ├── allotment_data.pdf
  │   ├── seat_matrix.xlsx
  │   └── cutoff_ior.pdf
  ├── mcc/{year}/round_{n}/
  ├── dte_mh/{year}/
  └── ...

Processing Layer (Airflow DAGs):
  DAG: josaa_round_ingestion
    Task 1: download_from_official_portal (WebCrawlerAgent)
    Task 2: extract_pdf_tables (PDFExtractorAgent → Document AI)
    Task 3: validate_schema (Great Expectations)
    Task 4: cross_validate_3_sources (ContentValidationAgent)
    Task 5: load_to_postgres (upsert with conflict handling)
    Task 6: update_feature_store (Vertex AI Feature Store)
    Task 7: trigger_model_retrain (Kubeflow Pipeline)
    Task 8: publish_data_validated_event (Kafka)
    Task 9: send_notification_to_users (Notification Service)

  DAG: college_profile_refresh (weekly)
  DAG: nirf_data_annual_refresh (triggered on NIRF release)
  DAG: neo4j_career_graph_refresh (monthly)
```

---

## 6. API CONTRACT — COMPLETE ENDPOINT REFERENCE

### 6.1 Authentication
```
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/refresh
POST /v1/auth/logout
GET  /v1/auth/verify-email/{token}
POST /v1/auth/google-sso
POST /v1/auth/apple-sso
```

### 6.2 Student Profile
```
GET    /v1/profile/me
PATCH  /v1/profile/me
POST   /v1/profile/exam-details
GET    /v1/profile/me/predictions-history
DELETE /v1/profile/me  (DPDP compliance — right to erasure)
```

### 6.3 Predictions
```
POST /v1/predict/college           — Main college predictor
POST /v1/predict/rank-from-score  — Score/percentile → rank estimation
POST /v1/predict/upgrade-probability — Chance of upgrade in subsequent rounds
GET  /v1/predict/trends/{college_code}/{branch_code} — Historical trend data
GET  /v1/predict/cutoffs/latest?exam=JEE_MAIN&year=2025&college=NIT_TRICHY&branch=CS
```

### 6.4 Counseling Assistant
```
POST /v1/counsel/optimize-choices    — AI choice list optimizer
POST /v1/counsel/what-if             — Scenario simulator
POST /v1/counsel/chat                — Conversational Q&A (RAG-powered)
GET  /v1/counsel/rules/{exam}        — Official counseling rules (RAG-retrieved)
POST /v1/counsel/compare             — Branch vs. Brand comparison
```

### 6.5 Notifications
```
GET  /v1/notifications/feed          — Personalized notification feed
POST /v1/notifications/preferences  — Set notification preferences
GET  /v1/notifications/upcoming      — Calendar of upcoming counseling events
POST /v1/notifications/subscribe    — Subscribe to specific exam/college updates
```

### 6.6 Colleges
```
GET  /v1/colleges                    — List with filters
GET  /v1/colleges/{code}             — Full college profile
GET  /v1/colleges/{code}/cutoffs     — Historical cutoffs
GET  /v1/colleges/{code}/placements  — Placement statistics
GET  /v1/colleges/{code}/branches    — Available branches
GET  /v1/colleges/search?q=          — Full-text search
```

### 6.7 Career
```
POST /v1/career/paths                — Career paths for branch + college
GET  /v1/career/branch/{code}        — Branch overview (jobs, skills, salary)
GET  /v1/career/compare?b1=CS&b2=EC — Branch comparison
GET  /v1/career/scholarships         — Scholarship finder (filtered)
```

---

## 7. SECURITY & COMPLIANCE

### 7.1 Data Protection (DPDP Act 2023 Compliance)
- **Data minimization:** Only collect exam rank, category, state, preferences. No name/phone required for core features.
- **Purpose limitation:** Exam data used only for counseling features, never for advertising targeting
- **Right to erasure:** Full account + data deletion within 72 hours of request
- **Consent management:** Granular opt-in for each data category
- **Data localization:** All Indian student data stored in GCP asia-south1 (Mumbai) region
- **Breach notification:** Automated alert to users within 72 hours of any data breach

### 7.2 Security Architecture
```
Layer 1: Network
  - Cloud Armor: DDoS protection, WAF (OWASP Top 10 rules)
  - VPC with private subnets for all databases
  - No direct database internet exposure

Layer 2: Application
  - JWT tokens: 15-minute access, 7-day refresh (rotated)
  - Rate limiting: 100 req/min (free), 1000 req/min (paid) per user
  - Input validation: Pydantic v2 (strict mode) on all endpoints
  - SQL injection prevention: ORM (SQLAlchemy) with parameterized queries only
  - Output encoding: automatic XSS prevention

Layer 3: Infrastructure
  - Workload identity for service-to-service auth (no static credentials)
  - Secret Manager for all API keys (no hardcoded secrets ever)
  - Container scanning: Trivy in CI pipeline
  - Dependency scanning: Snyk (block PRs with HIGH/CRITICAL CVEs)

Layer 4: Data
  - Encryption at rest: AES-256 (GCP default)
  - Encryption in transit: TLS 1.3 enforced
  - Column-level encryption for PII fields (age, gender, category)
  - Database audit logging: all queries logged, 90-day retention
```

---

## 8. PERFORMANCE & SCALABILITY SPECIFICATIONS

### 8.1 Response Time SLAs

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| College prediction | 150ms | 400ms | 800ms |
| Choice list optimization | 800ms | 2s | 4s |
| RAG Q&A | 1.5s | 3s | 6s |
| College profile fetch | 50ms | 100ms | 200ms |
| Notification feed | 80ms | 150ms | 300ms |

### 8.2 Peak Traffic Handling (JoSAA Round 1 Results Day)
```
Predicted peak: 500K concurrent users, 2M req/hour

Prediction Service:
  - Pre-scale to 50 pods (from baseline 5) 2 hours before result time
  - Each pod: 4 vCPUs, 8GB RAM, can handle 500 req/min
  - Result caching: Redis with TTL=30min for identical prediction requests
  - Cache hit rate target: 60% (many students have identical ranks/categories)

Database:
  - Read replicas: 5 (auto-scale to 10 during peak)
  - Connection pooling: PgBouncer (max 10K connections)
  - Hot data (current year cutoffs): fully cached in Redis

CDN:
  - College profile pages: Cloudflare CDN, cache TTL=1 hour
  - Static assets: Cloud CDN, cache TTL=7 days

Notification Service:
  - Queue-based with Kafka
  - Backpressure handling: if queue > 1M messages → rate limit non-critical notifications
  - Critical notifications (round results, deadline reminders) always prioritized
```

### 8.3 Disaster Recovery
- **RTO (Recovery Time Objective):** < 15 minutes
- **RPO (Recovery Point Objective):** < 5 minutes
- **Multi-region setup:** Primary: asia-south1 (Mumbai), Failover: asia-south2 (Delhi)
- **Database:** Cloud SQL with automatic failover replica
- **Automated backups:** Hourly snapshots to GCS, 30-day retention
- **Runbook:** Documented DR procedure, tested quarterly

---

## 9. MONITORING & OBSERVABILITY

### 9.1 Key Dashboards (Grafana)

**Dashboard 1: Business Health**
- DAU/MAU, new registrations
- Prediction requests per hour
- Counseling sessions completed
- Notification open rates
- Conversion: Free → Paid

**Dashboard 2: Technical Health**
- API response times (P50/P95/P99 per endpoint)
- Error rates per service
- Pod CPU/memory utilization
- Kafka consumer lag
- Database query performance (slow query log)

**Dashboard 3: ML Model Health**
- Prediction accuracy vs. actuals (post-round)
- Feature drift metrics
- Model inference latency
- Training pipeline status
- A/B test results

**Dashboard 4: Data Pipeline Health**
- Crawl success rate per source
- PDF extraction accuracy
- Validation pass/fail rates
- Data freshness (last update per exam/year/round)
- SME review queue depth

### 9.2 Alerting Rules (PagerDuty)

| Alert | Condition | Severity | On-call |
|-------|-----------|----------|---------|
| Prediction service down | Error rate > 5% for 2 min | P1 | Backend Eng On-call |
| Prediction accuracy drop | MAE increase > 20% | P1 | ML Eng On-call |
| New official data detected | Crawl detects change in JoSAA/MCC | P2 | Data Eng On-call |
| SME review SLA breach | Review > 4 hours for HIGH confidence data | P2 | Content Lead |
| Database replication lag | > 60 seconds | P1 | DevOps On-call |
| Kafka consumer lag | > 100K messages | P2 | Backend Eng |
| Peak traffic pre-alert | 2 hours before known counseling event | P3 | DevOps |

---

## 10. TESTING STRATEGY

### 10.1 Test Pyramid

```
Unit Tests (70% of test suite):
  - Every prediction model: test with known historical inputs → expected outputs
  - Every API endpoint: Pydantic validation, business logic, edge cases
  - Every data transformation: ETL correctness tests
  - Coverage target: > 85% line coverage

Integration Tests (20%):
  - API + Database integration
  - ML model + Feature Store integration
  - Kafka event publishing + consumer handling
  - RAG pipeline: query → retrieval → generation accuracy

E2E Tests (10%):
  - Full user journey: Register → Input rank → See predictions → Build choice list
  - Notification flow: Data ingested → Kafka event → Push notification delivered
  - Critical: "JEE Main student, rank 5000, OBC, Maharashtra — prediction matches known historical outcomes"

ML-Specific Tests:
  - Backtesting: model predictions vs. all historical counseling rounds (2019–2024)
  - Robustness: prediction stability for edge cases (rank = 1, rank = last eligible)
  - Fairness: prediction accuracy consistent across all categories (no systematic bias)
  - Hallucination test suite: 200 questions where we know the answer → RAG must answer correctly or decline
```

---

## 11. DEVELOPMENT ENVIRONMENT & TOOLCHAIN

```
Local Development:
  - Docker Compose for all services
  - LocalStack for GCP service mocking
  - Pre-commit hooks: Black (Python), Prettier (TS), ESLint, isort
  - Commitizen for conventional commits

CI/CD (GitHub Actions):
  PR checks:
    ✓ Unit tests (must pass)
    ✓ Integration tests (must pass)  
    ✓ Code coverage (must not drop > 2%)
    ✓ Snyk security scan (no new HIGH/CRITICAL)
    ✓ CodeRabbit AI review (informational)
    ✓ Type checking: mypy (Python), tsc (TypeScript)
    ✓ Linting: ruff (Python), ESLint (TS)
  
  Merge to main:
    ✓ All PR checks pass
    ✓ At least 1 human reviewer approval
    → Auto-deploy to staging
    → Run E2E test suite against staging
    → If pass → promote to production (blue-green deploy)

Production deploy:
  - Zero-downtime rolling updates via GKE
  - Automated rollback: if error rate increases > 2% post-deploy → auto-rollback in 5 min
  - Feature flags (Unleash): new features behind flags, gradual rollout

Code Standards:
  - Python: PEP 8 + ruff linting + Black formatting
  - TypeScript: strict mode, no any, functional components
  - API: RESTful, versioned (/v1/), consistent error codes
  - Database: all migrations via Alembic (Python), sequential, reversible
  - No hardcoded strings, secrets, or URLs in code
```

---

## 12. ACCURACY INFRASTRUCTURE — SPECIAL SECTION

This section exists because ADMIT OS's core promise is accuracy. Technical measures to enforce it:

### 12.1 The Accuracy Stack
```
Level 1: Data Entry Prevention
  - Database constraints: closing_rank >= opening_rank (enforced)
  - Category seat counts must sum to total_seats (enforced)
  - Cutoff ranks must be positive integers (enforced)
  - New year's data must be within 3σ of 5-year trend (flagged for review if not)

Level 2: Cross-Source Validation
  - ContentValidationAgent compares: Official Portal + PDF + Past Year Data
  - Agreement required from 2/3 sources for MEDIUM, 3/3 for HIGH confidence
  - Any HIGH→MEDIUM downgrade triggers SME review

Level 3: Temporal Validation
  - Round N closing rank must be ≤ Round N+1 closing rank (general rule)
  - Seat count cannot increase between rounds without official seat matrix update
  - Schedule dates must be chronologically consistent

Level 4: Post-Round Ground Truth Collection
  - After each round: users who consented share their actual allotment result
  - Automated collection: "Your JoSAA Round 2 allotment is out. Share your result to help improve predictions for students like you." → one-tap share
  - This creates a virtuous cycle: more user data → more accurate future predictions

Level 5: Public Accuracy Dashboard
  - Published on the website: "How accurate were our 2024 JEE Main predictions?"
  - Broken down by: rank range, category, college tier
  - Creates external accountability pressure — students can see if we're improving or degrading
```

### 12.2 Hallucination Prevention for RAG

```python
# Every RAG response goes through this guard

def rag_response_guard(query: str, retrieved_chunks: list, generated_response: str) -> GuardedResponse:
    
    # 1. Factual claim extraction
    claims = extract_factual_claims(generated_response)
    
    # 2. For each claim, verify it's supported by a chunk
    for claim in claims:
        supporting_chunk = find_supporting_chunk(claim, retrieved_chunks)
        if supporting_chunk is None or supporting_chunk.similarity < 0.72:
            # This claim has no support — must be removed or flagged
            return GuardedResponse(
                answer="I don't have verified information about this specific question. "
                       "Please check the official website: [relevant_url]",
                confidence="LOW",
                declined=True
            )
    
    # 3. Check for time-sensitive information
    if contains_date_or_deadline(generated_response):
        # Always add verification note
        generated_response += "\n\n⚠️ Dates and deadlines change year to year. Always verify on the official website."
    
    # 4. Source citation injection
    final_response = inject_source_citations(generated_response, retrieved_chunks)
    
    return GuardedResponse(
        answer=final_response,
        confidence="HIGH",
        sources=[chunk.source_doc for chunk in retrieved_chunks]
    )
```

---

*Document Version 1.0 | ADMIT OS Technical Architecture Team | June 2026*
*Classification: Internal — Engineering Reference*
*Next review: After Beta Launch (expected: Q3 2026)*
