\# ADMIT OS — Agent Operating Instructions

\# Read BOTH files fully before writing a single line of code:

\# @ADMIT\_OS\_Development\_Plan.md

\# @ADMIT\_OS\_Technical\_Bible.md



\## Project Identity

You are building ADMIT OS — the post-exam operating system for Indian students

navigating JEE/NEET/MHT-CET/KCET and 20+ competitive exam admissions.

The Marks App owns pre-exam. We own everything after the paper is submitted.



\## Non-Negotiable Rules

1\. ZERO hallucinations on cutoff data. Every prediction must cite a source.

2\. Every cutoff/rank data point needs source\_url + data\_confidence field in DB.

3\. Never expose raw model confidence < MEDIUM to users without a disclaimer.

4\. All student PII stored only in `users` table. Exam data in `student\_profiles`.

5\. DPDP Act 2023 compliance is mandatory — no PII in logs, ever.

6\. PostgreSQL schema must match the Technical Bible Section 5.1 exactly.

7\. All APIs must follow the contract in Technical Bible Section 6 exactly.

8\. Always use parameterized queries — no raw SQL string concatenation.

9\. Every new service must have a Dockerfile and a Helm chart before merge.

10\. No hardcoded secrets, URLs, or API keys anywhere in code. Use Secret Manager.



\## Tech Stack (from Technical Bible — do not deviate)

\- Backend: Python 3.11 + FastAPI + SQLAlchemy 2.0 + Pydantic v2

\- Frontend Web: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui

\- Mobile: React Native 0.74 + Expo SDK 51 + NativeWind

\- DB: PostgreSQL 16 + Redis 7 + Neo4j 5 + FAISS

\- ML: PyTorch 2 + XGBoost + LightGBM + scikit-learn + LangChain RAG

\- Infra: GKE + Kafka + Airflow + Terraform + Helm

\- MLOps: MLflow + Kubeflow + DVC + Vertex AI



\## Code Style

\- Python: PEP 8, Black formatter, ruff linter, mypy strict, type hints everywhere

\- TypeScript: strict mode, no `any`, functional components only

\- Functions: max 30 lines. Files: max 300 lines — split if larger.

\- Every external API call: try/catch + structured logging (never raw stack traces)

\- Every new utility function: must have a unit test



\## Folder Structure

admitos/

├── services/

│   ├── auth/

│   ├── prediction/

│   ├── counseling/

│   ├── notification/

│   ├── career/

│   ├── community/

│   ├── content/

│   └── analytics/

├── ml/

│   ├── models/

│   ├── pipelines/

│   └── serving/

├── frontend/

│   ├── web/

│   └── mobile/

├── data/

│   ├── ingestion/

│   ├── validation/

│   └── pipelines/

├── infra/

│   ├── terraform/

│   └── helm/

└── AGENTS.md  ← you are here



\## Agent Collaboration Rules

\- Never break another agent's service contract (API shape, Kafka topic schema)

\- Publish to Kafka, never call another service's DB directly

\- If you need data from another service, call its REST API or consume its Kafka topic

\- All Kafka topic schemas are in /infra/kafka-schemas/ — match them exactly

