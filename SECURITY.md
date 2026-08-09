# security model

orbe remote treats the llm, prompts, tool arguments, remote command output and remote hosts as untrusted input.

## current alpha guarantees

- the agent initiates the connection outward to the gateway
- remote ssh credentials remain on the agent machine
- native openssh is launched with `shell: false`
- ssh aliases are syntactically validated before process launch
- host access is constrained by an agent-side allowlist
- `StrictHostKeyChecking=yes` and `BatchMode=yes` are the defaults
- recognized read-only commands may execute automatically
- unknown, mutating, privileged and destructive commands fail closed into approval
- approvals freeze the exact device, host and command, expire and are single-use
- a tool result is accepted only from the exact device that received the call
- reconnecting with the same device id replaces the older connection
- command runtime and output size are bounded
- security-relevant actions are written to the audit log

## important alpha limitation: approval is not yet human-bound

`approve_action` is an mcp tool. the server instructs the model to call it only after explicit user approval, but the alpha does not cryptographically prove that a human clicked an independent approval control.

therefore the two-phase flow is a safety mechanism, not yet the final authorization boundary.

before production, high-risk approvals must be mediated outside the llm tool surface, for example through a signed approval ui, webauthn/passkey confirmation, or a platform-native human confirmation that yields a short-lived capability token bound to the frozen action hash.

## production blockers

v0.1 must not be treated as production-ready until these exist:

1. oauth 2.1 + pkce for mcp clients
2. per-user tenant isolation
3. per-device credentials and enrollment/revocation
4. signed or tamper-evident audit records
5. independent human-bound approval for high/critical operations
6. rate limits and abuse controls
7. tls-only public transport
8. replay protection across gateway restarts
9. secrets redaction and structured output filtering
10. security review and adversarial tests

## design rule

orbe remote prefers allowlists and positive classification over command blocklists. an unknown operation is not assumed safe merely because it failed to match a dangerous regex.
