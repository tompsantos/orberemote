#!/usr/bin/env node
import path from 'node:path';
import { homedir } from 'node:os';
import { OrbeRemoteAgent } from './agent/agent.js';
import { startGateway } from './gateway/gateway.js';
import { DeviceRegistry } from './gateway/device-registry.js';
import { serveStdio } from './mcp/server.js';

const command = process.argv[2] ?? 'help';
const env = process.env;
const auditPath = path.resolve(env.ORBE_REMOTE_AUDIT_PATH ?? path.join(homedir(), '.orbe-remote', 'audit.jsonl'));

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`missing environment variable ${name}`);
  return value;
}

async function main() {
  if (command === 'gateway') {
    await startGateway({
      port: Number(env.ORBE_REMOTE_PORT ?? 8787),
      deviceToken: required('ORBE_REMOTE_DEVICE_TOKEN'),
      apiToken: required('ORBE_REMOTE_API_TOKEN'),
      auditPath
    });
    return;
  }

  if (command === 'agent') {
    const agent = new OrbeRemoteAgent({
      gatewayUrl: env.ORBE_REMOTE_GATEWAY_URL ?? 'ws://127.0.0.1:8787/agent',
      deviceId: env.ORBE_REMOTE_DEVICE_ID ?? 'default',
      deviceToken: required('ORBE_REMOTE_DEVICE_TOKEN'),
      allowedHosts: (env.ORBE_REMOTE_ALLOWED_HOSTS ?? '*').split(',').map(v => v.trim()).filter(Boolean)
    });
    await agent.start();
    process.on('SIGINT', () => { agent.stop(); process.exit(0); });
    process.on('SIGTERM', () => { agent.stop(); process.exit(0); });
    return;
  }

  if (command === 'stdio') {
    console.error('[orbe-remote] stdio mode is intended for future local transport; remote mode uses the gateway /mcp endpoint.');
    const registry = new DeviceRegistry();
    await serveStdio(registry, auditPath);
    return;
  }

  console.log(`orbe remote v0.1.0-alpha.1\n\ncommands:\n  orbe-remote gateway   start remote MCP + device relay\n  orbe-remote agent     connect this machine to the relay\n\nenv: see .env.example`);
}

main().catch(error => { console.error('[orbe-remote] fatal:', error); process.exit(1); });
