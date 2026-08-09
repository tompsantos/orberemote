# contributing to orbe remote

Thanks for helping make remote operations for AI agents safer.

## project status

Orbe Remote is an early alpha. The public API and internal architecture may change quickly. Do not use the current release against production systems.

## development setup

Requirements:

- Node.js 22+
- OpenSSH client

```bash
cp .env.example .env
npm install
npm run build
npm test
```

## contribution principles

1. **fail closed**: unknown operations must never become implicitly trusted.
2. **keep credentials local**: SSH secrets stay on the device agent whenever possible.
3. **no silent privilege escalation**: privileged or mutating operations require explicit policy handling.
4. **test adversarially**: security-sensitive changes need tests for bypasses, shell composition and malformed input.
5. **small reviewable changes**: prefer focused pull requests with a clear threat model and validation notes.

## pull requests

Include:

- what changed and why
- security implications
- tests added or updated
- compatibility impact on MCP clients, gateway, agent or SSH behavior

Security-sensitive behavior should include at least one negative/adversarial test.

## security reports

Please do not publish exploitable vulnerabilities in a public issue. See [SECURITY.md](SECURITY.md) for the current security model and disclosure guidance.
