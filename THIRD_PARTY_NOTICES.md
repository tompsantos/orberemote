# Third-party notices

Orbe Remote v0.1 is an original implementation informed by patterns from the following MIT-licensed projects.
Where code or implementation details are substantially adapted in future commits, the original copyright and
permission notice must remain with the adapted portion.

## Desktop Commander MCP

Copyright (c) 2024-2025 Eduard Ruzga and Desktop Commander Contributors
License: MIT
Source: https://github.com/wonderwhy-er/DesktopCommanderMCP

Patterns studied: outbound remote-device relay, MCP tool proxying, device heartbeat/session lifecycle, output pagination.

## MCP SSH Agent (Aionda)

Copyright (c) 2025 aionda.com
License: MIT
Source: https://github.com/AiondaDotCom/mcp-ssh

Patterns studied: native OpenSSH execution, SSH config discovery, host alias validation, SSH/scp safety boundaries.

## ssh-mcp (Denys Vitali)

Copyright © 2025 Denys Vitali
License: MIT
Source: https://github.com/denysvitali/ssh-mcp

Patterns studied: persistent shell sessions, PTY support, output limiting, host allowlisting.
