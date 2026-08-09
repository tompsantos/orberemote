# Orbe Remote architecture v0.1

```text
AI client (Kimi / ChatGPT / Claude / Codex)
                 |
          MCP Streamable HTTP
                 |
        +-------------------+
        |  Orbe Gateway     |
        |  MCP + policy     |
        |  audit + relay    |
        +-------------------+
                 |
        outbound WebSocket
                 |
        +-------------------+
        | Orbe Remote Agent |
        | native OpenSSH    |
        +-------------------+
                 |
              SSH hosts
```

## Trust boundaries

1. The LLM is untrusted input.
2. The MCP gateway validates schemas and applies policy before dispatch.
3. Mutating commands use two-phase approval with a frozen command payload.
4. The agent opens an outbound connection; no inbound SSH/API port is required for the agent.
5. SSH authentication stays on the device and uses native OpenSSH configuration/agent.
6. The agent never sends SSH private keys to the gateway or model.
7. Production transport must replace development bearer tokens with OAuth 2.1 / device enrollment and per-user scoping.

## Why native OpenSSH

Using the system SSH client keeps ProxyJump, certificates, hardware-backed keys, ssh-agent, enterprise configs and host-key policy. Orbe Remote avoids implementing SSH authentication itself.

## Security defaults

- StrictHostKeyChecking=yes
- BatchMode=yes
- host allowlist
- no password annotations/secrets in config
- no shell=true on local command spawning
- bounded command timeout
- bounded output
- immutable, single-use approvals
- append-only local JSONL audit trail

## Roadmap

v0.2: persistent SSH sessions + PTY + process handles
v0.3: remote file read/write with canonical path policy and diff-before-write
v0.4: OAuth 2.1 + PKCE, multi-user tenant isolation and device enrollment
v0.5: UI approvals, WebAuthn optional high-risk approval, signed audit records
v0.6: Kimi plugin manifest + ChatGPT app packaging
