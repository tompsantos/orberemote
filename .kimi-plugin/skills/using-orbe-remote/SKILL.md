---
name: using-orbe-remote
description: Safely inspect and operate remote machines and SSH hosts through Orbe Remote MCP.
---

# using orbe remote

use the `mcp__orbe-remote__*` tools when a task requires access to a remote machine or ssh host.

workflow:

1. discover the target with `list_devices` and `list_hosts` when needed.
2. prefer narrow read-only diagnostics before changing anything.
3. use `run_command` for remote shell work.
4. when `run_command` returns `approval_required`, present the frozen device, host, command and risk to the user. do not call `approve_action` until the user explicitly approves that exact action.
5. if the user changes the command or scope, create a new pending action instead of reusing the old approval.
6. never expose ssh private keys, tokens, `.env` contents or other secrets in chat.
7. do not disable host-key checking, host allowlists or policy controls to bypass an error.
8. after mutating actions, verify the result with a read-only check.
