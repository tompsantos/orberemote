# competitor/code study

research snapshot: 2026-08-08.

## desktop commander mcp

source: https://github.com/wonderwhy-er/DesktopCommanderMCP
license: mit

strong patterns worth retaining:

- outbound device process connected to a remote mcp service
- remote tool routing by device
- local mcp server proxy pattern
- heartbeat/reconnect lifecycle
- duplicate call suppression
- broad filesystem/process/terminal tool surface

things orbe remote deliberately changes:

- exact call-to-device binding at the gateway
- one active transport per device id
- no arbitrary url fetch in the remote execution core
- positive read-only classification instead of relying on a blocklist
- strict host-key checking by default
- frozen action approvals and audit as first-class concepts
- a narrower infrastructure-first surface before desktop automation is added

## aionda mcp-ssh

source: https://github.com/AiondaDotCom/mcp-ssh
license: mit

strong patterns worth retaining:

- native openssh rather than reimplementing ssh authentication
- `~/.ssh/config` discovery including `Include`
- host alias validation to avoid option injection
- `shell: false` for local process spawning
- bounded timeout/output
- scp-style file transfer as a future capability

things orbe remote deliberately changes:

- no password annotations in ssh config
- `StrictHostKeyChecking=yes` rather than accept-new
- remote relay + mcp service instead of local-only mcp
- policy/approval/audit layer before ssh execution

## denysvitali/ssh-mcp

source: https://github.com/denysvitali/ssh-mcp
license: mit

strong patterns worth retaining for v0.2:

- persistent shell sessions
- delimiter-based command completion
- pty support
- max lines/max bytes controls
- binary-output detection
- explicit host allowlisting

orbe remote will port these concepts into its own typescript/native-openssh architecture instead of transplanting the go implementation.

## remote mcp/auth infrastructure

projects such as `geelen/mcp-remote` and oauth proxies are useful references for mcp transport/auth, while the model context protocol typescript sdk is the protocol foundation. orbe remote should avoid inventing a proprietary ai-facing protocol when mcp already solves client interoperability.

## resulting product position

orbe remote is not intended to be another generic ssh mcp server or a desktop commander clone.

its intended position is:

> a secure remote operations control plane for ai agents, exposing machines through mcp while keeping credentials local and enforcing device routing, policy, approvals and audit before execution.
