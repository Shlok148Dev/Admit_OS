# Contributing to Admit OS 🎓

Thank you for your interest in contributing to **Admit OS**! We welcome contributions from developers, researchers, designers, and educators to help make higher education admissions guidance accessible, transparent, and deterministic.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Development Environment Setup](#development-environment-setup)
4. [Branching and Commit Guidelines](#branching-and-commit-guidelines)
5. [Testing & Quality Assurance](#testing--quality-assurance)
6. [Submitting a Pull Request](#submitting-a-pull-request)
7. [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)

---

## 📜 Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all members of the community with respect and empathy.

---

## 🛠️ How to Contribute

- **Report Bugs**: Open a GitHub Issue detailing the steps to reproduce, expected behavior, and screenshots/logs.
- **Suggest Features**: Submit an issue with the tag `enhancement` outlining the use case and proposed design.
- **Submit PRs**: Resolve open issues, implement features, optimize database queries, or improve documentation.

---

## 💻 Development Environment Setup

### Prerequisites
- **Python**: `3.10` or higher
- **Node.js**: `18.x` or `20.x` LTS
- **Docker & Docker Compose** (optional, for full containerized stack)
- **Git**

### Backend Setup (FastAPI Microservices)
```bash
# 1. Clone repository
git clone https://github.com/Shlok148Dev/Admit_OS.git
cd Admit_OS

# 2. Create Python virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
# Or if using pyproject.toml:
pip install -e .

# 4. Copy environment template
cp .env.example .env
# Edit .env with your local settings and API keys
```

### Frontend Setup (Next.js 14)
```bash
cd frontend/web
npm install
npm run dev
```

The web client will be available at `http://localhost:3000`.

---

## 🌿 Branching and Commit Guidelines

### Branch Naming Conventions
- `feat/feature-name` for new capabilities
- `fix/bug-fix-name` for bug fixes
- `docs/documentation-update` for documentation changes
- `test/test-suite-improvements` for testing updates
- `refactor/code-optimization` for non-breaking cleanups

### Commit Message Format
We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```text
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```
*Examples:*
- `feat(counseling): add multi-year cutoff trend forecasting`
- `fix(rag): enforce causal citations on compensation queries`
- `docs(readme): add microservices architecture diagram`

---

## 🧪 Testing & Quality Assurance

Before opening a pull request, ensure all tests pass:

```bash
# Run pytest test suite
pytest

# Run the quantitative metric evaluation benchmark
python tests/evaluate_aria_metrics.py
```

### Code Formatting Standards
- **Python**: Formatted with `black` and `ruff` / `flake8`.
- **TypeScript / React**: Formatted with `prettier` and validated with `eslint`.

---

## 🚀 Submitting a Pull Request

1. Fork the repository and create your branch from `main`.
2. Ensure your changes have corresponding unit/integration tests where applicable.
3. Verify that no secrets, `.env` files, or local test artifacts are committed.
4. Push your branch to your fork.
5. Open a Pull Request against `Shlok148Dev/Admit_OS:main`.
6. Provide a clear PR description detailing what was changed, why, and how to test it.

---

## 🔒 Reporting Security Vulnerabilities

Please do not report security vulnerabilities through public GitHub issues. Refer to [SECURITY.md](SECURITY.md) for our coordinated disclosure process.
