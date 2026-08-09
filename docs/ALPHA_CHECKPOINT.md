# alpha checkpoint — 2026-08-08

## implemented

- model-agnostic remote mcp gateway
- outbound websocket device agent
- exact device routing and reconnect replacement
- ssh config discovery with include support
- native openssh execution with `shell: false`
- strict host-key checking
- host allowlists
- bounded output and timeout
- fail-closed command risk classification
- two-phase frozen approvals
- agent-side secondary policy check
- audit log
- kimi code plugin package for local development

## tested

12 core policy tests pass, including adversarial cases for:

- `rm -rf`
- raw disk writes with `dd`
- `curl | bash`
- privilege elevation
- unknown commands
- shell composition
- read-looking output redirection
- read-looking pipe to an interpreter
- sensitive ssh key paths
- dotenv variants
- approval immutability/single use

## not yet verified in this sandbox

full dependency installation/build. the sandbox npm proxy did not contain `@modelcontextprotocol/sdk@1.30.0`, so the complete gateway/agent integration could not be dependency-installed here. the dependency-free policy core was transpiled and executed with node's test runner.

## next engineering slice

1. integration test with real gateway + agent + disposable ssh target
2. persistent sessions / pty / async process handles
3. file read/write with canonical-path policy and diff-before-write
4. oauth/device enrollment
5. human-bound approval tokens
6. hosted https mcp endpoint
7. public chat client packaging/distribution
