# client integration

## kimi code

orbe remote ships a development kimi plugin at `.kimi-plugin/plugin.json`.

for local development, start the gateway and set:

```sh
export ORBE_REMOTE_API_TOKEN=dev-api-token
```

then install the repository in kimi code and reload the session. the plugin declares `http://127.0.0.1:8787/mcp` and reads the bearer token from `ORBE_REMOTE_API_TOKEN`.

when the hosted gateway exists, the plugin manifest should point to the public https mcp endpoint and use oauth for user authentication rather than a shared development token.

## generic mcp clients

connect to:

```text
https://<gateway>/mcp
```

transport: streamable http.

v0.1 development authentication is a bearer token. production authentication is intentionally not implemented yet.

## chatgpt

orbe remote's ai-facing boundary is already a remote mcp endpoint, which is the correct transport shape for chatgpt apps/custom mcp integrations.

public/production chatgpt work still needs:

- https deployment
- oauth 2.1/pkce
- app metadata and submission packaging
- independent approval ui/capability tokens for high-risk operations
- openai app safety review requirements

custom full write/modify mcp support is plan/workspace-dependent, so the backend should remain client-agnostic rather than tying authorization semantics to a single chat product.
