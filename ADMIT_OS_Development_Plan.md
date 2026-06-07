# ADMIT OS — Complete Development Plan
## "The Command Center for Every Student After the Bell Rings"
### Version 1.0 | Parallel AI-Agent Multi-Team Framework

---

## PART 0 — APP NAME SHORTLIST (Top 5)

| # | Name | Why It Wins |
|---|------|-------------|
| 1 | **ADMIT OS** | "OS" = operating system — implies you run your entire post-exam life here. Short, punchy, brandable like "Marks" but for the next phase. |
| 2 | **AdmitIQ** | Smart, clean, global-sounding. IQ = intelligence. Directly communicates: we make you smarter about admissions. |
| 3 | **PathSet** | Evokes "your path is set." Minimal, modern, dual-meaning: path (career) + set (it's decided, you're done stressing). |
| 4 | **ClearRank** | Speaks directly to the #1 anxiety: "where do I stand?" Communicates clarity and ranking context instantly. |
| 5 | **NexStep** | "Next Step" compressed. Clean, memorable, action-oriented. Works across JEE/NEET/CET/KCET uniformly. |

**Recommended: ADMIT OS** — most defensible brand identity, category-defining like "Marks" is for prep.

---

## PART 1 — MISSION & NORTH STAR

### 1.1 The Single Line
> ADMIT OS is the post-exam operating system — the only app a student opens from result day to admission day, and trusts with every single decision in between.

### 1.2 Why This Exists (The Gap Marks App Doesn't Fill)
Marks App = Pre-exam. Practice, tests, revision. Its job ends when the student submits the paper.

The moment that paper is submitted, a completely new universe of anxiety begins:
- "Did I clear?"
- "What rank am I getting?"
- "Which college should I pick?"
- "Should I take CS at a Tier-2 or Mechanical at an IIT?"
- "What's the cutoff this year?"
- "When does JoSAA round 2 open?"
- "Will I get a scholarship?"
- "What even is my career after this branch?"

No app owns this space with the depth Marks App owns the prep space. ADMIT OS does.

### 1.3 Success Criteria (Non-Negotiable)
1. **Zero hallucinations** on cutoff data, counseling dates, seat matrices — verified, sourced, version-controlled data only.
2. **Sub-2-second** college prediction response with ≥90% accuracy on historically validated data.
3. **Daily active use** during peak counseling window (45–90 days per cycle per exam).
4. **Student trust score** > 4.6/5.0 on app stores within 6 months of launch.
5. **Category leadership**: #1 result for "JEE counseling app", "NEET college predictor", "MHT-CET guidance" within 12 months.

---

## PART 2 — EXAMS COVERED (Full Scope)

| Category | Exams |
|----------|-------|
| Engineering (National) | JEE Main, JEE Advanced, BITSAT, VITEEE, SRMJEEE, MET (Manipal) |
| Engineering (State) | MHT-CET, KCET, WBJEE, COMEDK, AP EAPCET, TS EAPCET, KEAM, OJEE, UPCET, GUJCET, TNEA |
| Medical | NEET-UG, NEET-PG, AIIMS (historical), JIPMER (historical) |
| Law | CLAT, AILET, LSAT India |
| Management (UG) | IPMAT (IIM Indore/Rohtak), SET (Symbiosis), NPAT (NMIMS) |
| Design | UCEED, NID DAT, NIFT |
| Counseling Bodies | JoSAA, CSAB, MCC, DTE Maharashtra, KEA Karnataka, JAC Delhi, Rajasthan JECRC, JOSAA (Architecture) |

---

## PART 3 — THE PARALLEL AI AGENT COMPANY STRUCTURE

ADMIT OS is built by **7 parallel AI Agent Teams** (modeled after and surpassing the Marks App org structure), each running simultaneously, communicating via a **Central Event Bus (Kafka)**. Every team has:
- A **Lead AI Agent** (autonomous)
- **Sub-Agents** (specialized)
- **Human Oversight Roles** (final authority on critical decisions)
- **Synchronization Events** (what it publishes/subscribes to)

---

### 🔴 TEAM 0 — COMMAND AGENT (Orchestrator)
**Role:** The CEO-equivalent AI. Coordinates all 7 teams. Manages inter-team dependencies, sprint priorities, resource conflicts, and release gates.

**Lead Agent:** `OrchestratorAgent`
**Responsibilities:**
- Maintains the master product DAG (Directed Acyclic Graph) of all features and their dependencies
- Detects blocking chains (e.g., "Prediction Engine can't go live until Ground Truth data is validated")
- Auto-reassigns compute resources during model training cycles
- Publishes `global_sprint_state_event` every 24 hours to all teams
- Escalates to human CPO when confidence < 80% on any critical decision

**Human Oversight:** CPO + Lead Product Manager
**Trigger:** Always running. Master clock for all other teams.

---

### 🔵 TEAM 1 — GROUND TRUTH INTELLIGENCE (Data & Research)
**The most critical team. If this fails, everything fails.**

**Mission:** Build and maintain the single most accurate, real-time, version-controlled database of post-exam information that has ever existed for Indian competitive exams.

**Lead Agent:** `GroundTruthAgent`

#### Sub-Agents:

**1.1 `WebCrawlerAgent`**
- Continuously monitors: JoSAA portal, CSAB, MCC, DTE Maharashtra, KEA Karnataka, JAC Delhi, NTA website, and 30+ state counseling portals
- Detects page changes using hash-diffing (SHA-256 of critical page sections)
- Runs every 15 minutes during peak counseling windows, every 6 hours otherwise
- Publishes `raw_document_detected_event` with URL, timestamp, change delta

**1.2 `PDFExtractorAgent`**
- Ingests official PDFs (seat matrices, brochures, cutoff lists, schedules)
- Uses Google Document AI + custom fine-tuned LayoutLM for table extraction
- Handles: scanned PDFs (OCR via Tesseract + PaddleOCR), structured PDFs, image-embedded tables
- Extracts: opening ranks, closing ranks, category-wise cutoffs, seat counts, fee structures, document checklists
- Outputs structured JSON to the validation pipeline

**1.3 `ContentValidationAgent`**
- Cross-validates extracted data against 3 independent sources minimum
- Runs automated consistency checks: "closing rank cannot be lower than opening rank", "seat count changes > 15% trigger human review", "new college/branch additions trigger human SME verification"
- Confidence scoring: HIGH (3 sources agree) / MEDIUM (2 sources) / LOW (1 source, flagged for HITL)
- Publishes `data_validated_event` with confidence score payload
- **RED FLAG PROTOCOL:** Any data with confidence < HIGH for a JEE/NEET seat matrix goes to human SME within 10 minutes

**1.4 `HistoricalDataAgent`**
- Manages 10+ years of historical cutoff data per exam per counseling body
- Cleans, normalizes, and versions all historical data (DVC versioning)
- Detects anomalies: cutoffs that deviate >2σ from 5-year trend (could be data error or genuine market shift)
- Builds time-series features for the Prediction Engine

**1.5 `ResearchSentinelAgent`**
- The "product research" agent — continuously mines:
  - r/JEENEETards, r/Indian_Academia, r/NEET, r/JEEmains
  - Quora threads about counseling confusion
  - YouTube comment sections on counseling videos
  - Telegram groups (monitored, not scraped personally)
  - Twitter/X hashtags: #JEEcounseling, #NEETcounseling, #MHTCETcounseling
- Extracts recurring pain points, new confusion patterns, feature requests
- Publishes `student_signal_event` to Product Team (Team 2) every 48 hours

**Human Oversight:** Lead SME (per exam category), Content Editor, Data Engineer
**Synchronization:**
- Subscribes to: `scheduled_crawl_event`, `manual_trigger_event`
- Publishes: `data_validated_event`, `student_signal_event`, `raw_document_detected_event`

---

### 🟢 TEAM 2 — PRODUCT INTELLIGENCE (Discovery & Roadmap)
**Mission:** Translate student pain signals into prioritized features. Own the product roadmap. Be the "student's advocate" inside the company.

**Lead Agent:** `ProductStrategyAgent`

#### Sub-Agents:

**2.1 `PainPointAnalyzerAgent`**
- Ingests `student_signal_event` from Team 1
- Clusters pain points using BERTopic (topic modeling) into problem categories
- Scores each problem: frequency × severity × unaddressed-by-competition
- Outputs ranked problem backlog to Product Manager dashboard
- Weekly briefing: "Top 10 student problems this week" report

**2.2 `CompetitorAnalysisAgent`**
- Monitors Marks App, CollegeDekho, Careers360, Shiksha, GetMyUni feature releases
- Runs App Store review mining on competitor apps (sentiment + feature gap analysis)
- Publishes `competitive_gap_event`: features they have that we don't + features we should have that no one has

**2.3 `FeatureSpecAgent`**
- Converts approved pain points into detailed user stories with acceptance criteria
- Generates: API contract specs (OpenAPI), data model requirements, UI/UX wireframe prompts
- Routes specs to correct engineering teams automatically
- Maintains Jira board via API integration

**2.4 `UserJourneyAgent`**
- Maps every student journey: "Result declared → Rank out → Predictor used → Choice filled → Allotment → Acceptance/Upgrade"
- Detects drop-off points in the funnel from analytics data
- Recommends friction-reduction interventions to Product Manager

**Human Oversight:** CPO, Lead PM, UX Researcher, Growth PM
**Synchronization:**
- Subscribes to: `student_signal_event`, `competitive_gap_event`, `analytics_event`
- Publishes: `feature_requirements_event`, `priority_update_event`

---

### 🟡 TEAM 3 — CORE AI/ML ENGINE
**Mission:** Build the prediction, recommendation, and intelligence backbone. This is the technical moat.

**Lead Agent:** `MLOrchestrationAgent`

#### Sub-Agents:

**3.1 `CutoffPredictionAgent`**
- **Model:** Gradient Boosting (XGBoost + LightGBM ensemble) + LSTM for time-series trend
- **Input features:** Previous 10-year closing ranks, seat matrix changes, exam difficulty index, total qualified students, category ratios, macro trends (CSE boom years, etc.)
- **Output:** Predicted opening/closing rank with 90% confidence interval for each (college, branch, category, quota) tuple
- **Retraining trigger:** Every new counseling round's allotment data
- **Accuracy target:** Within top 500 ranks of actual closing rank for 90th percentile predictions
- MLflow tracks every experiment. DVC versions every training dataset.

**3.2 `RLCounselingAgent`**
- **Architecture:** Multi-armed bandit + Policy Gradient RL
- **State:** Student rank, category, preferences, current counseling round, historical upgrade patterns
- **Action:** Recommend choice list ordering
- **Reward:** Student gets ≥ their preference score (weighted: branch interest 40%, college tier 30%, location 20%, fees 10%)
- **Training data:** Historical JoSAA round-wise allotment outcomes (public data + user-consented outcomes)
- **Key insight:** The RL agent learns the "upgrade game" — when to put a reach college first because the upgrade probability in later rounds is high

**3.3 `RAGKnowledgeAgent`**
- **Architecture:** LangChain RAG + Vertex AI Embeddings + FAISS vector store
- **Knowledge base:** All official brochures, past year counseling FAQs, college prospectuses, UGC/AICTE regulations
- **Purpose:** Power the NLP Q&A — "Can I participate in CSAB if I've already accepted a JoSAA seat?" → accurate, sourced answer
- **Hallucination guard:** Every response must cite a specific document chunk with confidence score. If confidence < 0.75, response includes: "Please verify on official website"
- **Embedding refresh:** Every new validated document triggers incremental index update

**3.4 `CareerGraphAgent`**
- **Architecture:** Neo4j knowledge graph
- **Nodes:** College, Branch, Skill, JobRole, Industry, Company, Salary_Band, PG_Program
- **Edges:** "branch → common_job_roles", "job_role → required_skills", "college → placement_companies", "branch → average_package_2020_2024"
- **Data sources:** AmbitionBox, LinkedIn job postings, NIRF placement reports, company career pages
- **Purpose:** Power "What can I do after Civil Engineering at NIT Trichy?" with real data, not generic answers

**3.5 `PersonalizationAgent`**
- Maintains a real-time student preference model (collaborative filtering)
- "Students with your rank, category, and branch preference who looked at NIT Warangal also seriously considered BITS Hyderabad"
- Powers the "Students Like You" recommendation feed
- Fully privacy-compliant: no PII in model features, only anonymized behavioral signals

**3.6 `AccuracyMonitorAgent`** ← The Accuracy Guardian
- After each counseling round, compares ADMIT OS predictions vs actual allotments for all users who shared outcomes
- Computes: MAE, rank prediction accuracy at P50/P75/P90
- If accuracy drops below threshold → triggers model retraining immediately + alerts ML team
- Publishes weekly accuracy report to dashboard (visible internally AND optionally to users as a trust signal)

**Human Oversight:** Senior Data Scientist, ML Engineer, Instructional Designer (for RL reward design)
**Synchronization:**
- Subscribes to: `data_validated_event`
- Publishes: `model_trained_event`, `model_deployed_event`, `accuracy_report_event`

---

### 🟠 TEAM 4 — BACKEND & INFRASTRUCTURE
**Mission:** Build the API layer, microservices, and cloud infrastructure that serves 500K+ concurrent students during peak counseling windows (JoSAA Round 1 results day = traffic spike 100x normal).

**Lead Agent:** `BackendArchitectAgent`

#### Sub-Agents:

**4.1 `APIGenerationAgent`**
- Generates FastAPI boilerplate from OpenAPI specs published by Team 2
- Auto-creates: endpoint, request/response models (Pydantic), database query, unit test skeleton
- Code review via CodeRabbit integration before merge

**4.2 `ScalabilityAgent`**
- Monitors GKE pod performance, auto-scales HPA (Horizontal Pod Autoscaler) configs
- Pre-scales prediction service 2 hours before known high-traffic events (counseling result times are predictable — they're announced in advance)
- Load tests every major release with k6

**4.3 `SecurityAgent`**
- Scans every PR for OWASP Top 10 vulnerabilities (Snyk integration)
- Manages JWT auth, rate limiting, DDoS protection (Cloud Armor)
- DPDP Act 2023 compliance checks — ensures no student PII is exposed in logs

**4.4 `DataPipelineAgent`**
- Apache Airflow DAGs for ETL: raw data → cleaned → feature store → model training
- Real-time streaming: Kafka consumers for live counseling data ingestion
- Data quality checks (Great Expectations) on every pipeline run

**Microservices Architecture (each deployed independently on GKE):**
```
├── auth-service          (JWT, OAuth2, Google/Apple SSO)
├── user-service          (profiles, preferences, exam registrations)
├── prediction-service    (college predictor, rank estimator)
├── notification-service  (push, email, SMS, WhatsApp)
├── counseling-service    (choice filling assistant, scenario simulator)
├── career-service        (Neo4j graph queries, path recommendations)
├── community-service     (forums, mentor matching, posts)
├── content-service       (official docs, notifications, timelines)
└── analytics-service     (event tracking, funnel analysis)
```

**Human Oversight:** Engineering Manager (Backend), Senior Backend Dev, DevOps Engineer
**Synchronization:**
- Subscribes to: `feature_requirements_event`, `model_deployed_event`
- Publishes: `api_ready_event`, `infrastructure_health_event`

---

### 🟣 TEAM 5 — FRONTEND & PRODUCT EXPERIENCE
**Mission:** Build the most beautiful, fastest, most intuitive post-exam app UI that exists. Students should WANT to open the app, not just need to.

**Lead Agent:** `FrontendArchitectAgent`

#### Sub-Agents:

**5.1 `MobileUIAgent`** (React Native + Expo + NativeWind)
- Develops all mobile screens: onboarding, rank input, predictor UI, timeline, counseling assistant, community
- Accessibility compliance: WCAG 2.1 AA
- Offline mode: key data (student's personalized predictions, their choice list draft) available offline via SQLite

**5.2 `WebUIAgent`** (Next.js + TypeScript + Tailwind + shadcn/ui)
- Builds web platform (many students use desktop during choice filling — it's high-stakes work)
- SSR for SEO: "JEE Main 2025 NIT Cutoffs" pages rank on Google → organic acquisition
- Interactive choice filling table optimized for drag-and-drop on desktop

**5.3 `ABTestAgent`**
- Runs continuous A/B tests on: onboarding flow, predictor result presentation, notification copy
- Statistical significance gating: no test concludes until p < 0.05 with ≥1000 participants per variant
- Auto-promotes winning variants, deprecates losers

**5.4 `DesignSystemAgent`**
- Maintains component library (Storybook)
- Ensures visual consistency across web + mobile
- Generates design tokens from Figma API automatically

**Critical UX Principles (non-negotiable):**
1. **Prediction results in ≤3 taps** from app open
2. **Zero ambiguity design**: every data point has a source, every prediction has a confidence indicator
3. **One-tap notifications**: "New JoSAA round announced — tap to see your updated predictions"
4. **Calm design language**: students are already stressed. No alarming red unless truly urgent. Use amber for "check this", green for "good news", neutral blues for information.

**Human Oversight:** Engineering Manager (Mobile + Web), UX Researcher, Brand Manager
**Synchronization:**
- Subscribes to: `api_ready_event`, `model_deployed_event`
- Publishes: `ui_component_ready_event`, `app_release_candidate_event`

---

### 🔴 TEAM 6 — CONTENT & ACCURACY INTELLIGENCE
**Mission:** Be the authoritative, human-verified source of truth for all counseling knowledge. Own the content moat.

**Lead Agent:** `ContentOrchestrationAgent`

#### Sub-Agents:

**6.1 `FactCheckerAgent`**
- Every piece of counseling information published on ADMIT OS passes through this agent
- Checks against official source, flags discrepancies, holds publication until resolved
- Three-strike rule: if a data source is wrong 3 times in a row, it is deprioritized

**6.2 `CollegeProfileAgent`**
- Builds and maintains rich profiles for every NIRF-ranked institution (top 500 engineering, top 100 medical)
- Data: NAAC grade, NIRF rank, NBA-accredited programs, placement data (NIRF mandatory disclosure), fee structure, hostel availability, gender ratio, average package, top recruiters
- Refresh cycle: Annual (post-NIRF release) + real-time for fee/seat matrix changes

**6.3 `SMEReviewAgent`**
- Routes flagged content to the correct Subject Matter Expert (JEE counseling SME, NEET counseling SME, state CET SME)
- SLA: 4 hours for critical data (cutoffs, dates), 24 hours for general content
- Tracks SME review throughput, escalates bottlenecks to Content Lead

**6.4 `LocalizationAgent`**
- Translates key content to: Hindi, Marathi, Telugu, Kannada, Tamil, Bengali
- Uses DeepL + GPT-4o for initial translation, SME review for counseling-specific terminology
- Prioritizes: notification copy, predictor result explanations, college profiles

**Human Oversight:** Lead SME (per exam), Content Editor, Pedagogical Designer
**Synchronization:**
- Subscribes to: `data_validated_event`, `feature_requirements_event`
- Publishes: `content_ready_event`, `sme_review_required_event`

---

### ⚪ TEAM 7 — GROWTH, COMMUNITY & TRUST
**Mission:** Make ADMIT OS the app every student tells their friend about. Build the trust layer. Own the community.

**Lead Agent:** `GrowthOrchestrationAgent`

#### Sub-Agents:

**7.1 `CommunityModerationAgent`**
- Moderates forums: flags toxic content, misinformation about cutoffs, predatory coaching ads
- Special rule: anyone posting wrong cutoff data (claiming a cutoff that contradicts our verified data) gets a "Unverified Claim" badge on their post + link to official source
- Sentiment monitor: detects student distress signals (anxiety about results, fear of gap year) → routes to peer support resources

**7.2 `MentorMatchAgent`**
- Matches current aspirants with verified seniors (IIT/NIT/AIIMS alumni)
- Matching algorithm: same target college, same branch preference, similar rank, same category
- Mentor verification: LinkedIn + college email OTP verification

**7.3 `SEOAgent`**
- Generates SEO-optimized pages: "[Exam] [Year] [College] [Branch] Cutoff" → 50,000+ such pages
- These pages = organic acquisition machine. Students googling "NIT Trichy CSE OBC cutoff 2025" land on ADMIT OS
- Schema markup for rich snippets (cutoff tables appear directly in Google search results)

**7.4 `NotificationStrategyAgent`**
- Engineers the notification calendar: what to send, when, to whom, via which channel
- Channels: Push, Email, WhatsApp (Business API), SMS (critical-only)
- Zero notification fatigue: students can set their counseling stage, and notifications are scoped to only what's relevant
- "JoSAA Round 2 results in 3 hours — your predicted allotment is ready" = the most valuable notification in a student's life that day

**7.5 `ViralLoopAgent`**
- Designs and monitors viral mechanics: "Share your predicted college card" (Spotify Wrapped-style result card)
- "Compare your rank with friends" — shareable rank comparison feature
- "College Acceptance Story" — students post their final admission, drives aspiration content

**Human Oversight:** Marketing Manager, Community Manager, PR Specialist, Brand Manager
**Synchronization:**
- Subscribes to: `app_release_candidate_event`, `feature_launch_event`, `content_ready_event`
- Publishes: `growth_metric_event`, `community_health_event`

---

## PART 4 — THE KILLER FEATURES (Prioritized Build Order)

### TIER 1 — Launch Day Features (Must Have at Beta)

#### Feature 1: RANK RADAR — The Hyper-Accurate College Predictor
**What it does:** Student enters rank + category + state → instantly gets a color-coded list of colleges/branches with probability scores.

**Why it's better than competition:**
- Not just "safe/moderate/reach" buckets — actual probability percentages (78% chance, not just "moderate")
- Shows confidence interval: "Closing rank last year: 8,421–8,650. Our model predicts: 8,200–8,500 for 2025"
- Source-cited: every cutoff data point links to the official JoSAA/state portal PDF
- Category-aware: correctly handles OBC-NCL, EWS, PwD, Female supernumerary, Home State quota simultaneously
- Runs on validated historical data, never hallucinated

**AI stack:** XGBoost + LightGBM ensemble, LSTM trend layer, confidence interval estimation

---

#### Feature 2: COUNSELING COMPASS — The AI Choice Filling Assistant
**What it does:** Guides students through building their optimized choice list, step by step.

**Conversation flow:**
1. Student inputs rank, category, preferences
2. AI asks: "What matters more to you — college brand or specific branch?" (5-slider priority interface)
3. AI generates optimal choice list ordering with explanation for each choice
4. "Why is BITS Pilani Mechanical at #3 and NIT Trichy CSE at #4?" → AI explains: "Based on your stated preference for college brand (70%) and historical upgrade probability from this rank in round 2 (42%)"
5. "What If" mode: "What if I remove all non-CSE options?" → instant re-optimization
6. Export as PDF for reference during actual choice filling

**AI stack:** RL Policy Gradient agent, Optimization (genetic algorithm for choice ordering), RAG for official counseling rules

---

#### Feature 3: NOTIFICATION NERVE CENTER — Real-Time Official Alerts
**What it does:** Replaces the need to check 15 different official websites.

- Personalized to student's registered exams, categories, states
- "JoSAA Round 2 seat allotment results are live. Your predicted seat: CSE at NIT Warangal. Tap to see full allotment."
- Document checklist: "Round 2 reporting tomorrow — here are your 7 required documents"
- Deadline countdown: visual timeline of every remaining counseling step
- Sources always shown: every notification links to the official page it was derived from

---

#### Feature 4: BRANCH COMPASS — The "Branch vs. Brand" Decision Tool
**What it does:** Answers the #1 student dilemma with actual data.

Input: "IIT Dhanbad Mining vs. NIT Trichy CSE — which is better for me?"

Output:
- Placement data comparison (median, top package, % placed) — sourced from NIRF reports
- Career paths for each branch (knowledge graph)
- Salary trajectory at 5 years (industry data)
- "Students who chose Mining at IIT (ISM) commonly transitioned to: GATE (30%), MBA (25%), Core mining (20%), IT sector (25%)"
- Personalizable: weight each factor by student's own priorities

---

### TIER 2 — V1 Features (First 3 months post-launch)

#### Feature 5: ADMISSION ALMANAC — Personalized Timeline & Checklist
- Calendar view of every counseling event relevant to the student
- Dynamic checklist: documents, fees, reporting dates
- Smart reminders: "Fee payment deadline in 6 hours"
- Integrates Google Calendar

#### Feature 6: FINANCIAL MAP — Scholarships & Loan Finder
- Input: category, family income, state, college
- Output: eligible scholarships (NSP, state scholarships, college-specific), education loan options with interest rates, total 4-year cost breakdown
- Never shown wrong scholarship info — all sourced from NSP portal + official college fee structures

#### Feature 7: CAREER ATLAS — Post-Admission Path Planning
- Knowledge graph: Branch → Skills → Jobs → Companies → Salaries
- "What does a day in the life of a Chemical Engineer look like?"
- "What skills should I start building in Semester 1 to get a good placement?"

---

### TIER 3 — V2 Features (3–6 months post-launch)

#### Feature 8: COMMUNITY CAMPUS — Peer Network
- College-verified student forums
- Senior mentorship (verified alumni)
- "W or L" honest reviews: seniors rate their college/branch experience on career, campus life, faculty, placements
- No promotional content from colleges allowed — purely peer-to-peer

#### Feature 9: COLLEGE INSIDER — Immersive Campus Preview
- Student-submitted photos, videos of hostels, labs, canteens
- "Day in My Life" vlogs from current students
- AI-summarized: "Students most commonly mention: great placement cell, poor hostel food, excellent faculty in CS department"

#### Feature 10: RANK REWIND — Post-Result Analysis
- After results: "You scored X. Here's how you performed vs. expected, and what it means for your counseling strategy"
- Score → Percentile → Rank conversion with confidence bounds
- State rank vs. All India rank calculator

---

## PART 5 — DEVELOPMENT PHASES & SPRINT TIMELINE

### Phase 0: Foundation (Weeks 1–4)
**All Teams Parallel:**
- Team 1: Data infrastructure setup. Begin historical data ingestion (JoSAA 2015–2024, NEET 2015–2024, state CETs)
- Team 2: Finalize feature specs for Tier 1. User research interviews (20 recent JEE/NEET students)
- Team 3: ML environment setup. Begin Cutoff Prediction model v0 training
- Team 4: GKE cluster setup, CI/CD pipelines, base microservices scaffolding
- Team 5: Design system, component library, onboarding flow mockups
- Team 6: SME hiring/onboarding. College profile template design
- Team 7: App Store account setup, domain acquisition, brand asset creation

### Phase 1: Core Build (Weeks 5–12)
**Sprint cadence: 2-week sprints, 4 sprints**

**Sprint 1–2 (Weeks 5–8):**
- Team 1: Complete historical data pipeline for JEE + NEET. Deploy WebCrawlerAgent for live monitoring
- Team 3: Cutoff Prediction model v1 (JEE Main only). Target: 85% accuracy within 500 ranks
- Team 4: Auth, User, Prediction microservices live in staging
- Team 5: Onboarding + Rank Radar UI in React Native

**Sprint 3–4 (Weeks 9–12):**
- Team 3: Expand prediction to NEET, MHT-CET. RAG knowledge base populated with JoSAA/MCC brochures
- Team 4: Notification, Counseling, Content microservices live in staging
- Team 5: Counseling Compass UI, Notification Center UI, Branch Compass UI
- Team 6: College profiles for top 200 engineering + top 50 medical colleges complete
- Team 7: SEO page generation begins (targeting 10K high-traffic counseling queries)

### Phase 2: Beta (Weeks 13–16)
- Private beta: 500 students from JEE 2025 + NEET 2025 cohort
- AccuracyMonitorAgent: first real-world validation vs. JoSAA Round 1 2025 actuals
- All Tier 1 features live and bug-free
- Performance: load test for 50K concurrent users
- App Store submission (Android first, iOS concurrent)

### Phase 3: Public Launch (Weeks 17–20)
- Public launch timed to JEE Advanced 2025 results OR NEET 2025 results (whichever is first and larger)
- Full marketing campaign (Team 7): YouTube, Instagram Reels, student influencer partnerships
- PR: "The app that's replacing JoSAA's confusing website"
- Real-time ops during JoSAA Round 1: All agents running, human teams on standby, incident response plan active

### Phase 4: Iteration (Months 6–12)
- Tier 2 features (Financial Map, Career Atlas, Admission Almanac)
- KCET + state CET expansion
- NEET PG counseling module
- Tier 3 features (Community, College Insider)
- International: consider CUET UG counseling module

---

## PART 6 — ACCURACY GUARANTEE FRAMEWORK

This is ADMIT OS's most important differentiator and most important risk. Wrong data = student picks wrong college = life impact. This is treated with the same seriousness as a medical app.

### The Three Lines of Defense:

**Line 1 — Automated (ContentValidationAgent + FactCheckerAgent)**
- Multi-source cross-validation
- Statistical anomaly detection
- Confidence scoring on every data point

**Line 2 — Human SME Review**
- Every new data point with confidence < HIGH reviewed by a human SME within 4 hours
- Critical data (seat matrices, cutoff lists, counseling dates) require dual SME sign-off before publication
- SMEs are domain experts: at least one IIT alumnus per zone (North/South/East/West) who has personally navigated JoSAA counseling

**Line 3 — Post-Round Accuracy Audit**
- After every counseling round, compare predictions vs. actuals for all students who shared outcomes
- Public accuracy dashboard: "Our JEE Main 2025 predictions were accurate within 300 ranks for 88% of students"
- This dashboard is both a trust signal AND an internal quality pressure

**What We Never Do:**
- Never publish cutoff data from unofficial sources without SME verification
- Never let the RAG system answer with confidence > 0.75 from a >1-year-old document without checking for updates
- Never show a prediction without its confidence interval
- Never claim "exact" cutoffs — always "predicted range based on historical trends"

---

## PART 7 — KEY PERFORMANCE INDICATORS

| KPI | Target (Month 6) | Target (Month 12) |
|-----|-----------------|-------------------|
| Monthly Active Users | 500K | 2M |
| Prediction Accuracy (within 500 ranks) | 85% | 92% |
| App Store Rating | 4.5+ | 4.7+ |
| Daily Session Duration (peak counseling) | 12 min | 18 min |
| D7 Retention | 45% | 60% |
| Organic Search Traffic | 100K/month | 1M/month |
| Data Accuracy Score | 95% | 99% |
| Notification Open Rate | 35% | 50% |

---

## PART 8 — MONETIZATION (Designed for Student Trust)

**Core philosophy: The app must be free enough that no student misses critical guidance due to money.**

| Tier | Price | What's Included |
|------|-------|-----------------|
| **Free** | ₹0 | Rank Radar (5 predictions/day), Notification Center, College Profiles, Community |
| **ADMIT Plus** | ₹299/month or ₹799/cycle | Unlimited predictions, Counseling Compass, Branch Compass, Financial Map, Career Atlas, Priority alerts |
| **ADMIT Pro** | ₹1,499/cycle | Everything in Plus + 2 live 30-min sessions with a verified counselor/senior, Choice list PDF export, Direct mentor access |

**Why this works:**
- Free tier is genuinely useful — drives viral adoption
- Plus tier is priced at < 1 day of coaching class fees — easy conversion
- Pro tier serves students who need human validation of their AI-generated strategy

**What we do NOT do:** Sell college advertisements, take referral fees from colleges, or bias predictions toward partner institutions. This would destroy trust and is permanently off the table.

---

*Document Version 1.0 | ADMIT OS Development Team | June 2026*
*Classification: Internal — Product Planning*
