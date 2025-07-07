# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of GitLab Bulk Manager seriously. If you have discovered a security vulnerability in this project, please report it to us as described below.

### Reporting Process

1. **DO NOT** disclose the vulnerability publicly until it has been addressed by our team.
2. Email your findings to security@gitlab-bulk-manager.com.
3. Provide sufficient information to reproduce the problem, so we can resolve it as quickly as possible.

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass, etc.)
- Full paths of source file(s) related to the manifestation of the vulnerability
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours.
- We will send a more detailed response within 96 hours indicating the next steps in handling your report.
- We will keep you informed of the progress towards a fix and full announcement.
- We will credit you in the security advisory (unless you prefer to remain anonymous).

### Bug Bounty

Currently, we do not offer a paid bug bounty program. We do, however, publicly acknowledge responsible disclosure in our release notes and security advisories.

## Security Best Practices

When using GitLab Bulk Manager, please follow these security best practices:

1. **Protect Your GitLab Personal Access Token**
   - Never commit tokens to version control
   - Use environment variables for token storage
   - Rotate tokens regularly
   - Use tokens with minimal required permissions

2. **Environment Configuration**
   - Always use HTTPS in production
   - Set strong session secrets
   - Configure proper CORS policies
   - Enable rate limiting

3. **Access Control**
   - Limit access to the application
   - Use GitLab's built-in access controls
   - Audit user permissions regularly

4. **Updates**
   - Keep the application updated
   - Monitor security advisories
   - Update dependencies regularly

## Dependencies

We use automated tools to scan our dependencies for known vulnerabilities:
- npm audit for JavaScript dependencies
- Dependabot for automated security updates
- Trivy for container scanning

## Contact

For any security-related questions, contact: security@gitlab-bulk-manager.com