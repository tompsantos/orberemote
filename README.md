# orbe remote

> secure remote operations for ai agents.

Orbe Remote lets MCP-capable AI clients operate machines and SSH hosts without copying commands between chat and terminals. A lightweight agent makes an outbound connection to the Orbe Gateway; the gateway exposes MCP tools and enforces a two-phase approval policy before risky operations.

**status:** `v0.1.0-alpha.1` research prototype. do not use against production systems yet.

[architecture](docs/ARCHITECTURE.md) · [roadmap](docs/ROADMAP.md) · [security model](SECURITY.md) · [contributing](CONTRIBUTING.md)

## what already works

- remote MCP endpoint over Streamable HTTP
- outbound device relay over WebSocket
- multiple connected devices
- SSH host discovery from `~/.ssh/config` including `Include`
- native OpenSSH command execution
- host allowlisting
- host metadata and connectivity checks
- bounded timeout/output
- risk classification
- automatic execution for recognized read-only diagnostics
- frozen single-use approval IDs for mutating/risky commands
- append-only audit log

## the differentiator

Most SSH MCP servers expose remote code execution directly. Orbe Remote puts an execution-control layer between the model and SSH:

```text
read-only diagnostic -> execute
mutation              -> freeze -> explicit approval -> execute once
critical operation     -> freeze -> explicit approval -> execute once + audit
```

Client-side approval dialogs are useful UX, but they are not treated as the security boundary.

## local development

```bash
cp .env.example .env
npm install
npm run build
```

Terminal 1:

```bash
export ORBE_REMOTE_DEVICE_TOKEN=dev-device-token
export ORBE_REMOTE_API_TOKEN=dev-api-token
npm run gateway
```

Terminal 2:

```bash
export ORBE_REMOTE_DEVICE_TOKEN=dev-device-token
export ORBE_REMOTE_DEVICE_ID=my-machine
export ORBE_REMOTE_ALLOWED_HOSTS='staging,prod-*'
npm run agent
```

The MCP endpoint is:

```text
http://127.0.0.1:8787/mcp
```

Development auth:

```text
Authorization: Bearer dev-api-token
```

## tools

- `list_devices`
- `list_hosts`
- `host_info`
- `check_connectivity`
- `run_command`
- `approve_action`
- `deny_action`
- `audit_tail`

## important limitation

The v0.1 gateway uses development bearer tokens. Public ChatGPT/Kimi distribution requires the platform-specific publishing/auth layer. The intended production path is OAuth 2.1 + PKCE with refresh tokens, tenant isolation and device enrollment.

## roadmap

The next engineering slice is an end-to-end gateway → device agent → disposable SSH target integration test. Persistent sessions/PTY, safe remote file operations, human-bound approvals and hosted OAuth follow after that. See [docs/ROADMAP.md](docs/ROADMAP.md).

## attribution

See `THIRD_PARTY_NOTICES.md`. This implementation is informed by Desktop Commander MCP, Aionda MCP SSH Agent and Denys Vitali ssh-mcp, all MIT-licensed.
