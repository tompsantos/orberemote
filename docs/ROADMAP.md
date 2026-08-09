# roadmap

Orbe Remote is being built in narrow, testable slices. The ordering favors a safe execution path before convenience features.

## alpha 1 — foundation ✅

- model-agnostic MCP gateway
- outbound WebSocket device relay
- exact device routing
- SSH config discovery
- native OpenSSH execution
- host allowlist
- fail-closed risk classification
- frozen single-use approvals
- agent-side secondary policy check
- append-only audit log
- Kimi Code plugin manifest
- adversarial policy tests

## alpha 2 — real end-to-end remote operation 🔨

- disposable SSH target integration fixture
- gateway → device agent → SSH end-to-end tests
- reconnect/retry tests
- command cancellation and failure propagation
- structured host diagnostics

## alpha 3 — persistent operations

- persistent SSH sessions
- PTY support
- asynchronous process handles
- long-running log streams
- bounded session lifecycle

## alpha 4 — safe remote files

- canonical-path enforcement
- remote read/list/stat tools
- upload/download
- diff-before-write
- protected-path policy
- secret redaction

## beta — identity and human approval

- OAuth 2.1 + PKCE for MCP clients
- device enrollment/revocation
- tenant isolation
- human-bound approval UI
- action hash + short-lived signed capability token
- WebAuthn/passkey confirmation for high-risk operations
- tamper-evident audit records
- rate limiting and abuse controls

## distribution

- hosted HTTPS MCP endpoint
- Kimi Code curated-plugin proposal
- ChatGPT app/remote MCP integration
- Claude/Cursor/other MCP client guides
- packaging and installer for Linux/macOS/Windows agents

## later

- RBAC/team policies
- multi-host workflows
- Docker/systemd first-class tools
- policy profiles (homelab, staging, production)
- organization audit dashboard
- enterprise SSO and policy administration
