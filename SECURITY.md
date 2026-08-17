# Security Policy 🔒

## Supported Versions

We actively provide security patches and updates for the following versions of Admit OS:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

The security and privacy of student data and institutional datasets is paramount. If you discover a security vulnerability within Admit OS, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Send an email to the project maintainers with:
   - Description of the vulnerability.
   - Steps to reproduce or proof-of-concept (PoC).
   - Affected services or microservices endpoints.
   - Potential impact.
3. You will receive an initial response acknowledging the report within 48 hours.
4. We will coordinate a fix and release a security patch before publicly disclosing the vulnerability.

---

## Security Best Practices for Self-Hosting

- Always use strong, randomly generated secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Never expose internal microservice ports (`8001`, `8002`, `6379`) directly to the public internet without reverse proxy authentication.
- Ensure HTTPS / TLS is enforced in production environments.
- Regularly rotate API keys and database credentials.
